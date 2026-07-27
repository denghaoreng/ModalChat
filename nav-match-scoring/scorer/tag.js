// tag.js — 标签匹配（支持普通标签和正则标签）

// ==================== 正则标签工具 ====================

/**
 * 判断标签是否为正则表达式（以 / 开头和结尾，如 /战.*斗/gi）
 */
function isRegexTag(tag) {
    return tag.startsWith('/') && tag.length > 2 && tag.lastIndexOf('/') > 0;
}

/**
 * 解析正则标签，返回 { pattern, flags }
 * @param {string} tag - 如 "/战.*斗/gi"
 * @returns {{pattern: string, flags: string}|null}
 */
function parseRegexTag(tag) {
    const lastSlash = tag.lastIndexOf('/');
    if (lastSlash <= 0) return null;
    const pattern = tag.slice(1, lastSlash);
    const flags = tag.slice(lastSlash + 1);
    if (!pattern) return null;
    return { pattern, flags };
}

// ==================== 标签匹配 ====================

/**
 * 计算标签匹配分数
 * @param {object} file - 文件对象
 * @param {string} cleanedText - 清洗后的文本
 * @param {object} config - 权重配置
 * @returns {number} 匹配分数
 */
export function calculateTagScore(file, cleanedText, config) {
    if (!file.tagList || file.tagList.length === 0) return 0;
    const { tagWeight = 2.0 } = config;
    if (tagWeight <= 0) return 0;

    let matchCount = 0;
    for (const tag of file.tagList) {
        if (isRegexTag(tag)) {
            const parsed = parseRegexTag(tag);
            if (parsed) {
                try {
                    const regex = new RegExp(parsed.pattern, parsed.flags);
                    if (regex.test(cleanedText)) matchCount++;
                } catch (e) {
                    // 无效正则，降级为普通文本匹配
                    if (cleanedText.includes(tag)) matchCount++;
                }
            }
        } else {
            if (cleanedText.includes(tag)) {
                matchCount++;
            }
        }
    }

    return matchCount * tagWeight;
}
