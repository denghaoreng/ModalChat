// match-chat-results/panel.js — 结果面板渲染（抽屉内）

import { getGeneralSettings } from '../../core/data.js';
import { escapeHtml, AUDIO_EXTS, VIDEO_EXTS } from '../../shared/utils.js';
import { getLastResults } from '../scorer.js';

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
