# ModalChat Bug 修复文档索引

> 最后更新：2026年7月28日

本目录汇总了 ModalChat 融合开发过程中涉及的三个项目的 Bug 修复记录。

## 文档列表

| 文档 | 来源 | 条目数 | 覆盖范围 |
|------|------|--------|---------|
| [01-MatchScoring-Bugs.md](01-MatchScoring-Bugs.md) | MatchScoring 插件原始 Bug 总结 | B-MS-001 ~ B-MS-023 | settings 404、文件上传/删除认证、结果恢复、评分算法、图片放大、事件穿透等 |
| [02-chat-images-Bugs.md](02-chat-images-Bugs.md) | 聊天图片插件原始 Bug 总结 | B-CI-001 ~ B-CI-014 | 导航栏、上传/删除、弹窗、移动端适配、正则匹配、折叠状态等 |
| [03-ModalChat-Bugs.md](03-ModalChat-Bugs.md) | ModalChat 重构过程中修复的 Bug | MC-B001 ~ MC-B010 | Promise URL、DOM 覆盖、持久化、连接池耗尽、级联删除、筛选逻辑等 |

## 严重程度分布

| 严重程度 | MatchScoring | chat-images | ModalChat |
|---------|-------------|-------------|-----------|
| 🔴 高 | 12 | 3 | 8 |
| 🟡 中 | 9 | 9 | 2 |
| 🟢 低 | 2 | 2 | 0 |
