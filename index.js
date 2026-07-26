// index.js — 入口：生命周期、导航栏创建、标签页调度、事件注册

import { getContext } from '../../../extensions.js';
import { loadSettings, currentSettings, saveSettings } from './data.js';
import { escapeHtml } from './shared/utils.js';
import { renderResultsPanel, restoreChatResults } from './nav-match-scoring/match-chat-results.js';

// ==================== 生命周期 ====================

export async function init() {
    await loadSettings();
    addNavBarDrawer();
    registerEventListeners();
}

export async function onDelete() {
    $('#modal-chat-drawer').remove();
}

export function onEnable() { registerEventListeners(); }
export function onDisable() {
    const { eventSource, event_types } = getContext();
    eventSource.removeListener(event_types.MESSAGE_RECEIVED, onMessageReceived);
    eventSource.removeListener(event_types.CHARACTER_MESSAGE_RENDERED, onAiMessageRendered);
    eventSource.removeListener(event_types.MESSAGE_SWIPED, onMessageSwiped);
    eventSource.removeListener(event_types.CHAT_CHANGED, onChatChanged);
    eventSource.removeListener(event_types.CHAT_LOADED, onChatLoaded);
    eventSource.removeListener(event_types.MESSAGE_DELETED, onMessageDeleted);
}

// ==================== 事件注册 ====================

function registerEventListeners() {
    const { eventSource, event_types } = getContext();

    eventSource.removeListener(event_types.MESSAGE_RECEIVED, onMessageReceived);
    eventSource.removeListener(event_types.CHARACTER_MESSAGE_RENDERED, onAiMessageRendered);
    eventSource.removeListener(event_types.MESSAGE_SWIPED, onMessageSwiped);
    eventSource.removeListener(event_types.CHAT_CHANGED, onChatChanged);
    eventSource.removeListener(event_types.CHAT_LOADED, onChatLoaded);
    eventSource.removeListener(event_types.MESSAGE_DELETED, onMessageDeleted);

    eventSource.on(event_types.MESSAGE_RECEIVED, onMessageReceived);
    eventSource.on(event_types.CHARACTER_MESSAGE_RENDERED, onAiMessageRendered);
    eventSource.on(event_types.MESSAGE_SWIPED, onMessageSwiped);
    eventSource.on(event_types.CHAT_CHANGED, onChatChanged);
    eventSource.on(event_types.CHAT_LOADED, onChatLoaded);
    eventSource.on(event_types.MESSAGE_DELETED, onMessageDeleted);
}

// ==================== 状态缓存 ====================

let pendingResults = null;
let pendingGeneration = 0;

if (!window._mc_lastMesText) window._mc_lastMesText = {};

// ==================== 事件回调：消息接收 ====================

function onMessageReceived(data) {
    const ciData = currentSettings.navChatImages || {};
    const msData = currentSettings.navMatchScoring || {};
    const ciEnabled = ciData.enabled !== false && ciData.autoDetect !== false;
    const msEnabled = msData.enabled !== false && msData.autoDetect !== false;
    if (!ciEnabled && !msEnabled) return;

    const { chat } = getContext();
    if (typeof data === 'object' && data?.is_user) return;

    let aiText = '', userText = '', aiMessage = null;
    let mesIndex = -1, messageId = null;

    if (typeof data === 'object' && data !== null) messageId = data.id;
    else if (data != null) messageId = data;

    for (let i = chat.length - 1; i >= 0; i--) {
        const msg = chat[i];
        if (!msg || msg.is_system) continue;
        if (!aiText && !msg.is_user) { aiText = msg.mes || ''; aiMessage = msg; mesIndex = i; if (!messageId) messageId = msg.id; }
        if (!userText && msg.is_user) userText = msg.mes || '';
        if (aiText && userText) break;
    }
    if (!aiText || !userText) return;

    // 兜底：如果 messageId 仍未获取到，用 mesIndex 作为标识
    if (messageId == null) messageId = String(mesIndex);

    if (mesIndex >= 0) window._mc_lastMesText[mesIndex] = aiText;

    pendingGeneration++;

    // chat-images 匹配（异步执行，matcher 内部处理队列）
    if (ciEnabled) {
        import('./nav-chat-images/matcher.js').then(m => m.performMatch(aiText)).catch(() => {});
    }

    // match-scoring 评分
    if (msEnabled) {
        import('./nav-match-scoring/scorer.js').then(async m => {
            const results = m.scoreMessages(aiText, userText);
            m.setLastResults(results, aiText, userText);

            // 更新结果面板
            renderResultsPanel(results);

            if (aiMessage && results.length > 0) {
                if (!aiMessage.extra) aiMessage.extra = {};
                aiMessage.extra.matchResults = results.map(item => ({
                    fileId: item.file.id,
                    displayName: item.file.displayName,
                    filePath: item.file.filePath,
                    type: item.file.type,
                    totalScore: item.totalScore,
                }));
                // 持久化到 chat.extra
                const { persistChatResults } = await import('./nav-match-scoring/match-chat-results.js');
                persistChatResults(messageId, results);
                saveChatDebounced();
            }

            pendingResults = { messageId, mesIndex, msResults: results, generation: pendingGeneration };
            // ⭐ 评分完成后主动插入 DOM（不依赖 CHARACTER_MESSAGE_RENDERED 事件，
            //    因为 import() 异步导致评分完成时事件已过）
            if (results.length > 0) {
                import('./nav-match-scoring/match-chat-results.js').then(cr => {
                    const domId = mesIndex != null ? mesIndex : messageId;
                    cr.renderChatResults(domId, results);
                }).catch(() => {});
            }
        }).catch(() => {});
    }
}

// ==================== 事件回调：DOM 渲染完成 ====================

function onAiMessageRendered(data) {
    if (!pendingResults || !pendingResults.msResults?.length) {
        return;
    }
    // ⭐ DOM 的 mesid 属性用的是 chat 数组索引，不是数据库 ID
    const domId = pendingResults.mesIndex != null ? pendingResults.mesIndex : pendingResults.messageId;
    if (domId < 0) return;
    const results = pendingResults.msResults;
    if (!results || results.length === 0) return;
    import('./nav-match-scoring/match-chat-results.js').then(cr => {
        cr.renderChatResults(domId, results);
    }).catch((err) => { console.error('ModalChat MS: import match-chat-results error', err); });
}

// ==================== 事件回调：滑动/聊天切换 ====================

function onMessageSwiped() {
    const { chat } = getContext();
    const lastMsg = chat[chat.length - 1];
    if (!lastMsg || lastMsg.is_user) return;

    // ⭐ 清除旧的 pending 状态和 DOM 结果
    const lastAiIndex = chat.length - 1;
    pendingResults = null;
    $(`.mes[mesid="${lastAiIndex}"] .mc-ms-chat-results`).remove();
    import('./nav-match-scoring/scorer.js').then(m => m.clearLastResults()).catch(() => {});
    import('./nav-match-scoring/match-chat-results.js').then(cr => cr.renderResultsPanel(null)).catch(() => {});

    const mesIndex = chat.indexOf(lastMsg);
    const currentText = lastMsg.mes || '';
    const prevText = window._mc_lastMesText?.[mesIndex];
    const isNew = currentText !== prevText;

    if (isNew) {
        // ⭐ 文本变化：重新匹配（新生成或不同缓存回复）
        onMessageReceived({ id: lastMsg.id, is_user: lastMsg.is_user });
    }
}

function onChatChanged() {
    window._mc_lastMesText = {};
    pendingResults = null;
    import('./nav-match-scoring/scorer.js').then(m => m.clearLastResults()).catch(() => {});
    import('./nav-match-scoring/match-chat-results.js').then(cr => {
        cr.renderResultsPanel(null);
        cr.cleanupAllChatResults();
    }).catch(() => {});
    import('./nav-chat-images/matcher.js').then(m => m.clearAllImageTimers()).catch(() => {});
}

function onChatLoaded() {
    try { restoreChatResults(); } catch (e) { /* ignore */ }
}

function onMessageDeleted() {
    onMessageReceived({});
}

let _saveChatTimer = null;
function saveChatDebounced() {
    clearTimeout(_saveChatTimer);
    _saveChatTimer = setTimeout(() => {
        const { saveChat } = getContext();
        saveChat();
    }, 500);
}

/**
 * 添加导航栏 Drawer
 */
function addNavBarDrawer() {
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
        const { doNavbarIconClick } = await import('../../../../script.js');
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
async function switchTab(tab) {
    // 记住最后停留的标签页
    currentSettings.lastNavTab = tab;
    saveSettings();

    $('.mc-tab').removeClass('mc-tab-active')
        .css('border-bottom', '2px solid transparent')
        .css('color', 'var(--grey40)');

    $(`.mc-tab[data-tab="${tab}"]`).addClass('mc-tab-active')
        .css('border-bottom', '2px solid var(--primary)')
        .css('color', '');

    // 隐藏所有面板
    $('#mc-chat-images-panel, #mc-match-scoring-panel, #mc-file-manager-panel, #mc-general-panel').hide();

    // 延迟加载并渲染
    switch (tab) {
        case 'chat-images': {
            $('#mc-chat-images-panel').show();
            const { renderChatImages, bindChatImagesEvents } = await import('./nav-chat-images/index.js');
            renderChatImages();
            bindChatImagesEvents();
            break;
        }
        case 'match-scoring': {
            $('#mc-match-scoring-panel').show();
            const { renderMatchScoring, bindMatchScoringEvents } = await import('./nav-match-scoring/index.js');
            renderMatchScoring();
            bindMatchScoringEvents();
            break;
        }
        case 'file-manager': {
            $('#mc-file-manager-panel').show();
            const { renderFileManager, bindManagerEvents } = await import('./nav-file-manager/index.js');
            await renderFileManager();
            bindManagerEvents();
            break;
        }
        case 'general': {
            $('#mc-general-panel').show();
            const { renderGeneralSettings, bindGeneralEvents } = await import('./nav-general-settings/index.js');
            renderGeneralSettings();
            bindGeneralEvents();
            break;
        }
    }
}


