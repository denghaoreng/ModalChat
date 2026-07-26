// shared/utils.js — 通用工具函数

/**
 * 生成唯一 ID
 * @param {string} prefix - ID 前缀
 * @returns {string}
 */
export function generateId(prefix = 'id') {
    const now = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    const dateStr = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
    const rand = Math.floor(100000 + Math.random() * 900000);
    return `${prefix}_${dateStr}_${rand}`;
}

/**
 * HTML 转义
 * @param {string} str
 * @returns {string}
 */
export function escapeHtml(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

/**
 * 文件扩展名常量
 */
export const AUDIO_EXTS = ['mp3','wav','ogg','flac','aac','m4a','wma'];
export const VIDEO_EXTS = ['mp4','webm','avi','mov','mkv','flv'];
export const IMAGE_EXTS = ['jpg','jpeg','png','gif','webp','bmp','svg'];

/**
 * 根据文件路径推断类型
 * @param {string} filePath - 文件路径或 URL
 * @returns {'audio'|'video'|'image'}
 */
export function detectFileType(filePath) {
    const ext = (filePath || '').split('.').pop().toLowerCase();
    if (AUDIO_EXTS.includes(ext)) return 'audio';
    if (VIDEO_EXTS.includes(ext)) return 'video';
    return 'image';
}

/**
 * 获取文件类型对应的 FontAwesome 图标
 * @param {string} type - 'audio'|'video'|'image'
 * @returns {string}
 */
export function getFileTypeIcon(type) {
    if (type === 'video') return 'fa-video';
    if (type === 'audio') return 'fa-music';
    return 'fa-image';
}

/**
 * 图片类型判断
 */
export function isImageType(mimeType) {
    return /^image\//.test(mimeType);
}

export function isVideoType(mimeType) {
    return /^video\//.test(mimeType);
}

/**
 * 格式化文件大小
 * @param {number} bytes
 * @returns {string}
 */
export function formatFileSize(bytes) {
    if (!bytes) return '0 B';
    const units = ['B', 'KB', 'MB', 'GB'];
    let i = 0;
    let size = bytes;
    while (size >= 1024 && i < units.length - 1) {
        size /= 1024;
        i++;
    }
    return `${size.toFixed(1)} ${units[i]}`;
}

/**
 * 格式化日期
 * @param {number} timestamp
 * @returns {string}
 */
export function formatDate(timestamp) {
    if (!timestamp) return '';
    const d = new Date(timestamp);
    const pad = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/**
 * 防抖
 */
export function debounce(fn, delay = 250) {
    let timer = null;
    return function (...args) {
        clearTimeout(timer);
        timer = setTimeout(() => fn.apply(this, args), delay);
    };
}

/**
 * 生成唯一服务端文件名
 * @param {string} originalName - 原始文件名
 * @param {string} prefix - 前缀（ChatImages_ / MatchScoring_ / MM_）
 * @returns {string}
 */
export function generateServerFilename(originalName, prefix = 'MM_') {
    const ext = originalName.split('.').pop() || 'png';
    const now = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    const dateStr = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
    const rand = Math.floor(100000 + Math.random() * 900000);
    return `${prefix}${dateStr}_${rand}.${ext}`;
}

/**
 * 十六进制颜色转 RGB 字符串
 * @param {string} hex
 * @returns {string}
 */
export function hexToRgb(hex) {
    if (!hex) return '0,0,0';
    const c = hex.replace('#', '');
    const r = parseInt(c.substring(0, 2), 16);
    const g = parseInt(c.substring(2, 4), 16);
    const b = parseInt(c.substring(4, 6), 16);
    return `${r},${g},${b}`;
}
