// nav-chat-images/data.js — 规则/规则集/角色集数据

import { getChatImagesData, saveSettings, currentSettings } from '../data.js';
import { generateId } from '../shared/utils.js';
import { getFileUrl } from '../nav-file-manager/file-url.js';

// ===== 获取模块数据 =====
function d() { return getChatImagesData(); }

// ===== 规则 CRUD =====

export function getRules() { return d().rules || []; }

export function getRuleById(id) { return (d().rules || []).find(r => r.id === id); }

export function addRule(data) {
    const rule = {
        id: generateId('rule'),
        name: data.name || '新规则',
        regex: data.regex || '',
        enabled: true,
        order: d().rules.length,
        duration: data.duration || 5000,
        ruleSetId: data.ruleSetId || '',
        images: [], // [{ registryId, weight }]
        _expanded: true,
    };
    d().rules.push(rule);
    saveSettings();
    return rule;
}

export function updateRule(id, updates) {
    const rule = getRuleById(id);
    if (rule) { Object.assign(rule, updates); saveSettings(); }
}

export function deleteRule(id) {
    d().rules = d().rules.filter(r => r.id !== id);
    saveSettings();
}

// ===== 规则集 CRUD =====

export function getRuleSets() { return d().ruleSets || []; }

export function addRuleSet(data) {
    const rs = {
        id: generateId('ruleset'),
        name: data.name || '新规则集',
        enabled: true,
        order: d().ruleSets.length,
        charSetId: data.charSetId || '',
    };
    d().ruleSets.push(rs);
    saveSettings();
    return rs;
}

export function updateRuleSet(id, updates) {
    const rs = d().ruleSets.find(r => r.id === id);
    if (rs) { Object.assign(rs, updates); saveSettings(); }
}

export function deleteRuleSet(id) {
    d().ruleSets = d().ruleSets.filter(r => r.id !== id);
    // 同时删除该规则集下的规则
    d().rules = d().rules.filter(r => r.ruleSetId !== id);
    saveSettings();
}

// ===== 角色集 CRUD =====

export function getCharSets() { return d().charSets || []; }

export function addCharSet(data) {
    const cs = {
        id: generateId('charset'),
        name: data.name || '新角色集',
        enabled: true,
    };
    d().charSets.push(cs);
    saveSettings();
    return cs;
}

export function updateCharSet(id, updates) {
    const cs = d().charSets.find(c => c.id === id);
    if (cs) { Object.assign(cs, updates); saveSettings(); }
}

export function deleteCharSet(id) {
    d().charSets = d().charSets.filter(c => c.id !== id);
    // 清理引用该角色集的规则集
    d().ruleSets = d().ruleSets.filter(rs => rs.charSetId !== id);
    saveSettings();
}

// ===== 启用规则过滤 =====

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

// ===== 图片引用操作（通过注册表） =====

export function addImageToRule(ruleId, registryId, weight = 50) {
    const rule = getRuleById(ruleId);
    if (rule) {
        rule.images.push({ registryId, weight });
        saveSettings();
    }
}

export function removeImageFromRule(ruleId, registryId) {
    const rule = getRuleById(ruleId);
    if (rule) {
        rule.images = rule.images.filter(img => img.registryId !== registryId);
        saveSettings();
    }
}

export function getImageUrlByRegistry(registryId) {
    return getFileUrl(registryId);
}
