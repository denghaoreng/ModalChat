// ── 合批弹跳引擎（委托至单点引擎，每点独立 filter + scale-only 动画） ──
//
// 优化策略：每个预设点生成一次静态位移贴图，之后每帧只更新 feDisplacementMap.scale，
// 完全避免 per-frame toDataURL()。各点滤波器独立，通过 CSS filter 链叠加。

import { _startBounce } from './bounce-engine.js';

/**
 * 在元素上自动触发多点果冻弹跳演示。
 * 每点独立 filter + scale-only 动画，通过 CSS filter 链叠加。
 *
 * @param {HTMLElement} el
 * @param {Array}       points  预设点数组
 * @returns {{ cancelAll: function }}
 */
export function autoBounce(el, points) {
    if (!points || points.length === 0) return { cancelAll: () => {} };

    const handles = points.map(p => {
        const opts = {
            type: p.type || 'point',
            endX: p.endX,
            endY: p.endY,
            jRadius: p.jRadius != null ? p.jRadius : p.radius,
            eRadius: p.eRadius != null ? p.eRadius : p.endRadius,
            freqStart: p.freqStart,
            freqEnd: p.freqEnd,
            chirpDuration: p.chirpDuration,
            phaseOffset: p.phaseOffset,
            decay: p.decay,
            perpRatio: p.perpRatio,
            filterMult: p.filterMult,
            spread: p.spread,
            spatialDecay: p.spatialDecay,
            spatialFalloff: p.spatialFalloff,
            displaceMode: p.displaceMode,
            ellipticity: p.ellipticity,
            ellipseAngle: p.ellipseAngle,
        };
        return _startBounce(el, p.ox, p.oy, p.dx, p.dy, p.scale || 1, opts);
    });

    return {
        cancelAll: () => {
            handles.forEach(h => h.cancel());
        }
    };
}
