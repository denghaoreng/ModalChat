// matcher/utils.js — 加权随机选择 + 正则工具

/**
 * 加权随机选择
 * @param {Array<{weight?: number}>} images
 * @returns {object|null}
 */
export function selectImageByWeight(images) {
    if (!images || images.length === 0) return null;
    const totalWeight = images.reduce((sum, img) => sum + (img.weight || 0), 0);
    if (totalWeight <= 0) return null;
    let random = Math.random() * totalWeight;
    for (const img of images) {
        random -= (img.weight || 0);
        if (random <= 0) return img;
    }
    return images[images.length - 1];
}

/**
 * 从输入中提取正则模式（去除 / 定界符和 flags）
 * @param {string} input
 * @returns {string}
 */
export function sanitizeRegex(input) {
    if (!input) return '';
    let pattern = input.trim();
    if (pattern.startsWith('/')) {
        let lastSlashIndex = -1;
        for (let i = pattern.length - 1; i > 0; i--) {
            if (pattern[i] === '/' && pattern[i - 1] !== '\\') {
                lastSlashIndex = i;
                break;
            }
        }
        if (lastSlashIndex > 0) {
            pattern = pattern.substring(1, lastSlashIndex);
        }
    }
    return pattern;
}
