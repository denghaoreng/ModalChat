// nav-match-scoring/carousel-config.js — 轮播配置 UI（插位槽）

import { getMatchScoringData, saveSettings, getAnimationTypes } from '../data.js';
import { escapeHtml } from '../shared/utils.js';

function defaultSlots() {
    return [{ types: ['image', 'video', 'audio'], count: 3, imageDuration: 5, minScore: 0, totalDuration: 200, animationType: '果冻弹性', animationDuration: 0.9, clickAction: 'enlarge' }];
}

export function renderCarouselConfig() {
    const $panel = $('#mc-ms-carousel-panel');
    if (!$panel.length) return;

    const data = getMatchScoringData();
    const slots = data.slots || defaultSlots();

    $panel.html(`
    <div style="padding:6px;font-size:0.82em;">
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;border-bottom:1px solid var(--borderColor);padding-bottom:6px;">
            <span style="font-weight:bold;font-size:0.95em;"><i class="fa-solid fa-layer-group"></i> 轮播配置</span>
            <span style="flex:1;"></span>
            <button id="mc-carousel-add" class="menu_button" style="font-size:0.8em;white-space:nowrap;"><i class="fa-solid fa-plus"></i> 添加插位</button>
            <button id="mc-carousel-remove" class="menu_button" style="font-size:0.8em;white-space:nowrap;color:var(--dangerColor);"><i class="fa-solid fa-minus"></i> 移除末尾</button>
        </div>
        <div style="display:flex;gap:20px;align-items:center;margin-bottom:10px;padding:8px;border:1px solid var(--borderColor);border-radius:6px;background:var(--white10);">
            <div style="display:flex;align-items:center;gap:6px;">
                <span style="font-size:0.85em;font-weight:500;color:var(--grey40);">播放最近</span>
                <input id="mc-carousel-play" class="text_pole" type="number" value="${data.carouselPlayCount ?? 1}" min="0" max="999" style="width:55px;font-size:0.88em;text-align:center;padding:3px 6px;">
                <span style="font-size:0.85em;color:var(--grey40);">层的轮播</span>
            </div>
            <div style="display:flex;align-items:center;gap:6px;">
                <span style="font-size:0.85em;font-weight:500;color:var(--grey40);">展示最近</span>
                <input id="mc-carousel-show" class="text_pole" type="number" value="${data.carouselShowCount ?? 1}" min="0" max="999" style="width:55px;font-size:0.88em;text-align:center;padding:3px 6px;">
                <span style="font-size:0.85em;color:var(--grey40);">层的轮播</span>
            </div>
            <span style="font-size:0.75em;color:var(--grey40);">播放 ≤ 展示，至少展示才能播放</span>
        </div>
        <div id="mc-carousel-slots">
            ${renderSlots(slots)}
        </div>
        ${slots.length === 0 ? '<div style="text-align:center;padding:20px;color:var(--grey40);font-size:0.85em;">暂无插位，点击上方添加</div>' : ''}
    </div>`);
}

function renderSlots(slots) {
    if (!slots || slots.length === 0) return '';
    const typeLabels = { image: '🖼️ 图片', video: '🎬 视频', audio: '🎵 音频', hybrid: '🔀 图音混合' };
    return slots.map((slot, idx) => `
        <div class="mc-carousel-slot" data-slot="${idx}" style="margin-bottom:8px;padding:10px;border:1px solid var(--borderColor);border-radius:6px;background:var(--white10);">
            <div style="font-weight:bold;font-size:0.9em;margin-bottom:8px;border-bottom:1px solid var(--borderColor);padding-bottom:4px;">
                ${idx + 1}号插位
                <span style="font-weight:normal;font-size:0.78em;color:var(--grey40);margin-left:6px;">${slot.count ?? 3} 个文件 · ${slot.imageDuration ?? 5} 秒/图片 · ≥${slot.minScore ?? 0} 分</span>
            </div>            <div style="display:flex;gap:20px;align-items:center;flex-wrap:wrap;margin-bottom:8px;">
                <div style="display:flex;align-items:center;gap:6px;">
                    <span style="font-size:0.88em;color:var(--grey40);font-weight:500;">总时长</span>
                    <input class="mc-carousel-totaldur text_pole" data-slot="${idx}" type="number" value="${slot.totalDuration ?? 200}" min="1" max="3600" style="width:65px;font-size:0.9em;text-align:center;padding:3px 6px;">
                    <span style="font-size:0.88em;color:var(--grey40);">秒后停止轮播</span>
                </div>
            </div>            <div style="margin-bottom:8px;">
                <div style="font-size:0.85em;color:var(--grey40);margin-bottom:6px;">允许的媒体类型</div>
                <div style="display:flex;gap:12px;flex-wrap:wrap;">
                    ${['image', 'video', 'audio', 'hybrid'].map(t => `
                        <label style="display:inline-flex;align-items:center;gap:6px;font-size:0.9em;cursor:pointer;padding:6px 14px;border:1px solid ${(slot.types || []).includes(t) ? 'var(--primary)' : 'var(--borderColor)'};border-radius:6px;background:${(slot.types || []).includes(t) ? 'rgba(var(--primary-rgb),0.1)' : 'transparent'};">
                            <input type="checkbox" class="mc-carousel-type" data-slot="${idx}" value="${t}" ${(slot.types || []).includes(t) ? 'checked' : ''} style="width:16px;height:16px;accent-color:var(--primary);">
                            ${typeLabels[t]}
                        </label>
                    `).join('')}
                </div>
            </div>
            <div style="display:flex;gap:20px;align-items:center;flex-wrap:wrap;">
                <div style="display:flex;align-items:center;gap:6px;">
                    <span style="font-size:0.88em;color:var(--grey40);font-weight:500;">展示前</span>
                    <input class="mc-carousel-count text_pole" data-slot="${idx}" type="number" value="${slot.count ?? 3}" min="1" max="20" style="width:55px;font-size:0.9em;text-align:center;padding:3px 6px;">
                    <span style="font-size:0.88em;color:var(--grey40);">个</span>
                </div>
                <div style="display:flex;align-items:center;gap:6px;">
                    <span style="font-size:0.88em;color:var(--grey40);font-weight:500;">图片展示</span>
                    <input class="mc-carousel-imgdur text_pole" data-slot="${idx}" type="number" value="${slot.imageDuration ?? 5}" min="1" max="60" style="width:55px;font-size:0.9em;text-align:center;padding:3px 6px;">
                    <span style="font-size:0.88em;color:var(--grey40);">秒</span>
                </div>
                <div style="display:flex;align-items:center;gap:6px;">
                    <span style="font-size:0.88em;color:var(--grey40);font-weight:500;">最低</span>
                    <input class="mc-carousel-minscore text_pole" data-slot="${idx}" type="number" value="${slot.minScore ?? 0}" min="0" step="0.1" style="width:65px;font-size:0.9em;text-align:center;padding:3px 6px;">
                    <span style="font-size:0.88em;color:var(--grey40);">分</span>
                </div>
            </div>
            <div style="margin-bottom:6px;margin-top:8px;padding-top:8px;border-top:1px dashed var(--borderColor);">
                <div style="font-size:0.85em;color:var(--grey40);margin-bottom:6px;">出现动画</div>
                <div style="display:flex;gap:20px;align-items:center;flex-wrap:wrap;">
                    <div style="display:flex;align-items:center;gap:6px;">
                        <select class="mc-carousel-animtype text_pole" data-slot="${idx}" style="font-size:0.9em;padding:3px 6px;">
                            <option value="random" ${slot.animationType === 'random' ? 'selected' : ''}>🎲 随机</option>
                            ${(getAnimationTypes() || []).map(t =>
                                `<option value="${t.name}" ${(slot.animationType || '果冻弹性') === t.name ? 'selected' : ''}>${t.name}</option>`
                            ).join('')}
                            <option value="" ${!slot.animationType ? 'selected' : ''}>无</option>
                        </select>
                    </div>
                    <div style="display:flex;align-items:center;gap:6px;">
                        <span style="font-size:0.88em;color:var(--grey40);">动画时长</span>
                        <input class="mc-carousel-animdur text_pole" data-slot="${idx}" type="number" value="${slot.animationDuration ?? 0.9}" min="0" max="10" step="0.1" style="width:60px;font-size:0.9em;text-align:center;padding:3px 6px;">
                        <span style="font-size:0.88em;color:var(--grey40);">秒</span>
                    </div>
                </div>
            </div>
            <div style="margin-bottom:6px;margin-top:8px;padding-top:8px;border-top:1px dashed var(--borderColor);">
                <div style="font-size:0.85em;color:var(--grey40);margin-bottom:6px;">点击交互</div>
                <div style="display:flex;gap:20px;align-items:center;flex-wrap:wrap;">
                    <div style="display:flex;align-items:center;gap:6px;">
                        <select class="mc-carousel-clickaction text_pole" data-slot="${idx}" style="font-size:0.9em;padding:3px 6px;">
                            <option value="enlarge" ${(slot.clickAction || 'enlarge') === 'enlarge' ? 'selected' : ''}>🖼️ 点击放大</option>
                            <option value="interact" ${slot.clickAction === 'interact' ? 'selected' : ''}>👆 分区抖动</option>
                            <option value="both" ${slot.clickAction === 'both' ? 'selected' : ''}>🔄 抖动后放大</option>
                        </select>
                    </div>
                </div>
            </div>
        </div>
    `).join('');
}

export function bindCarouselEvents() {
    function getSlots() { return getMatchScoringData().slots || defaultSlots(); }
    function saveSlots(slots) {
        getMatchScoringData().slots = slots;
        saveSettings();
        renderCarouselConfig();
        bindCarouselEvents();
    }

    $(document).off('click', '#mc-carousel-add').on('click', '#mc-carousel-add', function () {
        const slots = getSlots();
        slots.push({ types: ['image', 'video', 'audio'], count: 3, imageDuration: 5, minScore: 0, totalDuration: 200, animationType: '果冻弹性', animationDuration: 0.9, clickAction: 'enlarge' });
        saveSlots(slots);
    });
    $(document).off('click', '#mc-carousel-remove').on('click', '#mc-carousel-remove', function () {
        const slots = getSlots();
        if (slots.length <= 1) { toastr.warning('至少保留 1 个插位'); return; }
        slots.pop();
        saveSlots(slots);
    });
    $(document).off('change', '#mc-carousel-play').on('change', '#mc-carousel-play', function () {
        const val = parseInt($(this).val());
        if (!isNaN(val) && val >= 0) { getMatchScoringData().carouselPlayCount = val; saveSettings(); }
        const show = parseInt($('#mc-carousel-show').val());
        if (val > show) toastr.warning('播放层数不能大于展示层数');
    });
    $(document).off('change', '#mc-carousel-show').on('change', '#mc-carousel-show', function () {
        const val = parseInt($(this).val());
        if (!isNaN(val) && val >= 0) { getMatchScoringData().carouselShowCount = val; saveSettings(); }
    });
    $(document).off('change', '#mc-carousel-duration').on('change', '#mc-carousel-duration', function () {
        const val = parseInt($(this).val());
        if (!isNaN(val) && val >= 1) { getMatchScoringData().carouselTotalDuration = val; saveSettings(); }
    });
    $(document).off('change', '.mc-carousel-type').on('change', '.mc-carousel-type', function () {
        const idx = parseInt($(this).data('slot'));
        const val = $(this).val();
        const slots = getSlots();
        if (!slots[idx]) return;
        if (!slots[idx].types) slots[idx].types = ['image', 'video', 'audio'];
        if (val === 'hybrid') {
            if ($(this).is(':checked')) {
                // 勾选混合时自动补上图片和音频
                if (!slots[idx].types.includes('hybrid')) slots[idx].types.push('hybrid');
                if (!slots[idx].types.includes('image')) slots[idx].types.push('image');
                if (!slots[idx].types.includes('audio')) slots[idx].types.push('audio');
            } else {
                slots[idx].types = slots[idx].types.filter(t => t !== 'hybrid');
            }
        } else {
            if ($(this).is(':checked')) {
                if (!slots[idx].types.includes(val)) slots[idx].types.push(val);
            } else {
                slots[idx].types = slots[idx].types.filter(t => t !== val);
                // 取消图片或音频时也取消混合
                if ((val === 'image' || val === 'audio') && slots[idx].types.includes('hybrid')) {
                    slots[idx].types = slots[idx].types.filter(t => t !== 'hybrid');
                }
            }
        }
        if (slots[idx].types.length === 0) slots[idx].types = ['image'];
        saveSlots(slots);
    });
    $(document).off('change', '.mc-carousel-count').on('change', '.mc-carousel-count', function () {
        const idx = parseInt($(this).data('slot'));
        const slots = getSlots();
        if (slots[idx]) { slots[idx].count = parseInt($(this).val()) || 3; saveSlots(slots); }
    });
    $(document).off('change', '.mc-carousel-imgdur').on('change', '.mc-carousel-imgdur', function () {
        const idx = parseInt($(this).data('slot'));
        const slots = getSlots();
        if (slots[idx]) { slots[idx].imageDuration = parseInt($(this).val()) || 5; saveSlots(slots); }
    });
    $(document).off('change', '.mc-carousel-minscore').on('change', '.mc-carousel-minscore', function () {
        const idx = parseInt($(this).data('slot'));
        const slots = getSlots();
        if (slots[idx]) { slots[idx].minScore = parseFloat($(this).val()) || 0; saveSlots(slots); }
    });
    $(document).off('change', '.mc-carousel-totaldur').on('change', '.mc-carousel-totaldur', function () {
        const idx = parseInt($(this).data('slot'));
        const slots = getSlots();
        if (slots[idx]) { slots[idx].totalDuration = parseInt($(this).val()) || 200; saveSlots(slots); }
    });
    $(document).off('change', '.mc-carousel-animtype').on('change', '.mc-carousel-animtype', function () {
        const idx = parseInt($(this).data('slot'));
        const slots = getSlots();
        if (slots[idx]) { slots[idx].animationType = $(this).val() || ''; saveSlots(slots); }
    });
    $(document).off('change', '.mc-carousel-animdur').on('change', '.mc-carousel-animdur', function () {
        const idx = parseInt($(this).data('slot'));
        const slots = getSlots();
        if (slots[idx]) { slots[idx].animationDuration = parseFloat($(this).val()) || 0; saveSlots(slots); }
    });
    $(document).off('change', '.mc-carousel-clickaction').on('change', '.mc-carousel-clickaction', function () {
        const idx = parseInt($(this).data('slot'));
        const slots = getSlots();
        if (slots[idx]) { slots[idx].clickAction = $(this).val() || 'enlarge'; saveSlots(slots); }
    });
}
