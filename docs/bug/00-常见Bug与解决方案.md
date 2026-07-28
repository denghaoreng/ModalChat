# SillyTavern 插件开发 — 常见 Bug 与解决方案

> 来源：`MatchScoring/docs/docs-main/08-常见Bug与解决方案.md`
> 整合日期：2026年7月28日
> 面向 SillyTavern 插件开发者，基于 MatchScoring、Chat-Images、ModalChat 三个项目的实际开发经验

---

## 目录

- [B-CMN-001: 模板文件 404](#b-cmn-001-模板文件-404)
- [B-CMN-002: API 调用 403 Forbidden](#b-cmn-002-api-调用-403-forbidden)
- [B-CMN-003: 弹窗关闭后表单值丢失](#b-cmn-003-弹窗关闭后表单值丢失)
- [B-CMN-004: 动态生成的元素事件失效](#b-cmn-004-动态生成的元素事件失效)
- [B-CMN-005: 导航栏入口消失](#b-cmn-005-导航栏入口消失)
- [B-CMN-006: 流式传输中匹配不完整文本](#b-cmn-006-流式传输中匹配不完整文本)
- [B-CMN-007: 页面关闭再打开后内容丢失](#b-cmn-007-页面关闭再打开后内容丢失)
- [B-CMN-008: 图片放大交互问题](#b-cmn-008-图片放大交互问题)
- [B-CMN-009: 事件监听重复注册](#b-cmn-009-事件监听重复注册)
- [B-CMN-010: 路径大小写导致的加载失败](#b-cmn-010-路径大小写导致的加载失败)
- [B-CMN-011: 消息 ID 为 undefined，DOM 查找失败](#b-cmn-011-消息-id-为-undefineddom-查找失败)
- [B-CMN-012: onOk 回调不存在](#b-cmn-012-onok-回调不存在)
- [B-CMN-013: POPUP_TYPE 获取方式错误](#b-cmn-013-popup_type-获取方式错误)
- [B-CMN-014: async 函数未 await 导致 Promise 泄漏](#b-cmn-014-async-函数未-await-导致-promise-泄漏)
- [B-CMN-015: html() 覆盖兄弟元素](#b-cmn-015-html-覆盖兄弟元素)
- [B-CMN-016: 批量操作触发连接池耗尽](#b-cmn-016-批量操作触发连接池耗尽)
- [B-CMN-017: 级联删除遗漏](#b-cmn-017-级联删除遗漏)

---

## B-CMN-001: 模板文件 404

**现象**：`renderExtensionTemplateAsync()` 返回 404。

**根因**：路径参数必须与实际文件夹名完全一致（包括大小写）。Windows 文件系统不区分大小写，但 HTTP 服务器区分。

**解决方案**：
```javascript
// ✅ 正确
const html = await renderExtensionTemplateAsync('third-party/MatchScoring', 'settings', {});
// ❌ 错误
const html = await renderExtensionTemplateAsync('third-party/match-scoring', 'settings', {});
```

---

## B-CMN-002: API 调用 403 Forbidden

**现象**：`/api/files/upload` 或 `/api/files/delete` 返回 403。

**根因**：SillyTavern API 需要 `getRequestHeaders()` 认证头（含 CSRF token）。

**解决方案**：
```javascript
const { getRequestHeaders } = getContext();
const response = await fetch('/api/files/upload', {
    method: 'POST',
    headers: getRequestHeaders(),
    body: JSON.stringify({ name, data: base64Data }),
});
```

---

## B-CMN-003: 弹窗关闭后表单值丢失

**现象**：`callGenericPopup` 关闭后读取表单值返回 `undefined`。

**根因**：`callGenericPopup` 关闭后销毁弹窗 DOM。在 `await popup` **之后**读取表单值已无效。

**解决方案**：用 `input` 事件实时追踪：
```javascript
let formValue = '';
$(document).on('input', '#input-id', function () {
    formValue = $(this).val() || '';
});
const result = await callGenericPopup(html, POPUP_TYPE.TEXT, '', { ... });
$(document).off('input', '#input-id');
// formValue 在闭包中，弹窗关闭后仍然可用
```

---

## B-CMN-004: 动态生成的元素事件失效

**现象**：`html()` 替换 DOM 后，新元素的点击/输入事件无响应。

**根因**：直接事件绑定只在初始化时执行一次，后续 `html()` 重建 DOM 后新元素没有事件。

**解决方案**：使用事件委托：
```javascript
// ✅ 委托到稳定的父元素
$('#container').on('click', '.dynamic-btn', function () { ... });
// ❌ 直接绑定
$('.dynamic-btn').on('click', function () { ... });
```

---

## B-CMN-005: 导航栏入口消失

**现象**：导航栏插件图标消失。

**根因**：`insertBefore` + HTML 字符串在某些 jQuery 版本中行为不一致。

**解决方案**："先 append 保证出现，再 insertBefore 移动到目标位置"两步法：
```javascript
$('#top-settings-holder').append(drawerHtml);
$('#plugin-drawer').insertBefore('#user-settings-button');
```

---

## B-CMN-006: 流式传输中匹配不完整文本

**现象**：AI 流式回复时，匹配结果基于不完整的文本。

**根因**：在 `CHARACTER_MESSAGE_RENDERED` 事件中执行匹配，流式模式下文本可能尚未完整。

**解决方案**：
- `MESSAGE_RECEIVED`（文本完整）→ 执行评分/匹配
- `CHARACTER_MESSAGE_RENDERED`（DOM 就绪）→ 插入结果

---

## B-CMN-007: 页面关闭再打开后内容丢失

**现象**：关闭抽屉/页面再打开后，之前的匹配结果消失。

**根因**：`html()` 重建 DOM 时销毁了结果容器，且没有从缓存恢复。

**解决方案**：
1. 将结果面板放在不会被 `html()` 覆盖的独立容器中
2. 渲染完成后从 `getLastResults()` 恢复

---

## B-CMN-008: 图片放大交互问题

**现象**：图片放大无法关闭、不支持缩放、关闭事件穿透。

**解决方案**：
1. `stopPropagation` 覆盖 `mousedown`/`mouseup`/`click` 三个事件
2. 捕获层闭锁守卫——在隐藏 overlay 前注册 document 捕获层监听
3. 支持滚轮缩放、双击切换、双指捏合

---

## B-CMN-009: 事件监听重复注册

**现象**：每次 `bindXxxEvents()` 后，事件处理函数重复执行多次。

**根因**：每次渲染时重新绑定事件，旧监听器未被移除。

**解决方案**：使用 `$(document).off('event', selector).on('event', selector, handler)` 模式，先解绑再绑定。

---

## B-CMN-010: 路径大小写导致的加载失败

**现象**：动态 `import()` 或模板加载返回 404。

**根因**：Windows 开发环境不区分大小写，但生产环境 HTTP 服务器（Linux/macOS）区分。

**解决方案**：所有 import/require 路径与实际文件名大小写完全一致。

---

## B-CMN-011: 消息 ID 为 undefined，DOM 查找失败

**现象**：`$('.mes[mesid="..."]')` 找不到元素。

**根因**：`chat` 数组中的消息对象可能没有 `id` 字段，但 DOM 的 `mesid` 属性使用数组索引。

**解决方案**：始终用数组索引定位 DOM：
```javascript
for (let i = 0; i < chat.length; i++) {
    renderResults(i, results);  // i 是数组索引
}
```

---

## B-CMN-012: onOk 回调不存在

**现象**：`callGenericPopup` 的 `onOk` 选项不执行。

**根因**：SillyTavern 的 `callGenericPopup` 不支持 `onOk` 选项（只支持 `onClosing`、`onClose`、`onOpen`）。

**解决方案**：改用实时追踪（见 B-CMN-003）。

---

## B-CMN-013: POPUP_TYPE 获取方式错误

**现象**：控制台输出 `Unknown popup type. undefined`。

**根因**：
1. `POPUP_TYPE` 不能从 `SillyTavern.getContext()` 获取
2. `POPUP_TYPE` 的值是数字（`TEXT: 1`），不是字符串

**解决方案**：
```javascript
import { callGenericPopup, POPUP_TYPE } from '../../../popup.js';
```

---

## B-CMN-014: async 函数未 await 导致 Promise 泄漏

**现象**：URL 显示 `[object Promise]`。

**根因**：调用 `async` 函数时缺少 `await`，Promise 对象被拼接为字符串。

**解决方案**：始终 `await` async 函数调用。

---

## B-CMN-015: html() 覆盖兄弟元素

**现象**：调用 `$('#container').html(html)` 后，容器内的兄弟元素消失。

**根因**：`html()` 替换目标元素的**所有子元素**，包括不想覆盖的部分。

**解决方案**：将不相关的独立组件放在平级位置，不要嵌套在会被 `html()` 覆盖的容器内。

---

## B-CMN-016: 批量操作触发连接池耗尽

**现象**：大批量 CRUD 操作时浏览器报 `net::ERR_INSUFFICIENT_RESOURCES`。

**根因**：每个 CRUD 函数都调用 `saveSettings()`（向服务器 POST JSON），批量操作时并发请求过多。

**解决方案**：批量操作直接操作数据数组，最后只调用一次 `saveSettings()`。

---

## B-CMN-017: 级联删除遗漏

**现象**：删除父级元素后，子级数据残留。

**根因**：级联删除逻辑不完整，只删除了直接子级，遗漏了更深层的关联数据。

**解决方案**：删除前先收集所有需要删除的 ID，逐层过滤：
```javascript
const deletedRsIds = data.ruleSets.filter(rs => rs.charSetId === charSetId).map(rs => rs.id);
data.ruleSets = data.ruleSets.filter(rs => rs.charSetId !== charSetId);
data.rules = data.rules.filter(r => !deletedRsIds.includes(r.ruleSetId));
```
