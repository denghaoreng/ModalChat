/**
 * params.js — 动态图预设参数定义与渲染
 */

// ==================== 复制/粘贴 ====================

/** @type {object|null} */
export let _copiedPoint = null;
/** @type {string|null} */
export let _copiedType = null;

export function _setCopiedPoint(p, type) {
    _copiedPoint = p;
    _copiedType = type;
}

// ==================== 参数定义 ====================

/**
 * 参数配置表。
 * 每个参数: { key, label, min, max, step, unit, toRaw, fromRaw }
 * - toRaw(v): 从输入框的值 → 存到 point 上的值
 * - fromRaw(v, p): 从 point 上的值 → 输入框显示的值
 */
export const _PARAM_DEFS = {
    point: [
        { key: 'ox',        label: 'X坐标',  min: 0,   max: 1,   step: 0.01, unit: '',   fromRaw: v => +(v ?? 0.5).toFixed(2),              toRaw: v => Math.max(0, Math.min(1, v)) },
        { key: 'oy',        label: 'Y坐标',  min: 0,   max: 1,   step: 0.01, unit: '',   fromRaw: v => +(v ?? 0.5).toFixed(2),              toRaw: v => Math.max(0, Math.min(1, v)) },
        { key: 'dirAngle',  label: '方向角', min: 0,   max: 360, step: 1,   unit: '°',   fromRaw: (v,p) => { const a=Math.atan2(p.dy,p.dx)*180/Math.PI; return Math.round(a<0?a+360:a); }, toRaw: (v,p) => { const rad=v*Math.PI/180; p.dx=Math.cos(rad); p.dy=Math.sin(rad); return v; } },
        { key: 'radius',    label: '半径',   min: 1,  max: 200, step: 1,   unit: '%',   fromRaw: v => Math.round((v ?? 8) * 100),          toRaw: v => Math.max(0.01, Math.min(2, v / 100)) },
        { key: 'ellipticity', label: '椭圆度', min: 0,   max: 1,   step: 0.01, unit: '', fromRaw: v => +(v ?? 0).toFixed(2),                toRaw: v => Math.max(0, Math.min(1, v)) },
        { key: 'ellipseAngle', label: '椭圆角', min: 0,   max: 360, step: 1,   unit: '°', fromRaw: v => Math.round(v ?? 0),                toRaw: v => Math.max(0, Math.min(360, v)) },
        { key: 'scale',     label: '力度',   min: 0,   max: 200, step: 0.1, unit: '',    fromRaw: v => +(v ?? 3).toFixed(1),                toRaw: v => Math.max(0, Math.min(200, v)) },
        { key: 'filterMult', label: '位移系数', min: 5,   max: 1000, step: 1,   unit: '',  fromRaw: v => Math.round(v ?? 5),                 toRaw: v => Math.max(5, Math.min(1000, Math.round(v))) },
        { key: 'imgWidth',  label: '缩放系数', min: 100, max: 2000, step: 10,  unit: '',  fromRaw: v => Math.round(v ?? 600),               toRaw: v => Math.max(100, Math.min(2000, Math.round(v))) },
        { key: 'phaseOffset', label: '相位', min: 0,   max: 360, step: 1,   unit: '°',   fromRaw: v => Math.round(v ?? 0),                  toRaw: v => Math.max(0, Math.min(360, v)) },
        { key: 'freqStart', label: '快晃',   min: 0.01, max: 100, step: 0.1, unit: 'Hz', fromRaw: v => +(v ?? 1).toFixed(2),                toRaw: v => Math.max(0.01, Math.min(100, v)) },
        { key: 'freqEnd',   label: '慢晃',   min: 0.001, max: 50, step: 0.01, unit: 'Hz', fromRaw: v => +(v ?? 0.1).toFixed(3),              toRaw: v => Math.max(0.001, Math.min(50, v)) },
        { key: 'decay',     label: '力时衰减', min: 0,   max: 2,   step: 0.001, unit: '', fromRaw: v => +(v ?? 0.04).toFixed(3),             toRaw: v => Math.max(0, Math.min(2, v)) },
        { key: 'displaceMode', label: '位移模式', type: 'select', options: [{v:'parallel',l:'平行'},{v:'vortex',l:'旋涡'},{v:'vortexCCW',l:'旋涡←'},{v:'radial',l:'收缩'},{v:'expand',l:'放大'}], default: 'parallel' },
        { key: 'spatialFalloff', label: '力范函数', type: 'select', options: [{v:'smooth',l:'平滑 (1-t²)ⁿ'},{v:'gaussian',l:'高斯 exp(-t²)'},{v:'linear',l:'线性 1-t'},{v:'cosine',l:'余弦 cos(t·π/2)'}], default: 'smooth' },
        { key: 'spatialDecay', label: '力范衰减', min: 0,   max: 20,  step: 0.01, unit: '', fromRaw: v => +(v ?? 0.5).toFixed(2),              toRaw: v => Math.max(0, Math.min(20, v)) },
        { key: 'spread',    label: '扩散',   min: 0,   max: 5,   step: 0.01, unit: '',   fromRaw: v => +(v ?? 0.1).toFixed(2),              toRaw: v => Math.max(0, Math.min(5, v)) },
    ],
    bone: [
        { key: 'ox',        label: '关节X',  min: 0,   max: 1,   step: 0.01, unit: '',   fromRaw: v => +(v ?? 0.5).toFixed(2),              toRaw: v => Math.max(0, Math.min(1, v)) },
        { key: 'oy',        label: '关节Y',  min: 0,   max: 1,   step: 0.01, unit: '',   fromRaw: v => +(v ?? 0.5).toFixed(2),              toRaw: v => Math.max(0, Math.min(1, v)) },
        { key: 'endX',      label: '末端X',  min: 0,   max: 1,   step: 0.01, unit: '',   fromRaw: v => +(v ?? 0.5).toFixed(2),              toRaw: v => Math.max(0, Math.min(1, v)) },
        { key: 'endY',      label: '末端Y',  min: 0,   max: 1,   step: 0.01, unit: '',   fromRaw: v => +(v ?? 0.5).toFixed(2),              toRaw: v => Math.max(0, Math.min(1, v)) },
        { key: 'dirAngle',  label: '方向角', min: 0,   max: 360, step: 1,   unit: '°',   fromRaw: (v,p) => { const a=Math.atan2(p.dy,p.dx)*180/Math.PI; return Math.round(a<0?a+360:a); }, toRaw: (v,p) => { const rad=v*Math.PI/180; p.dx=Math.cos(rad); p.dy=Math.sin(rad); return v; } },
        { key: 'radius',    label: '关节径', min: 1,  max: 200, step: 1,   unit: '%',   fromRaw: v => Math.round((v ?? 8) * 100),          toRaw: v => Math.max(0.01, Math.min(2, v / 100)) },
        { key: 'endRadius', label: '末端径', min: 1,  max: 200, step: 1,   unit: '%',   fromRaw: v => Math.round((v ?? 8) * 100),          toRaw: v => Math.max(0.01, Math.min(2, v / 100)) },
        { key: 'scale',     label: '力度',   min: 0,   max: 200, step: 0.1, unit: '',    fromRaw: v => +(v ?? 4).toFixed(1),                toRaw: v => Math.max(0, Math.min(200, v)) },
        { key: 'filterMult', label: '位移系数', min: 5,   max: 1000, step: 1,   unit: '',  fromRaw: v => Math.round(v ?? 5),                 toRaw: v => Math.max(5, Math.min(1000, Math.round(v))) },
        { key: 'imgWidth',  label: '缩放系数', min: 100, max: 2000, step: 10,  unit: '',  fromRaw: v => Math.round(v ?? 600),               toRaw: v => Math.max(100, Math.min(2000, Math.round(v))) },
        { key: 'phaseOffset', label: '相位', min: 0,   max: 360, step: 1,   unit: '°',   fromRaw: v => Math.round(v ?? 0),                  toRaw: v => Math.max(0, Math.min(360, v)) },
        { key: 'freqStart', label: '快晃',   min: 0.01, max: 100, step: 0.1, unit: 'Hz', fromRaw: v => +(v ?? 1).toFixed(2),                toRaw: v => Math.max(0.01, Math.min(100, v)) },
        { key: 'freqEnd',   label: '慢晃',   min: 0.001, max: 50, step: 0.01, unit: 'Hz', fromRaw: v => +(v ?? 0.1).toFixed(3),              toRaw: v => Math.max(0.001, Math.min(50, v)) },
        { key: 'decay',     label: '力时衰减', min: 0,   max: 2,   step: 0.001, unit: '', fromRaw: v => +(v ?? 0.04).toFixed(3),             toRaw: v => Math.max(0, Math.min(2, v)) },
        { key: 'displaceMode', label: '位移模式', type: 'select', options: [{v:'parallel',l:'平行'},{v:'vortex',l:'旋涡'},{v:'vortexCCW',l:'旋涡←'},{v:'radial',l:'收缩'},{v:'expand',l:'放大'}], default: 'parallel' },
        { key: 'spatialFalloff', label: '力范函数', type: 'select', options: [{v:'smooth',l:'平滑 (1-t²)ⁿ'},{v:'gaussian',l:'高斯 exp(-t²)'},{v:'linear',l:'线性 1-t'},{v:'cosine',l:'余弦 cos(t·π/2)'}], default: 'smooth' },
        { key: 'spatialDecay', label: '力范衰减', min: 0,   max: 20,  step: 0.01, unit: '', fromRaw: v => +(v ?? 0.5).toFixed(2),              toRaw: v => Math.max(0, Math.min(20, v)) },
        { key: 'spread',    label: '扩散',   min: 0,   max: 5,   step: 0.01, unit: '',   fromRaw: v => +(v ?? 0.1).toFixed(2),              toRaw: v => Math.max(0, Math.min(5, v)) },
    ],
};

// ==================== 参数表格渲染 ====================

/** 缓存当前渲染的参数字典 key，用于增量更新 */
let _lastParamKeys = null;

/**
 * 在主界面渲染参数表格
 * @param {import('./index.js').BounceEditor} editor
 */
export function _renderParams(editor) {
    const $container = $('#mc-bounce-params');
    if (!editor) return;
    const idx = editor.hoveredIndex;
    const pts = editor.getPoints();
    const hasSelection = idx >= 0 && idx < pts.length;

    // 更新按钮状态（由主模块提供）
    _updateButtonStates(editor, hasSelection, pts, idx);

    if (!hasSelection) {
        $container.html('<div style="color:var(--grey40);font-size:0.85em;text-align:center;grid-column:1/-1;padding:12px 0;">未选中点</div>');
        _lastParamKeys = null;
        return;
    }
    const p = pts[idx];
    const defs = _PARAM_DEFS[p.type === 'bone' ? 'bone' : 'point'];
    const COLS = 6, ROWS = 3;
    const totalCells = COLS * ROWS;

    // 如果参数 key 列表没变，只更新输入框的值（避免重建 DOM）
    const keys = defs.map(d => d.key).join(',');
    if (_lastParamKeys === keys && $container.children().length > 0) {
        for (const d of defs) {
            const $input = $container.find(`.mc-bp-input[data-key="${d.key}"]`);
            if ($input.length) {
                if (d.type === 'select') {
                    $input.val(p[d.key] || d.default || '');
                } else {
                    $input.val(d.fromRaw(p[d.key], p));
                }
            }
        }
        return;
    }
    _lastParamKeys = keys;

    // 首次或参数变化时重建 DOM
    const cells = new Array(totalCells).fill(null);
    for (let i = 0; i < defs.length && i < totalCells; i++) {
        cells[i] = defs[i];
    }
    let html = '';
    for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
            const d = cells[r * COLS + c];
            if (d) {
                html += _paramCellHtml(d, p, 'mc-bp-input', 'var(--grey40)', 'var(--borderColor)', 'var(--white15)', 'var(--grey50)', 48);
            } else {
                html += `<div style="min-height:48px;"></div>`;
            }
        }
    }
    $container.html(html);
}

/** 生成单个参数单元格的 HTML，支持 number 和 select 两种类型 */
export function _paramCellHtml(d, p, inputClass, labelColor, borderColor, bgColor, rangeColor, minH) {
    if (d.type === 'select') {
        const currentVal = p[d.key] || d.default || '';
        let opts = '';
        for (const o of d.options) {
            const sel = o.v === currentVal ? ' selected' : '';
            opts += `<option value="${o.v}"${sel}>${o.l}</option>`;
        }
        return `<div style="display:flex;flex-direction:column;align-items:stretch;gap:1px;min-height:${minH}px;">
            <span style="color:${labelColor};font-size:0.95em;text-align:center;line-height:1.2;">${d.label}</span>
            <select class="${inputClass}" data-key="${d.key}" style="width:100%;padding:1px 2px;border-radius:3px;border:1px solid ${borderColor};background:${bgColor};color:inherit;font-size:inherit;text-align:center;box-sizing:border-box;cursor:pointer;">${opts}</select>
            <span style="color:${rangeColor};font-size:0.85em;text-align:center;line-height:1.2;">&nbsp;</span>
        </div>`;
    }
    const val = d.fromRaw(p[d.key], p);
    const rangeStr = d.unit ? `${d.min}~${d.max}${d.unit}` : `${d.min}~${d.max}`;
    return `<div style="display:flex;flex-direction:column;align-items:stretch;gap:1px;min-height:${minH}px;">
        <span style="color:${labelColor};font-size:0.95em;text-align:center;line-height:1.2;">${d.label}</span>
        <input class="${inputClass}" data-key="${d.key}" type="number" min="${d.min}" max="${d.max}" step="${d.step}" value="${val}" style="width:100%;padding:1px 2px;border-radius:3px;border:1px solid ${borderColor};background:${bgColor};color:inherit;font-size:inherit;text-align:center;box-sizing:border-box;">
        <span style="color:${rangeColor};font-size:0.85em;text-align:center;line-height:1.2;">${rangeStr}</span>
    </div>`;
}

/**
 * 由主模块注入的按钮状态更新函数
 * @type {function}
 */
let _updateButtonStates = () => {};

/** @param {function} fn */
export function _setUpdateButtonStates(fn) {
    _updateButtonStates = fn;
}

/** 从参数输入框读取值并更新到点数据 */
export function _applyParamInputs(editor) {
    if (!editor) return;
    const idx = editor.hoveredIndex;
    if (idx < 0) return;
    const p = editor.points[idx];
    const defs = _PARAM_DEFS[p.type === 'bone' ? 'bone' : 'point'];
    let changed = false;
    for (const d of defs) {
        const $input = $(`#mc-bounce-params .mc-bp-input[data-key="${d.key}"]`);
        if (!$input.length) continue;
        if (d.type === 'select') {
            const val = $input.val();
            if (p[d.key] !== val) {
                p[d.key] = val;
                changed = true;
            }
            continue;
        }
        const raw = parseFloat($input.val());
        if (isNaN(raw)) continue;
        if (d.key === 'dirAngle') {
            const oldAngle = Math.round(Math.atan2(p.dy, p.dx) * 180 / Math.PI);
            const clamped = Math.max(0, Math.min(360, raw));
            if (oldAngle !== clamped) {
                const rad = clamped * Math.PI / 180;
                p.dx = Math.cos(rad);
                p.dy = Math.sin(rad);
                p.dirAngle = clamped;
                changed = true;
            }
        } else {
            const newVal = d.toRaw(raw);
            if (p[d.key] !== newVal) {
                p[d.key] = newVal;
                changed = true;
            }
        }
    }
    if (changed) {
        editor._notifyChange();
        editor.render();
    }
}

/** 刷新点列表下拉框的选项 */
export function _refreshPointList(editor) {
    const $sel = $('#mc-bounce-pointlist');
    if (!$sel.length || !editor) return;
    const pts = editor.getPoints();
    if (!pts) return;
    const currentIdx = editor._hoverIdx != null ? editor._hoverIdx : -1;
    let html = '<option value="-1">📋 点列表</option>';
    for (let i = 0; i < pts.length; i++) {
        const p = pts[i];
        const icon = p.type === 'bone' ? '🦴' : '🔵';
        const coord = `${Math.round(p.ox * 100)},${Math.round(p.oy * 100)}`;
        const selected = i === currentIdx ? ' selected' : '';
        html += `<option value="${i}"${selected}>${icon} #${i+1} (${coord})</option>`;
    }
    $sel.html(html);
}
