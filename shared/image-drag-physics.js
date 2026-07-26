/**
 * image-drag-physics.js — 图片/视频拖拽变形物理引擎
 *
 * 基于 SVG feDisplacementMap 实现果冻弹跳效果。
 * 支持多点并发（每点独立 SVG 滤波器，通过 CSS filter 链叠加）。
 *
 * 用法:
 *   import { setupDragDeformation } from '../shared/image-drag-physics.js';
 *   setupDragDeformation($container, '.my-selector img, .my-selector video');
 *
 * 拖拽时在元素上设置 data-mc-dragged="1"，动画结束后移除。
 * 调用方可在 click 处理中检查 data-mc-dragged 防止拖拽后误触。
 */

// ── SVG 命名空间 ──
const _NS = 'http://www.w3.org/2000/svg';

/**
 * 向元素的 CSS filter 链追加一个 url(#filterId)
 * @param {HTMLElement} el
 * @param {string} fid - filter ID
 */
function _addFilterUrl(el, fid) {
    const cur = el.style.filter;
    const add = 'url(#' + fid + ')';
    el.style.filter = cur ? cur + ' ' + add : add;
}

/**
 * 从元素的 CSS filter 链移除一个 url(#filterId)
 * @param {HTMLElement} el
 * @param {string} fid - filter ID
 */
function _removeFilterUrl(el, fid) {
    const cur = el.style.filter;
    if (!cur) return;
    const parts = cur.split(/\s+/).filter(p => p !== 'url(#' + fid + ')');
    el.style.filter = parts.join(' ') || '';
}

/**
 * 获取鼠标/触摸事件的 clientX/clientY
 * @param {Event} ev
 * @returns {{x:number, y:number}}
 */
function _getPos(ev) {
    if (ev.touches) return { x: ev.touches[0].clientX, y: ev.touches[0].clientY };
    if (ev.changedTouches) return { x: ev.changedTouches[0].clientX, y: ev.changedTouches[0].clientY };
    return { x: ev.clientX, y: ev.clientY };
}

// ── 位移贴图生成 ──

/**
 * 生成 128×128 的位移贴图（PNG data URL）
 * 用于 feDisplacementMap 的 feImage 输入。
 * 每个像素的 R 通道 = X 位移，G 通道 = Y 位移，128 = 零位移。
 *
 * @param {number} ox  - 点击点在贴图中的归一化 X (0..1)
 * @param {number} oy  - 点击点在贴图中的归一化 Y (0..1)
 * @param {number} ux  - 位移方向 X 分量
 * @param {number} uy  - 位移方向 Y 分量
 * @param {number} scale - 位移幅度
 * @param {number} [radius] - 影响半径归一化 (0..1)，传此值则用 bounded falloff
 * @param {number} [spread] - 扩散范围 (0~1)，控制 falloff 超出半径的程度
 * @returns {string} data:image/png;base64,...
 */
/**
 * 计算椭圆距离，支持椭圆度和旋转角。
 * @param {number} dx - X 偏移
 * @param {number} dy - Y 偏移
 * @param {number} e - 椭圆度 (0~1)，0=正圆
 * @param {number} angleDeg - 椭圆旋转角度 (度)
 * @returns {number} 椭圆距离
 */
function _ellipDist(dx, dy, e, angleDeg) {
    if (!e || e <= 0.001) return Math.sqrt(dx * dx + dy * dy);
    const a = angleDeg * Math.PI / 180;
    const ca = Math.cos(a), sa = Math.sin(a);
    const rx = dx * ca + dy * sa;
    const ry = -dx * sa + dy * ca;
    // Y 轴压缩比例：e=0 → 1 (正圆)，e=1 → 0.5 (椭圆)
    const scaleY = 1 - e * 0.5;
    return Math.sqrt(rx * rx + (ry / scaleY) * (ry / scaleY));
}

/**
 * 根据力范函数类型和力范衰减计算 falloff 值。
 * @param {number} t - 归一化距离 (0~1)
 * @param {string} type - falloff 类型: 'smooth'|'gaussian'|'linear'|'cosine'
 * @param {number} sd - 力范衰减值 (0~5)
 * @returns {number} 0~1 的权重
 */
function _falloffFunc(t, type, sd) {
    if (t >= 1) return 0;
    if (sd <= 0.001) return 1;
    switch (type) {
        case 'gaussian': return Math.exp(-t * t * 4.5 / (sd + 0.5));
        case 'linear':   return 1 - t;
        case 'cosine':   return Math.cos(t * Math.PI / 2);
        default: /* smooth */ return Math.pow(1 - t * t, sd * 2);
    }
}

// 复用 canvas 和 ImageData，避免每帧 GC
let _mapCanvas = null;
let _mapCtx = null;
let _mapImageData = null;
let _mapData = null;

function _genMap(ox, oy, ux, uy, scale, radius, spread, spatialDecay, spatialFalloff, displaceMode, ellipticity, ellipseAngle) {
    const size = 128;
    if (!_mapCanvas) {
        _mapCanvas = document.createElement('canvas');
        _mapCanvas.width = size;
        _mapCanvas.height = size;
        _mapCtx = _mapCanvas.getContext('2d');
        _mapImageData = _mapCtx.createImageData(size, size);
        _mapData = _mapImageData.data;
    }
    const data = _mapData;
    const px = ox * size, py = oy * size;
    const hasRadius = radius != null && radius > 0;
    const rPx = hasRadius ? radius * size : 0;
    const maxDist = hasRadius ? rPx * (1 + (spread || 0) * 2) : 0;
    const sd = spatialDecay != null ? spatialDecay : 0.5;
    const sf = spatialFalloff || 'smooth';
    const el = ellipticity || 0;
    const ea = ellipseAngle || 0;
    const sigma = size * 0.08;
    for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
            const ddx = x - px, ddy = y - py;
            const euclid = Math.sqrt(ddx * ddx + ddy * ddy);
            const dist = _ellipDist(ddx, ddy, el, ea);
            let f;
            let dirX = ux, dirY = uy;
            if (hasRadius) {
                f = _falloffFunc(dist / maxDist, sf, sd);
                if (displaceMode === 'vortex') {
                    const safeD = Math.max(euclid, 0.001);
                    dirX = ddy / safeD;
                    dirY = -ddx / safeD;
                } else if (displaceMode === 'vortexCCW') {
                    const safeD = Math.max(euclid, 0.001);
                    dirX = -ddy / safeD;
                    dirY = ddx / safeD;
                } else if (displaceMode === 'radial') {
                    // 收缩：像素向中心消失，方向指向中心
                    const safeD = Math.max(euclid, 0.001);
                    dirX = -ddx / safeD;   // 指向中心
                    dirY = -ddy / safeD;
                    const t = dist / maxDist;
                    f = t * f;
                } else if (displaceMode === 'expand') {
                    // 放大：中心内容向外铺开，方向指向外
                    const safeD = Math.max(euclid, 0.001);
                    dirX = ddx / safeD;    // 指向外
                    dirY = ddy / safeD;
                    const t = dist / maxDist;
                    f = t * f;  // 中心位移=0，邻近像素从靠近中心采样→中心黑点被放大
                }
            } else {
                f = Math.exp(-(dist * dist) / (2 * sigma * sigma));
            }
            const off = scale * f * 40;
            const rx = -dirX * off;
            const ry = -dirY * off;
            const idx = (y * size + x) * 4;
            data[idx]     = Math.max(0, Math.min(255, 128 + rx));
            data[idx + 1] = Math.max(0, Math.min(255, 128 + ry));
            data[idx + 2] = 128;
            data[idx + 3] = 255;
        }
    }
    _mapCtx.putImageData(_mapImageData, 0, 0);
    return _mapCanvas.toDataURL();
}

// 复用骨骼 canvas
let _boneCanvas = null;
let _boneCtx = null;
let _boneImageData = null;
let _boneData = null;

/**
 * 生成 128×128 的骨骼摆臂位移贴图（胶囊形状）。
 * 关节和末端各有一个圆圈范围，中间直线过渡，形成胶囊形影响区。
 * 位移幅度从关节（0）到末端（最大）线性递增。
 *
 * @param {number} jx   - 关节点 X (0..1)
 * @param {number} jy   - 关节点 Y (0..1)
 * @param {number} ex   - 末端点 X (0..1)
 * @param {number} ey   - 末端点 Y (0..1)
 * @param {number} dirX - 摆动方向 X
 * @param {number} dirY - 摆动方向 Y
 * @param {number} scale - 末端最大位移幅度
 * @param {number} jr   - 关节端圆圈半径 (归一化)
 * @param {number} [er] - 末端圆圈半径 (归一化)，默认等于 jr
 * @param {number} [spread] - 扩散范围 (0~1)，控制胶囊外 falloff 程度
 * @returns {string} data:image/png;base64,...
 */
function _genMapBone(jx, jy, ex, ey, dirX, dirY, scale, jr, er, spread, spatialDecay, spatialFalloff, displaceMode, ellipticity, ellipseAngle) {
    jr = jr || 0.08;
    er = (er != null) ? er : jr;
    spread = spread || 0;
    const sd = spatialDecay != null ? spatialDecay : 0.5;
    const sf = spatialFalloff || 'smooth';
    const el = ellipticity || 0;
    const ea = ellipseAngle || 0;
    const size = 128;
    if (!_boneCanvas) {
        _boneCanvas = document.createElement('canvas');
        _boneCanvas.width = size;
        _boneCanvas.height = size;
        _boneCtx = _boneCanvas.getContext('2d');
        _boneImageData = _boneCtx.createImageData(size, size);
        _boneData = _boneImageData.data;
    }
    const data = _boneData;

    // 骨骼方向向量（关节点 → 末端）
    const bx = (ex - jx) * size, by = (ey - jy) * size;
    const boneLen = Math.sqrt(bx * bx + by * by) || 1;
    const bnx = bx / boneLen, bny = by / boneLen;
    const px = jx * size, py = jy * size;
    // 外公切线偏转角
    const gamma = boneLen > 0.001 ? Math.asin(Math.max(-1, Math.min(1, (jr - er) * size / boneLen))) : 0;
    const cosG = Math.cos(gamma);

    // 末端坐标（贴图像素）
    const exPx = ex * size, eyPx = ey * size;

    for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
            const dx = x - px, dy = y - py;
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
            // 胶囊半径（线性插值），乘 cosγ 修正为正确的外公切线边界
            const capR = (jr + (er - jr) * Math.min(1, Math.max(0, t))) * size * cosG;
            let dist;
            if (t < 0) {
                dist = Math.sqrt(dx * dx + dy * dy);
            } else if (t > 1) {
                dist = Math.sqrt((x - exPx) * (x - exPx) + (y - eyPx) * (y - eyPx));
            } else {
                dist = Math.abs(-dx * bny + dy * bnx);
            }
            const capEdge = capR * (1 + spread * 2);
            const crossWeight = dist < capEdge ? _falloffFunc(dist / capEdge, sf, sd) : 0;
            const f = along * crossWeight;
            if (f < 0.005) continue;
            let bDirX = dirX, bDirY = dirY;
                if (displaceMode === 'vortex' || displaceMode === 'vortexCCW' || displaceMode === 'radial' || displaceMode === 'expand') {
                const ddx = x - px, ddy = y - py;
                const d = Math.sqrt(ddx * ddx + ddy * ddy) || 1;
                if (displaceMode === 'vortex') { bDirX = ddy / d; bDirY = -ddx / d; }
                else if (displaceMode === 'vortexCCW') { bDirX = -ddy / d; bDirY = ddx / d; }
                else if (displaceMode === 'radial') { bDirX = -ddx / d; bDirY = -ddy / d; } // 收缩（向内）
                else { bDirX = ddx / d; bDirY = ddy / d; } // 放大（向外）
            }
            const off = scale * f * 40;
            const rx = -bDirX * off;
            const ry = -bDirY * off;
            const idx = (y * size + x) * 4;
            data[idx]     = Math.max(0, Math.min(255, 128 + rx));
            data[idx + 1] = Math.max(0, Math.min(255, 128 + ry));
            data[idx + 2] = 128;
            data[idx + 3] = 255;
        }
    }
    _boneCtx.putImageData(_boneImageData, 0, 0);
    return _boneCanvas.toDataURL();
}

// ── 弹跳动画引擎（核心：创建独立 SVG 滤波器 + 果冻振荡循环） ──

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
function _startBounce(el, originX, originY, dirX, dirY, startScale, opts) {
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

// ── 交互绑定 ──

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
            const _dragFid = 'mc_drag_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6);

            function _dragSetMap(ux, uy, s) {
                const parent = _dragFeImg ? _dragFeImg.parentNode : null;
                if (!parent) return;
                const newImg = document.createElementNS(_NS, 'feImage');
                newImg.setAttribute('result', 'map');
                newImg.setAttribute('href', _genMap(originX, originY, ux, uy, s) + '#t=' + Date.now());
                parent.replaceChild(newImg, _dragFeImg);
                _dragFeImg = newImg;
                if (_dragFeDisp) _dragFeDisp.setAttribute('scale', String(Math.abs(s) * 10 + 2));
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
                _dragFeImg = document.createElementNS(_NS, 'feImage');
                _dragFeImg.setAttribute('result', 'map');
                _dragFeImg.setAttribute('href', _genMap(originX, originY, 0, -1, 0.01));
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
                    _dragSetMap(lastDirX, lastDirY, Math.min(dist * 3, 4));
                    return;
                }
                ev.preventDefault();
                if (dist > maxDist) maxDist = dist;
                const norm = dist || 0.001;
                lastDirX = dx / norm; lastDirY = dy / norm;
                _dragSetMap(lastDirX, lastDirY, Math.min(dist * 3, 4));
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

// ── 合批弹跳引擎（单 SVG 滤波器 + 单 rAF 循环，预计算 falloff，复用 canvas） ──

/**
 * 预计算每个点的静态 falloff 场（距离权重，不依赖动画状态），
 * 这样每帧只需乘积即可得到位移量，省去大量重复的 sqrt 和三角计算。
 */
function _precomputeFalloffs(points) {
    const size = 128;
    return points.map(p => {
        const px = p.ox * size, py = p.oy * size;
        const radius = p.radius || 0.08;
        const spread = p.spread != null ? p.spread : 0.1;
        const sd = p.spatialDecay != null ? p.spatialDecay : 0.5;
        const sf = p.spatialFalloff || 'smooth';
        const el = p.ellipticity || 0;
        const ea = p.ellipseAngle || 0;
        const falloff = new Float32Array(size * size);

        if (p.type === 'bone') {
            const ex = (p.endX != null ? p.endX : p.ox) * size;
            const ey = (p.endY != null ? p.endY : p.oy) * size;
            const jr_px = (p.radius || 0.08) * size;
            const er_px = (p.endRadius != null ? p.endRadius : (p.radius || 0.08)) * size;
            const bx = ex - px, by = ey - py;
            const boneLen = Math.sqrt(bx * bx + by * by) || 1;
            const bnx = bx / boneLen, bny = by / boneLen;
            const spreadMul = 1 + spread * 2;
            // 外公切线修正
            const gamma = boneLen > 0.001 ? Math.asin(Math.max(-1, Math.min(1, (jr_px - er_px) / boneLen))) : 0;
            const cosG = Math.cos(gamma);

            for (let y = 0; y < size; y++) {
                for (let x = 0; x < size; x++) {
                    const dx = x - px, dy = y - py;
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
                        dist = Math.sqrt(dx * dx + dy * dy);
                    } else if (t > 1) {
                        dist = Math.sqrt((x - ex) * (x - ex) + (y - ey) * (y - ey));
                    } else {
                        dist = Math.abs(-dx * bny + dy * bnx);
                    }
                    const crossWeight = dist < capEdge ? _falloffFunc(dist / capEdge, sf, sd) : 0;
                    falloff[y * size + x] = along * crossWeight;
                }
            }
        } else {
            const rPx = radius * size;
            const maxDist = rPx * (1 + spread * 2);
            for (let y = 0; y < size; y++) {
                for (let x = 0; x < size; x++) {
                    const ddx = x - px, ddy = y - py;
                    const dist = _ellipDist(ddx, ddy, el, ea);
                    falloff[y * size + x] = _falloffFunc(dist / maxDist, sf, sd);
                }
            }
        }
        return falloff;
    });
}

/**
 * 用预计算 falloff 快速生成合并位移贴图。
 * 复用 canvas / ImageData，避免每帧分配。
 */
const _COMBINED_SIZE = 128;
let _combinedCanvas = null;
let _combinedCtx = null;
let _combinedImageData = null;
let _combinedData = null;

function _genCombinedMapFast(points, stateArr, falloffs) {
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

        const falloff = falloffs[pi];
        const scale = p.scale || 4;
        const dirX = p.dx, dirY = p.dy;
        const dm = p.displaceMode || 'parallel';
        const pxP = p.ox * size, pyP = p.oy * size;

        const magnitude = Math.abs(scale * st.wobble);
        const perpX = -dirY, perpY = dirX;
        const mixX = dirX * st.wobble + perpX * st.wobblePerp;
        const mixY = dirY * st.wobble + perpY * st.wobblePerp;
        const mixNorm = Math.sqrt(mixX * mixX + mixY * mixY) || 1;
        const animDirX = mixX / mixNorm;
        const animDirY = mixY / mixNorm;

        const thr = 0.005;
        for (let i = 0; i < size * size; i++) {
            const f = falloff[i];
            if (f < thr) continue;
            // 非平行模式：每像素独立方向
            let pDirX = animDirX, pDirY = animDirY;
            if (dm !== 'parallel') {
                const ix = i % size, iy = (i / size) | 0;
                const ddx = ix - pxP, ddy = iy - pyP;
                const d = Math.sqrt(ddx * ddx + ddy * ddy) || 1;
                if (dm === 'vortex') { pDirX = ddy / d; pDirY = -ddx / d; }
                else if (dm === 'vortexCCW') { pDirX = -ddy / d; pDirY = ddx / d; }
                else if (dm === 'radial') { pDirX = -ddx / d; pDirY = -ddy / d; } // 收缩（向内）
                else { pDirX = ddx / d; pDirY = ddy / d; } // 放大（向外）
            }
            const off = magnitude * f * 40;
            const idx = i * 4;
            const rx = -pDirX * off;
            const ry = -pDirY * off;
            data[idx]     = Math.max(0, Math.min(255, data[idx] + rx));
            data[idx + 1] = Math.max(0, Math.min(255, data[idx + 1] + ry));
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
        feImg.setAttribute('href', _genCombinedMapFast(points, stateArr, falloffs) + '#t=' + Date.now());
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
    // 动态滤波器缩放 = 缩放系数 × 最大力度（位移图编码方向/形状，滤波器提供无限放大）
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
    feImg.setAttribute('href', _genCombinedMapFast(points, points.map(() => ({ decay: 1, wobble: 0, wobblePerp: 0 })), falloffs));
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
