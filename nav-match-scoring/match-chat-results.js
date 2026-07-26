// nav-match-scoring/match-chat-results.js — 匹配结果插入聊天气泡、持久化与恢复

import { getContext } from '../../../../extensions.js';
import { getGeneralSettings, getMSFiles, getAnimationTypes, getMatchScoringData, getBouncePresets } from '../data.js';
import { escapeHtml, hexToRgb, AUDIO_EXTS, VIDEO_EXTS, IMAGE_EXTS, detectFileType, getFileTypeIcon } from '../shared/utils.js';
import { getLastResults } from './scorer.js';
import { showFileEnlarge } from '../shared/file-enlarge.js';
import { setupDragDeformation, autoBounce } from '../shared/image-drag-physics/index.js';

/**
 * 渲染匹配结果面板（抽屉内）
 * @param {Array} results
 */
export function renderResultsPanel(results) {
    const $list = $('#mc-ms-results-list');
    if (!$list.length) return;
    if (!results || results.length === 0) {
        $list.html('<div style="font-size:0.8em;color:var(--grey40);padding:8px;text-align:center;">暂无匹配结果</div>');
        return;
    }
    const perType = parseInt($('#mc-ms-results-limit').val()) || getGeneralSettings()?.resultsDisplayLimit || 10;

    // 按类型分组并排序（用扩展名兜底修正类型）
    const groups = { image: [], video: [], audio: [] };
    for (const item of results) {
        const f = item.file;
        const _ext = (f.filePath || '').split('.').pop().toLowerCase();
        let t = f.type;
        if (t !== 'video' && t !== 'audio') {
            if (VIDEO_EXTS.includes(_ext)) t = 'video';
            else if (AUDIO_EXTS.includes(_ext)) t = 'audio';
        }
        if (groups[t]) groups[t].push(item);
        else groups.image.push(item);
    }
    for (const key of Object.keys(groups)) {
        groups[key].sort((a, b) => b.totalScore - a.totalScore);
    }

    const labels = { image: '🖼️ 图片', video: '🎬 视频', audio: '🎵 音频' };
    const icons = { image: '📷', video: '🎬', audio: '🎵' };

    let html = '';
    for (const type of ['image', 'video', 'audio']) {
        const items = groups[type].slice(0, perType);
        if (items.length === 0) continue;
        html += `<div style="font-size:0.82em;font-weight:bold;color:var(--grey40);margin:6px 0 2px 4px;">${labels[type]}（${groups[type].length}）</div>`;
        items.forEach((item, i) => {
            const file = item.file;
            const _ext = (file.filePath || '').split('.').pop().toLowerCase();
            const icon = AUDIO_EXTS.includes(_ext) ? '🎵' : VIDEO_EXTS.includes(_ext) ? '🎬' : icons[type] || '📷';
            html += `<div style="display:flex;align-items:center;gap:6px;padding:3px 6px;border-bottom:1px solid var(--borderColor);font-size:0.82em;">
                <span style="font-weight:bold;min-width:20px;color:${i === 0 ? 'var(--goldColor)' : 'var(--grey40)'};">#${i + 1}</span>
                <span>${icon}</span>
                <span style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${escapeHtml(file.displayName || '未命名')}</span>
                <span style="font-weight:bold;color:var(--primary);">⭐ ${item.totalScore.toFixed(1)}</span>
            </div>`;
        });
    }
    if (!html) html = '<div style="font-size:0.8em;color:var(--grey40);padding:8px;text-align:center;">暂无匹配结果</div>';
    $list.html(html);
}

/**
 * 将匹配结果插入 AI 聊天气泡中（基于插位槽配置）
 */
export async function renderChatResults(messageId, results) {
    if (!results || results.length === 0) return;
    // 读取插位槽配置和层级设置
    const msData = (await import('../data.js')).getMatchScoringData();
    const slots = msData.slots || [{ types: ['image', 'video', 'audio'], count: 3, imageDuration: 5, minScore: 0, animationType: '果冻弹性', animationDuration: 0.9 }];
    const playCount = msData.carouselPlayCount ?? 1;
    const showCount = msData.carouselShowCount ?? 1;

    // 计算当前消息离末尾的距离（用于层级控制）
    const { chat } = (await import('../../../../extensions.js')).getContext();
    const distance = chat.length - 1 - messageId;
    if (distance < 0 || distance >= showCount) return; // 超过展示层数，不插入
    const autoPlay = distance < playCount; // 在播放层数内才自动轮播

    setTimeout(() => {
        try {
            const $msg = $(`.mes[mesid="${messageId}"]`);
            if (!$msg.length) return;
            $msg.find('.mc-ms-chat-results').remove();

            // 构建每个槽位的 HTML
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
            // 点击放大（enlarge 模式）或视频点击
            $msg.off('click touchend', '.mc-ms-slot-item img, .mc-ms-slot-item video')
                .on('click touchend', '.mc-ms-slot-item img, .mc-ms-slot-item video', function (e) {
                    if (e.type === 'touchend') return;
                    // 如果刚刚拖拽过，忽略这次点击（防止拖拽后误触放大）
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
            // 拖拽变形交互（interact/both 模式）— 委托给共享模块
            setupDragDeformation($msg, '.mc-ms-slot-item img, .mc-ms-slot-item video');
            // 自动演示：图像就绪后触发多点果冻弹跳（仅第一层消息）
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
 * @param {Array} results - 全量评分结果
 * @param {object} slot - 插位槽配置 { types, count, imageDuration, minScore }
 * @returns {string|null}
 */
function buildSlotHtml(results, slot, autoPlay, slotCfgIdx) {
    const { types = ['image', 'video', 'audio'], count = 3, imageDuration = 5, minScore = 0, totalDuration = 200, animationType = '果冻弹性', animationDuration = 0.9 } = slot;
    const totalDurationMs = totalDuration * 1000;

    // 读取通用配置中的媒体尺寸和背景设置
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

    // 构建最终列表（支持图音混合）
    let finalItems = [];

    if (types.includes('hybrid') && types.includes('image') && types.includes('audio')) {
        // 图音混合模式：图片×音频配对
        const images = results.filter(item => item.file.type === 'image').sort((a, b) => b.totalScore - a.totalScore).slice(0, count);
        const audios = results.filter(item => item.file.type === 'audio').sort((a, b) => b.totalScore - a.totalScore).slice(0, count);
        // 视频仅在勾选了 video 类型时才加入
        const videos = types.includes('video') ? results.filter(item => item.file.type === 'video') : [];

        // 检查配对组是否全部 ≥ 最低分
        const imgOk = images.length > 0 && images.every(i => i.totalScore >= minScore);
        const audOk = audios.length > 0 && audios.every(a => a.totalScore >= minScore);

        const pairs = imgOk && audOk ? Math.min(images.length, audios.length) : 0;
        for (let i = 0; i < pairs; i++) {
            finalItems.push({
                type: 'hybrid',
                imageItem: images[i],
                audioItem: audios[i],
                totalScore: Math.max(images[i].totalScore, audios[i].totalScore),
                displayName: (images[i].file.displayName || '') + ' + ' + (audios[i].file.displayName || ''),
            });
        }
        // 落单的图片/音频 + 视频
        const soloImages = images.slice(pairs).map(i => ({ ...i, type: 'image' }));
        const soloAudios = audios.slice(pairs).map(a => ({ ...a, type: 'audio' }));
        finalItems = finalItems.concat(soloImages, soloAudios, videos);
    } else {
        // 普通模式：直接按类型过滤
        let filtered = results.filter(item => types.includes(item.file.type));
        finalItems = filtered.map(i => ({ ...i, type: i.file.type }));
    }

    // 统一按分数排序、取前 N、检查最低分
    finalItems.sort((a, b) => b.totalScore - a.totalScore);
    const top = finalItems.slice(0, count);
    if (top.length === 0 || top.some(item => item.totalScore < minScore)) return null;

    const slotId = 'slot_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6);

    // 动态注入动画 CSS
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
            // 图音混合：图片作为背景 + 音频播放器
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

    // 轮播逻辑（仅 autoPlay 时启用）
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

                // 暂停旧媒体
                const $oldMedia = getMedia(oldIdx);
                if ($oldMedia.length) { $oldMedia[0].pause(); $oldMedia[0].currentTime = 0; }

                // 隐藏旧项、显示新项、播放新媒体
                $container.find(`.mc-ms-slot-item[data-slot-idx="${oldIdx}"]`).hide();
                const $newItem = $container.find(`.mc-ms-slot-item[data-slot-idx="${currentIdx}"]`).show();
                // 强制重播果冻动画
                $newItem.find('img, video').each(function () {
                    this.style.animation = 'none';
                    void this.offsetHeight;
                    this.style.animation = '';
                });
                const $newMedia = getMedia(currentIdx);
                if ($newMedia.length) $newMedia[0].play().catch(() => {});
            }

            function getDuration(item) {
                if (item.type === 'hybrid') return -1; // 混合项由音频 ended 控制
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
            // 暂停所有媒体
            $container.find('video, audio').each(function () { this.pause(); });
        }

        function resumeCarousel() {
            if (!stopped) return;
            // 用户手动播放 → 重置起算时间，从头计新的总时长
            startTime = Date.now();
            stopped = false;
            if (timer) { clearTimeout(timer); timer = null; }
            // 立即调度当前项的推进/停止
            const item = top[currentIdx];
            const dur = getDuration(item);
            if (dur > 0) {
                timer = setTimeout(advanceAndSchedule, dur);
            } else if (totalDurationMs > 0) {
                timer = setTimeout(function () { if (!stopped) stopCarousel(); }, totalDurationMs);
            }
        }

        function advanceAndSchedule() {
            if (stopped) return;
            // 总时长检查
            if (totalDurationMs > 0 && Date.now() - startTime >= totalDurationMs) {
                stopCarousel();
                return;
            }
            showNext();
            scheduleNext();
        }

        function scheduleNext() {
            if (stopped) return;
            // 总时长检查
            if (totalDurationMs > 0 && Date.now() - startTime >= totalDurationMs) {
                stopCarousel();
                return;
            }
            const item = top[currentIdx];
            const dur = getDuration(item);
            if (dur > 0) {
                timer = setTimeout(advanceAndSchedule, dur);
            } else {
                // 视频/音频：设剩余总时长定时器，到期就停（不推进下一项）
                const remaining = Math.max(0, totalDurationMs - (Date.now() - startTime));
                if (totalDurationMs > 0 && remaining > 0) {
                    timer = setTimeout(function () { if (!stopped) stopCarousel(); }, remaining);
                }
            }
        }

        // 为视频/音频/混合项绑定 ended 事件
        top.forEach((item, idx) => {
            const hasMedia = item.type === 'hybrid' || item.file?.type === 'video' || item.file?.type === 'audio';
            if (hasMedia) {
                const $el = getMedia(idx);
                if ($el.length) {
                    $el.on('ended', function () {
                        if (stopped) return;
                        if (idx === currentIdx) {
                            advanceAndSchedule();
                        }
                    });
                    // 用户手动点击播放 → 重置 25 秒倒计时
                    $el.on('play', function () {
                        if (stopped) resumeCarousel();
                    });
                }
            }
        });

        scheduleNext();
    }, 100);
    } // end if (autoPlay)

    return html;
}

/** 持久化匹配结果到 chat.extra */
export function persistChatResults(messageId, results) {
    if (!messageId || !results) return;
    const { chat } = getContext();
    let msg = chat.find(m => m.id === messageId);
    // 如果 messageId 不是原始 id（可能是 mesIndex 兜底），尝试用索引查找
    if (!msg && /^\d+$/.test(String(messageId))) {
        msg = chat[parseInt(messageId)];
    }
    if (!msg) msg = chat[chat.length - 1];
    if (!msg) return;
    if (!msg.extra) msg.extra = {};
    msg.extra.mcMatchResults = results.map(item => ({
        fileId: item.file.id,
        displayName: item.file.displayName,
        filePath: item.file.filePath,
        type: item.file.type,
        totalScore: item.totalScore,
    }));
}

/** 从 chat.extra 恢复匹配结果 */
export function restoreChatResults() {
    try {
        const { chat } = getContext();
        const files = getMSFiles();
        const validIds = new Set(files.map(f => f.id));
        let anyCleaned = false;
        for (let i = 0; i < chat.length; i++) {
            const msg = chat[i];
            const has = msg?.extra?.mcMatchResults?.length;
            if (i === 0 && !msg.is_user) { if (has) { delete msg.extra.mcMatchResults; anyCleaned = true; } continue; }
            if (msg.is_user) { if (has) { delete msg.extra.mcMatchResults; anyCleaned = true; } continue; }
            if (!has) continue;
            const valid = msg.extra.mcMatchResults.filter(d => validIds.has(d.fileId));
            if (valid.length === 0) { delete msg.extra.mcMatchResults; anyCleaned = true; continue; }
            if (valid.length < msg.extra.mcMatchResults.length) { msg.extra.mcMatchResults = valid; anyCleaned = true; }
            const results = valid.map(d => ({
                file: { id: d.fileId, displayName: d.displayName, filePath: d.filePath, type: d.type },
                totalScore: d.totalScore,
            }));
            // 插位槽系统内部会处理类型/数量/最低分过滤
            renderChatResults(i, results);
        }
        if (anyCleaned) getContext().saveChat();
    } catch (err) {
        console.warn('ModalChat: restoreChatResults error', err);
    }
}

/** 删除文件后清理残留引用 */
export function cleanupStaleExtraRefs(fileId) {
    const { chat } = getContext();
    let anyCleaned = false;
    for (const msg of chat) {
        if (!msg?.extra?.mcMatchResults?.length) continue;
        const before = msg.extra.mcMatchResults.length;
        msg.extra.mcMatchResults = msg.extra.mcMatchResults.filter(r => r.fileId !== fileId);
        if (msg.extra.mcMatchResults.length === 0) { delete msg.extra.mcMatchResults; anyCleaned = true; }
        else if (msg.extra.mcMatchResults.length < before) anyCleaned = true;
    }
    if (anyCleaned) getContext().saveChat();
}

/** 清除所有聊天气泡中的匹配结果（切换聊天/滑动时调用） */
export function cleanupAllChatResults() {
    $('.mc-ms-chat-results').remove();
}

function buildChatResultsHtml(results) {
    const gs = getGeneralSettings();
    const mw = gs?.mediaWidth || 0, mh = gs?.mediaHeight || 200;
    const bgColor = gs?.frameBackgroundColor || '#000000';
    const bgOpacity = gs?.frameBackgroundOpacity || 1;
    const bgRgb = hexToRgb(bgColor);
    let mediaStyle = 'display:block;max-width:100%;object-fit:contain;border-radius:6px;';
    if (mw > 0 && mh > 0) {
        mediaStyle += `width:${mw}px;aspect-ratio:${mw}/${mh};height:auto;max-height:90vh;`;
    } else if (mw > 0) {
        mediaStyle += `width:${mw}px;height:auto;`;
    } else if (mh > 0) {
        mediaStyle += `height:${mh}px;max-height:90vh;width:auto;`;
    } else {
        mediaStyle += 'width:auto;height:auto;';
    }

    let html = '<div class="mc-ms-chat-results">';
    html += '<div style="font-size:0.8em;font-weight:bold;margin-bottom:8px;color:var(--primary);">🎯 匹配结果</div>';
    for (let i = 0; i < results.length; i++) {
        const item = results[i], file = item.file;
        const url = file.filePath ? (file.filePath.startsWith('/') ? file.filePath : '/' + file.filePath) : '';
        if (!url) continue;
        const _ext = (url || '').split('.').pop().toLowerCase();
        const isAudio = file.type === 'audio' || AUDIO_EXTS.includes(_ext);
        const isVideo = file.type === 'video' || VIDEO_EXTS.includes(_ext);
        const tag = isAudio
            ? `<audio src="${url}" style="${mediaStyle}" autoplay controls preload="metadata"></audio>`
            : isVideo
                ? `<video src="${url}" style="${mediaStyle}" autoplay preload="metadata" controls playsinline></video>`
                : `<img src="${url}" style="${mediaStyle}" loading="eager" crossorigin="anonymous">`;
        html += `<div class="mc-ms-chat-item" style="cursor:pointer;margin-bottom:6px;text-align:center;" title="${escapeHtml(file.displayName || '')} ⭐${item.totalScore.toFixed(1)}">
            <div style="font-size:0.8em;color:var(--grey40);margin-bottom:2px;text-align:center;">${escapeHtml(file.displayName || '')}</div>
            <div style="position:relative;display:inline-block;max-width:100%;border-radius:8px;overflow:hidden;border:2px solid ${i === 0 ? 'var(--primary)' : 'var(--borderColor)'};background:rgba(${bgRgb},${bgOpacity});line-height:0;">
                ${tag}
                <span style="position:absolute;top:4px;right:4px;font-size:0.75em;background:rgba(0,0,0,0.7);color:white;border-radius:4px;padding:2px 6px;line-height:1.3;font-weight:bold;">#${i + 1}</span>
                <span style="position:absolute;bottom:4px;left:4px;font-size:0.75em;background:rgba(0,0,0,0.7);color:#ffd700;border-radius:4px;padding:2px 6px;line-height:1.3;font-weight:bold;">${item.totalScore.toFixed(1)}</span>
            </div>
        </div>`;
    }
    html += '</div>';
    return html;
}
