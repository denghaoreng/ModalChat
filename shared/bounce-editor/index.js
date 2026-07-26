/**
 * bounce-editor/index.js — 果冻弹跳预设可视化编辑器
 *
 * 在画布上用箭头和圆圈直观地编辑弹跳点。
 * 每个点包含：位置(ox,oy)、方向(dx,dy)、力度(scale)、影响半径(radius)
 *
 * 用法:
 *   import { BounceEditor } from './bounce-editor/index.js';
 *   const editor = new BounceEditor(canvasEl, { ... });
 */

import { RenderMixin } from './render.js';
import { InteractionMixin } from './interaction.js';

export class BounceEditor {
    /**
     * @param {HTMLCanvasElement} canvas - 画布元素
     * @param {object} opts
     * @param {number} opts.width       - 画布逻辑宽度
     * @param {number} opts.height      - 画布逻辑高度
     * @param {Array}  opts.points      - 初始点数组
     * @param {function} opts.onChange  - 点数据变化回调
     * @param {function} opts.onHoverChange - 选中点变化回调
     */
    constructor(canvas, opts = {}) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.width = opts.width || 400;
        this.height = opts.height || 400;
        this.points = (opts.points || []).map(p => ({ ...p }));
        this.onChange = opts.onChange || (() => {});
        this.onHoverChange = opts.onHoverChange || (() => {});
        this._dpr = window.devicePixelRatio || 1;

        // 交互状态
        this._dragIdx = -1;
        this._moveIdx = -1;
        this._movePart = 'joint';
        this._dragStartX = 0;
        this._dragStartY = 0;
        this._editing = false;
        this._hoverIdx = -1;
        this._undoStack = [];
        this._undoMax = 20;
        this._renderPending = false;
        this._bgImage = null;
        this._mode = 'point';
        this._boneJoint = null;
        this._interactionMode = 'direction';
        this._lastMoveTime = 0;

        // 设置画布尺寸
        this._resize();
        this._bindEvents();
        this._doRender();
    }

    // ── 状态管理 ──

    /** 把当前状态压入撤销栈 */
    _pushUndo() {
        this._undoStack.push(this.points.map(p => ({ ...p })));
        if (this._undoStack.length > this._undoMax) this._undoStack.shift();
    }

    _notifyChange() {
        if (this.onChange) {
            this.onChange(this.points.map(p => ({ ...p })));
        }
    }

    /** 公开渲染接口（自动合并到下一帧） */
    render() {
        this._scheduleRender();
    }

    // ── 外部接口 ──

    /** 获取当前点数据（深拷贝） */
    getPoints() {
        return this.points.map(p => ({ ...p }));
    }

    /** 加载新点数据 */
    setPoints(pts) {
        this._pushUndo();
        this.points = pts.map(p => ({ ...p }));
        this._notifyChange();
        this.render();
    }

    /** 删除选中点（按索引） */
    removePoint(idx) {
        if (idx >= 0 && idx < this.points.length) {
            this._pushUndo();
            this.points.splice(idx, 1);
            if (this._hoverIdx >= this.points.length) this._hoverIdx = -1;
            this._notifyChange();
            this.render();
        }
    }

    /** 删除所有点 */
    clearAll() {
        this._pushUndo();
        this.points = [];
        this._hoverIdx = -1;
        this._notifyChange();
        this.render();
    }

    /** 撤销上一步 */
    undo() {
        if (this._undoStack.length === 0) return false;
        this.points = this._undoStack.pop();
        if (this._hoverIdx >= this.points.length) this._hoverIdx = -1;
        this._notifyChange();
        this.render();
        return true;
    }

    /** 是否有可撤销的操作 */
    get canUndo() {
        return this._undoStack.length > 0;
    }

    /** 当前悬浮/选中的点索引，-1 表示无 */
    get hoveredIndex() {
        return this._hoverIdx;
    }

    // ── 参数设置（set* 带 _notifyChange，set*Preview 仅刷新） ──

    /** 设置指定点的半径（触发保存） */
    setRadius(idx, val) {
        if (idx >= 0 && idx < this.points.length) {
            this.points[idx].radius = Math.max(0.01, Math.min(0.5, val));
            this._notifyChange();
            this.render();
        }
    }
    setRadiusPreview(idx, val) {
        if (idx >= 0 && idx < this.points.length) {
            this.points[idx].radius = Math.max(0.01, Math.min(0.5, val));
            this.render();
        }
    }

    /** 设置末端半径（触发保存） */
    setEndRadius(idx, val) {
        if (idx >= 0 && idx < this.points.length) {
            this.points[idx].endRadius = Math.max(0.01, Math.min(0.5, val));
            this._notifyChange();
            this.render();
        }
    }
    setEndRadiusPreview(idx, val) {
        if (idx >= 0 && idx < this.points.length) {
            this.points[idx].endRadius = Math.max(0.01, Math.min(0.5, val));
            this.render();
        }
    }

    /** 设置扩散范围 */
    setSpread(idx, val) {
        if (idx >= 0 && idx < this.points.length) {
            this.points[idx].spread = Math.max(0, Math.min(1, val));
            this._notifyChange();
            this.render();
        }
    }
    setSpreadPreview(idx, val) {
        if (idx >= 0 && idx < this.points.length) {
            this.points[idx].spread = Math.max(0, Math.min(1, val));
            this.render();
        }
    }

    /** 设置衰减率 */
    setDecay(idx, val) {
        if (idx >= 0 && idx < this.points.length) {
            this.points[idx].decay = Math.max(0, Math.min(0.5, val));
            this._notifyChange();
            this.render();
        }
    }
    setDecayPreview(idx, val) {
        if (idx >= 0 && idx < this.points.length) {
            this.points[idx].decay = Math.max(0, Math.min(0.5, val));
            this.render();
        }
    }

    /** 设置起始频率（Hz） */
    setFreqStart(idx, v) {
        if (idx >= 0 && idx < this.points.length) {
            this.points[idx].freqStart = Math.max(0.5, Math.min(20, v));
            this._notifyChange();
            this.render();
        }
    }
    setFreqStartPreview(idx, v) {
        if (idx >= 0 && idx < this.points.length) {
            this.points[idx].freqStart = Math.max(0.5, Math.min(20, v));
            this.render();
        }
    }

    /** 设置结束频率（Hz） */
    setFreqEnd(idx, v) {
        if (idx >= 0 && idx < this.points.length) {
            this.points[idx].freqEnd = Math.max(0.1, Math.min(5, v));
            this._notifyChange();
            this.render();
        }
    }
    setFreqEndPreview(idx, v) {
        if (idx >= 0 && idx < this.points.length) {
            this.points[idx].freqEnd = Math.max(0.1, Math.min(5, v));
            this.render();
        }
    }

    // ── 模式 ──

    /** 交互模式（'move' | 'direction'） */
    get interactionMode() { return this._interactionMode; }
    setInteractionMode(m) {
        this._interactionMode = (m === 'move') ? 'move' : 'direction';
        this.canvas.style.cursor = this._interactionMode === 'move' ? 'move' : 'crosshair';
    }

    /** 编辑模式（'point' | 'bone'） */
    get mode() { return this._mode; }
    setMode(m) {
        this._mode = (m === 'bone') ? 'bone' : 'point';
        this._boneJoint = null;
        this.render();
    }

    // ── 背景图 ──

    /** 设置参考背景图 */
    setBackgroundImage(url) {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => {
            this._bgImage = img;
            this.render();
        };
        img.onerror = () => { this._bgImage = null; this.render(); };
        img.src = url;
    }

    /** 清除参考背景图 */
    clearBackgroundImage() {
        this._bgImage = null;
        this.render();
    }

    /** 是否有背景图 */
    get hasBackgroundImage() {
        return this._bgImage !== null;
    }

    /** 重置画布尺寸 */
    resize(w, h) {
        this.width = w;
        this.height = h;
        this._resize();
        this.render();
    }
}

// ── 应用 Mixin（渲染 + 交互方法） ──
Object.assign(BounceEditor.prototype, RenderMixin);
Object.assign(BounceEditor.prototype, InteractionMixin);
