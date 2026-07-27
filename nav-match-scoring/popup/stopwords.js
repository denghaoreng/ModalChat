// popup-stopwords.js — 停用词编辑弹窗

import { callGenericPopup } from '../../../../../popup.js';
import { getMatchScoringData, updateStopWords } from '../../core/data.js';
import { escapeHtml } from '../../shared/utils.js';

const POPUP_TYPE = Object.freeze({ TEXT: 1, CONFIRM: 2, INPUT: 3, DISPLAY: 4 });

/**
 * 显示停用词编辑弹窗
 * @returns {Promise<void>}
 */
export async function showStopWordsPopup() {
    let stopWordsStr = (getMatchScoringData().stopWords || []).join(' ');

    const popupHtml = `
    <div style="padding:8px;min-width:300px;">
        <div style="margin-bottom:8px;font-size:0.85em;color:var(--grey40);">
            请输入停用词，用空格分隔。这些词在匹配时将被忽略。
        </div>
        <textarea id="ms-stopwords-input" class="text_pole" style="width:100%;min-height:80px;font-size:0.9em;resize:vertical;">${escapeHtml(stopWordsStr)}</textarea>
    </div>`;

    $(document).on('input', '#ms-stopwords-input', function () {
        stopWordsStr = $(this).val() || '';
    });

    const result = await callGenericPopup(popupHtml, POPUP_TYPE.TEXT, '', {
        okButton: '保存',
        cancelButton: '取消',
        wide: false,
    });

    $(document).off('input', '#ms-stopwords-input');

    if (result) {
        const words = stopWordsStr.split(/\s+/).filter(Boolean);
        updateStopWords(words);
    }
}
