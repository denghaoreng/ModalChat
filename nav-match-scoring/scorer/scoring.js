// scoring.js — 评分编排：单文件评分 + 主入口

import { getMSFiles as getEnabledFiles, getMSConfig as getConfig, getStopWords, getRelations, getTypeVideoKeywords, getTypeImageKeywords, getTypeAudioKeywords } from '../../core/data.js';

import { cleanText } from './text.js';
import { detectFileTypeKeywords } from './type.js';
import { calculateNgramScore, countTotalFrags } from './ngram.js';
import { calculateTagScore } from './tag.js';
import { calculateTypeScore, calculateTypeContextScore } from './type.js';
import { calculateRelationScore } from './relation.js';
import { calculateCharFuzzyScore } from './fuzzy.js';
import { calculateStopWordScore } from './stopwords.js';

// ==================== 单文件评分 ====================

/**
 * 计算单个文件的总分
 * @param {object} file - 文件对象
 * @param {string} cleanedAi - 清洗后的 AI 回答
 * @param {string} cleanedUser - 清洗后的用户提问
 * @param {object} aiTypeKeywords - AI 文本中的类型关键词标记
 * @param {object} userTypeKeywords - 用户文本中的类型关键词标记
 * @param {object} config - 权重配置
 * @param {Array} relations - 关联词列表
 * @returns {object} 评分详情
 */
function calculateFileScore(file, cleanedAi, cleanedUser, rawAi, rawUser,
    aiTypeKeywords, userTypeKeywords, config, relations, stopWords, videoKeywords, imageKeywords) {

    const {
        aiResponseWeight = 60,
        userQuestionWeight = 40,
    } = config;

    // ── 创建 matchTracker 在评分过程中收集所有命中的 N-gram 片段 ──
    // 消除 countMatchedNgramFragments 的独立遍历（-33% includes() 调用）
    const matchTracker = new Set();

    // 计算 AI 回答的匹配分数（同时追踪匹配片段）
    const aiScore = calculateSourceScore(
        file, cleanedAi, aiTypeKeywords, config, relations, stopWords, matchTracker
    );

    // 计算用户提问的匹配分数（共享 matchTracker，Set 天然去重）
    const userScore = calculateSourceScore(
        file, cleanedUser, userTypeKeywords, config, relations, stopWords, matchTracker
    );

    // 5. 图片视频偏好（根据文件类型直接应用偏好权重）
    const typeContextScore = calculateTypeContextScore(file, config);

    // 加权合成总分（aiScore+userScore 已含来源权重，typeContextScore 额外加上）
    let rawTotal = (aiScore * aiResponseWeight / 100) +
                   (userScore * userQuestionWeight / 100) +
                   typeContextScore;

    // ⭐ 基于匹配密度的归一化
    //
    // 原理：
    //   1. 按总片段数归一化 → 消除文件大小造成的分数差异（四次方根 /2）
    //   2. 密度奖励：阈值根据文件片段数动态调整
    //      短文件（≤16片段）需 50% 以上密度才能获奖
    //      长文件（500片段）只需约 9% 密度即可获奖
    //      公式: threshold = min(0.5, 2/sqrt(total))
    //
    // 这样：
    //   - 「精准命中短文件」密度极高 → 获得温和奖励
    //   - 「内容丰富长文件」虽密度不高但匹配数多 → 归一化后分数自然高
    //   - 「偶然命中大文件」密度低 → 被归一化压制 + 密度惩罚
    //
    // matched 由 calculateNgramScore 通过 matchTracker 自动收集
    // totalFrags 从索引元数据 O(1) 读取，无需遍历
    const ngram = file.ngramIndex;
    const matched = matchTracker.size;
    const totalFrags = countTotalFrags(ngram);
    if (totalFrags > 4) {
        // 1. 按片段总数归一化（四次方根 /2，温和曲线）
        const normFactor = Math.pow(totalFrags, 1 / 4) / 2;
        rawTotal = rawTotal / normFactor;

        // 2. 密度三区调节：纯曲线，无硬编码常量
        //
        //    阈值曲线: threshold = 0.5 / (1 + sqrt(totalFrags / 8))
        //    - 10片段 → 0.24   25片段 → 0.18   50片段 → 0.14   500片段 → 0.06
        //    - 无上限封顶，完全连续
        //
        //    灰色地带宽度 = threshold × 0.8（占阈值 80%，比之前更宽）
        //    - 下界 = threshold × 0.2
        //    - 上界 = threshold × 1.8
        //
        //     ┌──────────┬──────────────┬──────────┐
        //     │  惩罚区   │   灰色地带    │  奖励区   │
        //     │  ×0.15~1  │    ×1.0     │  ×1.0~1.5 │
        //     └────┬─────┴──────┬──────┴─────┬────┘
        //         0        0.2T     T    1.8T      1.0
        //
        const threshold = 0.5 / (1 + Math.sqrt(totalFrags / 8));
        const density = matched / totalFrags;
        const lowerGray = threshold * 0.2;
        const upperGray = threshold * 1.8;

        if (density > upperGray) {
            // █ 奖励区：density > 上界
            const rewardFactor = Math.pow(density / upperGray, 0.33);
            rawTotal = rawTotal * Math.min(rewardFactor, 1.5);
        } else if (density >= lowerGray) {
            // █ 灰色地带：不奖不罚
        } else {
            // █ 惩罚区：density < 下界
            //    曲线: factor = (density / lowerGray) ^ 0.7
            //    密度=0 时保底 0.15（不完全归零）
            const penaltyFactor = Math.pow(density / lowerGray, 0.7);
            rawTotal = rawTotal * Math.max(penaltyFactor, 0.15);
        }
    }

    // ⭐ 应用文件权重（用户可调，默认 1，作为最终乘数）
    const fileWeight = file.weight ?? 1;
    let total = rawTotal * fileWeight;

    // ⭐ 随机抖动：基于 randomJitter 添加 ±jitter% 的随机波动
    //    让分数相近的文件每次匹配排名略有不同，增加结果多样性
    //    默认 5%，范围 0~20%
    const jitter = config.randomJitter ?? 0.05;
    if (jitter > 0) {
        total = total * (1 + (Math.random() - 0.5) * 2 * jitter);
    }

    return {
        total: Math.round(total * 100) / 100,
        aiScore: Math.round(aiScore * 100) / 100,
        userScore: Math.round(userScore * 100) / 100,
    };
}

/**
 * 计算一个来源（AI回答或用户提问）的匹配分数
 * @param {Set} [matchTracker] - 传递给 calculateNgramScore 用于跨来源去重追踪
 */
function calculateSourceScore(file, cleanedText, typeKeywords, config, relations, stopWords, matchTracker) {
    if (!cleanedText) return 0;

    let score = 0;

    // 1. 内容分词匹配（精确，含单字词）—— 同时追踪匹配片段
    score += calculateNgramScore(file, cleanedText, config, matchTracker);

    // 2. 标签匹配（精确）
    score += calculateTagScore(file, cleanedText, config);

    // 3. 文件类型匹配
    score += calculateTypeScore(file, typeKeywords, config);

    // 4. 关联词匹配（用户配置的显式关联）
    score += calculateRelationScore(file, cleanedText, relations, config);

    // 5. 字符模糊匹配（自动发现共享字符的相似词）
    score += calculateCharFuzzyScore(file, cleanedText, config);

    // 6. 停用词匹配（停用词不再被过滤，而是以独立权重计分）
    score += calculateStopWordScore(file, cleanedText, stopWords, config);

    return score;
}

// ==================== 主入口 ====================

/**
 * 对 AI 回答和用户提问执行完整评分
 * @param {string} aiMessage - AI 的最后一次回答文本
 * @param {string} userMessage - 用户的最后一次提问文本
 * @returns {Array<{file: object, totalScore: number, details: object}>} 按总分降序排列
 */
export function scoreMessages(aiMessage, userMessage) {
    const files = getEnabledFiles();
    if (files.length === 0) return [];

    const config = getConfig();
    const stopWords = getStopWords();
    const relations = getRelations();
    const videoKeywords = getTypeVideoKeywords();
    const imageKeywords = getTypeImageKeywords();
    const audioKeywords = getTypeAudioKeywords();

    // 预处理文本（cleanText 不再过滤停用词，停用词改为单独计分）
    const cleanedAi = cleanText(aiMessage || '');
    const cleanedUser = cleanText(userMessage || '');

    // 检测提及的文件类型关键词
    const aiTypeKeywords = detectFileTypeKeywords(cleanedAi, videoKeywords, imageKeywords, audioKeywords);
    const userTypeKeywords = detectFileTypeKeywords(cleanedUser, videoKeywords, imageKeywords, audioKeywords);

    // 为每个文件计算分数
    const results = files.map(file => {
        const details = calculateFileScore(
            file, cleanedAi, cleanedUser, aiMessage, userMessage,
            aiTypeKeywords, userTypeKeywords,
            config, relations, stopWords, videoKeywords, imageKeywords
        );
        return {
            file,
            totalScore: details.total,
            details,
        };
    });

    // 按总分降序排列（稳定排序，同分时保留原始顺序）
    results.sort((a, b) => b.totalScore - a.totalScore);

    // Fisher-Yates 同分洗牌：对每组同分文件内部随机打乱
    // 避免原 Math.random() 比较器导致 TimSort 未定义行为
    for (let i = 0; i < results.length; ) {
        let j = i + 1;
        while (j < results.length && results[j].totalScore === results[i].totalScore) j++;
        for (let k = j - 1; k > i; k--) {
            const swap = i + Math.floor(Math.random() * (k - i + 1));
            [results[k], results[swap]] = [results[swap], results[k]];
        }
        i = j;
    }
    return results;
}

/**
 * 从全量结果中过滤出适合聊天气泡展示的结果
 * 应用最低分数阈值 + Top-N 截断
 * @param {Array} results - scoreMessages 返回的全量结果
 * @param {object} config - 权重配置（可选，不传则自动获取）
 * @returns {Array} 过滤后的结果
 */
export function filterResultsForChat(results, config) {
    if (!results || results.length === 0) return [];
    if (!config) config = getConfig();

    const minScore = config.minScore || 0;
    const topN = config.topN || 3;

    let filtered = results;
    if (minScore > 0) {
        filtered = results.filter(r => r.totalScore >= minScore);
    }

    return filtered.slice(0, topN);
}
