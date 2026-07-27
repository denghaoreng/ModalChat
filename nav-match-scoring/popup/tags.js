// popup-tags.js — 标签筛选弹窗

import { callGenericPopup } from '../../../../../popup.js';
import { getMSFiles as getFiles, getSelectedTags, updateSelectedTags } from '../../core/data.js';
import { escapeHtml } from '../../shared/utils.js';

const POPUP_TYPE = Object.freeze({ TEXT: 1, CONFIRM: 2, INPUT: 3, DISPLAY: 4 });

/**
 * 标签筛选弹窗
 */
export async function showTagFilterPopup() {
    const files = getFiles();
    const allTags = new Set();
    files.forEach(f => (f.tagList || []).forEach(t => allTags.add(t)));
    const sortedTags = [...allTags].sort();

    let selected = getSelectedTags();
    selected = selected.filter(tag => tag === '__untagged__' || allTags.has(tag));
    const saved = getSelectedTags();
    if (selected.length !== saved.length || selected.some((t, i) => t !== saved[i])) {
        updateSelectedTags(selected);
    }
    const selectedSet = new Set(selected);

    const virtualTags = [
        { value: '__untagged__', label: '(无标签)' },
    ];
    let checkboxesHtml = virtualTags.map(vt =>
        `<label style="display:inline-flex;align-items:center;gap:4px;margin:3px 8px;font-size:0.85em;cursor:pointer;white-space:nowrap;color:var(--grey40);">
            <input type="checkbox" class="ms-tag-checkbox" value="${vt.value}" ${selectedSet.has(vt.value) ? 'checked' : ''}>
            ${vt.label}
        </label>`
    ).join('');
    checkboxesHtml += sortedTags.map(tag => {
        if (tag === '__untagged__' || tag === '__type_video__' || tag === '__type_image__') return '';
        const checked = selectedSet.has(tag) ? 'checked' : '';
        return `<label style="display:inline-flex;align-items:center;gap:4px;margin:3px 8px;font-size:0.85em;cursor:pointer;white-space:nowrap;">
            <input type="checkbox" class="ms-tag-checkbox" value="${escapeHtml(tag)}" ${checked}>
            ${escapeHtml(tag)}
        </label>`;
    }).join('') || '';
    if (!checkboxesHtml.trim()) {
        checkboxesHtml = '<div style="color:var(--grey40);font-size:0.85em;">暂无标签</div>';
    }

    const html = `
    <div style="padding:8px;max-height:60dvh;overflow-y:auto;">
        <div style="margin-bottom:8px;display:flex;flex-direction:row;gap:8px;">
            <button onclick="var n=this.parentNode.nextElementSibling;if(n)n.querySelectorAll('input[type=checkbox]').forEach(function(x){x.checked=true;x.dispatchEvent(new Event('change',{bubbles:true}));});" style="font-size:0.8em;white-space:nowrap;display:inline-flex;align-items:center;gap:4px;writing-mode:horizontal-tb;border:1px solid var(--borderColor);border-radius:4px;padding:4px 8px;background:var(--bgColor);cursor:pointer;color:var(--textColor);">✅ 全部勾选</button>
            <button onclick="var n=this.parentNode.nextElementSibling;if(n)n.querySelectorAll('input[type=checkbox]').forEach(function(x){x.checked=false;x.dispatchEvent(new Event('change',{bubbles:true}));});" style="font-size:0.8em;white-space:nowrap;display:inline-flex;align-items:center;gap:4px;writing-mode:horizontal-tb;border:1px solid var(--borderColor);border-radius:4px;padding:4px 8px;background:var(--bgColor);cursor:pointer;color:var(--textColor);">❌ 全部取消</button>
        </div>
        <div id="ms-tag-list" style="display:flex;flex-wrap:wrap;gap:2px;">
            ${checkboxesHtml}
        </div>
    </div>`;

    let currentSelected = [...getSelectedTags()];

    $(document).on('change', '.ms-tag-checkbox', function () {
        if (this.checked) {
            if (!currentSelected.includes(this.value)) currentSelected.push(this.value);
        } else {
            currentSelected = currentSelected.filter(t => t !== this.value);
        }
    });

    const result = await callGenericPopup(html, POPUP_TYPE.TEXT, '', {
        okButton: '确认',
        cancelButton: '取消',
        wide: false,
    });

    $(document).off('change', '.ms-tag-checkbox');

    if (result) {
        updateSelectedTags(currentSelected);
        const { renderFileDisplay } = await import('../file-display.js');
        renderFileDisplay();
    }
}
