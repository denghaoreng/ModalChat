// popup-config.js — 配置相关弹窗：关联词、停用词、关键词、配置手册、标签筛选

import { callGenericPopup } from '../../../../popup.js';
import { addRelation, removeRelation, saveSettings, updateStopWords, updateTypeVideoKeywords, updateTypeImageKeywords, updateTypeAudioKeywords, getMSFiles as getFiles, getSelectedTags, updateSelectedTags, getMatchScoringData } from '../data.js';
import { escapeHtml } from '../shared/utils.js';

// POPUP_TYPE 常量（与 SillyTavern 源码一致，值为数字）
const POPUP_TYPE = Object.freeze({
    TEXT: 1,
    CONFIRM: 2,
    INPUT: 3,
    DISPLAY: 4,
});

// ==================== 关联词编辑弹窗 ====================

/**
 * 显示关联词编辑弹窗
 * @returns {Promise<void>}
 */
export async function showRelationEditPopup() {
    const relations = getMatchScoringData().relations || [];
    let itemsHtml = '';

    if (relations.length === 0) {
        itemsHtml = '<div style="text-align:center;color:var(--grey40);padding:10px;">暂无关联词，请添加</div>';
    } else {
        relations.forEach((rel, index) => {
            itemsHtml += `
            <div class="ms-relation-row" style="display:flex;gap:6px;margin-bottom:6px;align-items:center;">
                <input class="text_pole ms-relation-from" data-index="${index}" type="text" value="${escapeHtml(rel.from)}" style="flex:1;font-size:0.85em;" placeholder="源词">
                <span style="color:var(--grey40);font-size:0.85em;">→</span>
                <input class="text_pole ms-relation-to" data-index="${index}" type="text" value="${escapeHtml(rel.to)}" style="flex:1;font-size:0.85em;" placeholder="关联词">
                <span class="ms-relation-del menu_button menu_button_icon" data-index="${index}" style="color:var(--dangerColor);cursor:pointer;">
                    <i class="fa-solid fa-trash-can"></i>
                </span>
            </div>`;
        });
    }

    const popupHtml = `
    <div style="padding:8px;min-width:300px;">
        <div id="ms-relation-list">
            ${itemsHtml}
        </div>
        <div style="margin-top:10px;text-align:center;">
            <button id="ms-add-relation-btn" class="menu_button" style="font-size:0.85em;white-space:nowrap;">
                <i class="fa-solid fa-plus"></i> 添加关联词
            </button>
        </div>
    </div>`;

    // 追踪表单变化
    const trackChanges = debouncedTrackRelations();

    // ⭐ 弹窗内部按钮事件（必须在 await 之前绑定，弹窗关闭后 DOM 会销毁）
    const addBtnHandler = function () {
        const list = $('#ms-relation-list');
        const newIndex = getMatchScoringData().relations.length;
        addRelation('', '');
        list.append(`
            <div class="ms-relation-row" style="display:flex;gap:6px;margin-bottom:6px;align-items:center;">
                <input class="text_pole ms-relation-from" data-index="${newIndex}" type="text" value="" style="flex:1;font-size:0.85em;" placeholder="源词">
                <span style="color:var(--grey40);font-size:0.85em;">→</span>
                <input class="text_pole ms-relation-to" data-index="${newIndex}" type="text" value="" style="flex:1;font-size:0.85em;" placeholder="关联词">
                <span class="ms-relation-del menu_button menu_button_icon" data-index="${newIndex}" style="color:var(--dangerColor);cursor:pointer;">
                    <i class="fa-solid fa-trash-can"></i>
                </span>
            </div>
        `);
    };

    $(document).on('input', '.ms-relation-from', function () {
        const idx = $(this).data('index');
        trackChanges(idx, 'from', $(this).val() || '');
    });
    $(document).on('input', '.ms-relation-to', function () {
        const idx = $(this).data('index');
        trackChanges(idx, 'to', $(this).val() || '');
    });
    $(document).on('click', '.ms-relation-del', function () {
        const idx = $(this).data('index');
        removeRelation(idx);
        $(this).closest('.ms-relation-row').remove();
    });
    $(document).on('click', '#ms-add-relation-btn', addBtnHandler);

    // 备份关系数据，取消时恢复
    const backupRelations = getMatchScoringData().relations.map(r => ({ ...r }));

    const result = await callGenericPopup(popupHtml, POPUP_TYPE.TEXT, '', {
        okButton: '保存',
        cancelButton: '取消',
        wide: false,
    });

    $(document).off('input', '.ms-relation-from');
    $(document).off('input', '.ms-relation-to');
    $(document).off('click', '.ms-relation-del');
    $(document).off('click', '#ms-add-relation-btn', addBtnHandler);

    if (result) {
        saveSettings();
    } else {
        // 取消：恢复备份
        const msd = getMatchScoringData();
        msd.relations.length = 0;
        backupRelations.forEach(r => msd.relations.push({ ...r }));
    }
}

/**
 * 防抖追踪关联词变化
 */
function debouncedTrackRelations() {
    const timers = {};
    return function (index, field, value) {
        clearTimeout(timers[`${index}_${field}`]);
        timers[`${index}_${field}`] = setTimeout(() => {
            const rel = getMatchScoringData().relations[index];
            if (rel) {
                rel[field] = value;
            }
        }, 300);
    };
}

// ==================== 停用词编辑弹窗 ====================

/**
 * 显示停用词编辑弹窗
 * @returns {Promise<void>}
 */
export async function showStopWordsPopup() {
    let stopWordsStr = (getMatchScoringData().stopWords || []).join(' ');

    const popupHtml = `
    <div style="padding:8px;min-width:300px;">
        <div style="margin-bottom:8px;font-size:0.85em;color:var(--grey40);">
            请输入停用词，用空格分隔。这些词在匹配时将被忽略。
        </div>
        <textarea id="ms-stopwords-input" class="text_pole" style="width:100%;min-height:80px;font-size:0.9em;resize:vertical;">${escapeHtml(stopWordsStr)}</textarea>
    </div>`;

    // 实时追踪输入值（弹窗关闭后 DOM 销毁，用变量保存）
    $(document).on('input', '#ms-stopwords-input', function () {
        stopWordsStr = $(this).val() || '';
    });

    const result = await callGenericPopup(popupHtml, POPUP_TYPE.TEXT, '', {
        okButton: '保存',
        cancelButton: '取消',
        wide: false,
    });

    $(document).off('input', '#ms-stopwords-input');

    if (result) {
        const words = stopWordsStr.split(/\s+/).filter(Boolean);
        updateStopWords(words);
    }
}

/**
 * 显示图片视频适配词编辑弹窗
 */
export async function showTypeKeywordsPopup() {
    const msd = getMatchScoringData();
    let formVideo = msd.typeVideoKeywords || '';
    let formImage = msd.typeImageKeywords || '';
    let formAudio = msd.typeAudioKeywords || '';

    const popupHtml = `
    <div style="padding:8px;min-width:320px;">
        <div style="margin-bottom:10px;">
            <div style="font-weight:bold;font-size:0.9em;margin-bottom:4px;">
                <i class="fa-solid fa-video"></i> 视频适配词
            </div>
            <div style="font-size:0.8em;color:var(--grey40);margin-bottom:4px;">
                对话中出现这些词时，视频文件将获得加分。用空格分隔。
            </div>
            <textarea id="ms-video-keywords" class="text_pole" style="width:100%;min-height:60px;font-size:0.85em;resize:vertical;">${escapeHtml(formVideo)}</textarea>
        </div>
        <div style="margin-bottom:10px;">
            <div style="font-weight:bold;font-size:0.9em;margin-bottom:4px;">
                <i class="fa-solid fa-image"></i> 图片适配词
            </div>
            <div style="font-size:0.8em;color:var(--grey40);margin-bottom:4px;">
                对话中出现这些词时，图片文件将获得加分。用空格分隔。
            </div>
            <textarea id="ms-image-keywords" class="text_pole" style="width:100%;min-height:60px;font-size:0.85em;resize:vertical;">${escapeHtml(formImage)}</textarea>
        </div>
        <div style="margin-bottom:8px;">
            <div style="font-weight:bold;font-size:0.9em;margin-bottom:4px;">
                <i class="fa-solid fa-music"></i> 音频适配词
            </div>
            <div style="font-size:0.8em;color:var(--grey40);margin-bottom:4px;">
                对话中出现这些词时，音频文件将获得加分。用空格分隔。
            </div>
            <textarea id="ms-audio-keywords" class="text_pole" style="width:100%;min-height:60px;font-size:0.85em;resize:vertical;">${escapeHtml(formAudio)}</textarea>
        </div>
    </div>`;

    // 实时追踪输入值
    $(document).on('input', '#ms-video-keywords', function () { formVideo = $(this).val() || ''; });
    $(document).on('input', '#ms-image-keywords', function () { formImage = $(this).val() || ''; });
    $(document).on('input', '#ms-audio-keywords', function () { formAudio = $(this).val() || ''; });

    const result = await callGenericPopup(popupHtml, POPUP_TYPE.TEXT, '', {
        okButton: '保存',
        cancelButton: '取消',
        wide: false,
    });

    $(document).off('input', '#ms-video-keywords');
    $(document).off('input', '#ms-image-keywords');
    $(document).off('input', '#ms-audio-keywords');

    if (result) {
        updateTypeVideoKeywords(formVideo);
        updateTypeImageKeywords(formImage);
        updateTypeAudioKeywords(formAudio);
    }
}

/**
 * 显示配置手册弹窗
 */
export async function showConfigManualPopup() {
    const manualHtml = `
    <div style="padding:8px;max-height:70dvh;overflow-y:auto;font-size:0.85em;line-height:1.6;">
        <div style="margin-bottom:12px;">
            <div style="font-weight:bold;font-size:1em;margin-bottom:4px;color:var(--primary);">📤 来源权重</div>
            <table style="width:100%;border-collapse:collapse;font-size:0.9em;">
                <tr style="border-bottom:1px solid var(--borderColor);">
                    <td style="padding:6px 4px;font-weight:bold;width:120px;">AI回答匹配权重</td>
                    <td style="padding:6px 4px;">AI 最后一条回复的匹配分数占总分的百分比。流式传输结束后自动评分。</td>
                    <td style="padding:6px 4px;color:var(--grey40);width:60px;">默认 60%</td>
                </tr>
                <tr>
                    <td style="padding:6px 4px;font-weight:bold;">用户提问匹配权重</td>
                    <td style="padding:6px 4px;">用户最后一条提问的匹配分数占总分的百分比。</td>
                    <td style="padding:6px 4px;color:var(--grey40);">默认 40%</td>
                </tr>
            </table>
            <div style="font-size:0.8em;color:var(--grey40);margin-top:4px;">💡 两者之和应为 100%。AI 回答权重高 → 更关注 AI 说了什么；用户提问权重高 → 更关注用户问了什么。</div>
        </div>

        <div style="margin-bottom:12px;">
            <div style="font-weight:bold;font-size:1em;margin-bottom:4px;color:var(--primary);">🔤 内容分词权重</div>
            <table style="width:100%;border-collapse:collapse;font-size:0.9em;">
                <tr style="border-bottom:1px solid var(--borderColor);">
                    <td style="padding:6px 4px;font-weight:bold;width:120px;">单字词权重</td>
                    <td style="padding:6px 4px;">匹配单个汉字的权重。如"战"匹配"战斗"中的"战"。精度低但覆盖广。</td>
                    <td style="padding:6px 4px;color:var(--grey40);width:60px;">默认 0.3</td>
                </tr>
                <tr style="border-bottom:1px solid var(--borderColor);">
                    <td style="padding:6px 4px;font-weight:bold;">两字词权重</td>
                    <td style="padding:6px 4px;">匹配连续两个汉字的权重。如"战斗"匹配"战斗"。基础粒度，适用大多数场景。</td>
                    <td style="padding:6px 4px;color:var(--grey40);">默认 1.0</td>
                </tr>
                <tr style="border-bottom:1px solid var(--borderColor);">
                    <td style="padding:6px 4px;font-weight:bold;">三字词权重</td>
                    <td style="padding:6px 4px;">匹配连续三个汉字的权重。如"兔女郎"匹配"兔女郎"。精度更高，适合专有名词。</td>
                    <td style="padding:6px 4px;color:var(--grey40);">默认 1.5</td>
                </tr>
                <tr style="border-bottom:1px solid var(--borderColor);">
                    <td style="padding:6px 4px;font-weight:bold;">四字词权重</td>
                    <td style="padding:6px 4px;">匹配连续四个汉字的权重。如"春暖花开"。覆盖场景较少。</td>
                    <td style="padding:6px 4px;color:var(--grey40);">默认 0.8</td>
                </tr>
                <tr>
                    <td style="padding:6px 4px;font-weight:bold;">五字词权重</td>
                    <td style="padding:6px 4px;">匹配连续五个汉字的权重。极精确但覆盖率很低。</td>
                    <td style="padding:6px 4px;color:var(--grey40);">默认 0.5</td>
                </tr>
            </table>
            <div style="font-size:0.8em;color:var(--grey40);margin-top:4px;">💡 推荐保持三字词 > 两字词 > 四字词 > 五字词 > 单字词的权重排序。如果内容描述较短（如 < 10 字），可提高单字词权重。</div>
        </div>

        <div style="margin-bottom:12px;">
            <div style="font-weight:bold;font-size:1em;margin-bottom:4px;color:var(--primary);">🏷️ 其他维度权重</div>
            <table style="width:100%;border-collapse:collapse;font-size:0.9em;">
                <tr style="border-bottom:1px solid var(--borderColor);">
                    <td style="padding:6px 4px;font-weight:bold;width:120px;">标签匹配权重</td>
                    <td style="padding:6px 4px;">文件标签与对话文本匹配时的加分。每个标签独立计分，适合精确控制。</td>
                    <td style="padding:6px 4px;color:var(--grey40);width:60px;">默认 2.0</td>
                </tr>
                <tr style="border-bottom:1px solid var(--borderColor);">
                    <td style="padding:6px 4px;font-weight:bold;width:120px;">🔤 适配词权重</td>
                    <td style="padding:6px 4px;">对话中提到了适配词（如"视频""图片"）时，对应类型的文件加分。与类型偏好不同，适配词加分需要对话内容触发。</td>
                    <td style="padding:6px 4px;color:var(--grey40);">默认 0.5</td>
                </tr>
                <tr style="border-bottom:1px solid var(--borderColor);">
                    <td style="padding:6px 4px;font-weight:bold;">关联词权重</td>
                    <td style="padding:6px 4px;">手动配置的关联词对（如 兔女郎→兔耳女）匹配时加分。双向匹配。</td>
                    <td style="padding:6px 4px;color:var(--grey40);">默认 1.2</td>
                </tr>
                <tr style="border-bottom:1px solid var(--borderColor);">
                    <td style="padding:6px 4px;font-weight:bold;">停用词匹配权重</td>
                    <td style="padding:6px 4px;">"的""了""在"等停用词不再被过滤，而是以低权重参与匹配。减少信息丢失。</td>
                    <td style="padding:6px 4px;color:var(--grey40);">默认 0.2</td>
                </tr>
                <tr style="border-bottom:1px solid var(--borderColor);">
                    <td style="padding:6px 4px;font-weight:bold;">🖼️ 图片偏好</td>
                    <td style="padding:6px 4px;">图片文件直接加分，不需要适配词触发。适合偏向展示图片的场景，调高后图片类型文件整体排名更高。</td>
                    <td style="padding:6px 4px;color:var(--grey40);">默认 1.5</td>
                </tr>
                <tr style="border-bottom:1px solid var(--borderColor);">
                    <td style="padding:6px 4px;font-weight:bold;">🎬 视频偏好</td>
                    <td style="padding:6px 4px;">视频文件直接加分，不需要适配词触发。适合偏向展示视频的场景，调高后视频类型文件整体排名更高。</td>
                    <td style="padding:6px 4px;color:var(--grey40);">默认 1.5</td>
                </tr>
                <tr>
                    <td style="padding:6px 4px;font-weight:bold;">字符模糊匹配</td>
                    <td style="padding:6px 4px;">自动计算字符重叠率发现相似词（如"兔耳女"≈"兔女郎"）。适合中文同义词。</td>
                    <td style="padding:6px 4px;color:var(--grey40);">默认 1.2</td>
                </tr>
            </table>
        </div>

        <div style="margin-bottom:12px;">
            <div style="font-weight:bold;font-size:1em;margin-bottom:4px;color:var(--primary);">🔀 模糊匹配阈值</div>
            <table style="width:100%;border-collapse:collapse;font-size:0.9em;">
                <tr>
                    <td style="padding:6px 4px;font-weight:bold;width:120px;">重叠阈值</td>
                    <td style="padding:6px 4px;">字符模糊匹配的最低重叠率。50% 表示两个词有一半以上字符相同就算匹配。调低（如 30%）更容易匹配但可能误报；调高（如 70%）更严格。</td>
                    <td style="padding:6px 4px;color:var(--grey40);width:60px;">默认 50%</td>
                </tr>
            </table>
        </div>

        <div style="margin-bottom:12px;">
            <div style="font-weight:bold;font-size:1em;margin-bottom:4px;color:var(--primary);">📊 展示配置</div>
            <table style="width:100%;border-collapse:collapse;font-size:0.9em;">
                <tr style="border-bottom:1px solid var(--borderColor);">
                    <td style="padding:6px 4px;font-weight:bold;width:120px;">展示前 N 个文件</td>
                    <td style="padding:6px 4px;">聊天气泡中最多展示多少个匹配文件。设为 1 只展示第一名。</td>
                    <td style="padding:6px 4px;color:var(--grey40);width:60px;">默认 3</td>
                </tr>
                <tr>
                    <td style="padding:6px 4px;font-weight:bold;">最低分数</td>
                    <td style="padding:6px 4px;">低于此分数的文件不在聊天气泡中展示（但面板中仍显示）。设为 0 不限制。</td>
                    <td style="padding:6px 4px;color:var(--grey40);">默认 0</td>
                </tr>
            </table>
        </div>

        <div style="margin-bottom:8px;">
            <div style="font-weight:bold;font-size:1em;margin-bottom:4px;color:var(--primary);">📦 配置存档</div>
            <div style="font-size:0.9em;line-height:1.6;">
                <p>存档功能用于保存和切换多套权重配置，方便在不同场景下快速切换：</p>
                <ul style="margin:4px 0;padding-left:20px;">
                    <li><b>读取</b>下拉框 — 选择一个存档后立即加载其权重</li>
                    <li><b>新建</b> — 用"名称"框的值创建新存档，保存当前权重</li>
                    <li><b>保存</b> — 将当前权重覆盖保存到当前选中的存档中</li>
                    <li><b>删除</b> — 删除选中的存档（不会影响当前正在使用的权重）</li>
                </ul>
                <div style="font-size:0.8em;color:var(--grey40);margin-top:4px;">💡 建议：为角色扮演、日常聊天、教程演示等不同场景分别建立存档。</div>
            </div>
        </div>
    </div>`;

    await callGenericPopup(manualHtml, POPUP_TYPE.TEXT, '', {
        okButton: '关闭',
        wide: true,
    });
}

/**
 * 标签筛选弹窗
 * 展示所有文件使用的标签，勾选的标签→只展示包含该标签的文件
 */
export async function showTagFilterPopup() {
    const files = getFiles();
    // 收集所有去重的标签
    const allTags = new Set();
    files.forEach(f => (f.tagList || []).forEach(t => allTags.add(t)));
    const sortedTags = [...allTags].sort();

    let selected = getSelectedTags();
    // ⭐ 清理已不存在的标签，但保留 __untagged__ 虚拟选项
    selected = selected.filter(tag => tag === '__untagged__' || allTags.has(tag));
    // 如果 selected 变了，保存清理结果
    const saved = getSelectedTags();
    if (selected.length !== saved.length || selected.some((t, i) => t !== saved[i])) {
        updateSelectedTags(selected);
    }
    const selectedSet = new Set(selected);

    // 虚拟标签（放最前面）
    const virtualTags = [
        { value: '__untagged__', label: '(无标签)' },
    ];
    let checkboxesHtml = virtualTags.map(vt =>
        `<label style="display:inline-flex;align-items:center;gap:4px;margin:3px 8px;font-size:0.85em;cursor:pointer;white-space:nowrap;color:var(--grey40);">
            <input type="checkbox" class="ms-tag-checkbox" value="${vt.value}" ${selectedSet.has(vt.value) ? 'checked' : ''}>
            ${vt.label}
        </label>`
    ).join('');
    checkboxesHtml += sortedTags.map(tag => {
        if (tag === '__untagged__' || tag === '__type_video__' || tag === '__type_image__') return '';
        const checked = selectedSet.has(tag) ? 'checked' : '';
        return `<label style="display:inline-flex;align-items:center;gap:4px;margin:3px 8px;font-size:0.85em;cursor:pointer;white-space:nowrap;">
            <input type="checkbox" class="ms-tag-checkbox" value="${escapeHtml(tag)}" ${checked}>
            ${escapeHtml(tag)}
        </label>`;
    }).join('') || '';
    if (!checkboxesHtml.trim()) {
        checkboxesHtml = '<div style="color:var(--grey40);font-size:0.85em;">暂无标签</div>';
    }

    const html = `
    <div style="padding:8px;max-height:60dvh;overflow-y:auto;">
        <div style="margin-bottom:8px;display:flex;flex-direction:row;gap:8px;">
            <button onclick="var n=this.parentNode.nextElementSibling;if(n)n.querySelectorAll('input[type=checkbox]').forEach(function(x){x.checked=true;x.dispatchEvent(new Event('change',{bubbles:true}));});" style="font-size:0.8em;white-space:nowrap;display:inline-flex;align-items:center;gap:4px;writing-mode:horizontal-tb;border:1px solid var(--borderColor);border-radius:4px;padding:4px 8px;background:var(--bgColor);cursor:pointer;color:var(--textColor);">✅ 全部勾选</button>
            <button onclick="var n=this.parentNode.nextElementSibling;if(n)n.querySelectorAll('input[type=checkbox]').forEach(function(x){x.checked=false;x.dispatchEvent(new Event('change',{bubbles:true}));});" style="font-size:0.8em;white-space:nowrap;display:inline-flex;align-items:center;gap:4px;writing-mode:horizontal-tb;border:1px solid var(--borderColor);border-radius:4px;padding:4px 8px;background:var(--bgColor);cursor:pointer;color:var(--textColor);">❌ 全部取消</button>
        </div>
        <div id="ms-tag-list" style="display:flex;flex-wrap:wrap;gap:2px;">
            ${checkboxesHtml}
        </div>
    </div>`;

    // ⭐ 用变量追踪选中状态（弹窗关闭后 DOM 销毁，不能依赖 DOM 读取）
    let currentSelected = [...getSelectedTags()];

    // 监听复选框变化（change 事件可冒泡，事件委托有效）
    $(document).on('change', '.ms-tag-checkbox', function () {
        if (this.checked) {
            if (!currentSelected.includes(this.value)) currentSelected.push(this.value);
        } else {
            currentSelected = currentSelected.filter(t => t !== this.value);
        }
    });

    const result = await callGenericPopup(html, POPUP_TYPE.TEXT, '', {
        okButton: '确认',
        cancelButton: '取消',
        wide: false,
    });

    // 清理事件委托
    $(document).off('change', '.ms-tag-checkbox');

    if (result) {
        updateSelectedTags(currentSelected);
        // 刷新文件列表
        const { renderFileDisplay } = await import('./file-display.js');
        renderFileDisplay();
    }
}
