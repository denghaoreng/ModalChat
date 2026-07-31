// nav-file-manager/file-render.js — 文件管理器渲染

import { currentSettings, getGeneralSettings } from '../core/data.js';
import { escapeHtml, formatFileSize, formatDate, naturalCompare } from '../shared/utils.js';
import { getTypeLabel, getFileIcon } from '../shared/file-icons.js';
import {
    currentDir, selectedFiles,
    fmCurrentPage, fmSortBy, fmSortDesc, fmViewMode, fmSearchMode, fmSearchTriggered,
    FM_PAGE_SIZE,
    activeRenderTarget,
    setFmCurrentPage, setFmSearchTriggered, setFmViewMode,
} from './file-state.js';

/**
 * 渲染文件管理器
 * @param {string|jQuery} [target] - 可选的目标容器（选择器或 jQuery 元素），不传则使用活动目标或 #mc-file-manager-panel
 */
export async function renderFileManager(target) {
    const $panel = target ? $(target) : (activeRenderTarget ? $(activeRenderTarget) : $('#mc-file-manager-panel'));
    if (!$panel.length) return;

    // 切换视图时清除选中状态
    selectedFiles.clear();
    const _savedSearch = $panel.find('#mc-file-search').val() || '';

    // 异步加载文件
    const { getFilesInDirectory } = await import('../shared/file-service.js');

    // 收集需要搜索的目录
    function collectDirs(root) {
        const result = [];
        if (currentSettings.directories) {
            for (const d of currentSettings.directories) {
                if (d === root || d === '/') continue;
                if (!d.startsWith(root)) continue;
                result.push(d);
            }
        }
        return result;
    }
    const dirsToLoad = [currentDir];
    if (fmSearchTriggered && fmSearchMode === 'full') {
        dirsToLoad.push(...collectDirs(currentDir));
    }

    // 并行加载所有目录文件
    const fileResults = await Promise.all(dirsToLoad.map(d => getFilesInDirectory(d).catch(() => [])));
    const loadedFiles = fileResults.flat();

    // 构建目录树（只显示直接子文件夹）
    let allEntries = [...loadedFiles];
    if (currentSettings.directories) {
        for (const d of currentSettings.directories) {
            if (d === currentDir || d === '/') continue;
            if (!d.startsWith(currentDir)) continue;
            const rel = d.slice(currentDir.length).replace(/\/$/, '');
            if (rel && !rel.includes('/')) {
                allEntries.push({
                    _isDir: true,
                    id: '_dir_' + d,
                    displayName: rel,
                    type: 'folder',
                    fileSize: 0,
                    source: 'folder',
                    uploadDate: '',
                    directory: currentDir,
                    dirPath: d,
                });
            }
        }
    }

    // 搜索过滤
    let searchQ = '';
    const triggered = fmSearchTriggered;
    if (triggered) {
        searchQ = _savedSearch.toLowerCase().trim();
        setFmSearchTriggered(false);
    }
    if (searchQ) {
        allEntries = allEntries.filter(f =>
            (f.displayName && f.displayName.toLowerCase().includes(searchQ)) ||
            (f.serverFilename && f.serverFilename.toLowerCase().includes(searchQ)) ||
            (f.originalName && f.originalName.toLowerCase().includes(searchQ))
        );
    }
    // 排序
    const _sortBy = fmSortBy === 'uploadDate' ? 'uploadDate' : fmSortBy === 'fileSize' ? 'fileSize' : fmSortBy === 'type' ? '_sortType' : 'displayName';
    allEntries.sort(function (a, b) {
        const va = _sortBy === '_sortType' ? getTypeLabel(a) : a[_sortBy] || '';
        const vb = _sortBy === '_sortType' ? getTypeLabel(b) : b[_sortBy] || '';
        if (typeof va === 'string') { const c = naturalCompare(va, vb); return fmSortDesc ? -c : c; }
        return fmSortDesc ? vb - va : va - vb;
    });
    const totalPages = Math.max(1, Math.ceil(allEntries.length / FM_PAGE_SIZE));
    if (fmCurrentPage > totalPages) setFmCurrentPage(totalPages);
    const start = (fmCurrentPage - 1) * FM_PAGE_SIZE;
    const entries = allEntries.slice(start, start + FM_PAGE_SIZE);

    // 构建面包屑导航
    const pathParts = currentDir.split('/').filter(Boolean);
    let breadHtml = '<span class="mc-bread-item" data-path="/" style="cursor:pointer;color:var(--primary);font-size:0.85em;">根目录</span>';
    let accumulated = '';
    for (const part of pathParts) {
        accumulated += '/' + part;
        breadHtml += ` <span style="color:var(--grey40);font-size:0.85em;">›</span> <span class="mc-bread-item" data-path="${escapeHtml(accumulated + '/')}" style="cursor:pointer;color:var(--primary);font-size:0.85em;">${escapeHtml(part)}</span>`;
    }

    // 构建文件列表 HTML
    let fileListHtml = '';
    if (entries.length === 0) {
        fileListHtml = '<div style="padding:20px;text-align:center;color:var(--grey40);font-size:0.85em;">此目录为空</div>';
    } else if (fmViewMode === 'simple') {
        fileListHtml = '<div style="font-size:0.85em;">';
        for (const entry of entries) {
            if (entry._isDir) {
                fileListHtml += `<div class="mc-dir-row" data-path="${escapeHtml(entry.dirPath)}" style="padding:6px 8px;border-bottom:1px solid var(--borderColor);cursor:pointer;display:flex;align-items:center;gap:8px;">
                    <span>📁</span><span>${escapeHtml(entry.displayName)}</span>
                </div>`;
            } else {
                const _checked = selectedFiles.has(entry.id) ? 'checked' : '';
                fileListHtml += `<div class="mc-file-row" data-id="${escapeHtml(entry.id)}" style="padding:6px 8px;border-bottom:1px solid var(--borderColor);display:flex;align-items:center;gap:8px;">
                    <input type="checkbox" class="mc-file-checkbox" data-id="${escapeHtml(entry.id)}" ${_checked} style="width:14px;height:14px;">
                    <span>${getFileIcon(entry)}</span>
                    <span style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${escapeHtml(entry.displayName || '未命名')}">${escapeHtml(entry.displayName || '未命名')}</span>
                    <span style="font-size:0.8em;color:var(--grey40);">${formatFileSize(entry.fileSize)}</span>
                    <span style="display:inline-flex;gap:4px;">
                        <button class="mc-file-detail menu_button menu_button_icon" data-id="${escapeHtml(entry.id)}" title="查看详情"><i class="fa-solid fa-info-circle"></i></button>
                        <button class="mc-file-delete menu_button menu_button_icon" data-id="${escapeHtml(entry.id)}" title="删除" style="color:var(--dangerColor);"><i class="fa-solid fa-trash-can"></i></button>
                    </span>
                </div>`;
            }
        }
        fileListHtml += '</div>';
    } else if (fmViewMode === 'grid') {
        const _thumbGrid = getGeneralSettings().gridThumbnailSize || 80;
        fileListHtml = '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(' + (_thumbGrid + 20) + 'px,1fr));gap:8px;padding:4px;">';
        for (const entry of entries) {
            if (entry._isDir) {
                fileListHtml += `<div class="mc-dir-row" data-path="${escapeHtml(entry.dirPath)}" style="cursor:pointer;text-align:center;padding:8px;border:1px solid var(--borderColor);border-radius:6px;">
                    <div style="font-size:2em;">📁</div>
                    <div style="font-size:0.8em;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${escapeHtml(entry.displayName)}</div>
                </div>`;
            } else {
                const _ext = (entry.serverFilename || '').split('.').pop().toLowerCase();
                const _isImg = ['png','jpg','jpeg','gif','webp','bmp','svg'].includes(_ext);
                const _isVid = ['mp4','webm','avi','mov','mkv','flv'].includes(_ext);
                const _isAud = ['mp3','wav','ogg','flac','aac','m4a','wma'].includes(_ext);
                const _url = entry.fullServerPath ? (entry.fullServerPath.startsWith('/') ? entry.fullServerPath : '/' + entry.fullServerPath) : '';
                let _mediaHtml = `<span style="font-size:2em;">${getFileIcon(entry)}</span>`;
                if (_url) {
                    if (_isImg) _mediaHtml = `<img src="${escapeHtml(_url)}" style="width:100%;aspect-ratio:1;object-fit:cover;border-radius:4px;cursor:pointer;" class="mc-file-thumb" data-src="${escapeHtml(_url)}">`;
                    else if (_isVid) _mediaHtml = `<video src="${escapeHtml(_url)}" style="width:100%;aspect-ratio:1;object-fit:cover;border-radius:4px;cursor:pointer;" class="mc-file-thumb" data-src="${escapeHtml(_url)}" muted></video>`;
                    else if (_isAud) _mediaHtml = `<div style="width:100%;aspect-ratio:1;border-radius:4px;background:rgba(128,128,128,0.15);display:flex;align-items:center;justify-content:center;font-size:2em;cursor:pointer;" class="mc-file-thumb" data-src="${escapeHtml(_url)}">🎵</div>`;
                }
                const _checked = selectedFiles.has(entry.id) ? 'checked' : '';
                fileListHtml += `<div style="text-align:center;padding:4px;border:1px solid var(--borderColor);border-radius:6px;">
                    <div style="position:relative;">
                        <input type="checkbox" class="mc-file-checkbox" data-id="${escapeHtml(entry.id)}" ${_checked} style="position:absolute;top:2px;left:2px;width:14px;height:14px;z-index:1;">
                        <div>${_mediaHtml}</div>
                    </div>
                    <div style="font-size:0.8em;margin-top:4px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${escapeHtml(entry.displayName || '未命名')}">${escapeHtml(entry.displayName || '未命名')}</div>
                    <div style="margin-top:2px;">
                        <button class="mc-file-detail menu_button menu_button_icon" data-id="${escapeHtml(entry.id)}" title="详情" style="font-size:0.75em;"><i class="fa-solid fa-info-circle"></i></button>
                    </div>
                </div>`;
            }
        }
        fileListHtml += '</div>';
    } else {
        // detail view
        fileListHtml = '<table style="width:100%;font-size:0.82em;border-collapse:collapse;">';
        fileListHtml += `<tr style="border-bottom:1px solid var(--borderColor);">
            <th style="padding:4px;width:30px;text-align:center;"><input type="checkbox" id="mc-select-all" style="width:14px;height:14px;"></th>
            <th style="padding:4px;text-align:center;">名称</th>
            <th style="padding:4px;width:60px;text-align:center;">类型</th>
            <th style="padding:4px;width:60px;text-align:center;">大小</th>
            <th style="padding:4px;width:100px;text-align:center;">日期</th>
            <th style="padding:4px;width:90px;text-align:center;">操作</th>
        </tr>`;
        for (const entry of entries) {
            if (entry._isDir) {
                const fm = currentSettings.folderMeta && currentSettings.folderMeta[entry.dirPath];
                const dirDate = fm && fm.createdAt ? formatDate(fm.createdAt) : '—';
                fileListHtml += `<tr class="mc-dir-row" data-path="${escapeHtml(entry.dirPath)}" style="border-bottom:1px solid var(--borderColor);cursor:pointer;height:${(getGeneralSettings().thumbnailSize || 60) + 8}px;">
                    <td style="padding:4px;text-align:center;">📁</td>
                    <td style="padding:4px;max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${escapeHtml(entry.displayName)}"><strong>${escapeHtml(entry.displayName)}</strong></td>
                    <td style="padding:4px;text-align:center;">文件夹</td>
                    <td style="padding:4px;text-align:center;">—</td>
                    <td style="padding:4px;text-align:center;">${dirDate}</td>
                    <td style="padding:4px;text-align:center;">
                        <span style="display:inline-flex;gap:4px;">
                        <button class="mc-dir-detail menu_button menu_button_icon" data-path="${escapeHtml(entry.dirPath)}" title="查看详情"><i class="fa-solid fa-info-circle"></i></button>
                        <button class="mc-dir-rename menu_button menu_button_icon" data-path="${escapeHtml(entry.dirPath)}" title="重命名文件夹"><i class="fa-solid fa-pen"></i></button>
                        <button class="mc-dir-delete menu_button menu_button_icon" data-path="${escapeHtml(entry.dirPath)}" title="删除文件夹" style="color:var(--dangerColor);"><i class="fa-solid fa-trash-can"></i></button>
                        </span>
                    </td>
                </tr>`;
            } else {
                const _rowH = (getGeneralSettings().thumbnailSize || 60) + 8;
                fileListHtml += `<tr class="mc-file-row" data-id="${escapeHtml(entry.id)}" style="border-bottom:1px solid var(--borderColor);height:${_rowH}px;">
                    <td style="padding:4px;text-align:center;">
                        <input type="checkbox" class="mc-file-checkbox" data-id="${escapeHtml(entry.id)}" ${selectedFiles.has(entry.id) ? 'checked' : ''} style="width:14px;height:14px;">
                    </td>
                    ${(function(){
                        const _ts = (getGeneralSettings().thumbnailSize || 60) + 'px';
                        const _ext = (entry.serverFilename || '').split('.').pop().toLowerCase();
                        const _isImg = ['png','jpg','jpeg','gif','webp','bmp','svg'].includes(_ext);
                        const _isVid = ['mp4','webm','avi','mov','mkv','flv'].includes(_ext);
                        const _isAud = ['mp3','wav','ogg','flac','aac','m4a','wma'].includes(_ext);
                        let _thumbHtml = '';
                        const _url = entry.fullServerPath ? (entry.fullServerPath.startsWith('/') ? entry.fullServerPath : '/' + entry.fullServerPath) : '';
                        if (_url) {
                            if (_isImg) _thumbHtml = `<img src="${escapeHtml(_url)}" style="width:${_ts};height:${_ts};border-radius:4px;object-fit:cover;cursor:pointer;" class="mc-file-thumb" data-id="${escapeHtml(entry.id)}">`;
                            else if (_isVid) _thumbHtml = `<video src="${escapeHtml(_url)}" style="width:${_ts};height:${_ts};border-radius:4px;object-fit:cover;cursor:pointer;" class="mc-file-thumb" data-id="${escapeHtml(entry.id)}" muted></video>`;
                            else if (_isAud) _thumbHtml = `<div style="width:${_ts};height:${_ts};border-radius:4px;background:rgba(128,128,128,0.15);display:flex;align-items:center;justify-content:center;font-size:1.8em;cursor:pointer;" class="mc-file-thumb" data-src="${escapeHtml(_url)}">🎵</div>`;
                        }
                        if (!_thumbHtml) _thumbHtml = `<span style="font-size:1.2em;">${getFileIcon(entry)}</span>`;
                        const _thumbPx = getGeneralSettings().thumbnailSize || 60;
                        const _minH = _thumbPx + 48;
                        return `<td style="padding:4px;text-align:center;height:${_minH}px;">
                            <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;">
                                <div>${_thumbHtml}</div>
                                <div class="mc-file-name" title="${escapeHtml(entry.displayName || '未命名')}" style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:120px;font-size:0.95em;">${escapeHtml(entry.displayName || '未命名')}</div>
                                <div style="font-size:0.75em;color:var(--grey40);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:120px;" title="${escapeHtml(entry.serverFilename)}">${escapeHtml(entry.serverFilename)}</div>
                            </div>
                        </td>`;
                    })()}
                    <td style="padding:4px;text-align:center;">${getTypeLabel(entry)}</td>
                    <td style="padding:4px;text-align:center;">${formatFileSize(entry.fileSize)}</td>
                    <td style="padding:4px;text-align:center;">${formatDate(entry.uploadDate)}</td>
                    <td style="padding:4px;text-align:center;">
                        <span style="display:inline-flex;gap:4px;">
                        <button class="mc-file-detail menu_button menu_button_icon" data-id="${escapeHtml(entry.id)}" title="查看详情"><i class="fa-solid fa-info-circle"></i></button>
                        <button class="mc-file-rename menu_button menu_button_icon" data-id="${escapeHtml(entry.id)}" title="重命名"><i class="fa-solid fa-pen"></i></button>
                        <button class="mc-file-delete menu_button menu_button_icon" data-id="${escapeHtml(entry.id)}" title="删除" style="color:var(--dangerColor);"><i class="fa-solid fa-trash-can"></i></button>
                        </span>
                    </td>
                </tr>`;
            }
        }
        fileListHtml += '</table>';
    }

    $panel.html(`
    <div style="padding:4px;">
        <div class="flex-container alignitemscenter" style="gap:6px;margin-bottom:6px;flex-wrap:wrap;">
            <button id="mc-upload-btn" class="menu_button" style="font-size:0.82em;white-space:nowrap;">
                <i class="fa-solid fa-upload"></i> 上传文件
            </button>
            <button id="mc-new-dir-btn" class="menu_button" style="font-size:0.82em;white-space:nowrap;">
                <i class="fa-solid fa-folder-plus"></i> 新建目录
            </button>
            <select id="mc-sort-select" class="text_pole" style="font-size:0.82em;padding:2px 4px;width:auto;max-width:140px;">
                <option value="uploadDate_desc" ${fmSortBy==='uploadDate' && fmSortDesc ? 'selected' : ''}>🕐 时间 ↓</option>
                <option value="uploadDate_asc" ${fmSortBy==='uploadDate' && !fmSortDesc ? 'selected' : ''}>🕐 时间 ↑</option>
                <option value="fileSize_desc" ${fmSortBy==='fileSize' && fmSortDesc ? 'selected' : ''}>📦 大小 ↓</option>
                <option value="fileSize_asc" ${fmSortBy==='fileSize' && !fmSortDesc ? 'selected' : ''}>📦 大小 ↑</option>
                <option value="type_desc" ${fmSortBy==='type' && fmSortDesc ? 'selected' : ''}>📄 类型 ↓</option>
                <option value="type_asc" ${fmSortBy==='type' && !fmSortDesc ? 'selected' : ''}>📄 类型 ↑</option>
                <option value="name_desc" ${fmSortBy==='name' && fmSortDesc ? 'selected' : ''}>🔤 名称 ↓</option>
                <option value="name_asc" ${fmSortBy==='name' && !fmSortDesc ? 'selected' : ''}>🔤 名称 ↑</option>
            </select>
            <select id="mc-view-select" class="text_pole" style="font-size:0.82em;padding:2px 4px;width:auto;max-width:120px;">
                <option value="detail" ${fmViewMode==='detail' ? 'selected' : ''}>📋 详情</option>
                <option value="simple" ${fmViewMode==='simple' ? 'selected' : ''}>📄 简洁</option>
                <option value="grid" ${fmViewMode==='grid' ? 'selected' : ''}>🖼️ 图像</option>
            </select>
            <button id="mc-select-toggle" class="menu_button" style="font-size:0.82em;white-space:nowrap;"><i class="fa-solid fa-square"></i> 全选</button>
            <button id="mc-batch-btn" class="menu_button" style="font-size:0.82em;white-space:nowrap;"><i class="fa-solid fa-layer-group"></i> 批量修改</button>
            ${currentDir !== '/' ? `
            <button id="mc-go-up-btn" class="menu_button" style="font-size:0.82em;white-space:nowrap;">
                <i class="fa-solid fa-level-up-alt"></i> 返回上一级
            </button>` : ''}
            <span style="flex:1;"></span>
            <span id="mc-fm-settings-btn" style="cursor:pointer;font-size:0.9em;color:var(--grey40);" title="文件管理器设置"><i class="fa-solid fa-gear"></i></span>
            <span style="font-size:0.8em;color:var(--grey40);">${allEntries.length} 项</span>
            ${totalPages > 1 ? `
            <span style="font-size:0.8em;">
                <button id="mc-fm-page-prev" class="menu_button" style="font-size:0.75em;" ${fmCurrentPage <= 1 ? 'disabled' : ''}>◀</button>
                <span style="margin:0 4px;">${fmCurrentPage}/${totalPages}</span>
                <button id="mc-fm-page-next" class="menu_button" style="font-size:0.75em;" ${fmCurrentPage >= totalPages ? 'disabled' : ''}>▶</button>
            </span>` : ''}
        </div>
        <div style="padding:4px 0;margin-bottom:4px;border-bottom:1px solid var(--borderColor);">
            ${breadHtml}
        </div>
        <div style="display:flex;gap:6px;margin-bottom:4px;padding:4px;">
            <select id="mc-search-mode" class="text_pole" style="font-size:0.82em;padding:2px 4px;width:auto;max-width:80px;">
                <option value="simple" ${fmSearchMode==='simple'?'selected':''}>简单</option>
                <option value="full" ${fmSearchMode==='full'?'selected':''}>全量</option>
            </select>
            <input id="mc-file-search" class="text_pole" type="text" placeholder="搜索文件..." value="${escapeHtml(_savedSearch)}" style="flex:1;font-size:0.82em;padding:2px 6px;">
            <button id="mc-search-btn" class="menu_button" style="font-size:0.82em;white-space:nowrap;"><i class="fa-solid fa-search"></i> 搜索</button>
        </div>
        ${fileListHtml}
    </div>`);
    // 事件绑定由调用方自行管理（render 不隐式调用 bindManagerEvents）
}
