// ── 交互拖拽绑定 ──

import { _NS, _addFilterUrl, _removeFilterUrl, _getPos } from './svg-utils.js';
import { _startBounce, _precomputeField, _genMapFast } from './bounce-engine.js';

/**
 * 为容器内的图片/视频元素绑定拖拽变形交互。
 * 通过 jQuery 事件代理监听 mousedown/touchstart。
 *
 * @param {jQuery} $container - 容器元素
 * @param {string} selector   - 子元素选择器（如 '.item img, .item video'）
 */
export function setupDragDeformation($container, selector) {
    $container.off('mousedown touchstart', selector)
        .on('mousedown touchstart', selector, function (e) {
            const el = this;

            // ── 防 mousedown + touchstart 双发 ──
            if (el._mcDragLastTouch && Date.now() - el._mcDragLastTouch < 50) return;
            el._mcDragLastTouch = Date.now();

            e.preventDefault();
            const src = el.getAttribute('src');
            if (!src) return;

            // ── 测量与定位 ──
            const rect = el.getBoundingClientRect();
            const W = rect.width, H = rect.height;
            const startPos = e.touches ? e.touches[0] : e;
            const startX = startPos.clientX, startY = startPos.clientY;
            const originX = (startX - rect.left) / W;
            const originY = (startY - rect.top) / H;

            // ── 拖拽专用单滤波器状态 ──
            let isDragging = false, maxDist = 0;
            let lastDirX = 0, lastDirY = -1;
            let _dragSvgEl = null, _dragFeDisp = null, _dragFeImg = null;
            let _dragPrecomp = null; // 预计算静态场
            let _dragState = null; // rAF 节流：暂存待更新的方向/力度
            let _rafPending = false;
            const _dragFid = 'mc_drag_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6);

            function _dragSetMap(ux, uy, s) {
                if (!_dragFeImg) return;
                _dragFeImg.setAttribute('href', _genMapFast(_dragPrecomp, ux, uy, s));
                if (_dragFeDisp) _dragFeDisp.setAttribute('scale', String(Math.abs(s) * 10 + 2));
            }

            function _scheduleDragUpdate(ux, uy, s) {
                _dragState = { ux, uy, s };
                if (_rafPending) return;
                _rafPending = true;
                requestAnimationFrame(() => {
                    _rafPending = false;
                    if (_dragState) {
                        _dragSetMap(_dragState.ux, _dragState.uy, _dragState.s);
                        _dragState = null;
                    }
                });
            }

            function _dragEnsureSvg() {
                if (_dragSvgEl) return;
                _dragSvgEl = document.createElementNS(_NS, 'svg');
                _dragSvgEl.setAttribute('style', 'position:absolute;width:0;height:0;overflow:hidden;');
                const defs = document.createElementNS(_NS, 'defs');
                const filter = document.createElementNS(_NS, 'filter');
                filter.setAttribute('id', _dragFid);
                filter.setAttribute('x', '0%'); filter.setAttribute('y', '0%');
                filter.setAttribute('width', '100%'); filter.setAttribute('height', '100%');
                filter.setAttribute('color-interpolation-filters', 'sRGB');
                // 预计算静态场（非 bone 类型）
                _dragPrecomp = _precomputeField(originX, originY, 0, -1, {
                    jRadius: 0.08, spread: 0.1, spatialDecay: 0.5,
                    spatialFalloff: 'smooth', displaceMode: 'parallel',
                    ellipticity: 0, ellipseAngle: 0,
                });
                _dragFeImg = document.createElementNS(_NS, 'feImage');
                _dragFeImg.setAttribute('result', 'map');
                _dragFeImg.setAttribute('href', _genMapFast(_dragPrecomp, 0, -1, 0.01));
                _dragFeDisp = document.createElementNS(_NS, 'feDisplacementMap');
                _dragFeDisp.setAttribute('in', 'SourceGraphic');
                _dragFeDisp.setAttribute('in2', 'map');
                _dragFeDisp.setAttribute('scale', '1');
                _dragFeDisp.setAttribute('xChannelSelector', 'R');
                _dragFeDisp.setAttribute('yChannelSelector', 'G');
                filter.appendChild(_dragFeImg); filter.appendChild(_dragFeDisp);
                defs.appendChild(filter); _dragSvgEl.appendChild(defs);
                document.body.appendChild(_dragSvgEl);
                _addFilterUrl(el, _dragFid);
            }

            function _dragCleanup() {
                if (_dragSvgEl && _dragSvgEl.parentNode) _dragSvgEl.parentNode.removeChild(_dragSvgEl);
                _removeFilterUrl(el, _dragFid);
                _dragSvgEl = null; _dragFeDisp = null; _dragFeImg = null;
            }

            // ── 鼠标/触摸移动 ──
            function _onMove(ev) {
                const pos = _getPos(ev);
                const dx = (pos.x - startX) / W;
                const dy = (pos.y - startY) / H;
                const dist = Math.sqrt(dx * dx + dy * dy);
                if (!isDragging) {
                    if (dist < 0.015) return; // 死区
                    isDragging = true;
                    el.setAttribute('data-mc-dragged', '1');
                    _dragEnsureSvg();
                    const norm = dist || 0.001;
                    lastDirX = dx / norm; lastDirY = dy / norm;
                    // 首次激活直接更新（即时反馈）
                    _dragSetMap(lastDirX, lastDirY, Math.min(dist * 3, 4));
                    return;
                }
                ev.preventDefault();
                if (dist > maxDist) maxDist = dist;
                const norm = dist || 0.001;
                lastDirX = dx / norm; lastDirY = dy / norm;
                // 后续更新通过 rAF 节流，避免 mousemove 高频触发 toDataURL
                _scheduleDragUpdate(lastDirX, lastDirY, Math.min(dist * 3, 4));
            }

            // ── 松开 → 启用独立弹跳动画 ──
            let _animStarted = false;
            function _onUp(ev) {
                if (ev && ev.preventDefault) ev.preventDefault();
                $(document).off('mousemove touchmove', _onMove);
                $(document).off('mouseup touchend', _onUp);
                if (!isDragging) { _dragCleanup(); return; }
                if (_animStarted) return;
                _animStarted = true;
                const ddx = lastDirX, ddy = lastDirY;
                _dragCleanup();
                const finalScale = Math.min(maxDist * 2.5, 4) || 0.5;
                _startBounce(el, originX, originY, ddx, ddy, finalScale);
            }

            // ── 绑定移动/松开事件 ──
            $(document).on('mousemove touchmove', _onMove);
            $(document).on('mouseup touchend', _onUp);
        });
}
