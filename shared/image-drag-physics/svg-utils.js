// ── SVG 命名空间与工具函数 ──

/** SVG 命名空间常量 */
export const _NS = 'http://www.w3.org/2000/svg';

/**
 * 向元素的 CSS filter 链追加一个 url(#filterId)
 * @param {HTMLElement} el
 * @param {string} fid - filter ID
 */
export function _addFilterUrl(el, fid) {
    const cur = el.style.filter;
    const add = 'url(#' + fid + ')';
    el.style.filter = cur ? cur + ' ' + add : add;
}

/**
 * 从元素的 CSS filter 链移除一个 url(#filterId)
 * @param {HTMLElement} el
 * @param {string} fid - filter ID
 */
export function _removeFilterUrl(el, fid) {
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
export function _getPos(ev) {
    if (ev.touches) return { x: ev.touches[0].clientX, y: ev.touches[0].clientY };
    if (ev.changedTouches) return { x: ev.changedTouches[0].clientX, y: ev.changedTouches[0].clientY };
    return { x: ev.clientX, y: ev.clientY };
}
