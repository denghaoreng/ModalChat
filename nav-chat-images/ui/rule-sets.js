// ui/rule-sets.js — 规则集列表渲染（含角色集绑定 + 搜索 + 排序 + 内联编辑）

import { getChatImagesData } from '../../core/data.js';
import { getCharSets } from '../domain/char-sets.js';
import { escapeHtml } from '../../shared/utils.js';

export function renderRuleSets() {
    const data = getChatImagesData();
    let ruleSets = data.ruleSets || [];
    const charSets = getCharSets();
    const searchTerm = ($('#mc-ci-rs-search').val() || '').trim().toLowerCase();
    const sortBy = $('#mc-ci-rs-sort').val() || 'order';
    if (searchTerm) {
        ruleSets = ruleSets.filter(rs => rs.name.toLowerCase().includes(searchTerm));
    }
    if (sortBy === 'name') ruleSets.sort((a, b) => a.name.localeCompare(b.name));
    else ruleSets.sort((a, b) => (a.order || 0) - (b.order || 0));

    let charOpts = '<option value="">未选择</option><option value="__unbound">未绑定</option>';
    for (const cs of charSets) {
        charOpts += `<option value="${escapeHtml(cs.id)}">${escapeHtml(cs.name)}</option>`;
    }

    let html = '<div style="font-size:0.85em;">';
    html += '<div style="text-align:center;margin:4px 0;">';
    html += `<select id="mc-ci-rs-charselect" class="text_pole" style="width:90%;font-size:0.9em;">${charOpts}</select>`;
    html += '</div>';
    html += '<div style="display:flex;gap:4px;margin-bottom:6px;align-items:center;">';
    html += '<input id="mc-ci-rs-search" class="text_pole" type="text" placeholder="搜索规则集..." style="flex:1;font-size:0.9em;padding:2px 6px;" value="' + escapeHtml(searchTerm) + '">';
    html += '<select id="mc-ci-rs-sort" class="text_pole" style="font-size:0.82em;width:auto;">';
    html += '<option value="order" ' + (sortBy === 'order' ? 'selected' : '') + '>顺序 ↑</option>';
    html += '<option value="name" ' + (sortBy === 'name' ? 'selected' : '') + '>名称 ↑</option>';
    html += '</select>';
    html += '<button id="mc-ci-add-ruleset" class="menu_button" style="font-size:0.82em;white-space:nowrap;"><i class="fa-solid fa-plus"></i></button>';
    html += '</div>';
    if (ruleSets.length === 0) {
        html += '<div style="padding:20px;text-align:center;color:var(--grey40);font-size:0.85em;">' + (searchTerm ? '未找到匹配的规则集' : '暂无规则集，点击 + 添加') + '</div>';
    } else {
        for (const rs of ruleSets) {
            const boundChar = rs.charSetId ? charSets.find(c => c.id === rs.charSetId) : null;
            html += `
            <div class="mc-ci-rs-item" data-id="${escapeHtml(rs.id)}" style="display:flex;align-items:center;gap:6px;padding:4px 6px;border:1px solid var(--borderColor);border-radius:4px;margin-bottom:4px;">
                <input class="mc-ci-rs-name text_pole" value="${escapeHtml(rs.name)}" style="flex:1;font-size:0.85em;padding:2px 4px;">
                <span style="font-size:0.75em;color:var(--grey40);white-space:nowrap;">${boundChar ? '📎 ' + escapeHtml(boundChar.name) : '未绑定'} </span>
                <label class="checkbox_label" style="font-size:0.8em;white-space:nowrap;">
                    <input type="checkbox" class="mc-ci-rs-enabled" ${rs.enabled ? 'checked' : ''}> <span>${rs.enabled ? '启用中' : '启用'}</span>
                </label>
                <button class="mc-ci-rs-delete menu_button menu_button_icon" style="font-size:0.8em;color:var(--dangerColor);"><i class="fa-solid fa-trash-can"></i></button>
            </div>`;
        }
    }
    html += '</div>';
    return html;
}
