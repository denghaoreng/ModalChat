# MatchScoring 插件 — Bug 修复总结

> 来源：`MatchScoring/docs/match/09-Bug修复总结.md`
> 整合日期：2026年7月28日

---

## B-MS-001: settings.html 加载 404

**严重程度：** 🔴 高

### 现象
`GET /scripts/extensions/third-party/match-scoring/settings.html 404`

### 根因
`renderExtensionTemplateAsync('third-party/match-scoring', ...)` 路径小写+连字符，但实际文件夹名 `MatchScoring` 大写。HTTP 服务器区分大小写。

### 修复
将路径参数改为与实际文件夹名一致。

---

## B-MS-002: 文件上传 403 Forbidden

**严重程度：** 🔴 高

### 现象
`POST /api/files/upload 403`

### 根因
使用 `FormData` 方式上传，没有携带 SillyTavern 要求的 CSRF token。

### 修复
改用 `getRequestHeaders()` + base64 + JSON 格式。

---

## B-MS-003: 文件删除 403 Forbidden

**严重程度：** 🔴 高

### 现象
`POST /api/files/delete 403`

### 根因
与上传相同——缺少认证头。

### 修复
使用 `getRequestHeaders()`。

---

## B-MS-004: 文件名展示混乱（服务器名 vs 展示名）

**严重程度：** 🟡 中

### 现象
UI 中展示的是服务器存储用的乱码文件名。

### 根因
没有区分"服务器存储名"和"用户展示名"两个概念。

### 修复
新增独立的 `displayName` 字段，与 `filename`（服务器名）和 `originalName`（原始文件名）彻底分离。

---

## B-MS-005: 文件名命名规则不统一

**严重程度：** 🟢 低

### 现象
服务器文件名可读性差，风格不一致。

### 修复
统一采用 `前缀_年月日_时分秒_4位随机数` 格式。

---

## B-MS-006: 抽屉关闭再打开后匹配结果消失

**严重程度：** 🟡 中

### 现象
关闭抽屉再打开，"当前匹配结果"区域消失。

### 根因
`renderFilesTab()` 通过 `$panel.html()` 重建整个面板，销毁了结果面板 DOM。

### 修复
`renderFilesTab()` 执行完毕后从 `getLastResults()` 获取缓存结果并重新渲染。

---

## B-MS-007: 流式传输中评分不准确

**严重程度：** 🔴 高

### 现象
流式传输时匹配结果不准确，在文本未完整时就执行了评分。

### 根因
在 `CHARACTER_MESSAGE_RENDERED` 事件中同时执行评分和 DOM 插入，流式模式下文本可能尚未完整。

### 修复
将评分和 DOM 插入分离：`MESSAGE_RECEIVED`（文本完整）执行评分，`CHARACTER_MESSAGE_RENDERED`（DOM 就绪）插入结果。

---

## B-MS-008: 匹配结果未插入 AI 聊天气泡

**严重程度：** 🔴 高

### 现象
评分结果显示在抽屉面板中，但没有插入到聊天气泡里。

### 根因
1. `CHARACTER_MESSAGE_RENDERED` 触发时 DOM 可能未就绪
2. 消息 ID 类型不匹配导致选择器找不到元素
3. 插入位置选择器与实际 DOM 结构有偏差

### 修复
1. `setTimeout(200ms)` 确保 DOM 就绪
2. 多级降级查找（先用 `mesid` → 失败取最后一条非 user 消息）
3. 多级插入位置（`mes_media_wrapper` → `mes_text` 后 → `mes_content`）

---

## B-MS-009: 图片放大无法关闭

**严重程度：** 🟡 中

### 根因
`imgContainer` 撑满 `overlay`，点击"空白区域"实际点在了 `imgContainer` 上。

### 修复
增加三种关闭方式：右上角关闭按钮、点击遮罩背景（`e.target === overlay`）、Esc 键。

---

## B-MS-010: 图片放大不支持缩放

**严重程度：** 🟡 中

### 修复
添加完整缩放交互：滚轮缩放、拖拽平移、双击切换、双指捏合。

---

## B-MS-011: 消息 ID 为 undefined 导致恢复时全部插错位置

**严重程度：** 🔴 高

### 现象
刷新页面后恢复历史消息时，所有结果堆叠到最后一条消息。

### 根因
`chat` 数组中 `msg.id` 为 `undefined`，使用 `msg.id` 定位 DOM 全部失败，降级逻辑取最后一条 `.mes` 导致所有结果插入同一气泡。

### 修复
遍历 chat 数组时用**数组索引** `i` 而非 `msg.id`。

**经验教训：** SillyTavern 的消息对象可能没有 `id` 字段，DOM 上 `mesid` 属性绑定的是数组索引，始终用索引定位。

---

## B-MS-012: onOk 回调不存在导致弹窗表单值无法保存

**严重程度：** 🔴 高

### 根因
`onOk` 不是 SillyTavern `callGenericPopup` 支持的选项。

### 修复
用实时追踪方式替代：`input` 事件持续更新闭包变量，弹窗关闭后从闭包读取。

---

## B-MS-013: POPUP_TYPE 获取方式错误

**严重程度：** 🔴 高

### 根因
1. `POPUP_TYPE` 不能从 `getContext()` 获取
2. `POPUP_TYPE` 的值是数字（`TEXT: 1`），不能设为字符串

### 修复
从 `popup.js` 直接导入 `{ callGenericPopup, POPUP_TYPE }`。

---

## B-MS-014: chat-images 缺少图片尺寸与背景设置界面

**严重程度：** 🟡 中

（此 Bug 在独立 chat-images 插件中修复，ModalChat 中已通过通用配置 UI 解决）

---

## B-MS-015: chat-images 图片框未正确居中

**严重程度：** 🟡 中

（此 Bug 在独立 chat-images 插件中修复，ModalChat 的轮播渲染已用 flex 居中）

---

## B-MS-016: chat-images 滑动/重新生成时旧图片残留

**严重程度：** 🔴 高

### 现象
滑动切换回复时，旧图片继续显示在新消息中。

### 根因
没有区分"缓存回复"（来自历史记录）和"新生成回复"（需要重新匹配）。

### 修复
通过文本内容比较来判断：记录上一次消息文本，滑动时比较当前文本与上一次的差异。

---

## B-MS-017: chat-images 切换聊天时定时器未清理

**严重程度：** 🟡 中

### 根因
`CHAT_CHANGED` 事件中没有调用 `clearAllImageTimers()`。

### 修复
在 `CHAT_CHANGED` 处理中增加定时器清理。

---

## B-MS-018: MatchScoring 匹配结果未居中

**严重程度：** 🟢 低

### 修复
添加 flex 居中样式。

---

## B-MS-019: MatchScoring 滑动/重新生成匹配结果残留

**严重程度：** 🔴 高

### 根因
与 B-MS-016 相同——通过文本比较区分缓存回复与新生成。

### 修复
同步 B-MS-016 的修复策略。

---

## B-MS-020: 评分算法密度归一化不合理

**严重程度：** 🟡 中

### 根因
最初用 `Math.pow(内容长度, 1/4) / 2` 作为归一化因子，过于依赖文件长度而非匹配密度。

### 修复
改为基于**片段数量 + 密度调节**的三区制：密集奖励区、灰色缓冲区、稀疏惩罚区。

---

## B-MS-021: 文件管理缺少批量操作

**严重程度：** 🟡 中

### 修复
增加全选复选框、批量编辑弹窗、批量新增弹窗。

---

## B-MS-022: 图片放大遮罩关闭按钮无效

**严重程度：** 🟡 中

### 根因
关闭按钮的 `stopPropagation` 在 `mousedown`/`mouseup` 上缺失。

### 修复
三个事件都调 `stopPropagation`。

---

## B-MS-023: 图片放大遮罩关闭事件穿透到抽屉

**严重程度：** 🔴 高

### 根因
三重原因：`stopPropagation` 覆盖不全、浏览器重派发事件、隐藏时机不当。

### 修复
1. 统一 `stopPropagation` 覆盖 `mousedown`/`mouseup`/`click`
2. 捕获层闭锁守卫：在隐藏 overlay **之前**注册 document 捕获层监听，吸收浏览器重派发的任何事件
3. 下一帧移除守卫
