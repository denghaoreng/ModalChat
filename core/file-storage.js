// file-storage.js — 文件 I/O 层：通过 SillyTavern 文件 API 读写 JSON
// 无状态，纯工具函数

import { getContext } from '../../../../extensions.js';

export const MODULE_NAME = 'modal-chat';
export const FILE_PREFIX = 'ModalChat_';
export const FILES = {
    settings:   FILE_PREFIX + 'settings.json',
    chatImages: FILE_PREFIX + 'chat-images_data.json',
    matchScore: FILE_PREFIX + 'match-scoring_data.json',
    regIndex:   FILE_PREFIX + 'reg-index.json',
};
const DIR_PREFIX = FILE_PREFIX + 'dir_';

/**
 * 服务端路由 /user/files/* → req.user.directories.files = data/default-user/user/files/
 * 上传 API 返回 path: 'user/files/{name}'（相对于 SillyTavern 根目录）
 */
export const FILES_ROOT = '/user/files/';
export const FULL_PATH_PREFIX = 'user/files/';

/** 简单字符串哈希（6位hex，确定性，无字符问题） */
export function hashStr(s) {
    let h = 0;
    for (let i = 0; i < s.length; i++) {
        h = ((h << 5) - h) + s.charCodeAt(i);
        h = h & h;
    }
    return Math.abs(h >>> 0).toString(16).padStart(6, '0').slice(0, 6);
}

/** 目录路径 → 安全唯一文件名（基于哈希） */
export function dirFile(dir) {
    return DIR_PREFIX + hashStr(dir) + '.json';
}

function getHeaders() {
    const { getRequestHeaders } = getContext();
    return getRequestHeaders();
}

/**
 * 读 JSON：直接通过静态 URL fetch
 */
export async function readJSON(name) {
    try {
        const r = await fetch(FILES_ROOT + name);
        if (r.ok) return await r.json();
    } catch (e) { /* 首次使用或文件不存在 */ }
    return null;
}

/**
 * 写 JSON：通过上传 API 写入
 */
export async function writeJSON(name, data) {
    try {
        const s = JSON.stringify(data);
        const b64 = btoa(unescape(encodeURIComponent(s)));
        const r = await fetch('/api/files/upload', {
            method: 'POST', headers: getHeaders(),
            body: JSON.stringify({ name, data: b64 }),
        });
        return r.ok;
    } catch (e) { console.error('ModalChat: write fail', name, e); return false; }
}

/** 删除文件 */
export async function deleteFile(path) {
    try {
        await fetch('/api/files/delete', {
            method: 'POST', headers: getHeaders(),
            body: JSON.stringify({ path }),
        });
    } catch (e) { /* 忽略 */ }
}
