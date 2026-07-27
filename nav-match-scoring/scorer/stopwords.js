// stopwords.js — 停用词匹配

/**
 * 计算停用词匹配分数
 * 停用词不再被过滤掉，而是以独立权重参与评分。
 * 当文件内容中出现的停用词也出现在查询文本中时，每个匹配词计分。
 * @param {object} file - 文件对象
 * @param {string} cleanedText - 清洗后的查询文本（仍包含停用词）
 * @param {string[]} stopWords - 停用词列表
 * @param {object} config - 权重配置
 * @returns {number} 停用词匹配分数
 */
export function calculateStopWordScore(file, cleanedText, stopWords, config) {
    if (!stopWords || stopWords.length === 0) return 0;
    const { stopWordWeight = 0.2 } = config;
    if (stopWordWeight <= 0) return 0;

    const fileContent = file.content || '';
    if (!fileContent) return 0;

    const stopSet = new Set(stopWords);
    let matchCount = 0;
    const matched = new Set();

    // 遍历文件内容中的每个字符，检查是否为停用词且出现在查询文本中
    for (const ch of fileContent) {
        if (matched.has(ch)) continue;
        if (stopSet.has(ch) && cleanedText.includes(ch)) {
            matchCount++;
            matched.add(ch);
        }
    }

    return matchCount * stopWordWeight;
}
