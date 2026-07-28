// carousel/bubble.js — 聊天气泡聊天图片轮播渲染（基于插位槽配置）

import { getGeneralSettings, getAnimationTypes, getChatImagesData, getBouncePresets } from '../../core/data.js';
import { escapeHtml, hexToRgb, AUDIO_EXTS, VIDEO_EXTS } from '../../shared/utils.js';
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

            // 点击事件：图片/视频放大，音频不处理
            $msg.off('click touchend', '.mc-ci-slot-item img, .mc-ci-slot-item video')
                .on('click touchend', '.mc-ci-slot-item img, .mc-ci-slot-item video', function (e) {
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

            // 拖拽抖动（图片和视频）
            if ($msg.find('.mc-ci-slot-item img, .mc-ci-slot-item video').length) {
                setupDragDeformation($msg, '.mc-ci-slot-item img, .mc-ci-slot-item video');
            }

            // 弹入动画（仅最新消息）
            if (distance === 0) {
                const presets = getBouncePresets();
                if (presets && presets.length > 0) {
                    const $bounceImgs = $msg.find('.mc-ci-slot-item img, .mc-ci-slot-item video');
                    let loadedCount = 0;
                    const totalImgs = $bounceImgs.length;
                    if (totalImgs === 0) return;
                    function tryBounce() {
                        if (loadedCount >= totalImgs) {
                            $bounceImgs.each(function () { autoBounce(this, presets); });
                        }
                    }
                    $bounceImgs.each(function () {
                        if (this.tagName === 'IMG') {
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
                        } else {
                            loadedCount++;
                            tryBounce();
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
    const mw = gs?.mediaWidth || gs?.imageWidth || 500, mh = gs?.mediaHeight || gs?.imageHeight || 200;
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
        animStyle = `<style>.${animName} img,.${animName} video{animation:${animName} ${animationDuration}s ${animDef.timingFunction || 'ease-out'}}@keyframes ${animName}{${animDef.keyframes}}</style>`;
    }

    let html = animStyle + `<div class="mc-ci-slot-results" data-slot-id="${slotId}" data-slot-cfg-idx="${slotCfgIdx}">`;
    items.forEach((item, idx) => {
        const url = item.image?.url;
        if (!url) return;
        const fileType = item.image?.type || 'image';
        const isVideo = fileType === 'video';
        const isAudio = fileType === 'audio';
        const isFirst = idx === 0;
        const display = (!autoPlay || isFirst) ? 'block' : 'none';
        html += `<div class="mc-ci-slot-item ${animName}" data-slot-idx="${idx}" style="display:${display};text-align:center;">
            <div style="font-size:0.82em;color:var(--grey40);margin-bottom:2px;">${escapeHtml(item.image.name || '')}</div>`;
        if (isAudio) {
            const audioH = mh > 0 ? mh + 'px' : 'auto';
            html += `<audio src="${escapeHtml(url)}" style="width:80%;max-width:80%;height:${audioH};display:block;margin:0 auto;" ${autoPlay && isFirst ? 'autoplay' : ''} controls preload="metadata"></audio>`;
        } else {
            html += `<div style="position:relative;display:inline-block;max-width:100%;border-radius:8px;overflow:hidden;background:rgba(${bgRgb},${bgOpacity});">`;
            if (isVideo) {
                html += `<video src="${escapeHtml(url)}" style="${mediaStyle}" ${autoPlay && isFirst ? 'autoplay' : ''} controls preload="metadata" playsinline></video>`;
            } else {
                html += `<img src="${escapeHtml(url)}" style="${mediaStyle}" loading="eager" crossorigin="anonymous">`;
            }
            html += '</div>';
        }
        html += '</div>';
    });
    html += '</div>';

    if (autoPlay) {
        setTimeout(() => {
            const $container = $(`.mc-ci-slot-results[data-slot-id="${slotId}"]`);
            if (!$container.length || items.length <= 1) return;
            let currentIdx = 0;
            let timer = null;
            let stopped = false;

            function getMedia(idx) {
                return $container.find(`.mc-ci-slot-item[data-slot-idx="${idx}"]`).find('video, audio');
            }
            function showNext() {
                const oldIdx = currentIdx;
                currentIdx = (currentIdx + 1) % items.length;
                const $oldMedia = getMedia(oldIdx);
                if ($oldMedia.length) { $oldMedia[0].pause(); $oldMedia[0].currentTime = 0; }
                $container.find(`.mc-ci-slot-item[data-slot-idx="${oldIdx}"]`).hide();
                const $newItem = $container.find(`.mc-ci-slot-item[data-slot-idx="${currentIdx}"]`).show();
                $newItem.find('img, video').each(function () {
                    this.style.animation = 'none';
                    requestAnimationFrame(() => { this.style.animation = ''; });
                });
                const $newMedia = getMedia(currentIdx);
                if ($newMedia.length) $newMedia[0].play().catch(() => {});
            }

            function getDuration(item) {
                const ft = item.image?.type || 'image';
                // 视频和音频用自身长度，图片用规则设定的 duration
                if (ft === 'video' || ft === 'audio') return -1;
                return item.duration || 5000;
            }

            let startTime = Date.now();

            function stopCarousel() {
                if (stopped) return;
                stopped = true;
                if (timer) { clearTimeout(timer); timer = null; }
                $container.find('video, audio').each(function () { this.pause(); });
            }
            function resumeCarousel() {
                if (!stopped) return;
                startTime = Date.now();
                stopped = false;
                if (timer) { clearTimeout(timer); timer = null; }
                const item = items[currentIdx];
                const dur = getDuration(item);
                if (dur > 0) { timer = setTimeout(advanceAndSchedule, dur); }
                else if (totalDurationMs > 0) { timer = setTimeout(function () { if (!stopped) stopCarousel(); }, totalDurationMs); }
            }
            function advanceAndSchedule() {
                if (stopped) return;
                if (totalDurationMs > 0 && Date.now() - startTime >= totalDurationMs) { stopCarousel(); return; }
                showNext();
                scheduleNext();
            }
            function scheduleNext() {
                if (stopped) return;
                if (totalDurationMs > 0 && Date.now() - startTime >= totalDurationMs) { stopCarousel(); return; }
                const item = items[currentIdx];
                const dur = getDuration(item);
                if (dur > 0) {
                    timer = setTimeout(advanceAndSchedule, dur);
                } else {
                    // 视频/音频：等待 ended 事件或总时长限制
                    const remaining = Math.max(0, totalDurationMs - (Date.now() - startTime));
                    if (totalDurationMs > 0 && remaining > 0) {
                        timer = setTimeout(function () { if (!stopped) stopCarousel(); }, remaining);
                    }
                }
            }

            // 为每个视频/音频绑定 ended 事件，播放完毕后自动切换
            items.forEach((item, idx) => {
                const ft = item.image?.type || 'image';
                if (ft === 'video' || ft === 'audio') {
                    const $el = getMedia(idx);
                    if ($el.length) {
                        $el.on('ended', function () { if (!stopped && idx === currentIdx) advanceAndSchedule(); });
                        $el.on('play', function () { if (stopped) resumeCarousel(); });
                    }
                }
            });
            scheduleNext();
        }, 100);
    }

    return html;
}
