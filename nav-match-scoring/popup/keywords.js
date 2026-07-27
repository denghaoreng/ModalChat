// popup-keywords.js — 类型关键词 + 配置手册弹窗

import { callGenericPopup } from '../../../../../popup.js';
import { getMatchScoringData, updateTypeVideoKeywords, updateTypeImageKeywords, updateTypeAudioKeywords } from '../../core/data.js';
import { escapeHtml } from '../../shared/utils.js';

const POPUP_TYPE = Object.freeze({ TEXT: 1, CONFIRM: 2, INPUT: 3, DISPLAY: 4 });

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
        </div>
        <div style="margin-bottom:12px;">
            <div style="font-weight:bold;font-size:1em;margin-bottom:4px;color:var(--primary);">🔤 内容分词权重</div>
            <table style="width:100%;border-collapse:collapse;font-size:0.9em;">
                <tr style="border-bottom:1px solid var(--borderColor);"><td style="padding:6px 4px;font-weight:bold;width:120px;">单字词权重</td><td style="padding:6px 4px;">匹配单个汉字的权重。如"战"匹配"战斗"中的"战"。精度低但覆盖广。</td><td style="padding:6px 4px;color:var(--grey40);width:60px;">默认 0.3</td></tr>
                <tr style="border-bottom:1px solid var(--borderColor);"><td style="padding:6px 4px;font-weight:bold;">两字词权重</td><td style="padding:6px 4px;">匹配连续两个汉字的权重。如"战斗"匹配"战斗"。</td><td style="padding:6px 4px;color:var(--grey40);">默认 1.0</td></tr>
                <tr style="border-bottom:1px solid var(--borderColor);"><td style="padding:6px 4px;font-weight:bold;">三字词权重</td><td style="padding:6px 4px;">匹配连续三个汉字的权重。如"兔女郎"。</td><td style="padding:6px 4px;color:var(--grey40);">默认 1.5</td></tr>
                <tr style="border-bottom:1px solid var(--borderColor);"><td style="padding:6px 4px;font-weight:bold;">四字词权重</td><td style="padding:6px 4px;">匹配连续四个汉字的权重。如"春暖花开"。</td><td style="padding:6px 4px;color:var(--grey40);">默认 0.8</td></tr>
                <tr><td style="padding:6px 4px;font-weight:bold;">五字词权重</td><td style="padding:6px 4px;">匹配连续五个汉字的权重。极精确但覆盖率很低。</td><td style="padding:6px 4px;color:var(--grey40);">默认 0.5</td></tr>
            </table>
        </div>
        <div style="margin-bottom:12px;">
            <div style="font-weight:bold;font-size:1em;margin-bottom:4px;color:var(--primary);">🏷️ 其他维度权重</div>
            <table style="width:100%;border-collapse:collapse;font-size:0.9em;">
                <tr style="border-bottom:1px solid var(--borderColor);"><td style="padding:6px 4px;font-weight:bold;width:120px;">标签匹配权重</td><td style="padding:6px 4px;">文件标签与对话文本匹配时的加分。</td><td style="padding:6px 4px;color:var(--grey40);width:60px;">默认 2.0</td></tr>
                <tr style="border-bottom:1px solid var(--borderColor);"><td style="padding:6px 4px;font-weight:bold;">🔤 适配词权重</td><td style="padding:6px 4px;">对话中提到了适配词时，对应类型的文件加分。</td><td style="padding:6px 4px;color:var(--grey40);">默认 0.5</td></tr>
                <tr style="border-bottom:1px solid var(--borderColor);"><td style="padding:6px 4px;font-weight:bold;">关联词权重</td><td style="padding:6px 4px;">手动配置的关联词对匹配时加分。</td><td style="padding:6px 4px;color:var(--grey40);">默认 1.2</td></tr>
                <tr style="border-bottom:1px solid var(--borderColor);"><td style="padding:6px 4px;font-weight:bold;">停用词匹配权重</td><td style="padding:6px 4px;">停用词以低权重参与匹配，减少信息丢失。</td><td style="padding:6px 4px;color:var(--grey40);">默认 0.2</td></tr>
                <tr style="border-bottom:1px solid var(--borderColor);"><td style="padding:6px 4px;font-weight:bold;">🖼️ 图片偏好</td><td style="padding:6px 4px;">图片文件直接加分，不需要适配词触发。</td><td style="padding:6px 4px;color:var(--grey40);">默认 1.5</td></tr>
                <tr style="border-bottom:1px solid var(--borderColor);"><td style="padding:6px 4px;font-weight:bold;">🎬 视频偏好</td><td style="padding:6px 4px;">视频文件直接加分，不需要适配词触发。</td><td style="padding:6px 4px;color:var(--grey40);">默认 1.5</td></tr>
                <tr><td style="padding:6px 4px;font-weight:bold;">字符模糊匹配</td><td style="padding:6px 4px;">自动计算字符重叠率发现相似词。</td><td style="padding:6px 4px;color:var(--grey40);">默认 1.2</td></tr>
            </table>
        </div>
        <div style="margin-bottom:12px;">
            <div style="font-weight:bold;font-size:1em;margin-bottom:4px;color:var(--primary);">🔀 模糊匹配阈值</div>
            <table style="width:100%;border-collapse:collapse;font-size:0.9em;">
                <tr><td style="padding:6px 4px;font-weight:bold;width:120px;">重叠阈值</td><td style="padding:6px 4px;">字符模糊匹配的最低重叠率。默认 50%</td><td style="padding:6px 4px;color:var(--grey40);width:60px;">默认 50%</td></tr>
            </table>
        </div>
        <div style="margin-bottom:12px;">
            <div style="font-weight:bold;font-size:1em;margin-bottom:4px;color:var(--primary);">📊 展示配置</div>
            <table style="width:100%;border-collapse:collapse;font-size:0.9em;">
                <tr style="border-bottom:1px solid var(--borderColor);"><td style="padding:6px 4px;font-weight:bold;width:120px;">展示前 N 个文件</td><td style="padding:6px 4px;">聊天气泡中最多展示多少个匹配文件。</td><td style="padding:6px 4px;color:var(--grey40);width:60px;">默认 3</td></tr>
                <tr><td style="padding:6px 4px;font-weight:bold;">最低分数</td><td style="padding:6px 4px;">低于此分数的文件不在聊天气泡中展示。</td><td style="padding:6px 4px;color:var(--grey40);">默认 0</td></tr>
            </table>
        </div>
        <div style="margin-bottom:8px;">
            <div style="font-weight:bold;font-size:1em;margin-bottom:4px;color:var(--primary);">📦 配置存档</div>
            <div style="font-size:0.9em;line-height:1.6;">
                <p>存档功能用于保存和切换多套权重配置。</p>
                <ul style="margin:4px 0;padding-left:20px;">
                    <li><b>读取</b>下拉框 — 选择一个存档后立即加载其权重</li>
                    <li><b>新建</b> — 用名称框的值创建新存档</li>
                    <li><b>保存</b> — 将当前权重覆盖保存到当前存档</li>
                    <li><b>删除</b> — 删除选中的存档</li>
                </ul>
            </div>
        </div>
    </div>`;

    await callGenericPopup(manualHtml, POPUP_TYPE.TEXT, '', {
        okButton: '关闭',
        wide: true,
    });
}
