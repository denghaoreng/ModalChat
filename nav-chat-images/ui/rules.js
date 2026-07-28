// ui/rules.js — 规则列表渲染（含搜索/排序/批量/展开折叠/内联编辑）

import { getChatImagesData } from '../../core/data.js';
import { getRuleSets } from '../domain/rule-sets.js';
import { escapeHtml } from '../../shared/utils.js';

export function renderRules() {
    const data = getChatImagesData();
    let rules = data.rules || [];
    const ruleSets = getRuleSets();
    const selectedSet = $('#mc-ci-ruleset-filter').val() || '';
    const searchTerm = ($('#mc-ci-rule-search').val() || '').trim().toLowerCase();
    const sortBy = $('#mc-ci-rule-sort').val() || 'order';

    if (selectedSet) {
        rules = selectedSet === '__unbound' ? rules.filter(r => !r.ruleSetId) : rules.filter(r => r.ruleSetId === selectedSet);
    }
    if (searchTerm) {
        rules = rules.filter(r => r.name.toLowerCase().includes(searchTerm) || (r.regex || '').toLowerCase().includes(searchTerm));
    }
    if (sortBy === 'name') rules.sort((a, b) => a.name.localeCompare(b.name));
    else if (sortBy === 'name_desc') rules.sort((a, b) => b.name.localeCompare(a.name));
    else if (sortBy === 'order_desc') rules.sort((a, b) => (b.order || 0) - (a.order || 0));
    else rules.sort((a, b) => (a.order || 0) - (b.order || 0));

    let html = '<div style="font-size:0.85em;">';

    // 规则集筛选
    html += '<div style="text-align:center;margin:4px 0;">';
    html += '<select id="mc-ci-ruleset-filter" class="text_pole" style="width:90%;font-size:0.9em;">';
    html += '<option value="">未选择</option><option value="__unbound" ' + (selectedSet === '__unbound' ? 'selected' : '') + '>未绑定</option>';
    for (const rs of ruleSets) {
        html += `<option value="${escapeHtml(rs.id)}" ${selectedSet === rs.id ? 'selected' : ''}>${escapeHtml(rs.name)}</option>`;
    }
    html += '</select>';
    html += '</div>';

    // 批量操作 + 展开折叠
    html += '<div style="display:flex;gap:4px;margin:2px 0;justify-content:center;">';
    html += '<button id="mc-ci-batch-add" class="menu_button" style="font-size:0.85em;flex:1;"><i class="fa-solid fa-layer-group"></i> 批量</button>';
    html += '<button id="mc-ci-batch-edit" class="menu_button" style="font-size:0.85em;flex:1;" title="批量修改选中规则集的所有规则"><i class="fa-solid fa-pen-to-square"></i> 批量改</button>';
    html += '<button id="mc-ci-expand-all" class="menu_button menu_button_icon" title="展开全部" style="font-size:0.85em;"><i class="fa-solid fa-chevron-down"></i></button>';
    html += '<button id="mc-ci-collapse-all" class="menu_button menu_button_icon" title="折叠全部" style="font-size:0.85em;"><i class="fa-solid fa-chevron-right"></i></button>';
    html += '</div>';

    // 搜索 + 排序
    html += '<div style="display:flex;gap:4px;margin:4px 0;align-items:center;">';
    html += '<input id="mc-ci-rule-search" class="text_pole" type="text" placeholder="搜索规则..." style="flex:1;font-size:0.9em;padding:2px 6px;" value="' + escapeHtml(searchTerm) + '">';
    html += '<select id="mc-ci-rule-sort" class="text_pole" style="font-size:0.82em;width:auto;">';
    html += '<option value="order" ' + (sortBy === 'order' ? 'selected' : '') + '>顺序 ↑</option>';
    html += '<option value="name" ' + (sortBy === 'name' ? 'selected' : '') + '>名称 ↑</option>';
    html += '<option value="order_desc" ' + (sortBy === 'order_desc' ? 'selected' : '') + '>顺序 ↓</option>';
    html += '<option value="name_desc" ' + (sortBy === 'name_desc' ? 'selected' : '') + '>名称 ↓</option>';
    html += '</select>';
    html += '<button id="mc-ci-add-rule" class="menu_button menu_button_icon" title="添加规则"><i class="fa-solid fa-plus"></i></button>';
    html += '</div>';

    if (rules.length === 0) {
        html += '<div style="padding:20px;text-align:center;color:var(--grey40);font-size:0.85em;">' + (searchTerm || selectedSet ? '未找到匹配的规则' : '暂无规则，点击 + 添加') + '</div>';
    } else {
        for (const rule of rules) {
            const rs = rule.ruleSetId ? ruleSets.find(r => r.id === rule.ruleSetId) : null;
            const imgCount = (rule.images || []).length;
            const isExpanded = rule._expanded !== false;
            html += `
            <div class="mc-ci-rule-item" data-id="${escapeHtml(rule.id)}" style="border:1px solid var(--borderColor);border-radius:4px;padding:4px 6px;margin-bottom:4px;">
                <div style="display:flex;align-items:center;gap:4px;">
                    <span class="mc-ci-rule-collapse-btn menu_button menu_button_icon" style="font-size:0.75em;cursor:pointer;"><i class="fa-solid ${isExpanded ? 'fa-chevron-down' : 'fa-chevron-right'}"></i></span>
                    <input class="mc-ci-rule-name text_pole" value="${escapeHtml(rule.name)}" style="flex:1;font-size:0.85em;padding:2px 4px;font-weight:bold;">
                    <input class="mc-ci-rule-order text_pole" type="number" value="${rule.order ?? 0}" style="width:40px;font-size:0.78em;padding:1px 2px;text-align:center;" title="顺序">
                    <span style="font-size:0.75em;color:var(--grey40);">🖼️ ${imgCount}</span>
                    <label class="checkbox_label" style="font-size:0.8em;white-space:nowrap;">
                        <input type="checkbox" class="mc-ci-rule-enabled" ${rule.enabled ? 'checked' : ''}> <span>${rule.enabled ? '启用' : '禁用'}</span>
                    </label>
                    <button class="mc-ci-rule-images menu_button menu_button_icon" title="管理图片" style="font-size:0.8em;"><i class="fa-solid fa-images"></i></button>
                    <button class="mc-ci-rule-delete menu_button menu_button_icon" style="font-size:0.8em;color:var(--dangerColor);"><i class="fa-solid fa-trash-can"></i></button>
                </div>
                <div class="mc-ci-rule-collapsible" style="${isExpanded ? '' : 'display:none;'}">
                    <div style="display:flex;gap:4px;margin-top:4px;align-items:center;">
                        <span style="font-size:0.78em;color:var(--grey40);white-space:nowrap;">正则 /</span>
                        <input class="mc-ci-rule-regex text_pole" value="${escapeHtml(rule.regex || '')}" style="flex:1;font-size:0.82em;padding:2px 4px;font-family:monospace;">
                        <span style="font-size:0.78em;color:var(--grey40);">/gi</span>
                        <span style="font-size:0.78em;color:var(--grey40);white-space:nowrap;">时长</span>
                        <input class="mc-ci-rule-duration text_pole" type="number" value="${rule.duration || 5000}" style="width:60px;font-size:0.78em;padding:1px 2px;">
                        <span style="font-size:0.78em;color:var(--grey40);">ms</span>
                    </div>
                    <div style="font-size:0.75em;color:var(--grey40);margin-top:2px;">${rs ? '📎 ' + escapeHtml(rs.name) : '未分组'}</div>
                </div>
            </div>`;
        }
    }
    html += '</div>';
    return html;
}
