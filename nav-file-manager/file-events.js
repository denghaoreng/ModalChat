// nav-file-manager/file-events.js — 文件管理器事件绑定

import { currentSettings, getGeneralSettings, updateGeneralSettings } from '../data.js';
import { uploadFile, deleteFile, renameFile, createDirectory, deleteDirectory } from '../shared/file-service.js';
import { renameDirectory } from '../data.js';
import { escapeHtml, formatFileSize, formatDate } from '../shared/utils.js';
import { callGenericPopup } from '../../../../popup.js';
import { getTypeLabel, getFileIcon } from '../shared/file-icons.js';
import { showFileEnlarge } from '../shared/file-enlarge.js';
import { POPUP_TYPE } from '../shared/popup-type.js';
import { renderFileManager } from './file-render.js';
import {
    currentDir, selectedFiles, selectionCallback,
    fmCurrentPage, fmSortBy, fmSortDesc, fmViewMode, fmSearchMode, fmSearchTriggered,
    setCurrentDir, setFmCurrentPage, setFmSearchTriggered, setFmSearchMode,
    setFmSortBy, setFmSortDesc, setFmViewMode, setSelectionCallback,
} from './file-state.js';

/**
 * 绑定文件管理器事件（使用事件委托，不依赖实际 DOM 元素是否存在）
 */
export function bindManagerEvents() {
    // 面包屑导航切换目录
    $(document).off('click', '.mc-bread-item').on('click', '.mc-bread-item', async function () {
        setCurrentDir($(this).data('path'));
        await renderFileManager();
    });
    // 点击文件夹行进入子目录
    $(document).off('click', '.mc-dir-row').on('click', '.mc-dir-row', async function () {
        setCurrentDir($(this).data('path'));
        await renderFileManager();
    });

    // 上传文件
    $(document).off('click', '#mc-upload-btn').on('click', '#mc-upload-btn', async function () {
        const targetDir = currentDir;
        const input = document.createElement('input');
        input.type = 'file';
        input.multiple = true;
        input.onchange = async function (e) {
            const files = Array.from(e.target.files);
            for (const file of files) {
                try {
                    const dir = targetDir === '/' ? '' : targetDir.replace(/^\/+|\/+$/g, '');
                    await uploadFile(file, { source: 'file-manager', directory: dir });
                } catch (err) {
                    console.error('ModalChat: 上传失败', err);
                    toastr.error(`上传失败: ${file.name}`);
                }
            }
            toastr.success(`已上传 ${files.length} 个文件`);
            await renderFileManager();
        };
        input.click();
    });

    // 新建目录
    $(document).off('click', '#mc-new-dir-btn').on('click', '#mc-new-dir-btn', async function () {
        const name = await callGenericPopup('<label>输入目录名称：</label>', POPUP_TYPE.INPUT, '', { okButton: '创建', cancelButton: '取消' });
        if (name && name.trim()) {
            const ok = await createDirectory(name.trim(), currentDir);
            if (ok) {
                await renderFileManager();
            } else {
                toastr.error('创建目录失败');
            }
        }
    });

    // 删除文件
    $(document).off('click', '.mc-file-delete').on('click', '.mc-file-delete', async function () {
        const id = $(this).data('id');
        const ok = await callGenericPopup('<p>确定要删除此文件吗？</p><p style="color:var(--grey40);font-size:0.85em;">文件将同时从服务器和注册表移除。</p>', POPUP_TYPE.CONFIRM, '', { okButton: '删除', cancelButton: '取消' });
        if (ok) {
            await deleteFile(id);
            await renderFileManager();
        }
    });

    // 返回上一级目录
    $(document).off('click', '#mc-go-up-btn').on('click', '#mc-go-up-btn', async function () {
        const parts = currentDir.replace(/\/$/, '').split('/').filter(Boolean);
        parts.pop();
        setCurrentDir(parts.length === 0 ? '/' : '/' + parts.join('/') + '/');
        await renderFileManager();
    });

    // 文件夹详情
    $(document).off('click', '.mc-dir-detail').on('click', '.mc-dir-detail', async function (e) {
        e.stopPropagation();
        const dirPath = $(this).data('path');
        const fm = currentSettings.folderMeta && currentSettings.folderMeta[dirPath];
        const name = dirPath.replace(/\/+/g, '/').replace(/\/$/, '').split('/').pop() || '/';
        const createdAt = fm && fm.createdAt ? formatDate(fm.createdAt) : '未知';
        const html = `<div style="padding:8px;line-height:1.8;">
            <div style="font-size:1.1em;font-weight:bold;margin-bottom:12px;">📁 文件夹详情</div>
            <div style="font-size:0.85em;">
                <div style="display:flex;padding:4px 8px;"><span style="color:var(--grey40);width:80px;flex-shrink:0;">名称</span><span style="word-break:break-all;">${escapeHtml(name)}</span></div>
                <div style="display:flex;padding:4px 8px;"><span style="color:var(--grey40);width:80px;flex-shrink:0;">路径</span><span style="word-break:break-all;">${escapeHtml(dirPath)}</span></div>
                <div style="display:flex;padding:4px 8px;"><span style="color:var(--grey40);width:80px;flex-shrink:0;">类型</span><span>文件夹</span></div>
                <div style="display:flex;padding:4px 8px;"><span style="color:var(--grey40);width:80px;flex-shrink:0;">创建时间</span><span>${createdAt}</span></div>
            </div>
        </div>`;
        await callGenericPopup(html, POPUP_TYPE.DISPLAY, '', { okButton: '关闭' });
    });

    // 重命名文件夹
    $(document).off('click', '.mc-dir-rename').on('click', '.mc-dir-rename', async function (e) {
        e.stopPropagation();
        const oldPath = $(this).data('path');
        const oldName = oldPath.replace(/\/+/g, '/').replace(/\/$/, '').split('/').pop();
        const newName = await callGenericPopup('<label>输入新文件夹名称：</label>', POPUP_TYPE.INPUT, oldName, { okButton: '确定', cancelButton: '取消' });
        if (newName && newName.trim() && newName.trim() !== oldName) {
            const parent = oldPath.replace(/\/$/, '').split('/').slice(0, -1).join('/') + '/';
            const newPath = parent + newName.trim() + '/';
            await renameDirectory(oldPath, newPath);
            await renderFileManager();
        }
    });

    // 删除文件夹
    $(document).off('click', '.mc-dir-delete').on('click', '.mc-dir-delete', async function (e) {
        e.stopPropagation();
        const dirPath = $(this).data('path');
        const ok = await callGenericPopup(`<p>确定要删除文件夹 <strong>${escapeHtml(dirPath)}</strong> 吗？</p><p style="color:var(--dangerColor);font-size:0.85em;">将同时删除所有子文件夹和其中的文件。</p>`, POPUP_TYPE.CONFIRM, '', { okButton: '删除', cancelButton: '取消' });
        if (ok) {
            await deleteDirectory(dirPath);
            await renderFileManager();
        }
    });

    // 文件详情
    $(document).off('click', '.mc-file-detail').on('click', '.mc-file-detail', async function () {
        const id = $(this).data('id');
        const { getRegistryById } = await import('../data.js');
        const e = await getRegistryById(id);
        if (!e) { toastr.error('未找到文件'); return; }

        const ext = (e.serverFilename || '').split('.').pop().toLowerCase();
        const isImg = ['png','jpg','jpeg','gif','webp','bmp','svg'].includes(ext);
        const isVid = ['mp4','webm','avi','mov','mkv','flv'].includes(ext);
        const isAud = ['mp3','wav','ogg','flac','aac','m4a'].includes(ext);
        let previewHtml = '';
        if (isImg || isVid || isAud) {
            const url = e.fullServerPath ? (e.fullServerPath.startsWith('/') ? e.fullServerPath : '/' + e.fullServerPath) : '';
            if (url) {
                if (isImg) previewHtml = `<div style="text-align:center;margin-bottom:12px;"><img src="${escapeHtml(url)}" style="max-width:100%;max-height:300px;border-radius:6px;object-fit:contain;cursor:pointer;" class="mc-detail-img" data-url="${escapeHtml(url)}"></div>`;
                else if (isVid) previewHtml = `<div style="text-align:center;margin-bottom:12px;"><video src="${escapeHtml(url)}" controls style="max-width:100%;max-height:300px;border-radius:6px;"></video></div>`;
                else if (isAud) previewHtml = `<div style="text-align:center;margin-bottom:12px;"><audio src="${escapeHtml(url)}" controls style="width:100%;"></audio></div>`;
            }
        }
        const safeId = e.id.replace(/[^a-zA-Z0-9_-]/g, '');
        const html = `<div style="padding:8px;line-height:1.8;max-height:70vh;overflow-y:auto;">
            <div style="font-size:1.1em;font-weight:bold;margin-bottom:12px;">${getFileIcon(e)} 文件详情</div>
            ${previewHtml}
            <div style="font-size:0.85em;">
                <div style="display:flex;padding:4px 8px;"><span style="color:var(--grey40);width:80px;flex-shrink:0;">显示名称</span><span style="word-break:break-all;">${escapeHtml(e.displayName || '未命名')}</span></div>
                <div style="display:flex;padding:4px 8px;"><span style="color:var(--grey40);width:80px;flex-shrink:0;">文件名</span><span style="word-break:break-all;">${escapeHtml(e.serverFilename)}</span></div>
                <div style="display:flex;padding:4px 8px;"><span style="color:var(--grey40);width:80px;flex-shrink:0;">原始名</span><span style="word-break:break-all;">${escapeHtml(e.originalName)}</span></div>
                <div style="display:flex;padding:4px 8px;"><span style="color:var(--grey40);width:80px;flex-shrink:0;">类型</span><span>${getTypeLabel(e)}</span></div>
                <div style="display:flex;padding:4px 8px;"><span style="color:var(--grey40);width:80px;flex-shrink:0;">大小</span><span>${formatFileSize(e.fileSize)}</span></div>
                <div style="display:flex;padding:4px 8px;"><span style="color:var(--grey40);width:80px;flex-shrink:0;">来源</span><span>${escapeHtml(e.source)}</span></div>
                <div style="display:flex;padding:4px 8px;"><span style="color:var(--grey40);width:80px;flex-shrink:0;">上传时间</span><span>${formatDate(e.uploadDate)}</span></div>
                <div style="display:flex;padding:4px 8px;"><span style="color:var(--grey40);width:80px;flex-shrink:0;">目录</span><span style="word-break:break-all;">${escapeHtml(e.directory)}</span></div>
                <div style="display:flex;padding:4px 8px;"><span style="color:var(--grey40);width:80px;flex-shrink:0;">服务端路径</span><span style="word-break:break-all;">${escapeHtml(e.fullServerPath)}</span></div>
                <div style="display:flex;padding:4px 8px;"><span style="color:var(--grey40);width:80px;flex-shrink:0;">ID</span><span style="word-break:break-all;font-size:0.85em;color:var(--grey40);">${escapeHtml(e.id)}</span></div>
            </div>
            <div style="margin-top:12px;padding-top:8px;border-top:1px solid var(--borderColor);text-align:center;display:flex;gap:8px;justify-content:center;">
                <button class="menu_button mc-detail-rename" data-id="${safeId}" style="white-space:nowrap;">重命名</button>
                <button class="menu_button mc-detail-delete" data-id="${safeId}" style="color:var(--dangerColor);white-space:nowrap;">删除</button>
            </div>
        </div>`;

        // 详情弹窗内的图片点击查看原图
        $(document).off('click', '.mc-detail-img').on('click', '.mc-detail-img', async function () {
            const url = $(this).data('url');
            if (!url) return;
            const popup = $(this).closest('.popup');
            popup.find('.popup-button-close').click();
            setTimeout(function () { showFileEnlarge(url); }, 50);
        });

        $(document).off('click', '.mc-detail-rename').on('click', '.mc-detail-rename', async function () {
            const fid = $(this).data('id');
            const dlg = $(this).closest('.popup');
            const { getRegistryById } = await import('../data.js');
            const entry = await getRegistryById(fid);
            const oldName = entry ? (entry.displayName || '') : '';
            const newName = await callGenericPopup('<label>输入新展示名称：</label>', POPUP_TYPE.INPUT, oldName, { okButton: '确定', cancelButton: '取消' });
            if (newName && newName.trim() && newName.trim() !== oldName) {
                renameFile(fid, newName.trim());
                await renderFileManager();
            }
            dlg.find('.popup-button-close').click();
        });

        $(document).off('click', '.mc-detail-delete').on('click', '.mc-detail-delete', async function () {
            const fid = $(this).data('id');
            const dlg = $(this).closest('.popup');
            const ok = await callGenericPopup('<p>确定要删除此文件吗？</p><p style="color:var(--grey40);font-size:0.85em;">文件将同时从服务器和注册表移除。</p>', POPUP_TYPE.CONFIRM, '', { okButton: '删除', cancelButton: '取消' });
            if (ok) {
                await deleteFile(fid);
                await renderFileManager();
            }
            dlg.find('.popup-button-close').click();
        });

        await callGenericPopup(html, POPUP_TYPE.DISPLAY, '', { okButton: '关闭' });

        $(document).off('click', '.mc-detail-img');
        $(document).off('click', '.mc-detail-rename');
        $(document).off('click', '.mc-detail-delete');
    });

    // 文件重命名
    $(document).off('click', '.mc-file-rename').on('click', '.mc-file-rename', async function () {
        const id = $(this).data('id');
        const { getRegistryById } = await import('../data.js');
        const entry = await getRegistryById(id);
        const oldName = entry ? (entry.displayName || '') : '';
        const newName = await callGenericPopup('<label>输入新展示名称：</label>', POPUP_TYPE.INPUT, oldName, { okButton: '确定', cancelButton: '取消' });
        if (newName && newName.trim() && newName.trim() !== oldName) {
            renameFile(id, newName.trim());
            await renderFileManager();
        }
    });

    // 缩略图点击
    $(document).off('click', '.mc-file-thumb').on('click', '.mc-file-thumb', async function () {
        const src = $(this).attr('src') || $(this).data('src');
        if (src) { showFileEnlarge(src); return; }
        const id = $(this).data('id');
        if (id) {
            const btn = document.querySelector(`.mc-file-detail[data-id="${CSS.escape(id)}"]`);
            if (btn) btn.click();
        }
    });

    // 排序切换
    $(document).off('change', '#mc-sort-select').on('change', '#mc-sort-select', async function () {
        const val = $(this).val();
        const parts = val.split('_');
        setFmSortBy(parts[0]);
        setFmSortDesc(parts[1] === 'desc');
        setFmCurrentPage(1);
        await renderFileManager();
    });

    // 展示方式切换
    $(document).off('change', '#mc-view-select').on('change', '#mc-view-select', async function () {
        setFmViewMode($(this).val());
        await renderFileManager();
    });

    // 搜索模式切换
    $(document).off('change', '#mc-search-mode').on('change', '#mc-search-mode', function () {
        setFmSearchMode($(this).val());
    });

    // 搜索按钮
    $(document).off('click', '#mc-search-btn').on('click', '#mc-search-btn', async function () {
        setFmSearchTriggered(true);
        await renderFileManager();
    });
    // 回车搜索
    $('#mc-file-search').off('keydown').on('keydown', async function (e) {
        if (e.key === 'Enter') {
            e.preventDefault();
            setFmSearchTriggered(true);
            await renderFileManager();
        }
    });

    // 文件管理器设置
    let _savedDetailSize = 0, _savedGridSize = 0;
    $(document).off('click', '#mc-fm-settings-btn').on('click', '#mc-fm-settings-btn', async function () {
        _savedDetailSize = 0; _savedGridSize = 0;
        const curDetail = getGeneralSettings().thumbnailSize || 60;
        const curGrid = getGeneralSettings().gridThumbnailSize || 80;
        const html = `<div style="padding:8px;">
            <style>.popup-button-close{display:none!important}</style>
            <div style="font-size:1.1em;font-weight:bold;margin-bottom:12px;">⚙️ 文件管理器设置</div>
            <div style="padding:4px 0;">
                <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;">
                    <span style="width:110px;">详情缩略图：</span>
                    <input id="mc-setting-detail" class="text_pole" type="number" value="${curDetail}" min="20" max="200" style="width:70px;">
                    <span>px</span>
                </div>
                <div style="display:flex;align-items:center;gap:8px;">
                    <span style="width:110px;">图像缩略图：</span>
                    <input id="mc-setting-grid" class="text_pole" type="number" value="${curGrid}" min="20" max="300" style="width:70px;">
                    <span>px</span>
                </div>
            </div>
            <div style="margin-top:12px;text-align:center;display:flex;gap:8px;justify-content:center;">
                <button id="mc-setting-ok" class="menu_button" style="white-space:nowrap;">保存</button>
                <button id="mc-setting-cancel" class="menu_button" style="white-space:nowrap;">取消</button>
            </div>
        </div>`;
        $(document).off('click', '#mc-setting-ok').on('click', '#mc-setting-ok', async function () {
            const dv = parseInt($('#mc-setting-detail').val() || '0');
            const gv = parseInt($('#mc-setting-grid').val() || '0');
            if (dv >= 20 && dv <= 200 && gv >= 20 && gv <= 300) {
                _savedDetailSize = dv; _savedGridSize = gv;
                $(this).closest('.popup').find('.popup-button-close').click();
            } else {
                toastr.error('详情 20-200，图像 20-300');
            }
        });
        $(document).off('click', '#mc-setting-cancel').on('click', '#mc-setting-cancel', async function () {
            $(this).closest('.popup').find('.popup-button-close').click();
        });
        await callGenericPopup(html, POPUP_TYPE.DISPLAY, '', {});
        $(document).off('click', '#mc-setting-ok');
        $(document).off('click', '#mc-setting-cancel');
        if (_savedDetailSize && _savedGridSize) {
            updateGeneralSettings({ thumbnailSize: _savedDetailSize, gridThumbnailSize: _savedGridSize });
            await renderFileManager();
        }
        _savedDetailSize = 0; _savedGridSize = 0;
    });

    // 全选/全不选切换
    $(document).off('click', '#mc-select-toggle').on('click', '#mc-select-toggle', function () {
        const $all = $('.mc-file-checkbox');
        const allChecked = $all.length > 0 && $all.filter(':checked').length === $all.length;
        if (allChecked) {
            $all.prop('checked', false);
            selectedFiles.clear();
            $(this).html('<i class="fa-solid fa-square"></i> 全选');
        } else {
            $all.prop('checked', true);
            $all.each(function () { selectedFiles.add($(this).data('id')); });
            $(this).html('<i class="fa-solid fa-check-square"></i> 全不选');
        }
    });

    // 表头全选框
    $(document).off('change', '#mc-select-all').on('change', '#mc-select-all', function () {
        const checked = $(this).is(':checked');
        $('.mc-file-checkbox').prop('checked', checked);
        if (checked) {
            $('.mc-file-checkbox').each(function () { selectedFiles.add($(this).data('id')); });
        } else {
            selectedFiles.clear();
        }
    });

    // 单个复选框
    $(document).off('change', '.mc-file-checkbox').on('change', '.mc-file-checkbox', function () {
        const id = $(this).data('id');
        if ($(this).is(':checked')) selectedFiles.add(id);
        else selectedFiles.delete(id);
    });

    // 批量修改弹窗
    $(document).off('click', '#mc-batch-btn').on('click', '#mc-batch-btn', async function () {
        const ids = [...selectedFiles];
        if (ids.length === 0) { toastr.error('请先勾选文件'); return; }
        const html = `<div style="padding:8px;">
            <div style="font-size:1.1em;font-weight:bold;margin-bottom:12px;"><i class="fa-solid fa-layer-group"></i> 批量修改（${ids.length} 个文件）</div>
            <div style="margin-bottom:12px;">
                <label style="display:block;margin-bottom:6px;">统一重命名（留空则不修改）：</label>
                <input id="mc-batch-rename-input" class="text_pole" type="text" placeholder="新名称" style="width:100%;">
                <div style="font-size:0.8em;color:var(--grey40);margin-top:4px;">将按「新名称_1.后缀」「新名称_2.后缀」… 重命名</div>
            </div>
            <div style="border-top:1px solid var(--borderColor);padding-top:12px;">
                <button id="mc-batch-rename-btn" class="menu_button" style="white-space:nowrap;margin-right:8px;"><i class="fa-solid fa-pen"></i> 批量重命名</button>
            <button id="mc-batch-delete-btn" class="menu_button" style="color:var(--dangerColor);white-space:nowrap;"><i class="fa-solid fa-trash-can"></i> 删除选中的 ${ids.length} 个文件</button>
            </div>
        </div>`;
        $(document).off('click', '#mc-batch-delete-btn').on('click', '#mc-batch-delete-btn', async function () {
            const ok = await callGenericPopup(`<p>确定要删除选中的 <strong>${ids.length}</strong> 个文件吗？</p><p style="color:var(--grey40);font-size:0.85em;">文件将同时从服务器和注册表移除。</p>`, POPUP_TYPE.CONFIRM, '', { okButton: '删除', cancelButton: '取消' });
            if (ok) {
                for (const id of ids) { await deleteFile(id); }
                selectedFiles.clear();
                await renderFileManager();
            }
            // 关闭批量弹窗
            const popup = $(this).closest('.popup');
            if (popup.length) popup.find('.popup-button-close').click();
        });
        $(document).off('click', '#mc-batch-rename-btn').on('click', '#mc-batch-rename-btn', async function () {
            const newBase = $('#mc-batch-rename-input').val()?.trim();
            if (!newBase) { toastr.error('请输入新名称'); return; }
            let idx = 1;
            for (const id of ids) {
                const { getRegistryById } = await import('../data.js');
                const entry = await getRegistryById(id);
                const ext = entry?.serverFilename ? '.' + entry.serverFilename.split('.').pop() : '';
                renameFile(id, newBase + '_' + idx + ext);
                idx++;
            }
            selectedFiles.clear();
            await renderFileManager();
            // 关闭弹窗
            const popup = $(this).closest('.popup');
            if (popup.length) popup.find('.popup-button-close').click();
        });
        await callGenericPopup(html, POPUP_TYPE.DISPLAY, '', { okButton: '关闭' });
        $(document).off('click', '#mc-batch-delete-btn');
        $(document).off('click', '#mc-batch-rename-btn');
    });

    // 分页
    $(document).off('click', '#mc-fm-page-prev').on('click', '#mc-fm-page-prev', async function () {
        if (fmCurrentPage > 1) { setFmCurrentPage(fmCurrentPage - 1); await renderFileManager(); }
    });
    $(document).off('click', '#mc-fm-page-next').on('click', '#mc-fm-page-next', async function () {
        setFmCurrentPage(fmCurrentPage + 1); await renderFileManager();
    });
}

export async function enterSelectionMode(callback) {
    setSelectionCallback(callback);
    selectedFiles.clear();
    await renderFileManager();
}
