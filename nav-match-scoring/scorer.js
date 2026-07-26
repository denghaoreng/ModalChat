// scorer.js — 评分引擎：N-gram 分词、多维匹配、加权评分、Top-N 排行

import { getMSFiles as getEnabledFiles, getMSConfig as getConfig, getStopWords, getRelations, getTypeVideoKeywords, getTypeImageKeywords, getTypeAudioKeywords, getMatchScoringData } from '../data.js';

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

    // 按总分降序排列，同分时随机排序（避免相同分数的文件排名固定）
    results.sort((a, b) => {
        const diff = b.totalScore - a.totalScore;
        if (diff !== 0) return diff;
        return Math.random() - 0.5;
    });
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

// ==================== 文本预处理 ====================

/**
 * 清洗文本：只去除标点符号和空白，**不再过滤停用词**
 * 停用词改为单独计算权重（见 calculateStopWordScore）
 * @param {string} text - 原始文本
 * @returns {string} 清洗后的文本
 */
export function cleanText(text) {
    if (!text) return '';

    // 1. 去除标点符号和特殊字符
    let cleaned = text.replace(
        /[，。！？、；：""''「」【】《》（）\-\+\=\[\]\{\}\|\\\/\~\`\@\#\$\%\^\&\*\(\)\n\r\t]/g,
        ' '
    );

    // 2. 去除多余空白
    cleaned = cleaned.replace(/\s+/g, ' ');

    // 3. 合并为连续字符串（停用词不再移除，留待单独计分）
    return cleaned.split(' ').join('');
}

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

    // 计算 AI 回答的匹配分数
    const aiScore = calculateSourceScore(
        file, cleanedAi, aiTypeKeywords, config, relations, stopWords
    );

    // 计算用户提问的匹配分数
    const userScore = calculateSourceScore(
        file, cleanedUser, userTypeKeywords, config, relations, stopWords
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
    const ngram = file.ngramIndex;
    const { matched, total: totalFrags } = countMatchedNgramFragments(ngram, cleanedAi, cleanedUser);
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
 */
function calculateSourceScore(file, cleanedText, typeKeywords, config, relations, stopWords) {
    if (!cleanedText) return 0;

    let score = 0;

    // 1. 内容分词匹配（精确，含单字词）
    score += calculateNgramScore(file, cleanedText, config);

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

// ==================== N-gram 分词匹配 ====================

/**
 * 从 content 构建 N-gram 索引（如果尚未构建）
 * @param {object} file - 文件对象
 */
function ensureNgramIndex(file) {
    if (file.ngramIndex) return file.ngramIndex;
    if (!file.content) return null;
    const cleaned = file.content.replace(/\s+/g, '');
    if (cleaned.length === 0) return null;
    const result = { unigram: [], bigram: [], trigram: [], tetragram: [], pentagram: [] };
    const len = cleaned.length;
    for (let i = 0; i < len; i++) {
        result.unigram.push(cleaned[i]);
        if (i + 2 <= len) result.bigram.push(cleaned.slice(i, i + 2));
        if (i + 3 <= len) result.trigram.push(cleaned.slice(i, i + 3));
        if (i + 4 <= len) result.tetragram.push(cleaned.slice(i, i + 4));
        if (i + 5 <= len) result.pentagram.push(cleaned.slice(i, i + 5));
    }
    result.unigram = [...new Set(result.unigram)];
    result.bigram = [...new Set(result.bigram)];
    result.trigram = [...new Set(result.trigram)];
    result.tetragram = [...new Set(result.tetragram)];
    result.pentagram = [...new Set(result.pentagram)];
    file.ngramIndex = result;
    return result;
}

/**
 * 计算内容分词的 N-gram 匹配分数
 * @param {object} file - 文件对象
 * @param {string} cleanedText - 清洗后的文本
 * @param {object} config - 权重配置
 * @returns {number} 匹配分数
 */
export function calculateNgramScore(file, cleanedText, config) {
    const ngram = ensureNgramIndex(file);
    if (!ngram) return 0;

    const {
        unigramWeight = 0.3,
        bigramWeight = 1.0,
        trigramWeight = 1.5,
        tetragramWeight = 0.8,
        pentagramWeight = 0.5,
    } = config;

    let score = 0;

    if (ngram.unigram && unigramWeight > 0) {
        const count = countMatches(ngram.unigram, cleanedText);
        score += count * unigramWeight;
    }

    if (ngram.bigram && bigramWeight > 0) {
        const count = countMatches(ngram.bigram, cleanedText);
        score += count * bigramWeight;
    }

    if (ngram.trigram && trigramWeight > 0) {
        const count = countMatches(ngram.trigram, cleanedText);
        score += count * trigramWeight;
    }

    if (ngram.tetragram && tetragramWeight > 0) {
        const count = countMatches(ngram.tetragram, cleanedText);
        score += count * tetragramWeight;
    }

    if (ngram.pentagram && pentagramWeight > 0) {
        const count = countMatches(ngram.pentagram, cleanedText);
        score += count * pentagramWeight;
    }

    return score;
}

/**
 * 统计子串列表在文本中的出现次数（去重计数）
 * @param {string[]} substrings - 子串列表
 * @param {string} text - 目标文本
 * @returns {number} 匹配数
 */
export function countMatches(substrings, text) {
    if (!substrings || !substrings.length || !text) return 0;
    const matched = new Set();
    for (const sub of substrings) {
        if (text.includes(sub)) {
            matched.add(sub);
        }
    }
    return matched.size;
}

// ==================== 标签匹配 ====================

/**
 * 计算标签匹配分数
 * @param {object} file - 文件对象
 * @param {string} cleanedText - 清洗后的文本
 * @param {object} config - 权重配置
 * @returns {number} 匹配分数
 */
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

// ==================== 文件类型匹配 ====================

/**
 * 从文本中检测提及的文件类型关键词
 * @param {string} text - 清洗后的文本
 * @param {string} videoKeywords - 视频适配词字符串（空格分隔）
 * @param {string} imageKeywords - 图片适配词字符串（空格分隔）
 * @returns {{image: boolean, video: boolean}}
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

// ==================== 上下文类型偏好 ====================

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

// ==================== 关联词匹配 ====================

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

// ==================== 字符模糊匹配 ====================

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

    // 将查询文本转为字符 Set，供 O(1) 查找
    const queryChars = new Set(cleanedText);
    if (queryChars.size === 0) return 0;

    let fuzzyMatchCount = 0;
    const matchedNgrams = new Set(); // 去重

    // 收集所有 N-gram 粒度（按长度降序，优先匹配更长的片段）
    const allNgrams = [
        ...(ngram.pentagram || []),
        ...(ngram.tetragram || []),
        ...(ngram.trigram || []),
        ...(ngram.bigram || []),
    ];

    for (const fragment of allNgrams) {
        if (matchedNgrams.has(fragment)) continue;
        if (fragment.length < 2) continue;

        // 精确匹配已由 calculateNgramScore 处理，这里只做模糊匹配
        if (cleanedText.includes(fragment)) continue;

        // 计算字符重叠率
        const overlapRatio = calculateCharOverlap(fragment, queryChars);

        if (overlapRatio >= charFuzzyThreshold) {
            fuzzyMatchCount++;
            matchedNgrams.add(fragment);
        }
    }

    return fuzzyMatchCount * charFuzzyWeight;
}

/**
 * 统计 N-gram 索引中实际命中的片段数和总片段数
 * @param {object} ngram - N-gram 索引
 * @param {string} cleanedAi - 清洗后的 AI 文本
 * @param {string} cleanedUser - 清洗后的用户文本
 * @returns {{matched: number, total: number}}
 */
function countMatchedNgramFragments(ngram, cleanedAi, cleanedUser) {
    if (!ngram) return { matched: 0, total: 0 };
    let matched = 0;
    let total = 0;
    const combinedText = cleanedAi + cleanedUser;
    const levels = ['unigram', 'bigram', 'trigram', 'tetragram', 'pentagram'];
    for (const level of levels) {
        const fragments = ngram[level];
        if (!fragments || fragments.length === 0) continue;
        total += fragments.length;
        for (const f of fragments) {
            if (combinedText.includes(f)) matched++;
        }
    }
    return { matched, total };
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

// ==================== 停用词匹配 ====================

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

// ==================== 缓存管理 ====================

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
