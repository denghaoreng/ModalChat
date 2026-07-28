// domain/rules.js — 规则 CRUD

import { getChatImagesData, saveSettings } from '../../core/data.js';
import { generateId } from '../../shared/utils.js';

function d() { return getChatImagesData(); }

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
        images: [],
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
