/**
 * fullscreen.js — 动态图预设全屏编辑器遮罩
 */

import { BounceEditor } from '../../shared/bounce-editor/index.js';
import { getBounceCanvasSize } from '../../data.js';
import { _PARAM_DEFS, _paramCellHtml } from './params.js';

/**
 * 打开全屏画布编辑器遮罩
 * @param {import('./index.js').BounceEditor} mainEditor
 * @param {object} copiedRef - 引用 { _copiedPoint, _copiedType }
 */
export async function _openFullscreen(mainEditor, copiedRef) {
    if (!mainEditor) return;
    const sz = getBounceCanvasSize();
    const cw = sz.w, ch = sz.h;
    const presets = mainEditor.getPoints();
    if (presets.length === 0) { toastr?.warning?.('请先添加至少一个弹跳点') || alert('请先添加点'); return; }

    const availW = Math.min(window.innerWidth * 0.94, 1500);
    const availH = window.innerHeight * 0.78;
    const scale = Math.min(availW / cw, availH / ch);
    const dispW = Math.round(cw * scale);
    const dispH = Math.round(ch * scale);

    // 遮罩
    const overlay = document.createElement('div');
    overlay.style.cssText = 'position:fixed;top:0;left:0;width:100vw;height:100dvh;background:rgba(0,0,0,0.92);z-index:2147483646;display:flex;align-items:center;justify-content:center;flex-direction:column;overflow:hidden;';
    ['mousedown','mouseup','touchstart','touchend','wheel'].forEach(evt => {
        overlay.addEventListener(evt, e => e.stopPropagation());
    });

    // ── 工具栏 ──
    const toolBar = document.createElement('div');
    toolBar.style.cssText = 'display:flex;gap:6px;align-items:center;margin:0 12px 6px 12px;color:#ccc;font-size:0.8em;width:100%;max-width:1500px;flex-wrap:wrap;justify-content:center;';
    toolBar.innerHTML = `
        <span style="font-weight:bold;color:#fff;font-size:0.95em;margin-right:4px;">⛶ 全屏</span>
        <button class="mc-fs-btn" id="mc-fs-undo" disabled><i class="fa-solid fa-rotate-left"></i> 撤销</button>
        <button class="mc-fs-btn" id="mc-fs-delete" disabled><i class="fa-solid fa-xmark"></i> 删除</button>
        <button class="mc-fs-btn" id="mc-fs-copy" disabled><i class="fa-solid fa-copy"></i> 复制</button>
        <button class="mc-fs-btn" id="mc-fs-paste" disabled><i class="fa-solid fa-paste"></i> 粘贴</button>
        <select id="mc-fs-tool-mode" style="font-size:0.85em;padding:2px 4px;border-radius:3px;border:1px solid #555;background:#222;color:#ccc;">
            <option value="point">🔵 点</option>
            <option value="bone">🦴 骨骼</option>
        </select>
        <span id="mc-fs-interact-mode" style="cursor:pointer;font-size:0.85em;padding:2px 6px;border-radius:3px;border:1px solid #555;background:#222;color:#ccc;user-select:none;" title="点击切换">↔️ 方向</span>
        <select id="mc-fs-list" style="font-size:0.85em;padding:2px 4px;border-radius:3px;border:1px solid #555;background:#222;color:#ccc;cursor:pointer;max-width:140px;">
            <option value="-1">📋 点列表</option>
        </select>
        <button class="mc-fs-btn" id="mc-fs-close" style="margin-left:auto;"><i class="fa-solid fa-xmark"></i> 关闭</button>
    `;
    const fsBtnStyle = document.createElement('style');
    fsBtnStyle.textContent = '.mc-fs-btn{background:rgba(255,255,255,0.08);border:1px solid #444;color:#ddd;padding:3px 10px;border-radius:4px;cursor:pointer;font-size:0.85em;white-space:nowrap;}.mc-fs-btn:hover{background:rgba(255,255,255,0.15);}.mc-fs-btn:disabled{opacity:0.35;cursor:default;}';
    overlay.appendChild(fsBtnStyle);
    overlay.appendChild(toolBar);

    // ── 画布 ──
    const box = document.createElement('div');
    box.style.cssText = `width:${dispW}px;height:${dispH}px;border-radius:6px;overflow:hidden;position:relative;background:#1a1a2e;flex-shrink:0;`;
    const canvas = document.createElement('canvas');
    canvas.width = cw;
    canvas.height = ch;
    canvas.style.cssText = 'display:block;width:100%;height:100%;cursor:crosshair;outline:none;';
    canvas.setAttribute('tabindex', '0');
    box.appendChild(canvas);
    overlay.appendChild(box);

    // ── 参数表格 ──
    const paramsContainer = document.createElement('div');
    paramsContainer.id = 'mc-fs-params';
    paramsContainer.style.cssText = 'display:grid;grid-template-columns:repeat(6,1fr);gap:2px 4px;margin:6px 12px 0 12px;font-size:0.72em;width:100%;max-width:1500px;';
    overlay.appendChild(paramsContainer);

    // ── 底部信息 ──
    const infoBar = document.createElement('div');
    infoBar.style.cssText = 'margin-top:4px;color:#666;font-size:0.75em;text-align:center;';
    infoBar.textContent = `${cw}×${ch} · ${presets.length} 个点 · Esc 关闭`;
    overlay.appendChild(infoBar);

    document.body.appendChild(overlay);

    // ── 创建临时 BounceEditor ──
    const fsEditor = new BounceEditor(canvas, {
        width: cw,
        height: ch,
        points: presets,
        onChange: (pts) => {
            mainEditor.setPoints(pts);
            infoBar.textContent = `${cw}×${ch} · ${pts.length} 个点 · Esc 关闭`;
            _renderFsParams(fsEditor, paramsContainer);
            _updateFsButtons(fsEditor, copiedRef);
            _refreshFsList(fsEditor);
        },
        onHoverChange: () => {
            _renderFsParams(fsEditor, paramsContainer);
            _updateFsButtons(fsEditor, copiedRef);
            _refreshFsList(fsEditor);
        },
    });
    if (mainEditor._bgImage) {
        fsEditor.setBackgroundImage(mainEditor._bgImage.src);
    }
    _renderFsParams(fsEditor, paramsContainer);
    _updateFsButtons(fsEditor, copiedRef);
    _refreshFsList(fsEditor);
    $('#mc-fs-tool-mode').val(fsEditor.mode);
    $('#mc-fs-interact-mode').html(fsEditor.interactionMode === 'move' ? '✋ 移动' : '↔️ 方向');
    $('#mc-fs-interact-mode').css('border-color', fsEditor.interactionMode === 'move' ? '#44cc44' : '#555');

    // ── 事件绑定 ──
    $(document).on('change', '#mc-fs-tool-mode', function () {
        fsEditor.setMode($(this).val());
        _renderFsParams(fsEditor, paramsContainer);
        _updateFsButtons(fsEditor, copiedRef);
    });
    $(document).on('click', '#mc-fs-interact-mode', function () {
        const cur = fsEditor.interactionMode;
        const next = cur === 'direction' ? 'move' : 'direction';
        fsEditor.setInteractionMode(next);
        $(this).html(next === 'move' ? '✋ 移动' : '↔️ 方向');
        $(this).css('border-color', next === 'move' ? '#44cc44' : '#555');
    });
    $(document).on('click', '#mc-fs-undo', function () {
        if (fsEditor.undo()) { _renderFsParams(fsEditor, paramsContainer); _updateFsButtons(fsEditor, copiedRef); }
    });
    $(document).on('click', '#mc-fs-delete', function () {
        const i = fsEditor.hoveredIndex;
        if (i >= 0) { fsEditor.removePoint(i); _renderFsParams(fsEditor, paramsContainer); _updateFsButtons(fsEditor, copiedRef); }
    });
    $(document).on('click', '#mc-fs-copy', function () {
        const i = fsEditor.hoveredIndex;
        const pts = fsEditor.getPoints();
        if (i >= 0 && i < pts.length) {
            copiedRef._copiedPoint = { ...pts[i] };
            copiedRef._copiedType = pts[i].type || 'point';
            _updateFsButtons(fsEditor, copiedRef);
            toastr?.info?.('已复制') || alert('已复制');
        }
    });

    function _refreshFsList(editor) {
        const pts = editor.getPoints();
        const $sel = $('#mc-fs-list');
        const cur = editor._hoverIdx;
        let html = '<option value="-1">📋 点列表</option>';
        pts.forEach((p, i) => {
            const icon = p.type === 'bone' ? '🦴' : '🔵';
            const coord = `${(p.ox*100).toFixed(0)},${(p.oy*100).toFixed(0)}`;
            html += `<option value="${i}"${i === cur ? ' selected' : ''}>${icon} #${i+1} (${coord})</option>`;
        });
        $sel.html(html);
    }

    $(document).on('change', '#mc-fs-list', function () {
        const idx = parseInt($(this).val());
        if (idx >= 0) {
            fsEditor._hoverIdx = idx;
            fsEditor.onHoverChange(idx);
            fsEditor.render();
            _renderFsParams(fsEditor, paramsContainer);
            _updateFsButtons(fsEditor, copiedRef);
            _refreshFsList(fsEditor);
        } else {
            $(this).val('-1');
        }
    });

    $(document).on('click', '#mc-fs-paste', function () {
        if (!copiedRef._copiedPoint) return;
        const i = fsEditor.hoveredIndex;
        if (i < 0) return;
        const p = fsEditor.points[i];
        const targetType = p.type || 'point';
        if (copiedRef._copiedType !== targetType) { toastr?.warning?.('类型不匹配'); return; }
        fsEditor._pushUndo();
        const skipKeys = ['type', 'ox', 'oy'];
        if (targetType === 'bone') skipKeys.push('endX', 'endY');
        for (const key of Object.keys(copiedRef._copiedPoint)) {
            if (skipKeys.includes(key)) continue;
            p[key] = copiedRef._copiedPoint[key];
        }
        fsEditor._notifyChange();
        fsEditor.render();
        toastr?.success?.('已粘贴');
    });

    $(document).on('change', '#mc-fs-params .mc-bp-input', function () {
        const key = $(this).data('key');
        const i = fsEditor.hoveredIndex;
        if (i < 0) return;
        const p = fsEditor.points[i];
        const defs = _PARAM_DEFS[p.type === 'bone' ? 'bone' : 'point'];
        const d = defs.find(x => x.key === key);
        if (!d) return;
        if (d.type === 'select') {
            const val = $(this).val();
            if (p[key] !== val) { p[key] = val; fsEditor._notifyChange(); fsEditor.render(); }
            return;
        }
        const raw = parseFloat($(this).val());
        if (isNaN(raw)) return;
        if (key === 'dirAngle') {
            const clamped = Math.max(0, Math.min(360, raw));
            const rad = clamped * Math.PI / 180;
            p.dx = Math.cos(rad);
            p.dy = Math.sin(rad);
        } else {
            const newVal = d.toRaw(raw);
            p[key] = newVal;
        }
        fsEditor._notifyChange();
        fsEditor.render();
    });

    function _closeFs() {
        $(document).off('change', '#mc-fs-tool-mode');
        $(document).off('click', '#mc-fs-interact-mode');
        $(document).off('click', '#mc-fs-undo');
        $(document).off('click', '#mc-fs-delete');
        $(document).off('click', '#mc-fs-copy');
        $(document).off('click', '#mc-fs-paste');
        $(document).off('change', '#mc-fs-list');
        $(document).off('change', '#mc-fs-params .mc-bp-input');
        $(document).off('keydown.fs');
        overlay.style.display = 'none';
        requestAnimationFrame(() => { if (overlay.parentNode) overlay.parentNode.removeChild(overlay); });
    }
    $('#mc-fs-close').on('click', _closeFs);
    $(document).on('keydown.fs', (e) => { if (e.key === 'Escape') _closeFs(); });
}

/** 在全屏编辑器中渲染参数表格 */
function _renderFsParams(editor, container) {
    if (!editor) return;
    const idx = editor.hoveredIndex;
    const pts = editor.getPoints();
    if (idx < 0 || idx >= pts.length) { container.innerHTML = ''; return; }
    const p = pts[idx];
    const defs = _PARAM_DEFS[p.type === 'bone' ? 'bone' : 'point'];
    const COLS = 6, ROWS = 3;
    const cells = new Array(COLS * ROWS).fill(null);
    for (let i = 0; i < defs.length && i < cells.length; i++) cells[i] = defs[i];
    let html = '';
    for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
            const d = cells[r * COLS + c];
            if (d) {
                html += _paramCellHtml(d, p, 'mc-bp-input', '#999', '#444', '#222', '#666', 44);
            } else {
                html += `<div style="min-height:44px;"></div>`;
            }
        }
    }
    container.innerHTML = html;
}

/** 更新全屏编辑器的按钮状态 */
function _updateFsButtons(editor, copiedRef) {
    if (!editor) return;
    const idx = editor.hoveredIndex;
    const pts = editor.getPoints();
    const hasSel = idx >= 0 && idx < pts.length;
    $('#mc-fs-undo').prop('disabled', !editor.canUndo);
    $('#mc-fs-delete').prop('disabled', !hasSel);
    $('#mc-fs-copy').prop('disabled', !hasSel);
    const canPaste = hasSel && copiedRef._copiedPoint && copiedRef._copiedType === (pts[idx]?.type || 'point');
    $('#mc-fs-paste').prop('disabled', !canPaste);
}
