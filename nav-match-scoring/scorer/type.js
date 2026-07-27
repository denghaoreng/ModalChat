// type.js — 文件类型匹配与上下文类型偏好

/**
 * 从文本中检测提及的文件类型关键词
 * @param {string} text - 清洗后的文本
 * @param {string} videoKeywords - 视频适配词字符串（空格分隔）
 * @param {string} imageKeywords - 图片适配词字符串（空格分隔）
 * @param {string} audioKeywords - 音频适配词字符串（空格分隔）
 * @returns {{image: boolean, video: boolean, audio: boolean}}
 */
export function detectFileTypeKeywords(text, videoKeywords, imageKeywords, audioKeywords) {
    const result = { image: false, video: false, audio: false };
    if (!text) return result;

    const keywords = {
        video: (videoKeywords || '').split(/\s+/).filter(Boolean),
        image: (imageKeywords || '').split(/\s+/).filter(Boolean),
        audio: (audioKeywords || '').split(/\s+/).filter(Boolean),
    };

    for (const type of ['image', 'video', 'audio']) {
        for (const keyword of keywords[type]) {
            if (text.includes(keyword)) {
                result[type] = true;
                break;
            }
        }
    }
    return result;
}

/**
 * 计算文件类型匹配分数
 * @param {object} file - 文件对象
 * @param {{image: boolean, video: boolean}} typeKeywords - 类型关键词标记
 * @param {object} config - 权重配置
 * @returns {number} 匹配分数
 */
export function calculateTypeScore(file, typeKeywords, config) {
    // 兼容新旧字段名：优先用 adapterWordWeight，回退到 fileTypeWeight
    const weight = config.adapterWordWeight ?? config.fileTypeWeight ?? 0.5;
    if (weight <= 0) return 0;

    if (typeKeywords && typeKeywords[file.type]) {
        return weight;
    }
    return 0;
}

/**
 * 计算图片视频偏好分数
 * 不再依赖对话中的适配词，直接根据文件类型应用偏好权重
 * @param {object} file - 文件对象
 * @param {object} config - 权重配置
 * @returns {number} 类型偏好加分
 */
export function calculateTypeContextScore(file, config) {
    const { imagePreferWeight = 1.5, videoPreferWeight = 1.5, audioPreferWeight = 1.5 } = config;

    if (file.type === 'video' && videoPreferWeight > 0) {
        return videoPreferWeight;
    }
    if (file.type === 'image' && imagePreferWeight > 0) {
        return imagePreferWeight;
    }
    if (file.type === 'audio' && audioPreferWeight > 0) {
        return audioPreferWeight;
    }

    return 0;
}
