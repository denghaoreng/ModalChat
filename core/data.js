// data.js — 全局数据层（facade）
// 子模块实现在 file-storage.js / registry-state.js / directory-manager.js
// 本文件保留：currentSettings、loadSettings、防抖保存编排、模块数据访问器

import { DEFAULT_SETTINGS } from './default-settings.js';
import { migrateMatchScoringData } from './data-migration.js';
import { FILES, readJSON, writeJSON, dirFile } from './file-storage.js';
import {
    setDirtyCallback, setRegIndex, getRegistryState, getAndClearDirtyDirs,
} from './registry-state.js';

export { MODULE_NAME } from './file-storage.js';
export * from './registry-state.js';
export { getDirectories, addDirectory, createDirWithFile, removeDirectoryRecursive, renameDirectory } from './directory-manager.js';

// ==================== 当前设置 ====================

export let currentSettings = structuredClone(DEFAULT_SETTINGS);

// ==================== 加载 ====================

export async function loadSettings() {
    const [s, ci, ms, idx] = await Promise.all([
        readJSON(FILES.settings), readJSON(FILES.chatImages),
        readJSON(FILES.matchScore), readJSON(FILES.regIndex),
    ]);
    if (s) {
        if (s.directories) currentSettings.directories = s.directories;
        if (s.folderMeta) currentSettings.folderMeta = s.folderMeta;
        if (s.lastNavTab) currentSettings.lastNavTab = s.lastNavTab;
        if (s.navGeneralSettings) Object.assign(currentSettings.navGeneralSettings, s.navGeneralSettings);
    }
    if (ci) Object.assign(currentSettings.navChatImages, ci);
    if (ms) {
        Object.assign(currentSettings.navMatchScoring, ms);
        migrateMatchScoringData(currentSettings.navMatchScoring);
    }
    if (idx && typeof idx === 'object') setRegIndex(idx);
}

// ==================== 防抖保存 ====================

/**
 * 保存脏目录（dir_xxx.json + reg-index.json）+ 全部配置文件。
 * 各文件互不冲突：上传文件只写 dir 文件，改配置只写对应 json。
 * saveSettings()/flushSave() 全量保存时也走此路径。
 */
async function _doSave() {
    const ps = [];
    const dirtyDirs = getAndClearDirtyDirs();

    // 脏目录写对应 dir 文件 + regIndex
    if (dirtyDirs.size > 0) {
        const { _entryCache, _dirIndex, _loadedDirs } = getRegistryState();
        for (const d of dirtyDirs) {
            if (!_loadedDirs.has(d)) continue;
            const ids = _dirIndex.get(d);
            const entries = ids ? [...ids].map(id => _entryCache.get(id)).filter(Boolean) : [];
            ps.push(writeJSON(dirFile(d), entries));
        }
        const { _regIndex } = getRegistryState();
        ps.push(writeJSON(FILES.regIndex, _regIndex));
    }

    // 配置文件每次保存都写（不冲突，无需过滤）
    ps.push(writeJSON(FILES.settings, {
        directories: currentSettings.directories,
        folderMeta: currentSettings.folderMeta,
        lastNavTab: currentSettings.lastNavTab,
        navGeneralSettings: currentSettings.navGeneralSettings,
    }));
    ps.push(writeJSON(FILES.chatImages, currentSettings.navChatImages));
    ps.push(writeJSON(FILES.matchScore, currentSettings.navMatchScoring));

    await Promise.all(ps);
}

let _st = null;
export function debouncedSave() { clearTimeout(_st); _st = setTimeout(() => _doSave(), 300); }
export function flushSave() { clearTimeout(_st); _doSave(); }
export function saveSettings() { _doSave(); }

// 注册脏回调：registry-state 的数据变更通过此回调触发防抖保存
setDirtyCallback(debouncedSave);

// ==================== 模块数据 ====================

export function getChatImagesData() { return currentSettings.navChatImages; }
export function getMatchScoringData() { return currentSettings.navMatchScoring; }
export function getGeneralSettings() { return currentSettings.navGeneralSettings; }
export function updateGeneralSettings(u) { Object.assign(currentSettings.navGeneralSettings, u); debouncedSave(); }
export function getAnimationTypes() { return currentSettings.navMatchScoring.animationTypes || []; }
export function getBouncePresets() { return currentSettings.navMatchScoring.bouncePresets || []; }
export function updateBouncePresets(pts) { currentSettings.navMatchScoring.bouncePresets = pts; debouncedSave(); }
export function getBounceRefImage() { return currentSettings.navMatchScoring.bounceRefImage || ''; }
export function updateBounceRefImage(url) { currentSettings.navMatchScoring.bounceRefImage = url || ''; debouncedSave(); }
export function getBounceCanvasSize() {
    const d = currentSettings.navMatchScoring;
    return { w: d.bounceCanvasWidth || 400, h: d.bounceCanvasHeight || 400 };
}
export function updateBounceCanvasSize(w, h) {
    const d = currentSettings.navMatchScoring;
    d.bounceCanvasWidth = w; d.bounceCanvasHeight = h;
    debouncedSave();
}
export function getMSFiles() { return getMatchScoringData().files || []; }
export function getMSConfig() { return getMatchScoringData().weights || {}; }

export function addRelation(from, to) {
    const d = getMatchScoringData();
    if (!d.relations) d.relations = [];
    d.relations.push({ from: from.trim(), to: to.trim() });
    debouncedSave();
}
export function removeRelation(index) {
    const d = getMatchScoringData();
    if (d.relations) d.relations.splice(index, 1);
    debouncedSave();
}
export function getRelations() { return getMatchScoringData().relations || []; }
export function updateStopWords(w) { getMatchScoringData().stopWords = w; debouncedSave(); }
export function getStopWords() { return getMatchScoringData().stopWords || []; }
export function updateTypeVideoKeywords(s) { getMatchScoringData().typeVideoKeywords = s; debouncedSave(); }
export function getTypeVideoKeywords() { return getMatchScoringData().typeVideoKeywords || ''; }
export function updateTypeImageKeywords(s) { getMatchScoringData().typeImageKeywords = s; debouncedSave(); }
export function getTypeImageKeywords() { return getMatchScoringData().typeImageKeywords || ''; }
export function updateTypeAudioKeywords(s) { getMatchScoringData().typeAudioKeywords = s; debouncedSave(); }
export function getTypeAudioKeywords() { return getMatchScoringData().typeAudioKeywords || ''; }
export function getSelectedTags() { return getMatchScoringData().selectedTags || []; }
export function updateSelectedTags(t) { getMatchScoringData().selectedTags = t; debouncedSave(); }
