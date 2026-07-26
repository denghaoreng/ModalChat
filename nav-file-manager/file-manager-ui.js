// nav-file-manager/file-manager-ui.js — 文件管理器 UI（入口，重新导出各模块）

export { renderFileManager, setActiveFileManagerTarget } from './file-render.js';
export { bindManagerEvents, enterSelectionMode } from './file-events.js';
export { showFilePickerPopup } from './file-picker-popup.js';
