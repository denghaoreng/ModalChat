// nav-match-scoring/drawer.js — 匹配打分子导航（文件展示 / 匹配配置 / 轮播配置）

import { getMatchScoringData } from '../core/data.js';

export let lastSubTab = 'files';

export function renderMatchScoring() {
    const $panel = $('#mc-match-scoring-panel');
    if (!$panel.length) return;

    const data = getMatchScoringData();
    const fileCount = (data.files || []).length;

    function tabStyle(tab) {
        const active = lastSubTab === tab;
        return `flex:1;text-align:center;padding:4px 0;cursor:pointer;font-size:0.82em;${active ? 'border-bottom:2px solid var(--primary);font-weight:bold;' : 'color:var(--grey40);'}`;
    }

    // 首次渲染：创建完整面板结构（导航栏 + 三个内容面板）
    if (!$('#mc-ms-content').length) {
        $panel.html(`
        <div style="padding:4px;">
            <div class="mc-ms-nav flex-container alignitemscenter" style="border-bottom:1px solid var(--borderColor);margin-bottom:6px;">
                <span class="mc-ms-tab" data-ms-tab="files" style="${tabStyle('files')}">
                    <i class="fa-solid fa-folder"></i> 文件展示 (${fileCount})
                </span>
                <span class="mc-ms-tab" data-ms-tab="config" style="${tabStyle('config')}">
                    <i class="fa-solid fa-gear"></i> 匹配配置
                </span>
                <span class="mc-ms-tab" data-ms-tab="carousel" style="${tabStyle('carousel')}">
                    <i class="fa-solid fa-layer-group"></i> 轮播配置
                </span>
            </div>
            <div id="mc-ms-content">
                <div id="mc-ms-files-panel">
                    <div id="mc-ms-results-panel" style="margin-top:8px;border-top:1px solid var(--borderColor);padding-top:8px;">
                        <div class="flex-container alignitemscenter" style="justify-content:space-between;">
                            <div style="font-weight:bold;font-size:0.85em;"><i class="fa-solid fa-trophy"></i> 当前匹配结果</div>
                            <div class="flex-container alignitemscenter" style="gap:4px;">
                                <span style="font-size:0.78em;color:var(--grey40);">每种</span>
                                <input id="mc-ms-results-limit" class="text_pole" type="number" value="${data.resultsDisplayLimit ?? 10}" min="1" max="999" style="width:45px;font-size:0.78em;padding:2px 4px;">
                                <span style="font-size:0.78em;color:var(--grey40);">个</span>
                            </div>
                        </div>
                        <div id="mc-ms-results-list" style="margin-top:4px;"></div>
                    </div>
                </div>
                <div id="mc-ms-config-panel" style="display:none;"></div>
                <div id="mc-ms-carousel-panel" style="display:none;"></div>
            </div>
        </div>`);

        // 首次加载三个子面板的内容
        return Promise.all([
            import('./file-display.js').then(m => m.renderFileDisplay()),
            import('./match-config.js').then(m => m.renderMatchConfig()),
            import('./carousel-config.js').then(m => m.renderCarouselConfig()),
            import('./scorer.js').then(s => {
                const last = s.getLastResults();
                return import('./match-chat-results.js').then(m => m.renderResultsPanel(last && last.length > 0 ? last : null));
            }),
        ]).then(() => {
            // 首次渲染后，只显示当前子标签
            switchSubTab(lastSubTab);
        });
    } else {
        // 子导航切换：只更新标签高亮 + 切换内容面板可见性（不重建 DOM）
        switchSubTab(lastSubTab);
    }
}

function switchSubTab(tab) {
    // 更新标签高亮（与通用配置一致：选中项 border-bottom + 加粗）
    $('.mc-ms-tab').each(function () {
        const t = $(this).data('ms-tab');
        if (t === tab) {
            $(this).css({ 'border-bottom': '2px solid var(--primary)', fontWeight: 'bold', color: '' });
        } else {
            $(this).css({ 'border-bottom': '', fontWeight: '', color: 'var(--grey40)' });
        }
    });
    // 切换内容面板
    $('#mc-ms-files-panel, #mc-ms-config-panel, #mc-ms-carousel-panel').hide();
    $(`#mc-ms-${tab}-panel`).show();
}

export function bindMatchScoringEvents() {
    $(document).off('click', '.mc-ms-tab').on('click', '.mc-ms-tab', async function () {
        lastSubTab = $(this).data('ms-tab');
        await renderMatchScoring();
        bindMatchScoringEvents();
    });

    if (lastSubTab === 'files') {
        import('./file-display.js').then(m => m.bindFileDisplayEvents());
    } else if (lastSubTab === 'config') {
        import('./match-config.js').then(m => m.bindMatchConfigEvents());
    } else {
        import('./carousel-config.js').then(m => m.bindCarouselEvents());
    }
}

