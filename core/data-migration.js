// data-migration.js — 数据迁移：补全旧数据中缺失的字段
// 只在 loadSettings 中调用一次，不影响运行时性能

import { DEFAULT_TYPE_KEYWORDS, DEFAULT_ANIMATION_TYPES } from './default-settings.js';

/**
 * 补全旧数据中缺失的字段，确保结构完整。
 * @param {object} msd - navMatchScoring 数据对象（就地修改）
 */
export function migrateMatchScoringData(msd) {
    // 填补空白的类型关键词（防止已保存的空字符串覆盖默认值）
    if (!msd.typeVideoKeywords) msd.typeVideoKeywords = DEFAULT_TYPE_KEYWORDS.video;
    if (!msd.typeImageKeywords) msd.typeImageKeywords = DEFAULT_TYPE_KEYWORDS.image;
    if (!msd.typeAudioKeywords) msd.typeAudioKeywords = DEFAULT_TYPE_KEYWORDS.audio;

    // 补全 animationTypes 缺失的默认类型和字段
    if (msd.animationTypes && Array.isArray(msd.animationTypes)) {
        for (const def of DEFAULT_ANIMATION_TYPES) {
            const existing = msd.animationTypes.find(t => t.name === def.name);
            if (existing) {
                if (!existing.keyframes) existing.keyframes = def.keyframes;
                if (!existing.timingFunction) existing.timingFunction = def.timingFunction;
            } else {
                msd.animationTypes.push({ ...def });
            }
        }
        if (!msd.animationTypes.some(t => t.selected)) {
            msd.animationTypes[0].selected = true;
        }
    }

    // 补全 slots 中每个插槽缺失的字段
    if (msd.slots && Array.isArray(msd.slots)) {
        for (const s of msd.slots) {
            if (s.clickAction === undefined) s.clickAction = 'enlarge';
        }
    }
}
