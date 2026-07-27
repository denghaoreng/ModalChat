// message-handler.js — SillyTavern 事件回调与消息处理

import { getContext } from '../../../../extensions.js';
import { currentSettings } from '../core/data.js';
import { renderResultsPanel, restoreChatResults } from '../nav-match-scoring/match-chat-results.js';

// ==================== 状态缓存 ====================

let pendingResults = null;
let pendingGeneration = 0;

if (!window._mc_lastMesText) window._mc_lastMesText = {};

// ==================== 事件注册/注销 ====================

export function registerEventListeners() {
    console.log('[MC-DEBUG] registerEventListeners called');
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
    console.log('[MC-DEBUG] registerEventListeners done, events registered:', Object.keys(event_types).length);
}

export function unregisterEventListeners() {
    const { eventSource, event_types } = getContext();
    eventSource.removeListener(event_types.MESSAGE_RECEIVED, onMessageReceived);
    eventSource.removeListener(event_types.CHARACTER_MESSAGE_RENDERED, onAiMessageRendered);
    eventSource.removeListener(event_types.MESSAGE_SWIPED, onMessageSwiped);
    eventSource.removeListener(event_types.CHAT_CHANGED, onChatChanged);
    eventSource.removeListener(event_types.CHAT_LOADED, onChatLoaded);
    eventSource.removeListener(event_types.MESSAGE_DELETED, onMessageDeleted);
}

// ==================== 事件回调：消息接收 ====================

function onMessageReceived(data) {
    console.log('[MC-DEBUG] onMessageReceived fired, data:', typeof data === 'object' ? (data.id || data.mes || 'obj') : data);
    const ciData = currentSettings.navChatImages || {};
    const msData = currentSettings.navMatchScoring || {};
    const ciEnabled = ciData.enabled !== false && ciData.autoDetect !== false;
    const msEnabled = msData.enabled !== false && msData.autoDetect !== false;
    console.log('[MC-DEBUG] ciEnabled:', ciEnabled, 'msEnabled:', msEnabled, 'msData:', JSON.stringify({ enabled: msData.enabled, autoDetect: msData.autoDetect }));
    if (!ciEnabled && !msEnabled) { console.log('[MC-DEBUG] BOTH DISABLED, return'); return; }

    const { chat } = getContext();
    if (typeof data === 'object' && data?.is_user) { console.log('[MC-DEBUG] is_user message, return'); return; }

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
    if (!aiText || !userText) { console.log('[MC-DEBUG] missing aiText or userText'); return; }
    console.log('[MC-DEBUG] aiText length:', aiText.length, 'userText length:', userText.length, 'messageId:', messageId);

    // 兜底：如果 messageId 仍未获取到，用 mesIndex 作为标识
    if (messageId == null) messageId = String(mesIndex);

    if (mesIndex >= 0) window._mc_lastMesText[mesIndex] = aiText;

    pendingGeneration++;

    // chat-images 匹配（异步执行，matcher 内部处理队列）
    if (ciEnabled) {
        import('../nav-chat-images/matcher.js').then(m => m.performMatch(aiText)).catch(() => {});
    }

    // match-scoring 评分
    if (msEnabled) {
        console.log('[MC-DEBUG] importing scorer...');
        import('../nav-match-scoring/scorer.js').then(async m => {
            console.log('[MC-DEBUG] scorer module loaded, calling scoreMessages...');
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
                const { persistChatResults } = await import('../nav-match-scoring/match-chat-results.js');
                persistChatResults(messageId, results);
                saveChatDebounced();
            }

            console.log('[MC-DEBUG] scoreMessages done, results count:', results.length);
            pendingResults = { messageId, mesIndex, msResults: results, generation: pendingGeneration };
            // ⭐ 评分完成后主动插入 DOM（不依赖 CHARACTER_MESSAGE_RENDERED 事件，
            //    因为 import() 异步导致评分完成时事件已过）
            if (results.length > 0) {
                import('../nav-match-scoring/match-chat-results.js').then(cr => {
                    const domId = mesIndex != null ? mesIndex : messageId;
                    console.log('[MC-DEBUG] rendering chat results for domId:', domId);
                    cr.renderChatResults(domId, results);
                }).catch(() => {});
            } else {
                console.log('[MC-DEBUG] no results, skip render');
            }
        }).catch(err => { console.error('[MC-DEBUG] scorer import/exec error:', err); });
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
    import('../nav-match-scoring/match-chat-results.js').then(cr => {
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
    import('../nav-match-scoring/scorer.js').then(m => m.clearLastResults()).catch(() => {});
    import('../nav-match-scoring/match-chat-results.js').then(cr => cr.renderResultsPanel(null)).catch(() => {});

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
    console.log('[MC-DEBUG] onChatChanged fired');
    window._mc_lastMesText = {};
    pendingResults = null;
    import('../nav-match-scoring/scorer.js').then(m => m.clearLastResults()).catch(err => console.error('[MC-DEBUG] onChatChanged scorer error:', err));
    import('../nav-match-scoring/match-chat-results.js').then(cr => {
        cr.renderResultsPanel(null);
        cr.cleanupAllChatResults();
    }).catch(err => console.error('[MC-DEBUG] onChatChanged results error:', err));
    import('../nav-chat-images/matcher.js').then(m => m.clearAllImageTimers()).catch(err => console.error('[MC-DEBUG] onChatChanged matcher error:', err));
}

function onChatLoaded() {
    console.log('[MC-DEBUG] onChatLoaded fired');
    try { restoreChatResults(); console.log('[MC-DEBUG] restoreChatResults done'); } catch (e) { console.warn('[MC-DEBUG] restoreChatResults error:', e); }
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
