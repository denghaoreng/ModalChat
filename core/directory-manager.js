// directory-manager.js — 虚拟目录管理（创建/删除/重命名）
// 外部消费者请直接 import 本文件，而非通过 data.js

import { currentSettings } from './data.js';
import { readJSON, writeJSON, deleteFile, dirFile, FULL_PATH_PREFIX } from './file-storage.js';
import { triggerSave, getAndClearDirtyDirs, getRegistryState } from './registry-state.js';

// ==================== 目录查询与添加 ====================

/** 获取目录列表 */
export function getDirectories() {
    if (!currentSettings.directories || currentSettings.directories.length === 0) currentSettings.directories = ['/'];
    return currentSettings.directories;
}

/** 添加目录（仅列表，不创建文件） */
export function addDirectory(p) {
    const ds = getDirectories();
    const n = p.replace(/\/+/g, '/').replace(/\/$/, '') + '/';
    if (!ds.includes(n)) { ds.push(n); ds.sort(); triggerSave(); }

}
/** 创建目录并等待数据文件写入完成 */
export async function createDirWithFile(dir) {
    const n = dir.replace(/\/+/g, '/').replace(/\/$/, '') + '/';
    addDirectory(n);
    if (!currentSettings.folderMeta[n]) currentSettings.folderMeta[n] = { createdAt: Date.now() };
    await writeJSON(dirFile(n), []);
    triggerSave();
}

// ==================== 递归收集子目录 ====================

function collectSubDirs(root) {
    const ds = getDirectories();
    const n = root.replace(/\/+/g, '/').replace(/\/$/, '') + '/';
    const result = [];
    for (const d of ds) {
        if (d === n || d.startsWith(n)) result.push(d);
    }
    // 按深度排序（深的先删，避免依赖问题）
    result.sort((a, b) => b.split('/').length - a.split('/').length);
    return result;
}

// ==================== 递归删除目录 ====================

/**
 * 递归删除目录及其所有子目录/文件
 * @param {string} p - 目录路径
 */
export async function removeDirectoryRecursive(p) {
    const normalized = p.replace(/\/+/g, '/').replace(/\/$/, '') + '/';
    const ds = getDirectories();

    const toRemove = collectSubDirs(normalized);

    // 收集所有受影响条目的 ID（需要先获取 registry 状态）
    const { _entryCache, _regIndex, _loadedDirs, _dirIndex } = getRegistryState();

    // 加载所有未加载的子目录文件
    for (const d of toRemove) {
        if (_loadedDirs.has(d)) continue;
        const data = await readJSON(dirFile(d));
        if (Array.isArray(data)) {
            const ids = [];
            for (const e of data) {
                if (e && e.id) {
                    _entryCache.set(e.id, e);
                    _regIndex[e.id] = e.directory || '/';
                    ids.push(e.id);
                }
            }
            _dirIndex.set(d, new Set(ids));
        }
        _loadedDirs.add(d);
    }

    // 删除受影响的注册表条目 + 服务端文件
    const allIds = [..._entryCache.keys()];
    for (const id of allIds) {
        const entry = _entryCache.get(id);
        if (!entry) continue;
        const dir = entry.directory || '/';
        if (dir === normalized || dir.startsWith(normalized)) {
            if (entry.fullServerPath) await deleteFile(entry.fullServerPath);
            delete _regIndex[id];
            _entryCache.delete(id);
            // 维护倒排索引
            const entryDir = entry.directory || '/';
            if (_dirIndex.has(entryDir)) _dirIndex.get(entryDir).delete(id);
        }
    }

    // 删除目录列表 + 数据文件 + folderMeta
    for (const d of toRemove) {
        const i = ds.indexOf(d);
        if (i >= 0) ds.splice(i, 1);
        delete currentSettings.folderMeta[d];
        await deleteFile(FULL_PATH_PREFIX + dirFile(d));
        _loadedDirs.delete(d);
        _dirIndex.delete(d);
    }
    triggerSave();
}

// ==================== 重命名目录 ====================

/**
 * 重命名目录：改路径 → 更新条目 → 删旧文件
 * @param {string} oldPath 旧路径（如 '/old-name/'）
 * @param {string} newPath 新路径（如 '/new-name/'）
 */
export async function renameDirectory(oldPath, newPath) {
    const nOld = oldPath.replace(/\/+/g, '/').replace(/\/$/, '') + '/';
    const nNew = newPath.replace(/\/+/g, '/').replace(/\/$/, '') + '/';
    if (nOld === nNew) return;
    if (nOld === '/') return;

    const { _entryCache, _regIndex, _loadedDirs, _dirIndex } = getRegistryState();

    const ds = getDirectories();
    const idx = ds.indexOf(nOld);
    if (idx >= 0) ds[idx] = nNew;
    else ds.push(nNew);
    ds.sort();

    if (currentSettings.folderMeta[nOld]) {
        currentSettings.folderMeta[nNew] = currentSettings.folderMeta[nOld];
        delete currentSettings.folderMeta[nOld];
    }

    // 更新倒排索引 + 条目 directory 字段
    const movedIds = _dirIndex.get(nOld);
    if (movedIds) {
        _dirIndex.set(nNew, movedIds);
        _dirIndex.delete(nOld);
        for (const id of movedIds) {
            _regIndex[id] = nNew;
            const cached = _entryCache.get(id);
            if (cached) cached.directory = nNew;
        }
    } else {
        // 回退：通过 _regIndex 逐条迁移
        for (const id of Object.keys(_regIndex)) {
            if (_regIndex[id] === nOld) {
                _regIndex[id] = nNew;
                const cached = _entryCache.get(id);
                if (cached) cached.directory = nNew;
            }
        }
    }
    _loadedDirs.delete(nOld);
    _loadedDirs.add(nNew);

    await deleteFile(FULL_PATH_PREFIX + dirFile(nOld));
    triggerSave();
}
