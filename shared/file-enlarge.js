// shared/file-enlarge.js — 图片/视频/音频全屏放大查看（含事件冒泡防护）

/**
 * 全屏放大查看
 * @param {string} src - 文件 URL
 */
export function showFileEnlarge(src) {
    // 如果当前有原生 dialog 弹窗（如文件选择器），遮罩要插入 dialog 内部才能盖过其模态层
    const activeDialog = document.querySelector('.popup[open]');
    const container = activeDialog || document.body;

    const isVideo = src.match(/\.(mp4|webm|ogg|mov)$/i);
    const isAudio = src.match(/\.(mp3|wav|ogg|flac|aac|m4a|wma)$/i);
    const overlay = document.createElement('div');
    overlay.style.cssText = 'position:fixed;top:0;left:0;width:100vw;height:100dvh;background:rgba(0,0,0,0.9);z-index:2147483647;display:flex;align-items:center;justify-content:center;overflow:hidden;touch-action:none;';
    // 遮罩层阻止事件冒泡
    ['mousedown','mouseup','touchstart','touchend'].forEach(function (evt) {
        overlay.addEventListener(evt, function (e) { e.stopPropagation(); });
    });
    // ── 防止事件穿透到下方抽屉 ──
    // 捕获层：阻止所有非遮罩范围内的事件到达底层（如抽屉切换按钮）
    function _isInside(el) { return el && (el === overlay || el === closeBtn || overlay.contains(el) || closeBtn.contains(el)); }
    var _guard = function (e) { if (!_isInside(e.target)) { e.stopPropagation(); } };
    ['mousedown','mouseup','click','touchstart','touchend'].forEach(function (evt) {
        document.addEventListener(evt, _guard, true);
    });

    function closeOverlay() {
        window.removeEventListener('keydown', keyHandler);
        ['mousedown','mouseup','click','touchstart','touchend'].forEach(function (evt) {
            document.removeEventListener(evt, _guard, true);
        });
        if (closeBtn.parentNode) closeBtn.parentNode.removeChild(closeBtn);
        // 延迟到下一帧再隐藏，让当前事件安全走完
        requestAnimationFrame(function () {
            overlay.style.display = 'none';
        });
    }
    function keyHandler(e) { if (e.key === 'Escape') closeOverlay(); }
    window.addEventListener('keydown', keyHandler);
    // 关闭按钮
    const closeBtn = document.createElement('div');
    closeBtn.innerHTML = '✕';
    closeBtn.style.cssText = 'position:fixed;top:16px;right:16px;width:36px;height:36px;border-radius:50%;background:rgba(0,0,0,0.5);color:white;font-size:18px;display:flex;align-items:center;justify-content:center;cursor:pointer;z-index:1000001;user-select:none;line-height:1;';
    ['mousedown','mouseup','click','touchstart','touchend'].forEach(function (evt) {
        closeBtn.addEventListener(evt, function (e) { e.stopPropagation(); });
    });
    closeBtn.addEventListener('click', closeOverlay);
    if (isVideo) {
        const video = document.createElement('video');
        video.src = src; video.controls = true; video.autoplay = true;
        video.style.cssText = 'max-width:95vw;max-height:95dvh;border-radius:8px;';
        overlay.appendChild(video);
        overlay.appendChild(closeBtn);
        container.appendChild(overlay);
        return;
    }
    if (isAudio) {
        const audio = document.createElement('audio');
        audio.src = src; audio.controls = true; audio.autoplay = true;
        audio.style.cssText = 'width:80%;max-width:400px;';
        overlay.appendChild(audio);
        overlay.appendChild(closeBtn);
        container.appendChild(overlay);
        return;
    }
    // 图片
    const imgWrap = document.createElement('div');
    imgWrap.style.cssText = 'position:relative;display:flex;align-items:center;justify-content:center;width:100%;height:100%;overflow:hidden;touch-action:none;';
    const img = document.createElement('img');
    img.src = src;
    img.style.cssText = 'max-width:95vw;max-height:95dvh;width:auto;height:auto;object-fit:contain;border-radius:4px;touch-action:none;user-select:none;-webkit-user-drag:none;transform-origin:center center;transition:transform 0.05s ease;';
    imgWrap.appendChild(img);
    let scale = 1, tx = 0, ty = 0, lastDist = 0, lastTX = 0, lastTY = 0, isPinching = false;
    function applyT() { img.style.transform = `translate(${tx}px,${ty}px) scale(${scale})`; }
    function resetV(a) { scale = 1; tx = 0; ty = 0; img.style.transition = a ? 'transform 0.2s ease' : 'none'; applyT(); }
    imgWrap.addEventListener('wheel', function (e) { e.preventDefault(); const d = e.deltaY > 0 ? -0.15 : 0.15; const ns = Math.max(1, Math.min(scale + d, 6)); scale = ns; if (scale <= 1) resetV(true); else { img.style.transition = 'transform 0.1s ease'; applyT(); } }, { passive: false });
    let lct = 0;
    imgWrap.addEventListener('click', function (e) { e.stopPropagation(); const n = Date.now(); if (n - lct < 400) { lct = 0; if (scale > 1) resetV(true); else { scale = 2.5; img.style.transition = 'transform 0.2s ease'; applyT(); } } else lct = n; });
    imgWrap.addEventListener('touchstart', function (e) {
        if (e.touches.length >= 2) { e.preventDefault(); isPinching = true; lastDist = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY); img.style.transition = 'none'; }
        else if (e.touches.length === 1 && scale > 1) { lastTX = e.touches[0].clientX; lastTY = e.touches[0].clientY; img.style.transition = 'none'; }
    });
    imgWrap.addEventListener('touchmove', function (e) {
        if (e.touches.length >= 2 && isPinching) { e.preventDefault(); const d = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY); const ns = Math.max(1, Math.min(scale * (d / lastDist), 6)); scale = ns; lastDist = d; applyT(); }
        else if (e.touches.length === 1 && scale > 1) { tx += e.touches[0].clientX - lastTX; ty += e.touches[0].clientY - lastTY; lastTX = e.touches[0].clientX; lastTY = e.touches[0].clientY; applyT(); }
    });
    imgWrap.addEventListener('touchend', function () { isPinching = false; if (scale <= 1) resetV(true); });
    overlay.appendChild(imgWrap);
    overlay.appendChild(closeBtn);
    container.appendChild(overlay);
}
