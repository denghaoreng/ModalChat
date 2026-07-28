// matcher/single-rule.js — 单条规则匹配

import { getRegistryById } from '../../core/data.js';
import { getFileUrl } from '../../nav-file-manager/file-url.js';
import { sanitizeRegex } from './utils.js';
import { selectImageByWeight } from './utils.js';

/**
 * 对单条规则执行匹配
 * @param {object} rule
 * @param {string} text
 * @returns {Promise<object|null>}
 */
export async function matchSingleRule(rule, text) {
    try {
        const pattern = sanitizeRegex(rule.regex);
        if (!pattern) return null;

        const regex = new RegExp(pattern, 'gi');
        if (!regex.test(text)) return null;

        const images = rule.images || [];
        if (images.length === 0) return null;

        const registryEntries = await Promise.all(images.map(img => getRegistryById(img.registryId)));
        const availableImages = images
            .map((img, i) => ({ ...img, registry: registryEntries[i] }))
            .filter(img => img.registry);

        if (availableImages.length === 0) return null;

        const selected = selectImageByWeight(availableImages);
        if (!selected) return null;

        const fileType = selected.registry?.type || 'image';
        return {
            image: {
                registryId: selected.registryId,
                name: selected.registry?.displayName || (fileType === 'video' ? '视频' : fileType === 'audio' ? '音频' : '图片'),
                filename: selected.registry?.serverFilename || '',
                url: await getFileUrl(selected.registry),
                type: fileType,
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
