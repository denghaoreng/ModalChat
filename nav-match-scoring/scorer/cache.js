// cache.js — 评分结果缓存管理

/** @type {Array|null} 上次评分结果缓存 */
let lastResults = null;

/** @type {string} 上次 AI 文本缓存 */
let lastAiText = '';

/** @type {string} 上次用户文本缓存 */
let lastUserText = '';

/**
 * 获取上次评分结果
 * @returns {Array|null}
 */
export function getLastResults() {
    return lastResults;
}

/**
 * 设置上次评分结果
 * @param {Array} results
 * @param {string} aiText
 * @param {string} userText
 */
export function setLastResults(results, aiText, userText) {
    lastResults = results;
    lastAiText = aiText;
    lastUserText = userText;
}

/**
 * 清除评分缓存
 */
export function clearLastResults() {
    lastResults = null;
    lastAiText = '';
    lastUserText = '';
}
