// nav-file-manager/file-registry.js — 文件注册表查询操作

import { getRegistry, getRegistryById, getRegistryBySource } from '../data.js';

/**
 * 按源模块查询
 */
export { getRegistryBySource };

/**
 * 按展示名称模糊搜索
 * @param {string} query
 * @returns {Array}
 */
export function searchRegistry(query) {
    if (!query) return getRegistry();
    const q = query.toLowerCase();
    return getRegistry().filter(r =>
        (r.displayName && r.displayName.toLowerCase().includes(q)) ||
        (r.originalName && r.originalName.toLowerCase().includes(q)) ||
        (r.serverFilename && r.serverFilename.toLowerCase().includes(q))
    );
}

/**
 * 获取所有文件类型
 * @returns {string[]}
 */
export function getAllTypes() {
    const types = new Set();
    getRegistry().forEach(r => types.add(r.type));
    return [...types];
}

/**
 * 获取所有来源
 * @returns {string[]}
 */
export function getAllSources() {
    const sources = new Set();
    getRegistry().forEach(r => sources.add(r.source));
    return [...sources];
}
