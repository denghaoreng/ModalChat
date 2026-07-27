// index.js — 入口：生命周期（导航栏、事件注册由子模块负责）

import { loadSettings } from './core/data.js';
import { addNavBarDrawer } from './shell/drawer.js';
import { registerEventListeners, unregisterEventListeners } from './shell/message-handler.js';

// ==================== 生命周期 ====================

export async function init() {
    await loadSettings();
    addNavBarDrawer();
    registerEventListeners();
}

export async function onDelete() {
    $('#modal-chat-drawer').remove();
}

export function onEnable() { registerEventListeners(); }
export function onDisable() { unregisterEventListeners(); }