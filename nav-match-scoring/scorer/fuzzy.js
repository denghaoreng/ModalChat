// fuzzy.js — 字符模糊匹配

import { ensureNgramIndex } from './ngram.js';

/**
 * 字符模糊匹配算法
 *
 * 核心思想：不要求子串完全匹配，而是计算 N-gram 与查询文本的字符重叠度。
 * 例如文件内容有"兔耳女"，查询文本有"兔女郎"：
 *   "兔耳女"的字符集 = {兔, 耳, 女}
 *   在查询文本中出现的字符 = {兔, 女} = 2 个
 *   重叠率 = 2/3 ≈ 66.7%
 *   如果阈值设为 50%，则视为匹配成功！
 *
 * 这样"兔女郎→兔耳女"无需手动配置关联词即可自动识别。
 *
 * @param {object} file - 文件对象
 * @param {string} cleanedText - 清洗后的查询文本
 * @param {object} config - 权重配置
 * @returns {number} 模糊匹配分数
 */
export function calculateCharFuzzyScore(file, cleanedText, config) {
    const ngram = ensureNgramIndex(file);
    if (!ngram) return 0;

    const {
        charFuzzyWeight = 1.2,
        charFuzzyThreshold = 0.50,
    } = config;

    if (charFuzzyWeight <= 0 || charFuzzyThreshold <= 0) return 0;
    if (charFuzzyThreshold > 1) return 0;

    const queryChars = new Set(cleanedText);
    if (queryChars.size === 0) return 0;

    let fuzzyMatchCount = 0;
    const flat = ngram._flat;
    const charSets = ngram._charSets;
    if (!flat || !charSets) return 0;

    for (let i = 0; i < flat.length; i++) {
        const fragment = flat[i];
        // 精确匹配已由 calculateNgramScore 处理，跳过
        if (cleanedText.includes(fragment)) continue;

        // 用预计算的字符集计算重叠率，避免重复遍历 fragment 字符
        const fragSet = charSets[i];
        let matchCount = 0;
        for (const ch of fragment) {
            if (queryChars.has(ch)) matchCount++;
        }
        const overlapRatio = matchCount / fragment.length;

        if (overlapRatio >= charFuzzyThreshold) {
            fuzzyMatchCount++;
        }
    }

    return fuzzyMatchCount * charFuzzyWeight;
}

/**
 * 计算一个片段与查询文本字符集的字符重叠率
 * @param {string} fragment - N-gram 片段
 * @param {Set} queryChars - 查询文本的字符集
 * @returns {number} 重叠率 (0~1)
 */
export function calculateCharOverlap(fragment, queryChars) {
    if (!fragment || fragment.length === 0) return 0;

    let matchCount = 0;
    for (const ch of fragment) {
        if (queryChars.has(ch)) {
            matchCount++;
        }
    }

    return matchCount / fragment.length;
}
