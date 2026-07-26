// ── 合批弹跳引擎（单 SVG 滤波器 + 单 rAF 循环，预计算 falloff，复用 canvas） ──

import { _NS, _addFilterUrl, _removeFilterUrl } from './svg-utils.js';
import { _ellipDist, _falloffFunc, _MAP_SIZE } from './displacement-maps.js';

/**
 * 预计算每个点的静态 falloff 场 + 方向场。
 * falloff 不依赖动画状态，每帧只需乘积。
 * 方向场预计算 128×128 的单位向量 (nx,ny)，省去每帧 sqrt。
 */
function _precomputeFalloffs(points) {
    const size = _MAP_SIZE;
    const LUT_SIZE = 1024;
    return points.map(p => {
        const px = p.ox * size, py = p.oy * size;
        const radius = p.radius || 0.08;
        const spread = p.spread != null ? p.spread : 0.1;
        const sd = p.spatialDecay != null ? p.spatialDecay : 0.5;
        const sf = p.spatialFalloff || 'smooth';
        const el = p.ellipticity || 0;
        const ea = p.ellipseAngle || 0;
        const falloff = new Float32Array(size * size);
        const dirField = new Float32Array(size * size * 2); // nx, ny per pixel

        // falloff 查找表（帧内 sf/sd 不变）
        const _lut = new Float32Array(LUT_SIZE);
        for (let i = 0; i < LUT_SIZE; i++) {
            _lut[i] = _falloffFunc(i / (LUT_SIZE - 1), sf, sd);
        }

        if (p.type === 'bone') {
            const ex = (p.endX != null ? p.endX : p.ox) * size;
            const ey = (p.endY != null ? p.endY : p.oy) * size;
            const jr_px = (p.radius || 0.08) * size;
            const er_px = (p.endRadius != null ? p.endRadius : (p.radius || 0.08)) * size;
            const bx = ex - px, by = ey - py;
            const boneLen = Math.sqrt(bx * bx + by * by) || 1;
            const bnx = bx / boneLen, bny = by / boneLen;
            const spreadMul = 1 + spread * 2;
            const gamma = boneLen > 0.001 ? Math.asin(Math.max(-1, Math.min(1, (jr_px - er_px) / boneLen))) : 0;
            const cosG = Math.cos(gamma);

            for (let y = 0; y < size; y++) {
                for (let x = 0; x < size; x++) {
                    const dx = x - px, dy = y - py;
                    const d = Math.sqrt(dx * dx + dy * dy) || 1;
                    const fi = y * size + x;
                    dirField[fi * 2]     = dx / d; // nx
                    dirField[fi * 2 + 1] = dy / d; // ny

                    const t = (dx * bnx + dy * bny) / boneLen;
                    let along;
                    if (t <= 0) {
                        along = 0;
                    } else if (t <= 1) {
                        along = t;
                    } else {
                        const beyond = t - 1;
                        const alongSigma = 0.15 + spread * 0.35;
                        along = Math.exp(-(beyond * beyond) / (2 * alongSigma * alongSigma));
                    }
                    const capR = (jr_px + (er_px - jr_px) * Math.min(1, Math.max(0, t))) * cosG;
                    const capEdge = capR * spreadMul;
                    let dist;
                    if (t < 0) {
                        dist = d;
                    } else if (t > 1) {
                        dist = Math.sqrt((x - ex) * (x - ex) + (y - ey) * (y - ey));
                    } else {
                        dist = Math.abs(-dx * bny + dy * bnx);
                    }
                    const fi2 = Math.min(Math.round(dist / capEdge * (LUT_SIZE - 1)), LUT_SIZE - 1);
                    const crossWeight = dist < capEdge ? _lut[fi2] : 0;
                    falloff[fi] = along * crossWeight;
                }
            }
        } else {
            const rPx = radius * size;
            const maxDist = rPx * (1 + spread * 2);
            const useEllip = el > 0.001;
            for (let y = 0; y < size; y++) {
                for (let x = 0; x < size; x++) {
                    const ddx = x - px, ddy = y - py;
                    const euclid = Math.sqrt(ddx * ddx + ddy * ddy);
                    const fi = y * size + x;
                    dirField[fi * 2]     = ddx / (euclid || 1); // nx
                    dirField[fi * 2 + 1] = ddy / (euclid || 1); // ny
                    const dist = useEllip ? _ellipDist(ddx, ddy, el, ea) : euclid;
                    const fi2 = Math.min(Math.round(dist / maxDist * (LUT_SIZE - 1)), LUT_SIZE - 1);
                    falloff[fi] = _lut[fi2];
                }
            }
        }
        return { falloff, dirField };
    });
}

/**
 * 用预计算 falloff 快速生成合并位移贴图。
 * 复用 canvas / ImageData，避免每帧分配。
 */
const _COMBINED_SIZE = _MAP_SIZE;
let _combinedCanvas = null;
let _combinedCtx = null;
let _combinedImageData = null;
let _combinedData = null;

function _genCombinedMapFast(points, stateArr, falloffs, dynFilterScale) {
    // 延迟初始化 canvas / ImageData（复用）
    if (!_combinedCanvas) {
        _combinedCanvas = document.createElement('canvas');
        _combinedCanvas.width = _COMBINED_SIZE;
        _combinedCanvas.height = _COMBINED_SIZE;
        _combinedCtx = _combinedCanvas.getContext('2d');
        _combinedImageData = _combinedCtx.createImageData(_COMBINED_SIZE, _COMBINED_SIZE);
        _combinedData = _combinedImageData.data;
    }
    const data = _combinedData;
    const size = _COMBINED_SIZE;

    // 清空为中性位移（128=R, 128=G, 255=A）
    for (let i = 0; i < data.length; i += 4) {
        data[i] = 128;
        data[i + 1] = 128;
        data[i + 2] = 128;
        data[i + 3] = 255;
    }

    for (let pi = 0; pi < points.length; pi++) {
        const p = points[pi];
        const st = stateArr[pi];
        if (!st || st.decay < 0.0005) continue;

        const falloff = falloffs[pi].falloff;
        const dirField = falloffs[pi].dirField;
        const scale = p.scale || 4;
        const dirX = p.dx, dirY = p.dy;
        const dm = p.displaceMode || 'parallel';
        const pxP = p.ox * size, pyP = p.oy * size;

        let magnitude = Math.abs(scale * st.wobble);
        const perpX = -dirY, perpY = dirX;
        const mixX = dirX * st.wobble + perpX * st.wobblePerp;
        const mixY = dirY * st.wobble + perpY * st.wobblePerp;
        const mixNorm = Math.sqrt(mixX * mixX + mixY * mixY) || 1;
        const animDirX = mixX / mixNorm;
        const animDirY = mixY / mixNorm;

        const thr = 0.005;
        const precompDir = dm !== 'parallel' && dirField;
        for (let i = 0; i < size * size; i++) {
            const f = falloff[i];
            if (f < thr) continue;
            // 非平行模式：用预计算方向场，避免每像素 sqrt
            let pDirX = animDirX, pDirY = animDirY;
            if (precompDir) {
                const nx = dirField[i * 2];
                const ny = dirField[i * 2 + 1];
                if (dm === 'vortex') { pDirX = ny; pDirY = -nx; }
                else if (dm === 'vortexCCW') { pDirX = -ny; pDirY = nx; }
                else if (dm === 'radial') { pDirX = -nx; pDirY = -ny; }
                else { /* expand */
                    pDirX = nx; pDirY = ny;
                    // 放大：限制位移不越过中心
                    if (dynFilterScale > 0) {
                        const ix = i % size, iy = (i / size) | 0;
                        const dist = Math.sqrt((ix - pxP) * (ix - pxP) + (iy - pyP) * (iy - pyP)) || 1;
                        const imgW = p.imgWidth || 600;
                        const maxOff = dist * 255 * imgW / (_MAP_SIZE * Math.max(dynFilterScale, 1));
                        const clampedMag = Math.min(magnitude, maxOff / (f * 40 + 0.001));
                        const off = clampedMag * f * 40;
                        const rx = -pDirX * off;
                        const ry = -pDirY * off;
                        const idx = i * 4;
                        data[idx]     = data[idx] + rx;
                        data[idx + 1] = data[idx + 1] + ry;
                        continue;
                    }
                }
            }
            const off = magnitude * f * 40;
            const idx = i * 4;
            const rx = -pDirX * off;
            const ry = -pDirY * off;
            data[idx]     = data[idx] + rx;
            data[idx + 1] = data[idx + 1] + ry;
        }
    }

    _combinedCtx.putImageData(_combinedImageData, 0, 0);
    return _combinedCanvas.toDataURL();
}

/**
 * 单 SVG filter + 单 rAF 循环驱动所有点的弹跳动画。
 * 使用预计算 falloff + 复用 canvas，大幅减少每帧计算量。
 */
function _startBounceCombined(el, points) {
    if (!points || points.length === 0) return { cancelAll: () => {} };

    const filterId = 'mc_cmb_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6);
    let svgEl = null, feImg = null, animFrame = null;
    let cancelled = false;

    // 预计算所有点的静态 falloff 场（只做一次）
    const falloffs = _precomputeFalloffs(points);

    // 为每个点计算动画参数（不变部分）
    const animParams = points.map(p => {
        const startFreq = p.freqStart || 1;
        const endFreq = p.freqEnd != null ? p.freqEnd : 0.1;
        const decayRate = p.decay != null ? p.decay : 0.04;
        const chirpDuration = 10;
        const perpRatio = 0.12;
        const phaseOffsetRad = (p.phaseOffset || 0) * Math.PI / 180;
        const dirX = p.dx, dirY = p.dy;
        const perpX = -dirY, perpY = dirX;
        return { startFreq, endFreq, decayRate, chirpDuration, perpRatio, phaseOffsetRad, dirX, dirY, perpX, perpY };
    });

    const animStart = Date.now();

    function _setCombinedMap(stateArr) {
        if (!feImg) return;
        feImg.setAttribute('href', _genCombinedMapFast(points, stateArr, falloffs, dynFilterScale) + '#t=' + Date.now());
    }

    function _cleanup() {
        cancelled = true;
        if (animFrame) { cancelAnimationFrame(animFrame); animFrame = null; }
        if (svgEl && svgEl.parentNode) svgEl.parentNode.removeChild(svgEl);
        _removeFilterUrl(el, filterId);
        el.removeAttribute('data-mc-dragged');
        svgEl = null; feImg = null;
    }

    // 创建 SVG filter
    // 动态滤波器缩放 = 位移系数 × 最大力度（位移图编码方向/形状，滤波器提供无限放大）
    const maxPresetScale = Math.max(...points.map(p => Math.abs(p.scale || 1)));
    const maxFilterMult = Math.max(...points.map(p => Math.abs(p.filterMult || 5)));
    const dynFilterScale = maxPresetScale * maxFilterMult;

    svgEl = document.createElementNS(_NS, 'svg');
    svgEl.setAttribute('style', 'position:absolute;width:0;height:0;overflow:hidden;');
    const defs = document.createElementNS(_NS, 'defs');
    const filter = document.createElementNS(_NS, 'filter');
    filter.setAttribute('id', filterId);
    filter.setAttribute('x', '0%'); filter.setAttribute('y', '0%');
    filter.setAttribute('width', '100%'); filter.setAttribute('height', '100%');
    filter.setAttribute('color-interpolation-filters', 'sRGB');
    feImg = document.createElementNS(_NS, 'feImage');
    feImg.setAttribute('result', 'map');
    feImg.setAttribute('href', _genCombinedMapFast(points, points.map(() => ({ decay: 1, wobble: 0, wobblePerp: 0 })), falloffs, dynFilterScale));
    const feDisp = document.createElementNS(_NS, 'feDisplacementMap');
    feDisp.setAttribute('in', 'SourceGraphic');
    feDisp.setAttribute('in2', 'map');
    feDisp.setAttribute('scale', String(dynFilterScale));
    feDisp.setAttribute('xChannelSelector', 'R');
    feDisp.setAttribute('yChannelSelector', 'G');
    filter.appendChild(feImg); filter.appendChild(feDisp);
    defs.appendChild(filter); svgEl.appendChild(defs);
    document.body.appendChild(svgEl);
    _addFilterUrl(el, filterId);

    function _animLoop() {
        if (cancelled) return;
        try {
            const sec = (Date.now() - animStart) / 1000;
            const stateArr = animParams.map(ap => {
                const decay = Math.exp(-sec * ap.decayRate);
                const T = ap.chirpDuration;
                let phase;
                if (sec < T) {
                    phase = 2 * Math.PI * (ap.startFreq * sec + (ap.endFreq - ap.startFreq) * sec * sec / (2 * T));
                } else {
                    const phaseAtT = 2 * Math.PI * T * (ap.startFreq + ap.endFreq) / 2;
                    phase = phaseAtT + 2 * Math.PI * ap.endFreq * (sec - T);
                }
                const wobble = Math.sin(phase + ap.phaseOffsetRad) * decay;
                const wobblePerp = Math.sin(phase + 0.9 + ap.phaseOffsetRad) * decay * ap.perpRatio;
                return { decay, wobble, wobblePerp };
            });

            const allStopped = stateArr.every(st => st.decay < 0.0005);
            if (allStopped) {
                cancelled = true;
                if (animFrame) { cancelAnimationFrame(animFrame); animFrame = null; }
                return; // 停止动画循环但保留滤波器，不自动关闭
            }

            _setCombinedMap(stateArr);
            animFrame = requestAnimationFrame(_animLoop);
        } catch (err) {
            console.error('CombinedBounce error', err);
            _cleanup();
        }
    }
    _animLoop();
    return { cancelAll: _cleanup };
}

// ── 自动演示弹跳（入口，自动使用合批引擎） ──

/**
 * 在元素上自动触发多点果冻弹跳演示。
 * 使用合批引擎：单 SVG 滤波器 + 单 rAF 循环，大幅提升多点性能。
 *
 * @param {HTMLElement} el
 * @param {Array}       points
 * @returns {{ cancelAll: function }}
 */
export function autoBounce(el, points) {
    return _startBounceCombined(el, points);
}
