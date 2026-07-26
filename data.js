// data.js — 全局数据层
// 注册表按目录分文件存储：只加载当面目录的数据，支持 5 万+ 条

import { getContext } from '../../../extensions.js';
import { generateId } from './shared/utils.js';

export const MODULE_NAME = 'modal-chat';
const FILE_PREFIX = 'ModalChat_';
const FILES = {
    settings:   FILE_PREFIX + 'settings.json',
    chatImages: FILE_PREFIX + 'chat-images_data.json',
    matchScore: FILE_PREFIX + 'match-scoring_data.json',
    regIndex:   FILE_PREFIX + 'reg-index.json',
};
const DIR_PREFIX = FILE_PREFIX + 'dir_';

// ==================== 内存缓存 ====================

export let currentSettings = {
    directories: ['/'],
    folderMeta: {}, // { '/path/': { createdAt: timestamp } }
    navGeneralSettings: {
        imageWidth: 500, imageHeight: 500,
        frameBackgroundColor: '#000000', frameBackgroundOpacity: 1,
        mediaWidth: 400, mediaHeight: 400,
        thumbnailSize: 60,
        gridThumbnailSize: 80,
    },
    navChatImages: { charSets: [], ruleSets: [], rules: [], enabled: true, autoDetect: true, },
    navMatchScoring: {
        files: [], enabled: true, autoDetect: true,
        weights: {
            aiResponseWeight: 60, userQuestionWeight: 40,
            unigramWeight: 0.3, bigramWeight: 1.0, trigramWeight: 1.5,
            tetragramWeight: 0.8, pentagramWeight: 0.5,
            tagWeight: 10, fileTypeWeight: 0.5, adapterWordWeight: 0.5,
            relationWeight: 1.2, stopWordWeight: 0.2,
            charFuzzyWeight: 1.2, charFuzzyThreshold: 0.50,
            topN: 3, minScore: 0, imagePreferWeight: 1.5, videoPreferWeight: 1.5, audioPreferWeight: 1.5,
            randomJitter: 0.05,
        },
        stopWords: ['的', '都', '也', '可', '了', '在', '是', '有', '和', '就', '不', '人', '这'],
        typeVideoKeywords: '动作 奔跑 跳跃 舞蹈 跳舞 战斗 打斗 格斗 动画 动效 过程 变化 流动 移动 运动 演示 教程 操作 步骤 流程 慢动作 回放 播放 录制 挥舞 飞驰 旋转 翻滚 冲刺 追逐 attack move run dance fight battle animation motion action process 拍打',
        typeImageKeywords: '静止 肖像 风景 景色 瞬间 定格的 表情 外貌 模样 长相 姿态 姿势 画面 截图 照片 壁纸 背景 颜色 色彩 构图 光影 轮廓 凝视 伫立 站着 坐着 躺着 portrait landscape scenery moment screenshot photo picture still',
        typeAudioKeywords: '音频 音乐 歌曲 旋律 节奏 声音 语音 对话 说话 歌唱 演唱 演奏 乐器 钢琴 吉他 鼓 贝斯 小提琴 大提琴 笛子 二胡 古筝 琵琶 曲 歌 声 音效 配音 旁白 广播 播客 录音 铃声 通知 警报 喇叭 广播剧 配乐 bgm 音色 音调 歌声 喘息 呻吟 叫喊 尖叫 呐喊 呼吸 低语 细语 吟唱 咏唱 哼唱',
        relations: [], currentProfileName: '默认配置', weightProfiles: [],
        selectedTags: [], filePageSize: 10, resultsDisplayLimit: 10,
        cardWidth: 120, cardHeight: 80, cardFontSize: 80,
        slots: [{ types: ['image', 'video', 'audio'], count: 3, imageDuration: 5, minScore: 0, totalDuration: 200, animationType: '果冻弹性', animationDuration: 0.9, clickAction: 'enlarge' }],
        carouselPlayCount: 1, carouselShowCount: 1,
        bounceCanvasWidth: 400, bounceCanvasHeight: 400,
        bounceRefImage: '',
        bouncePresets: [
            { type: 'point', ox: 0.25, oy: 0.3,  dx: -0.9, dy: -0.4, scale: 3.5, radius: 0.08, freqStart: 1, freqEnd: 0.1, decay: 0.04, spatialFalloff: 'smooth', spatialDecay: 0.5, spread: 0.1, phaseOffset: 0, displaceMode: 'parallel', ellipticity: 0, ellipseAngle: 0 },
            { type: 'point', ox: 0.72, oy: 0.35, dx: 0.8,  dy: -0.5, scale: 3.0, radius: 0.08, freqStart: 1, freqEnd: 0.1, decay: 0.04, spatialFalloff: 'smooth', spatialDecay: 0.5, spread: 0.1, phaseOffset: 0, displaceMode: 'parallel', ellipticity: 0, ellipseAngle: 0 },
            { type: 'point', ox: 0.5,  oy: 0.7,  dx: -0.3, dy: 0.95, scale: 2.8, radius: 0.08, freqStart: 1, freqEnd: 0.1, decay: 0.04, spatialFalloff: 'smooth', spatialDecay: 0.5, spread: 0.1, phaseOffset: 0, displaceMode: 'parallel', ellipticity: 0, ellipseAngle: 0 },
            { type: 'point', ox: 0.15, oy: 0.65, dx: 0.7,  dy: 0.7,  scale: 2.5, radius: 0.08, freqStart: 1, freqEnd: 0.1, decay: 0.04, spatialFalloff: 'smooth', spatialDecay: 0.5, spread: 0.1, phaseOffset: 0, displaceMode: 'parallel', ellipticity: 0, ellipseAngle: 0 },
            // 骨骼摆臂演示：左臂关节→末端，水平摆动
            { type: 'bone', ox: 0.3, oy: 0.35, endX: 0.2, endY: 0.6, dx: 0, dy: 1, scale: 4, radius: 0.08, endRadius: 0.08, freqStart: 1, freqEnd: 0.1, decay: 0.04, spatialFalloff: 'smooth', spatialDecay: 0.5, spread: 0.1, phaseOffset: 0, displaceMode: 'parallel', ellipticity: 0, ellipseAngle: 0 },
        ],
        animationTypes: [
            {
                name: '果冻弹性',
                timingFunction: 'ease-out',
                keyframes: '0%, 100% { transform: scale(1, 1); }\n15% { transform: scale(1.08, 0.88); }\n30% { transform: scale(0.92, 1.1); }\n45% { transform: scale(1.04, 0.94); }\n60% { transform: scale(0.97, 1.04); }\n75% { transform: scale(1.01, 0.98); }\n90% { transform: scale(0.99, 1.01); }',
                selected: true,
            },
            {
                name: '淡入上浮',
                timingFunction: 'ease-out',
                keyframes: '0% { opacity: 0; transform: translateY(30px); }\n100% { opacity: 1; transform: translateY(0); }',
            },
            {
                name: '缩放弹入',
                timingFunction: 'ease-out',
                keyframes: '0% { opacity: 0; transform: scale(0.3); }\n50% { transform: scale(1.12); }\n70% { transform: scale(0.92); }\n100% { opacity: 1; transform: scale(1); }',
            },
            {
                name: '左右摇摆',
                timingFunction: 'ease-in-out',
                keyframes: '0%, 100% { transform: rotate(0deg); }\n25% { transform: rotate(6deg); }\n50% { transform: rotate(-6deg); }\n75% { transform: rotate(3deg); }',
            },
            {
                name: '翻转入场',
                timingFunction: 'ease-out',
                keyframes: '0% { opacity: 0; transform: perspective(600px) rotateY(90deg) scale(0.5); }\n50% { transform: perspective(600px) rotateY(-10deg) scale(1.05); }\n100% { opacity: 1; transform: perspective(600px) rotateY(0deg) scale(1); }',
            },
            {
                name: '呼吸脉动',
                timingFunction: 'ease-in-out',
                keyframes: '0%, 100% { transform: scale(1); }\n50% { transform: scale(1.06); }',
            },
            {
                name: '弹跳落地',
                timingFunction: 'cubic-bezier(0.68, -0.55, 0.27, 1.55)',
                keyframes: '0% { transform: translateY(-80px) scaleX(0.8); opacity: 0; }\n30% { transform: translateY(10px) scaleX(1.05); opacity: 1; }\n50% { transform: translateY(-15px) scaleX(0.95); }\n70% { transform: translateY(5px) scaleX(1.02); }\n85% { transform: translateY(-3px); }\n100% { transform: translateY(0) scaleX(1); opacity: 1; }',
            },
            {
                name: '擦除入场',
                timingFunction: 'ease-in-out',
                keyframes: '0% { clip-path: inset(0 100% 0 0); }\n100% { clip-path: inset(0 0 0 0); }',
            },
            {
                name: '旋转飞入',
                timingFunction: 'ease-out',
                keyframes: '0% { opacity: 0; transform: rotate(-180deg) scale(0.3); }\n60% { transform: rotate(20deg) scale(1.1); }\n80% { transform: rotate(-10deg) scale(0.95); }\n100% { opacity: 1; transform: rotate(0deg) scale(1); }',
            },
            {
                name: '闪烁登场',
                timingFunction: 'ease-in-out',
                keyframes: '0% { opacity: 0; transform: scale(0.5); }\n20% { opacity: 1; transform: scale(1.2); }\n40% { opacity: 0.3; transform: scale(0.9); }\n60% { opacity: 1; transform: scale(1.05); }\n80% { opacity: 0.6; }\n100% { opacity: 1; transform: scale(1); }',
            },
            {
                name: '侧滑回弹',
                timingFunction: 'cubic-bezier(0.68, -0.6, 0.32, 1.6)',
                keyframes: '0% { opacity: 0; transform: translateX(-100px) skewX(10deg); }\n60% { transform: translateX(15px) skewX(-3deg); opacity: 1; }\n80% { transform: translateX(-5px) skewX(1deg); }\n100% { opacity: 1; transform: translateX(0) skewX(0deg); }',
            },
            {
                name: '弹力卡片',
                timingFunction: 'cubic-bezier(0.175, 0.885, 0.32, 1.275)',
                keyframes: '0% { opacity: 0; transform: scale(0.1) rotate(-5deg); }\n60% { transform: scale(1.15) rotate(2deg); opacity: 1; }\n80% { transform: scale(0.92) rotate(-1deg); }\n100% { transform: scale(1) rotate(0deg); opacity: 1; }',
            },
            {
                name: '模糊入场',
                timingFunction: 'ease-out',
                keyframes: '0% { opacity: 0; filter: blur(20px); transform: scale(0.9); }\n100% { opacity: 1; filter: blur(0); transform: scale(1); }',
            },
            {
                name: '滑盖展开',
                timingFunction: 'ease-in-out',
                keyframes: '0% { transform: scaleY(0); opacity: 0; transform-origin: top; }\n50% { transform: scaleY(1.05); opacity: 1; }\n100% { transform: scaleY(1); }',
            },
            {
                name: '弹跳小球',
                timingFunction: 'cubic-bezier(0.68, -0.55, 0.27, 1.55)',
                keyframes: '0% { opacity: 0; transform: translateY(-120px) scaleX(0.9); }\n25% { transform: translateY(0) scaleX(1.1); opacity: 1; }\n40% { transform: translateY(-40px) scaleX(0.95); }\n55% { transform: translateY(0) scaleX(1.05); }\n70% { transform: translateY(-15px); }\n85% { transform: translateY(0); }\n100% { opacity: 1; transform: translateY(0) scaleX(1); }',
            },
            {
                name: '立体翻转',
                timingFunction: 'ease-out',
                keyframes: '0% { opacity: 0; transform: perspective(800px) rotateX(90deg); }\n50% { transform: perspective(800px) rotateX(-15deg); opacity: 1; }\n75% { transform: perspective(800px) rotateX(5deg); }\n100% { transform: perspective(800px) rotateX(0deg); opacity: 1; }',
            },
            {
                name: '霓虹闪烁',
                timingFunction: 'ease-in-out',
                keyframes: '0%, 100% { opacity: 1; filter: brightness(1) drop-shadow(0 0 0 transparent); }\n25% { opacity: 0.85; filter: brightness(1.3) drop-shadow(0 0 8px rgba(255,255,255,0.6)); }\n50% { opacity: 1; filter: brightness(1.1) drop-shadow(0 0 4px rgba(255,255,255,0.3)); }\n75% { opacity: 0.9; filter: brightness(1.4) drop-shadow(0 0 12px rgba(255,255,255,0.8)); }',
            },
            {
                name: '视差浮入',
                timingFunction: 'ease-out',
                keyframes: '0% { opacity: 0; transform: translateY(60px) scale(0.92); filter: blur(4px); }\n100% { opacity: 1; transform: translateY(0) scale(1); filter: blur(0); }',
            },
            {
                name: '上下抖动',
                timingFunction: 'ease-in-out',
                keyframes: '0%, 100% { transform: translateY(0); }\n15% { transform: translateY(-8px); }\n30% { transform: translateY(6px); }\n45% { transform: translateY(-5px); }\n60% { transform: translateY(3px); }\n75% { transform: translateY(-2px); }\n90% { transform: translateY(1px); }',
            },
            {
                name: '左右乳摇',
                timingFunction: 'cubic-bezier(0.68, -0.55, 0.27, 1.55)',
                keyframes: '0%, 100% { transform: translateX(0) rotate(0deg); }\n10% { transform: translateX(-6px) rotate(-3deg); }\n25% { transform: translateX(8px) rotate(4deg); }\n40% { transform: translateX(-5px) rotate(-2deg); }\n55% { transform: translateX(4px) rotate(2deg); }\n70% { transform: translateX(-2px) rotate(-1deg); }\n85% { transform: translateX(1px) rotate(0.5deg); }',
            },
            {
                name: '上下乳摇',
                timingFunction: 'cubic-bezier(0.68, -0.6, 0.32, 1.6)',
                keyframes: '0%, 100% { transform: translateY(0) scaleY(1); }\n10% { transform: translateY(-10px) scaleY(0.92); }\n25% { transform: translateY(6px) scaleY(1.06); }\n40% { transform: translateY(-4px) scaleY(0.96); }\n55% { transform: translateY(3px) scaleY(1.03); }\n70% { transform: translateY(-2px) scaleY(0.98); }\n85% { transform: translateY(1px) scaleY(1.01); }',
            },
            {
                name: '螺旋抖动',
                timingFunction: 'ease-in-out',
                keyframes: '0%, 100% { transform: translate(0, 0) rotate(0deg); }\n10% { transform: translate(-4px, -3px) rotate(-2deg); }\n25% { transform: translate(5px, 2px) rotate(3deg); }\n40% { transform: translate(-3px, -4px) rotate(-2deg); }\n55% { transform: translate(3px, 2px) rotate(2deg); }\n70% { transform: translate(-2px, -1px) rotate(-1deg); }\n85% { transform: translate(1px, 1px) rotate(0.5deg); }',
            },
        ],
    },
};

// ==================== 注册表（按目录分文件） ====================

/** @type {Map<string, object>} 完整条目缓存 id→entry（已加载的目录） */
let _entryCache = new Map();

/** @type {object} 轻量索引 { id: directory } 始终在内存（约 50 字节/条） */
let _regIndex = {};

/** @type {Set<string>} 已从文件加载到缓存的目录集合 */
let _loadedDirs = new Set();

/** 简单字符串哈希（6位hex，确定性，无字符问题） */
function hashStr(s) {
    let h = 0;
    for (let i = 0; i < s.length; i++) {
        h = ((h << 5) - h) + s.charCodeAt(i);
        h = h & h;
    }
    return Math.abs(h >>> 0).toString(16).padStart(6, '0').slice(0, 6);
}

/** 目录路径 → 安全唯一文件名（基于哈希） */
function dirFile(dir) {
    return DIR_PREFIX + hashStr(dir) + '.json';
}

/**
 * 静态读取 URL 前缀
 * 服务端路由 /user/files/* → req.user.directories.files = data/default-user/user/files/
 * 上传 API 返回 path: 'user/files/{name}' （相对于 SillyTavern 根目录）
 */
const FILES_ROOT = '/user/files/';
/** 上传/删除 API 用的相对路径前缀（无前导 /，匹配 upload 返回格式） */
const FULL_PATH_PREFIX = 'user/files/';

function getHeaders() {
    const { getRequestHeaders } = getContext();
    return getRequestHeaders();
}

/**
 * 读 JSON：直接通过静态 URL fetch（文件存于 FILES_ROOT）
 * 上传 API 写入后，文件可通过 /user/files/ 访问
 */
async function readJSON(name) {
    try {
        const r = await fetch(FILES_ROOT + name);
        if (r.ok) return await r.json();
    } catch (e) { /* 首次使用或文件不存在 */ }
    return null;
}

/**
 * 写 JSON：通过上传 API 写入，name 作为文件名存到 FILES_ROOT
 */
async function writeJSON(name, data) {
    try {
        const s = JSON.stringify(data);
        const b64 = btoa(unescape(encodeURIComponent(s)));
        const r = await fetch('/api/files/upload', {
            method: 'POST', headers: getHeaders(),
            body: JSON.stringify({ name, data: b64 }),
        });
        return r.ok;
    } catch (e) { console.error('ModalChat: write fail', name, e); return false; }
}

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
    if (idx && typeof idx === 'object') _regIndex = idx;
}

// ==================== 数据迁移（仅启动时执行一次） ====================

/**
 * 补全旧数据中缺失的字段，确保结构完整。
 * 只在 loadSettings 中调用一次，不影响运行时性能。
 */
function migrateMatchScoringData(msd) {
    // 填补空白的类型关键词（防止已保存的空字符串覆盖默认值）
    if (!msd.typeVideoKeywords) msd.typeVideoKeywords = '动作 奔跑 跳跃 舞蹈 跳舞 战斗 打斗 格斗 动画 动效 过程 变化 流动 移动 运动 演示 教程 操作 步骤 流程 慢动作 回放 播放 录制 挥舞 飞驰 旋转 翻滚 冲刺 追逐 attack move run dance fight battle animation motion action process 拍打';
    if (!msd.typeImageKeywords) msd.typeImageKeywords = '静止 肖像 风景 景色 瞬间 定格的 表情 外貌 模样 长相 姿态 姿势 画面 截图 照片 壁纸 背景 颜色 色彩 构图 光影 轮廓 凝视 伫立 站着 坐着 躺着 portrait landscape scenery moment screenshot photo picture still';
    if (!msd.typeAudioKeywords) msd.typeAudioKeywords = '音频 音乐 歌曲 旋律 节奏 声音 语音 对话 说话 歌唱 演唱 演奏 乐器 钢琴 吉他 鼓 贝斯 小提琴 大提琴 笛子 二胡 古筝 琵琶 曲 歌 声 音效 配音 旁白 广播 播客 录音 铃声 通知 警报 喇叭 广播剧 配乐 bgm 音色 音调 歌声 喘息 呻吟 叫喊 尖叫 呐喊 呼吸 低语 细语 吟唱 咏唱 哼唱';

    // 补全 animationTypes 缺失的默认类型和字段
    if (msd.animationTypes && Array.isArray(msd.animationTypes)) {
        const defaults = [
            { name: '果冻弹性', keyframes: '0%, 100% { transform: scale(1, 1); }\n15% { transform: scale(1.08, 0.88); }\n30% { transform: scale(0.92, 1.1); }\n45% { transform: scale(1.04, 0.94); }\n60% { transform: scale(0.97, 1.04); }\n75% { transform: scale(1.01, 0.98); }\n90% { transform: scale(0.99, 1.01); }', timingFunction: 'ease-out' },
            { name: '淡入上浮', keyframes: '0% { opacity: 0; transform: translateY(30px); }\n100% { opacity: 1; transform: translateY(0); }', timingFunction: 'ease-out' },
            { name: '缩放弹入', keyframes: '0% { opacity: 0; transform: scale(0.3); }\n50% { transform: scale(1.12); }\n70% { transform: scale(0.92); }\n100% { opacity: 1; transform: scale(1); }', timingFunction: 'ease-out' },
            { name: '左右摇摆', keyframes: '0%, 100% { transform: rotate(0deg); }\n25% { transform: rotate(6deg); }\n50% { transform: rotate(-6deg); }\n75% { transform: rotate(3deg); }', timingFunction: 'ease-in-out' },
            { name: '翻转入场', keyframes: '0% { opacity: 0; transform: perspective(600px) rotateY(90deg) scale(0.5); }\n50% { transform: perspective(600px) rotateY(-10deg) scale(1.05); }\n100% { opacity: 1; transform: perspective(600px) rotateY(0deg) scale(1); }', timingFunction: 'ease-out' },
            { name: '呼吸脉动', keyframes: '0%, 100% { transform: scale(1); }\n50% { transform: scale(1.06); }', timingFunction: 'ease-in-out' },
            { name: '弹跳落地', keyframes: '0% { transform: translateY(-80px) scaleX(0.8); opacity: 0; }\n30% { transform: translateY(10px) scaleX(1.05); opacity: 1; }\n50% { transform: translateY(-15px) scaleX(0.95); }\n70% { transform: translateY(5px) scaleX(1.02); }\n85% { transform: translateY(-3px); }\n100% { transform: translateY(0) scaleX(1); opacity: 1; }', timingFunction: 'cubic-bezier(0.68, -0.55, 0.27, 1.55)' },
            { name: '擦除入场', keyframes: '0% { clip-path: inset(0 100% 0 0); }\n100% { clip-path: inset(0 0 0 0); }', timingFunction: 'ease-in-out' },
            { name: '旋转飞入', keyframes: '0% { opacity: 0; transform: rotate(-180deg) scale(0.3); }\n60% { transform: rotate(20deg) scale(1.1); }\n80% { transform: rotate(-10deg) scale(0.95); }\n100% { opacity: 1; transform: rotate(0deg) scale(1); }', timingFunction: 'ease-out' },
            { name: '闪烁登场', keyframes: '0% { opacity: 0; transform: scale(0.5); }\n20% { opacity: 1; transform: scale(1.2); }\n40% { opacity: 0.3; transform: scale(0.9); }\n60% { opacity: 1; transform: scale(1.05); }\n80% { opacity: 0.6; }\n100% { opacity: 1; transform: scale(1); }', timingFunction: 'ease-in-out' },
            { name: '侧滑回弹', keyframes: '0% { opacity: 0; transform: translateX(-100px) skewX(10deg); }\n60% { transform: translateX(15px) skewX(-3deg); opacity: 1; }\n80% { transform: translateX(-5px) skewX(1deg); }\n100% { opacity: 1; transform: translateX(0) skewX(0deg); }', timingFunction: 'cubic-bezier(0.68, -0.6, 0.32, 1.6)' },
            { name: '弹力卡片', keyframes: '0% { opacity: 0; transform: scale(0.1) rotate(-5deg); }\n60% { transform: scale(1.15) rotate(2deg); opacity: 1; }\n80% { transform: scale(0.92) rotate(-1deg); }\n100% { transform: scale(1) rotate(0deg); opacity: 1; }', timingFunction: 'cubic-bezier(0.175, 0.885, 0.32, 1.275)' },
            { name: '模糊入场', keyframes: '0% { opacity: 0; filter: blur(20px); transform: scale(0.9); }\n100% { opacity: 1; filter: blur(0); transform: scale(1); }', timingFunction: 'ease-out' },
            { name: '滑盖展开', keyframes: '0% { transform: scaleY(0); opacity: 0; transform-origin: top; }\n50% { transform: scaleY(1.05); opacity: 1; }\n100% { transform: scaleY(1); }', timingFunction: 'ease-in-out' },
            { name: '弹跳小球', keyframes: '0% { opacity: 0; transform: translateY(-120px) scaleX(0.9); }\n25% { transform: translateY(0) scaleX(1.1); opacity: 1; }\n40% { transform: translateY(-40px) scaleX(0.95); }\n55% { transform: translateY(0) scaleX(1.05); }\n70% { transform: translateY(-15px); }\n85% { transform: translateY(0); }\n100% { opacity: 1; transform: translateY(0) scaleX(1); }', timingFunction: 'cubic-bezier(0.68, -0.55, 0.27, 1.55)' },
            { name: '立体翻转', keyframes: '0% { opacity: 0; transform: perspective(800px) rotateX(90deg); }\n50% { transform: perspective(800px) rotateX(-15deg); opacity: 1; }\n75% { transform: perspective(800px) rotateX(5deg); }\n100% { transform: perspective(800px) rotateX(0deg); opacity: 1; }', timingFunction: 'ease-out' },
            { name: '霓虹闪烁', keyframes: '0%, 100% { opacity: 1; filter: brightness(1) drop-shadow(0 0 0 transparent); }\n25% { opacity: 0.85; filter: brightness(1.3) drop-shadow(0 0 8px rgba(255,255,255,0.6)); }\n50% { opacity: 1; filter: brightness(1.1) drop-shadow(0 0 4px rgba(255,255,255,0.3)); }\n75% { opacity: 0.9; filter: brightness(1.4) drop-shadow(0 0 12px rgba(255,255,255,0.8)); }', timingFunction: 'ease-in-out' },
            { name: '视差浮入', keyframes: '0% { opacity: 0; transform: translateY(60px) scale(0.92); filter: blur(4px); }\n100% { opacity: 1; transform: translateY(0) scale(1); filter: blur(0); }', timingFunction: 'ease-out' },
            { name: '上下抖动', keyframes: '0%, 100% { transform: translateY(0); }\n15% { transform: translateY(-8px); }\n30% { transform: translateY(6px); }\n45% { transform: translateY(-5px); }\n60% { transform: translateY(3px); }\n75% { transform: translateY(-2px); }\n90% { transform: translateY(1px); }', timingFunction: 'ease-in-out' },
            { name: '左右乳摇', keyframes: '0%, 100% { transform: translateX(0) rotate(0deg); }\n10% { transform: translateX(-6px) rotate(-3deg); }\n25% { transform: translateX(8px) rotate(4deg); }\n40% { transform: translateX(-5px) rotate(-2deg); }\n55% { transform: translateX(4px) rotate(2deg); }\n70% { transform: translateX(-2px) rotate(-1deg); }\n85% { transform: translateX(1px) rotate(0.5deg); }', timingFunction: 'cubic-bezier(0.68, -0.55, 0.27, 1.55)' },
            { name: '上下乳摇', keyframes: '0%, 100% { transform: translateY(0) scaleY(1); }\n10% { transform: translateY(-10px) scaleY(0.92); }\n25% { transform: translateY(6px) scaleY(1.06); }\n40% { transform: translateY(-4px) scaleY(0.96); }\n55% { transform: translateY(3px) scaleY(1.03); }\n70% { transform: translateY(-2px) scaleY(0.98); }\n85% { transform: translateY(1px) scaleY(1.01); }', timingFunction: 'cubic-bezier(0.68, -0.6, 0.32, 1.6)' },
            { name: '螺旋抖动', keyframes: '0%, 100% { transform: translate(0, 0) rotate(0deg); }\n10% { transform: translate(-4px, -3px) rotate(-2deg); }\n25% { transform: translate(5px, 2px) rotate(3deg); }\n40% { transform: translate(-3px, -4px) rotate(-2deg); }\n55% { transform: translate(3px, 2px) rotate(2deg); }\n70% { transform: translate(-2px, -1px) rotate(-1deg); }\n85% { transform: translate(1px, 1px) rotate(0.5deg); }', timingFunction: 'ease-in-out' },
        ];
        for (const def of defaults) {
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

// ==================== 目录级懒加载 ====================

async function loadDir(dir) {
    if (_loadedDirs.has(dir)) return;
    const data = await readJSON(dirFile(dir));
    if (Array.isArray(data)) {
        for (const e of data) { if (e && e.id) _entryCache.set(e.id, e); }
    }
    _loadedDirs.add(dir);
}

// ==================== 公开 API ====================

/** 获取指定目录中的文件列表（懒加载该目录） */
export async function getFilesInDirectory(dir) {
    await loadDir(dir);
    const r = [];
    for (const e of _entryCache.values()) { if ((e.directory || '/') === dir) r.push(e); }
    return r;
}

/** 按 ID 查找（按需加载对应目录） */
export async function getRegistryById(id) {
    if (_entryCache.has(id)) return _entryCache.get(id);
    const d = _regIndex[id];
    if (d) { await loadDir(d); return _entryCache.get(id) || null; }
    return null;
}

/** 全量搜索（谨慎：遍历所有目录） */
export async function searchRegistry(query) {
    const dirs = new Set(Object.values(_regIndex));
    for (const d of dirs) await loadDir(d);
    if (!query) return [..._entryCache.values()];
    const q = query.toLowerCase();
    const r = [];
    for (const e of _entryCache.values()) {
        if ((e.displayName && e.displayName.toLowerCase().includes(q)) ||
            (e.serverFilename && e.serverFilename.toLowerCase().includes(q)) ||
            (e.originalName && e.originalName.toLowerCase().includes(q))) r.push(e);
    }
    return r;
}

/** 注册表总数 */
/** 返回所有已缓存的注册表条目（只包含已加载目录中的条目） */
export function getRegistryEntries() { return Array.from(_entryCache.values()); }

export function getRegistryCount() { return Object.keys(_regIndex).length; }

/** 注册表是否就绪 */
export function isRegistryReady() { return Object.keys(_regIndex).length > 0; }

/** 添加条目 */
export function addRegistryEntry(entry) {
    const r = {
        id: entry.serverFilename ? entry.serverFilename.replace(/\.[^/.]+$/, '') : generateId('reg'),
        source: entry.source || 'file-manager',
        serverFilename: entry.serverFilename || '',
        originalName: entry.originalName || '',
        displayName: entry.displayName || entry.originalName?.replace(/\.[^/.]+$/, '') || '未命名',
        type: entry.type || 'image',
        mimeType: entry.mimeType || '',
        relativePath: entry.relativePath || '',
        fullServerPath: entry.fullServerPath || '',
        fileSize: entry.fileSize || 0,
        uploadDate: Date.now(),
        directory: entry.directory || '/',
    };
    _entryCache.set(r.id, r);
    _regIndex[r.id] = r.directory;
    _loadedDirs.add(r.directory);
    debouncedSave();
    return r;
}

/** 批量添加 */
export function addRegistryEntries(entries) {
    for (const e of entries) {
        const r = {
            id: generateId('reg'),
            source: e.source || 'file-manager',
            serverFilename: e.serverFilename || '',
            originalName: e.originalName || '',
            displayName: e.displayName || e.originalName?.replace(/\.[^/.]+$/, '') || '未命名',
            type: e.type || 'image',
            mimeType: e.mimeType || '',
            relativePath: e.relativePath || '',
            fullServerPath: e.fullServerPath || '',
            fileSize: e.fileSize || 0,
            uploadDate: Date.now(),
            directory: e.directory || '/',
        };
        _entryCache.set(r.id, r);
        _regIndex[r.id] = r.directory;
        _loadedDirs.add(r.directory);
    }
    debouncedSave();
    return entries;
}

/** 删除 */
export function removeRegistryEntry(id) {
    const d = _regIndex[id];
    _entryCache.delete(id);
    delete _regIndex[id];
    debouncedSave();
}

/** 更新 */
export function updateRegistryEntry(id, updates) {
    const e = _entryCache.get(id);
    if (e) {
        const oldDir = e.directory;
        Object.assign(e, updates);
        _regIndex[id] = e.directory;
        if (e.directory !== oldDir && !_loadedDirs.has(e.directory)) loadDir(e.directory);
        debouncedSave();
    }
}

/** 按来源查询 */
export async function getRegistryBySource(source) {
    const r = [];
    for (const e of _entryCache.values()) { if (e.source === source) r.push(e); }
    return r;
}

// ==================== 防抖保存 ====================

async function _doSave() {
    const ps = [];

    // 收集所有有数据的目录（来自条目缓存 + 已加载目录）
    const dirEntries = new Map();
    for (const e of _entryCache.values()) {
        const d = e.directory || '/';
        if (!dirEntries.has(d)) dirEntries.set(d, []);
        dirEntries.get(d).push(e);
        _loadedDirs.add(d); // 确保目录标记为已加载
    }

    // 保存所有已加载的目录文件（空目录也保留，仅当用户显式删除时移除）
    for (const d of _loadedDirs) {
        const es = dirEntries.get(d) || [];
        ps.push(writeJSON(dirFile(d), es));
    }

    ps.push(writeJSON(FILES.regIndex, _regIndex));
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

// ==================== 虚拟目录 ====================

export function getDirectories() {
    if (!currentSettings.directories || currentSettings.directories.length === 0) currentSettings.directories = ['/'];
    return currentSettings.directories;
}
export function addDirectory(p) {
    const ds = getDirectories();
    const n = p.replace(/\/+/g, '/').replace(/\/$/, '') + '/';
    if (!ds.includes(n)) { ds.push(n); ds.sort(); debouncedSave(); }
}
/** 创建目录并等待数据文件写入完成 */
export async function createDirWithFile(dir) {
    const n = dir.replace(/\/+/g, '/').replace(/\/$/, '') + '/';
    addDirectory(n);
    if (!currentSettings.folderMeta[n]) currentSettings.folderMeta[n] = { createdAt: Date.now() };
    await writeJSON(dirFile(n), []);
}
/**
 * 删除目录及所有子目录/文件
 * @param {string} p - 目录路径
 */
/** 递归收集指定目录下的所有子目录路径 */
function collectSubDirs(root) {
    const ds = getDirectories();
    const n = root.replace(/\/+/g, '/').replace(/\/$/, '') + '/';
    const result = [];
    for (const d of ds) {
        if (d === n || d.startsWith(n)) result.push(d);
    }
    // 按深度排序（深的先删，避免依赖问题）
    result.sort((a, b) => b.split('/').length - a.split('/').length);
    return result;
}

export async function removeDirectoryRecursive(p) {
    const normalized = p.replace(/\/+/g, '/').replace(/\/$/, '') + '/';
    const ds = getDirectories();

    // 1. 收集所有受影响的目录（自身 + 所有深度的子目录），深的优先
    const toRemove = collectSubDirs(normalized);

    // 2. 加载所有未加载的子目录文件
    for (const d of toRemove) {
        if (_loadedDirs.has(d)) continue;
        const data = await readJSON(dirFile(d));
        if (Array.isArray(data)) {
            for (const e of data) {
                if (e && e.id) {
                    _entryCache.set(e.id, e);
                    _regIndex[e.id] = e.directory || '/';
                }
            }
        }
        _loadedDirs.add(d);
    }

    // 3. 找出所有受影响的注册表条目，删除服务端文件
    const allIds = [..._entryCache.keys()];
    for (const id of allIds) {
        const entry = _entryCache.get(id);
        if (!entry) continue;
        const dir = entry.directory || '/';
        if (dir === normalized || dir.startsWith(normalized)) {
            if (entry.fullServerPath) {
                try {
                    await fetch('/api/files/delete', {
                        method: 'POST', headers: getHeaders(),
                        body: JSON.stringify({ path: entry.fullServerPath }),
                    });
                } catch (e) { /* 忽略 */ }
            }
            delete _regIndex[id];
            _entryCache.delete(id);
        }
    }

    // 4. 删除目录列表、目录数据文件、folderMeta
    for (const d of toRemove) {
        const i = ds.indexOf(d);
        if (i >= 0) ds.splice(i, 1);
        delete currentSettings.folderMeta[d];
        try {
            await fetch('/api/files/delete', {
                method: 'POST', headers: getHeaders(),
                body: JSON.stringify({ path: FULL_PATH_PREFIX + dirFile(d) }),
            });
        } catch (e) { /* 忽略 */ }
        _loadedDirs.delete(d);
    }

    debouncedSave();
}

/**
 * 重命名目录：改路径 → 更新条目 → 删旧文件
 * @param {string} oldPath 旧路径（如 '/old-name/'）
 * @param {string} newPath 新路径（如 '/new-name/'）
 */
export async function renameDirectory(oldPath, newPath) {
    const nOld = oldPath.replace(/\/+/g, '/').replace(/\/$/, '') + '/';
    const nNew = newPath.replace(/\/+/g, '/').replace(/\/$/, '') + '/';
    if (nOld === nNew) return;
    if (nOld === '/') return; // 根目录不能改名

    // 1. 更新 directories 列表
    const ds = getDirectories();
    const idx = ds.indexOf(nOld);
    if (idx >= 0) ds[idx] = nNew;
    else ds.push(nNew);
    ds.sort();

    // 1.1 迁移 folderMeta
    if (currentSettings.folderMeta[nOld]) {
        currentSettings.folderMeta[nNew] = currentSettings.folderMeta[nOld];
        delete currentSettings.folderMeta[nOld];
    }

    // 2. 更新所有条目中的 directory 字段（包括已缓存和未加载的）
    for (const id of Object.keys(_regIndex)) {
        if (_regIndex[id] === nOld) {
            _regIndex[id] = nNew;
            const cached = _entryCache.get(id);
            if (cached) cached.directory = nNew;
        }
    }
    // 更新已加载集合
    _loadedDirs.delete(nOld);
    _loadedDirs.add(nNew);

    // 3. 删除旧目录文件（哈希已变，旧文件成孤）
    // 删除 API 需要完整的存储路径：user/files/{filename}（匹配 upload 返回格式）
    try {
        const oldFileName = dirFile(nOld);
        await fetch('/api/files/delete', {
            method: 'POST', headers: getHeaders(),
            body: JSON.stringify({ path: FULL_PATH_PREFIX + oldFileName }),
        });
    } catch (e) { /* 忽略 */ }

    debouncedSave();
}
