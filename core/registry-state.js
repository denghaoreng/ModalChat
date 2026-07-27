// registry-state.js — 注册表状态管理（缓存 + CRUD）
// 数据变更通过 _dirtyCb 通知 data.js 执行防抖保存

import { generateId } from '../shared/utils.js';
import { readJSON, writeJSON, dirFile } from './file-storage.js';

// ==================== 内部状态 ====================

/** @type {Map<string, object>} 完整条目缓存 id→entry */
let _entryCache = new Map();
/** @type {object} 轻量索引 { id: directory } */
let _regIndex = {};
/** @type {Map<string, Set<string>>} 目录→条目ID集合（倒排索引，加速按目录查询） */
let _dirIndex = new Map();
/** @type {Set<string>} 已加载到缓存的目录集合 */
let _loadedDirs = new Set();

/** 脏回调（由 data.js 注册，指向 debouncedSave） */
let _dirtyCb = () => {};

export function setDirtyCallback(fn) { _dirtyCb = fn; }

/** 跟踪已修改的目录（增量保存优化） */
let _dirtyDirs = new Set();

/** 获取并清空脏目录集合 */
export function getAndClearDirtyDirs() {
    const s = _dirtyDirs;
    _dirtyDirs = new Set();
    return s;
}

/** 供 directory-manager 等外部模块手动触发保存 */
export function triggerSave() { _dirtyCb(); }

/** 从 _entryCache 重建 _dirIndex（启动时/目录重命名后调用） */
export function rebuildDirIndex() {
    _dirIndex = new Map();
    for (const [id, entry] of _entryCache) {
        const d = entry.directory || '/';
        if (!_dirIndex.has(d)) _dirIndex.set(d, new Set());
        _dirIndex.get(d).add(id);
    }
}

/** 暴露内部状态给 directory-manager（谨慎使用） */
export function getRegistryState() {
    return { _entryCache, _regIndex, _loadedDirs, _dirIndex };
}

/** 供 data.js loadSettings 设置索引 */
export function setRegIndex(idx) { _regIndex = idx; }

// ==================== 目录级懒加载 ====================

/** 供 data.js 和内部使用 */
export async function loadDir(dir) {
    if (_loadedDirs.has(dir)) return;
    const data = await readJSON(dirFile(dir));
    if (Array.isArray(data)) {
        const ids = [];
        for (const e of data) {
            if (e && e.id) { _entryCache.set(e.id, e); ids.push(e.id); }
        }
        _dirIndex.set(dir, new Set(ids));
    }
    _loadedDirs.add(dir);
}

// ==================== 公开 API ====================

/** 获取指定目录中的文件列表（懒加载该目录，使用倒排索引 O(1)） */
export async function getFilesInDirectory(dir) {
    await loadDir(dir);
    const ids = _dirIndex.get(dir);
    if (!ids || ids.size === 0) return [];
    const r = [];
    for (const id of ids) {
        const e = _entryCache.get(id);
        if (e) r.push(e);
    }
    return r;
}

/** 按 ID 查找（按需加载对应目录） */
export async function getRegistryById(id) {
    if (_entryCache.has(id)) return _entryCache.get(id);
    const d = _regIndex[id];
    if (d) { await loadDir(d); return _entryCache.get(id) || null; }
    return null;
}

/** 全量搜索（谨慎：遍历所有目录） */
export async function searchRegistry(query) {
    const dirs = new Set(Object.values(_regIndex));
    for (const d of dirs) await loadDir(d);
    if (!query) return [..._entryCache.values()];
    const q = query.toLowerCase();
    const r = [];
    for (const e of _entryCache.values()) {
        if ((e.displayName && e.displayName.toLowerCase().includes(q)) ||
            (e.serverFilename && e.serverFilename.toLowerCase().includes(q)) ||
            (e.originalName && e.originalName.toLowerCase().includes(q))) r.push(e);
    }
    return r;
}

export function getRegistryEntries() { return Array.from(_entryCache.values()); }
export function getRegistryCount() { return Object.keys(_regIndex).length; }
export function isRegistryReady() { return Object.keys(_regIndex).length > 0; }

/** 添加条目 */
export function addRegistryEntry(entry) {
    const r = {
        id: entry.serverFilename ? entry.serverFilename.replace(/\.[^/.]+$/, '') : generateId('reg'),
        source: entry.source || 'file-manager',
        serverFilename: entry.serverFilename || '',
        originalName: entry.originalName || '',
        displayName: entry.displayName || entry.originalName?.replace(/\.[^/.]+$/, '') || '未命名',
        type: entry.type || 'image',
        mimeType: entry.mimeType || '',
        relativePath: entry.relativePath || '',
        fullServerPath: entry.fullServerPath || '',
        fileSize: entry.fileSize || 0,
        uploadDate: Date.now(),
        directory: entry.directory || '/',
    };
    _entryCache.set(r.id, r);
    _regIndex[r.id] = r.directory;
    _loadedDirs.add(r.directory);
    // 维护倒排索引
    if (!_dirIndex.has(r.directory)) _dirIndex.set(r.directory, new Set());
    _dirIndex.get(r.directory).add(r.id);
    _dirtyDirs.add(r.directory);
    _dirtyCb();
    return r;
}

/** 批量添加 */
export function addRegistryEntries(entries) {
    for (const e of entries) {
        const r = {
            id: generateId('reg'),
            source: e.source || 'file-manager',
            serverFilename: e.serverFilename || '',
            originalName: e.originalName || '',
            displayName: e.displayName || e.originalName?.replace(/\.[^/.]+$/, '') || '未命名',
            type: e.type || 'image',
            mimeType: e.mimeType || '',
            relativePath: e.relativePath || '',
            fullServerPath: e.fullServerPath || '',
            fileSize: e.fileSize || 0,
            uploadDate: Date.now(),
            directory: e.directory || '/',
        };
        _entryCache.set(r.id, r);
        _regIndex[r.id] = r.directory;
        _loadedDirs.add(r.directory);
        // 维护倒排索引
        if (!_dirIndex.has(r.directory)) _dirIndex.set(r.directory, new Set());
        _dirIndex.get(r.directory).add(r.id);
        _dirtyDirs.add(r.directory);
    }
    _dirtyCb();
    return entries;
}

/** 删除条目 */
export function removeRegistryEntry(id) {
    const d = _regIndex[id];
    _entryCache.delete(id);
    delete _regIndex[id];
    // 维护倒排索引
    if (d && _dirIndex.has(d)) _dirIndex.get(d).delete(id);
    if (d) _dirtyDirs.add(d);
    _dirtyCb();
}

/** 更新条目 */
export function updateRegistryEntry(id, updates) {
    const e = _entryCache.get(id);
    if (e) {
        const oldDir = e.directory;
        Object.assign(e, updates);
        _regIndex[id] = e.directory;
        // 目录变更时更新倒排索引
        if (oldDir !== e.directory) {
            if (_dirIndex.has(oldDir)) _dirIndex.get(oldDir).delete(id);
            if (!_dirIndex.has(e.directory)) _dirIndex.set(e.directory, new Set());
            _dirIndex.get(e.directory).add(id);
        }
        _dirtyDirs.add(oldDir);
        _dirtyDirs.add(e.directory);
        if (e.directory !== oldDir && !_loadedDirs.has(e.directory)) loadDir(e.directory);
        _dirtyCb();
    }
}

/** 按来源查询 */
export async function getRegistryBySource(source) {
    const r = [];
    for (const e of _entryCache.values()) { if (e.source === source) r.push(e); }
    return r;
}
