// carousel/persist.js — 聊天图片结果持久化、恢复、清理

import { getContext } from '../../../../../extensions.js';
import { getChatImagesData } from '../../core/data.js';
import { renderCIResults } from './bubble.js';

/** 持久化聊天图片结果到 chat.extra */
export function persistCIResults(messageId, items) {
    if (!messageId || !items) return;
    const { chat } = getContext();
    let msg = chat.find(m => m.id === messageId);
    if (!msg && /^\d+$/.test(String(messageId))) {
        msg = chat[parseInt(messageId)];
    }
    if (!msg) msg = chat[chat.length - 1];
    if (!msg) return;
    if (!msg.extra) msg.extra = {};
    msg.extra.chatImagesResults = items.map(item => ({
        image: { url: item.image?.url || '', name: item.image?.name || '' },
        ruleId: item.ruleId,
        order: item.order,
        duration: item.duration,
    }));
}

/** 从 chat.extra 恢复聊天图片结果 */
export function restoreCIResults() {
    try {
        const { chat } = getContext();
        const pending = [];
        for (let i = 0; i < chat.length; i++) {
            const msg = chat[i];
            const has = msg?.extra?.chatImagesResults?.length;
            if (i === 0 && !msg.is_user) { if (has) { delete msg.extra.chatImagesResults; continue; } }
            if (msg.is_user) { if (has) { delete msg.extra.chatImagesResults; continue; } }
            if (!has) continue;
            pending.push({ index: i, items: msg.extra.chatImagesResults });
        }
        // 分批渲染
        const BATCH_SIZE = 3;
        let idx = 0;
        function renderBatch() {
            const end = Math.min(idx + BATCH_SIZE, pending.length);
            for (; idx < end; idx++) {
                const p = pending[idx];
                renderCIResults(p.index, p.items);
            }
            if (idx < pending.length) {
                requestAnimationFrame(renderBatch);
            }
        }
        if (pending.length > 0) {
            requestAnimationFrame(renderBatch);
        }
    } catch (err) {
        console.warn('ModalChat CI: restoreCIResults error', err);
    }
}

/** 删除文件后清理残留引用 */
export function cleanupStaleCIResults(fileUrl) {
    const { chat } = getContext();
    let anyCleaned = false;
    for (const msg of chat) {
        if (!msg?.extra?.chatImagesResults?.length) continue;
        const before = msg.extra.chatImagesResults.length;
        msg.extra.chatImagesResults = msg.extra.chatImagesResults.filter(r => r.image?.url !== fileUrl);
        if (msg.extra.chatImagesResults.length !== before) anyCleaned = true;
    }
    if (anyCleaned) getContext().saveChat();
}
