// ── 位移贴图生成 ──

/**
 * 计算椭圆距离，支持椭圆度和旋转角。
 * @param {number} dx - X 偏移
 * @param {number} dy - Y 偏移
 * @param {number} e - 椭圆度 (0~1)，0=正圆
 * @param {number} angleDeg - 椭圆旋转角度 (度)
 * @returns {number} 椭圆距离
 */
export function _ellipDist(dx, dy, e, angleDeg) {
    if (!e || e <= 0.001) return Math.sqrt(dx * dx + dy * dy);
    const a = angleDeg * Math.PI / 180;
    const ca = Math.cos(a), sa = Math.sin(a);
    const rx = dx * ca + dy * sa;
    const ry = -dx * sa + dy * ca;
    // Y 轴压缩比例：e=0 → 1 (正圆)，e=1 → 0.5 (椭圆)
    const scaleY = 1 - e * 0.5;
    return Math.sqrt(rx * rx + (ry / scaleY) * (ry / scaleY));
}

/**
 * 根据力范函数类型和力范衰减计算 falloff 值。
 * @param {number} t - 归一化距离 (0~1)
 * @param {string} type - falloff 类型: 'smooth'|'gaussian'|'linear'|'cosine'
 * @param {number} sd - 力范衰减值 (0~5)
 * @returns {number} 0~1 的权重
 */
export function _falloffFunc(t, type, sd) {
    if (t >= 1) return 0;
    if (sd <= 0.001) return 1;
    switch (type) {
        case 'gaussian': return Math.exp(-t * t * 4.5 / (sd + 0.5));
        case 'linear':   return 1 - t;
        case 'cosine':   return Math.cos(t * Math.PI / 2);
        default: /* smooth */ return Math.pow(1 - t * t, sd * 2);
    }
}

// 复用 canvas 和 ImageData，避免每帧 GC
let _mapCanvas = null;
let _mapCtx = null;
let _mapImageData = null;
let _mapData = null;

/**
 * 生成 128×128 的位移贴图（PNG data URL）
 * 用于 feDisplacementMap 的 feImage 输入。
 * 每个像素的 R 通道 = X 位移，G 通道 = Y 位移，128 = 零位移。
 *
 * @param {number} ox  - 点击点在贴图中的归一化 X (0..1)
 * @param {number} oy  - 点击点在贴图中的归一化 Y (0..1)
 * @param {number} ux  - 位移方向 X 分量
 * @param {number} uy  - 位移方向 Y 分量
 * @param {number} scale - 位移幅度
 * @param {number} [radius] - 影响半径归一化 (0..1)，传此值则用 bounded falloff
 * @param {number} [spread] - 扩散范围 (0~1)，控制 falloff 超出半径的程度
 * @returns {string} data:image/png;base64,...
 */
export function _genMap(ox, oy, ux, uy, scale, radius, spread, spatialDecay, spatialFalloff, displaceMode, ellipticity, ellipseAngle) {
    const size = 128;
    if (!_mapCanvas) {
        _mapCanvas = document.createElement('canvas');
        _mapCanvas.width = size;
        _mapCanvas.height = size;
        _mapCtx = _mapCanvas.getContext('2d');
        _mapImageData = _mapCtx.createImageData(size, size);
        _mapData = _mapImageData.data;
    }
    const data = _mapData;
    const px = ox * size, py = oy * size;
    const hasRadius = radius != null && radius > 0;
    const rPx = hasRadius ? radius * size : 0;
    const maxDist = hasRadius ? rPx * (1 + (spread || 0) * 2) : 0;
    const sd = spatialDecay != null ? spatialDecay : 0.5;
    const sf = spatialFalloff || 'smooth';
    const el = ellipticity || 0;
    const ea = ellipseAngle || 0;
    const sigma = size * 0.08;
    for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
            const ddx = x - px, ddy = y - py;
            const euclid = Math.sqrt(ddx * ddx + ddy * ddy);
            const dist = _ellipDist(ddx, ddy, el, ea);
            let f;
            let dirX = ux, dirY = uy;
            if (hasRadius) {
                f = _falloffFunc(dist / maxDist, sf, sd);
                if (displaceMode === 'vortex') {
                    const safeD = Math.max(euclid, 0.001);
                    dirX = ddy / safeD;
                    dirY = -ddx / safeD;
                } else if (displaceMode === 'vortexCCW') {
                    const safeD = Math.max(euclid, 0.001);
                    dirX = -ddy / safeD;
                    dirY = ddx / safeD;
                } else if (displaceMode === 'radial') {
                    // 收缩：像素向中心消失，方向指向中心
                    const safeD = Math.max(euclid, 0.001);
                    dirX = -ddx / safeD;   // 指向中心
                    dirY = -ddy / safeD;
                    const t = dist / maxDist;
                    f = t * f;
                } else if (displaceMode === 'expand') {
                    // 放大：中心内容向外铺开，方向指向外
                    const safeD = Math.max(euclid, 0.001);
                    dirX = ddx / safeD;    // 指向外
                    dirY = ddy / safeD;
                    const t = dist / maxDist;
                    f = t * f;
                }
            } else {
                f = Math.exp(-(dist * dist) / (2 * sigma * sigma));
            }
            const off = scale * f * 40;
            const rx = -dirX * off;
            const ry = -dirY * off;
            const idx = (y * size + x) * 4;
            data[idx]     = Math.max(0, Math.min(255, 128 + rx));
            data[idx + 1] = Math.max(0, Math.min(255, 128 + ry));
            data[idx + 2] = 128;
            data[idx + 3] = 255;
        }
    }
    _mapCtx.putImageData(_mapImageData, 0, 0);
    return _mapCanvas.toDataURL();
}

// 复用骨骼 canvas
let _boneCanvas = null;
let _boneCtx = null;
let _boneImageData = null;
let _boneData = null;

/**
 * 生成 128×128 的骨骼摆臂位移贴图（胶囊形状）。
 * 关节和末端各有一个圆圈范围，中间直线过渡，形成胶囊形影响区。
 * 位移幅度从关节（0）到末端（最大）线性递增。
 *
 * @param {number} jx   - 关节点 X (0..1)
 * @param {number} jy   - 关节点 Y (0..1)
 * @param {number} ex   - 末端点 X (0..1)
 * @param {number} ey   - 末端点 Y (0..1)
 * @param {number} dirX - 摆动方向 X
 * @param {number} dirY - 摆动方向 Y
 * @param {number} scale - 末端最大位移幅度
 * @param {number} jr   - 关节端圆圈半径 (归一化)
 * @param {number} [er] - 末端圆圈半径 (归一化)，默认等于 jr
 * @param {number} [spread] - 扩散范围 (0~1)，控制胶囊外 falloff 程度
 * @returns {string} data:image/png;base64,...
 */
export function _genMapBone(jx, jy, ex, ey, dirX, dirY, scale, jr, er, spread, spatialDecay, spatialFalloff, displaceMode, ellipticity, ellipseAngle) {
    jr = jr || 0.08;
    er = (er != null) ? er : jr;
    spread = spread || 0;
    const sd = spatialDecay != null ? spatialDecay : 0.5;
    const sf = spatialFalloff || 'smooth';
    const el = ellipticity || 0;
    const ea = ellipseAngle || 0;
    const size = 128;
    if (!_boneCanvas) {
        _boneCanvas = document.createElement('canvas');
        _boneCanvas.width = size;
        _boneCanvas.height = size;
        _boneCtx = _boneCanvas.getContext('2d');
        _boneImageData = _boneCtx.createImageData(size, size);
        _boneData = _boneImageData.data;
    }
    const data = _boneData;

    // 骨骼方向向量（关节点 → 末端）
    const bx = (ex - jx) * size, by = (ey - jy) * size;
    const boneLen = Math.sqrt(bx * bx + by * by) || 1;
    const bnx = bx / boneLen, bny = by / boneLen;
    const px = jx * size, py = jy * size;
    // 外公切线偏转角
    const gamma = boneLen > 0.001 ? Math.asin(Math.max(-1, Math.min(1, (jr - er) * size / boneLen))) : 0;
    const cosG = Math.cos(gamma);

    // 末端坐标（贴图像素）
    const exPx = ex * size, eyPx = ey * size;

    for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
            const dx = x - px, dy = y - py;
            const t = (dx * bnx + dy * bny) / boneLen;
            let along;
            if (t <= 0) {
                along = 0;
            } else if (t <= 1) {
                along = t;
            } else {
                const beyond = t - 1;
                const alongSigma = 0.15 + spread * 0.35;
                along = Math.exp(-(beyond * beyond) / (2 * alongSigma * alongSigma));
            }
            // 胶囊半径（线性插值），乘 cosγ 修正为正确的外公切线边界
            const capR = (jr + (er - jr) * Math.min(1, Math.max(0, t))) * size * cosG;
            let dist;
            if (t < 0) {
                dist = Math.sqrt(dx * dx + dy * dy);
            } else if (t > 1) {
                dist = Math.sqrt((x - exPx) * (x - exPx) + (y - eyPx) * (y - eyPx));
            } else {
                dist = Math.abs(-dx * bny + dy * bnx);
            }
            const capEdge = capR * (1 + spread * 2);
            const crossWeight = dist < capEdge ? _falloffFunc(dist / capEdge, sf, sd) : 0;
            const f = along * crossWeight;
            if (f < 0.005) continue;
            let bDirX = dirX, bDirY = dirY;
                if (displaceMode === 'vortex' || displaceMode === 'vortexCCW' || displaceMode === 'radial' || displaceMode === 'expand') {
                const ddx = x - px, ddy = y - py;
                const d = Math.sqrt(ddx * ddx + ddy * ddy) || 1;
                if (displaceMode === 'vortex') { bDirX = ddy / d; bDirY = -ddx / d; }
                else if (displaceMode === 'vortexCCW') { bDirX = -ddy / d; bDirY = ddx / d; }
                else if (displaceMode === 'radial') { bDirX = -ddx / d; bDirY = -ddy / d; } // 收缩（向内）
                else { bDirX = ddx / d; bDirY = ddy / d; } // 放大（向外）
            }
            const off = scale * f * 40;
            const rx = -bDirX * off;
            const ry = -bDirY * off;
            const idx = (y * size + x) * 4;
            data[idx]     = Math.max(0, Math.min(255, 128 + rx));
            data[idx + 1] = Math.max(0, Math.min(255, 128 + ry));
            data[idx + 2] = 128;
            data[idx + 3] = 255;
        }
    }
    _boneCtx.putImageData(_boneImageData, 0, 0);
    return _boneCanvas.toDataURL();
}
