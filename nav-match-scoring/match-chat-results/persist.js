// match-chat-results/persist.js — 持久化、恢复、清理

import { getContext } from '../../../../../extensions.js';
import { getMSFiles, getMatchScoringData } from '../../core/data.js';
import { renderChatResults } from './bubble.js';

/** 持久化匹配结果到 chat.extra */
export function persistChatResults(messageId, results) {
    if (!messageId || !results) return;
    const { chat } = getContext();
    let msg = chat.find(m => m.id === messageId);
    if (!msg && /^\d+$/.test(String(messageId))) {
        msg = chat[parseInt(messageId)];
    }
    if (!msg) msg = chat[chat.length - 1];
    if (!msg) return;
    if (!msg.extra) msg.extra = {};
    msg.extra.mcMatchResults = results.map(item => ({
        fileId: item.file.id,
        displayName: item.file.displayName,
        filePath: item.file.filePath,
        type: item.file.type,
        totalScore: item.totalScore,
    }));
}

/** 从 chat.extra 恢复匹配结果 */
export function restoreChatResults() {
    try {
        const { chat } = getContext();
        const files = getMSFiles();
        const validIds = new Set(files.map(f => f.id));
        let anyCleaned = false;
        for (let i = 0; i < chat.length; i++) {
            const msg = chat[i];
            const has = msg?.extra?.mcMatchResults?.length;
            if (i === 0 && !msg.is_user) { if (has) { delete msg.extra.mcMatchResults; anyCleaned = true; } continue; }
            if (msg.is_user) { if (has) { delete msg.extra.mcMatchResults; anyCleaned = true; } continue; }
            if (!has) continue;
            const valid = msg.extra.mcMatchResults.filter(d => validIds.has(d.fileId));
            if (valid.length === 0) { delete msg.extra.mcMatchResults; anyCleaned = true; continue; }
            if (valid.length < msg.extra.mcMatchResults.length) { msg.extra.mcMatchResults = valid; anyCleaned = true; }
            const results = valid.map(d => ({
                file: { id: d.fileId, displayName: d.displayName, filePath: d.filePath, type: d.type },
                totalScore: d.totalScore,
            }));
            renderChatResults(i, results);
        }
        if (anyCleaned) getContext().saveChat();
    } catch (err) {
        console.warn('ModalChat: restoreChatResults error', err);
    }
}

/** 删除文件后清理残留引用 */
export function cleanupStaleExtraRefs(fileId) {
    const { chat } = getContext();
    let anyCleaned = false;
    for (const msg of chat) {
        if (!msg?.extra?.mcMatchResults?.length) continue;
        const before = msg.extra.mcMatchResults.length;
        msg.extra.mcMatchResults = msg.extra.mcMatchResults.filter(r => r.fileId !== fileId);
        if (msg.extra.mcMatchResults.length === 0) { delete msg.extra.mcMatchResults; anyCleaned = true; }
        else if (msg.extra.mcMatchResults.length < before) anyCleaned = true;
    }
    if (anyCleaned) getContext().saveChat();
}

/** 清除所有聊天气泡中的匹配结果 */
export function cleanupAllChatResults() {
    $('.mc-ms-chat-results').remove();
}
