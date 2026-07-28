// ui/carousel-settings.js — 聊天图片轮播配置 UI（插位槽，简化版）

import { getChatImagesData, saveSettings, getAnimationTypes } from '../../core/data.js';
import { escapeHtml } from '../../shared/utils.js';

function defaultSlots() {
    return [{ enabled: true, totalDuration: 200, animationType: '果冻弹性', animationDuration: 0.9, clickAction: 'enlarge' }];
}

/** 保存每个插位的折叠状态 */
let _collapsedSlots = new Set();

function saveCollapsedState() {
    _collapsedSlots = new Set();
    $('.mc-ci-carousel-slot').each(function () {
        const idx = $(this).data('slot');
        const $body = $(`.mc-ci-carousel-slot-body[data-slot="${idx}"]`);
        if ($body.length && $body.is(':hidden')) _collapsedSlots.add(idx);
    });
}

export function renderCarouselSettings() {
    const $panel = $('#mc-ci-content');
    if (!$panel.length) return;

    saveCollapsedState();

    const data = getChatImagesData();
    const slots = data.slots || defaultSlots();

    $panel.html(`
    <div style="padding:6px;font-size:0.82em;">
        <div style="display:flex;align-items:center;gap:6px;margin-bottom:6px;border-bottom:1px solid var(--borderColor);padding-bottom:6px;">
            <span style="font-weight:bold;font-size:0.95em;"><i class="fa-solid fa-sliders"></i> 轮播配置</span>
            <span style="flex:1;"></span>
            <button id="mc-ci-carousel-add" class="menu_button" style="font-size:0.8em;white-space:nowrap;"><i class="fa-solid fa-plus"></i> 添加插位</button>
            <button id="mc-ci-carousel-remove" class="menu_button" style="font-size:0.8em;white-space:nowrap;color:var(--dangerColor);"><i class="fa-solid fa-minus"></i> 移除末尾</button>
        </div>
        <div style="display:flex;gap:12px;align-items:center;margin-bottom:10px;padding:6px 10px;border:1px solid var(--borderColor);border-radius:6px;background:var(--white10);flex-wrap:wrap;">
            <div style="display:flex;align-items:center;gap:4px;">
                <span style="font-size:0.85em;color:var(--grey40);">播放最近</span>
                <input id="mc-ci-carousel-play" class="text_pole" type="number" value="${data.carouselPlayCount ?? 1}" min="0" max="999" style="width:50px;font-size:0.88em;text-align:center;padding:2px 4px;">
                <span style="font-size:0.85em;color:var(--grey40);">层</span>
            </div>
            <div style="display:flex;align-items:center;gap:4px;">
                <span style="font-size:0.85em;color:var(--grey40);">展示最近</span>
                <input id="mc-ci-carousel-show" class="text_pole" type="number" value="${data.carouselShowCount ?? 1}" min="0" max="999" style="width:50px;font-size:0.88em;text-align:center;padding:2px 4px;">
                <span style="font-size:0.85em;color:var(--grey40);">层</span>
            </div>
            <span style="font-size:0.75em;color:var(--grey40);">播放 ≤ 展示</span>
        </div>
        <div id="mc-ci-carousel-slots">
            ${renderSlots(slots)}
        </div>
        ${slots.length === 0 ? '<div style="text-align:center;padding:20px;color:var(--grey40);font-size:0.85em;">暂无插位，点击上方添加</div>' : ''}
    </div>`);

    bindCarouselEvents();
}

function renderSlots(slots) {
    if (!slots || slots.length === 0) return '';
    return slots.map((slot, idx) => `
        <div class="mc-ci-carousel-slot" data-slot="${idx}" style="margin-bottom:6px;padding:8px 10px;border:1px solid var(--borderColor);border-radius:6px;background:var(--white10);${slot.enabled === false ? 'opacity:0.5;' : ''}">
            <div style="font-weight:bold;font-size:0.88em;margin-bottom:6px;border-bottom:1px solid var(--borderColor);padding-bottom:4px;display:flex;align-items:center;gap:6px;">
                <button class="mc-ci-carousel-enabled" data-slot="${idx}" style="font-size:0.8em;cursor:pointer;background:none;border:none;padding:0;color:${slot.enabled === false ? 'var(--grey40)' : 'var(--primary)'}">
                    <i class="fa-solid ${slot.enabled === false ? 'fa-toggle-off' : 'fa-toggle-on'}"></i>
                </button>
                <span>${idx + 1}号插位</span>
                <span style="flex:1;"></span>
                <span class="mc-ci-carousel-collapse-btn" data-slot="${idx}" style="cursor:pointer;font-size:0.85em;color:var(--grey40);"><i class="fa-solid ${_collapsedSlots.has(idx) ? 'fa-chevron-down' : 'fa-chevron-up'}"></i></span>
            </div>
            <div class="mc-ci-carousel-slot-body" data-slot="${idx}" style="${_collapsedSlots.has(idx) ? 'display:none;' : ''}">
            <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin-bottom:6px;">
                <div style="display:flex;align-items:center;gap:4px;">
                    <span style="font-size:0.85em;color:var(--grey40);">总时长</span>
                    <input class="mc-ci-carousel-totaldur text_pole" data-slot="${idx}" type="number" value="${slot.totalDuration ?? 200}" min="1" max="3600" style="width:55px;font-size:0.85em;text-align:center;padding:2px 4px;">
                    <span style="font-size:0.85em;color:var(--grey40);">秒</span>
                </div>
            </div>
            <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;padding-top:6px;border-top:1px dashed var(--borderColor);">
                <div style="display:flex;align-items:center;gap:4px;">
                    <span style="font-size:0.85em;color:var(--grey40);">动画</span>
                    <select class="mc-ci-carousel-animtype text_pole" data-slot="${idx}" style="font-size:0.85em;padding:2px 4px;">
                        <option value="random" ${slot.animationType === 'random' ? 'selected' : ''}>🎲 随机</option>
                        ${(getAnimationTypes() || []).map(t =>
                            `<option value="${t.name}" ${(slot.animationType || '果冻弹性') === t.name ? 'selected' : ''}>${t.name}</option>`
                        ).join('')}
                        <option value="" ${!slot.animationType ? 'selected' : ''}>无</option>
                    </select>
                </div>
                <div style="display:flex;align-items:center;gap:4px;">
                    <span style="font-size:0.85em;color:var(--grey40);">时长</span>
                    <input class="mc-ci-carousel-animdur text_pole" data-slot="${idx}" type="number" value="${slot.animationDuration ?? 0.9}" min="0" max="10" step="0.1" style="width:50px;font-size:0.85em;text-align:center;padding:2px 4px;">
                    <span style="font-size:0.85em;color:var(--grey40);">秒</span>
                </div>
                <div style="display:flex;align-items:center;gap:4px;">
                    <span style="font-size:0.85em;color:var(--grey40);">点击</span>
                    <select class="mc-ci-carousel-clickaction text_pole" data-slot="${idx}" style="font-size:0.85em;padding:2px 4px;">
                        <option value="enlarge" ${(slot.clickAction || 'enlarge') === 'enlarge' ? 'selected' : ''}>放大</option>
                        <option value="interact" ${slot.clickAction === 'interact' ? 'selected' : ''}>分区抖动</option>
                        <option value="both" ${slot.clickAction === 'both' ? 'selected' : ''}>抖动后放大</option>
                    </select>
                </div>
            </div>
        </div>
    </div>
    `).join('');
}

function bindCarouselEvents() {
    function getSlots() { return getChatImagesData().slots || defaultSlots(); }
    function saveSlots(slots) {
        getChatImagesData().slots = slots;
        saveSettings();
        renderCarouselSettings();
    }

    $(document).off('click', '.mc-ci-carousel-collapse-btn').on('click', '.mc-ci-carousel-collapse-btn', function () {
        const idx = $(this).data('slot');
        const $body = $(`.mc-ci-carousel-slot-body[data-slot="${idx}"]`);
        const $icon = $(this).find('i');
        $body.toggle();
        $icon.toggleClass('fa-chevron-up fa-chevron-down');
    });
    $(document).off('click', '.mc-ci-carousel-enabled').on('click', '.mc-ci-carousel-enabled', function () {
        const idx = parseInt($(this).data('slot'));
        const slots = getSlots();
        if (slots[idx]) { slots[idx].enabled = slots[idx].enabled === false ? true : false; saveSlots(slots); }
    });
    $(document).off('click', '#mc-ci-carousel-add').on('click', '#mc-ci-carousel-add', function () {
        const slots = getSlots();
        slots.push({ enabled: true, totalDuration: 200, animationType: '果冻弹性', animationDuration: 0.9, clickAction: 'enlarge' });
        saveSlots(slots);
    });
    $(document).off('click', '#mc-ci-carousel-remove').on('click', '#mc-ci-carousel-remove', function () {
        const slots = getSlots();
        if (slots.length <= 1) { toastr.warning('至少保留 1 个插位'); return; }
        slots.pop();
        saveSlots(slots);
    });
    $(document).off('change', '#mc-ci-carousel-play').on('change', '#mc-ci-carousel-play', function () {
        const val = parseInt($(this).val());
        if (!isNaN(val) && val >= 0) { getChatImagesData().carouselPlayCount = val; saveSettings(); }
        const show = parseInt($('#mc-ci-carousel-show').val());
        if (val > show) toastr.warning('播放层数不能大于展示层数');
    });
    $(document).off('change', '#mc-ci-carousel-show').on('change', '#mc-ci-carousel-show', function () {
        const val = parseInt($(this).val());
        if (!isNaN(val) && val >= 0) { getChatImagesData().carouselShowCount = val; saveSettings(); }
    });
    $(document).off('change', '.mc-ci-carousel-totaldur').on('change', '.mc-ci-carousel-totaldur', function () {
        const idx = parseInt($(this).data('slot'));
        const slots = getSlots();
        if (slots[idx]) { slots[idx].totalDuration = parseInt($(this).val()) || 200; saveSlots(slots); }
    });
    $(document).off('change', '.mc-ci-carousel-animtype').on('change', '.mc-ci-carousel-animtype', function () {
        const idx = parseInt($(this).data('slot'));
        const slots = getSlots();
        if (slots[idx]) { slots[idx].animationType = $(this).val() || ''; saveSlots(slots); }
    });
    $(document).off('change', '.mc-ci-carousel-animdur').on('change', '.mc-ci-carousel-animdur', function () {
        const idx = parseInt($(this).data('slot'));
        const slots = getSlots();
        if (slots[idx]) { slots[idx].animationDuration = parseFloat($(this).val()) || 0; saveSlots(slots); }
    });
    $(document).off('change', '.mc-ci-carousel-clickaction').on('change', '.mc-ci-carousel-clickaction', function () {
        const idx = parseInt($(this).data('slot'));
        const slots = getSlots();
        if (slots[idx]) { slots[idx].clickAction = $(this).val() || 'enlarge'; saveSlots(slots); }
    });
}
