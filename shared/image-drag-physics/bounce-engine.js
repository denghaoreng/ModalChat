// ── 单点弹跳动画引擎 ──

import { _NS, _addFilterUrl, _removeFilterUrl } from './svg-utils.js';
import { _genMap, _genMapBone, _MAP_SIZE, _ellipDist, _falloffFunc } from './displacement-maps.js';

// ── 复用的 Canvas 和 ImageData（与 displacement-maps.js 共享） ──
let _fastCanvas = null;
let _fastCtx = null;
let _fastImageData = null;
let _fastData = null;
let _fastLastPrecomp = null; // 追踪上次预计算场，避免重复全清

function _ensureFastCanvas() {
    const size = _MAP_SIZE;
    if (!_fastCanvas) {
        _fastCanvas = document.createElement('canvas');
        _fastCanvas.width = size;
        _fastCanvas.height = size;
        _fastCtx = _fastCanvas.getContext('2d');
        _fastImageData = _fastCtx.createImageData(size, size);
        _fastData = _fastImageData.data;
        _fastLastPrecomp = null; // 新 canvas 需要首次全清
    }
}

/**
 * 预计算静态 falloff 场和方向场。
 * 在弹跳开始时执行一次，之后每帧只需乘以当前 scale 和方向。
 * @returns {{ falloff: Float32Array, dirX: Float32Array, dirY: Float32Array, isParallel: boolean }}
 */
export function _precomputeField(originX, originY, dirX, dirY, opts) {
    const size = _MAP_SIZE;
    const radius = opts.jRadius != null ? opts.jRadius : 0.08;
    const spread = opts.spread != null ? opts.spread : 0.1;
    const spatialDecay = opts.spatialDecay != null ? opts.spatialDecay : 0.5;
    const spatialFalloff = opts.spatialFalloff || 'smooth';
    const displaceMode = opts.displaceMode || 'parallel';
    const ellipticity = opts.ellipticity || 0;
    const ellipseAngle = opts.ellipseAngle || 0;
    const type = opts.type || 'point';
    const endX = opts.endX != null ? opts.endX : originX;
    const endY = opts.endY != null ? opts.endY : originY;
    const jRadius2 = opts.jRadius != null ? opts.jRadius : 0.08;
    const eRadius2 = opts.eRadius != null ? opts.eRadius : jRadius2;

    // ── bone 类型：胶囊场预计算 ──
    if (type === 'bone') {
        const px = originX * size, py = originY * size;
        const exPx = endX * size, eyPx = endY * size;
        const bx = exPx - px, by = eyPx - py;
        const boneLen = Math.sqrt(bx * bx + by * by) || 1;
        const bnx = bx / boneLen, bny = by / boneLen;
        const jr_px = jRadius2 * size, er_px = eRadius2 * size;
        const gamma = boneLen > 0.001 ? Math.asin(Math.max(-1, Math.min(1, (jr_px - er_px) / boneLen))) : 0;
        const cosG = Math.cos(gamma);
        const spreadMul = 1 + spread * 2;
        const alongSigma = 0.15 + spread * 0.35;

        // 计算骨胳胶囊 bounding box
        const boundMargin = Math.max(jr_px, er_px) * spreadMul + 1;
        const yStartB = Math.max(0, Math.floor(Math.min(py, eyPx) - boundMargin));
        const yEndB   = Math.min(size, Math.ceil(Math.max(py, eyPx) + boundMargin));
        const xStartB = Math.max(0, Math.floor(Math.min(px, exPx) - boundMargin));
        const xEndB   = Math.min(size, Math.ceil(Math.max(px, exPx) + boundMargin));

        const falloff = new Float32Array(size * size);
        const dirFieldX = new Float32Array(size * size);
        const dirFieldY = new Float32Array(size * size);
        const isParallel = displaceMode === 'parallel';

        // direction mode handler（bone 类型的胶囊几何自带纵向渐变，无需 multT）
        let getDir = null;
        if (displaceMode === 'vortex') {
            getDir = (ddx, ddy, euclid) => {
                const safeD = Math.max(euclid, 0.001);
                return { dx: ddy / safeD, dy: -ddx / safeD };
            };
        } else if (displaceMode === 'vortexCCW') {
            getDir = (ddx, ddy, euclid) => {
                const safeD = Math.max(euclid, 0.001);
                return { dx: -ddy / safeD, dy: ddx / safeD };
            };
        } else if (displaceMode === 'radial' || displaceMode === 'expand') {
            const sign = displaceMode === 'radial' ? -1 : 1;
            getDir = (ddx, ddy, euclid) => {
                const safeD = Math.max(euclid, 0.001);
                return { dx: sign * ddx / safeD, dy: sign * ddy / safeD };
            };
        }

        // falloff LUT
        const LUT_SIZE = 1024;
        const lut = new Float32Array(LUT_SIZE);
        for (let i = 0; i < LUT_SIZE; i++) {
            lut[i] = _falloffFunc(i / (LUT_SIZE - 1), spatialFalloff, spatialDecay);
        }

        for (let y = yStartB; y < yEndB; y++) {
            for (let x = xStartB; x < xEndB; x++) {
                const dx = x - px, dy = y - py;
                const euclid = Math.sqrt(dx * dx + dy * dy) || 1;
                const t = (dx * bnx + dy * bny) / boneLen;
                let along;
                if (t <= 0) {
                    along = 0;
                } else if (t <= 1) {
                    along = t;
                } else {
                    const beyond = t - 1;
                    along = Math.exp(-(beyond * beyond) / (2 * alongSigma * alongSigma));
                }
                const capR = (jr_px + (er_px - jr_px) * Math.min(1, Math.max(0, t))) * cosG;
                let dist;
                if (t < 0) {
                    dist = euclid;
                } else if (t > 1) {
                    dist = Math.sqrt((x - exPx) * (x - exPx) + (y - eyPx) * (y - eyPx));
                } else {
                    dist = Math.abs(-dx * bny + dy * bnx);
                }
                const capEdge = capR * spreadMul;
                const crossWeight = dist < capEdge ? lut[Math.min(Math.round(dist / capEdge * (LUT_SIZE - 1)), LUT_SIZE - 1)] : 0;
                const f = along * crossWeight;

                const idx = y * size + x;
                falloff[idx] = f;
                if (isParallel) {
                    dirFieldX[idx] = dirX;
                    dirFieldY[idx] = dirY;
                } else if (getDir) {
                    const d = getDir(dx, dy, euclid);
                    dirFieldX[idx] = d.dx;
                    dirFieldY[idx] = d.dy;
                } else {
                    dirFieldX[idx] = dx / euclid;
                    dirFieldY[idx] = dy / euclid;
                }
            }
        }
        return { falloff, dirFieldX, dirFieldY, isParallel, yStart: yStartB, yEnd: yEndB, xStart: xStartB, xEnd: xEndB, size };
    }

    const px = originX * size, py = originY * size;
    const hasRadius = radius > 0;
    const rPx = radius * size;
    const maxDist = rPx * (1 + spread * 2);
    const sigma = size * 0.08;

    // 计算 bounding box
    let yStart = 0, yEnd = size, xStart = 0, xEnd = size;
    if (hasRadius) {
        const bound = Math.ceil(maxDist);
        yStart = Math.max(0, Math.floor(py - bound));
        yEnd   = Math.min(size, Math.ceil(py + bound));
        xStart = Math.max(0, Math.floor(px - bound));
        xEnd   = Math.min(size, Math.ceil(px + bound));
    }

    const falloff = new Float32Array(size * size);
    const dirFieldX = new Float32Array(size * size);
    const dirFieldY = new Float32Array(size * size);
    const isParallel = displaceMode === 'parallel';
    const useEllip = ellipticity > 0.001;

    // falloff LUT
    const LUT_SIZE = 1024;
    const lut = hasRadius ? new Float32Array(LUT_SIZE) : null;
    if (lut) {
        for (let i = 0; i < LUT_SIZE; i++) {
            lut[i] = _falloffFunc(i / (LUT_SIZE - 1), spatialFalloff, spatialDecay);
        }
    }

    // 方向模式处理器（选择 direction 计算方式）
    let getDir = null;
    let multT = false;
    if (displaceMode === 'vortex') {
        getDir = (ddx, ddy, euclid) => {
            const safeD = Math.max(euclid, 0.001);
            return { dx: ddy / safeD, dy: -ddx / safeD };
        };
    } else if (displaceMode === 'vortexCCW') {
        getDir = (ddx, ddy, euclid) => {
            const safeD = Math.max(euclid, 0.001);
            return { dx: -ddy / safeD, dy: ddx / safeD };
        };
    } else if (displaceMode === 'radial' || displaceMode === 'expand') {
        const sign = displaceMode === 'radial' ? -1 : 1;
        multT = true;
        getDir = (ddx, ddy, euclid) => {
            const safeD = Math.max(euclid, 0.001);
            return { dx: sign * ddx / safeD, dy: sign * ddy / safeD };
        };
    }

    const invLut = 1 / (LUT_SIZE - 1);
    for (let y = yStart; y < yEnd; y++) {
        for (let x = xStart; x < xEnd; x++) {
            const ddx = x - px, ddy = y - py;
            const euclid = Math.sqrt(ddx * ddx + ddy * ddy);
            const dist = useEllip ? _ellipDist(ddx, ddy, ellipticity, ellipseAngle) : euclid;
            let f;
            let fieldDx = isParallel ? dirX : 0;
            let fieldDy = isParallel ? dirY : 0;

            if (hasRadius) {
                const t = dist / maxDist;
                if (t >= 1) continue;
                const lutIdx = (t * LUT_SIZE) | 0;
                f = lut[Math.min(lutIdx, LUT_SIZE - 1)];
                if (!isParallel && getDir) {
                    const d = getDir(ddx, ddy, euclid);
                    fieldDx = d.dx;
                    fieldDy = d.dy;
                }
                if (multT) f *= t;
            } else {
                f = Math.exp(-(dist * dist) / (2 * sigma * sigma));
            }

            const idx = y * size + x;
            falloff[idx] = f;
            dirFieldX[idx] = fieldDx;
            dirFieldY[idx] = fieldDy;
        }
    }

    return { falloff, dirFieldX, dirFieldY, isParallel, yStart, yEnd, xStart, xEnd, size };
}

/**
 * 基于预计算场快速生成位移贴图（仅乘加运算，无 sqrt/branch）。
 */
export function _genMapFast(precomp, ux, uy, scale) {
    _ensureFastCanvas();
    const size = precomp.size;
    const data = _fastData;
    const { falloff, dirFieldX, dirFieldY, isParallel, yStart, yEnd, xStart, xEnd } = precomp;

    // 首次调用此 precomp 需全清；后续帧复用（相同 precomp 则 bounding box 不变），跳过全清
    const zero = 128;
    if (_fastLastPrecomp !== precomp) {
        for (let i = 0; i < size * size * 4; i += 4) {
            data[i] = zero; data[i+1] = zero; data[i+2] = zero; data[i+3] = 255;
        }
        _fastLastPrecomp = precomp;
    }

    const scale40 = scale * 40;
    for (let y = yStart; y < yEnd; y++) {
        const rowBase = y * size;
        for (let x = xStart; x < xEnd; x++) {
            const idx = rowBase + x;
            const f = falloff[idx];
            if (f === 0) continue;
            const off = f * scale40;
            let dx = ux, dy = uy;
            if (!isParallel) {
                dx = dirFieldX[idx];
                dy = dirFieldY[idx];
            }
            const pi = idx * 4;
            data[pi]     = zero - dx * off;
            data[pi + 1] = zero - dy * off;
        }
    }

    _fastCtx.putImageData(_fastImageData, 0, 0);
    return _fastCanvas.toDataURL();
}

/**
 * 在一个元素上创建一个独立的果冻弹跳动画点。
 * 自动创建 SVG feDisplacementMap 滤波器并开始振荡衰减。
 * 动画结束后自动清理自身滤波器，不影响其他并发点。
 *
 * @param {HTMLElement} el       - 图片/视频元素
 * @param {number} originX       - 点击点归一化 X (0..1)
 * @param {number} originY       - 点击点归一化 Y (0..1)
 * @param {number} dirX          - 拖拽方向 X (-1..1)
 * @param {number} dirY          - 拖拽方向 Y (-1..1)
 * @param {number} startScale    - 初始位移幅度 (0~4)
 *
 * @returns {{ cancel: function }} 返回取消函数
 */
export function _startBounce(el, originX, originY, dirX, dirY, startScale, opts) {
    opts = opts || {};
    const _filterMult = (opts && opts.filterMult) || 5;
    const type = opts.type || 'point';
    // 骨骼参数
    const endX = opts.endX != null ? opts.endX : originX;
    const endY = opts.endY != null ? opts.endY : originY;
    const jRadius = opts.jRadius != null ? opts.jRadius : 0.08;
    const eRadius = opts.eRadius != null ? opts.eRadius : jRadius;
    // 频率线性扫频：从 freqStart Hz 渐变到 freqEnd Hz
    const startFreq = opts.freqStart || 1;
    const endFreq = opts.freqEnd != null ? opts.freqEnd : 0.1;
    const chirpDuration = opts.chirpDuration != null ? opts.chirpDuration : 30;
    // 相位偏移（度→弧度）
    const phaseOffsetRad = (opts.phaseOffset || 0) * Math.PI / 180;
    // 衰减率
    const decayRate = opts.decay != null ? opts.decay : 0.01;
    // 正交摆动比：产生椭圆/果冻感的侧向抖动幅度（主方向的比例）
    const perpRatio = opts.perpRatio != null ? opts.perpRatio : 0.12;

    const filterId = 'mc_bnc_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6);
    let animFrame = null, feDisp = null, svgEl = null, feImg = null;
    let _mapHref = ''; // 缓存初始贴图 href，动画中不重新生成

    // ── 预计算静态场，每帧避免 sqrt/branch ──
    const precomp = _precomputeField(originX, originY, dirX, dirY, opts);

    // ── 生成初始位移贴图（仅一次），动画只调 feDisp.scale ──
    function _initMap() {
        if (precomp) {
            _mapHref = _genMapFast(precomp, dirX, dirY, startScale);
        } else {
            const sf = opts.spatialFalloff || 'smooth';
            const dm = opts.displaceMode || 'parallel';
            const el = opts.ellipticity || 0;
            const ea = opts.ellipseAngle || 0;
            _mapHref = (type === 'bone')
                ? _genMapBone(originX, originY, endX, endY, dirX, dirY, startScale, jRadius, eRadius, opts.spread, opts.spatialDecay, sf, dm, el, ea)
                : _genMap(originX, originY, dirX, dirY, startScale, jRadius, opts.spread, opts.spatialDecay, sf, dm, el, ea);
        }
    }
    _initMap();

    function _cleanup() {
        if (animFrame) { cancelAnimationFrame(animFrame); animFrame = null; }
        if (svgEl && svgEl.parentNode) svgEl.parentNode.removeChild(svgEl);
        _removeFilterUrl(el, filterId);
        el.removeAttribute('data-mc-dragged');
        svgEl = null; feDisp = null; feImg = null;
    }

    // 创建 SVG filter
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
    feImg.setAttribute('href', _mapHref);
    feDisp = document.createElementNS(_NS, 'feDisplacementMap');
    feDisp.setAttribute('in', 'SourceGraphic');
    feDisp.setAttribute('in2', 'map');
    feDisp.setAttribute('scale', String(startScale * _filterMult));
    feDisp.setAttribute('xChannelSelector', 'R');
    feDisp.setAttribute('yChannelSelector', 'G');
    filter.appendChild(feImg); filter.appendChild(feDisp);
    defs.appendChild(filter); svgEl.appendChild(defs);
    document.body.appendChild(svgEl);
    _addFilterUrl(el, filterId);

    // 用绝对秒数驱动，与帧率完全无关
    // 优化：只更新 feDisp.scale，不重新生成位移贴图
    // scale 可为负值 → 位移反向，等价于方向翻转；正交互摆 perpRatio 合并进 scale 调制
    const animStart = Date.now();
    function _animLoop() {
        try {
            const sec = (Date.now() - animStart) / 1000;
            const decay = Math.exp(-sec * decayRate);
            // 频率线性扫频（相位累积 = 频率积分）
            const T = chirpDuration;
            let phase;
            if (sec < T) {
                phase = 2 * Math.PI * (startFreq * sec + (endFreq - startFreq) * sec * sec / (2 * T));
            } else {
                const phaseAtT = 2 * Math.PI * T * (startFreq + endFreq) / 2;
                phase = phaseAtT + 2 * Math.PI * endFreq * (sec - T);
            }
            const wobble = Math.sin(phase + phaseOffsetRad) * decay;
            // 正交摆动合并进 scale（不改变贴图方向）
            const wobblePerp = Math.sin(phase + 0.9 + phaseOffsetRad) * decay * perpRatio;
            const combinedWobble = wobble * (1 + Math.abs(wobblePerp) * 0.5);
            // 用包络（decay）判断停止
            if (decay < 0.0005) { _cleanup(); return; }
            // ★ 仅更新 feDisplacementMap.scale，不重新生成贴图
            if (feDisp) {
                feDisp.setAttribute('scale', String(combinedWobble * startScale * _filterMult));
            }
            animFrame = requestAnimationFrame(_animLoop);
        } catch (err) {
            console.error('DragDeformation anim error', err);
            _cleanup();
        }
    }
    _animLoop();
    return { cancel: _cleanup };
}
