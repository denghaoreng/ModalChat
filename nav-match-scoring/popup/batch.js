// nav-match-scoring/popup-batch.js — 批量新增弹窗
// 弹出选择文件、设置共用名称/标签/内容，"选择文件"按钮调用文件管理器弹窗

import { callGenericPopup } from '../../../../../popup.js';
import { getMatchScoringData, saveSettings } from '../../core/data.js';
import { escapeHtml, generateId } from '../../shared/utils.js';
import { showFilePickerPopup } from '../../nav-file-manager/file-picker-popup.js';

const POPUP_TYPE = Object.freeze({ TEXT: 1, CONFIRM: 2, INPUT: 3, DISPLAY: 4 });

/**
 * 批量新增文件弹窗
 * 从文件管理器选择已有文件，设置共用名称/标签/内容
 */
export async function showBatchAddPopup() {
    /** @type {Array<{entry: object, fileUrl: string}>} */
    let selectedEntries = [];

    const popupContent = $(`
    <div id="mc-batch-popup" style="min-width:350px;font-size:0.92em;">
        <style>
            .mc-batch-thumb { width:60px; height:60px; object-fit:cover; border-radius:4px; border:1px solid var(--borderColor); }
            .mc-batch-thumb-item { position:relative; display:inline-block; text-align:center; }
            .mc-batch-thumb-del { position:absolute; top:-6px; right:-6px; width:18px; height:18px; border-radius:50%; background:var(--dangerColor); color:#fff; font-size:11px; line-height:18px; text-align:center; cursor:pointer; }
        </style>
        <div class="flex-container flexFlowColumn" style="gap:8px;">
            <div style="font-weight:bold;font-size:1em;margin-bottom:4px;">
                <i class="fa-solid fa-layer-group"></i> 批量新增文件
            </div>
            <div style="display:flex;align-items:center;gap:6px;">
                <span style="font-size:0.85em;opacity:0.7;">已选 <span id="mc-batch-count">0</span> 个文件</span>
                <button id="mc-batch-select-btn" class="menu_button" style="font-size:0.85em;white-space:nowrap;">
                    <i class="fa-solid fa-images"></i> 从文件管理器选择
                </button>
            </div>
            <div id="mc-batch-thumb-list" class="flex-container flexWrap" style="gap:6px;min-height:40px;padding:4px;border:1px dashed var(--borderColor);border-radius:4px;">
                <span style="opacity:0.4;font-size:0.85em;">暂无文件</span>
            </div>
            <div>
                <div style="font-size:0.85em;font-weight:500;margin-bottom:2px;">共用名称</div>
                <input id="mc-batch-display-name" class="text_pole" type="text" placeholder="所有文件共用此名称（留空则用原文件名）" style="width:100%;font-size:0.9em;">
            </div>
            <div>
                <div style="font-size:0.85em;font-weight:500;margin-bottom:2px;">共用标签（用逗号分隔）</div>
                <input id="mc-batch-tags" class="text_pole" type="text" placeholder="例如: 风景, 大海, 自然" style="width:100%;font-size:0.9em;">
            </div>
            <div>
                <div style="font-size:0.85em;font-weight:500;margin-bottom:2px;">共用匹配内容</div>
                <textarea id="mc-batch-content" class="text_pole" rows="3" placeholder="所有文件共用此匹配内容（用于关键词评分）" style="width:100%;resize:vertical;font-size:0.9em;"></textarea>
            </div>
        </div>
    </div>`);

    const popup = callGenericPopup(popupContent, POPUP_TYPE.TEXT, '', {
        okButton: '确认添加',
        cancelButton: '取消',
        allowVerticalScrolling: true,
        wide: false,
    });

    // 选择文件按钮 → 调用文件管理器弹窗
    $('#mc-batch-select-btn').on('click', async function () {
        const entries = await showFilePickerPopup({ title: '选择文件批量添加到匹配打分', multiSelect: true });
        if (!entries || entries.length === 0) return;
        for (const entry of entries) {
            const fp = entry.fullServerPath;
            if (!fp) continue;
            // 去重
            if (selectedEntries.some(e => e.entry.fullServerPath === fp)) continue;
            selectedEntries.push({ entry, fileUrl: fp.startsWith('/') ? fp : '/' + fp });
        }
        renderBatchThumbs();
    });

    function renderBatchThumbs() {
        const container = $('#mc-batch-thumb-list');
        $('#mc-batch-count').text(selectedEntries.length);
        if (selectedEntries.length === 0) {
            container.html('<span style="opacity:0.4;font-size:0.85em;">暂无文件</span>');
            return;
        }
        container.empty();
        selectedEntries.forEach((item, index) => {
            const entry = item.entry;
            const isVideo = entry.type === 'video';
            const thumb = $(`
                <div class="mc-batch-thumb-item" data-index="${index}">
                    ${isVideo
                        ? `<video src="${escapeHtml(item.fileUrl)}" style="width:60px;height:60px;object-fit:cover;border-radius:4px;border:1px solid var(--borderColor);" muted></video>`
                        : `<img class="mc-batch-thumb" src="${escapeHtml(item.fileUrl)}" title="${escapeHtml(entry.displayName || '')}">`
                    }
                    <span class="mc-batch-thumb-del" data-index="${index}">×</span>
                    <div style="font-size:0.6em;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:60px;">${escapeHtml(entry.displayName || '未命名')}</div>
                </div>
            `);
            thumb.find('.mc-batch-thumb-del').on('click', function () {
                selectedEntries.splice(index, 1);
                renderBatchThumbs();
            });
            container.append(thumb);
        });
    }

    const result = await popup;

    if (!result) return;

    if (selectedEntries.length === 0) {
        toastr.warning('请至少选择一个文件');
        return;
    }

    const displayName = $('#mc-batch-display-name').val()?.trim() || '';
    const tags = $('#mc-batch-tags').val()?.trim() || '';
    const content = $('#mc-batch-content').val()?.trim() || '';
    const tagList = tags ? tags.split(/[,，、\s]+/).map(t => t.trim()).filter(Boolean) : [];

const data = getMatchScoringData();

    for (const item of selectedEntries) {
        const entry = item.entry;
        const fp = entry.fullServerPath;
        if (!fp) continue;
        data.files.push({
            id: generateId('ms'),
            filePath: fp,
            displayName: displayName || entry.displayName || '未命名',
            type: entry.type || 'image',
            enabled: true,
            weight: 1,
            content: content,
            tags: tags,
            tagList: tagList,
            ngramIndex: null,
            uploadDate: Date.now(),
        });
    }

    saveSettings();
    toastr.success(`已添加 ${selectedEntries.length} 个文件到匹配打分`);

    // 刷新文件列表
    const { renderFileDisplay, bindFileDisplayEvents } = await import('../file-display.js');
    renderFileDisplay();
    bindFileDisplayEvents();
}
