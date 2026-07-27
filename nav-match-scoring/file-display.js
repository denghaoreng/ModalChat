// nav-match-scoring/file-display.js — 匹配打分文件列表（完整版）

import { getMatchScoringData, saveSettings } from '../core/data.js';
import { currentSettings } from '../core/data.js';
import { escapeHtml, formatFileSize, debounce, generateId, AUDIO_EXTS, VIDEO_EXTS, detectFileType } from '../shared/utils.js';
import { cleanupStaleExtraRefs } from './match-chat-results.js';
import { showTagFilterPopup, showBatchAddPopup } from './popup-config.js';
import { callGenericPopup } from '../../../../popup.js';
import { getLastResults } from './scorer.js';
import { showFileEnlarge } from '../shared/file-enlarge.js';
import { showFilePickerPopup } from '../nav-file-manager/file-picker-popup.js';

const POPUP_TYPE = Object.freeze({ TEXT: 1, CONFIRM: 2, INPUT: 3, DISPLAY: 4 });

let msCurrentPage = 1;
let msSelectedIds = new Set();
let msSelectAllOn = false;

export async function renderFileDisplay() {
    const $panel = $('#mc-ms-files-panel');
    if (!$panel.length) return;

    const data = getMatchScoringData();
    let files = data.files || [];
    const lastResults = getLastResults() || [];
    const scoreMap = {};
    lastResults.forEach(item => { scoreMap[item.file.id] = item.totalScore; });

    const filterStatus = $('#mc-ms-filter-status').val() || 'all';
    const filterType = $('#mc-ms-filter-type').val() || 'all';
    const sortBy = $('#mc-ms-sort').val() || 'newest';

    if (filterStatus === 'enabled') files = files.filter(f => f.enabled !== false);
    else if (filterStatus === 'disabled') files = files.filter(f => f.enabled === false);

    if (filterType === 'image' || filterType === 'video' || filterType === 'audio') {
        files = files.filter(f => f.type === filterType);
    }

    // 搜索过滤
    const searchTerm = ($('#mc-ms-search').val() || '').toLowerCase().trim();
    if (searchTerm) {
        files = files.filter(f =>
            (f.displayName && f.displayName.toLowerCase().includes(searchTerm)) ||
            (f.tags && f.tags.toLowerCase().includes(searchTerm)) ||
            (f.content && f.content.toLowerCase().includes(searchTerm))
        );
    }

    files = files.map(f => ({ ...f, _score: scoreMap[f.id] || 0 }));

    if (sortBy === 'newest') files.sort((a, b) => (b.uploadDate || 0) - (a.uploadDate || 0));
    else if (sortBy === 'oldest') files.sort((a, b) => (a.uploadDate || 0) - (b.uploadDate || 0));
    else if (sortBy === 'name_asc') files.sort((a, b) => (a.displayName || '').localeCompare(b.displayName || ''));
    else if (sortBy === 'name_desc') files.sort((a, b) => (b.displayName || '').localeCompare(a.displayName || ''));
    else if (sortBy === 'score_desc') files.sort((a, b) => (b._score || 0) - (a._score || 0));
    else if (sortBy === 'score_asc') files.sort((a, b) => (a._score || 0) - (b._score || 0));

    const pageSize = parseInt($('#mc-ms-page-size').val()) || data.filePageSize || 10;
    data.filePageSize = pageSize;
    const totalPages = Math.max(1, Math.ceil(files.length / pageSize));
    if (msCurrentPage > totalPages) msCurrentPage = totalPages;
    const start = (msCurrentPage - 1) * pageSize;
    const pageFiles = files.slice(start, start + pageSize);

    const pageIds = new Set(pageFiles.map(f => f.id));
    for (const id of msSelectedIds) { if (!pageIds.has(id)) msSelectedIds.delete(id); }

    // 工具栏
    let html = '<div style="display:flex;gap:4px;margin-bottom:4px;flex-wrap:wrap;align-items:center;">';
    html += `<button id="mc-ms-upload-btn" class="menu_button" style="font-size:0.82em;white-space:nowrap;"><i class="fa-solid fa-upload"></i> 上传文件</button>`;
    html += `<button id="mc-ms-batch-add" class="menu_button" style="font-size:0.82em;white-space:nowrap;"><i class="fa-solid fa-plus-circle"></i> 批量新增</button>`;
    html += `<button id="mc-ms-select-all-btn" class="menu_button" style="font-size:0.82em;white-space:nowrap;"><i class="fa-solid ${msSelectAllOn ? 'fa-check-square' : 'fa-square'}"></i> ${msSelectAllOn ? '取消全选' : '全选择'}</button>`;
    html += `<button id="mc-ms-batch-edit" class="menu_button" style="font-size:0.82em;white-space:nowrap;"><i class="fa-solid fa-edit"></i> 批量修改</button>`;
    html += `<button id="mc-ms-tag-filter" class="menu_button" style="font-size:0.82em;white-space:nowrap;"><i class="fa-solid fa-tags"></i> 标签筛选</button>`;
    html += `<button id="mc-ms-settings" class="menu_button" style="font-size:0.82em;white-space:nowrap;" title="网格设置"><i class="fa-solid fa-gear"></i></button>`;
    html += '</div>';

    // 筛选行
    html += '<div style="display:flex;gap:6px;margin-bottom:4px;flex-wrap:wrap;align-items:center;font-size:0.82em;">';
    html += `<input id="mc-ms-search" class="text_pole" type="text" placeholder="搜索文件..." value="${escapeHtml($('#mc-ms-search').val() || '')}" style="flex:1;min-width:100px;font-size:0.9em;padding:2px 6px;">`;
    html += `<select id="mc-ms-filter-status" class="text_pole" style="padding:2px 4px;width:auto;">
        <option value="all" ${filterStatus==='all'?'selected':''}>全部</option>
        <option value="enabled" ${filterStatus==='enabled'?'selected':''}>已启用</option>
        <option value="disabled" ${filterStatus==='disabled'?'selected':''}>未启用</option>
    </select>`;
    html += `<select id="mc-ms-filter-type" class="text_pole" style="padding:2px 4px;width:auto;">
        <option value="all" ${filterType==='all'?'selected':''}>全部类型</option>
        <option value="image" ${filterType==='image'?'selected':''}>🖼️ 图片</option>
        <option value="video" ${filterType==='video'?'selected':''}>🎬 视频</option>
        <option value="audio" ${filterType==='audio'?'selected':''}>🎵 音频</option>
    </select>`;
    html += `<select id="mc-ms-sort" class="text_pole" style="padding:2px 4px;width:auto;">
        <option value="newest" ${sortBy==='newest'?'selected':''}>最新 ↑</option>
        <option value="oldest" ${sortBy==='oldest'?'selected':''}>最旧 ↑</option>
        <option value="name_asc" ${sortBy==='name_asc'?'selected':''}>名称 ↑</option>
        <option value="name_desc" ${sortBy==='name_desc'?'selected':''}>名称 ↓</option>
        <option value="score_desc" ${sortBy==='score_desc'?'selected':''}>分数 ↓</option>
        <option value="score_asc" ${sortBy==='score_asc'?'selected':''}>分数 ↑</option>
    </select>`;
    html += '</div>';

    // 分页（放在搜索框和文件列表之间）
    html += `<div style="display:flex;align-items:center;gap:8px;justify-content:center;margin-bottom:6px;font-size:0.82em;">
        <button id="mc-ms-page-prev" class="menu_button" style="font-size:0.8em;white-space:nowrap;writing-mode:horizontal-tb;" ${msCurrentPage <= 1 ? 'disabled' : ''}>◀ 上一页</button>
        <span>${msCurrentPage}/${totalPages}</span>
        <button id="mc-ms-page-next" class="menu_button" style="font-size:0.8em;white-space:nowrap;writing-mode:horizontal-tb;" ${msCurrentPage >= totalPages ? 'disabled' : ''}>下一页 ▶</button>
        <span>每页</span>
        <select id="mc-ms-page-size" class="text_pole" style="padding:2px 4px;width:auto;font-size:0.9em;">
            <option value="5" ${pageSize===5?'selected':''}>5</option>
            <option value="10" ${pageSize===10?'selected':''}>10</option>
            <option value="20" ${pageSize===20?'selected':''}>20</option>
            <option value="50" ${pageSize===50?'selected':''}>50</option>
        </select>
        <span>个</span>
        <span style="font-size:0.8em;color:var(--grey40);">共 ${files.length} 个</span>
    </div>`;

    // 文件列表
    if (pageFiles.length === 0) {
        const hasSearch = ($('#mc-ms-search').val() || '').trim();
        html += `<div style="padding:20px;text-align:center;color:var(--grey40);font-size:0.85em;">${hasSearch ? '没有匹配的文件' : '还没有文件，点击上方"上传文件"按钮添加'}</div>`;
    } else {
        const cardWidth = data.cardWidth || 120;
        html += `<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(${cardWidth}px,1fr));gap:6px;">`;
        for (const f of pageFiles) {
            const fileUrl = f.filePath || '';
            if (!fileUrl) continue;
            const score = f._score || 0;
            const enabled = f.enabled !== false;
            const checked = msSelectedIds.has(f.id) ? 'checked' : '';
            // 根据扩展名补充类型检测（兼容旧数据中类型标注错误）
            const effectiveType = (f.type === 'video' || f.type === 'audio') ? f.type : detectFileType(f.filePath);
            const typeIcon = effectiveType === 'video' ? 'fa-video' : effectiveType === 'audio' ? 'fa-music' : 'fa-image';
            const thumbH = data.cardHeight || 80;
            const cardFs = (data.cardFontSize || 80) + '%';
            html += `
            <div class="mc-ms-file-card" data-id="${escapeHtml(f.id)}" style="border:1px solid var(--borderColor);border-radius:6px;padding:6px;background:var(--solidBackground);font-size:${cardFs};${enabled ? '' : 'opacity:0.5;'}">
                <div style="display:flex;align-items:flex-start;gap:4px;margin-bottom:4px;">
                    <input type="checkbox" class="mc-ms-select-cb" data-id="${escapeHtml(f.id)}" ${checked} style="margin-top:3px;width:14px;height:14px;flex-shrink:0;">
                    <div style="flex:1;height:${thumbH}px;overflow:hidden;border-radius:4px;background:var(--bg);display:flex;align-items:center;justify-content:center;">
                        ${effectiveType === 'video'
                            ? `<video src="${escapeHtml(fileUrl)}" class="mc-ms-file-thumb" style="max-width:100%;max-height:100%;border-radius:4px;cursor:pointer;" muted></video>`
                            : effectiveType === 'audio'
                                ? `<div class="mc-ms-file-thumb" data-src="${escapeHtml(fileUrl)}" style="font-size:${Math.round(thumbH * 0.5)}px;color:var(--grey40);cursor:pointer;"><i class="fa-solid fa-music"></i></div>`
                                : `<img src="${escapeHtml(fileUrl)}" class="mc-ms-file-thumb" style="max-width:100%;max-height:100%;border-radius:4px;object-fit:contain;cursor:pointer;">`
                        }
                    </div>
                    <span style="flex-shrink:0;margin-top:3px;font-size:0.75em;color:white;background:rgba(0,0,0,0.5);border-radius:3px;padding:2px 5px;line-height:1.2;"><i class="fa-solid ${typeIcon}"></i></span>
                </div>
                <div style="text-align:center;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;margin-bottom:2px;font-size:0.78em;" title="${escapeHtml(f.displayName || '')}">${score > 0 ? `<span style="color:#ffd700;flex-shrink:0;margin-right:3px;">⭐${score.toFixed(1)}</span>` : ''}${escapeHtml(f.displayName || '未命名')}</div>
                <div style="display:flex;align-items:center;gap:4px;margin:3px 0;font-size:0.7em;">
                    <span style="color:var(--grey40);white-space:nowrap;">权重</span>
                    <input type="range" class="mc-ms-file-weight" data-id="${escapeHtml(f.id)}" value="${f.weight ?? 1}" min="0" max="5" step="0.1" style="flex:1;height:3px;">
                    <span class="mc-ms-wv" style="min-width:20px;text-align:right;font-weight:bold;color:var(--primary);">${(f.weight ?? 1).toFixed(1)}</span>
                </div>
                <div style="display:flex;gap:4px;justify-content:center;font-size:0.72em;">
                    <button class="mc-ms-file-edit menu_button menu_button_icon" data-id="${escapeHtml(f.id)}" title="编辑">
                        <i class="fa-solid fa-pen-to-square"></i>
                    </button>
                    <button class="mc-ms-file-toggle menu_button menu_button_icon" data-id="${escapeHtml(f.id)}" title="${enabled ? '禁用' : '启用'}">
                        <i class="fa-solid ${enabled ? 'fa-toggle-on' : 'fa-toggle-off'}"></i>
                    </button>
                    <button class="mc-ms-file-remove menu_button menu_button_icon" data-id="${escapeHtml(f.id)}" title="删除" style="color:var(--dangerColor);">
                        <i class="fa-solid fa-trash-can"></i>
                    </button>
                </div>
            </div>`;
        }
        html += '</div>';
    }

    $panel.html(html);
}

let _eventsBound = false;

export function bindFileDisplayEvents() {
    if (_eventsBound) return;
    _eventsBound = true;
    // 缩略图点击全屏查看（图片/视频用 src，音频图标用 data-src）
    $(document).off('click', '.mc-ms-file-thumb').on('click', '.mc-ms-file-thumb', function () {
        const src = $(this).attr('src') || $(this).data('src');
        if (src) showFileEnlarge(src);
    });

    // 上传文件（弹出文件管理器弹窗 → 选择已有文件 → 添加到匹配打分列表）
    // 只存 filePath 引用，不处理文件上传，实现文件复用
    $(document).off('click', '#mc-ms-upload-btn').on('click', '#mc-ms-upload-btn', async function () {
        const entries = await showFilePickerPopup({ title: '选择文件添加到匹配打分', multiSelect: true });
        if (!entries || entries.length === 0) return;
        const data = getMatchScoringData();
        for (const entry of entries) {
            const fp = entry.fullServerPath;
            if (!fp) continue;
            data.files.push({
                id: generateId('ms'),
                filePath: fp,
                displayName: entry.displayName || '未命名',
                type: entry.type || 'image',
                enabled: true, weight: 1, content: '', tags: '', tagList: [], ngramIndex: null,
                uploadDate: Date.now(),
            });
        }
        toastr.success(`已添加 ${entries.length} 个文件到匹配打分`);
        saveSettings(); renderFileDisplay(); bindFileDisplayEvents();
    });

    // 批量新增（弹出批量新增弹窗：从文件管理器选择 + 共用名称/标签/内容）
    $(document).off('click', '#mc-ms-batch-add').on('click', '#mc-ms-batch-add', function () {
        showBatchAddPopup();
    });

    // 全选/全不选
    $(document).off('click', '#mc-ms-select-all-btn').on('click', '#mc-ms-select-all-btn', function () {
        msSelectAllOn = !msSelectAllOn;
        if (msSelectAllOn) {
            $('.mc-ms-select-cb').each(function () { msSelectedIds.add($(this).data('id')); });
        } else {
            msSelectedIds.clear();
        }
        renderFileDisplay(); bindFileDisplayEvents();
    });

    // 批量修改
    $(document).off('click', '#mc-ms-batch-edit').on('click', '#mc-ms-batch-edit', async function () {
        const ids = [...msSelectedIds];
        if (ids.length === 0) { toastr.error('请先勾选文件'); return; }
        const html = `<div style="padding:8px;">
            <div style="font-size:1.1em;font-weight:bold;margin-bottom:12px;">批量修改（${ids.length} 个文件）</div>
            <div style="margin-bottom:12px;">
                <label style="display:block;margin-bottom:4px;">批量启用/禁用：</label>
                <select id="mc-batch-enable" class="text_pole" style="width:100%;">
                    <option value="">保持不变</option>
                    <option value="true">启用</option>
                    <option value="false">禁用</option>
                </select>
            </div>
            <div style="border-top:1px solid var(--borderColor);padding-top:12px;">
                <button id="mc-batch-del" class="menu_button" style="color:var(--dangerColor);white-space:nowrap;">删除选中的 ${ids.length} 个文件</button>
            </div>
        </div>`;
        $(document).off('click', '#mc-batch-del').on('click', '#mc-batch-del', async function () {
            const ok = await callGenericPopup(`<p>确定删除 ${ids.length} 个文件？</p>`, POPUP_TYPE.CONFIRM, '', { okButton: '删除', cancelButton: '取消' });
            if (ok) {
                const data = getMatchScoringData();
                for (const id of ids) {
                    data.files = data.files.filter(f => f.id !== id);
                    cleanupStaleExtraRefs(id);
                }
                msSelectedIds.clear();
                saveSettings(); renderFileDisplay(); bindFileDisplayEvents();
                $(this).closest('.popup').find('.popup-button-close').click();
            }
        });
        await callGenericPopup(html, POPUP_TYPE.DISPLAY, '', { okButton: '关闭' });
        const enableVal = $('#mc-batch-enable').val();
        if (enableVal !== '') {
            const data = getMatchScoringData();
            for (const id of ids) {
                const f = data.files.find(f => f.id === id);
                if (f) f.enabled = enableVal === 'true';
            }
            saveSettings(); renderFileDisplay(); bindFileDisplayEvents();
        }
        $(document).off('click', '#mc-batch-del');
    });

    // 标签筛选
    $(document).off('click', '#mc-ms-tag-filter').on('click', '#mc-ms-tag-filter', function () {
        showTagFilterPopup();
    });

    // 网格设置
    $(document).off('click', '#mc-ms-settings').on('click', '#mc-ms-settings', async function () {
        const data = getMatchScoringData();
        let formWidth = String(data.cardWidth || 120);
        let formHeight = String(data.cardHeight || 80);
        let formFontSize = String(data.cardFontSize || 80);
        const html = `<div style="padding:8px;min-width:250px;">
            <div style="font-size:1.1em;font-weight:bold;margin-bottom:12px;border-bottom:1px solid var(--borderColor);padding-bottom:8px;"><i class="fa-solid fa-gear"></i> 网格设置</div>
            <div style="margin-bottom:10px;">
                <label style="display:block;margin-bottom:4px;font-size:0.85em;color:var(--grey40);">格子宽度（px）</label>
                <input id="mc-ms-set-width" class="text_pole" type="number" value="${formWidth}" min="60" max="500" step="10" style="width:100px;font-size:0.9em;">
            </div>
            <div style="margin-bottom:10px;">
                <label style="display:block;margin-bottom:4px;font-size:0.85em;color:var(--grey40);">格子高度（px）</label>
                <input id="mc-ms-set-height" class="text_pole" type="number" value="${formHeight}" min="40" max="400" step="10" style="width:100px;font-size:0.9em;">
            </div>
            <div style="margin-bottom:4px;">
                <label style="display:block;margin-bottom:4px;font-size:0.85em;color:var(--grey40);">名称/权重字体大小（%）</label>
                <input id="mc-ms-set-fontsize" class="text_pole" type="number" value="${formFontSize}" min="50" max="150" step="5" style="width:100px;font-size:0.9em;">
                <div style="font-size:0.75em;color:var(--grey40);margin-top:2px;">默认 80%</div>
            </div>
        </div>`;
        $(document).on('input', '#mc-ms-set-width', function () { formWidth = $(this).val() || '120'; });
        $(document).on('input', '#mc-ms-set-height', function () { formHeight = $(this).val() || '80'; });
        $(document).on('input', '#mc-ms-set-fontsize', function () { formFontSize = $(this).val() || '80'; });
        const result = await callGenericPopup(html, POPUP_TYPE.TEXT, '', { okButton: '保存', cancelButton: '取消' });
        $(document).off('input', '#mc-ms-set-width');
        $(document).off('input', '#mc-ms-set-height');
        $(document).off('input', '#mc-ms-set-fontsize');
        if (result) {
            const w = parseInt(formWidth);
            const h = parseInt(formHeight);
            const fs = parseInt(formFontSize);
            if (w >= 60 && w <= 500) data.cardWidth = w;
            if (h >= 40 && h <= 400) data.cardHeight = h;
            if (fs >= 50 && fs <= 150) data.cardFontSize = fs;
            saveSettings();
            renderFileDisplay(); bindFileDisplayEvents();
        }
    });

    // 筛选/排序变更
    $(document).off('change', '#mc-ms-filter-status, #mc-ms-filter-type, #mc-ms-sort, #mc-ms-page-size').on('change', '#mc-ms-filter-status, #mc-ms-filter-type, #mc-ms-sort, #mc-ms-page-size', function () {
        msCurrentPage = 1;
        renderFileDisplay(); bindFileDisplayEvents();
    });

    // 搜索输入（防抖）
    let _searchTimer = null;
    $(document).off('input', '#mc-ms-search').on('input', '#mc-ms-search', function () {
        clearTimeout(_searchTimer);
        _searchTimer = setTimeout(() => {
            msCurrentPage = 1;
            renderFileDisplay(); bindFileDisplayEvents();
        }, 300);
    });

    // 结果展示数量变更
    $(document).off('change', '#mc-ms-results-limit').on('change', '#mc-ms-results-limit', async function () {
        const val = parseInt($(this).val()) || 10;
        const data = getMatchScoringData();
        data.resultsDisplayLimit = val;
        saveSettings();
        const { getLastResults } = await import('./scorer.js');
        const last = getLastResults();
        if (last && last.length > 0) {
            const { renderResultsPanel } = await import('./match-chat-results.js');
            renderResultsPanel(last);
        }
    });

    // 选择框
    $(document).off('change', '.mc-ms-select-cb').on('change', '.mc-ms-select-cb', function () {
        const id = $(this).data('id');
        if ($(this).is(':checked')) msSelectedIds.add(id);
        else { msSelectedIds.delete(id); msSelectAllOn = false; }
    });

    // 启用/禁用（切换按钮）
    $(document).off('click', '.mc-ms-file-toggle').on('click', '.mc-ms-file-toggle', function () {
        const id = $(this).data('id');
        const data = getMatchScoringData();
        const f = data.files.find(f => f.id === id);
        if (f) {
            f.enabled = !f.enabled;
            saveSettings();
            renderFileDisplay(); bindFileDisplayEvents();
        }
    });

    // 权重
    let _wt = {};
    $(document).off('input', '.mc-ms-file-weight').on('input', '.mc-ms-file-weight', function () {
        const id = $(this).data('id');
        const val = parseFloat($(this).val());
        $(this).closest('.mc-ms-file-card').find('.mc-ms-wv').text(val.toFixed(1));
        clearTimeout(_wt[id]); _wt[id] = setTimeout(() => {
            const data = getMatchScoringData();
            const f = data.files.find(f => f.id === id);
            if (f) { f.weight = val; saveSettings(); }
        }, 300);
    });

    // 编辑（使用 POPUP_TYPE.TEXT + 实时追踪，避免弹窗关闭后 DOM 销毁无法读取值）
    $(document).off('click', '.mc-ms-file-edit').on('click', '.mc-ms-file-edit', async function () {
        const id = $(this).data('id');
        const data = getMatchScoringData();
        const f = data.files.find(f => f.id === id);
        if (!f) return;
        let formName = f.displayName || '';
        let formTags = f.tags || '';
        let formContent = f.content || '';
        let formWeight = String(f.weight ?? 1);
        const html = `<div style="padding:8px;min-width:320px;">
            <div style="font-size:1.1em;font-weight:bold;margin-bottom:12px;border-bottom:1px solid var(--borderColor);padding-bottom:8px;">✏️ 编辑文件</div>
            <div style="text-align:center;margin-bottom:10px;background:var(--white10);border-radius:6px;padding:6px;">
                ${f.type === 'video'
                    ? `<video src="${escapeHtml(f.filePath || '')}" style="max-width:100%;max-height:100px;border-radius:4px;" controls></video>`
                    : `<img src="${escapeHtml(f.filePath || '')}" style="max-width:100%;max-height:100px;border-radius:4px;object-fit:contain;">`
                }
            </div>
            <div style="margin-bottom:8px;">
                <label style="display:block;margin-bottom:3px;font-size:0.85em;font-weight:500;color:var(--grey40);">显示名称</label>
                <input id="mc-edit-name" class="text_pole" type="text" value="${escapeHtml(formName)}" style="width:100%;font-size:0.9em;">
            </div>
            <div style="margin-bottom:8px;">
                <label style="display:block;margin-bottom:3px;font-size:0.85em;font-weight:500;color:var(--grey40);">标签（每行一个，或逗号分隔，支持正则）</label>
                <textarea id="mc-edit-tags" class="text_pole" style="width:100%;min-height:60px;font-size:0.9em;resize:vertical;">${escapeHtml(formTags)}</textarea>
            </div>
            <div style="margin-bottom:8px;">
                <label style="display:block;margin-bottom:3px;font-size:0.85em;font-weight:500;color:var(--grey40);">匹配内容</label>
                <textarea id="mc-edit-content" class="text_pole" style="width:100%;min-height:60px;font-size:0.9em;resize:vertical;" placeholder="描述文件中包含的元素、场景、动作…">${escapeHtml(formContent)}</textarea>
            </div>
            <div style="margin-bottom:4px;">
                <label style="display:block;margin-bottom:3px;font-size:0.85em;font-weight:500;color:var(--grey40);">权重（0～5）</label>
                <input id="mc-edit-weight" class="text_pole" type="number" value="${formWeight}" min="0" max="5" step="0.1" style="width:80px;font-size:0.9em;">
            </div>
        </div>`;
        // 实时追踪表单值（弹窗关闭后 DOM 会销毁）
        $(document).on('input', '#mc-edit-name', function () { formName = $(this).val() || ''; });
        $(document).on('input', '#mc-edit-tags', function () { formTags = $(this).val() || ''; });
        $(document).on('input', '#mc-edit-content', function () { formContent = $(this).val() || ''; });
        $(document).on('input', '#mc-edit-weight', function () { formWeight = $(this).val() || '1'; });
        const result = await callGenericPopup(html, POPUP_TYPE.TEXT, '', { okButton: '保存', cancelButton: '取消' });
        $(document).off('input', '#mc-edit-name');
        $(document).off('input', '#mc-edit-tags');
        $(document).off('input', '#mc-edit-content');
        $(document).off('input', '#mc-edit-weight');
        if (result) {
            const newName = formName.trim();
            const newTags = formTags.trim();
            const newContent = formContent.trim();
            const newWeight = parseFloat(formWeight);
            if (newName) f.displayName = newName;
            f.tags = newTags;
            f.tagList = newTags ? newTags.split(/[,，、\s]+/).map(t => t.trim()).filter(Boolean) : [];
            f.content = newContent;
            f.ngramIndex = null; // 标记重建（scorer 会在下次评分时用 content 重建）
            if (!isNaN(newWeight) && newWeight >= 0 && newWeight <= 5) f.weight = newWeight;
            saveSettings(); renderFileDisplay(); bindFileDisplayEvents();
        }
    });

    // 移除
    $(document).off('click', '.mc-ms-file-remove').on('click', '.mc-ms-file-remove', function () {
        const id = $(this).data('id');
        const data = getMatchScoringData();
        data.files = data.files.filter(f => f.id !== id);
        cleanupStaleExtraRefs(id);
        msSelectedIds.delete(id);
        saveSettings(); renderFileDisplay(); bindFileDisplayEvents();
    });

    // 分页
    $(document).off('click', '#mc-ms-page-prev').on('click', '#mc-ms-page-prev', function () {
        if (msCurrentPage > 1) { msCurrentPage--; renderFileDisplay(); bindFileDisplayEvents(); }
    });
    $(document).off('click', '#mc-ms-page-next').on('click', '#mc-ms-page-next', function () {
        msCurrentPage++; renderFileDisplay(); bindFileDisplayEvents();
    });
}
