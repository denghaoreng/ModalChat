// ngram.js — N-gram 索引构建与分词匹配

// ==================== N-gram 索引构建 ====================

/**
 * 从 content 构建 N-gram 索引（如果尚未构建）
 * @param {object} file - 文件对象
 */
export function ensureNgramIndex(file) {
    if (file.ngramIndex) {
        const idx = file.ngramIndex;
        // Set 在 JSON 序列化时会丢失（Set → {}），每次加载都需重建
        // 同时也兼容旧格式（没有 _uSet 等字段）
        if (!(idx._uSet instanceof Set)) {
            idx._uSet = new Set(idx.unigram || []);
            idx._bSet = new Set(idx.bigram || []);
            idx._tSet = new Set(idx.trigram || []);
            idx._TSet = new Set(idx.tetragram || []);
            idx._pSet = new Set(idx.pentagram || []);
        }
        // _flat 是数组（JSON 安全），但 _charSets 包含 Set（JSON 序列化后变 {}）
        // 检测：1) 存在性 2) 长度匹配 3) 非空时首元素 instanceof Set
        const charSetsOk = Array.isArray(idx._charSets) &&
            (idx._charSets.length === 0 || idx._charSets[0] instanceof Set);
        if (!Array.isArray(idx._flat) || !charSetsOk || idx._flat.length !== idx._charSets.length) {
            const flat = [];
            for (const level of [idx.pentagram, idx.tetragram, idx.trigram, idx.bigram]) {
                for (const f of level || []) { if (f.length >= 2) flat.push(f); }
            }
            idx._flat = flat;
            idx._charSets = flat.map(f => new Set(f));
        }
        return idx;
    }
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

    // ⭐ 预构建 Set 缓存：供单次扫描 O(1) 查找使用
    // 避免了每次评分时重新创建 Set 的开销
    result._uSet = new Set(result.unigram);
    result._bSet = new Set(result.bigram);
    result._tSet = new Set(result.trigram);
    result._TSet = new Set(result.tetragram);
    result._pSet = new Set(result.pentagram);

    // 预计算模糊匹配用的平铺碎片数组 + 每个碎片的字符集（避免重复遍历）
    const flat = [];
    for (const level of [result.pentagram, result.tetragram, result.trigram, result.bigram]) {
        for (const f of level) { if (f.length >= 2) flat.push(f); }
    }
    result._flat = flat;
    result._charSets = flat.map(f => new Set(f));

    file.ngramIndex = result;
    return result;
}

// ==================== N-gram 匹配（单次扫描） ====================

/**
 * 计算内容分词的 N-gram 匹配分数
 *
 * ## ⚡ 单次扫描算法
 *
 * 传统方法：遍历 N-gram 索引中的所有子串，对每个子串调用 O(n) 的
 * `String.includes()` 扫描 query 文本 → 复杂度 O(子串数 × 文本长度)
 *
 * 单次扫描法：只扫描 query 文本一次，在每个位置提取所有可能的
 * N-gram（1~5 字符），用预构建的 Set 做 O(1) 存在性检查 →
 * 复杂度 O(文本长度 × 5)，与 N-gram 索引大小无关。
 *
 * 对于 100 文件 × 500 片段 × 2 来源 的典型场景：
 *   - 传统: 100 × 500 × 2 = 100,000 次 includes()
 *   - 单扫: 100 × 2 × 100 字文本 × 5 阶 = 100,000 次 Set.has()
 *
 * Set.has() 是 O(1) 哈希查找，远快于 includes() 的 O(n) 子串搜索。
 *
 * @param {object} file - 文件对象
 * @param {string} cleanedText - 清洗后的文本
 * @param {object} config - 权重配置
 * @param {Set} [matchTracker] - 可选匹配追踪 Set（跨来源去重，用于密度归一化）
 * @returns {number} 匹配分数
 */
export function calculateNgramScore(file, cleanedText, config, matchTracker) {
    const ngram = ensureNgramIndex(file);
    if (!ngram) return 0;

    const text = cleanedText;
    if (!text) return 0;
    const len = text.length;
    if (len === 0) return 0;

    const {
        unigramWeight = 0.3,
        bigramWeight = 1.0,
        trigramWeight = 1.5,
        tetragramWeight = 0.8,
        pentagramWeight = 0.5,
    } = config;

    // 预缓存的 Set（在 ensureNgramIndex 中构建）
    const uSet = ngram._uSet;
    const bSet = ngram._bSet;
    const tSet = ngram._tSet;
    const TSet = ngram._TSet;
    const pSet = ngram._pSet;

    let score = 0;

    // 去重缓存（每级别独立，与原始语义一致）
    let uSeen, bSeen, tSeen, TSeen, pSeen;

    // ─── 一次扫描：遍历文本每个位置，提取所有可能 N-gram ───
    for (let i = 0; i < len; i++) {
        // 1-gram（单字符，用 text[i] 直接取字符，避免子串分配）
        if (uSet) {
            const u = text[i];
            if (uSet.has(u)) {
                if (!uSeen) uSeen = new Set();
                if (!uSeen.has(u)) {
                    uSeen.add(u);
                    if (unigramWeight > 0) score += unigramWeight;
                    if (matchTracker) matchTracker.add('u' + u);
                }
            }
        }

        // 2-gram
        if (i + 2 <= len && bSet) {
            const b = text.substring(i, i + 2);
            if (bSet.has(b)) {
                if (!bSeen) bSeen = new Set();
                if (!bSeen.has(b)) {
                    bSeen.add(b);
                    if (bigramWeight > 0) score += bigramWeight;
                    if (matchTracker) matchTracker.add('b' + b);
                }
            }
        }

        // 3-gram
        if (i + 3 <= len && tSet) {
            const t = text.substring(i, i + 3);
            if (tSet.has(t)) {
                if (!tSeen) tSeen = new Set();
                if (!tSeen.has(t)) {
                    tSeen.add(t);
                    if (trigramWeight > 0) score += trigramWeight;
                    if (matchTracker) matchTracker.add('t' + t);
                }
            }
        }

        // 4-gram
        if (i + 4 <= len && TSet) {
            const T = text.substring(i, i + 4);
            if (TSet.has(T)) {
                if (!TSeen) TSeen = new Set();
                if (!TSeen.has(T)) {
                    TSeen.add(T);
                    if (tetragramWeight > 0) score += tetragramWeight;
                    if (matchTracker) matchTracker.add('T' + T);
                }
            }
        }

        // 5-gram
        if (i + 5 <= len && pSet) {
            const p = text.substring(i, i + 5);
            if (pSet.has(p)) {
                if (!pSeen) pSeen = new Set();
                if (!pSeen.has(p)) {
                    pSeen.add(p);
                    if (pentagramWeight > 0) score += pentagramWeight;
                    if (matchTracker) matchTracker.add('p' + p);
                }
            }
        }
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

/**
 * 从 N-gram 索引元数据中 O(1) 计算总片段数
 * 替代 countMatchedNgramFragments 的遍历计数
 * @param {object} ngram - N-gram 索引
 * @returns {number} 总片段数
 */
export function countTotalFrags(ngram) {
    if (!ngram) return 0;
    return (ngram.unigram?.length || 0) +
           (ngram.bigram?.length || 0) +
           (ngram.trigram?.length || 0) +
           (ngram.tetragram?.length || 0) +
           (ngram.pentagram?.length || 0);
}
