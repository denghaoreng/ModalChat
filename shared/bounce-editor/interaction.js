/**
 * interaction.js — BounceEditor 交互事件处理模块
 */

export const InteractionMixin = {
    /** 设置画布物理尺寸（适配 HiDPI） */
    _resize() {
        this.canvas.width = this.width * this._dpr;
        this.canvas.height = this.height * this._dpr;
        const cssW = this.canvas.clientWidth || this.width;
        const cssH = this.canvas.clientHeight || this.height;
        this._scaleX = this.width / cssW;
        this._scaleY = this.height / cssH;
    },

    /**
     * 将画布坐标 (clientX/Y) 转为逻辑坐标
     */
    _toLogical(cx, cy) {
        const rect = this.canvas.getBoundingClientRect();
        return {
            x: (cx - rect.left) * this._scaleX,
            y: (cy - rect.top) * this._scaleY,
        };
    },

    /** 查找最近的点（触屏用更大感应范围，平方距避免 sqrt） */
    _hitTest(lx, ly) {
        const isTouch = ('ontouchstart' in window) || navigator.maxTouchPoints > 0;
        const threshold = isTouch ? 40 : 15;
        const thr2 = threshold * threshold;
        let best = -1, bestDist2 = Infinity;
        for (let i = 0; i < this.points.length; i++) {
            const p = this.points[i];
            const px = p.ox * this.width, py = p.oy * this.height;
            const d2j = (lx - px) * (lx - px) + (ly - py) * (ly - py);
            if (d2j < thr2 && d2j < bestDist2) {
                bestDist2 = d2j;
                best = i;
            }
            if (p.type === 'bone' && p.endX != null) {
                const ex = p.endX * this.width, ey = p.endY * this.height;
                const d2e = (lx - ex) * (lx - ex) + (ly - ey) * (ly - ey);
                if (d2e < thr2 && d2e < bestDist2) {
                    bestDist2 = d2e;
                    best = i;
                }
            }
        }
        return best;
    },

    /** 从 touch 事件获取 client 坐标 */
    _touchPos(e) {
        const t = e.touches ? e.touches[0] : e.changedTouches?.[0];
        return t ? { x: t.clientX, y: t.clientY } : null;
    },

    /** pointer down 处理（鼠标 + 触屏共用） */
    _onPointerDown(cx, cy) {
        const l = this._toLogical(cx, cy);
        const hit = this._hitTest(l.x, l.y);
        if (hit >= 0) {
            const p = this.points[hit];
            this._pushUndo();
            if (this._interactionMode === 'move') {
                let movePart = 'joint';
                if (p.type === 'bone' && p.endX != null) {
                    const ex = p.endX * this.width, ey = p.endY * this.height;
                    const distEnd = Math.hypot(l.x - ex, l.y - ey);
                    const distJoint = Math.hypot(l.x - p.ox * this.width, l.y - p.oy * this.height);
                    if (distEnd < distJoint) movePart = 'end';
                }
                this._moveIdx = hit;
                this._movePart = movePart;
                this._hoverIdx = hit;
                this.onHoverChange(hit);
            } else {
                this._dragIdx = hit;
                this._hoverIdx = hit;
                this.onHoverChange(hit);
                this._dragStartX = l.x;
                this._dragStartY = l.y;
            }
            return;
        }
        if (this._mode === 'bone') {
            if (!this._boneJoint) {
                this._boneJoint = { x: l.x, y: l.y };
                this.render();
                return;
            }
            const jnx = this._boneJoint.x / this.width;
            const jny = this._boneJoint.y / this.height;
            const enx = l.x / this.width;
            const eny = l.y / this.height;
            const bdx = enx - jnx, bdy = eny - jny;
            const bLen = Math.sqrt(bdx * bdx + bdy * bdy) || 1;
            const sdx = -bdy / bLen;
            const sdy = bdx / bLen;
            this._pushUndo();
            this.points.push({
                type: 'bone',
                ox: jnx, oy: jny,
                endX: enx, endY: eny,
                dx: sdx, dy: sdy,
                scale: 4,
                radius: 0.08,
                endRadius: 0.08,
                freqStart: 1,
                freqEnd: 0.1,
                decay: 0.04,
                spatialFalloff: 'smooth',
                spatialDecay: 0.5,
                phaseOffset: 0,
                spread: 0.1,
                displaceMode: 'parallel',
                ellipticity: 0,
                ellipseAngle: 0,
            });
            this._boneJoint = null;
            this._notifyChange();
            this.render();
            return;
        }
        // 点击空白处：添加新点（point 模式）
        this._pushUndo();
        const newIdx = this.points.length;
        this.points.push({
            type: 'point',
            ox: l.x / this.width,
            oy: l.y / this.height,
            dx: -0.7,
            dy: -0.5,
            scale: 3,
            radius: 0.08,
            freqStart: 1,
            freqEnd: 0.1,
            decay: 0.04,
            spatialFalloff: 'smooth',
            spatialDecay: 0.5,
            phaseOffset: 0,
            displaceMode: 'parallel',
            ellipticity: 0,
            ellipseAngle: 0,
            spread: 0.1,
        });
        this._dragIdx = newIdx;
        this._hoverIdx = newIdx;
        this._dragStartX = l.x;
        this._dragStartY = l.y;
        this._notifyChange();
        this.render();
    },

    /** pointer move 处理 */
    _onPointerMove(cx, cy) {
        const l = this._toLogical(cx, cy);
        if (this._moveIdx >= 0) {
            const p = this.points[this._moveIdx];
            if (this._movePart === 'end' && p.type === 'bone') {
                p.endX = Math.max(0, Math.min(1, l.x / this.width));
                p.endY = Math.max(0, Math.min(1, l.y / this.height));
            } else {
                p.ox = Math.max(0, Math.min(1, l.x / this.width));
                p.oy = Math.max(0, Math.min(1, l.y / this.height));
            }
            this.render();
            return;
        }
        if (this._dragIdx >= 0) {
            const p = this.points[this._dragIdx];
            // 骨骼以末端为方向拖拽原点，普通点以中心为原点
            const originX = (p.type === 'bone' && p.endX != null ? p.endX : p.ox) * this.width;
            const originY = (p.type === 'bone' && p.endY != null ? p.endY : p.oy) * this.height;
            const dx = l.x - originX;
            const dy = l.y - originY;
            const dist = Math.hypot(dx, dy);
            if (dist > 5) {
                const norm = dist || 1;
                p.dx = dx / norm;
                p.dy = dy / norm;
                p.scale = Math.min(Math.max(dist / 10, 0), 200);
            }
            this.render();
            return;
        }
        // 非拖拽时限制 hitTest 频率（每 30ms 一次）
        const now = Date.now();
        if (this._lastMoveTime && now - this._lastMoveTime < 30) return;
        this._lastMoveTime = now;
        const hit = this._hitTest(l.x, l.y);
        if (hit >= 0) {
            if (hit !== this._hoverIdx) {
                this._hoverIdx = hit;
                this.onHoverChange(hit);
                this.render();
            }
            this.canvas.style.cursor = 'pointer';
        } else {
            this.canvas.style.cursor = 'crosshair';
        }
    },

    /** pointer up 处理 */
    _onPointerUp() {
        if (this._moveIdx >= 0) {
            this._hoverIdx = this._moveIdx;
            this._notifyChange();
        }
        if (this._dragIdx >= 0) {
            this._hoverIdx = this._dragIdx;
            this._notifyChange();
        }
        this._dragIdx = -1;
        this._moveIdx = -1;
        this.render();
    },

    _bindEvents() {
        const c = this.canvas;

        c.addEventListener('mousedown', (e) => {
            if (e.button !== 0) return;
            e.preventDefault();
            this._onPointerDown(e.clientX, e.clientY);
        });
        c.addEventListener('mousemove', (e) => {
            this._onPointerMove(e.clientX, e.clientY);
        });
        c.addEventListener('mouseup', () => { this._onPointerUp(); });
        c.addEventListener('mouseleave', () => {
            if (this._dragIdx >= 0) { this._dragIdx = -1; this.render(); }
            if (this._moveIdx >= 0) { this._moveIdx = -1; this.render(); }
        });

        c.addEventListener('touchstart', (e) => {
            const p = this._touchPos(e);
            if (!p) return;
            e.preventDefault();
            this._onPointerDown(p.x, p.y);
        }, { passive: false });
        c.addEventListener('touchmove', (e) => {
            const p = this._touchPos(e);
            if (!p) return;
            e.preventDefault();
            this._onPointerMove(p.x, p.y);
        }, { passive: false });
        c.addEventListener('touchend', (e) => {
            e.preventDefault();
            this._onPointerUp();
        }, { passive: false });

        c.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this._boneJoint) {
                this._boneJoint = null;
                this.render();
            }
        });
        c.addEventListener('wheel', (e) => {
            if (this._hoverIdx < 0) return;
            this._pushUndo();
            e.preventDefault();
            const p = this.points[this._hoverIdx];
            const delta = e.deltaY > 0 ? -0.005 : 0.005;
            p.radius = Math.max(0.01, Math.min(0.5, p.radius + delta));
            this._notifyChange();
            this.render();
        }, { passive: false });
    },
};
