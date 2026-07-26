// nav-match-scoring/match-config.js — 匹配配置 UI（与旧版 MatchScoring 功能一致）

import { getMatchScoringData, saveSettings, currentSettings } from '../data.js';
import { escapeHtml } from '../shared/utils.js';

export function renderMatchConfig() {
    const $panel = $('#mc-ms-config-panel');
    if (!$panel.length) return;

    const data = getMatchScoringData();
    const w = data.weights || {};
    const stopWords = data.stopWords || [];
    const relations = data.relations || [];
    const profiles = data.weightProfiles || [];
    const profileName = data.currentProfileName || '默认配置';

    const videoKwCount = (data.typeVideoKeywords || '').split(/\s+/).filter(Boolean).length;
    const imageKwCount = (data.typeImageKeywords || '').split(/\s+/).filter(Boolean).length;
    const audioKwCount = (data.typeAudioKeywords || '').split(/\s+/).filter(Boolean).length;

    $panel.html(`
    <div style="padding:4px;font-size:0.82em;">
        <!-- 配置存档 -->
        <div style="margin-bottom:8px;padding:6px;border:1px solid var(--borderColor);border-radius:6px;">
            <div style="display:flex;align-items:center;gap:4px;margin-bottom:4px;">
                <span style="font-size:0.82em;color:var(--grey40);white-space:nowrap;">读取:</span>
                <select id="mc-ms-profile-load" class="text_pole" style="flex:1;font-size:0.85em;">
                    <option value="">— 选择存档 —</option>
                    ${profiles.map(p => `<option value="${escapeHtml(p.name)}" ${p.name === profileName ? 'selected' : ''}>${escapeHtml(p.name)}</option>`).join('')}
                </select>
                <button id="mc-ms-profile-create" class="menu_button" style="font-size:0.8em;white-space:nowrap;"><i class="fa-solid fa-plus"></i> 新建</button>
                <button id="mc-ms-profile-save" class="menu_button" style="font-size:0.8em;white-space:nowrap;"><i class="fa-solid fa-floppy-disk"></i> 保存</button>
                <button id="mc-ms-profile-delete" class="menu_button" style="font-size:0.8em;white-space:nowrap;color:var(--dangerColor);"><i class="fa-solid fa-trash-can"></i> 删除</button>
            </div>
            <div style="display:flex;align-items:center;gap:4px;">
                <span style="font-size:0.82em;color:var(--grey40);white-space:nowrap;">名称:</span>
                <input id="mc-ms-profile-name" class="text_pole" type="text" value="${escapeHtml(profileName)}" style="flex:1;font-size:0.85em;" placeholder="配置名称">
            </div>
        </div>

        <!-- 权重配置 -->
        <div style="margin-bottom:8px;">
            <div style="display:flex;align-items:center;gap:6px;margin-bottom:6px;">
                <span style="font-weight:bold;font-size:0.9em;"><i class="fa-solid fa-sliders"></i> 权重配置</span>
                <button id="mc-ms-help-btn" class="menu_button" style="font-size:0.75em;padding:1px 6px;white-space:nowrap;"><i class="fa-solid fa-book"></i> 手册</button>
            </div>

            <div style="margin-bottom:8px;padding:6px;border:1px solid var(--borderColor);border-radius:6px;">
                <div style="font-size:0.82em;color:var(--grey40);margin-bottom:4px;">📤 来源权重</div>
                ${renderWeightSlider('aiResponseWeight', 'AI回答匹配权重', w.aiResponseWeight ?? 60, 0, 100, 5, '%')}
                ${renderWeightSlider('userQuestionWeight', '用户提问匹配权重', w.userQuestionWeight ?? 40, 0, 100, 5, '%')}
            </div>

            <div style="margin-bottom:8px;padding:6px;border:1px solid var(--borderColor);border-radius:6px;">
                <div style="font-size:0.82em;color:var(--grey40);margin-bottom:4px;">🔤 内容分词权重</div>
                ${renderWeightSlider('unigramWeight', '单字词权重', w.unigramWeight ?? 0.3, 0, 5, 0.1)}
                ${renderWeightSlider('bigramWeight', '两字词权重', w.bigramWeight ?? 1.0, 0, 5, 0.1)}
                ${renderWeightSlider('trigramWeight', '三字词权重', w.trigramWeight ?? 1.5, 0, 5, 0.1)}
                ${renderWeightSlider('tetragramWeight', '四字词权重', w.tetragramWeight ?? 0.8, 0, 5, 0.1)}
                ${renderWeightSlider('pentagramWeight', '五字词权重', w.pentagramWeight ?? 0.5, 0, 5, 0.1)}
            </div>

            <div style="margin-bottom:8px;padding:6px;border:1px solid var(--borderColor);border-radius:6px;">
                <div style="font-size:0.82em;color:var(--grey40);margin-bottom:4px;">🏷️ 其他维度权重</div>
                ${renderWeightSlider('tagWeight', '标签匹配权重', w.tagWeight ?? 10, 0, 100, 1)}
                ${renderWeightSlider('adapterWordWeight', '🔤 适配词权重', w.adapterWordWeight ?? w.fileTypeWeight ?? 0.5, 0, 5, 0.1)}
                ${renderWeightSlider('relationWeight', '关联词权重', w.relationWeight ?? 1.2, 0, 5, 0.1)}
                ${renderWeightSlider('stopWordWeight', '停用词匹配权重', w.stopWordWeight ?? 0.2, 0, 5, 0.1)}
                ${renderWeightSlider('charFuzzyWeight', '字符模糊匹配', w.charFuzzyWeight ?? 1.2, 0, 5, 0.1)}
                ${renderWeightSlider('imagePreferWeight', '🖼️ 图片偏好', w.imagePreferWeight ?? 1.5, 0, 5, 0.1)}
                ${renderWeightSlider('videoPreferWeight', '🎬 视频偏好', w.videoPreferWeight ?? 1.5, 0, 5, 0.1)}
                ${renderWeightSlider('audioPreferWeight', '🎵 音频偏好', w.audioPreferWeight ?? 1.5, 0, 5, 0.1)}
            </div>

            <div style="margin-bottom:8px;padding:6px;border:1px solid var(--borderColor);border-radius:6px;">
                <div style="font-size:0.82em;color:var(--grey40);margin-bottom:4px;">🔀 字符模糊匹配阈值</div>
                <div style="font-size:0.75em;color:var(--grey40);margin-bottom:2px;">
                    阈值越低越容易匹配（例如 50% 表示共享一半以上字符即算匹配）
                </div>
                ${renderWeightSlider('charFuzzyThreshold', '重叠阈值', w.charFuzzyThreshold ?? 0.5, 0, 1, 0.05)}
            </div>

            <div style="padding:6px;border:1px solid var(--borderColor);border-radius:6px;">
                <div style="font-size:0.82em;font-weight:bold;margin-bottom:4px;">🎲 随机抖动</div>
                <div style="font-size:0.75em;color:var(--grey40);margin-bottom:4px;">
                    每次匹配在最终分数上加 ±jitter% 的随机波动，让分数相近的文件排名有变化
                </div>
                <div style="display:flex;align-items:center;gap:8px;">
                    <span style="font-size:0.82em;min-width:50px;">幅度</span>
                    <input id="mc-ms-jitter" type="range" min="0" max="20" step="1" value="${Math.round((w.randomJitter ?? 0.05) * 100)}" style="flex:1;height:4px;">
                    <span id="mc-ms-jitter-val" style="min-width:36px;text-align:right;font-weight:bold;color:var(--primary);font-size:0.85em;">${Math.round((w.randomJitter ?? 0.05) * 100)}%</span>
                </div>
            </div>
        </div>

        <!-- 停用词 / 适配词 / 关联词 一行 -->
        <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:8px;">
            <div style="flex:1;min-width:180px;padding:8px;border:1px solid var(--borderColor);border-radius:6px;">
                <div style="display:flex;align-items:center;gap:6px;margin-bottom:4px;">
                    <span style="font-weight:bold;font-size:0.88em;"><i class="fa-solid fa-ban"></i> 停用词</span>
                    <button id="mc-ms-edit-stopwords" class="menu_button" style="font-size:0.78em;padding:1px 8px;white-space:nowrap;"><i class="fa-solid fa-pen"></i> 编辑</button>
                </div>
                <div style="font-size:0.78em;color:var(--grey40);">${escapeHtml(stopWords.join(', ') || '无')}</div>
            </div>
            <div style="flex:1;min-width:180px;padding:8px;border:1px solid var(--borderColor);border-radius:6px;">
                <div style="display:flex;align-items:center;gap:6px;margin-bottom:4px;">
                    <span style="font-weight:bold;font-size:0.88em;"><i class="fa-solid fa-film"></i> 适配词</span>
                    <button id="mc-ms-edit-typekeywords" class="menu_button" style="font-size:0.78em;padding:1px 8px;white-space:nowrap;"><i class="fa-solid fa-pen"></i> 编辑</button>
                </div>
                <div style="font-size:0.78em;color:var(--grey40);">${videoKwCount} 个视频词 / ${imageKwCount} 个图片词 / ${audioKwCount} 个音频词</div>
            </div>
            <div style="flex:1;min-width:180px;padding:8px;border:1px solid var(--borderColor);border-radius:6px;">
                <div style="display:flex;align-items:center;gap:6px;">
                    <span style="font-weight:bold;font-size:0.88em;"><i class="fa-solid fa-link"></i> 关联词</span>
                    <span style="font-size:0.8em;color:var(--grey40);">当前 ${relations.length} 对</span>
                    <button id="mc-ms-edit-relations" class="menu_button" style="font-size:0.78em;padding:1px 8px;white-space:nowrap;"><i class="fa-solid fa-up-right-from-square"></i> 管理</button>
                </div>
            </div>
        </div>

    </div>`);
}

function renderWeightSlider(key, label, value, min, max, step, suffix = '') {
    const displayValue = suffix === '%' ? value : value.toFixed(1);
    const suffixHtml = suffix ? `<span style="min-width:30px;text-align:right;">${suffix}</span>` : '';
    return `
    <div class="mc-ms-weight-row" style="display:flex;align-items:center;gap:6px;margin-bottom:3px;">
        <span style="min-width:100px;font-size:0.82em;">${label}</span>
        <input type="range" class="mc-ms-slider" data-wkey="${key}" min="${min}" max="${max}" step="${step}" value="${value}" style="flex:1;height:4px;">
        <span class="mc-ms-svalue" style="min-width:40px;text-align:right;font-size:0.82em;font-weight:bold;">${displayValue}</span>
        ${suffixHtml}
    </div>`;
}

export function bindMatchConfigEvents() {
    // 滑条
    $(document).off('input', '.mc-ms-slider').on('input', '.mc-ms-slider', function () {
        const key = $(this).data('wkey');
        const value = parseFloat($(this).val());
        const display = key.endsWith('Weight') && !key.includes('Response') && !key.includes('Question') ? value.toFixed(1) : value;
        $(this).closest('.mc-ms-weight-row').find('.mc-ms-svalue').text(display);
        debounceSaveWeight(key, value);
    });

    // 随机抖动
    $(document).off('input', '#mc-ms-jitter').on('input', '#mc-ms-jitter', function () {
        const val = parseInt($(this).val());
        $('#mc-ms-jitter-val').text(val + '%');
        updateWeight('randomJitter', val / 100);
    });

    // 配置存档
    $(document).off('change', '#mc-ms-profile-load').on('change', '#mc-ms-profile-load', function () {
        const name = $(this).val();
        if (!name) return;
        const data = getMatchScoringData();
        const profile = (data.weightProfiles || []).find(p => p.name === name);
        if (profile) {
            Object.assign(data.weights, profile.weights);
            data.currentProfileName = name;
            saveSettings();
            renderMatchConfig();
            bindMatchConfigEvents();
        }
    });
    $(document).off('change', '#mc-ms-profile-name').on('change', '#mc-ms-profile-name', function () {
        const name = $(this).val()?.trim();
        if (name) { getMatchScoringData().currentProfileName = name; }
    });
    $(document).off('click', '#mc-ms-profile-create').on('click', '#mc-ms-profile-create', function () {
        const name = $('#mc-ms-profile-name').val()?.trim();
        if (!name) { toastr.warning('请输入配置名称'); return; }
        const data = getMatchScoringData();
        if ((data.weightProfiles || []).some(p => p.name === name)) { toastr.warning('配置已存在'); return; }
        if (!data.weightProfiles) data.weightProfiles = [];
        data.weightProfiles.push({ name, weights: structuredClone(data.weights) });
        data.currentProfileName = name;
        saveSettings();
        toastr.success('已保存');
        renderMatchConfig();
        bindMatchConfigEvents();
    });
    $(document).off('click', '#mc-ms-profile-save').on('click', '#mc-ms-profile-save', function () {
        const data = getMatchScoringData();
        const name = $('#mc-ms-profile-load').val();
        if (!name) { toastr.warning('请先在读取栏选择一个配置'); return; }
        const newName = $('#mc-ms-profile-name').val()?.trim();
        const profile = (data.weightProfiles || []).find(p => p.name === name);
        if (newName && newName !== name && profile) profile.name = newName;
        if (profile) profile.weights = structuredClone(data.weights);
        else if (!data.weightProfiles) data.weightProfiles = [{ name: newName || name, weights: structuredClone(data.weights) }];
        data.currentProfileName = newName || name;
        saveSettings();
        toastr.success('已更新');
        renderMatchConfig();
        bindMatchConfigEvents();
    });
    $(document).off('click', '#mc-ms-profile-delete').on('click', '#mc-ms-profile-delete', async function () {
        const name = $('#mc-ms-profile-load').val();
        if (!name) { toastr.warning('请先选择存档'); return; }
        const data = getMatchScoringData();
        const idx = (data.weightProfiles || []).findIndex(p => p.name === name);
        if (idx >= 0) {
            data.weightProfiles.splice(idx, 1);
            if (data.currentProfileName === name) data.currentProfileName = '默认配置';
            saveSettings();
            toastr.success('已删除');
            renderMatchConfig();
            bindMatchConfigEvents();
        }
    });

    // 编辑停用词
    $(document).off('click', '#mc-ms-edit-stopwords').on('click', '#mc-ms-edit-stopwords', async function () {
        const { showStopWordsPopup } = await import('./popup-config.js');
        await showStopWordsPopup();
        renderMatchConfig();
        bindMatchConfigEvents();
    });

    // 编辑适配词
    $(document).off('click', '#mc-ms-edit-typekeywords').on('click', '#mc-ms-edit-typekeywords', async function () {
        const { showTypeKeywordsPopup } = await import('./popup-config.js');
        await showTypeKeywordsPopup();
        renderMatchConfig();
        bindMatchConfigEvents();
    });

    // 管理关联词
    $(document).off('click', '#mc-ms-edit-relations').on('click', '#mc-ms-edit-relations', async function () {
        const { showRelationEditPopup } = await import('./popup-config.js');
        await showRelationEditPopup();
        renderMatchConfig();
        bindMatchConfigEvents();
    });

    // 配置手册
    $(document).off('click', '#mc-ms-help-btn').on('click', '#mc-ms-help-btn', async function () {
        const { showConfigManualPopup } = await import('./popup-config.js');
        showConfigManualPopup();
    });
}

const _timers = {};
function debounceSaveWeight(key, value) {
    clearTimeout(_timers[key]);
    _timers[key] = setTimeout(() => updateWeight(key, value), 400);
}
function updateWeight(key, value) {
    const data = getMatchScoringData();
    if (!data.weights) data.weights = {};
    data.weights[key] = value;
    saveSettings();
}
