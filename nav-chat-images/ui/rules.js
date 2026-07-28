// ui/rules.js — 规则列表渲染（含搜索/排序/批量/展开折叠/内联编辑）

import { getChatImagesData } from '../../core/data.js';
import { getRuleSets } from '../domain/rule-sets.js';
import { getImageUrlByRegistry } from '../domain/helpers.js';
import { escapeHtml } from '../../shared/utils.js';

/** 保存上次的规则集筛选值，在导航切换时保持不重置 */
let _lastRulesetFilter = '';
let _lastRuleSearchTerm = '';
let _rulePage = 1;
let _rulePageSize = 10;

export function saveRulesetFilter() {
    const $el = $('#mc-ci-ruleset-filter');
    if ($el.length) _lastRulesetFilter = $el.val() || '';
}

export function triggerRuleSearch() {
    _lastRuleSearchTerm = ($('#mc-ci-rule-search').val() || '').trim().toLowerCase();
    _rulePage = 1;
}

export function triggerRuleSearchClear() {
    _lastRuleSearchTerm = '';
    _rulePage = 1;
    $('#mc-ci-rule-search').val('');
}

export function getRulePage() { return _rulePage; }
export function setRulePage(page) { _rulePage = Math.max(1, page); }
export function setRulePageSize(size) { _rulePageSize = size; if (_rulePage > 1) _rulePage = 1; }

export async function renderRules() {
    const data = getChatImagesData();
    let rules = data.rules || [];
    const ruleSets = getRuleSets();
    const selectedSet = _lastRulesetFilter || $('#mc-ci-ruleset-filter').val() || '';
    const searchTerm = _lastRuleSearchTerm;
    const sortBy = $('#mc-ci-rule-sort').val() || 'order';
    const pageSize = _rulePageSize;

    // 预解析所有图片 URL（getImageUrlByRegistry 是异步的）
    const urlCache = {};
    const allRegIds = new Set();
    for (const r of rules) for (const img of (r.images || [])) allRegIds.add(img.registryId);
    await Promise.all([...allRegIds].map(async id => { urlCache[id] = await getImageUrlByRegistry(id); }));

    if (selectedSet) {
        if (selectedSet === '__unbound') {
            const validRsIds = new Set(ruleSets.map(rs => rs.id));
            rules = rules.filter(r => !r.ruleSetId || !validRsIds.has(r.ruleSetId));
        } else {
            rules = rules.filter(r => r.ruleSetId === selectedSet);
        }
    }
    if (searchTerm) {
        rules = rules.filter(r => r.name.toLowerCase().includes(searchTerm) || (r.regex || '').toLowerCase().includes(searchTerm));
    }
    if (sortBy === 'name') rules.sort((a, b) => a.name.localeCompare(b.name));
    else if (sortBy === 'name_desc') rules.sort((a, b) => b.name.localeCompare(a.name));
    else if (sortBy === 'order_desc') rules.sort((a, b) => (b.order || 0) - (a.order || 0));
    else rules.sort((a, b) => (a.order || 0) - (b.order || 0));

    // 分页
    const totalRules = rules.length;
    const totalRulePages = Math.max(1, Math.ceil(totalRules / pageSize));
    if (_rulePage > totalRulePages) _rulePage = totalRulePages;
    const ruleStart = (_rulePage - 1) * pageSize;
    const pageRules = rules.slice(ruleStart, ruleStart + pageSize);

    let html = '<div style="font-size:0.85em;">';

    // 规则集筛选
    html += '<div style="text-align:center;margin:4px 0;">';
    html += '<select id="mc-ci-ruleset-filter" class="text_pole" style="width:90%;font-size:0.9em;">';
    html += '<option value="">全部</option><option value="__unbound" ' + (selectedSet === '__unbound' ? 'selected' : '') + '>未绑定</option>';
    for (const rs of ruleSets) {
        html += `<option value="${escapeHtml(rs.id)}" ${selectedSet === rs.id ? 'selected' : ''}>${escapeHtml(rs.name)}</option>`;
    }
    html += '</select>';
    html += '</div>';

    // 批量操作 + 展开折叠
    html += '<div style="display:flex;gap:4px;margin:2px 0;justify-content:center;">';
    html += '<button id="mc-ci-batch-add" class="menu_button" style="font-size:0.85em;flex:1;"><i class="fa-solid fa-layer-group"></i> 批量增</button>';
    html += '<button id="mc-ci-batch-edit" class="menu_button" style="font-size:0.85em;flex:1;" title="批量修改所选规则集的所有规则"><i class="fa-solid fa-pen-to-square"></i> 批量改</button>';
    html += '<button id="mc-ci-expand-all" class="menu_button menu_button_icon" title="展开全部" style="font-size:0.85em;"><i class="fa-solid fa-chevron-down"></i></button>';
    html += '<button id="mc-ci-collapse-all" class="menu_button menu_button_icon" title="折叠全部" style="font-size:0.85em;"><i class="fa-solid fa-chevron-right"></i></button>';
    html += '</div>';

    // 搜索 + 排序
    html += '<div style="display:flex;gap:4px;margin:4px 0;align-items:center;">';
    html += '<input id="mc-ci-rule-search" class="text_pole" type="text" placeholder="搜索图片..." style="flex:1;font-size:0.9em;padding:2px 6px;" value="' + escapeHtml(searchTerm) + '">';
    html += '<button id="mc-ci-rule-search-btn" class="menu_button" style="font-size:0.82em;white-space:nowrap;"><i class="fa-solid fa-search"></i></button>';
    html += '<select id="mc-ci-rule-sort" class="text_pole" style="font-size:0.82em;width:auto;">';
    html += '<option value="order" ' + (sortBy === 'order' ? 'selected' : '') + '>顺序 ↑</option>';
    html += '<option value="name" ' + (sortBy === 'name' ? 'selected' : '') + '>名称 ↑</option>';
    html += '<option value="order_desc" ' + (sortBy === 'order_desc' ? 'selected' : '') + '>顺序 ↓</option>';
    html += '<option value="name_desc" ' + (sortBy === 'name_desc' ? 'selected' : '') + '>名称 ↓</option>';
    html += '</select>';
    html += '<button id="mc-ci-add-rule" class="menu_button menu_button_icon" title="添加规则"><i class="fa-solid fa-plus"></i></button>'
    html += '</div>';

    // 分页控件（搜索栏下方，列表上方）
    html += `<div style="display:flex;align-items:center;gap:8px;justify-content:center;margin-bottom:6px;font-size:0.82em;">
        <button id="mc-ci-rule-page-prev" class="menu_button" style="font-size:0.8em;white-space:nowrap;" ${_rulePage <= 1 ? 'disabled' : ''}>◀ 上一页</button>
        <span>${_rulePage}/${totalRulePages}</span>
        <button id="mc-ci-rule-page-next" class="menu_button" style="font-size:0.8em;white-space:nowrap;" ${_rulePage >= totalRulePages ? 'disabled' : ''}>下一页 ▶</button>
        <span>每页</span>
        <input id="mc-ci-rule-page-size" class="text_pole" type="number" value="${pageSize}" min="0" max="1000" style="width:55px;font-size:0.85em;text-align:center;padding:2px 4px;">
        <span>个</span>
        <span style="font-size:0.8em;color:var(--grey40);">共 ${totalRules} 个</span>
    </div>`;

    if (totalRules === 0) {
        html += '<div style="padding:20px;text-align:center;color:var(--grey40);font-size:0.85em;">' + (searchTerm || selectedSet ? '未找到匹配的图片' : '暂无图片，点击 + 添加') + '</div>';
    } else {
        for (const rule of pageRules) {
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
                    <button class="mc-ci-rule-copy menu_button menu_button_icon" title="复制图片" style="font-size:0.8em;"><i class="fa-regular fa-copy"></i></button>
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
                    <div style="font-size:0.75em;color:var(--grey40);margin-top:2px;">${rs ? '📎 ' + escapeHtml(rs.name) : '未绑定'}</div>
                    <div class="mc-ci-rule-images-list" style="display:flex;gap:6px;margin-top:6px;flex-wrap:wrap;">
                        ${renderRuleImages(rule, urlCache)}
                    </div>
                </div>
            </div>`;
        }
    }
    html += '</div>';
    return html;
}

function renderRuleImages(rule, urlCache) {
    const images = rule.images || [];
    if (images.length === 0) {
        return '<span style="opacity:0.5;font-size:0.85em;">暂无图片</span>';
    }
    return images.map(img => {
        const url = urlCache[img.registryId];
        return `
        <div class="mc-ci-rule-image-item" data-reg-id="${escapeHtml(img.registryId)}" style="display:flex;flex-direction:column;align-items:center;gap:2px;border:1px solid var(--borderColor);border-radius:4px;padding:3px;width:80px;">
            <div style="width:70px;height:50px;overflow:hidden;border-radius:3px;background:var(--bg);display:flex;align-items:center;justify-content:center;">
                ${url ? `<img src="${escapeHtml(url)}" style="max-width:100%;max-height:100%;object-fit:contain;" loading="lazy">` : '<i class="fa-solid fa-image" style="color:var(--grey40);font-size:1.2em;"></i>'}
            </div>
            <div style="display:flex;align-items:center;gap:2px;width:100%;font-size:0.7em;">
                <input type="range" class="mc-ci-img-weight" data-reg-id="${escapeHtml(img.registryId)}" value="${img.weight ?? 50}" min="0" max="100" style="flex:1;height:2px;">
                <span class="mc-ci-img-wv" style="min-width:16px;text-align:right;">${img.weight ?? 50}</span>
                <button class="mc-ci-img-delete menu_button menu_button_icon" data-reg-id="${escapeHtml(img.registryId)}" style="font-size:0.7em;padding:0 2px;color:var(--dangerColor);"><i class="fa-solid fa-xmark"></i></button>
            </div>
        </div>`;
    }).join('');
}
