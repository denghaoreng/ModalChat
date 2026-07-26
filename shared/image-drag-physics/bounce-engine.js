// ── 单点弹跳动画引擎 ──

import { _NS, _addFilterUrl, _removeFilterUrl } from './svg-utils.js';
import { _genMap, _genMapBone } from './displacement-maps.js';

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
    // 频率线性扫频：从 freqStart Hz 渐变到 freqEnd Hz（约 10 秒完成扫频）
    const startFreq = opts.freqStart || 1;
    const endFreq = opts.freqEnd != null ? opts.freqEnd : 0.1;
    const chirpDuration = 10;
    // 相位偏移（度→弧度）
    const phaseOffsetRad = (opts.phaseOffset || 0) * Math.PI / 180;
    // 衰减率
    const decayRate = opts.decay != null ? opts.decay : 0.04;
    // 正交摆动比：产生椭圆/果冻感的侧向抖动幅度（主方向的比例）
    const perpRatio = opts.perpRatio != null ? opts.perpRatio : 0.12;

    const perpX = -dirY, perpY = dirX;
    const filterId = 'mc_bnc_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6);
    let animFrame = null, feDisp = null, svgEl = null, feImg = null;

    function _setMap(ux, uy, s) {
        if (!feImg) return;
        const sf = opts.spatialFalloff || 'smooth';
        const dm = opts.displaceMode || 'parallel';
        const el = opts.ellipticity || 0;
        const ea = opts.ellipseAngle || 0;
        const href = (type === 'bone')
            ? _genMapBone(originX, originY, endX, endY, ux, uy, s, jRadius, eRadius, opts.spread, opts.spatialDecay, sf, dm, el, ea)
            : _genMap(originX, originY, ux, uy, s, jRadius, opts.spread, opts.spatialDecay, sf, dm, el, ea);
        feImg.setAttribute('href', href + '#t=' + Date.now());
        if (feDisp) feDisp.setAttribute('scale', String(Math.abs(s) * _filterMult));
    }

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
    feImg.setAttribute('href', _genMap(originX, originY, dirX, dirY, startScale, jRadius, opts.spread, opts.spatialDecay, opts.spatialFalloff, opts.displaceMode, opts.ellipticity, opts.ellipseAngle));
    feDisp = document.createElementNS(_NS, 'feDisplacementMap');
    feDisp.setAttribute('in', 'SourceGraphic');
    feDisp.setAttribute('in2', 'map');
    feDisp.setAttribute('scale', '1');
    feDisp.setAttribute('xChannelSelector', 'R');
    feDisp.setAttribute('yChannelSelector', 'G');
    filter.appendChild(feImg); filter.appendChild(feDisp);
    defs.appendChild(filter); svgEl.appendChild(defs);
    document.body.appendChild(svgEl);
    _addFilterUrl(el, filterId);

    // 用绝对秒数驱动，与帧率完全无关
    const animStart = Date.now();
    function _animLoop() {
        try {
            const sec = (Date.now() - animStart) / 1000;
            // 指数衰减：decayRate 越大停得越快
            const decay = Math.exp(-sec * decayRate);
            // 频率线性扫频（相位累积 = 频率积分）
            const T = chirpDuration;
            let phase;
            if (sec < T) {
                // 扫频阶段：freq(t) = f0 + (f1-f0)·t/T
                // phase(t) = 2π·∫freq(t)dt = 2π·(f0·t + (f1-f0)·t²/(2·T))
                phase = 2 * Math.PI * (startFreq * sec + (endFreq - startFreq) * sec * sec / (2 * T));
            } else {
                // 扫频结束，恒频 endFreq：加上之前累积相位
                const phaseAtT = 2 * Math.PI * T * (startFreq + endFreq) / 2;
                phase = phaseAtT + 2 * Math.PI * endFreq * (sec - T);
            }
            const wobble = Math.sin(phase + phaseOffsetRad) * decay;
            const wobblePerp = Math.sin(phase + 0.9 + phaseOffsetRad) * decay * perpRatio;
            const magnitude = Math.abs(startScale * wobble);
            // 用包络（decay）判断停止，不受过零点影响
            if (decay < 0.0005) { _cleanup(); return; }
            const mixX = dirX * wobble + perpX * wobblePerp;
            const mixY = dirY * wobble + perpY * wobblePerp;
            const mixNorm = Math.sqrt(mixX * mixX + mixY * mixY) || 1;
            const animDirX = mixX / mixNorm;
            const animDirY = mixY / mixNorm;
            _setMap(animDirX, animDirY, magnitude);
            animFrame = requestAnimationFrame(_animLoop);
        } catch (err) {
            console.error('DragDeformation anim error', err);
            _cleanup();
        }
    }
    _animLoop();
    return { cancel: _cleanup };
}
