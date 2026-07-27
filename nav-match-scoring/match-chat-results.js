// match-chat-results.js — 向后兼容 re-export hub
// 实际实现在 match-chat-results/ 子目录中

export { renderResultsPanel } from './match-chat-results/panel.js';
export { renderChatResults } from './match-chat-results/bubble.js';
export { persistChatResults, restoreChatResults, cleanupStaleExtraRefs, cleanupAllChatResults } from './match-chat-results/persist.js';
