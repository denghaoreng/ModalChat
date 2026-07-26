// nav-general-settings/anim-types.js — 轮播类型子标签页

import { getAnimationTypes, saveSettings } from '../data.js';
import { escapeHtml } from '../shared/utils.js';

// ==================== 渲染 ====================

export function renderAnimTypes() {
    const types = getAnimationTypes();

    const selIdx = types.findIndex(t => t.selected);
    const editIdx = selIdx >= 0 ? selIdx : 0;
    const cur = types[editIdx] || { name: '', timingFunction: 'ease-out' };

    const lines = [];
    lines.push('<div style="padding:4px 8px;">');
    lines.push('<div style="display:flex;gap:8px;align-items:center;margin-bottom:8px;border-bottom:1px solid var(--borderColor);padding-bottom:6px;">');
    lines.push('<span style="font-weight:bold;font-size:0.9em;"><i class="fa-solid fa-film"></i> 轮播插入类型</span>');
    lines.push('<span style="flex:1;"></span>');
    lines.push('<button id="mc-anim-create" class="menu_button" style="font-size:0.8em;white-space:nowrap;"><i class="fa-solid fa-plus"></i> 创建类型</button>');
    lines.push('<button id="mc-anim-save" class="menu_button" style="font-size:0.8em;white-space:nowrap;"><i class="fa-solid fa-floppy-disk"></i> 保存类型</button>');
    lines.push('<button id="mc-anim-delete-btn" class="menu_button" style="font-size:0.8em;white-space:nowrap;color:var(--dangerColor);"><i class="fa-solid fa-trash"></i> 删除类型</button>');
    lines.push('</div>');

    if (types.length === 0) {
        lines.push('<div style="text-align:center;padding:20px;color:var(--grey40);font-size:0.85em;">暂无轮播类型</div>');
    } else {
        lines.push('<div style="margin-bottom:8px;display:flex;align-items:center;gap:8px;">');
        lines.push('<span style="font-size:0.85em;color:var(--grey40);font-weight:500;">选择类型</span>');
        lines.push('<select id="mc-anim-selector" class="text_pole" style="flex:1;font-size:0.9em;padding:4px 8px;">');
        for (let i = 0; i < types.length; i++) {
            lines.push('<option value="' + i + '"' + (i === editIdx ? ' selected' : '') + '>' + escapeHtml(types[i].name || '未命名') + '</option>');
        }
        lines.push('</select>');
        lines.push('</div>');

        lines.push('<div style="padding:10px;background:var(--white15);border-radius:6px;">');
        lines.push('<div style="display:flex;align-items:center;gap:12px;margin-bottom:8px;">');
        lines.push('<div style="display:flex;align-items:center;gap:6px;">');
        lines.push('<label style="font-size:0.85em;">名称</label>');
        lines.push('<input id="mc-anim-name" class="text_pole" type="text" value="' + escapeHtml(cur.name) + '" style="width:140px;font-size:0.9em;padding:4px 8px;">');
        lines.push('</div>');
        lines.push('</div>');
        lines.push('<div style="margin-bottom:8px;">');
        lines.push('<label style="font-size:0.85em;display:block;margin-bottom:4px;color:var(--grey40);">缓动函数 <span id="mc-anim-help" style="cursor:pointer;color:var(--primary);font-size:inherit;" title="查看帮助">❓</span></label>');
        lines.push('<div style="display:flex;align-items:center;gap:6px;">');
        lines.push('<input id="mc-anim-timing" class="text_pole" type="text" value="' + escapeHtml(cur.timingFunction || 'ease-out') + '" style="width:100%;height:48px;font-size:0.9em;padding:4px 8px;font-family:monospace;" placeholder="ease, ease-in, ease-out, cubic-bezier(...), steps(...)">');
        lines.push('</div>');
        lines.push('</div>');
        lines.push('<div style="margin-bottom:6px;">');
        lines.push('<label style="font-size:0.85em;display:block;margin-bottom:4px;color:var(--grey40);">CSS @keyframes（只填关键帧内容，不含 @keyframes 声明）</label>');
        lines.push('<textarea id="mc-anim-keyframes" class="text_pole" style="width:100%;height:160px;font-family:monospace;font-size:0.85em;padding:6px;resize:vertical;white-space:pre;tab-size:2;">' + escapeHtml(cur.keyframes || '') + '</textarea>');
        lines.push('</div>');
        lines.push('<div style="font-size:0.78em;color:var(--grey40);margin-top:4px;">');
        lines.push('💡 点击上方 ❓ 查看 @keyframes 和缓动函数说明');
        lines.push('</div>');
        lines.push('</div>');
    }
    lines.push('</div>');
    return lines.join('\n');
}

// ==================== 事件绑定 ====================

export function bindAnimEvents() {
    $(document).off('change', '#mc-anim-selector').on('change', '#mc-anim-selector', function () {
        const idx = parseInt($(this).val());
        const types = getAnimationTypes();
        types.forEach((t, i) => t.selected = i === idx);
        saveSettings();
        _reloadParent();
    });

    $(document).off('click', '#mc-anim-delete-btn').on('click', '#mc-anim-delete-btn', function () {
        const types = getAnimationTypes();
        const selIdx = types.findIndex(t => t.selected);
        if (selIdx < 0) return;
        if (types.length <= 1) { toastr.warning('至少保留 1 个类型'); return; }
        types.splice(selIdx, 1);
        const next = Math.min(selIdx, types.length - 1);
        types[next].selected = true;
        saveSettings();
        _reloadParent();
    });

    $(document).off('click', '#mc-anim-help').on('click', '#mc-anim-help', async function () {
        const { callGenericPopup, POPUP_TYPE } = await import('../../../../popup.js');
        const html = '<div style="max-height:70vh;overflow-y:auto;padding:16px;font-size:0.9em;line-height:1.7;">' +
            '<h3 style="margin:0 0 10px 0;border-bottom:1px solid var(--borderColor);padding-bottom:6px;">📖 轮播动画帮助</h3>' +
            '<h4 style="margin:10px 0 4px;">🎬 @keyframes 怎么写</h4>' +
            '<p style="margin:4px 0;">只填<strong>关键帧选择器和样式</strong>，<strong>不要</strong>写 <code>@keyframes 名称 { }</code> 包裹。</p>' +
            '<p style="margin:4px 0;">格式：<code>百分比 { CSS 属性 }</code>，每个关键帧用空格或换行隔开。</p>' +
            '<p style="margin:4px 0;"><strong>常用属性：</strong></p>' +
            '<ul style="margin:2px 0 6px 20px;padding:0;">' +
            '<li><code>transform</code> — 缩放/旋转/平移/倾斜，如 <code>scale(1.2)</code>、<code>rotate(10deg)</code>、<code>translateY(-20px)</code></li>' +
            '<li><code>opacity</code> — 透明度，0（透明）~ 1（不透明）</li>' +
            '<li><code>filter</code> — 滤镜，如 <code>blur(4px)</code>、<code>brightness(1.5)</code></li>' +
            '<li><code>clip-path</code> — 裁剪路径，如 <code>inset(0 100% 0 0)</code> 可实现擦除效果</li>' +
            '<li><code>border-radius</code> — 圆角变化</li>' +
            '</ul>' +
            '<p style="margin:4px 0;">示例（果冻弹性）：</p>' +
            '<pre style="background:var(--white15);padding:8px;border-radius:4px;font-size:0.85em;white-space:pre-wrap;">' +
'0%, 100% { transform: scale(1, 1); }\n' +
'15% { transform: scale(1.08, 0.88); }\n' +
'30% { transform: scale(0.92, 1.1); }\n' +
'45% { transform: scale(1.04, 0.94); }\n' +
'60% { transform: scale(0.97, 1.04); }\n' +
'75% { transform: scale(1.01, 0.98); }\n' +
'90% { transform: scale(0.99, 1.01); }\n' +
            '</pre>' +
            '<p style="margin:4px 0;">更多示例：</p>' +
            '<ul style="margin:2px 0 6px 20px;padding:0;">' +
            '<li><strong>淡入上浮：</strong><code>0% { opacity: 0; transform: translateY(30px); } 100% { opacity: 1; transform: translateY(0); }</code></li>' +
            '<li><strong>缩放弹入：</strong><code>0% { opacity: 0; transform: scale(0.3); } 50% { transform: scale(1.12); } 100% { opacity: 1; transform: scale(1); }</code></li>' +
            '<li><strong>左右摇摆：</strong><code>0%, 100% { transform: rotate(0deg); } 25% { transform: rotate(6deg); } 50% { transform: rotate(-6deg); }</code></li>' +
            '</ul>' +
            '<h4 style="margin:10px 0 4px;">⚡ 缓动函数 (timing-function)</h4>' +
            '<p style="margin:4px 0;">控制动画速度随时间的<strong>变化曲线</strong>。直接输入任意 CSS 合法值。</p>' +
            '<table style="width:100%;border-collapse:collapse;font-size:0.85em;">' +
            '<tr style="border-bottom:1px solid var(--borderColor);"><td style="padding:6px 8px;font-weight:bold;">ease</td><td style="padding:6px 8px;">慢→快→慢（默认，最自然）</td></tr>' +
            '<tr style="border-bottom:1px solid var(--borderColor);"><td style="padding:6px 8px;font-weight:bold;">ease-in</td><td style="padding:6px 8px;">慢→快（渐入，出场效果）</td></tr>' +
            '<tr style="border-bottom:1px solid var(--borderColor);"><td style="padding:6px 8px;font-weight:bold;">ease-out</td><td style="padding:6px 8px;">快→慢（渐出，入场效果）</td></tr>' +
            '<tr style="border-bottom:1px solid var(--borderColor);"><td style="padding:6px 8px;font-weight:bold;">ease-in-out</td><td style="padding:6px 8px;">慢→快→慢（两端平滑）</td></tr>' +
            '<tr style="border-bottom:1px solid var(--borderColor);"><td style="padding:6px 8px;font-weight:bold;">linear</td><td style="padding:6px 8px;">匀速（机械感）</td></tr>' +
            '<tr style="border-bottom:1px solid var(--borderColor);"><td style="padding:6px 8px;font-weight:bold;">cubic-bezier(x1,y1,x2,y2)</td><td style="padding:6px 8px;">自定义贝塞尔曲线，<strong>4 个参数定义两个控制点</strong>（P1 和 P2）：<br>' +
            '• <code>x1, y1</code> — 第一个控制点（控制起始速度方向）<br>' +
            '• <code>x2, y2</code> — 第二个控制点（控制结束速度方向）<br>' +
            '• <code>y</code> 可以超出 0~1 范围，产生<strong>弹跳/回弹</strong>效果<br>' +
            '• 常用参考：<br>' +
            '&nbsp;&nbsp;<code>ease</code> = <code>cubic-bezier(0.25, 0.1, 0.25, 1)</code><br>' +
            '&nbsp;&nbsp;<code>ease-in</code> = <code>cubic-bezier(0.42, 0, 1, 1)</code><br>' +
            '&nbsp;&nbsp;<code>ease-out</code> = <code>cubic-bezier(0, 0, 0.58, 1)</code><br>' +
            '&nbsp;&nbsp;<code>ease-in-out</code> = <code>cubic-bezier(0.42, 0, 0.58, 1)</code><br>' +
            '示例：<code>cubic-bezier(0.68, -0.55, 0.27, 1.55)</code>（y1=-0.55 回拉 → y2=1.55 过冲 → 弹跳）</td></tr>' +
            '<tr style="border-bottom:1px solid var(--borderColor);"><td style="padding:6px 8px;font-weight:bold;">steps(n)</td><td style="padding:6px 8px;">步进动画，将整个过程分成 n 段跳变。<br>示例：<code>steps(4)</code> 分 4 段跳变，适合逐帧效果。</td></tr>' +
            '<tr style="border-bottom:1px solid var(--borderColor);"><td style="padding:6px 8px;font-weight:bold;">step-start</td><td style="padding:6px 8px;">直接跳到终点状态开始，相当于 <code>steps(1, start)</code></td></tr>' +
            '<tr style="border-bottom:1px solid var(--borderColor);"><td style="padding:6px 8px;font-weight:bold;">step-end</td><td style="padding:6px 8px;">保持起点直到动画结束时瞬间跳到终点，相当于 <code>steps(1, end)</code></td></tr>' +
            '<tr><td style="padding:6px 8px;font-weight:bold;">steps(n, direction)</td><td style="padding:6px 8px;">步进动画的完整语法：<br>' +
            '• <code>steps(n, start)</code> — 第一步在开始时跳变<br>' +
            '• <code>steps(n, end)</code> — 第一步在结束时跳变（默认）<br>' +
            '• <code>steps(n, jump-start)</code> / <code>jump-end</code> / <code>jump-none</code> / <code>jump-both</code> — 新版语法，更精细控制跳变点</td></tr>' +
            '</table>' +
            '<p style="margin:8px 0 0 0;"><strong>提示：</strong>CSS 动画理论上支持任意 <code>animation-timing-function</code> 合法值，如有新标准出现也可直接输入。</p>' +
            '<p style="margin:8px 0 0 0;"><strong>提示：</strong>缓动函数可以直接在输入框输入，比如自定义 <code>cubic-bezier(0.25, 0.1, 0.25, 1)</code>。</p>' +
            '</div>';
        await callGenericPopup(html, POPUP_TYPE.TEXT, '', { okButton: '关闭' });
    });

    $(document).off('click', '#mc-anim-create').on('click', '#mc-anim-create', function () {
        const types = getAnimationTypes();
        types.forEach(t => t.selected = false);
        types.push({
            name: '新类型',
            timingFunction: 'ease-out',
            keyframes: '0% { opacity: 0; transform: scale(0.8); }\n100% { opacity: 1; transform: scale(1); }',
            selected: true,
        });
        saveSettings();
        _reloadParent();
    });

    // 校验
    function testTiming(v) {
        if (!v) return false;
        const el = document.createElement('div');
        el.style.animationTimingFunction = v;
        return !!el.style.animationTimingFunction;
    }
    function testKeyframes(v) {
        if (!v || !v.includes('%') || !v.includes('{') || !v.includes('}')) return false;
        const name = '_mc_test_' + Date.now();
        const sheet = document.createElement('style');
        sheet.textContent = '@keyframes ' + name + ' {' + v + '}';
        try {
            document.head.appendChild(sheet);
            let valid = false;
            for (let i = 0; i < document.styleSheets.length; i++) {
                const ss = document.styleSheets[i];
                try {
                    if (ss.ownerNode === sheet && ss.cssRules && ss.cssRules.length > 0) {
                        const cssText = ss.cssRules[0].cssText;
                        const parsedPcts = cssText.match(/\d+%/g) || [];
                        const inputPcts = v.match(/\d+%/g) || [];
                        let allFound = inputPcts.length > 0;
                        for (const pct of inputPcts) {
                            if (!parsedPcts.includes(pct)) { allFound = false; break; }
                        }
                        const cleaned = v
                            .replace(/\/\*[\s\S]*?\*\//g, '')
                            .replace(/(?:\d+%\s*(?:,\s*\d+%)*|\bfrom\b|\bto\b)\s*\{[^}]*\}/g, '')
                            .replace(/\s+/g, '');
                        if (cleaned.length > 0) allFound = false;
                        valid = allFound;
                        break;
                    }
                } catch (e) { /* 跨域 sheet 跳过 */ }
            }
            document.head.removeChild(sheet);
            return valid;
        } catch (e) { return false; }
    }

    $(document).off('click', '#mc-anim-save').on('click', '#mc-anim-save', function () {
        const types = getAnimationTypes();
        const selIdx = types.findIndex(t => t.selected);
        if (selIdx < 0) { toastr.warning('请先选择一个类型'); return; }
        const name = $('#mc-anim-name').val()?.trim();
        if (!name) { toastr.warning('请输入类型名称'); return; }
        const timing = $('#mc-anim-timing').val()?.trim();
        if (!timing) { toastr.warning('请输入缓动函数'); return; }
        if (!testTiming(timing)) { toastr.warning('缓动函数「' + timing + '」浏览器无法识别，请检查输入'); return; }
        const kf = $('#mc-anim-keyframes').val()?.trim();
        if (!kf) { toastr.warning('请输入 CSS @keyframes 关键帧内容'); return; }
        if (!testKeyframes(kf)) { toastr.warning('关键帧内容有误，浏览器无法解析，请检查语法'); return; }
        types[selIdx].name = name;
        types[selIdx].timingFunction = timing;
        types[selIdx].keyframes = kf;
        saveSettings();
        toastr.success('已保存');
        _reloadParent();
    });
}

/** 通知父级（settings-ui）重新渲染 */
function _reloadParent() {
    import('./settings-ui.js').then(m => {
        m.renderGeneralSettings();
        m.bindGeneralEvents();
    });
}
