// matcher.js — 匹配引擎：正则匹配、加权随机、图片队列

import { getContext } from '../../../../extensions.js';
import { getEnabledRules } from './data.js';
import { getGeneralSettings, getRegistryById, getChatImagesData as getRulesData } from '../core/data.js';
import { escapeHtml, hexToRgb } from '../shared/utils.js';
import { getFileUrl } from '../nav-file-manager/file-url.js';

// 存储每个消息当前的图片队列定时器
const imageQueueTimers = new Map();

/** 清除指定消息的轮播定时器 */
export function clearImageTimer(messageId) {
    const timer = imageQueueTimers.get(messageId);
    if (timer) {
        clearTimeout(timer);
        imageQueueTimers.delete(messageId);
    }
}

/** 清除所有消息的轮播定时器（切换聊天时调用） */
export function clearAllImageTimers() {
    for (const [messageId, timer] of imageQueueTimers) {
        clearTimeout(timer);
    }
    imageQueueTimers.clear();
}

// ==================== 匹配逻辑 ====================

/** @type {number} 自增 generation，用于阻止滑动时陈旧 performMatch 的结果覆盖 */
let _ciGeneration = 0;

/**
 * 递增 generation 并清除指定消息的定时器（滑动时调用，防止旧定时器在异步匹配期间到期）
 * @param {number|string} messageId
 */
export function cancelPendingMatch(messageId) {
    _ciGeneration++;
    clearImageTimer(messageId);
}

export async function performMatch(text) {
    if (!text) return;
    const gen = _ciGeneration;

    const enabledRules = getEnabledRules();
    if (enabledRules.length === 0) {
        return;
    }

    const matchedBatches = [];
    const rulesData = getRulesData();
    const enabledCharSetIds = (rulesData.charSets || [])
        .filter(cs => cs.enabled)
        .map(cs => cs.id);
    let ruleSets = (rulesData.ruleSets || []).filter(s =>
        s.enabled && (!s.charSetId || enabledCharSetIds.includes(s.charSetId))
    );
    ruleSets.sort((a, b) => (a.order || 0) - (b.order || 0));

    const ungroupedRules = enabledRules.filter(r => !r.ruleSetId).sort((a, b) => (a.order || 0) - (b.order || 0));
    const ungroupedItems = [];
    for (const rule of ungroupedRules) {
        const item = await matchSingleRule(rule, text);
        if (item) ungroupedItems.push(item);
    }
    if (ungroupedItems.length > 0) {
        matchedBatches.push({ name: '未分组', items: ungroupedItems });
    }

    for (const rs of ruleSets) {
        const rsRules = enabledRules.filter(r => r.ruleSetId === rs.id).sort((a, b) => (a.order || 0) - (b.order || 0));
        const rsItems = [];
        for (const rule of rsRules) {
            const item = await matchSingleRule(rule, text);
            if (item) rsItems.push(item);
        }
        if (rsItems.length > 0) {
            matchedBatches.push({ name: rs.name, items: rsItems });
        }
    }

    // ⭐ 如果 generation 已变（用户又滑动了），丢弃此批结果
    if (gen !== _ciGeneration) return;

    if (matchedBatches.length === 0) return;

    const { chat } = getContext();
    const lastMsg = chat[chat.length - 1];
    const lastMsgId = chat.indexOf(lastMsg);
    if (lastMsgId < 0) return;

    queueBatchesForMessage(lastMsgId, matchedBatches);
}

export async function matchSingleRule(rule, text) {
    try {
        const pattern = sanitizeRegex(rule.regex);
        if (!pattern) {
            return null;
        }
        const regex = new RegExp(pattern, 'gi');
        const matched = regex.test(text);
        if (!matched) {
            return null;
        }
        const images = rule.images || [];
        if (images.length === 0) {
            return null;
        }

        // 通过注册表查询可用的图片
        const registryEntries = await Promise.all(images.map(img => getRegistryById(img.registryId)));
        const availableImages = images
            .map((img, i) => ({ ...img, registry: registryEntries[i] }))
            .filter(img => img.registry); // 跳过已从注册表删除的图片

        if (availableImages.length === 0) {
            return null;
        }

        const selected = selectImageByWeight(availableImages);
        if (!selected) {
            return null;
        }

        return {
            image: {
                registryId: selected.registryId,
                name: selected.registry?.displayName || '图片',
                filename: selected.registry?.serverFilename || '',
                url: getFileUrl(selected.registry),
            },
            ruleId: rule.id,
            order: rule.order ?? 0,
            duration: rule.duration ?? 0,
        };
    } catch (e) {
        console.error(`[聊天图片] 规则 "${rule.name}" 的正则执行错误`, e);
    }
    return null;
}

// ==================== 加权随机选择 ====================

export function selectImageByWeight(images) {
    if (!images || images.length === 0) return null;
    const totalWeight = images.reduce((sum, img) => sum + (img.weight || 0), 0);
    if (totalWeight <= 0) return null;
    let random = Math.random() * totalWeight;
    for (const img of images) {
        random -= (img.weight || 0);
        if (random <= 0) return img;
    }
    return images[images.length - 1];
}

// ==================== 工具函数 ====================

export function sanitizeRegex(input) {
    if (!input) return '';
    let pattern = input.trim();
    if (pattern.startsWith('/')) {
        let lastSlashIndex = -1;
        for (let i = pattern.length - 1; i > 0; i--) {
            if (pattern[i] === '/' && pattern[i - 1] !== '\\') {
                lastSlashIndex = i;
                break;
            }
        }
        if (lastSlashIndex > 0) {
            pattern = pattern.substring(1, lastSlashIndex);
        }
    }
    return pattern;
}

// ==================== 图片队列 ====================

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
                <img class="mes_img" src="${imgUrl}" width="${imgW}" height="${imgH}" style="max-width:100%;max-height:100%;width:${imgW}px;height:${imgH}px;object-fit:contain;" alt="${escapeHtml(item.image.name || '聊天图片')}" title="${escapeHtml(item.image.name || '聊天图片')}" onerror="chatImagesCleanupStaleImage(this)">
            </div>
        </div>`;
            // 插入到 mes_text 后面（放在消息末尾）
            const mesText = messageEl.find('.mes_text');
            if (mesText.length) {
                mesText.after(imageHtml);
            }

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
                    const timer = setTimeout(function () {
                        batchIndex++;
                        processNextBatch();
                    }, item.duration * 1000);
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
