// drawer.js — 导航栏 Drawer 创建与标签页切换

import { currentSettings, saveSettings } from '../core/data.js';

/**
 * 添加导航栏 Drawer
 */
export function addNavBarDrawer() {
    if ($('#modal-chat-drawer').length) return;

    const drawerHtml = `
    <div id="modal-chat-drawer" class="drawer">
        <div class="drawer-toggle drawer-header">
            <div class="drawer-icon fa-solid fa-layer-group fa-fw closedIcon" title="多模态聊天"></div>
        </div>
        <div id="modal-chat-panel" class="drawer-content closedDrawer">
            <div class="drawer-content-inner">
                <div class="mc-nav flex-container alignitemscenter" style="border-bottom:1px solid var(--borderColor);margin-bottom:8px;">
                    <span class="mc-tab mc-tab-active" data-tab="chat-images" style="flex:1;text-align:center;padding:6px 0;cursor:pointer;font-size:0.85em;border-bottom:2px solid var(--primary);">
                        <i class="fa-solid fa-image"></i> 聊天图片
                    </span>
                    <span class="mc-tab" data-tab="match-scoring" style="flex:1;text-align:center;padding:6px 0;cursor:pointer;font-size:0.85em;color:var(--grey40);">
                        <i class="fa-solid fa-chart-simple"></i> 匹配打分
                    </span>
                    <span class="mc-tab" data-tab="file-manager" style="flex:1;text-align:center;padding:6px 0;cursor:pointer;font-size:0.85em;color:var(--grey40);">
                        <i class="fa-solid fa-folder"></i> 文件管理
                    </span>
                    <span class="mc-tab" data-tab="general" style="flex:1;text-align:center;padding:6px 0;cursor:pointer;font-size:0.85em;color:var(--grey40);">
                        <i class="fa-solid fa-sliders"></i> 通用配置
                    </span>
                    <span id="mc-close-drawer" class="fa-solid fa-xmark menu_button menu_button_icon" style="margin-left:4px;"></span>
                </div>
                <div id="mc-chat-images-panel"></div>
                <div id="mc-match-scoring-panel" style="display:none;"></div>
                <div id="mc-file-manager-panel" style="display:none;"></div>
                <div id="mc-general-panel" style="display:none;"></div>
            </div>
        </div>
    </div>`;

    $('#top-settings-holder').append(drawerHtml);
    $('#modal-chat-drawer').insertBefore('#user-settings-button');

    // 绑定图标点击事件
    $('#modal-chat-drawer .drawer-toggle').on('click', async function () {
        const { doNavbarIconClick } = await import('../../../../../script.js');
        doNavbarIconClick.call(this);

        if ($('#modal-chat-panel').hasClass('openDrawer')) {
            const lastTab = currentSettings?.lastNavTab || 'chat-images';
            switchTab(lastTab);
        }
    });

    // 标签切换
    $('.mc-tab').on('click', function () {
        const tab = $(this).data('tab');
        switchTab(tab);
    });

    // 关闭按钮
    $('#mc-close-drawer').on('click', function () {
        $('#modal-chat-drawer .drawer-toggle').trigger('click');
    });
}

/**
 * 切换标签页
 * @param {string} tab
 */
export async function switchTab(tab) {
    // 记住最后停留的标签页
    currentSettings.lastNavTab = tab;
    saveSettings();

    $('.mc-tab').removeClass('mc-tab-active')
        .css('border-bottom', '2px solid transparent')
        .css('color', 'var(--grey40)');

    $(`.mc-tab[data-tab="${tab}"]`).addClass('mc-tab-active')
        .css('border-bottom', '2px solid var(--primary)')
        .css('color', '');

    // 先加载渲染目标面板内容（面板保持隐藏），避免空面板闪烁
    switch (tab) {
        case 'chat-images': {
            await new Promise(r => requestAnimationFrame(r));
            const { renderChatImages, bindChatImagesEvents } = await import('../nav-chat-images/index.js');
            renderChatImages();
            bindChatImagesEvents();
            break;
        }
        case 'match-scoring': {
            await new Promise(r => requestAnimationFrame(r));
            const { renderMatchScoring, bindMatchScoringEvents } = await import('../nav-match-scoring/index.js');
            renderMatchScoring();
            bindMatchScoringEvents();
            break;
        }
        case 'file-manager': {
            await new Promise(r => requestAnimationFrame(r));
            const { renderFileManager, bindManagerEvents } = await import('../nav-file-manager/index.js');
            await renderFileManager();
            bindManagerEvents();
            break;
        }
        case 'general': {
            await new Promise(r => requestAnimationFrame(r));
            const { renderGeneralSettings, bindGeneralEvents } = await import('../nav-general-settings/index.js');
            renderGeneralSettings();
            bindGeneralEvents();
            break;
        }
    }
    // 内容就绪后，在同帧内切换面板（无空窗期）
    $('#mc-chat-images-panel, #mc-match-scoring-panel, #mc-file-manager-panel, #mc-general-panel').hide();
    $(`#mc-${tab}-panel`).show();
}
