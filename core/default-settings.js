// default-settings.js — 全局数据默认值（与 data.js 分离，减少主文件体积）

export const DEFAULT_WEIGHTS = {
    aiResponseWeight: 60, userQuestionWeight: 40,
    unigramWeight: 0.3, bigramWeight: 1.0, trigramWeight: 1.5,
    tetragramWeight: 0.8, pentagramWeight: 0.5,
    tagWeight: 10, fileTypeWeight: 0.5, adapterWordWeight: 0.5,
    relationWeight: 1.2, stopWordWeight: 0.2,
    charFuzzyWeight: 1.2, charFuzzyThreshold: 0.50,
    topN: 3, minScore: 0, imagePreferWeight: 1.5, videoPreferWeight: 1.5, audioPreferWeight: 1.5,
    randomJitter: 0.05,
};

export const DEFAULT_STOP_WORDS = [
    '的', '都', '也', '可', '了', '在', '是', '有', '和', '就', '不', '人', '这',
];

export const DEFAULT_TYPE_KEYWORDS = {
    video: '动作 奔跑 跳跃 舞蹈 跳舞 战斗 打斗 格斗 动画 动效 过程 变化 流动 移动 运动 演示 教程 操作 步骤 流程 慢动作 回放 播放 录制 挥舞 飞驰 旋转 翻滚 冲刺 追逐 attack move run dance fight battle animation motion action process 拍打',
    image: '静止 肖像 风景 景色 瞬间 定格的 表情 外貌 模样 长相 姿态 姿势 画面 截图 照片 壁纸 背景 颜色 色彩 构图 光影 轮廓 凝视 伫立 站着 坐着 躺着 portrait landscape scenery moment screenshot photo picture still',
    audio: '音频 音乐 歌曲 旋律 节奏 声音 语音 对话 说话 歌唱 演唱 演奏 乐器 钢琴 吉他 鼓 贝斯 小提琴 大提琴 笛子 二胡 古筝 琵琶 曲 歌 声 音效 配音 旁白 广播 播客 录音 铃声 通知 警报 喇叭 广播剧 配乐 bgm 音色 音调 歌声 喘息 呻吟 叫喊 尖叫 呐喊 呼吸 低语 细语 吟唱 咏唱 哼唱',
};

export const DEFAULT_ANIMATION_TYPES = [
    { name: '果冻弹性', timingFunction: 'ease-out', keyframes: '0%, 100% { transform: scale(1, 1); }\n15% { transform: scale(1.08, 0.88); }\n30% { transform: scale(0.92, 1.1); }\n45% { transform: scale(1.04, 0.94); }\n60% { transform: scale(0.97, 1.04); }\n75% { transform: scale(1.01, 0.98); }\n90% { transform: scale(0.99, 1.01); }', selected: true },
    { name: '淡入上浮', timingFunction: 'ease-out', keyframes: '0% { opacity: 0; transform: translateY(30px); }\n100% { opacity: 1; transform: translateY(0); }' },
    { name: '缩放弹入', timingFunction: 'ease-out', keyframes: '0% { opacity: 0; transform: scale(0.3); }\n50% { transform: scale(1.12); }\n70% { transform: scale(0.92); }\n100% { opacity: 1; transform: scale(1); }' },
    { name: '左右摇摆', timingFunction: 'ease-in-out', keyframes: '0%, 100% { transform: rotate(0deg); }\n25% { transform: rotate(6deg); }\n50% { transform: rotate(-6deg); }\n75% { transform: rotate(3deg); }' },
    { name: '翻转入场', timingFunction: 'ease-out', keyframes: '0% { opacity: 0; transform: perspective(600px) rotateY(90deg) scale(0.5); }\n50% { transform: perspective(600px) rotateY(-10deg) scale(1.05); }\n100% { opacity: 1; transform: perspective(600px) rotateY(0deg) scale(1); }' },
    { name: '呼吸脉动', timingFunction: 'ease-in-out', keyframes: '0%, 100% { transform: scale(1); }\n50% { transform: scale(1.06); }' },
    { name: '弹跳落地', timingFunction: 'cubic-bezier(0.68, -0.55, 0.27, 1.55)', keyframes: '0% { transform: translateY(-80px) scaleX(0.8); opacity: 0; }\n30% { transform: translateY(10px) scaleX(1.05); opacity: 1; }\n50% { transform: translateY(-15px) scaleX(0.95); }\n70% { transform: translateY(5px) scaleX(1.02); }\n85% { transform: translateY(-3px); }\n100% { transform: translateY(0) scaleX(1); opacity: 1; }' },
    { name: '擦除入场', timingFunction: 'ease-in-out', keyframes: '0% { clip-path: inset(0 100% 0 0); }\n100% { clip-path: inset(0 0 0 0); }' },
    { name: '旋转飞入', timingFunction: 'ease-out', keyframes: '0% { opacity: 0; transform: rotate(-180deg) scale(0.3); }\n60% { transform: rotate(20deg) scale(1.1); }\n80% { transform: rotate(-10deg) scale(0.95); }\n100% { opacity: 1; transform: rotate(0deg) scale(1); }' },
    { name: '闪烁登场', timingFunction: 'ease-in-out', keyframes: '0% { opacity: 0; transform: scale(0.5); }\n20% { opacity: 1; transform: scale(1.2); }\n40% { opacity: 0.3; transform: scale(0.9); }\n60% { opacity: 1; transform: scale(1.05); }\n80% { opacity: 0.6; }\n100% { opacity: 1; transform: scale(1); }' },
    { name: '侧滑回弹', timingFunction: 'cubic-bezier(0.68, -0.6, 0.32, 1.6)', keyframes: '0% { opacity: 0; transform: translateX(-100px) skewX(10deg); }\n60% { transform: translateX(15px) skewX(-3deg); opacity: 1; }\n80% { transform: translateX(-5px) skewX(1deg); }\n100% { opacity: 1; transform: translateX(0) skewX(0deg); }' },
    { name: '弹力卡片', timingFunction: 'cubic-bezier(0.175, 0.885, 0.32, 1.275)', keyframes: '0% { opacity: 0; transform: scale(0.1) rotate(-5deg); }\n60% { transform: scale(1.15) rotate(2deg); opacity: 1; }\n80% { transform: scale(0.92) rotate(-1deg); }\n100% { transform: scale(1) rotate(0deg); opacity: 1; }' },
    { name: '模糊入场', timingFunction: 'ease-out', keyframes: '0% { opacity: 0; filter: blur(20px); transform: scale(0.9); }\n100% { opacity: 1; filter: blur(0); transform: scale(1); }' },
    { name: '滑盖展开', timingFunction: 'ease-in-out', keyframes: '0% { transform: scaleY(0); opacity: 0; transform-origin: top; }\n50% { transform: scaleY(1.05); opacity: 1; }\n100% { transform: scaleY(1); }' },
    { name: '弹跳小球', timingFunction: 'cubic-bezier(0.68, -0.55, 0.27, 1.55)', keyframes: '0% { opacity: 0; transform: translateY(-120px) scaleX(0.9); }\n25% { transform: translateY(0) scaleX(1.1); opacity: 1; }\n40% { transform: translateY(-40px) scaleX(0.95); }\n55% { transform: translateY(0) scaleX(1.05); }\n70% { transform: translateY(-15px); }\n85% { transform: translateY(0); }\n100% { opacity: 1; transform: translateY(0) scaleX(1); }' },
    { name: '立体翻转', timingFunction: 'ease-out', keyframes: '0% { opacity: 0; transform: perspective(800px) rotateX(90deg); }\n50% { transform: perspective(800px) rotateX(-15deg); opacity: 1; }\n75% { transform: perspective(800px) rotateX(5deg); }\n100% { transform: perspective(800px) rotateX(0deg); opacity: 1; }' },
    { name: '霓虹闪烁', timingFunction: 'ease-in-out', keyframes: '0%, 100% { opacity: 1; filter: brightness(1) drop-shadow(0 0 0 transparent); }\n25% { opacity: 0.85; filter: brightness(1.3) drop-shadow(0 0 8px rgba(255,255,255,0.6)); }\n50% { opacity: 1; filter: brightness(1.1) drop-shadow(0 0 4px rgba(255,255,255,0.3)); }\n75% { opacity: 0.9; filter: brightness(1.4) drop-shadow(0 0 12px rgba(255,255,255,0.8)); }' },
    { name: '视差浮入', timingFunction: 'ease-out', keyframes: '0% { opacity: 0; transform: translateY(60px) scale(0.92); filter: blur(4px); }\n100% { opacity: 1; transform: translateY(0) scale(1); filter: blur(0); }' },
    { name: '上下抖动', timingFunction: 'ease-in-out', keyframes: '0%, 100% { transform: translateY(0); }\n15% { transform: translateY(-8px); }\n30% { transform: translateY(6px); }\n45% { transform: translateY(-5px); }\n60% { transform: translateY(3px); }\n75% { transform: translateY(-2px); }\n90% { transform: translateY(1px); }' },
    { name: '左右乳摇', timingFunction: 'cubic-bezier(0.68, -0.55, 0.27, 1.55)', keyframes: '0%, 100% { transform: translateX(0) rotate(0deg); }\n10% { transform: translateX(-6px) rotate(-3deg); }\n25% { transform: translateX(8px) rotate(4deg); }\n40% { transform: translateX(-5px) rotate(-2deg); }\n55% { transform: translateX(4px) rotate(2deg); }\n70% { transform: translateX(-2px) rotate(-1deg); }\n85% { transform: translateX(1px) rotate(0.5deg); }' },
    { name: '上下乳摇', timingFunction: 'cubic-bezier(0.68, -0.6, 0.32, 1.6)', keyframes: '0%, 100% { transform: translateY(0) scaleY(1); }\n10% { transform: translateY(-10px) scaleY(0.92); }\n25% { transform: translateY(6px) scaleY(1.06); }\n40% { transform: translateY(-4px) scaleY(0.96); }\n55% { transform: translateY(3px) scaleY(1.03); }\n70% { transform: translateY(-2px) scaleY(0.98); }\n85% { transform: translateY(1px) scaleY(1.01); }' },
    { name: '螺旋抖动', timingFunction: 'ease-in-out', keyframes: '0%, 100% { transform: translate(0, 0) rotate(0deg); }\n10% { transform: translate(-4px, -3px) rotate(-2deg); }\n25% { transform: translate(5px, 2px) rotate(3deg); }\n40% { transform: translate(-3px, -4px) rotate(-2deg); }\n55% { transform: translate(3px, 2px) rotate(2deg); }\n70% { transform: translate(-2px, -1px) rotate(-1deg); }\n85% { transform: translate(1px, 1px) rotate(0.5deg); }' },
];

export const DEFAULT_BOUNCE_PRESETS = [
    { type: 'point', ox: 0.25, oy: 0.3,  dx: -0.9, dy: -0.4, scale: 3.5, radius: 0.08, freqStart: 1, freqEnd: 0.1, decay: 0.04, spatialFalloff: 'smooth', spatialDecay: 0.5, spread: 0.1, phaseOffset: 0, displaceMode: 'parallel', ellipticity: 0, ellipseAngle: 0 },
    { type: 'point', ox: 0.72, oy: 0.35, dx: 0.8,  dy: -0.5, scale: 3.0, radius: 0.08, freqStart: 1, freqEnd: 0.1, decay: 0.04, spatialFalloff: 'smooth', spatialDecay: 0.5, spread: 0.1, phaseOffset: 0, displaceMode: 'parallel', ellipticity: 0, ellipseAngle: 0 },
    { type: 'point', ox: 0.5,  oy: 0.7,  dx: -0.3, dy: 0.95, scale: 2.8, radius: 0.08, freqStart: 1, freqEnd: 0.1, decay: 0.04, spatialFalloff: 'smooth', spatialDecay: 0.5, spread: 0.1, phaseOffset: 0, displaceMode: 'parallel', ellipticity: 0, ellipseAngle: 0 },
    { type: 'point', ox: 0.15, oy: 0.65, dx: 0.7,  dy: 0.7,  scale: 2.5, radius: 0.08, freqStart: 1, freqEnd: 0.1, decay: 0.04, spatialFalloff: 'smooth', spatialDecay: 0.5, spread: 0.1, phaseOffset: 0, displaceMode: 'parallel', ellipticity: 0, ellipseAngle: 0 },
    { type: 'bone', ox: 0.3, oy: 0.35, endX: 0.2, endY: 0.6, dx: 0, dy: 1, scale: 4, radius: 0.08, endRadius: 0.08, freqStart: 1, freqEnd: 0.1, decay: 0.04, spatialFalloff: 'smooth', spatialDecay: 0.5, spread: 0.1, phaseOffset: 0, displaceMode: 'parallel', ellipticity: 0, ellipseAngle: 0 },
];

export const DEFAULT_SLOTS = [
    { types: ['image', 'video', 'audio'], count: 3, imageDuration: 5, minScore: 0, totalDuration: 200, animationType: '果冻弹性', animationDuration: 0.9, clickAction: 'enlarge' },
];

export const DEFAULT_SETTINGS = {
    directories: ['/'],
    folderMeta: {},
    navGeneralSettings: {
        imageWidth: 500, imageHeight: 500,
        frameBackgroundColor: '#000000', frameBackgroundOpacity: 1,
        mediaWidth: 400, mediaHeight: 400,
        thumbnailSize: 60, gridThumbnailSize: 80,
    },
    navChatImages: {
        charSets: [], ruleSets: [], rules: [], enabled: true, autoDetect: true,
    },
    navMatchScoring: {
        files: [], enabled: true, autoDetect: true,
        weights: { ...DEFAULT_WEIGHTS },
        stopWords: [...DEFAULT_STOP_WORDS],
        typeVideoKeywords: DEFAULT_TYPE_KEYWORDS.video,
        typeImageKeywords: DEFAULT_TYPE_KEYWORDS.image,
        typeAudioKeywords: DEFAULT_TYPE_KEYWORDS.audio,
        relations: [], currentProfileName: '默认配置', weightProfiles: [],
        selectedTags: [], filePageSize: 10, resultsDisplayLimit: 10,
        cardWidth: 120, cardHeight: 80, cardFontSize: 80,
        slots: DEFAULT_SLOTS.map(s => ({ ...s })),
        carouselPlayCount: 1, carouselShowCount: 1,
        bounceCanvasWidth: 400, bounceCanvasHeight: 400,
        bounceRefImage: '',
        bouncePresets: DEFAULT_BOUNCE_PRESETS.map(p => ({ ...p })),
        animationTypes: DEFAULT_ANIMATION_TYPES.map(a => ({ ...a })),
    },
};
