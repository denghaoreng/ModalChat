// ui/index.js — 聊天图片主渲染入口 + 子导航调度

import { getChatImagesData, saveSettings } from '../../core/data.js';
import { getRuleById } from '../domain/rules.js';
import { addCharSet, deleteCharSet } from '../domain/char-sets.js';
import { addRuleSet, deleteRuleSet } from '../domain/rule-sets.js';
import { getRules, addRule, deleteRule } from '../domain/rules.js';
import { addImageToRule } from '../domain/helpers.js';
import { enterSelectionMode } from '../../nav-file-manager/index.js';
import { renderCharSets } from './char-sets.js';
import { renderRuleSets } from './rule-sets.js';
import { renderRules } from './rules.js';
import { renderSettings, bindSettingsEvents } from './settings.js';

let lastSubTab = 'char-sets';

export function renderChatImages() {
    const $panel = $('#mc-chat-images-panel');
    if (!$panel.length) return;

    const data = getChatImagesData();
    const charSets = data.charSets || [];
    const ruleSets = data.ruleSets || [];
    const rules = data.rules || [];

    function tabStyle(tab) {
        const active = lastSubTab === tab;
        return `flex:1;text-align:center;padding:4px 0;cursor:pointer;font-size:0.82em;${active ? 'border-bottom:2px solid var(--primary);font-weight:bold;' : 'color:var(--grey40);'}`;
    }

    $panel.html(`
    <div style="padding:4px;">
        <div class="mc-ci-nav flex-container alignitemscenter" style="border-bottom:1px solid var(--borderColor);margin-bottom:6px;">
            <span class="mc-ci-tab" data-ci-tab="char-sets" style="${tabStyle('char-sets')}">
                <i class="fa-solid fa-people-group"></i> 角色集 (${charSets.length})
            </span>
            <span class="mc-ci-tab" data-ci-tab="rule-sets" style="${tabStyle('rule-sets')}">
                <i class="fa-solid fa-layer-group"></i> 规则集 (${ruleSets.length})
            </span>
            <span class="mc-ci-tab" data-ci-tab="rules" style="${tabStyle('rules')}">
                <i class="fa-solid fa-list"></i> 规则 (${rules.length})
            </span>
            <span class="mc-ci-tab" data-ci-tab="settings" style="${tabStyle('settings')}">
                <i class="fa-solid fa-gear"></i> 设置
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
        case 'settings': return renderSettings();
        default: return '';
    }
}

export function bindChatImagesEvents() {
    $(document).off('click', '.mc-ci-tab').on('click', '.mc-ci-tab', function () {
        lastSubTab = $(this).data('ci-tab');
        renderChatImages();
        bindChatImagesEvents();
        if (lastSubTab === 'settings') bindSettingsEvents();
    });

    // === 通用：筛选/搜索/排序变更 → 重绘 ===
    $(document).off('change', '#mc-ci-ruleset-filter, #mc-ci-rule-sort, #mc-ci-rs-sort').on('change', '#mc-ci-ruleset-filter, #mc-ci-rule-sort, #mc-ci-rs-sort', function () {
        renderChatImages(); bindChatImagesEvents();
    });
    let _ciSearchTimer;
    $(document).off('input', '#mc-ci-rule-search, #mc-ci-rs-search, #mc-ci-cs-search').on('input', '#mc-ci-rule-search, #mc-ci-rs-search, #mc-ci-cs-search', function () {
        clearTimeout(_ciSearchTimer);
        _ciSearchTimer = setTimeout(() => { renderChatImages(); bindChatImagesEvents(); }, 200);
    });

    // === 角色集 ===
    // 内联编辑名称
    $(document).off('input', '.mc-ci-cs-name').on('input', '.mc-ci-cs-name', function () {
        const id = $(this).closest('.mc-ci-cs-item').data('id');
        const data = getChatImagesData();
        const cs = data.charSets.find(c => c.id === id);
        if (cs) { cs.name = $(this).val(); saveSettings(); }
    });
    // 启用/禁用
    $(document).off('change', '.mc-ci-cs-enabled').on('change', '.mc-ci-cs-enabled', function () {
        const id = $(this).closest('.mc-ci-cs-item').data('id');
        const data = getChatImagesData();
        const cs = data.charSets.find(c => c.id === id);
        if (cs) { cs.enabled = $(this).is(':checked'); saveSettings(); renderChatImages(); bindChatImagesEvents(); }
    });
    // 编辑规则集
    $(document).off('click', '.mc-ci-cs-edit').on('click', '.mc-ci-cs-edit', function () {
        const id = $(this).closest('.mc-ci-cs-item').data('id');
        lastSubTab = 'rule-sets';
        renderChatImages();
        bindChatImagesEvents();
        $('#mc-ci-rs-charselect').val(id);
    });
    // 添加
    $(document).off('click', '#mc-ci-add-charset').on('click', '#mc-ci-add-charset', function () {
        const name = prompt('角色集名称：');
        if (name) { addCharSet({ name }); renderChatImages(); bindChatImagesEvents(); }
    });
    // 删除
    $(document).off('click', '.mc-ci-cs-delete').on('click', '.mc-ci-cs-delete', function () {
        const id = $(this).closest('.mc-ci-cs-item').data('id');
        if (confirm('确定删除此角色集？')) { deleteCharSet(id); renderChatImages(); bindChatImagesEvents(); }
    });

    // === 规则集 ===
    // 角色集绑定变更
    $(document).off('change', '#mc-ci-rs-charselect').on('change', '#mc-ci-rs-charselect', function () {
        const val = $(this).val();
        // 仅对未绑定的规则集应用
        const data = getChatImagesData();
        for (const rs of data.ruleSets || []) {
            if (!rs.charSetId) rs.charSetId = val === '__unbound' ? '' : val;
        }
        saveSettings(); renderChatImages(); bindChatImagesEvents();
    });
    // 内联编辑名称
    $(document).off('input', '.mc-ci-rs-name').on('input', '.mc-ci-rs-name', function () {
        const id = $(this).closest('.mc-ci-rs-item').data('id');
        const rs = getRuleSets().find(r => r.id === id);
        if (rs) { rs.name = $(this).val(); saveSettings(); }
    });
    // 启用/禁用
    $(document).off('change', '.mc-ci-rs-enabled').on('change', '.mc-ci-rs-enabled', function () {
        const id = $(this).closest('.mc-ci-rs-item').data('id');
        const data = getChatImagesData();
        const rs = data.ruleSets.find(r => r.id === id);
        if (rs) { rs.enabled = $(this).is(':checked'); saveSettings(); renderChatImages(); bindChatImagesEvents(); }
    });
    // 添加
    $(document).off('click', '#mc-ci-add-ruleset').on('click', '#mc-ci-add-ruleset', function () {
        const name = prompt('规则集名称：');
        if (name) { addRuleSet({ name }); renderChatImages(); bindChatImagesEvents(); }
    });
    // 删除
    $(document).off('click', '.mc-ci-rs-delete').on('click', '.mc-ci-rs-delete', function () {
        const id = $(this).closest('.mc-ci-rs-item').data('id');
        if (confirm('确定删除此规则集？')) { deleteRuleSet(id); renderChatImages(); bindChatImagesEvents(); }
    });

    // === 规则 ===
    // 内联编辑
    $(document).off('input', '.mc-ci-rule-name').on('input', '.mc-ci-rule-name', function () {
        const id = $(this).closest('.mc-ci-rule-item').data('id');
        const rule = getRuleById(id);
        if (rule) { rule.name = $(this).val(); saveSettings(); }
    });
    $(document).off('input', '.mc-ci-rule-regex').on('input', '.mc-ci-rule-regex', function () {
        const id = $(this).closest('.mc-ci-rule-item').data('id');
        const rule = getRuleById(id);
        if (rule) { rule.regex = $(this).val(); saveSettings(); }
    });
    $(document).off('input', '.mc-ci-rule-order').on('input', '.mc-ci-rule-order', function () {
        const id = $(this).closest('.mc-ci-rule-item').data('id');
        const rule = getRuleById(id);
        if (rule) { rule.order = parseFloat($(this).val()) || 0; saveSettings(); }
    });
    $(document).off('input', '.mc-ci-rule-duration').on('input', '.mc-ci-rule-duration', function () {
        const id = $(this).closest('.mc-ci-rule-item').data('id');
        const rule = getRuleById(id);
        if (rule) { rule.duration = parseFloat($(this).val()) || 0; saveSettings(); }
    });
    // 启用/禁用
    $(document).off('change', '.mc-ci-rule-enabled').on('change', '.mc-ci-rule-enabled', function () {
        const id = $(this).closest('.mc-ci-rule-item').data('id');
        const rule = getRuleById(id);
        if (rule) { rule.enabled = $(this).is(':checked'); saveSettings(); }
    });
    // 展开/折叠单条
    $(document).off('click', '.mc-ci-rule-collapse-btn').on('click', '.mc-ci-rule-collapse-btn', function () {
        const $item = $(this).closest('.mc-ci-rule-item');
        const id = $item.data('id');
        const $collapsible = $item.find('.mc-ci-rule-collapsible');
        const isCollapsed = $collapsible.is(':hidden');
        $collapsible.toggle();
        $(this).find('i').toggleClass('fa-chevron-down fa-chevron-right');
        const rule = getRuleById(id);
        if (rule) { rule._expanded = isCollapsed; saveSettings(); }
    });
    // 展开全部
    $(document).off('click', '#mc-ci-expand-all').on('click', '#mc-ci-expand-all', function () {
        const data = getChatImagesData();
        for (const r of data.rules || []) r._expanded = true;
        saveSettings(); renderChatImages(); bindChatImagesEvents();
    });
    // 折叠全部
    $(document).off('click', '#mc-ci-collapse-all').on('click', '#mc-ci-collapse-all', function () {
        const data = getChatImagesData();
        for (const r of data.rules || []) r._expanded = false;
        saveSettings(); renderChatImages(); bindChatImagesEvents();
    });
    // 添加规则
    $(document).off('click', '#mc-ci-add-rule').on('click', '#mc-ci-add-rule', function () {
        const name = prompt('规则名称：');
        if (name) { addRule({ name }); renderChatImages(); bindChatImagesEvents(); }
    });
    // 管理图片
    $(document).off('click', '.mc-ci-rule-images').on('click', '.mc-ci-rule-images', function () {
        const ruleId = $(this).closest('.mc-ci-rule-item').data('id');
        enterSelectionMode(async function (selectedIds) {
            for (const regId of selectedIds) addImageToRule(ruleId, regId, 50);
            renderChatImages(); bindChatImagesEvents();
        });
    });
    // 删除规则
    $(document).off('click', '.mc-ci-rule-delete').on('click', '.mc-ci-rule-delete', function () {
        const id = $(this).closest('.mc-ci-rule-item').data('id');
        if (confirm('确定删除此规则？')) { deleteRule(id); renderChatImages(); bindChatImagesEvents(); }
    });
}
