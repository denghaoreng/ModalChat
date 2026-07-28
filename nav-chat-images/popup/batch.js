// popup/batch.js — 批量新增 + 批量修改规则

import { callGenericPopup, POPUP_TYPE } from '../../../../../popup.js';
import { getChatImagesData as getRulesData, saveSettings } from '../../core/data.js';
import { addRule, getRules } from '../domain/rules.js';
import { addImageToRule } from '../domain/helpers.js';
import { showFilePickerPopup } from '../../nav-file-manager/file-picker-popup.js';
import { escapeHtml } from '../../shared/utils.js';

/**
 * 批量新增：选择文件 → 创建规则引用
 */
export async function showBatchAddPopup() {
    const setId = $('#mc-ci-ruleset-filter').val();
    if (!setId || setId === '__unbound') {
        toastr.warning('请先选择一个规则集');
        return;
    }

    // 打开文件选择器
    const entries = await showFilePickerPopup({ title: '批量选择图片', multiSelect: true });
    if (!entries || entries.length === 0) return;

    const rulesData = getRulesData();
    const setRules = rulesData.rules.filter(r => r.ruleSetId === setId);
    const maxOrder = setRules.reduce((max, r) => Math.max(max, r.order || 0), 0);

    let successCount = 0;
    for (let i = 0; i < entries.length; i++) {
        const entry = entries[i];
        if (!entry.id) continue;
        const rule = addRule({
            name: entry.displayName || '批量图片_' + (maxOrder + i + 1),
            regex: '',
            ruleSetId: setId,
            order: maxOrder + i + 1,
            duration: 5000,
        });
        if (rule) {
            addImageToRule(rule.id, entry.id, 50);
            successCount++;
        }
    }

    if (successCount > 0) {
        toastr.success(`成功创建 ${successCount} 条图片`);
    }
}

/**
 * 批量修改：修改指定规则集下所有规则的时长和正则内容
 */
export async function showBatchEditPopup() {
    const setId = $('#mc-ci-ruleset-filter').val();
    if (!setId || setId === '__unbound' || !setId) {
        toastr.warning('请先选择一个规则集');
        return;
    }

    const rulesData = getRulesData();
    const rules = rulesData.rules.filter(r => r.ruleSetId === setId);
    const ruleSet = rulesData.ruleSets.find(rs => rs.id === setId);
    const setName = ruleSet ? ruleSet.name : '未命名规则集';

    if (rules.length === 0) {
        toastr.warning('此规则集下没有规则可修改');
        return;
    }

    let modifyDuration = false;
    let newDuration = 5000;
    let modifyRegex = false;
    let newRegex = '';

    const popupContent = $(`
    <div style="padding:8px 12px;min-width:350px;">
        <h3 style="margin:0 0 10px 0;font-size:1.05em;border-bottom:1px solid var(--borderColor);padding-bottom:8px;">
            <i class="fa-solid fa-pen-to-square"></i> 批量修改图片
        </h3>
        <div style="font-size:0.88em;opacity:0.7;margin-bottom:12px;">
            规则集：<strong>${escapeHtml(setName)}</strong>（共 ${rules.length} 条规则）
        </div>

        <div class="flex-container alignitemscenter margin0" style="gap:8px;margin-bottom:10px;padding:8px;background:var(--white15);border-radius:6px;">
            <label class="checkbox_label" style="margin-bottom:0;white-space:nowrap;">
                <input type="checkbox" id="batch-edit-modify-duration">
                <span style="font-size:0.9em;">显示时长</span>
            </label>
            <input type="number" id="batch-edit-duration" class="text_pole" min="0" step="100" value="5000" style="width:70px;text-align:center;font-size:0.9em;" disabled>
            <span style="font-size:0.85em;opacity:0.6;">毫秒（0=永久）</span>
        </div>

        <div class="flex-container alignitemscenter" style="gap:8px;margin-bottom:12px;padding:8px;background:var(--white15);border-radius:6px;">
            <label class="checkbox_label" style="margin-bottom:0;white-space:nowrap;">
                <input type="checkbox" id="batch-edit-modify-regex">
                <span style="font-size:0.9em;">正则内容</span>
            </label>
            <input type="text" id="batch-edit-regex" class="text_pole flex1" placeholder="输入新的正则表达式" style="font-family:monospace;font-size:0.9em;" disabled>
        </div>

        <div style="font-size:0.82em;opacity:0.5;margin-top:4px;padding:6px;background:var(--white10);border-radius:4px;">
            <i class="fa-solid fa-info-circle"></i>
            勾选后填写新值，确认后将应用到该规则集下的所有规则
        </div>
    </div>
    `);

    popupContent.find('#batch-edit-modify-duration').on('change', function () {
        modifyDuration = $(this).is(':checked');
        popupContent.find('#batch-edit-duration').prop('disabled', !modifyDuration);
    });
    popupContent.find('#batch-edit-modify-regex').on('change', function () {
        modifyRegex = $(this).is(':checked');
        popupContent.find('#batch-edit-regex').prop('disabled', !modifyRegex);
    });
    popupContent.find('#batch-edit-duration').on('input', function () {
        newDuration = parseFloat($(this).val()) || 0;
    });
    popupContent.find('#batch-edit-regex').on('input', function () {
        newRegex = $(this).val();
    });

    const result = await callGenericPopup(popupContent, POPUP_TYPE.TEXT, '', {
        okButton: '确认修改',
        cancelButton: '取消',
        allowVerticalScrolling: true,
    });

    if (!result) return;

    let count = 0;
    for (const rule of rules) {
        const updates = {};
        if (modifyDuration) updates.duration = newDuration;
        if (modifyRegex) updates.regex = newRegex;
        if (Object.keys(updates).length > 0) {
            Object.assign(rule, updates);
            count++;
        }
    }
    saveSettings();

    if (count > 0) toastr.success(`已修改 ${count} 条图片`);
    else toastr.warning('未做任何修改');
}
