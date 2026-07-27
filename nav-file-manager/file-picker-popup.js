// nav-file-manager/file-picker-popup.js — 文件选择器弹窗（对外开放接口）
// 功能：弹出与文件管理器界面一模一样的弹窗，用户浏览/搜索/选择文件，
//       确认后返回选中文件的注册表条目列表。
// 其他模块可以导入此函数，无需关心文件管理器内部实现。

import { callGenericPopup } from '../../../../popup.js';
import { getRegistryById } from '../core/data.js';
import { renderFileManager } from './file-render.js';
import { setActiveRenderTarget } from './file-state.js';
import { POPUP_TYPE } from '../shared/popup-type.js';
import {
    currentDir, selectedFiles, isSelectionMode,
    setCurrentDir, setSelectedFiles, setFmCurrentPage, setFmSortBy, setFmSortDesc,
    setFmViewMode, setFmSearchMode, setFmSearchTriggered,
    fmCurrentPage, fmSortBy, fmSortDesc, fmViewMode, fmSearchMode,
} from './file-state.js';

/**
 * 弹出文件选择器弹窗
 * @param {object} [options]
 * @param {boolean} [options.multiSelect=true] - 是否允许多选
 * @param {string} [options.title='选择文件'] - 弹窗标题
 * @returns {Promise<Array<object>>} 选中文件的注册表条目列表（空数组表示取消）
 */
export async function showFilePickerPopup(options = {}) {
    const { multiSelect = true, title = '选择文件' } = options;

    // ====== 保存当前文件管理器状态 ======
    const savedState = {
        currentDir,
        selectedFiles: new Set(selectedFiles),
        fmCurrentPage,
        fmSortBy,
        fmSortDesc,
        fmViewMode,
        fmSearchMode,
    };

    // ====== 重置状态（从根目录开始，清空选择） ======
    setCurrentDir('/');
    setSelectedFiles(new Set());
    setFmCurrentPage(1);
    setFmSortBy('uploadDate');
    setFmSortDesc(true);
    setFmViewMode('detail');
    setFmSearchMode('simple');
    setFmSearchTriggered(false);

    // ====== 构建弹窗内容容器 ======
    const containerId = 'mc-file-picker-container';
    const $content = $(`<div id="${containerId}" style="min-height:400px;max-height:70vh;overflow:hidden;display:flex;flex-direction:column;">
        <div style="flex:1;overflow-y:auto;" id="${containerId}-scroll"></div>
        <div style="border-top:1px solid var(--borderColor);padding:8px;display:flex;gap:8px;justify-content:flex-end;flex-shrink:0;">
            <span style="flex:1;font-size:0.82em;color:var(--grey40);align-self:center;">
                <span id="mc-picker-count">0</span> 个文件已选
            </span>
            <button id="mc-picker-confirm" class="menu_button" style="white-space:nowrap;font-size:0.85em;">
                <i class="fa-solid fa-check"></i> 确认选择
            </button>
            <button id="mc-picker-cancel" class="menu_button" style="white-space:nowrap;font-size:0.85em;">
                <i class="fa-solid fa-xmark"></i> 取消
            </button>
        </div>
    </div>`);

    // 渲染文件管理器到弹窗容器
    const $scrollArea = $content.find(`#${containerId}-scroll`);
    // 临时存放渲染结果的占位
    $scrollArea.html('<div style="padding:40px;text-align:center;color:var(--grey40);font-size:0.9em;"><i class="fa-solid fa-spinner fa-spin" style="font-size:2em;display:block;margin-bottom:12px;"></i>加载中...</div>');

    // ====== 设置活动渲染目标 ======
    // 此后所有无参的 renderFileManager() 调用（如目录切换、排序等事件）都会渲染到弹窗内
    const scrollSelector = `#${containerId}-scroll`;
    setActiveRenderTarget(scrollSelector);

    // ====== 渲染文件管理器到弹窗 ======
    // 先追加到 DOM 让 renderFileManager 能找到容器
    // 后续 callGenericPopup 会将其包装到弹窗内
    const popupPromise = callGenericPopup($content, POPUP_TYPE.DISPLAY, '', {
        okButton: null,
        allowVerticalScrolling: false,
        wide: true,
    });

    // 渲染到滚动区域
    await renderFileManager(scrollSelector); // 指定 target，不会自动绑定事件

    // 确保文件管理器事件绑定（目录导航、排序等）在弹窗内也能工作
    const { bindManagerEvents } = await import('./file-events.js');
    bindManagerEvents();

    // ====== 更新选中计数 ======
    function updateCount() {
        $('#mc-picker-count').text(selectedFiles.size);
        const $btn = $('#mc-picker-confirm');
        if (selectedFiles.size === 0) {
            $btn.prop('disabled', true).css('opacity', '0.5');
        } else {
            $btn.prop('disabled', false).css('opacity', '');
        }
    }
    updateCount();

    // 监听复选框变化（同时更新 selectedFiles 和计数）
    // ⚠️ 必须在 bindManagerEvents 之后绑定，避免被其 .off() 误删
    $(document).on('change.picker', '.mc-file-checkbox', function () {
        const id = $(this).data('id');
        if ($(this).is(':checked')) selectedFiles.add(id);
        else selectedFiles.delete(id);
        updateCount();
    });

    // 全选/全不选后更新计数（主 handler 用 .off().on() 绑的，不会触发 change 事件）
    $(document).on('click.picker-sel', '#mc-select-toggle', function () {
        setTimeout(updateCount, 0);
    });
    $(document).on('change.picker-sel', '#mc-select-all', function () {
        setTimeout(updateCount, 0);
    });

    // ====== 按钮事件 ======
    return new Promise((resolve) => {
        let resolved = false;

        function done(result) {
            if (resolved) return;
            resolved = true;

            // 清理事件
            $(document).off('.picker');
            $(document).off('.picker-sel');

            // 恢复活动渲染目标
            setActiveRenderTarget(null);

            // 恢复原始文件管理器状态
            setCurrentDir(savedState.currentDir);
            setSelectedFiles(savedState.selectedFiles);
            setFmCurrentPage(savedState.fmCurrentPage);
            setFmSortBy(savedState.fmSortBy);
            setFmSortDesc(savedState.fmSortDesc);
            setFmViewMode(savedState.fmViewMode);
            setFmSearchMode(savedState.fmSearchMode);

            resolve(result);
        }

        // 确认选择
        $(document).off('click.picker-confirm').on('click.picker-confirm', '#mc-picker-confirm', async function () {
            const ids = [...selectedFiles];
            // 获取完整条目
            const entries = [];
            for (const id of ids) {
                const entry = await getRegistryById(id);
                if (entry) entries.push(entry);
            }
            // 关闭弹窗
            const popup = $(this).closest('.popup');
            if (popup.length) popup.find('.popup-button-close').click();
            done(entries);
        });

        // 取消
        $(document).off('click.picker-cancel').on('click.picker-cancel', '#mc-picker-cancel', function () {
            const popup = $(this).closest('.popup');
            if (popup.length) popup.find('.popup-button-close').click();
            done([]);
        });

        // 弹窗被关闭（点遮罩层等）
        popupPromise.then((popupResult) => {
            // 如果还没 resolved，说明是外部关闭
            done([]);
        }).catch(() => {
            done([]);
        });
    });
}
