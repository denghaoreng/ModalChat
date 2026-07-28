// popup/regex-help.js — 正则手册弹窗

import { callGenericPopup, POPUP_TYPE } from '../../../../../popup.js';

export function showRegexHelp() {
    const helpHtml = `
    <style>
        .mc-regex-help-table { width:100%; border-collapse: collapse; margin:6px 0; font-size:0.9em; }
        .mc-regex-help-table th, .mc-regex-help-table td { border:1px solid var(--borderColor); padding:6px 8px; text-align:left; }
        .mc-regex-help-table th { background:var(--white30); font-weight:600; }
        .mc-regex-help-table td:first-child { font-family:monospace; white-space:nowrap; color:var(--primary); font-weight:bold; }
        .mc-regex-help-code { background:var(--white30); padding:1px 5px; border-radius:3px; font-family:monospace; font-size:0.9em; }
        .mc-regex-help-note { background:var(--white15); border-left:3px solid var(--primary); padding:8px 12px; margin:8px 0; border-radius:0 4px 4px 0; font-size:0.88em; }
        .mc-regex-help-title { font-size:1.1em; font-weight:bold; margin:12px 0 6px 0; padding-bottom:4px; border-bottom:1px solid var(--borderColor); }
    </style>
    <div style="padding:4px 8px;font-size:0.92em;line-height:1.6;">
        <p>本插件的正则匹配基于 JavaScript <span class="mc-regex-help-code">RegExp</span> 引擎，匹配时自动添加 <span class="mc-regex-help-code">gi</span> 标志。</p>
        <div class="mc-regex-help-title">📖 基本用法</div>
        <p>在规则的"正则"输入框中输入模式，插件会用它对 AI 回复的文本进行匹配。如果匹配成功，则按权重随机选中一张绑定的图片插入到聊天中。</p>
        <div class="mc-regex-help-note"><strong>💡 示例：</strong>输入 <span class="mc-regex-help-code">微笑|开心|高兴</span>，当 AI 回复中包含"微笑"、"开心"或"高兴"时触发。</div>

        <div class="mc-regex-help-title">🔤 直接量字符</div>
        <table class="mc-regex-help-table">
            <tr><th>模式</th><th>说明</th><th>匹配示例</th></tr>
            <tr><td>hello</td><td>直接匹配字符串 "hello"</td><td>"hello world" ✓</td></tr>
            <tr><td>攻击</td><td>直接匹配中文字符 "攻击"</td><td>"发动攻击" ✓</td></tr>
        </table>

        <div class="mc-regex-help-title">🎯 特殊字符（需要转义）</div>
        <table class="mc-regex-help-table">
            <tr><th>字符</th><th>含义</th><th>转义写法</th></tr>
            <tr><td>.</td><td>匹配任意单个字符</td><td>\\.</td></tr>
            <tr><td>*</td><td>前一个字符重复 0 次或多次</td><td>\\*</td></tr>
            <tr><td>+</td><td>前一个字符重复 1 次或多次</td><td>\\+</td></tr>
            <tr><td>?</td><td>前一个字符出现 0 次或 1 次</td><td>\\?</td></tr>
            <tr><td>{ }</td><td>量词：指定重复次数</td><td>\\{ \\}</td></tr>
            <tr><td>( )</td><td>分组/捕获</td><td>\\( \\)</td></tr>
            <tr><td>[ ]</td><td>字符集</td><td>\\[ \\]</td></tr>
            <tr><td>|</td><td>或</td><td>\\|</td></tr>
            <tr><td>^ $</td><td>开头/结尾断言</td><td>\\^ \\$</td></tr>
            <tr><td>\\</td><td>转义符本身</td><td>\\\\</td></tr>
        </table>

        <div class="mc-regex-help-title">📏 量词</div>
        <table class="mc-regex-help-table">
            <tr><th>模式</th><th>说明</th><th>示例</th></tr>
            <tr><td>*</td><td>0 次或多次</td><td>ab*c → "ac","abc"</td></tr>
            <tr><td>+</td><td>1 次或多次</td><td>ab+c → "abc","abbc"</td></tr>
            <tr><td>?</td><td>0 次或 1 次</td><td>ab?c → "ac","abc"</td></tr>
            <tr><td>{n}</td><td>精确重复 n 次</td><td>a{3} → "aaa"</td></tr>
            <tr><td>{n,}</td><td>至少重复 n 次</td><td>a{2,} → "aa","aaa"...</td></tr>
            <tr><td>{n,m}</td><td>重复 n 到 m 次</td><td>a{2,4} → "aa","aaa","aaaa"</td></tr>
        </table>

        <div class="mc-regex-help-title">🔗 常用特殊模式</div>
        <table class="mc-regex-help-table">
            <tr><th>模式</th><th>说明</th><th>示例</th></tr>
            <tr><td>.</td><td>匹配任意单个字符（除换行）</td><td>h.t → "hat","hot"</td></tr>
            <tr><td>\\d</td><td>匹配一个数字</td><td>\\d{3} → "123"</td></tr>
            <tr><td>\\w</td><td>匹配字母/数字/下划线</td><td>\\w+ → "hello_123"</td></tr>
            <tr><td>\\s</td><td>匹配空白字符</td><td>—</td></tr>
        </table>

        <div class="mc-regex-help-title">🎭 字符集</div>
        <table class="mc-regex-help-table">
            <tr><th>模式</th><th>说明</th><th>示例</th></tr>
            <tr><td>[abc]</td><td>匹配 a/b/c 中的任意一个</td><td>b[ae]t → "bat","bet"</td></tr>
            <tr><td>[a-z]</td><td>匹配 a 到 z 的小写字母</td><td>[a-z]+ → "hello"</td></tr>
            <tr><td>[0-9]</td><td>匹配任意数字</td><td>[0-9]{2} → "42"</td></tr>
            <tr><td>[^abc]</td><td>取反</td><td>[^0-9] → 匹配非数字</td></tr>
            <tr><td>[\\u4e00-\\u9fff]</td><td>匹配汉字</td><td>→ "你好世界"</td></tr>
        </table>

        <div class="mc-regex-help-title">🔀 分组与逻辑</div>
        <table class="mc-regex-help-table">
            <tr><th>模式</th><th>说明</th><th>示例</th></tr>
            <tr><td>AB|CD</td><td>或：匹配 AB 或 CD</td><td>攻击|防守</td></tr>
            <tr><td>(abc)</td><td>分组</td><td>(哈){3} → "哈哈哈"</td></tr>
        </table>

        <div class="mc-regex-help-title">📍 位置断言</div>
        <table class="mc-regex-help-table">
            <tr><th>模式</th><th>说明</th><th>示例</th></tr>
            <tr><td>^</td><td>字符串开头</td><td>^你好 → 以"你好"开头</td></tr>
            <tr><td>$</td><td>字符串结尾</td><td>世界$ → 以"世界"结尾</td></tr>
        </table>

        <div class="mc-regex-help-title">🔍 实用组合示例</div>
        <table class="mc-regex-help-table">
            <tr><th>目的</th><th>正则</th><th>说明</th></tr>
            <tr><td>匹配多个关键词</td><td>微笑|开心|高兴|快乐</td><td>任一关键词出现即触发</td></tr>
            <tr><td>匹配复合情绪</td><td>既.*又|一边.*一边</td><td>同时做两件事</td></tr>
            <tr><td>匹配程度描述</td><td>很|非常|极其|特别|十分</td><td>程度副词触发</td></tr>
            <tr><td>匹配动作+对象</td><td>(拿起|举起|握紧).*(剑|刀|武器)</td><td>拿起武器相关动作</td></tr>
            <tr><td>匹配省略号结尾</td><td>…+$</td><td>以省略号结尾的句子</td></tr>
            <tr><td>匹配夸赞</td><td>真(棒|好|厉害|美|漂亮)</td><td>夸奖类表达</td></tr>
        </table>
    </div>`;

    callGenericPopup(helpHtml, POPUP_TYPE.TEXT, '', {
        okButton: '关闭',
        allowVerticalScrolling: true,
        wide: true,
    });
}
