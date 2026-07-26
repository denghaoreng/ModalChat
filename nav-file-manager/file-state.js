// nav-file-manager/file-state.js — 文件管理器状态变量

export let currentDir = '/';
export let selectedFiles = new Set();
export let isSelectionMode = false;
export let selectionCallback = null;
export let fmCurrentPage = 1;
export let fmSortBy = 'uploadDate';
export let fmSortDesc = true;
export let fmViewMode = 'detail';
export let fmSearchMode = 'simple';
export let fmSearchTriggered = false;
export const FM_PAGE_SIZE = 50;

export function setCurrentDir(v) { currentDir = v; }
export function setSelectedFiles(v) { selectedFiles = v; }
export function setIsSelectionMode(v) { isSelectionMode = v; }
export function setSelectionCallback(v) { selectionCallback = v; }
export function setFmCurrentPage(v) { fmCurrentPage = v; }
export function setFmSortBy(v) { fmSortBy = v; }
export function setFmSortDesc(v) { fmSortDesc = v; }
export function setFmViewMode(v) { fmViewMode = v; }
export function setFmSearchMode(v) { fmSearchMode = v; }
export function setFmSearchTriggered(v) { fmSearchTriggered = v; }
