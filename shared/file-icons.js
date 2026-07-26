// shared/file-icons.js — 文件图标和类型标签工具

/** 文件图标映射 */
export const FILE_ICON_MAP = {
    png: '📷', jpg: '📷', jpeg: '📷', gif: '📷', webp: '📷', bmp: '📷', svg: '📷', ico: '📷',
    mp4: '🎬', webm: '🎬', avi: '🎬', mov: '🎬', mkv: '🎬', flv: '🎬', wmv: '🎬',
    mp3: '🎵', wav: '🎵', ogg: '🎵', flac: '🎵', aac: '🎵', wma: '🎵', m4a: '🎵',
    pdf: '📄', doc: '📄', docx: '📄', xls: '📄', xlsx: '📄', ppt: '📄', pptx: '📄', txt: '📄',
};

/** 获取文件类型显示文本 */
export function getTypeLabel(entry) {
    if (entry._isDir) return '文件夹';
    const name = entry.serverFilename || entry.originalName || '';
    const dot = name.lastIndexOf('.');
    return dot > 0 ? name.slice(dot + 1) : entry.type;
}

/** 获取文件图标 */
export function getFileIcon(entry) {
    if (entry._isDir) return '📁';
    const name = entry.serverFilename || entry.originalName || '';
    const dot = name.lastIndexOf('.');
    const ext = dot > 0 ? name.slice(dot + 1).toLowerCase() : '';
    return FILE_ICON_MAP[ext] || '❓';
}
