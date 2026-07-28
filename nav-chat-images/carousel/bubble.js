// carousel/bubble.js — 聊天气泡聊天图片轮播渲染（基于插位槽配置）

import { getGeneralSettings, getAnimationTypes, getChatImagesData, getBouncePresets } from '../../core/data.js';
import { escapeHtml, hexToRgb } from '../../shared/utils.js';
import { showFileEnlarge } from '../../shared/file-enlarge.js';
import { setupDragDeformation, autoBounce } from '../../shared/image-drag-physics/index.js';

/**
 * 将聊天图片匹配结果插入 AI 聊天气泡中（基于插位槽配置）
 * @param {number|string} messageId - 消息在 chat 数组中的索引
 * @param {Array} items - 匹配到的图片项 [{ image: { url, name }, ruleId, order, duration }]
 */
export async function renderCIResults(messageId, items) {
    if (!items || items.length === 0) return;
    const ciData = getChatImagesData();
    const slots = ciData.slots || [{ enabled: true, totalDuration: 200, animationType: '果冻弹性', animationDuration: 0.9, clickAction: 'enlarge' }];
    const playCount = ciData.carouselPlayCount ?? 1;
    const showCount = ciData.carouselShowCount ?? 1;

    const { chat } = (await import('../../../../../extensions.js')).getContext();
    const distance = chat.length - 1 - messageId;
    if (distance < 0 || distance >= showCount) return;
    const autoPlay = distance < playCount;

    setTimeout(() => {
        try {
            const $msg = $(`.mes[mesid="${messageId}"]`);
            if (!$msg.length) return;
            $msg.find('.mc-ci-chat-results').remove();

            let allHtml = '';
            for (let si = 0; si < slots.length; si++) {
                const slot = slots[si];
                if (slot.enabled === false) continue;
                const slotHtml = buildSlotHtml(items, slot, autoPlay, si);
                if (slotHtml) allHtml += slotHtml;
            }
            if (!allHtml) return;

            const html = '<div class="mc-ci-chat-results">' + allHtml + '</div>';
            // 插入到聊天图片旧容器的位置，或紧随消息文本
            const $ci = $msg.find('.chat-image-queued').last();
            if ($ci.length) $ci.after(html);
            else {
                const $mt = $msg.find('.mes_text');
                $mt.length ? $mt.after(html) : $msg.find('.mes_content').append(html);
            }

            // 点击放大
            $msg.off('click touchend', '.mc-ci-slot-item img')
                .on('click touchend', '.mc-ci-slot-item img', function (e) {
                    if (e.type === 'touchend') return;
                    if ($(this).attr('data-mc-dragged')) return;
                    const $slotRes = $(this).closest('.mc-ci-slot-results');
                    const ciData = getChatImagesData();
                    const slotCfgIdx = parseInt($slotRes.data('slot-cfg-idx'));
                    const slotCfg = (!isNaN(slotCfgIdx) && (ciData.slots || [])[slotCfgIdx]) ? (ciData.slots || [])[slotCfgIdx] : {};
                    const action = slotCfg.clickAction || 'enlarge';
                    if (action !== 'interact') {
                        const src = $(this).attr('src');
                        if (src) showFileEnlarge(src);
                    }
                });

            // 拖拽抖动
            if ($msg.find('.mc-ci-slot-item img').length) {
                setupDragDeformation($msg, '.mc-ci-slot-item img');
            }

            // 弹入动画（仅最新消息）
            if (distance === 0) {
                const presets = getBouncePresets();
                if (presets && presets.length > 0) {
                    const $bounceImgs = $msg.find('.mc-ci-slot-item img');
                    let loadedCount = 0;
                    const totalImgs = $bounceImgs.length;
                    if (totalImgs === 0) return;
                    function tryBounce() {
                        if (loadedCount >= totalImgs) {
                            $bounceImgs.each(function () { autoBounce(this, presets); });
                        }
                    }
                    $bounceImgs.each(function () {
                        if (this.complete && this.naturalWidth) {
                            loadedCount++;
                            tryBounce();
                        } else {
                            this.addEventListener('load', function onLoad() {
                                this.removeEventListener('load', onLoad);
                                loadedCount++;
                                tryBounce();
                            });
                        }
                    });
                }
            }
        } catch (err) {
            console.warn('ModalChat CI: renderCIResults error', err);
        }
    }, 200);
}

/**
 * 根据插位槽配置构建单个插位的 HTML
 */
function buildSlotHtml(items, slot, autoPlay, slotCfgIdx) {
    const { totalDuration = 200, animationType = '果冻弹性', animationDuration = 0.9 } = slot;
    const totalDurationMs = totalDuration * 1000;

    const gs = getGeneralSettings();
    const mw = gs?.imageWidth || 500, mh = gs?.imageHeight || 500;
    const bgColor = gs?.frameBackgroundColor || '#000000';
    const bgOpacity = gs?.frameBackgroundOpacity || 1;
    const bgRgb = hexToRgb(bgColor);
    let mediaStyle = 'max-width:100%;object-fit:contain;border-radius:6px;display:block;margin:0 auto;';
    if (mw > 0 && mh > 0) {
        mediaStyle += `width:${mw}px;aspect-ratio:${mw}/${mh};height:auto;max-height:90vh;`;
    } else if (mw > 0) {
        mediaStyle += `width:${mw}px;height:auto;`;
    } else if (mh > 0) {
        mediaStyle += `height:${mh}px;max-height:90vh;width:auto;`;
    } else {
        mediaStyle += 'width:auto;height:auto;';
    }

    if (items.length === 0) return null;

    const slotId = 'ci_slot_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6);
    let animStyle = '', animName = '';
    const animTypes = getAnimationTypes();
    let animDef;
    if (animationType === 'random' && animTypes.length > 0) {
        const valid = animTypes.filter(t => t.keyframes);
        if (valid.length > 0) animDef = valid[Math.floor(Math.random() * valid.length)];
    } else {
        animDef = animTypes.find(t => t.name === animationType);
    }
    if (animDef && animDef.keyframes && animationDuration > 0) {
        animName = 'mc_ci_anim_' + slotId.replace(/[^a-z0-9]/gi, '_');
        animStyle = `<style>.${animName} img{animation:${animName} ${animationDuration}s ${animDef.timingFunction || 'ease-out'}}@keyframes ${animName}{${animDef.keyframes}}</style>`;
    }

    let html = animStyle + `<div class="mc-ci-slot-results" data-slot-id="${slotId}" data-slot-cfg-idx="${slotCfgIdx}">`;
    items.forEach((item, idx) => {
        const url = item.image?.url;
        if (!url) return;
        const isFirst = idx === 0;
        const display = (!autoPlay || isFirst) ? 'block' : 'none';
        html += `<div class="mc-ci-slot-item ${animName}" data-slot-idx="${idx}" style="display:${display};text-align:center;">
            <div style="font-size:0.82em;color:var(--grey40);margin-bottom:2px;">${escapeHtml(item.image.name || '')}</div>
            <div style="position:relative;display:inline-block;max-width:100%;border-radius:8px;overflow:hidden;background:rgba(${bgRgb},${bgOpacity});">
                <img src="${escapeHtml(url)}" style="${mediaStyle}" loading="eager" crossorigin="anonymous">
            </div>
        </div>`;
    });
    html += '</div>';

    if (autoPlay) {
        setTimeout(() => {
            const $container = $(`.mc-ci-slot-results[data-slot-id="${slotId}"]`);
            if (!$container.length || items.length <= 1) return;
            let currentIdx = 0;
            let totalTimer = null;

            function showNext() {
                const oldIdx = currentIdx;
                currentIdx = (currentIdx + 1) % items.length;
                $container.find(`.mc-ci-slot-item[data-slot-idx="${oldIdx}"]`).hide();
                const $newItem = $container.find(`.mc-ci-slot-item[data-slot-idx="${currentIdx}"]`).show();
                $newItem.find('img').each(function () {
                    this.style.animation = 'none';
                    requestAnimationFrame(() => { this.style.animation = ''; });
                });
            }

            function scheduleNext(currentItemIdx) {
                const dur = items[currentItemIdx]?.duration || 5000;
                return setTimeout(() => {
                    showNext();
                    totalTimer = setTimeout(() => scheduleNext(currentIdx), 0);
                }, dur);
            }

            // 总时长限制
            if (totalDurationMs > 0) {
                setTimeout(() => {
                    if (totalTimer) clearTimeout(totalTimer);
                }, totalDurationMs);
            }

            scheduleNext(0);
        }, 0);
    }

    return html;
}
