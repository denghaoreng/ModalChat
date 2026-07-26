# SillyTavern 插件开发 — 常见 Bug 与解决方案

> 编写日期：2026年5月28日
> 基于 MatchScoring 和 Chat-Images 两个插件的实际开发经验总结
> 面向其他 SillyTavern 插件开发者，提供启发和参考

---

## 目录

- [B001: 模板文件 404](#b001-模板文件-404)
- [B002: API 调用 403 Forbidden](#b002-api-调用-403-forbidden)
- [B003: 弹窗关闭后表单值丢失](#b003-弹窗关闭后表单值丢失)
- [B004: 动态生成的元素事件失效](#b004-动态生成的元素事件失效)
- [B005: 导航栏入口消失](#b005-导航栏入口消失)
- [B006: 流式传输中匹配不完整文本](#b006-流式传输中匹配不完整文本)
- [B007: 抽屉关闭再打开后内容丢失](#b007-抽屉关闭再打开后内容丢失)
- [B008: 图片放大无法关闭或缩放](#b008-图片放大无法关闭或缩放)
- [B009: 事件监听重复注册](#b009-事件监听重复注册)
- [B010: 路径大小写导致的加载失败](#b010-路径大小写导致的加载失败)
- [B011: 消息 ID 为 undefined，DOM 查找失败](#b011-消息-id-为-undefineddom-查找失败)
- [B012: `onOk` 回调不存在，弹窗表单值无法读取](#b012-onok-回调不存在弹窗表单值无法读取)
- [B013: `POPUP_TYPE` 获取方式错误](#b013-popup_type-获取方式错误)

---

## B001: 模板文件 404

**现象**：`renderExtensionTemplateAsync()` 返回 404，settings.html 无法加载。

**根因**：`renderExtensionTemplateAsync` 的第一个参数是相对于 `scripts/extensions/` 的路径，**必须与实际文件夹名完全一致**（包括大小写）。例如文件夹名为 `MatchScoring`，则路径应为 `third-party/MatchScoring`，而非 `third-party/match-scoring`。

**解决方案**：
```javascript
// ✅ 正确 — 与实际文件夹名一致
const html = await renderExtensionTemplateAsync('third-party/MatchScoring', 'settings', {});

// ❌ 错误 — 与实际文件夹名不匹配
const html = await renderExtensionTemplateAsync('third-party/match-scoring', 'settings', {});
```

**经验**：Windows 文件系统不区分大小写，但 HTTP 服务器区分。路径一定要与实际文件夹名逐字匹配。

---

## B002: API 调用 403 Forbidden

**现象**：调用 `/api/files/upload` 或 `/api/files/delete` 返回 403。

**根因**：SillyTavern 的 API 接口需要认证头（含 CSRF token），使用 `FormData` 直传或缺少 `getRequestHeaders()` 会导致认证失败。

**解决方案**：
```javascript
// ✅ 正确 — 使用 SillyTavern 提供的认证头 + base64 + JSON
const { getRequestHeaders } = getContext();
const response = await fetch('/api/files/upload', {
    method: 'POST',
    headers: getRequestHeaders(),       // ← 关键：添加认证头
    body: JSON.stringify({
        name: filename,                  // 服务端文件名
        data: base64Data,                // base64 编码的文件数据
    }),
});

// ❌ 错误 — FormData 直传，缺少认证头
const formData = new FormData();
formData.append('file', file);
await fetch('/api/files/upload', { method: 'POST', body: formData });
```

**Base64 读取方法**：
```javascript
function readFileAsBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (ev) => resolve(ev.target.result.split(',')[1] || ev.target.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}
```

**给删除接口同样加上认证头**：
```javascript
const { getRequestHeaders } = getContext();
await fetch('/api/files/delete', {
    method: 'POST',
    headers: getRequestHeaders(),
    body: JSON.stringify({ path: file.path }),
});
```

---

## B003: 弹窗关闭后表单值丢失

**现象**：使用 `callGenericPopup()` 创建弹窗后，`await` 返回再读取 `$('#input').val()` 得到 `undefined`。

**根因**：`callGenericPopup` 在弹窗关闭后会**销毁其 DOM 元素**，之前获取的引用全部失效。

**解决方案**（两种方案）：

**方案一：使用 `onOk` 回调（在 DOM 销毁前执行）**
```javascript
const result = await callGenericPopup(html, POPUP_TYPE.CUSTOM, {
    okButton: '确定',
    onOk: function () {
        // 此时 DOM 尚未销毁，可以正常读取
        return $('#my-input').val() || '';
    },
});
```

**方案二：实时追踪表单值到变量**
```javascript
let myValue = '';
$(document).on('input', '#my-input', function () {
    myValue = $(this).val() || '';
});

const result = await callGenericPopup(html, POPUP_TYPE.CUSTOM, { ... });

// 清理事件监听
$(document).off('input', '#my-input');

// 使用变量中的值
if (result) console.log(myValue);
```

---

## B004: 动态生成的元素事件失效

**现象**：通过 `.html()` 或 `innerHTML` 刷新 DOM 后，之前用 `$(element).on('click', handler)` 绑定的点击事件不生效。

**根因**：直接绑定只对**当前存在的元素**生效。`html()` 替换 DOM 后，新元素上没有事件监听。

**解决方案**：使用**事件委托**，将监听器绑定到稳定的父元素上。
```javascript
// ❌ 错误 — 直接绑定，刷新后失效
$('.my-button').on('click', handler);

// ✅ 正确 — 事件委托到父容器
$('#my-container').on('click', '.my-button', handler);

// ✅ 更新 DOM 后无需重新绑定
$('#my-container').html(newHtml);
```

---

## B005: 导航栏入口消失

**现象**：插件抽屉按钮添加到导航栏后，偶尔不显示。

**根因**：单步插入操作（`insertBefore` + HTML 字符串）在某些情况下不稳定。目标元素可能在插件初始化时尚未就绪。

**解决方案**：采用**两步法**——先 `append` 保证出现，再 `insertBefore` 移动到目标位置。
```javascript
// ✅ 两步法：先追加保证出现，再移动到目标位置
$('#top-settings-holder').append(drawerHtml);
$('#my-drawer').insertBefore('#user-settings-button');
```

---

## B006: 流式传输中匹配不完整文本

**现象**：AI 回复使用流式传输时，在消息未完全生成前执行匹配，导致匹配结果不准确。

**根因**：`CHARACTER_MESSAGE_RENDERED` 在流式传输中可能触发时文本尚未完整。

**解决方案**：分离评分和 DOM 插入的时机。
```javascript
const { eventSource, event_types } = getContext();

// ⭐ 评分：在 MESSAGE_RECEIVED 时执行（文本已完整保存到 chat）
eventSource.on(event_types.MESSAGE_RECEIVED, function (data) {
    // 此时 chat 中的消息文本是完整的
    const { chat } = getContext();
    const fullText = chat[chat.length - 1].mes;
    const results = doScoring(fullText);
    cacheResults(results);
});

// ⭐ DOM 插入：在 CHARACTER_MESSAGE_RENDERED 时执行（DOM 已就绪）
eventSource.on(event_types.CHARACTER_MESSAGE_RENDERED, function (data) {
    const cached = getCachedResults();
    if (cached) insertIntoDOM(data.id, cached);
});
```

**事件时序**：
```
GENERATION_ENDED → MESSAGE_RECEIVED(文本完整) → CHARACTER_MESSAGE_RENDERED(DOM就绪)
```

---

## B007: 抽屉关闭再打开后内容丢失

**现象**：导航栏抽屉关闭后重新打开，之前的数据（如匹配结果）消失。

**根因**：抽屉的 `openDrawer/closedDrawer` 切换时，插件通常重新渲染面板 HTML，导致数据丢失。

**解决方案**：使用内存缓存，在重新渲染面板时恢复缓存的数据。
```javascript
// 评分时缓存结果
let cachedResults = null;

function onNewResults(results) {
    cachedResults = results;
    renderPanel(); // 渲染面板时使用缓存
}

function renderPanel() {
    // ... 渲染 HTML ...
    if (cachedResults) {
        renderResultsList(cachedResults);
    }
}
```

---

## B008: 图片放大无法关闭或缩放

**现象**：全屏放大图片后，点击背景无法关闭，也无法缩放。

**根因**：
1. 容器元素（`imgContainer`）使用 `width:100%;height:100%` 撑满遮罩层，导致点击事件被容器截获，遮罩层的 click 监听器收不到事件
2. 缺少滚轮/触摸缩放和平移逻辑

**解决方案**：
1. 在容器和遮罩层上都注册关闭监听
2. 添加完整的缩放交互：滚轮缩放、拖拽平移、双击切换、双指捏合
3. 添加右上角关闭按钮和 Esc 快捷键

```javascript
// 关闭方式：遮罩层、空白容器区、关闭按钮、Esc 键
overlay.addEventListener('click', function (e) {
    if (e.target === overlay) close();
});
imgContainer.addEventListener('click', function (e) {
    if (e.target === imgContainer && scale <= 1) close();
});
closeBtn.addEventListener('click', close);
window.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') close();
});
```

---

## B009: 事件监听重复注册

**现象**：插件启用/禁用多次后，同一个事件回调被多次触发。

**根因**：`eventSource.on()` 每次调用都会添加监听，不检查是否已存在。启用禁用再启用时，旧的监听残留。

**解决方案**：在注册前先移除旧监听。
```javascript
function registerEventListeners() {
    // 先移除旧监听，防止重复注册
    eventSource.removeListener(event_types.MESSAGE_RECEIVED, onMessageReceived);
    eventSource.removeListener(event_types.CHAT_CHANGED, onChatChanged);

    // 再注册新监听
    eventSource.on(event_types.MESSAGE_RECEIVED, onMessageReceived);
    eventSource.on(event_types.CHAT_CHANGED, onChatChanged);
}
```

---

## B010: 路径大小写导致的加载失败

**现象**：`import` 语句或 API 路径正确，但文件仍然 404。

**根因**：虽然 Windows 文件系统不区分大小写，但 **SillyTavern 的 HTTP 服务器**在某些配置下是区分大小写的。且 `import` 语句在浏览器中解析时，URL 路径也区分大小写。

**解决方案**：所有路径引用（import、模板路径、API 路径、CSS/JS 引用）都保持与实际文件系统**完全一致的大小写**。
```javascript
// ❌ 错误 — 大小写不匹配
import { ... } from './Data.js';     // 实际文件是 data.js

// ✅ 正确 — 大小写完全一致
import { ... } from './data.js';     // 匹配实际文件名
```

---

## B011: 消息 ID 为 undefined，DOM 查找失败

**现象**：在多条聊天消息中插入匹配结果后，刷新页面重新加载，只有最后一条消息的结果显示在正确位置，其余结果全部堆积到最后一条消息中。

**根因**：通过日志发现，`chat` 数组中所有消息对象的 `id` 字段均为 `undefined`。但 DOM 元素的 `mesid` 属性使用的是消息在数组中的**索引**而非 `msg.id`。恢复时用 `msg.id`（`undefined`）去查 `.mes[mesid="undefined"]` 全部失败，所有结果都通过降级逻辑插入到最后一条消息中。

**解决方案**：遍历 chat 数组时使用数组索引作为消息标识，而非 `msg.id`。

```javascript
// ❌ 错误 — msg.id 是 undefined，无法定位 DOM
for (const msg of chat) {
    renderChatResults(msg.id, results);
}

// ✅ 正确 — 使用数组索引 i 作为 DOM 的 mesid
for (let i = 0; i < chat.length; i++) {
    renderChatResults(i, results);
}
```

**经验**：不要假设 `msg.id` 一定存在。SillyTavern 某些版本的消息对象可能没有 `id` 字段。始终优先使用数组索引进行 DOM 定位，`mesid` 属性绑定的是数组索引。

---

## B012: `onOk` 回调不存在，弹窗表单值无法读取

**现象**：自定义弹窗中使用 `onOk` 回调读取表单值，但无论如何都读不到用户输入的内容。

**根因**：查阅 SillyTavern 源码发现，`callGenericPopup` 的 `options` 参数中**没有 `onOk` 字段**。有效的回调只有 `onClosing`、`onClose`、`onOpen`。

```javascript
// SillyTavern 的 PopupOptions 类型定义（节选）：
@param onClosing - 弹窗关闭前调用，返回 false 可阻止关闭
@param onClose   - 弹窗关闭后、DOM 清理前调用
@param onOpen    - 弹窗打开后调用
// 注意：没有 onOk！
```

**解决方案**：使用**实时追踪**方式替代 `onOk`。在弹窗打开前绑定 `input` 事件，持续追踪表单值到变量中。弹窗关闭后变量值仍然可用。

```javascript
// ✅ 正确 — 实时追踪表单值
let myValue = '';

// 弹窗前绑定
$(document).on('input', '#my-input', function () {
    myValue = $(this).val() || '';
});

const result = await callGenericPopup(html, POPUP_TYPE.TEXT, '', {
    okButton: '保存',
    cancelButton: '取消',
});

// 弹窗后清理
$(document).off('input', '#my-input');

if (result) {
    // myValue 仍然可用，DOM 已销毁但值在闭包中
    saveData(myValue);
}

// ❌ 错误 — onOk 不存在，永远不会执行
const result = await callGenericPopup(html, POPUP_TYPE.TEXT, '', {
    onOk: function () {  // ← 这个回调永远不会被调用！
        myValue = $('#my-input').val();
    },
});
```

**经验**：不要假设 `onOk` 存在。SillyTavern 的 `callGenericPopup` 没有这个回调。始终用 `input` 事件实时追踪表单值。

---

## B013: `POPUP_TYPE` 获取方式错误

**现象**：`POPUP_TYPE.CUSTOM` 报 "Unknown popup type"。

**根因**：有两个问题叠加：

1. **`POPUP_TYPE` 不能从 `SillyTavern.getContext()` 获取**。该对象不在 Context 上，需要使用 import 或本地常量定义。

2. **`POPUP_TYPE` 的值是数字，不是字符串**。从源码看：
```javascript
// SillyTavern 源码中 POPUP_TYPE 的定义：
export const POPUP_TYPE = {
    TEXT: 1,        // ← 数字 1，不是字符串 'text'
    CONFIRM: 2,     // ← 数字 2
    INPUT: 3,       // ← 数字 3
    DISPLAY: 4,     // ← 数字 4
};
```

3. **不存在 `CUSTOM` 类型**。自定义 HTML 内容使用 `TEXT` 类型即可。

**解决方案**：
```javascript
// 方案一：从 popup.js 导入（推荐，与官方一致）
import { callGenericPopup, POPUP_TYPE } from '../../../popup.js';

// 方案二：本地定义常量（避免导入问题）
const POPUP_TYPE = Object.freeze({
    TEXT: 1,        // ← 注意是数字，不是字符串！
    CONFIRM: 2,
    INPUT: 3,
    DISPLAY: 4,
});

// ❌ 错误 — SillyTavern.getContext() 取不到 POPUP_TYPE
const { POPUP_TYPE } = SillyTavern.getContext();  // POPUP_TYPE 是 undefined

// ❌ 错误 — 值必须是数字
const POPUP_TYPE = { TEXT: 'text' };  // 'text' 会导致 Unknown popup type

// ✅ 正确用法
const result = await callGenericPopup(html, POPUP_TYPE.TEXT, '', {
    okButton: '保存',
    cancelButton: '取消',
});
```

**经验**：当某个 API 的行为与预期不符时，直接查看源码是最快的方式。`public/scripts/popup.js` 中明确定义了 `POPUP_TYPE` 和 `callGenericPopup` 的完整接口。

---

## 通用建议

1. **优先使用 `getContext()`** 而非直接 import 内部模块，Context API 更稳定
2. **事件委托**是处理动态 DOM 的核心模式
3. **两步法**插入导航栏，避免入口消失
4. **流式传输**场景下，评分和 DOM 插入分离
5. **内存缓存**解决抽屉重开后的数据恢复问题
6. **记录 Bug 和解决方案**，相同的问题不要犯第二次
7. **用数组索引定位消息 DOM** — SillyTavern 的 `msg.id` 可能为 `undefined`，DOM `mesid` 用数组索引，别依赖 `msg.id`
