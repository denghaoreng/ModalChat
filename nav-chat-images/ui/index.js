// ui/index.js — 聊天图片主渲染入口 + 子导航调度

import { getChatImagesData, saveSettings } from '../../core/data.js';
import { getRuleById } from '../domain/rules.js';
import { addCharSet, deleteCharSet } from '../domain/char-sets.js';
import { addRuleSet, deleteRuleSet } from '../domain/rule-sets.js';
import { getRules, addRule, deleteRule } from '../domain/rules.js';
import { addImageToRule } from '../domain/helpers.js';
import { showFilePickerPopup } from '../../nav-file-manager/file-picker-popup.js';
import { renderCharSets, triggerCSSearch, triggerCSClear } from './char-sets.js';
import { saveRulesetFilter } from './rules.js';
import { saveRsCharSelect } from './rule-sets.js';
import { renderRuleSets } from './rule-sets.js';
import { renderRules } from './rules.js';
import { renderCarouselSettings } from './carousel-settings.js';

let lastSubTab = 'char-sets';

export async function renderChatImages() {
    const $panel = $('#mc-chat-images-panel');
    if (!$panel.length) return;

    // 在销毁旧 DOM 前保存当前筛选值
    saveRulesetFilter();
    saveRsCharSelect();

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
                <i class="fa-solid fa-layer-group"></i> 图片集 (${ruleSets.length})
            </span>
            <span class="mc-ci-tab" data-ci-tab="rules" style="${tabStyle('rules')}">
                <i class="fa-solid fa-list"></i> 图片 (${rules.length})
            </span>
            <span class="mc-ci-tab" data-ci-tab="carousel" style="${tabStyle('carousel')}">
                <i class="fa-solid fa-sliders"></i> 轮播设置
            </span>
        </div>
        <div id="mc-ci-content">
            ${await renderSubTabContent(lastSubTab)}
        </div>
    </div>`);
}

async function renderSubTabContent(tab) {
    switch (tab) {
        case 'char-sets': return renderCharSets();
        case 'rule-sets': return renderRuleSets();
        case 'rules': return await renderRules();
        case 'carousel': return ''; // carousel 用独立渲染（管理自身 DOM）
        default: return '';
    }
}

export function bindChatImagesEvents() {
    $(document).off('click', '.mc-ci-tab').on('click', '.mc-ci-tab', async function () {
        lastSubTab = $(this).data('ci-tab');
        await renderChatImages();
        bindChatImagesEvents();
        if (lastSubTab === 'carousel') renderCarouselSettings();
    });

    // === 通用：筛选/搜索/排序变更 → 重绘 ===
    $(document).off('change', '#mc-ci-ruleset-filter, #mc-ci-rule-sort, #mc-ci-rs-sort').on('change', '#mc-ci-ruleset-filter, #mc-ci-rule-sort, #mc-ci-rs-sort', function () {
        renderChatImages(); bindChatImagesEvents();
    });
    let _ciSearchTimer;
    $(document).off('input', '#mc-ci-rule-search, #mc-ci-rs-search').on('input', '#mc-ci-rule-search, #mc-ci-rs-search', function () {
        clearTimeout(_ciSearchTimer);
        _ciSearchTimer = setTimeout(() => { renderChatImages(); bindChatImagesEvents(); }, 200);
    });
    // 角色集搜索：点击按钮才触发
    $(document).off('click', '#mc-ci-cs-search-btn').on('click', '#mc-ci-cs-search-btn', function () {
        triggerCSSearch();
        renderChatImages(); bindChatImagesEvents();
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
    $(document).off('click', '.mc-ci-cs-edit').on('click', '.mc-ci-cs-edit', async function () {
        const id = $(this).closest('.mc-ci-cs-item').data('id');
        lastSubTab = 'rule-sets';
        await renderChatImages();
        bindChatImagesEvents();
        $('#mc-ci-rs-charselect').val(id);
    });
    // 添加（添加后清空搜索）
    $(document).off('click', '#mc-ci-add-charset').on('click', '#mc-ci-add-charset', function () {
        addCharSet({ name: '新角色集' }); triggerCSClear(); renderChatImages(); bindChatImagesEvents();
    });
    // 删除
    $(document).off('click', '.mc-ci-cs-delete').on('click', '.mc-ci-cs-delete', function () {
        const id = $(this).closest('.mc-ci-cs-item').data('id');
        if (confirm('确定删除此角色集？')) { deleteCharSet(id); renderChatImages(); bindChatImagesEvents(); }
    });

    // === 规则集 ===
    // 角色集筛选变更
    $(document).off('change', '#mc-ci-rs-charselect').on('change', '#mc-ci-rs-charselect', function () {
        renderChatImages(); bindChatImagesEvents();
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
    // 添加（绑定到选中的角色集）
    $(document).off('click', '#mc-ci-add-ruleset').on('click', '#mc-ci-add-ruleset', function () {
        const charId = $('#mc-ci-rs-charselect').val() || '';
        const setId = (charId && charId !== '__unbound' && charId !== '') ? charId : '';
        addRuleSet({ name: '新图片集', charSetId: setId });
        renderChatImages(); bindChatImagesEvents();
    });
    // 跳转到图片列表
    $(document).off('click', '.mc-ci-rs-jump').on('click', '.mc-ci-rs-jump', async function () {
        const id = $(this).closest('.mc-ci-rs-item').data('id');
        lastSubTab = 'rules';
        await renderChatImages();
        bindChatImagesEvents();
        $('#mc-ci-ruleset-filter').val(id);
        // 重新渲染以应用筛选
        renderChatImages(); bindChatImagesEvents();
    });
    // 删除
    $(document).off('click', '.mc-ci-rs-delete').on('click', '.mc-ci-rs-delete', function () {
        const id = $(this).closest('.mc-ci-rs-item').data('id');
        if (confirm('确定删除此图片集？')) { deleteRuleSet(id); renderChatImages(); bindChatImagesEvents(); }
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
    // 批量增
    $(document).off('click', '#mc-ci-batch-add').on('click', '#mc-ci-batch-add', async function () {
        const { showBatchAddPopup } = await import('../popup/batch.js');
        await showBatchAddPopup();
        renderChatImages(); bindChatImagesEvents();
    });
    // 批量改
    $(document).off('click', '#mc-ci-batch-edit').on('click', '#mc-ci-batch-edit', async function () {
        const { showBatchEditPopup } = await import('../popup/batch.js');
        await showBatchEditPopup();
        renderChatImages(); bindChatImagesEvents();
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
    // 添加图片（绑定到选中的图片集）
    $(document).off('click', '#mc-ci-add-rule').on('click', '#mc-ci-add-rule', function () {
        const setId = $('#mc-ci-ruleset-filter').val() || '';
        addRule({ name: '新图片', ruleSetId: (setId === '__unbound' ? '' : setId) });
        renderChatImages(); bindChatImagesEvents();
    });
    // 管理图片：弹出文件选择器，选择图片引用到规则
    $(document).off('click', '.mc-ci-rule-images').on('click', '.mc-ci-rule-images', async function () {
        const ruleId = $(this).closest('.mc-ci-rule-item').data('id');
        const entries = await showFilePickerPopup({ title: '选择图片', multiSelect: true });
        if (!entries || entries.length === 0) return;
        for (const entry of entries) {
            if (entry.id) addImageToRule(ruleId, entry.id, 50);
        }
        renderChatImages(); bindChatImagesEvents();
    });
    // 删除规则
    $(document).off('click', '.mc-ci-rule-delete').on('click', '.mc-ci-rule-delete', function () {
        const id = $(this).closest('.mc-ci-rule-item').data('id');
        if (confirm('确定删除此图片？')) { deleteRule(id); renderChatImages(); bindChatImagesEvents(); }
    });

    // === 图片引用：权重滑块 + 删除 ===
    let _imgWtTimers = {};
    $(document).off('input', '.mc-ci-img-weight').on('input', '.mc-ci-img-weight', function () {
        const regId = $(this).data('reg-id');
        const val = parseFloat($(this).val());
        $(this).closest('.mc-ci-rule-image-item').find('.mc-ci-img-wv').text(val);
        const $item = $(this).closest('.mc-ci-rule-item');
        const ruleId = $item.data('id');
        clearTimeout(_imgWtTimers[regId]);
        _imgWtTimers[regId] = setTimeout(() => {
            const rule = getRuleById(ruleId);
            if (rule) {
                const img = rule.images.find(i => i.registryId === regId);
                if (img) { img.weight = val; saveSettings(); }
            }
        }, 300);
    });
    $(document).off('click', '.mc-ci-img-delete').on('click', '.mc-ci-img-delete', function () {
        const regId = $(this).data('reg-id');
        const $item = $(this).closest('.mc-ci-rule-item');
        const ruleId = $item.data('id');
        const rule = getRuleById(ruleId);
        if (rule && confirm('移除此图片引用？')) {
            rule.images = rule.images.filter(i => i.registryId !== regId);
            saveSettings();
            renderChatImages(); bindChatImagesEvents();
        }
    });
}
