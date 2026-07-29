/**
 * render.js — BounceEditor 画布渲染模块
 */

export const RenderMixin = {
    // ── 渲染 ──

    /** 延迟渲染（合并同一帧内的多次调用） */
    _scheduleRender() {
        if (this._renderPending) return;
        this._renderPending = true;
        requestAnimationFrame(() => {
            this._renderPending = false;
            this._doRender();
        });
    },

    /** 真正的渲染逻辑 */
    _doRender() {
        const ctx = this.ctx;
        const dpr = this._dpr;
        const W = this.canvas.width;
        const H = this.canvas.height;

        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        const cw = W / dpr;
        const ch = H / dpr;

        // 参考背景图（保持比例居中留白）
        ctx.fillStyle = '#1a1a2e';
        ctx.fillRect(0, 0, cw, ch);
        if (this._bgImage) {
            const iw = this._bgImage.naturalWidth || this._bgImage.width;
            const ih = this._bgImage.naturalHeight || this._bgImage.height;
            const scale = Math.min(cw / iw, ch / ih);
            const dw = iw * scale, dh = ih * scale;
            const dx = (cw - dw) / 2, dy = (ch - dh) / 2;
            ctx.drawImage(this._bgImage, dx, dy, dw, dh);
        }

        // 网格（有背景图时淡一些）
        ctx.strokeStyle = 'rgba(255,255,255,0.06)';
        ctx.lineWidth = 1;
        const gridStep = 40;
        for (let x = 0; x <= cw; x += gridStep) {
            ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, ch); ctx.stroke();
        }
        for (let y = 0; y <= ch; y += gridStep) {
            ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(cw, y); ctx.stroke();
        }

        // 中轴线（参考）
        ctx.strokeStyle = 'rgba(255,255,255,0.03)';
        ctx.setLineDash([4, 6]);
        ctx.beginPath(); ctx.moveTo(cw / 2, 0); ctx.lineTo(cw / 2, ch); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(0, ch / 2); ctx.lineTo(cw, ch / 2); ctx.stroke();
        ctx.setLineDash([]);

        // 提示文字
        if (this.points.length === 0) {
            ctx.fillStyle = 'rgba(255,255,255,0.3)';
            ctx.font = '14px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText('点击画布添加弹跳点，拖拽设定方向与力度', cw / 2, ch / 2 - 10);
            ctx.fillText('滚轮调整影响半径，⇧ 方向与力度随拖拽距离变化', cw / 2, ch / 2 + 14);
        }

        // 骨骼模式预览（已设关节但未完成）
        if (this._mode === 'bone' && this._boneJoint) {
            const jx = this._boneJoint.x, jy = this._boneJoint.y;
            ctx.beginPath();
            ctx.arc(jx, jy, 5, 0, Math.PI * 2);
            ctx.fillStyle = '#44cc44';
            ctx.fill();
            ctx.strokeStyle = '#88ff88';
            ctx.lineWidth = 2;
            ctx.setLineDash([4, 4]);
            ctx.stroke();
            ctx.setLineDash([]);
            ctx.fillStyle = 'rgba(255,255,255,0.5)';
            ctx.font = '12px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText('点击第二点设定骨骼末端', cw / 2, 20);
        }

        // 绘制每个点
        const self = this;
        this.points.forEach((p, i) => {
            self._drawPoint(ctx, cw, ch, p, i === self._dragIdx, i === self._hoverIdx);
        });
    },

    /**
     * 绘制单个弹跳点
     */
    _drawPoint(ctx, cw, ch, p, isDragging, isHover) {
        if (p.type === 'bone') {
            this._drawBone(ctx, cw, ch, p, isDragging, isHover);
            return;
        }
        const cx = p.ox * cw;
        const cy = p.oy * ch;
        const radiusPx = p.radius * Math.max(cw, ch);
        const spreadVal = p.spread != null ? p.spread : 0.5;
        const spreadPx = radiusPx * (1 + spreadVal * 2);
        const ellipt = p.ellipticity || 0;
        const ellAngle = (p.ellipseAngle || 0) * Math.PI / 180;

        // 绘制椭圆/圆形辅助函数
        function _drawEllipse(x, y, r, style, fill, dash) {
            ctx.save();
            ctx.translate(x, y);
            if (ellAngle) ctx.rotate(ellAngle);
            const scaleY = 1 - ellipt * 0.5;
            ctx.scale(1, scaleY);
            ctx.beginPath();
            ctx.arc(0, 0, r, 0, Math.PI * 2);
            ctx.restore();
            if (fill) { ctx.fillStyle = fill; ctx.fill(); }
            if (style) { ctx.strokeStyle = style; ctx.lineWidth = 1; if (dash) ctx.setLineDash(dash); ctx.stroke(); ctx.setLineDash([]); }
        }

        // 扩散范围外圈（虚线，比内圈淡）
        if (spreadPx > radiusPx) {
            _drawEllipse(cx, cy, spreadPx, isHover ? 'rgba(100,180,255,0.25)' : 'rgba(100,180,255,0.12)', null, [2, 6]);
        }

        // 影响范围椭圆/圆
        _drawEllipse(cx, cy, radiusPx,
            isHover ? 'rgba(100,180,255,0.6)' : 'rgba(100,180,255,0.3)',
            isHover ? 'rgba(100,180,255,0.12)' : 'rgba(100,180,255,0.07)',
            [4, 4]);

        // 方向箭头（长度＝力度，用 sqrt 压缩大值防溢出画布）
        const arrowLen = Math.sqrt(p.scale) * 30;
        const endX = cx + p.dx * arrowLen;
        const endY = cy + p.dy * arrowLen;

        // 箭头线
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(endX, endY);
        ctx.strokeStyle = isDragging ? '#ff6644' : (isHover ? '#ffaa44' : '#ff8844');
        ctx.lineWidth = isDragging ? 3 : (isHover ? 2.5 : 2);
        ctx.stroke();

        // 箭头三角形
        const angle = Math.atan2(p.dy, p.dx);
        const headLen = 10;
        ctx.beginPath();
        ctx.moveTo(endX, endY);
        ctx.lineTo(endX - headLen * Math.cos(angle - 0.4), endY - headLen * Math.sin(angle - 0.4));
        ctx.lineTo(endX - headLen * Math.cos(angle + 0.4), endY - headLen * Math.sin(angle + 0.4));
        ctx.closePath();
        ctx.fillStyle = isDragging ? '#ff6644' : (isHover ? '#ffaa44' : '#ff8844');
        ctx.fill();

        // 起点圆点（触屏加大）
        const isTouch = ('ontouchstart' in window) || navigator.maxTouchPoints > 0;
        const dotR = isTouch ? (isHover ? 12 : 10) : (isHover ? 5 : 4);
        ctx.beginPath();
        ctx.arc(cx, cy, dotR, 0, Math.PI * 2);
        ctx.fillStyle = isDragging ? '#ff4400' : (isHover ? '#ff8800' : '#ff6600');
        ctx.fill();
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = isTouch ? 3 : 1;
        ctx.stroke();

        // 标签：多点时只显示编号
        ctx.fillStyle = 'rgba(255,255,255,0.8)';
        ctx.font = '11px sans-serif';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'bottom';
        const idx = this.points.indexOf(p);
        if (this.points.length > 20 && !isHover && !isDragging) {
            ctx.fillText('#' + (idx + 1), cx + 8, cy - 4);
        } else {
            ctx.fillText('#' + (idx + 1) + ' 力:' + p.scale.toFixed(1) + ' 径:' + (p.radius * 100).toFixed(0) + '% ' + (p.freqStart || 0).toFixed(1) + '→' + (p.freqEnd || 0).toFixed(1) + 'Hz 晃:' + (p.chirpDuration ?? 30) + 's 衰:' + (p.decay != null ? p.decay : 0.01).toFixed(3) + ' 散:' + (p.spread != null ? p.spread : 0.5).toFixed(2), cx + 8, cy - 4);
        }
    },

    /** 绘制骨骼摆臂点（胶囊形状：两端圆 + 直线段） */
    _drawBone(ctx, cw, ch, p, isDragging, isHover) {
        const jx = p.ox * cw, jy = p.oy * ch;
        const ex = (p.endX != null ? p.endX : p.ox) * cw;
        const ey = (p.endY != null ? p.endY : p.oy) * ch;
        const jr = (p.radius || 0.08) * Math.max(cw, ch);
        const er = (p.endRadius != null ? p.endRadius : (p.radius || 0.08)) * Math.max(cw, ch);
        const spreadVal = p.spread != null ? p.spread : 0.5;
        const spreadMul = 1 + spreadVal * 2;
        const jrS = jr * spreadMul, erS = er * spreadMul;

        // 骨骼方向单位向量
        const bdx = ex - jx, bdy = ey - jy;
        const bLen = Math.sqrt(bdx * bdx + bdy * bdy) || 1;
        const bnx = bdx / bLen, bny = bdy / bLen;
        // 骨线角度
        const boneAngle = Math.atan2(bdy, bdx);
        // 外公切线偏转角：当两圆半径不等时，切线不平行于骨线
        const gamma = bLen > 0.001 ? Math.asin(Math.max(-1, Math.min(1, (jr - er) / bLen))) : 0;
        // 上/下切线触点角度（骨线垂直方向 ± gamma）
        const topA = boneAngle + Math.PI / 2 - gamma;
        const botA = boneAngle - Math.PI / 2 + gamma;

        // 辅助：用给定半径画半胶囊（从下触点→左半圆→上触点→切线→对面的半圆→回到下触点）
        function _drawHalfCapsule(cx1, cy1, r1, cx2, cy2, r2, style, fill, dash) {
            ctx.beginPath();
            ctx.arc(cx1, cy1, r1, botA, topA);
            ctx.lineTo(cx2 + r2 * Math.cos(topA), cy2 + r2 * Math.sin(topA));
            ctx.arc(cx2, cy2, r2, topA, botA);
            ctx.closePath();
            if (fill) { ctx.fillStyle = fill; ctx.fill(); }
            if (style) { ctx.strokeStyle = style; ctx.lineWidth = 1; if (dash) ctx.setLineDash(dash); ctx.stroke(); ctx.setLineDash([]); }
        }

        // 扩散范围外圈胶囊（虚线）
        if (spreadMul > 1) {
            _drawHalfCapsule(jx, jy, jrS, ex, ey, erS,
                isHover ? 'rgba(100,220,100,0.2)' : 'rgba(100,220,100,0.1)',
                null, [2, 6]);
        }

        // 绘制胶囊形范围（半透明填充 + 虚线边框）
        _drawHalfCapsule(jx, jy, jr, ex, ey, er,
            isHover ? 'rgba(100,220,100,0.6)' : 'rgba(100,220,100,0.3)',
            isHover ? 'rgba(100,220,100,0.15)' : 'rgba(100,220,100,0.08)',
            [4, 4]);

        // 骨骼中线
        ctx.beginPath();
        ctx.moveTo(jx, jy);
        ctx.lineTo(ex, ey);
        ctx.strokeStyle = isDragging ? '#44ff66' : (isHover ? '#88ff88' : '#66cc66');
        ctx.lineWidth = isDragging ? 3 : 2;
        ctx.stroke();

        // 关节圆圈（带边框）
        ctx.beginPath();
        ctx.arc(jx, jy, jr, 0, Math.PI * 2);
        ctx.strokeStyle = isHover ? 'rgba(100,220,100,0.5)' : 'rgba(100,220,100,0.3)';
        ctx.lineWidth = 1;
        ctx.setLineDash([4, 4]);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.beginPath();
        ctx.arc(jx, jy, isHover ? 5 : 3, 0, Math.PI * 2);
        ctx.fillStyle = '#44cc44';
        ctx.fill();
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 2;
        ctx.stroke();

        // 末端圆圈（带边框）
        ctx.beginPath();
        ctx.arc(ex, ey, er, 0, Math.PI * 2);
        ctx.strokeStyle = isHover ? 'rgba(100,220,100,0.5)' : 'rgba(100,220,100,0.3)';
        ctx.lineWidth = 1;
        ctx.setLineDash([4, 4]);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.beginPath();
        ctx.arc(ex, ey, isHover ? 5 : 3, 0, Math.PI * 2);
        ctx.fillStyle = '#44cc44';
        ctx.fill();
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 2;
        ctx.stroke();

        // 摆动方向箭头（从末端指向摆动方向，sqrt 压缩防溢出）
        const arrowLen = Math.sqrt(p.scale) * 30;
        const ax = ex + p.dx * arrowLen;
        const ay = ey + p.dy * arrowLen;
        ctx.beginPath();
        ctx.moveTo(ex, ey);
        ctx.lineTo(ax, ay);
        ctx.strokeStyle = isDragging ? '#44ff66' : '#66cc66';
        ctx.lineWidth = isDragging ? 3 : 2;
        ctx.stroke();
        const ang = Math.atan2(p.dy, p.dx);
        const hl = 8;
        ctx.beginPath();
        ctx.moveTo(ax, ay);
        ctx.lineTo(ax - hl * Math.cos(ang - 0.4), ay - hl * Math.sin(ang - 0.4));
        ctx.lineTo(ax - hl * Math.cos(ang + 0.4), ay - hl * Math.sin(ang + 0.4));
        ctx.closePath();
        ctx.fillStyle = '#66cc66';
        ctx.fill();

        // 标签
        ctx.fillStyle = 'rgba(255,255,255,0.8)';
        ctx.font = '11px sans-serif';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'bottom';
        const bIdx = this.points.indexOf(p);
        if (this.points.length > 20 && !isHover && !isDragging) {
            ctx.fillText('🦴#' + (bIdx + 1), ex + 8, ey - 4);
        } else {
            ctx.fillText('🦴#' + (bIdx + 1) + ' 力:' + p.scale.toFixed(1) + ' 关径:' + Math.round((p.radius || 8) * 100) + '% 末径:' + Math.round((p.endRadius != null ? p.endRadius : (p.radius || 0.08)) * 100) + '% ' + (p.freqStart || 0).toFixed(1) + '→' + (p.freqEnd || 0).toFixed(1) + 'Hz 晃:' + (p.chirpDuration ?? 30) + 's 衰:' + (p.decay != null ? p.decay : 0.01).toFixed(3) + ' 散:' + (p.spread != null ? p.spread : 0.5).toFixed(2), ex + 8, ey - 4);
        }
    },
};
