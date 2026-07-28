// matcher/engine.js — 匹配主逻辑

import { getContext } from '../../../../../extensions.js';
import { getRegistryById, getChatImagesData as getRulesData } from '../../core/data.js';
import { getFileUrl } from '../../nav-file-manager/file-url.js';
import { getEnabledRules } from '../domain/helpers.js';
import { selectImageByWeight, sanitizeRegex } from './utils.js';
import { getGeneration, queueBatchesForMessage } from './queue.js';
import { matchSingleRule } from './single-rule.js'; // 本文件同时导出

/**
 * 对文本执行匹配
 * @param {string} text
 */
export async function performMatch(text) {
    if (!text) return;

    const enabledRules = getEnabledRules();
    if (enabledRules.length === 0) return;

    const gen = getGeneration();
    const matchedBatches = [];
    const rulesData = getRulesData();
    const enabledCharSetIds = (rulesData.charSets || [])
        .filter(cs => cs.enabled).map(cs => cs.id);
    let ruleSets = (rulesData.ruleSets || []).filter(s =>
        s.enabled && (!s.charSetId || enabledCharSetIds.includes(s.charSetId))
    );
    ruleSets.sort((a, b) => (a.order || 0) - (b.order || 0));

    // 未分组规则
    const ungroupedRules = enabledRules.filter(r => !r.ruleSetId).sort((a, b) => (a.order || 0) - (b.order || 0));
    const ungroupedItems = [];
    for (const rule of ungroupedRules) {
        const item = await matchSingleRule(rule, text);
        if (item) ungroupedItems.push(item);
    }
    if (ungroupedItems.length > 0) {
        matchedBatches.push({ name: '未分组', items: ungroupedItems });
    }

    // 按规则集分组
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

    if (getGeneration() !== gen) return; // 滑动过期
    if (matchedBatches.length === 0) return;

    const { chat } = getContext();
    const lastMsg = chat[chat.length - 1];
    const lastMsgId = chat.indexOf(lastMsg);
    if (lastMsgId < 0) return;

    queueBatchesForMessage(lastMsgId, matchedBatches);
}
