// ui/settings.js — 聊天图片设置子标签

import { getGeneralSettings, updateGeneralSettings } from '../../core/data.js';

/** 渲染设置面板（图片尺寸/背景色等） */
export function renderSettings() {
    const gs = getGeneralSettings();
    let html = '<div style="font-size:0.85em;padding:4px;">';
    html += '<div style="margin-bottom:8px;">';
    html += `<label style="display:block;margin-bottom:3px;font-size:0.85em;color:var(--grey40);">图片宽度 (px)</label>`;
    html += `<input id="mc-ci-img-width" class="text_pole" type="number" value="${gs.imageWidth ?? 500}" min="50" max="2000" style="width:100px;font-size:0.9em;">`;
    html += '</div>';
    html += '<div style="margin-bottom:8px;">';
    html += `<label style="display:block;margin-bottom:3px;font-size:0.85em;color:var(--grey40);">图片高度 (px)</label>`;
    html += `<input id="mc-ci-img-height" class="text_pole" type="number" value="${gs.imageHeight ?? 500}" min="50" max="2000" style="width:100px;font-size:0.9em;">`;
    html += '</div>';
    html += '<div style="margin-bottom:8px;">';
    html += `<label style="display:block;margin-bottom:3px;font-size:0.85em;color:var(--grey40);">背景颜色</label>`;
    html += `<input id="mc-ci-bg-color" class="text_pole" type="color" value="${gs.frameBackgroundColor ?? '#000000'}" style="width:60px;height:30px;">`;
    html += '</div>';
    html += '<div style="margin-bottom:8px;">';
    html += `<label style="display:block;margin-bottom:3px;font-size:0.85em;color:var(--grey40);">背景透明度</label>`;
    html += `<input id="mc-ci-bg-opacity" class="text_pole" type="range" value="${gs.frameBackgroundOpacity ?? 1}" min="0" max="1" step="0.05" style="width:150px;">`;
    html += ` <span id="mc-ci-bg-opacity-val" style="font-size:0.85em;">${gs.frameBackgroundOpacity ?? 1}</span>`;
    html += '</div>';
    html += '</div>';
    return html;
}

/** 绑定设置面板事件 */
export function bindSettingsEvents() {
    $(document).off('input change', '#mc-ci-img-width, #mc-ci-img-height, #mc-ci-bg-color, #mc-ci-bg-opacity').on('input change', '#mc-ci-img-width, #mc-ci-img-height, #mc-ci-bg-color, #mc-ci-bg-opacity', function () {
        const gs = getGeneralSettings();
        const id = $(this).attr('id');
        const val = id === 'mc-ci-bg-opacity' ? parseFloat($(this).val()) : $(this).val();
        const key = id === 'mc-ci-img-width' ? 'imageWidth' : id === 'mc-ci-img-height' ? 'imageHeight' : id === 'mc-ci-bg-color' ? 'frameBackgroundColor' : 'frameBackgroundOpacity';
        gs[key] = val;
        updateGeneralSettings(gs);
        if (id === 'mc-ci-bg-opacity') $('#mc-ci-bg-opacity-val').text(val);
    });
}
