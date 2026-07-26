/**
 * image-drag-physics — 图片/视频拖拽变形物理引擎
 *
 * 基于 SVG feDisplacementMap 实现果冻弹跳效果。
 * 支持多点并发（每点独立 SVG 滤波器，通过 CSS filter 链叠加）。
 *
 * 用法:
 *   import { setupDragDeformation } from '../shared/image-drag-physics/index.js';
 *   setupDragDeformation($container, '.my-selector img, .my-selector video');
 *
 * 拖拽时在元素上设置 data-mc-dragged="1"，动画结束后移除。
 * 调用方可在 click 处理中检查 data-mc-dragged 防止拖拽后误触。
 */

export { setupDragDeformation } from './drag-interaction.js';
export { autoBounce } from './combined-engine.js';
