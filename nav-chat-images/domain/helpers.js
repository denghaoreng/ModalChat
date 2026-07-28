// domain/helpers.js — 启用规则过滤 + 图片引用操作

import { getChatImagesData, saveSettings } from '../../core/data.js';
import { getFileUrl } from '../../nav-file-manager/file-url.js';

function d() { return getChatImagesData(); }

/** 获取当前启用的规则（按角色集/规则集启用链过滤） */
export function getEnabledRules() {
    const data = d();
    const enabledCharSetIds = (data.charSets || []).filter(cs => cs.enabled).map(cs => cs.id);
    const enabledRuleSetIds = (data.ruleSets || []).filter(rs =>
        rs.enabled && (!rs.charSetId || enabledCharSetIds.includes(rs.charSetId))
    ).map(rs => rs.id);

    return (data.rules || []).filter(r =>
        r.enabled && (!r.ruleSetId || enabledRuleSetIds.includes(r.ruleSetId))
    );
}

/** 为规则添加图片引用 */
export function addImageToRule(ruleId, registryId, weight = 50) {
    const rule = (d().rules || []).find(r => r.id === ruleId);
    if (rule) {
        rule.images.push({ registryId, weight });
        saveSettings();
    }
}

/** 从规则移除图片引用 */
export function removeImageFromRule(ruleId, registryId) {
    const rule = (d().rules || []).find(r => r.id === ruleId);
    if (rule) {
        rule.images = rule.images.filter(img => img.registryId !== registryId);
        saveSettings();
    }
}

/** 通过注册表 ID 获取图片 URL */
export function getImageUrlByRegistry(registryId) {
    return getFileUrl(registryId);
}
