// domain/index.js — 业务逻辑层 re-export hub

export { getRules, getRuleById, addRule, updateRule, deleteRule } from './rules.js';
export { getRuleSets, addRuleSet, updateRuleSet, deleteRuleSet } from './rule-sets.js';
export { getCharSets, addCharSet, updateCharSet, deleteCharSet } from './char-sets.js';
export { getEnabledRules, addImageToRule, removeImageFromRule, getImageUrlByRegistry } from './helpers.js';
