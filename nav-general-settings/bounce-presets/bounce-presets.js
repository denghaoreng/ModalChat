/**
 * bounce-presets.js — 动态图预设主模块（拆分后的核心逻辑）
 *
 * 从子模块导入参数渲染、全屏编辑等功能。
 */

import { getBouncePresets, updateBouncePresets, getBounceRefImage, updateBounceRefImage, getBounceCanvasSize, updateBounceCanvasSize, saveSettings } from '../../data.js';
import { BounceEditor } from '../../shared/bounce-editor/index.js';
import { _renderParams, _applyParamInputs, _refreshPointList, _PARAM_DEFS, _setCopiedPoint } from './params.js';
import { _openFullscreen } from './fullscreen.js';
import { _setUpdateButtonStates } from './params.js';

// ==================== 模块级状态 ====================

/** @type {BounceEditor|null} */
let _bounceEditor = null;

/** 复制/粘贴缓存（通过引用对象传递给全屏模块） */
const _copiedRef = { _copiedPoint: null, _copiedType: null };

// ==================== 渲染 ====================

export function renderBounceEditor() {
    const presets = getBouncePresets();
    const sz = getBounceCanvasSize();
    const cw = sz.w, ch = sz.h;

    return `
    <div style="padding:4px 8px;">
        <div class="flex-container alignitemscenter" style="gap:8px;margin-bottom:8px;border-bottom:1px solid var(--borderColor);padding-bottom:6px;flex-wrap:nowrap;">
            <span style="font-weight:bold;font-size:0.9em;white-space:nowrap;"><i class="fa-solid fa-hand-pointer"></i> 动态图预设</span>
            <span id="mc-bounce-fullscreen" style="cursor:pointer;font-size:0.85em;opacity:0.5;margin-left:2px;" title="全屏编辑">⛶</span>
            <span id="mc-bounce-gear" style="cursor:pointer;font-size:0.85em;opacity:0.5;" title="画布设置">⚙️</span>
            <span id="mc-bounce-ref-img" style="cursor:pointer;font-size:0.85em;opacity:0.5;margin-left:2px;" title="上传参考图">🖼️</span>
            <span id="mc-bounce-clear-ref" style="cursor:pointer;font-size:0.82em;opacity:0.3;margin-left:1px;display:none;" title="清除参考图">✕</span>
            <span style="flex:1;min-width:0;"></span>
            <button id="mc-bounce-play" class="menu_button" style="font-size:0.78em;white-space:nowrap;flex-shrink:0;"><i class="fa-solid fa-play"></i> 试玩</button>
            <button id="mc-bounce-reset" class="menu_button" style="font-size:0.78em;white-space:nowrap;flex-shrink:0;color:var(--dangerColor);"><i class="fa-solid fa-trash"></i> 清除所有</button>
            <button id="mc-bounce-save" class="menu_button" style="font-size:0.78em;white-space:nowrap;flex-shrink:0;"><i class="fa-solid fa-floppy-disk"></i> 保存</button>
        </div>
        <div class="flex-container alignitemscenter" style="gap:6px;margin-bottom:4px;flex-wrap:nowrap;">
            <button id="mc-bounce-undo" class="menu_button" style="font-size:0.78em;white-space:nowrap;flex-shrink:0;" disabled>
                <i class="fa-solid fa-rotate-left"></i> 撤销
            </button>
            <button id="mc-bounce-delete" class="menu_button" style="font-size:0.78em;white-space:nowrap;flex-shrink:0;color:var(--dangerColor);" disabled>
                <i class="fa-solid fa-xmark"></i> 删除
            </button>
            <button id="mc-bounce-copy" class="menu_button" style="font-size:0.78em;white-space:nowrap;flex-shrink:0;" disabled>
                <i class="fa-solid fa-copy"></i> 复制
            </button>
            <button id="mc-bounce-paste" class="menu_button" style="font-size:0.78em;white-space:nowrap;flex-shrink:0;" disabled>
                <i class="fa-solid fa-paste"></i> 粘贴
            </button>
            <select id="mc-bounce-pointlist" style="font-size:0.78em;padding:2px 4px;border-radius:4px;border:1px solid var(--borderColor);background:var(--white15);color:inherit;cursor:pointer;max-width:130px;">
                <option value="-1">📋 点列表</option>
            </select>
            <select id="mc-bounce-tool-mode" style="font-size:0.78em;padding:2px 4px;border-radius:4px;border:1px solid var(--borderColor);background:var(--white15);color:inherit;cursor:pointer;">
                <option value="point">🔵 点</option>
                <option value="bone">🦴 骨骼</option>
            </select>
            <span style="flex:1;min-width:4px;"></span>
            <span id="mc-bounce-interact-mode" style="cursor:pointer;font-size:0.82em;padding:2px 6px;border-radius:4px;border:1px solid var(--borderColor);white-space:nowrap;user-select:none;" title="点击切换交互模式">↔️ 方向</span>
        </div>
        <div id="mc-bounce-params" style="display:grid;grid-template-columns:repeat(6,1fr);gap:2px 4px;margin-bottom:6px;font-size:0.75em;"></div>
        <div style="background:var(--white15);border-radius:6px;padding:8px;">
            <canvas id="mc-bounce-canvas" tabindex="0"
                style="display:block;width:100% !important;max-width:min(${cw}px,100%);aspect-ratio:${cw}/${ch};border-radius:4px;cursor:crosshair;outline:none;margin:0 auto;"
                width="${cw}" height="${ch}"></canvas>
        </div>
        <div style="margin-top:6px;font-size:0.82em;color:var(--grey40);text-align:center;">
            当前 <span id="mc-bounce-count">${presets.length}</span> 个弹跳点
            &nbsp;·&nbsp; 画布 ${cw}×${ch}
        </div>
    </div>`;
}

// ==================== 初始化 ====================

_setUpdateButtonStates(function _updateButtons(editor, hasSelection, pts, idx) {
    if (!editor) return;
    $('#mc-bounce-delete').prop('disabled', !hasSelection);
    $('#mc-bounce-copy').prop('disabled', !hasSelection);
    if (hasSelection && _copiedRef._copiedPoint) {
        const targetType = pts[idx].type || 'point';
        $('#mc-bounce-paste').prop('disabled', _copiedRef._copiedType !== targetType);
    } else {
        $('#mc-bounce-paste').prop('disabled', true);
    }
});

export function initBounceEditor() {
    const canvas = document.getElementById('mc-bounce-canvas');
    if (!canvas) return;
    if (_bounceEditor) _bounceEditor = null;

    const presets = getBouncePresets();
    const sz = getBounceCanvasSize();

    _bounceEditor = new BounceEditor(canvas, {
        width: sz.w,
        height: sz.h,
        points: presets,
        onChange: (pts) => {
            $('#mc-bounce-count').text(pts.length);
            $('#mc-bounce-undo').prop('disabled', !(_bounceEditor && _bounceEditor.canUndo));
            _renderParams(_bounceEditor);
            _refreshPointList(_bounceEditor);
            updateBouncePresets(pts);
        },
        onHoverChange: () => {
            _renderParams(_bounceEditor);
            _refreshPointList(_bounceEditor);
        },
    });

    if (presets.length > 0) {
        _bounceEditor._hoverIdx = 0;
        _bounceEditor.render();
    }
    _renderParams(_bounceEditor);
    // 确保点列表刷新
    _refreshPointList(_bounceEditor);

    const savedRef = getBounceRefImage();
    if (savedRef) {
        _bounceEditor.setBackgroundImage(savedRef);
        $('#mc-bounce-clear-ref').show();
    }
}

export function destroyBounceEditor() {
    _bounceEditor = null;
}

// ==================== 弹窗 ====================

async function showBounceSettingsPopup() {
    const { callGenericPopup, POPUP_TYPE } = await import('../../../../../popup.js');
    const sz = getBounceCanvasSize();

    let cachedW = sz.w, cachedH = sz.h;
    $(document).on('click.bcSave', function (e) {
        const $btn = $(e.target).closest('.popup-button-ok, .popup-button-save, button:contains("保存")');
        if (!$btn.length) return;
        cachedW = parseInt($('#mc-bc-w').val()) || 0;
        cachedH = parseInt($('#mc-bc-h').val()) || 0;
    });

    const html = `
    <div style="padding:16px;min-width:280px;">
        <h3 style="margin:0 0 12px 0;font-size:1em;">⚙️ 画布设置</h3>
        <div style="display:flex;gap:16px;align-items:center;margin-bottom:12px;">
            <div style="display:flex;align-items:center;gap:6px;">
                <label style="font-size:0.85em;">宽度</label>
                <input id="mc-bc-w" class="text_pole" type="number" min="100" max="2000" step="10" value="${sz.w}" style="width:80px;text-align:center;">
            </div>
            <div style="display:flex;align-items:center;gap:6px;">
                <label style="font-size:0.85em;">高度</label>
                <input id="mc-bc-h" class="text_pole" type="number" min="100" max="2000" step="10" value="${sz.h}" style="width:80px;text-align:center;">
            </div>
        </div>
        <div style="font-size:0.8em;color:var(--grey40);">修改后保存并应用，画布比例将随之调整。</div>
    </div>`;

    const result = await callGenericPopup(html, POPUP_TYPE.CONFIRM, '画布设置', { okButton: '保存', cancelButton: '取消' });
    $(document).off('click.bcSave');
    if (!result) return;
    if (cachedW < 50 || cachedH < 50) {
        toastr?.warning?.('请输入有效的尺寸（≥50）') || alert('请输入有效的尺寸');
        return;
    }
    updateBounceCanvasSize(cachedW, cachedH);
    const { renderGeneralSettings, bindGeneralEvents } = await import('../settings-ui.js');
    renderGeneralSettings();
    bindGeneralEvents();
}

// ==================== 事件绑定 ====================

// 参数输入 change 委托
$(document).off('change', '#mc-bounce-params .mc-bp-input').on('change', '#mc-bounce-params .mc-bp-input', function () {
    _applyParamInputs(_bounceEditor);
});

export function bindBounceEvents() {
    // 工具模式
    $(document).off('change', '#mc-bounce-tool-mode').on('change', '#mc-bounce-tool-mode', function () {
        if (!_bounceEditor) return;
        _bounceEditor.setMode($(this).val());
    });
    // 撤销
    $(document).off('click', '#mc-bounce-undo').on('click', '#mc-bounce-undo', function () {
        if (_bounceEditor && _bounceEditor.undo()) {
            $('#mc-bounce-count').text(_bounceEditor.getPoints().length);
            $(this).prop('disabled', !_bounceEditor.canUndo);
            _renderParams(_bounceEditor);
        }
    });
    // 删除
    $(document).off('click', '#mc-bounce-delete').on('click', '#mc-bounce-delete', function () {
        if (!_bounceEditor) return;
        const idx = _bounceEditor.hoveredIndex;
        if (idx >= 0) {
            _bounceEditor.removePoint(idx);
            $('#mc-bounce-count').text(_bounceEditor.getPoints().length);
            $('#mc-bounce-undo').prop('disabled', !_bounceEditor.canUndo);
            _renderParams(_bounceEditor);
            _refreshPointList(_bounceEditor);
        }
    });
    // 复制
    $(document).off('click', '#mc-bounce-copy').on('click', '#mc-bounce-copy', function () {
        if (!_bounceEditor) return;
        const idx = _bounceEditor.hoveredIndex;
        const pts = _bounceEditor.getPoints();
        if (idx >= 0 && idx < pts.length) {
            _copiedRef._copiedPoint = { ...pts[idx] };
            _copiedRef._copiedType = pts[idx].type || 'point';
            _renderParams(_bounceEditor);
            toastr?.info?.(`已复制 ${_copiedRef._copiedType === 'bone' ? '骨骼' : '点'} 参数`) || alert('已复制');
        }
    });
    // 粘贴
    $(document).off('click', '#mc-bounce-paste').on('click', '#mc-bounce-paste', function () {
        if (!_bounceEditor || !_copiedRef._copiedPoint) return;
        const idx = _bounceEditor.hoveredIndex;
        if (idx < 0) return;
        const p = _bounceEditor.points[idx];
        const targetType = p.type || 'point';
        if (_copiedRef._copiedType !== targetType) {
            toastr?.warning?.(`类型不匹配：无法将 ${_copiedRef._copiedType === 'bone' ? '骨骼' : '点'} 参数粘贴到 ${targetType === 'bone' ? '骨骼' : '点'}`) || alert('类型不匹配');
            return;
        }
        const skipKeys = ['type', 'ox', 'oy'];
        if (targetType === 'bone') skipKeys.push('endX', 'endY');
        _bounceEditor._pushUndo();
        for (const key of Object.keys(_copiedRef._copiedPoint)) {
            if (skipKeys.includes(key)) continue;
            p[key] = _copiedRef._copiedPoint[key];
        }
        _bounceEditor._notifyChange();
        _bounceEditor.render();
        toastr?.success?.('已粘贴') || alert('已粘贴');
    });
    // 交互模式（点击切换）
    $(document).off('click', '#mc-bounce-interact-mode').on('click', '#mc-bounce-interact-mode', function () {
        if (!_bounceEditor) return;
        const cur = _bounceEditor.interactionMode;
        const next = cur === 'direction' ? 'move' : 'direction';
        _bounceEditor.setInteractionMode(next);
        $(this).html(next === 'move' ? '✋ 移动' : '↔️ 方向');
        $(this).css('border-color', next === 'move' ? '#44cc44' : 'var(--borderColor)');
    });
    // 初始化工具/交互模式
    if (_bounceEditor) {
        $('#mc-bounce-tool-mode').val(_bounceEditor.mode);
        const curMode = _bounceEditor.interactionMode;
        $('#mc-bounce-interact-mode').html(curMode === 'move' ? '✋ 移动' : '↔️ 方向');
        $('#mc-bounce-interact-mode').css('border-color', curMode === 'move' ? '#44cc44' : 'var(--borderColor)');
    }
    // 全屏编辑
    $(document).off('click', '#mc-bounce-fullscreen').on('click', '#mc-bounce-fullscreen', function () {
        if (!_bounceEditor) return;
        _openFullscreen(_bounceEditor, _copiedRef);
    });
    // 点列表选择
    $(document).off('change', '#mc-bounce-pointlist').on('change', '#mc-bounce-pointlist', function () {
        const idx = parseInt($(this).val());
        if (_bounceEditor && idx >= 0) {
            _bounceEditor._hoverIdx = idx;
            _bounceEditor.onHoverChange(idx);
            _bounceEditor.render();
            _refreshPointList(_bounceEditor);
        } else {
            $(this).val('-1');
        }
    });
    // 画布设置
    $(document).off('click', '#mc-bounce-gear').on('click', '#mc-bounce-gear', function () {
        showBounceSettingsPopup();
    });
    // 试玩
    $(document).off('click', '#mc-bounce-play').on('click', '#mc-bounce-play', async function () {
        if (!_bounceEditor || !_bounceEditor.hasBackgroundImage) {
            toastr?.warning?.('请先上传参考图片') || alert('请先上传参考图片');
            return;
        }
        const presets = getBouncePresets();
        if (!presets || presets.length === 0) {
            toastr?.warning?.('请至少添加一个弹跳点') || alert('请至少添加一个弹跳点');
            return;
        }
        const { autoBounce } = await import('../../shared/image-drag-physics/index.js');
        const bgImg = _bounceEditor._bgImage;
        const src = bgImg?.src;
        if (!src) return;

        const sz = getBounceCanvasSize();
        const cw = sz.w, ch = sz.h;
        const maxW = Math.min(window.innerWidth * 0.9, 800);
        const scaleF = maxW / cw;
        const boxW = Math.round(cw * scaleF);
        const boxH = Math.round(ch * scaleF);

        const preview = document.createElement('div');
        preview.style.cssText = 'position:fixed;top:0;left:0;width:100vw;height:100dvh;background:rgba(0,0,0,0.85);z-index:2147483646;display:flex;align-items:center;justify-content:center;overflow:hidden;';
        ['mousedown','mouseup','click','touchstart','touchend'].forEach(function (evt) {
            preview.addEventListener(evt, function (e) { e.stopPropagation(); });
        });

        const box = document.createElement('div');
        box.style.cssText = `width:${boxW}px;height:${boxH}px;border-radius:8px;overflow:hidden;position:relative;`;
        const img = document.createElement('img');
        img.src = src;
        img.style.cssText = `width:100%;height:100%;object-fit:contain;display:block;`;
        box.appendChild(img);
        preview.appendChild(box);

        const playClose = document.createElement('div');
        playClose.innerHTML = '✕';
        playClose.style.cssText = 'position:fixed;top:16px;right:16px;width:36px;height:36px;border-radius:50%;background:rgba(0,0,0,0.5);color:white;font-size:18px;display:flex;align-items:center;justify-content:center;cursor:pointer;z-index:2147483647;line-height:1;user-select:none;';
        let bounceHandle = null;
        function closePlay() {
            if (bounceHandle) bounceHandle.cancelAll();
            requestAnimationFrame(function () {
                playClose.style.display = 'none';
                preview.style.display = 'none';
            });
        }
        ['mousedown','mouseup','click','touchstart','touchend'].forEach(function (evt) {
            playClose.addEventListener(evt, function (e) { e.stopPropagation(); });
        });
        playClose.addEventListener('click', function () { closePlay(); });

        img.addEventListener('load', function () {
            bounceHandle = autoBounce(img, presets);
            // 不自动关闭，用户手动点击 ✕ 关闭
        });
        document.body.appendChild(preview);
        document.body.appendChild(playClose);
    });
    // 参考图上传
    $(document).off('click', '#mc-bounce-ref-img').on('click', '#mc-bounce-ref-img', async function () {
        if (!_bounceEditor) return;
        try {
            const { showFilePickerPopup } = await import('../nav-file-manager/index.js');
            const entries = await showFilePickerPopup({ multiSelect: false, title: '选择参考图片' });
            if (entries && entries.length > 0) {
                const fp = entries[0].fullServerPath || entries[0].serverFilename || entries[0].filePath;
                if (!fp) { toastr?.warning?.('所选文件无有效路径'); return; }
                const url = fp.startsWith('/') ? fp : '/' + fp;
                _bounceEditor.setBackgroundImage(url);
                updateBounceRefImage(url);
                $('#mc-bounce-clear-ref').show();
            }
        } catch (e) { console.warn('ModalChat: ref image error', e); }
    });
    // 清除参考图
    $(document).off('click', '#mc-bounce-clear-ref').on('click', '#mc-bounce-clear-ref', function () {
        if (_bounceEditor) {
            _bounceEditor.clearBackgroundImage();
            $('#mc-bounce-clear-ref').hide();
            updateBounceRefImage('');
        }
    });
    // 清除所有点
    $(document).off('click', '#mc-bounce-reset').on('click', '#mc-bounce-reset', function () {
        if (_bounceEditor) {
            _bounceEditor.clearAll();
            _bounceEditor._hoverIdx = -1;
            $('#mc-bounce-count').text('0');
            $('#mc-bounce-undo').prop('disabled', !_bounceEditor.canUndo);
            _renderParams(_bounceEditor);
            updateBouncePresets([]);
        }
    });
    // 保存
    $(document).off('click', '#mc-bounce-save').on('click', '#mc-bounce-save', function () {
        saveSettings();
        toastr?.success?.('动态图预设已保存') || alert('已保存');
    });
    // 键盘快捷键
    $(document).off('keydown.bounce').on('keydown.bounce', function (e) {
        if (_bounceEditor && (e.key === 'Delete' || e.key === 'Backspace')) {
            const canvas = document.getElementById('mc-bounce-canvas');
            if (canvas && document.activeElement === canvas) {
                _bounceEditor.removePoint(_bounceEditor._hoverIdx);
                e.preventDefault();
            }
        }
    });
    $(document).off('click', '#mc-bounce-canvas').on('click', '#mc-bounce-canvas', function () {
        this.focus();
    });
    // 确保点列表已刷新
    _refreshPointList(_bounceEditor);
}
