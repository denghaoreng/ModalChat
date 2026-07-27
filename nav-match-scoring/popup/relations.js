// popup-relations.js — 关联词编辑弹窗

import { callGenericPopup } from '../../../../../popup.js';
import { addRelation, removeRelation, saveSettings, getMatchScoringData } from '../../core/data.js';
import { escapeHtml } from '../../shared/utils.js';

const POPUP_TYPE = Object.freeze({ TEXT: 1, CONFIRM: 2, INPUT: 3, DISPLAY: 4 });

/**
 * 显示关联词编辑弹窗
 * @returns {Promise<void>}
 */
export async function showRelationEditPopup() {
    const relations = getMatchScoringData().relations || [];
    let itemsHtml = '';

    if (relations.length === 0) {
        itemsHtml = '<div style="text-align:center;color:var(--grey40);padding:10px;">暂无关联词，请添加</div>';
    } else {
        relations.forEach((rel, index) => {
            itemsHtml += `
            <div class="ms-relation-row" style="display:flex;gap:6px;margin-bottom:6px;align-items:center;">
                <input class="text_pole ms-relation-from" data-index="${index}" type="text" value="${escapeHtml(rel.from)}" style="flex:1;font-size:0.85em;" placeholder="源词">
                <span style="color:var(--grey40);font-size:0.85em;">→</span>
                <input class="text_pole ms-relation-to" data-index="${index}" type="text" value="${escapeHtml(rel.to)}" style="flex:1;font-size:0.85em;" placeholder="关联词">
                <span class="ms-relation-del menu_button menu_button_icon" data-index="${index}" style="color:var(--dangerColor);cursor:pointer;">
                    <i class="fa-solid fa-trash-can"></i>
                </span>
            </div>`;
        });
    }

    const popupHtml = `
    <div style="padding:8px;min-width:300px;">
        <div id="ms-relation-list">
            ${itemsHtml}
        </div>
        <div style="margin-top:10px;text-align:center;">
            <button id="ms-add-relation-btn" class="menu_button" style="font-size:0.85em;white-space:nowrap;">
                <i class="fa-solid fa-plus"></i> 添加关联词
            </button>
        </div>
    </div>`;

    const trackChanges = debouncedTrackRelations();

    const addBtnHandler = function () {
        const list = $('#ms-relation-list');
        const newIndex = getMatchScoringData().relations.length;
        addRelation('', '');
        list.append(`
            <div class="ms-relation-row" style="display:flex;gap:6px;margin-bottom:6px;align-items:center;">
                <input class="text_pole ms-relation-from" data-index="${newIndex}" type="text" value="" style="flex:1;font-size:0.85em;" placeholder="源词">
                <span style="color:var(--grey40);font-size:0.85em;">→</span>
                <input class="text_pole ms-relation-to" data-index="${newIndex}" type="text" value="" style="flex:1;font-size:0.85em;" placeholder="关联词">
                <span class="ms-relation-del menu_button menu_button_icon" data-index="${newIndex}" style="color:var(--dangerColor);cursor:pointer;">
                    <i class="fa-solid fa-trash-can"></i>
                </span>
            </div>
        `);
    };

    $(document).on('input', '.ms-relation-from', function () {
        const idx = $(this).data('index');
        trackChanges(idx, 'from', $(this).val() || '');
    });
    $(document).on('input', '.ms-relation-to', function () {
        const idx = $(this).data('index');
        trackChanges(idx, 'to', $(this).val() || '');
    });
    $(document).off('click', '#ms-add-relation-btn').on('click', '#ms-add-relation-btn', addBtnHandler);
    $(document).off('click', '.ms-relation-del').on('click', '.ms-relation-del', function () {
        const idx = $(this).data('index');
        removeRelation(idx);
        showRelationEditPopup();
    });

    const result = await callGenericPopup(popupHtml, POPUP_TYPE.TEXT, '', {
        okButton: '关闭',
        cancelButton: null,
        wide: false,
    });

    $(document).off('input', '.ms-relation-from');
    $(document).off('input', '.ms-relation-to');
    $(document).off('click', '#ms-add-relation-btn');
    $(document).off('click', '.ms-relation-del');
}

/** 防抖追踪关联词变更 */
function debouncedTrackRelations() {
    let timers = {};
    return function (index, field, value) {
        clearTimeout(timers[`${index}_${field}`]);
        timers[`${index}_${field}`] = setTimeout(() => {
            const rel = getMatchScoringData().relations[index];
            if (rel) { rel[field] = value; }
        }, 300);
    };
}
