// index.js — 评分引擎 re-export hub
// 按功能域拆分到以下子模块：
//   scoring.js  — 评分编排（主入口）
//   text.js      — 文本预处理
//   ngram.js     — N-gram 索引与匹配
//   tag.js       — 标签匹配
//   type.js      — 文件类型匹配与类型偏好
//   relation.js  — 关联词匹配
//   fuzzy.js     — 字符模糊匹配
//   stopwords.js — 停用词匹配
//   cache.js     — 评分缓存

export { scoreMessages, filterResultsForChat } from './scoring.js';
export { cleanText } from './text.js';
export { calculateNgramScore, countMatches } from './ngram.js';
export { calculateTagScore } from './tag.js';
export { detectFileTypeKeywords, calculateTypeScore, calculateTypeContextScore } from './type.js';
export { calculateRelationScore } from './relation.js';
export { calculateCharFuzzyScore, calculateCharOverlap } from './fuzzy.js';
export { calculateStopWordScore } from './stopwords.js';
export { getLastResults, setLastResults, clearLastResults } from './cache.js';
