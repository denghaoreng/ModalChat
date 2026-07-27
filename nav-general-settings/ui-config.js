// nav-general-settings/ui-config.js — UI配置子标签页

import { getGeneralSettings, updateGeneralSettings } from '../core/data.js';

export function renderUiConfig() {
    const gs = getGeneralSettings();
    const iw = gs.imageWidth ?? 500;
    const ih = gs.imageHeight ?? 500;
    const mw = gs.mediaWidth ?? 400;
    const mh = gs.mediaHeight ?? 400;
    const bgColor = gs.frameBackgroundColor ?? '#000000';
    const bgOpacity = gs.frameBackgroundOpacity ?? 1;

    return `
    <div style="padding:4px 8px;">
        <h3 style="margin:0 0 10px 0;font-size:0.95em;padding-bottom:6px;border-bottom:1px solid var(--borderColor);">
            <i class="fa-solid fa-image"></i> 聊天图片设置 — 插入到聊天消息中的图片尺寸（像素）
        </h3>
        <div style="margin-bottom:12px;padding:10px;background:var(--white15);border-radius:6px;">
            <div style="display:flex;gap:20px;align-items:center;">
                <div style="display:flex;align-items:center;gap:6px;">
                    <label style="font-size:0.85em;min-width:40px;">宽度</label>
                    <input id="mc-ci-width" class="text_pole" type="number" min="0" max="4000" step="10" value="${iw}" style="width:80px;text-align:center;">
                </div>
                <div style="display:flex;align-items:center;gap:6px;">
                    <label style="font-size:0.85em;min-width:40px;">高度</label>
                    <input id="mc-ci-height" class="text_pole" type="number" min="0" max="4000" step="10" value="${ih}" style="width:80px;text-align:center;">
                </div>
            </div>
        </div>

        <h3 style="margin:0 0 10px 0;font-size:0.95em;padding-bottom:6px;border-bottom:1px solid var(--borderColor);">
            <i class="fa-solid fa-film"></i> 匹配打分媒体设置 — 插入到聊天消息中的媒体尺寸（像素，0=自动）
        </h3>
        <div style="margin-bottom:12px;padding:10px;background:var(--white15);border-radius:6px;">
            <div style="display:flex;gap:20px;align-items:center;">
                <div style="display:flex;align-items:center;gap:6px;">
                    <label style="font-size:0.85em;min-width:40px;">宽度</label>
                    <input id="mc-ms-width" class="text_pole" type="number" min="0" max="4000" step="10" value="${mw}" style="width:80px;text-align:center;">
                </div>
                <div style="display:flex;align-items:center;gap:6px;">
                    <label style="font-size:0.85em;min-width:40px;">高度</label>
                    <input id="mc-ms-height" class="text_pole" type="number" min="0" max="4000" step="10" value="${mh}" style="width:80px;text-align:center;">
                </div>
            </div>
        </div>

        <h3 style="margin:0 0 10px 0;font-size:0.95em;padding-bottom:6px;border-bottom:1px solid var(--borderColor);">
            <i class="fa-solid fa-palette"></i> 背景设置
        </h3>
        <div style="margin-bottom:12px;padding:10px;background:var(--white15);border-radius:6px;">
            <div style="display:flex;gap:20px;align-items:center;">
                <div style="display:flex;align-items:center;gap:6px;">
                    <label style="font-size:0.85em;min-width:40px;">颜色</label>
                    <input id="mc-bg-color" type="color" value="${bgColor}" style="width:40px;height:28px;padding:0;border:1px solid var(--borderColor);border-radius:4px;cursor:pointer;background:none;">
                </div>
                <div style="display:flex;align-items:center;gap:6px;">
                    <label style="font-size:0.85em;min-width:40px;">透明度</label>
                    <input id="mc-bg-opacity" class="text_pole" type="number" min="0" max="1" step="0.05" value="${bgOpacity}" style="width:60px;text-align:center;">
                    <span style="font-size:0.8em;opacity:0.6;">0~1</span>
                </div>
            </div>
        </div>
    </div>`;
}

export function bindUiEvents() {
    $('#mc-ci-width').off('input').on('input', function () {
        const val = parseInt($(this).val());
        if (!isNaN(val) && val >= 0) { updateGeneralSettings({ imageWidth: val }); }
    });
    $('#mc-ci-height').off('input').on('input', function () {
        const val = parseInt($(this).val());
        if (!isNaN(val) && val >= 0) { updateGeneralSettings({ imageHeight: val }); }
    });
    $('#mc-ms-width').off('input').on('input', function () {
        const val = parseInt($(this).val());
        if (!isNaN(val) && val >= 0) { updateGeneralSettings({ mediaWidth: val }); }
    });
    $('#mc-ms-height').off('input').on('input', function () {
        const val = parseInt($(this).val());
        if (!isNaN(val) && val >= 0) { updateGeneralSettings({ mediaHeight: val }); }
    });
    $('#mc-bg-color').off('input').on('input', function () {
        updateGeneralSettings({ frameBackgroundColor: $(this).val() });
    });
    $('#mc-bg-opacity').off('input').on('input', function () {
        const val = parseFloat($(this).val());
        if (!isNaN(val) && val >= 0 && val <= 1) { updateGeneralSettings({ frameBackgroundOpacity: val }); }
    });
}
