# ModalChat 插件 — Bug 修复总结

> 编写日期：2026年7月28日
> 记录 ModalChat 重构过程中遇到的 Bug、根因分析及解决方案

---

## 目录

- [MC-B001: [object Promise] 图片 URL](#mc-b001-object-promise-图片-url)
- [MC-B002: chatImagesCleanupStaleImage 未定义](#mc-b002-chatimagescleanupstaleimage-未定义)
- [MC-B003: 轮播设置面板打不开](#mc-b003-轮播设置面板打不开)
- [MC-B004: 结果排名被文件列表覆盖](#mc-b004-结果排名被文件列表覆盖)
- [MC-B005: 聊天图片结果未持久化](#mc-b005-聊天图片结果未持久化)
- [MC-B006: 首次滑动旧图片残留](#mc-b006-首次滑动旧图片残留)
- [MC-B007: 批量复制报连接池耗尽](#mc-b007-批量复制报连接池耗尽)
- [MC-B008: 角色集删除时图片漏删](#mc-b008-角色集删除时图片漏删)
- [MC-B009: "未绑定"筛选不到](#mc-b009-未绑定筛选不到)
- [MC-B010: 正则帮助弹窗 404](#mc-b010-正则帮助弹窗-404)

---

## MC-B001: [object Promise] 图片 URL

**发现时间：** 2026-07-28
**严重程度：** 🔴 高（图片完全无法显示）

### 现象
浏览器控制台报错：
```
GET http://127.0.0.1:8000/[object%20Promise] 404 (Not Found)
```
聊天图片显示为裂图。

### 根因分析
`nav-chat-images/matcher/single-rule.js` 中调用 `getFileUrl(selected.registry)`，但 `getFileUrl` 是 `async function`，返回的是 `Promise` 对象。缺少 `await` 导致 Promise 被拼入模板字符串变为字符串 `"[object Promise]"`，用作图片 URL。

```javascript
// 错误写法
url: getFileUrl(selected.registry),  // ← 返回 Promise，不是 URL 字符串

// 正确写法
url: await getFileUrl(selected.registry),
```

### 修复方案
在 `single-rule.js` 的 `matchSingleRule` 函数中，给 `getFileUrl` 调用加上 `await`。

### 涉及文件
- `nav-chat-images/matcher/single-rule.js`

---

## MC-B002: chatImagesCleanupStaleImage 未定义

**发现时间：** 2026-07-28
**严重程度：** 🔴 高（图片加载失败时 JS 报错）

### 现象
```
Uncaught ReferenceError: chatImagesCleanupStaleImage is not defined
    at HTMLImageElement.onerror
```

### 根因分析
`nav-chat-images/matcher/queue.js` 中图片的 `onerror` 处理引用了全局函数 `chatImagesCleanupStaleImage`，但该函数在任何模块中都没有定义。可能是旧代码遗留的引用。

### 修复方案
将 `onerror` 改为内联移除：
```javascript
onerror="this.closest('.chat-image-queued')?.remove()"
```

### 涉及文件
- `nav-chat-images/matcher/queue.js`

---

## MC-B003: 轮播设置面板打不开

**发现时间：** 2026-07-28
**严重程度：** 🔴 高（功能无法使用）

### 现象
点击"轮播设置"标签页，面板无内容显示。

### 根因分析
`nav-chat-images/ui/index.js` 中 `.mc-ci-tab` 的点击处理函数没有 `await renderChatImages()`。由于 `renderChatImages()` 是 `async` 函数，内部有 `await renderSubTabContent()`，`$panel.html()` 在 async 操作完成后才执行。但 `renderCarouselSettings()`（负责填充轮播设置内容）在同步代码中立即执行，此时 `#mc-ci-content` DOM 节点尚未创建。

```javascript
// 错误写法
$(document).on('click', '.mc-ci-tab', function () {
    lastSubTab = $(this).data('ci-tab');
    renderChatImages();          // async，返回 Promise
    bindChatImagesEvents();
    if (lastSubTab === 'carousel') renderCarouselSettings(); // #mc-ci-content 还不存在
});

// 正确写法
$(document).on('click', '.mc-ci-tab', async function () {
    lastSubTab = $(this).data('ci-tab');
    await renderChatImages();     // 等待 DOM 构建完成
    bindChatImagesEvents();
    if (lastSubTab === 'carousel') renderCarouselSettings();
});
```

### 修复方案
将 tab 点击处理函数改为 `async`，并 `await renderChatImages()`。

### 涉及文件
- `nav-chat-images/ui/index.js`

---

## MC-B004: 结果排名被文件列表覆盖

**发现时间：** 2026-07-28
**严重程度：** 🔴 高（结果面板不可见）

### 现象
匹配打分下的"当前匹配结果"排名区域消失。

### 根因分析
`nav-match-scoring/drawer.js` 中 `#mc-ms-results-panel`（结果排名）嵌套在 `#mc-ms-files-panel` 内部。当 `renderFileDisplay()` 执行 `$('#mc-ms-files-panel').html(html)` 时，覆盖了整个面板，内部的结果排名 DOM 被销毁。

### 修复方案
将 `#mc-ms-results-panel` 从 `#mc-ms-files-panel` 内部移至平级位置。更新 `switchSubTab()` 使其在显示"文件展示"标签时同时显示结果面板。

### 经验教训
动态内容面板应避免嵌套在会被 `html()` 整体替换的容器内。

### 涉及文件
- `nav-match-scoring/drawer.js`

---

## MC-B005: 聊天图片结果未持久化

**发现时间：** 2026-07-28
**严重程度：** 🔴 高（退出聊天再进入后历史结果丢失）

### 现象
聊天图片匹配结果在退出聊天再进入后消失。

### 根因分析
两个问题叠加：

1. **缺少 `saveChat()`**：`persistCIResults` 只修改了内存中的 `chat.extra`，但没有调 `saveChat()` 写入磁盘。
2. **数据结构不一致**：持久化时把数据拍平成 `{ url, name }`，但 `renderCIResults` 期望 `{ image: { url, name } }`。恢复时 `item.image?.url` 为 `undefined`，图片没有渲染。

### 修复方案
1. 在 `persistCIResults` 后调用 `saveChatDebounced()`
2. 保持嵌套结构 `{ image: { url, name } }` 持久化

### 涉及文件
- `shell/message-handler.js`
- `nav-chat-images/carousel/persist.js`

---

## MC-B006: 首次滑动旧图片残留

**发现时间：** 2026-07-28
**严重程度：** 🟡 中

### 现象
打开聊天会话后，对最后一条结果进行**第一次**滑动时，旧图片残留，第二次滑动正常。

### 根因分析
聊天加载时 `onChatChanged` 清空了 `_mc_lastMesText = {}`，但 `onChatLoaded` 恢复历史消息后**没有**重新填充缓存。首次滑动时 `prevText` 为 `undefined`，永远不等于 `currentText`，导致 `isNew=true`，触发不必要的重新匹配。这次匹配的渲染结果后续又被真正生成完成后的 `MESSAGE_RECEIVED` 结果覆盖，造成视觉上的残留。

```
日志证实：
[MC-SWIPE] phase:start
  prevText: null           ← _mc_lastMesText[4] 从未被设置
  currentText: "文本..."
  isNew: true              ← null !== "文本" → 误判为新文本
  restoredMsResults: true  ← 消息是从历史恢复的
```

### 修复方案
在 `onChatLoaded` 中遍历所有 AI 消息，将其文本缓存到 `_mc_lastMesText`，使首次滑动时 `prevText === currentText`。

### 涉及文件
- `shell/message-handler.js`

---

## MC-B007: 批量复制报连接池耗尽

**发现时间：** 2026-07-28
**严重程度：** 🔴 高（大批量复制时浏览器拒绝请求）

### 现象
```
POST http://127.0.0.1:8000/api/files/upload net::ERR_INSUFFICIENT_RESOURCES
```
复制包含多条规则和图片引用的规则集时触发。

### 根因分析
三个复制处理器（角色集/规则集/规则）都通过 `addRule()` / `addImageToRule()` / `addCharSet()` 等逐个保存的 CRUD 函数操作数据。每个函数都调用一次 `saveSettings()`，后者向服务器 POST JSON 文件。复制 5 条规则 × 3 张图片 = 21 次 POST，超出浏览器连接池限制。

### 修复方案
重写三个复制处理器，直接操作数据数组（push 到 `data.rules` / `data.ruleSets` / `data.charSets`），使用 `generateId()` 生成新 ID，最后只调用一次 `saveSettings()`。

### 涉及文件
- `nav-chat-images/ui/index.js`

---

## MC-B008: 角色集删除时图片漏删

**发现时间：** 2026-07-28
**严重程度：** 🔴 高（数据脏数据残留）

### 现象
删除角色集后，其下的规则（图片）仍然保留在数据中。

### 根因分析
`domain/char-sets.js` 的 `deleteCharSet()` 级联删除了角色集和对应的规则集（`ruleSets`），但**没有**删除指向这些规则集的规则（`rules`）。

```javascript
// 修复前——漏掉了 rules
export function deleteCharSet(id) {
    d().charSets = d().charSets.filter(c => c.id !== id);
    d().ruleSets = d().ruleSets.filter(rs => rs.charSetId !== id);
    saveSettings();
}
```

### 修复方案
先收集被删规则集的 ID，再过滤掉指向这些 ID 的规则。

### 涉及文件
- `nav-chat-images/domain/char-sets.js`

---

## MC-B009: "未绑定"筛选不到

**发现时间：** 2026-07-28
**严重程度：** 🟡 中

### 现象
规则列表中"未绑定"标签显示但筛选无效。

### 根因分析
标签显示"未绑定"有两种情况：
1. 规则真的没有 `ruleSetId`（空字符串）
2. 规则有 `ruleSetId`，但对应的规则集已被删除，`rs` 查找失败

原来的筛选 `rules.filter(r => !r.ruleSetId)` 只筛出情况 1，筛不到情况 2。但两种情况用户看到的都是"未绑定"标签。

### 修复方案
筛选时同时检查 `ruleSetId` 是否仍存在于有效的规则集列表中：
```javascript
const validRsIds = new Set(ruleSets.map(rs => rs.id));
rules = rules.filter(r => !r.ruleSetId || !validRsIds.has(r.ruleSetId));
```

规则集的角色集筛选同理修复。

### 涉及文件
- `nav-chat-images/ui/rules.js`
- `nav-chat-images/ui/rule-sets.js`

---

## MC-B010: 正则帮助弹窗 404

**发现时间：** 2026-07-28
**严重程度：** 🔴 高（弹窗无法打开）

### 现象
```
GET http://127.0.0.1:8000/popup.js net::ERR_ABORTED 404
TypeError: Failed to fetch dynamically imported module
```

### 根因分析
`nav-chat-images/popup/regex-help.js` 中导入 `callGenericPopup` 的路径 `../../../../../../popup.js` 层级错误（6 层 `../`），实际应为 `../../../../../popup.js`（5 层）。同目录的 `batch.js` 使用了正确的路径。

### 修复方案
修正导入路径为 `../../../../../popup.js`。

### 涉及文件
- `nav-chat-images/popup/regex-help.js`

---

## 统计

| 严重程度 | 数量 | 编号 |
|---------|------|------|
| 🔴 高 | 8 | MC-B001, MC-B002, MC-B003, MC-B004, MC-B005, MC-B007, MC-B008, MC-B010 |
| 🟡 中 | 2 | MC-B006, MC-B009 |
