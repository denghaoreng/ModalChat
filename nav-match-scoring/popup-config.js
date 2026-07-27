// popup-config.js — 向后兼容 re-export hub
// 实际实现在 popup/ 子目录中

export { showRelationEditPopup } from './popup/relations.js';
export { showStopWordsPopup } from './popup/stopwords.js';
export { showTypeKeywordsPopup, showConfigManualPopup } from './popup/keywords.js';
export { showTagFilterPopup } from './popup/tags.js';
export { showBatchAddPopup } from './popup/batch.js';
