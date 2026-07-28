// matcher/queue.js — 图片队列定时器管理

import { getGeneralSettings } from '../../core/data.js';
import { getContext } from '../../../../../extensions.js';
import { escapeHtml, hexToRgb } from '../../shared/utils.js';

/** @type {Map<string|number, number>} 每个消息的轮播定时器 */
const imageQueueTimers = new Map();

/** 清除指定消息的轮播定时器 */
export function clearImageTimer(messageId) {
    const timer = imageQueueTimers.get(messageId);
    if (timer) {
        clearTimeout(timer);
        imageQueueTimers.delete(messageId);
    }
}

/** 清除所有消息的轮播定时器 */
export function clearAllImageTimers() {
    for (const [, timer] of imageQueueTimers) clearTimeout(timer);
    imageQueueTimers.clear();
}

/** @type {number} 自增 generation，阻止陈旧异步结果覆盖 */
let _ciGeneration = 0;

/** 递增 generation 并清除指定消息的定时器（滑动时调用） */
export function cancelPendingMatch(messageId) {
    _ciGeneration++;
    clearImageTimer(messageId);
}

/** 获取当前 generation（供 engine.js 检查过期） */
export function getGeneration() { return _ciGeneration; }

/**
 * 按批次将图片队列渲染到聊天气泡
 * @param {number|string} messageId
 * @param {Array} batches
 */
export function queueBatchesForMessage(messageId, batches) {
    const oldTimer = imageQueueTimers.get(messageId);
    if (oldTimer) clearTimeout(oldTimer);

    let batchIndex = 0;

    function processNextBatch() {
        if (batchIndex >= batches.length) return;
        const batch = batches[batchIndex];
        const items = [...batch.items].sort((a, b) => (a.order || 0) - (b.order || 0));
        let itemIndex = 0;

        function showCurrentItem() {
            if (itemIndex >= items.length) {
                batchIndex++;
                processNextBatch();
                return;
            }

            const item = items[itemIndex];
            const imgUrl = item.image.url;

            const messageEl = $(`.mes[mesid="${messageId}"]`);
            messageEl.find('img[src*="chat-images_"]').closest('.mes_media_container').remove();
            messageEl.find('.chat-image-queued, [data-rule-id]').remove();

            if (!imgUrl || !messageEl.length) {
                itemIndex++;
                showCurrentItem();
                return;
            }

            const gs = getGeneralSettings();
            const imgW = gs.imageWidth ?? 500;
            const imgH = gs.imageHeight ?? 500;
            const bgColor = gs.frameBackgroundColor ?? '#000000';
            const bgOpacity = gs.frameBackgroundOpacity ?? 1;
            const bgRgb = hexToRgb(bgColor);
            const imageHtml = `
        <div class="mes_media_container mes_img_container chat-image-queued" data-index="${Date.now()}" data-rule-id="${item.ruleId || ''}">
            <div class="chat-image-frame" style="max-width:100%;background:rgba(${bgRgb},${bgOpacity});">
                <img class="mes_img" src="${imgUrl}" width="${imgW}" height="${imgH}" style="max-width:100%;max-height:100%;width:${imgW}px;height:${imgH}px;object-fit:contain;" alt="${escapeHtml(item.image.name || '聊天图片')}" title="${escapeHtml(item.image.name || '聊天图片')}" onerror="this.closest('.chat-image-queued')?.remove()">
            </div>
        </div>`;
            const mesText = messageEl.find('.mes_text');
            if (mesText.length) mesText.after(imageHtml);

            const { chat, saveChat } = getContext();
            const msg = chat[messageId];
            if (msg) {
                if (!msg.extra) msg.extra = {};
                msg.extra.chatImages = [{ url: imgUrl, name: item.image.name || '聊天图片', filename: item.image.filename }];
                saveChat();
            }

            itemIndex++;

            if (itemIndex < items.length && item.duration > 0) {
                const timer = setTimeout(showCurrentItem, item.duration * 1000);
                imageQueueTimers.set(messageId, timer);
            } else if (itemIndex >= items.length) {
                if (item.duration > 0) {
                    const timer = setTimeout(() => { batchIndex++; processNextBatch(); }, item.duration * 1000);
                    imageQueueTimers.set(messageId, timer);
                } else {
                    batchIndex++;
                    setTimeout(processNextBatch, 100);
                }
            }
        }
        showCurrentItem();
    }
    processNextBatch();
}
