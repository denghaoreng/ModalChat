// ui/rule-sets.js — 图片集列表渲染（含角色集绑定 + 搜索 + 排序 + 内联编辑）

import { getChatImagesData } from '../../core/data.js';
import { getCharSets } from '../domain/char-sets.js';
import { escapeHtml } from '../../shared/utils.js';

let _lastRsCharSelect = '';

export function saveRsCharSelect() {
    const $el = $('#mc-ci-rs-charselect');
    if ($el.length) _lastRsCharSelect = $el.val() || '';
}

export function renderRuleSets() {
    const data = getChatImagesData();
    let ruleSets = data.ruleSets || [];
    const charSets = getCharSets();
    const selectedChar = _lastRsCharSelect || $('#mc-ci-rs-charselect').val() || '';
    const searchTerm = ($('#mc-ci-rs-search').val() || '').trim().toLowerCase();
    const sortBy = $('#mc-ci-rs-sort').val() || 'order';

    // 按角色集筛选
    if (selectedChar && selectedChar !== '__unbound') {
        ruleSets = ruleSets.filter(rs => rs.charSetId === selectedChar);
    } else if (selectedChar === '__unbound') {
        ruleSets = ruleSets.filter(rs => !rs.charSetId);
    }

    if (searchTerm) {
        ruleSets = ruleSets.filter(rs => rs.name.toLowerCase().includes(searchTerm));
    }
    if (sortBy === 'name') ruleSets.sort((a, b) => a.name.localeCompare(b.name));
    else ruleSets.sort((a, b) => (a.order || 0) - (b.order || 0));

    let charOpts = '<option value="">全部</option><option value="__unbound" ' + (selectedChar === '__unbound' ? 'selected' : '') + '>未绑定</option>';
    for (const cs of charSets) {
        charOpts += `<option value="${escapeHtml(cs.id)}" ${selectedChar === cs.id ? 'selected' : ''}>${escapeHtml(cs.name)}</option>`;
    }

    let html = '<div style="font-size:0.85em;">';
    html += '<div style="text-align:center;margin:4px 0;">';
    html += `<select id="mc-ci-rs-charselect" class="text_pole" style="width:90%;font-size:0.9em;">${charOpts}</select>`;
    html += '</div>';
    html += '<div style="display:flex;gap:4px;margin-bottom:6px;align-items:center;">';
    html += '<input id="mc-ci-rs-search" class="text_pole" type="text" placeholder="搜索图片集..." style="flex:1;font-size:0.9em;padding:2px 6px;" value="' + escapeHtml(searchTerm) + '">';
    html += '<select id="mc-ci-rs-sort" class="text_pole" style="font-size:0.82em;width:auto;">';
    html += '<option value="order" ' + (sortBy === 'order' ? 'selected' : '') + '>顺序 ↑</option>';
    html += '<option value="name" ' + (sortBy === 'name' ? 'selected' : '') + '>名称 ↑</option>';
    html += '</select>';
    html += '<button id="mc-ci-add-ruleset" class="menu_button" style="font-size:0.82em;white-space:nowrap;"><i class="fa-solid fa-plus"></i></button>';
    html += '</div>';
    if (ruleSets.length === 0) {
        html += '<div style="padding:20px;text-align:center;color:var(--grey40);font-size:0.85em;">' + (searchTerm || selectedChar ? '未找到匹配的图片集' : '暂无图片集，点击 + 添加') + '</div>';
    } else {
        for (const rs of ruleSets) {
            const boundChar = rs.charSetId ? charSets.find(c => c.id === rs.charSetId) : null;
            const rulesCount = (data.rules || []).filter(r => r.ruleSetId === rs.id).length;
            html += `
            <div class="mc-ci-rs-item" data-id="${escapeHtml(rs.id)}" style="display:flex;align-items:center;gap:6px;padding:4px 6px;border:1px solid var(--borderColor);border-radius:4px;margin-bottom:4px;">
                <input class="mc-ci-rs-name text_pole" value="${escapeHtml(rs.name)}" style="flex:1;font-size:0.85em;padding:2px 4px;">
                <span style="font-size:0.75em;color:var(--grey40);white-space:nowrap;">${boundChar ? '📎 ' + escapeHtml(boundChar.name) : '未绑定'} </span>
                <label class="checkbox_label" style="font-size:0.8em;white-space:nowrap;">
                    <input type="checkbox" class="mc-ci-rs-enabled" ${rs.enabled ? 'checked' : ''}> <span>${rs.enabled ? '启用中' : '启用'}</span>
                </label>
                <span style="font-size:0.75em;color:var(--grey40);">🖼️ ${rulesCount}</span>
                <button class="mc-ci-rs-jump menu_button menu_button_icon" title="查看图片" style="font-size:0.8em;"><i class="fa-solid fa-list"></i></button>
                <button class="mc-ci-rs-delete menu_button menu_button_icon" style="font-size:0.8em;color:var(--dangerColor);"><i class="fa-solid fa-trash-can"></i></button>
            </div>`;
        }
    }
    html += '</div>';
    return html;
}
