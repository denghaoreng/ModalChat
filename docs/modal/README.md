# ModalChat 多模态聊天插件文档

> 最后更新：2026年7月27日

## 概述

ModalChat 是 SillyTavern 的第三方扩展插件，融合了 chat-images 和 MatchScoring 两个插件，并新增统一文件管理器、轮播配置系统、果冻弹跳物理引擎等高级功能。

## 文档索引

| 文档 | 说明 |
|------|------|
| [01-项目概述与需求分析](01-项目概述与需求分析.md) | 项目背景、融合动机、设计目标 |
| [02-架构设计与模块划分](02-架构设计与模块划分.md) | 项目结构、模块职责、依赖关系 |
| [03-文件管理器设计](03-文件管理器设计.md) | 文件注册表、目录管理、操作接口、状态管理 |
| [04-融合迁移指南](04-融合迁移指南.md) | 数据迁移流程、字段映射、兼容性 |
| [05-事件与数据流](05-事件与数据流.md) | 事件通信、数据流示例 |

## 核心架构

```
ModalChat/
├── index.js                      # ★ 入口：生命周期、导航栏、事件注册
├── data.js                       # ★ 全局数据层（多文件存储）
├── style.css                     # 全局样式
├── settings.html                 # 扩展设置模板
├── manifest.json                 # 插件清单
│
├── shared/                       # 共享模块
│   ├── utils.js                  # 工具函数
│   ├── file-service.js           # ★ 文件服务
│   ├── file-enlarge.js           # 全屏查看器
│   ├── file-icons.js             # 文件图标工具
│   ├── popup-type.js             # 弹窗类型常量
│   ├── bounce-editor/            # 果冻弹跳预设编辑器
│   └── image-drag-physics/       # 图片拖拽变形物理引擎
│
├── nav-chat-images/              # 「聊天图片」标签页
│   ├── index.js                  # 薄导入层
│   ├── data.js                   # 规则/规则集/角色集 CRUD
│   ├── rules-ui.js               # 规则界面 UI（含子导航）
│   └── matcher.js                # 正则匹配引擎
│
├── nav-match-scoring/            # 「匹配打分」标签页
│   ├── index.js                  # 薄导入层
│   ├── drawer.js                 # 子导航栏渲染（文件展示/匹配配置/轮播配置）
│   ├── file-display.js           # 文件展示 UI
│   ├── match-config.js           # 匹配配置 UI
│   ├── scorer.js                 # 评分引擎
│   ├── carousel-config.js        # 轮播插位配置
│   ├── match-chat-results.js     # 匹配结果聊天气泡渲染
│   ├── popup-config.js           # 配置弹窗（关联词/停用词/关键词）
│   └── popup-batch.js            # 批量新增弹窗
│
├── nav-file-manager/             # 「文件管理」标签页（新增）
│   ├── index.js                  # 薄导入层
│   ├── file-render.js            # ★ 文件管理器渲染
│   ├── file-events.js            # ★ 事件绑定
│   ├── file-state.js             # ★ 状态管理
│   ├── file-url.js               # 文件 URL 解析
│   ├── file-picker-popup.js      # 文件选择器弹窗
│   ├── file-manager-ui.js        # 重新导出 hub
│   └── file-registry.js          # 注册表查询操作
│
└── nav-general-settings/         # 「通用配置」标签页
    ├── index.js                  # 薄导入层
    ├── settings-ui.js            # 子导航调度
    ├── ui-config.js              # UI 配置子页
    ├── anim-types.js             # 轮播类型编辑子页
    └── bounce-presets/           # 动态图预设子页
        ├── index.js              # 导出 hub
        ├── bounce-presets.js     # 核心逻辑
        ├── fullscreen.js         # 全屏编辑器
        └── params.js             # 参数渲染
```

## 快速开始

1. 将 `ModalChat` 文件夹放入 `SillyTavern/public/scripts/extensions/third-party/`
2. 首次启动时自动初始化数据目录
3. 在 SillyTavern 导航栏中点击 "多模态聊天" 图标使用
