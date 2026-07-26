// nav-chat-images/rules-ui.js — 规则界面 UI

import { getContext } from '../../../../extensions.js';
import { getChatImagesData, currentSettings, saveSettings } from '../data.js';
import { getRules, getRuleSets, getCharSets, getRuleById, addRule, updateRule, deleteRule, addRuleSet, deleteRuleSet, addCharSet, deleteCharSet, getImageUrlByRegistry } from './data.js';
import { getRegistryById } from '../data.js';
import { escapeHtml } from '../shared/utils.js';
import { enterSelectionMode } from '../nav-file-manager/file-manager-ui.js';

let lastSubTab = 'char-sets';

export function renderChatImages() {
    const $panel = $('#mc-chat-images-panel');
    if (!$panel.length) return;

    const data = getChatImagesData();
    const charSets = data.charSets || [];
    const ruleSets = data.ruleSets || [];
    const rules = data.rules || [];

    $panel.html(`
    <div style="padding:4px;">
        <div class="mc-ci-nav flex-container alignitemscenter" style="border-bottom:1px solid var(--borderColor);margin-bottom:6px;">
            <span class="mc-ci-tab ${lastSubTab === 'char-sets' ? 'mc-ci-active' : ''}" data-ci-tab="char-sets" style="flex:1;text-align:center;padding:4px 0;cursor:pointer;font-size:0.82em;${lastSubTab === 'char-sets' ? 'border-bottom:2px solid var(--primary);font-weight:bold;' : 'color:var(--grey40);'}">
                <i class="fa-solid fa-people-group"></i> 角色集 (${charSets.length})
            </span>
            <span class="mc-ci-tab ${lastSubTab === 'rule-sets' ? 'mc-ci-active' : ''}" data-ci-tab="rule-sets" style="flex:1;text-align:center;padding:4px 0;cursor:pointer;font-size:0.82em;${lastSubTab === 'rule-sets' ? 'border-bottom:2px solid var(--primary);font-weight:bold;' : 'color:var(--grey40);'}">
                <i class="fa-solid fa-layer-group"></i> 规则集 (${ruleSets.length})
            </span>
            <span class="mc-ci-tab ${lastSubTab === 'rules' ? 'mc-ci-active' : ''}" data-ci-tab="rules" style="flex:1;text-align:center;padding:4px 0;cursor:pointer;font-size:0.82em;${lastSubTab === 'rules' ? 'border-bottom:2px solid var(--primary);font-weight:bold;' : 'color:var(--grey40);'}">
                <i class="fa-solid fa-list"></i> 规则 (${rules.length})
            </span>
        </div>
        <div id="mc-ci-content">
            ${renderSubTabContent(lastSubTab)}
        </div>
    </div>`);
}

function renderSubTabContent(tab) {
    switch (tab) {
        case 'char-sets': return renderCharSets();
        case 'rule-sets': return renderRuleSets();
        case 'rules': return renderRules();
        default: return '';
    }
}

function renderCharSets() {
    const data = getChatImagesData();
    const charSets = data.charSets || [];
    let html = '<div style="font-size:0.85em;">';
    html += '<div style="display:flex;gap:4px;margin-bottom:6px;">';
    html += '<button id="mc-ci-add-charset" class="menu_button" style="font-size:0.82em;"><i class="fa-solid fa-plus"></i> 添加角色集</button>';
    html += '</div>';
    if (charSets.length === 0) {
        html += '<div style="padding:12px;text-align:center;color:var(--grey40);font-size:0.85em;">暂无角色集</div>';
    } else {
        for (const cs of charSets) {
            html += `
            <div class="mc-ci-item" data-id="${escapeHtml(cs.id)}" style="display:flex;align-items:center;gap:6px;padding:4px 6px;border:1px solid var(--borderColor);border-radius:4px;margin-bottom:4px;">
                <span style="flex:1;font-size:0.85em;">${escapeHtml(cs.name)}</span>
                <span style="font-size:0.75em;color:var(--grey40);">${cs.enabled ? '✅ 启用' : '⛔ 禁用'}</span>
                <button class="mc-ci-toggle" data-type="charset" data-id="${escapeHtml(cs.id)}" class="menu_button menu_button_icon" style="font-size:0.8em;">${cs.enabled ? '禁用' : '启用'}</button>
                <button class="mc-ci-rename" data-type="charset" data-id="${escapeHtml(cs.id)}" class="menu_button menu_button_icon" style="font-size:0.8em;"><i class="fa-solid fa-pen"></i></button>
                <button class="mc-ci-delete" data-type="charset" data-id="${escapeHtml(cs.id)}" class="menu_button menu_button_icon" style="font-size:0.8em;color:var(--dangerColor);"><i class="fa-solid fa-trash-can"></i></button>
            </div>`;
        }
    }
    html += '</div>';
    return html;
}

function renderRuleSets() {
    const data = getChatImagesData();
    const ruleSets = data.ruleSets || [];
    const charSets = data.charSets || [];
    let html = '<div style="font-size:0.85em;">';
    html += '<div style="display:flex;gap:4px;margin-bottom:6px;">';
    html += '<button id="mc-ci-add-ruleset" class="menu_button" style="font-size:0.82em;"><i class="fa-solid fa-plus"></i> 添加规则集</button>';
    html += '</div>';
    if (ruleSets.length === 0) {
        html += '<div style="padding:12px;text-align:center;color:var(--grey40);font-size:0.85em;">暂无规则集</div>';
    } else {
        for (const rs of ruleSets) {
            const boundChar = rs.charSetId ? charSets.find(c => c.id === rs.charSetId) : null;
            html += `
            <div class="mc-ci-item" data-id="${escapeHtml(rs.id)}" style="display:flex;align-items:center;gap:6px;padding:4px 6px;border:1px solid var(--borderColor);border-radius:4px;margin-bottom:4px;">
                <span style="flex:1;font-size:0.85em;">${escapeHtml(rs.name)}</span>
                <span style="font-size:0.75em;color:var(--grey40);">${boundChar ? '📎 ' + escapeHtml(boundChar.name) : '未绑定'} ${rs.enabled ? '✅' : '⛔'}</span>
                <button class="mc-ci-toggle" data-type="ruleset" data-id="${escapeHtml(rs.id)}" class="menu_button menu_button_icon" style="font-size:0.8em;">${rs.enabled ? '禁用' : '启用'}</button>
                <button class="mc-ci-rename" data-type="ruleset" data-id="${escapeHtml(rs.id)}" class="menu_button menu_button_icon" style="font-size:0.8em;"><i class="fa-solid fa-pen"></i></button>
                <button class="mc-ci-delete" data-type="ruleset" data-id="${escapeHtml(rs.id)}" class="menu_button menu_button_icon" style="font-size:0.8em;color:var(--dangerColor);"><i class="fa-solid fa-trash-can"></i></button>
            </div>`;
        }
    }
    html += '</div>';
    return html;
}

function renderRules() {
    const data = getChatImagesData();
    const rules = data.rules || [];
    const ruleSets = data.ruleSets || [];
    const selectedSet = $('#mc-ci-ruleset-filter').val() || '';

    let filtered = rules;
    if (selectedSet) {
        filtered = selectedSet === '__unbound' ? rules.filter(r => !r.ruleSetId) : rules.filter(r => r.ruleSetId === selectedSet);
    }

    let html = '<div style="font-size:0.85em;">';
    html += '<div style="display:flex;gap:4px;margin-bottom:6px;flex-wrap:wrap;align-items:center;">';
    html += '<select id="mc-ci-ruleset-filter" class="text_pole" style="font-size:0.82em;width:120px;">';
    html += '<option value="">全部规则集</option><option value="__unbound">未分组</option>';
    for (const rs of ruleSets) {
        html += `<option value="${escapeHtml(rs.id)}" ${selectedSet === rs.id ? 'selected' : ''}>${escapeHtml(rs.name)}</option>`;
    }
    html += '</select>';
    html += '<button id="mc-ci-add-rule" class="menu_button" style="font-size:0.82em;"><i class="fa-solid fa-plus"></i> 添加规则</button>';
    html += '</div>';

    if (filtered.length === 0) {
        html += '<div style="padding:12px;text-align:center;color:var(--grey40);font-size:0.85em;">暂无规则</div>';
    } else {
        for (const rule of filtered) {
            const rs = rule.ruleSetId ? ruleSets.find(r => r.id === rule.ruleSetId) : null;
            const imgCount = (rule.images || []).length;
            html += `
            <div class="mc-ci-rule" data-id="${escapeHtml(rule.id)}" style="border:1px solid var(--borderColor);border-radius:4px;padding:4px 6px;margin-bottom:4px;">
                <div style="display:flex;align-items:center;gap:6px;">
                    <span style="flex:1;font-size:0.85em;font-weight:bold;">${escapeHtml(rule.name)}</span>
                    <span style="font-size:0.75em;color:var(--grey40);">${rs ? escapeHtml(rs.name) : '未分组'} ${rule.enabled ? '✅' : '⛔'}</span>
                    <span style="font-size:0.75em;">🖼️ ${imgCount}</span>
                    <button class="mc-ci-rule-toggle" data-id="${escapeHtml(rule.id)}" class="menu_button menu_button_icon" style="font-size:0.8em;">${rule.enabled ? '禁用' : '启用'}</button>
                    <button class="mc-ci-rule-edit" data-id="${escapeHtml(rule.id)}" class="menu_button menu_button_icon" style="font-size:0.8em;"><i class="fa-solid fa-pen"></i></button>
                    <button class="mc-ci-rule-images" data-id="${escapeHtml(rule.id)}" class="menu_button menu_button_icon" style="font-size:0.8em;"><i class="fa-solid fa-images"></i></button>
                    <button class="mc-ci-rule-delete" data-id="${escapeHtml(rule.id)}" class="menu_button menu_button_icon" style="font-size:0.8em;color:var(--dangerColor);"><i class="fa-solid fa-trash-can"></i></button>
                </div>
                <div style="font-size:0.75em;color:var(--grey40);margin-top:2px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">/${escapeHtml(rule.regex || '')}/</div>
            </div>`;
        }
    }
    html += '</div>';
    return html;
}

export function bindChatImagesEvents() {
    // 子标签切换
    $(document).off('click', '.mc-ci-tab').on('click', '.mc-ci-tab', function () {
        lastSubTab = $(this).data('ci-tab');
        renderChatImages();
        bindChatImagesEvents();
    });

    // 规则集过滤变更
    $(document).off('change', '#mc-ci-ruleset-filter').on('change', '#mc-ci-ruleset-filter', function () {
        renderChatImages();
        bindChatImagesEvents();
    });

    // 添加角色集
    $('#mc-ci-add-charset').off('click').on('click', function () {
        const name = prompt('角色集名称：');
        if (name) { addCharSet({ name }); renderChatImages(); bindChatImagesEvents(); }
    });

    // 添加规则集
    $('#mc-ci-add-ruleset').off('click').on('click', function () {
        const name = prompt('规则集名称：');
        if (name) { addRuleSet({ name }); renderChatImages(); bindChatImagesEvents(); }
    });

    // 添加规则
    $('#mc-ci-add-rule').off('click').on('click', function () {
        const name = prompt('规则名称：');
        if (name) { addRule({ name }); renderChatImages(); bindChatImagesEvents(); }
    });

    // 切换启用/禁用
    $(document).off('click', '.mc-ci-toggle').on('click', '.mc-ci-toggle', function () {
        const type = $(this).data('type');
        const id = $(this).data('id');
        const data = getChatImagesData();
        const items = type === 'charset' ? data.charSets : data.ruleSets;
        const item = items.find(i => i.id === id);
        if (item) { item.enabled = !item.enabled; saveSettings(); renderChatImages(); bindChatImagesEvents(); }
    });

    // 重命名
    $(document).off('click', '.mc-ci-rename').on('click', '.mc-ci-rename', function () {
        const type = $(this).data('type');
        const id = $(this).data('id');
        const data = getChatImagesData();
        const items = type === 'charset' ? data.charSets : data.ruleSets;
        const item = items.find(i => i.id === id);
        if (item) {
            const newName = prompt('新名称：', item.name);
            if (newName) { item.name = newName; saveSettings(); renderChatImages(); bindChatImagesEvents(); }
        }
    });

    // 删除
    $(document).off('click', '.mc-ci-delete').on('click', '.mc-ci-delete', function () {
        const type = $(this).data('type');
        const id = $(this).data('id');
        if (confirm('确定删除？')) {
            if (type === 'charset') deleteCharSet(id);
            else deleteRuleSet(id);
            renderChatImages();
            bindChatImagesEvents();
        }
    });

    // 规则操作
    $(document).off('click', '.mc-ci-rule-toggle').on('click', '.mc-ci-rule-toggle', function () {
        const id = $(this).data('id');
        const rule = getRuleById(id);
        if (rule) { rule.enabled = !rule.enabled; saveSettings(); renderChatImages(); bindChatImagesEvents(); }
    });

    $(document).off('click', '.mc-ci-rule-edit').on('click', '.mc-ci-rule-edit', function () {
        const id = $(this).data('id');
        const rule = getRuleById(id);
        if (rule) {
            const newName = prompt('规则名称：', rule.name);
            const newRegex = prompt('正则表达式：', rule.regex);
            const newDuration = prompt('显示时长(ms)：', String(rule.duration || 5000));
            if (newName !== null) rule.name = newName;
            if (newRegex !== null) rule.regex = newRegex;
            if (newDuration !== null) rule.duration = parseInt(newDuration) || 5000;
            saveSettings();
            renderChatImages();
            bindChatImagesEvents();
        }
    });

    $(document).off('click', '.mc-ci-rule-images').on('click', '.mc-ci-rule-images', function () {
        const ruleId = $(this).data('id');
        // 打开文件选择器
        enterSelectionMode(async function (selectedIds) {
            const { addImageToRule } = await import('./data.js');
            for (const regId of selectedIds) {
                addImageToRule(ruleId, regId, 50);
            }
            renderChatImages();
            bindChatImagesEvents();
        });
    });

    $(document).off('click', '.mc-ci-rule-delete').on('click', '.mc-ci-rule-delete', function () {
        const id = $(this).data('id');
        if (confirm('确定删除此规则？')) {
            deleteRule(id);
            renderChatImages();
            bindChatImagesEvents();
        }
    });
}
