// shared/file-service.js — 服务端文件操作

import { getContext } from '../../../../extensions.js';
import { addRegistryEntry, removeRegistryEntry, updateRegistryEntry, getRegistryById, getRegistryEntries, getDirectories, addDirectory, createDirWithFile, removeDirectoryRecursive } from '../core/data.js';
import { generateServerFilename } from './utils.js';

/**
 * 上传 API 返回的 path 格式：'user/files/{filename}'
 * 用于 fallback 构造 fullServerPath，匹配服务端路由 /user/files/*
 */
const FILES_ROOT = 'user/files/';

/**
 * 获取认证头
 */
function getHeaders() {
    const { getRequestHeaders } = getContext();
    return getRequestHeaders();
}

// ==================== 文件上传 ====================

/**
 * 上传单个文件
 * @param {File} file - 文件对象
 * @param {object} options
 * @param {string} options.source - 来源标识 ('chat-images'|'match-scoring'|'file-manager')
 * @param {string} options.directory - 目标目录（相对路径，如 'my-folder/'）
 * @param {string} options.displayName - 展示名称
 * @returns {Promise<object>} 注册表条目
 */
export async function uploadFile(file, options = {}) {
    const { source = 'file-manager', directory = '', displayName = '' } = options;
    const prefix = source === 'chat-images' ? 'ChatImages_' :
                   source === 'match-scoring' ? 'MatchScoring_' : 'MM_';
    const serverFilename = generateServerFilename(file.name, prefix);

    // 读取 base64
    const base64Data = await readFileAsBase64(file);

    // 上传到服务器
    const response = await fetch('/api/files/upload', {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ name: serverFilename, data: base64Data }),
    });
    if (!response.ok) throw new Error(`上传失败: ${response.status}`);
    const result = await response.json();

    // 写入注册表
    const relativePath = directory ? `${directory}/` : '';
    const entry = addRegistryEntry({
        source,
        serverFilename,
        originalName: file.name,
        displayName: displayName || file.name.replace(/\.[^/.]+$/, ''),
        type: file.type.startsWith('video/') ? 'video' : file.type.startsWith('audio/') ? 'audio' : 'image',
        mimeType: file.type,
        relativePath,
        fullServerPath: result.path || `${FILES_ROOT}${relativePath}${serverFilename}`,
        fileSize: file.size,
        directory: `/${relativePath}`,
    });

    return entry;
}

/**
 * 批量上传文件
 * @param {File[]} files
 * @param {object} options
 * @returns {Promise<Array>}
 */
export async function uploadFiles(files, options = {}) {
    const results = [];
    for (const file of files) {
        try {
            const entry = await uploadFile(file, options);
            results.push({ success: true, entry, fileName: file.name });
        } catch (err) {
            console.error('ModalChat: 上传失败', file.name, err);
            results.push({ success: false, error: err, fileName: file.name });
        }
    }
    return results;
}

/**
 * 使用 FileReader 读取文件为 base64
 */
function readFileAsBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (ev) => {
            const data = ev.target.result;
            resolve(data.split(',')[1] || data);
        };
        reader.onerror = () => reject(new Error('文件读取失败'));
        reader.readAsDataURL(file);
    });
}

// ==================== 文件删除 ====================

/**
 * 删除服务端文件并从注册表移除
 * @param {string} registryId - 注册表 ID
 * @returns {Promise<boolean>}
 */
export async function deleteFile(registryId) {
    const entry = await getRegistryById(registryId);
    if (!entry) return false;

    try {
        const path = entry.fullServerPath || `${FILES_ROOT}${entry.relativePath}${entry.serverFilename}`;
        await fetch('/api/files/delete', {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify({ path }),
        });
    } catch (e) {
        console.warn('ModalChat: 服务端删除失败（可能文件已移除）', e);
    }

    removeRegistryEntry(registryId);
    return true;
}

/**
 * 批量删除文件
 * @param {string[]} registryIds
 */
export async function deleteFiles(registryIds) {
    for (const id of registryIds) {
        await deleteFile(id);
    }
}

// ==================== 文件移动 ====================

/**
 * 逻辑移动文件到新目录（只更新注册表，SillyTavern 无服务端 move API）
 * @param {string} registryId
 * @param {string} newDirectory - 新目录路径（如 'new-folder/'）
 * @returns {boolean}
 */
export function moveFile(registryId, newDirectory) {
    const entry = getRegistryById(registryId);
    if (!entry) return false;

    const newRelativePath = newDirectory ? `${newDirectory}/` : '';
    updateRegistryEntry(registryId, {
        relativePath: newRelativePath,
        fullServerPath: `${FILES_ROOT}${newRelativePath}${entry.serverFilename}`,
        directory: `/${newRelativePath}`,
    });
    return true;
}

// ==================== 文件重命名（逻辑） ====================

/**
 * 逻辑重命名（只更新注册表的展示名，服务端文件名不变）
 * @param {string} registryId
 * @param {string} newDisplayName - 新的展示名称
 * @returns {boolean}
 */
export function renameFile(registryId, newDisplayName) {
    if (!newDisplayName || !newDisplayName.trim()) return false;
    const entry = getRegistryById(registryId);
    if (!entry) return false;
    updateRegistryEntry(registryId, { displayName: newDisplayName.trim() });
    return true;
}

// ==================== 目录操作 ====================

/**
 * 创建虚拟目录
 * @param {string} dirName - 目录名
 * @returns {boolean}
 */
export async function createDirectory(dirName, parentDir) {
    if (!dirName || !dirName.trim()) return false;
    const cleanName = dirName.trim().replace(/[<>:"\/\\|?*]/g, '_');
    const parent = parentDir || '/';
    const dirPath = parent.replace(/\/$/, '') + '/' + cleanName + '/';
    await createDirWithFile(dirPath);
    return true;
}

/**
 * 删除目录及所有子目录/文件
 * @param {string} dirPath - 目录路径
 */
export async function deleteDirectory(dirPath) {
    await removeDirectoryRecursive(dirPath);
}

/**
 * 获取目录列表（从虚拟目录列表 + 注册表提取）
 * @returns {Array<{path: string, name: string}>}
 */
export function getDirectoryList() {
    const dirs = new Set(getDirectories());

    // 从注册表中补充目录（兼容旧数据）
    const registry = getRegistryEntries();
    registry.forEach(r => {
        if (r.directory) {
            dirs.add(r.directory);
            const parts = r.directory.split('/').filter(Boolean);
            let path = '';
            for (const p of parts) {
                path += '/' + p;
                dirs.add(path + '/');
            }
        }
    });

    return [...dirs].sort().map(d => ({
        path: d,
        name: d === '/' ? '/' : d.split('/').filter(Boolean).pop() || '/',
    }));
}

/**
 * 获取目录中的文件列表
 * @param {string} dirPath
 * @returns {Array}
 */
export { getFilesInDirectory } from '../core/data.js';
