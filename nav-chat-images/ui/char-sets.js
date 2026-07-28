// ui/char-sets.js — 角色集列表渲染（含搜索 + 内联编辑 + 关联计数）

import { getChatImagesData } from '../../core/data.js';
import { getRuleSets } from '../domain/rule-sets.js';
import { escapeHtml } from '../../shared/utils.js';

export function renderCharSets() {
    const data = getChatImagesData();
    let charSets = data.charSets || [];
    const searchTerm = ($('#mc-ci-cs-search').val() || '').trim().toLowerCase();
    if (searchTerm) {
        charSets = charSets.filter(cs => cs.name.toLowerCase().includes(searchTerm));
    }
    let html = '<div style="font-size:0.85em;">';
    html += '<div style="display:flex;gap:4px;margin-bottom:6px;align-items:center;">';
    html += '<input id="mc-ci-cs-search" class="text_pole" type="text" placeholder="搜索角色集..." style="flex:1;font-size:0.9em;padding:2px 6px;" value="' + escapeHtml(searchTerm) + '">';
    html += '<button id="mc-ci-add-charset" class="menu_button" style="font-size:0.82em;white-space:nowrap;"><i class="fa-solid fa-plus"></i></button>';
    html += '</div>';
    if (charSets.length === 0) {
        html += '<div style="padding:20px;text-align:center;color:var(--grey40);font-size:0.85em;">' + (searchTerm ? '未找到匹配的角色集' : '暂无角色集，点击 + 添加') + '</div>';
    } else {
        for (const cs of charSets) {
            const rsCount = getRuleSets().filter(rs => rs.charSetId === cs.id).length;
            html += `
            <div class="mc-ci-cs-item" data-id="${escapeHtml(cs.id)}" style="display:flex;align-items:center;gap:6px;padding:4px 6px;border:1px solid var(--borderColor);border-radius:4px;margin-bottom:4px;">
                <input class="mc-ci-cs-name text_pole" value="${escapeHtml(cs.name)}" style="flex:1;font-size:0.85em;padding:2px 4px;">
                <label class="checkbox_label" style="font-size:0.8em;white-space:nowrap;">
                    <input type="checkbox" class="mc-ci-cs-enabled" ${cs.enabled ? 'checked' : ''}> <span>${cs.enabled ? '启用中' : '启用'}</span>
                </label>
                <span style="font-size:0.75em;color:var(--grey40);">${rsCount} 规则集</span>
                <button class="mc-ci-cs-edit menu_button menu_button_icon" title="编辑此角色集下的规则集" style="font-size:0.8em;"><i class="fa-solid fa-pen-to-square"></i></button>
                <button class="mc-ci-cs-delete menu_button menu_button_icon" style="font-size:0.8em;color:var(--dangerColor);"><i class="fa-solid fa-trash-can"></i></button>
            </div>`;
        }
    }
    html += '</div>';
    return html;
}
