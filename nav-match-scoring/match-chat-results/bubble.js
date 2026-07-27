// match-chat-results/bubble.js — 聊天气泡匹配结果渲染 + 轮播

import { getGeneralSettings, getAnimationTypes, getMatchScoringData, getBouncePresets } from '../../core/data.js';
import { escapeHtml, hexToRgb, AUDIO_EXTS, VIDEO_EXTS } from '../../shared/utils.js';
import { showFileEnlarge } from '../../shared/file-enlarge.js';
import { setupDragDeformation, autoBounce } from '../../shared/image-drag-physics/index.js';

/**
 * 将匹配结果插入 AI 聊天气泡中（基于插位槽配置）
 */
export async function renderChatResults(messageId, results) {
    if (!results || results.length === 0) return;
    const msData = (await import('../../core/data.js')).getMatchScoringData();
    const slots = msData.slots || [{ types: ['image', 'video', 'audio'], count: 3, imageDuration: 5, minScore: 0, animationType: '果冻弹性', animationDuration: 0.9 }];
    const playCount = msData.carouselPlayCount ?? 1;
    const showCount = msData.carouselShowCount ?? 1;

    const { chat } = (await import('../../../../../extensions.js')).getContext();
    const distance = chat.length - 1 - messageId;
    if (distance < 0 || distance >= showCount) return;
    const autoPlay = distance < playCount;

    setTimeout(() => {
        try {
            const $msg = $(`.mes[mesid="${messageId}"]`);
            if (!$msg.length) return;
            $msg.find('.mc-ms-chat-results').remove();

            let allHtml = '';
            for (let si = 0; si < slots.length; si++) {
                const slotHtml = buildSlotHtml(results, slots[si], autoPlay, si);
                if (slotHtml) allHtml += slotHtml;
            }
            if (!allHtml) return;

            const html = '<div class="mc-ms-chat-results">' + allHtml + '</div>';
            const $ci = $msg.find('.chat-image-queued').last();
            if ($ci.length) $ci.after(html);
            else {
                const $mt = $msg.find('.mes_text');
                $mt.length ? $mt.after(html) : $msg.find('.mes_content').append(html);
            }

            $msg.off('click touchend', '.mc-ms-slot-item img, .mc-ms-slot-item video')
                .on('click touchend', '.mc-ms-slot-item img, .mc-ms-slot-item video', function (e) {
                    if (e.type === 'touchend') return;
                    if ($(this).attr('data-mc-dragged')) return;
                    const $slotRes = $(this).closest('.mc-ms-slot-results');
                    const msData = getMatchScoringData();
                    const slotCfgIdx = parseInt($slotRes.data('slot-cfg-idx'));
                    const slotCfg = (!isNaN(slotCfgIdx) && (msData.slots || [])[slotCfgIdx]) ? (msData.slots || [])[slotCfgIdx] : {};
                    const action = slotCfg.clickAction || 'enlarge';
                    if (action !== 'interact') {
                        const src = $(this).attr('src');
                        if (src) showFileEnlarge(src);
                    }
                });
            setupDragDeformation($msg, '.mc-ms-slot-item img, .mc-ms-slot-item video');
            if (distance === 0) {
                const presets = getBouncePresets();
                if (presets && presets.length > 0) {
                    let _demoTimer = null;
                    function _tryAutoBounce() {
                        const $imgs = $msg.find('.mc-ms-slot-item img, .mc-ms-slot-item video');
                        let allLoaded = true;
                        $imgs.each(function () {
                            if (this.tagName === 'IMG' && (!this.complete || !this.naturalWidth)) allLoaded = false;
                        });
                        if (!allLoaded) { _demoTimer = setTimeout(_tryAutoBounce, 400); return; }
                        $imgs.each(function () { autoBounce(this, presets); });
                    }
                    _demoTimer = setTimeout(_tryAutoBounce, 600);
                }
            }
        } catch (err) {
            console.warn('ModalChat: renderChatResults error', err);
        }
    }, 200);
}

/**
 * 根据插位槽配置构建 HTML
 */
function buildSlotHtml(results, slot, autoPlay, slotCfgIdx) {
    const { types = ['image', 'video', 'audio'], count = 3, imageDuration = 5, minScore = 0, totalDuration = 200, animationType = '果冻弹性', animationDuration = 0.9 } = slot;
    const totalDurationMs = totalDuration * 1000;

    const gs = getGeneralSettings();
    const mw = gs?.mediaWidth || 0, mh = gs?.mediaHeight || 200;
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

    let finalItems = [];
    if (types.includes('hybrid') && types.includes('image') && types.includes('audio')) {
        const images = results.filter(item => item.file.type === 'image').sort((a, b) => b.totalScore - a.totalScore).slice(0, count);
        const audios = results.filter(item => item.file.type === 'audio').sort((a, b) => b.totalScore - a.totalScore).slice(0, count);
        const videos = types.includes('video') ? results.filter(item => item.file.type === 'video') : [];
        const imgOk = images.length > 0 && images.every(i => i.totalScore >= minScore);
        const audOk = audios.length > 0 && audios.every(a => a.totalScore >= minScore);
        const pairs = imgOk && audOk ? Math.min(images.length, audios.length) : 0;
        for (let i = 0; i < pairs; i++) {
            finalItems.push({
                type: 'hybrid',
                imageItem: images[i], audioItem: audios[i],
                totalScore: Math.max(images[i].totalScore, audios[i].totalScore),
                displayName: (images[i].file.displayName || '') + ' + ' + (audios[i].file.displayName || ''),
            });
        }
        const soloImages = images.slice(pairs).map(i => ({ ...i, type: 'image' }));
        const soloAudios = audios.slice(pairs).map(a => ({ ...a, type: 'audio' }));
        finalItems = finalItems.concat(soloImages, soloAudios, videos);
    } else {
        let filtered = results.filter(item => types.includes(item.file.type));
        finalItems = filtered.map(i => ({ ...i, type: i.file.type }));
    }

    finalItems.sort((a, b) => b.totalScore - a.totalScore);
    const top = finalItems.slice(0, count);
    if (top.length === 0 || top.some(item => item.totalScore < minScore)) return null;

    const slotId = 'slot_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6);
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
        animName = 'mc_anim_' + slotId.replace(/[^a-z0-9]/gi, '_');
        animStyle = `<style>.${animName} img,.${animName} video{animation:${animName} ${animationDuration}s ${animDef.timingFunction || 'ease-out'}}@keyframes ${animName}{${animDef.keyframes}}</style>`;
    }

    let html = animStyle + `<div class="mc-ms-slot-results" data-slot-id="${slotId}" data-slot-cfg-idx="${slotCfgIdx}">`;
    top.forEach((item, idx) => {
        const isHybrid = item.type === 'hybrid';
        const file = isHybrid ? item.imageItem.file : item.file;
        const audioFile = isHybrid ? item.audioItem.file : null;
        const url = file.filePath ? (file.filePath.startsWith('/') ? file.filePath : '/' + file.filePath) : '';
        const audioUrl = audioFile?.filePath ? (audioFile.filePath.startsWith('/') ? audioFile.filePath : '/' + audioFile.filePath) : null;
        if (!url && !audioUrl) return;
        const isVideo = !isHybrid && file.type === 'video';
        const isAudio = !isHybrid && file.type === 'audio';
        const isFirst = idx === 0;
        const display = (!autoPlay || isFirst) ? 'block' : 'none';
        html += `<div class="mc-ms-slot-item ${animName}" data-slot-idx="${idx}" style="display:${display};text-align:center;">
            <div style="font-size:0.82em;color:var(--grey40);margin-bottom:2px;">${escapeHtml(isHybrid ? item.displayName : (file.displayName || ''))} ⭐${item.totalScore.toFixed(1)}</div>`;
        if (isHybrid) {
            html += `<div style="position:relative;display:inline-block;max-width:100%;border-radius:8px;overflow:hidden;background:rgba(${bgRgb},${bgOpacity});">
                <img src="${escapeHtml(url)}" style="${mediaStyle}" loading="eager" crossorigin="anonymous">
                <div style="position:absolute;bottom:8px;left:0;right:0;display:flex;justify-content:center;padding:0 8px;">
                    <audio src="${escapeHtml(audioUrl)}" style="width:80%;max-width:80%;" ${autoPlay && isFirst ? 'autoplay' : ''} controls preload="metadata"></audio>
                </div>
            </div>`;
        } else if (isAudio) {
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
            const $container = $(`.mc-ms-slot-results[data-slot-id="${slotId}"]`);
            if (!$container.length || top.length <= 1) return;
            let currentIdx = 0;

            function getMedia(idx) {
                return $container.find(`.mc-ms-slot-item[data-slot-idx="${idx}"]`).find('video, audio');
            }
            function showNext() {
                const oldIdx = currentIdx;
                currentIdx = (currentIdx + 1) % top.length;
                const $oldMedia = getMedia(oldIdx);
                if ($oldMedia.length) { $oldMedia[0].pause(); $oldMedia[0].currentTime = 0; }
                $container.find(`.mc-ms-slot-item[data-slot-idx="${oldIdx}"]`).hide();
                const $newItem = $container.find(`.mc-ms-slot-item[data-slot-idx="${currentIdx}"]`).show();
                $newItem.find('img, video').each(function () {
                    this.style.animation = 'none';
                    void this.offsetHeight;
                    this.style.animation = '';
                });
                const $newMedia = getMedia(currentIdx);
                if ($newMedia.length) $newMedia[0].play().catch(() => {});
            }
            function getDuration(item) {
                if (item.type === 'hybrid') return -1;
                const f = item.file;
                if (f.type === 'video' || f.type === 'audio') return -1;
                return (imageDuration || 5) * 1000;
            }

            let startTime = Date.now();
            let timer = null;
            let stopped = false;

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
                const item = top[currentIdx];
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
                const item = top[currentIdx];
                const dur = getDuration(item);
                if (dur > 0) { timer = setTimeout(advanceAndSchedule, dur); }
                else {
                    const remaining = Math.max(0, totalDurationMs - (Date.now() - startTime));
                    if (totalDurationMs > 0 && remaining > 0) { timer = setTimeout(function () { if (!stopped) stopCarousel(); }, remaining); }
                }
            }

            top.forEach((item, idx) => {
                const hasMedia = item.type === 'hybrid' || item.file?.type === 'video' || item.file?.type === 'audio';
                if (hasMedia) {
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
