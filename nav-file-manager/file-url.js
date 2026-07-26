// nav-file-manager/file-url.js — 获取文件可访问 URL

import { getRegistryById } from '../data.js';

/**
 * 从注册表条目获取文件可访问 URL
 * @param {object|string} entryOrId - 注册表条目对象或 ID
 * @returns {string}
 */
export async function getFileUrl(entryOrId) {
    if (!entryOrId) return '';
    const entry = typeof entryOrId === 'string' ? await getRegistryById(entryOrId) : entryOrId;
    if (!entry) return '';

    // fullServerPath 可能已经是可访问路径（如 /api/files/xxx）
    if (entry.fullServerPath) {
        return entry.fullServerPath.startsWith('/') ? entry.fullServerPath : '/' + entry.fullServerPath;
    }

    // 构造 URL
    const path = entry.fullServerPath || `user/files/${entry.relativePath}${entry.serverFilename}`;
    return path.startsWith('/') ? path : '/' + path;
}
