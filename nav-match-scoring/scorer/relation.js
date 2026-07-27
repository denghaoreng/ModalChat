// relation.js — 关联词匹配

/**
 * 计算关联词匹配分数
 * @param {object} file - 文件对象
 * @param {string} cleanedText - 清洗后的文本
 * @param {Array} relations - 关联词列表
 * @param {object} config - 权重配置
 * @returns {number} 匹配分数
 */
export function calculateRelationScore(file, cleanedText, relations, config) {
    if (!relations || relations.length === 0) return 0;
    const { relationWeight = 1.2 } = config;
    if (relationWeight <= 0) return 0;

    const fileContent = file.content || '';
    let matchCount = 0;

    for (const rel of relations) {
        // 正向匹配：文本中有 from，文件内容中有 to
        if (cleanedText.includes(rel.from) && fileContent.includes(rel.to)) {
            matchCount++;
        }
        // 反向匹配：文本中有 to，文件内容中有 from
        if (cleanedText.includes(rel.to) && fileContent.includes(rel.from)) {
            matchCount++;
        }
    }

    return matchCount * relationWeight;
}
