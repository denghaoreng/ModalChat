// domain/rule-sets.js — 规则集 CRUD（含级联删规则）

import { getChatImagesData, saveSettings } from '../../core/data.js';
import { generateId } from '../../shared/utils.js';

function d() { return getChatImagesData(); }

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
    d().rules = d().rules.filter(r => r.ruleSetId !== id);
    saveSettings();
}
