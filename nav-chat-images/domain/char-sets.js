// domain/char-sets.js — 角色集 CRUD（含级联删规则集）

import { getChatImagesData, saveSettings } from '../../core/data.js';
import { generateId } from '../../shared/utils.js';

function d() { return getChatImagesData(); }

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
    d().ruleSets = d().ruleSets.filter(rs => rs.charSetId !== id);
    saveSettings();
}
