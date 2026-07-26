// nav-match-scoring/drawer.js — 匹配打分子导航（文件展示 / 匹配配置 / 轮播配置）

import { getMatchScoringData } from '../data.js';

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

    $panel.html(`
    <div style="padding:4px;">
        <div class="mc-ms-nav flex-container alignitemscenter" style="border-bottom:1px solid var(--borderColor);margin-bottom:6px;">
            <span class="mc-ms-tab ${lastSubTab === 'files' ? 'mc-ms-active' : ''}" data-ms-tab="files" style="${tabStyle('files')}">
                <i class="fa-solid fa-folder"></i> 文件展示 (${fileCount})
            </span>
            <span class="mc-ms-tab ${lastSubTab === 'config' ? 'mc-ms-active' : ''}" data-ms-tab="config" style="${tabStyle('config')}">
                <i class="fa-solid fa-gear"></i> 匹配配置
            </span>
            <span class="mc-ms-tab ${lastSubTab === 'carousel' ? 'mc-ms-active' : ''}" data-ms-tab="carousel" style="${tabStyle('carousel')}">
                <i class="fa-solid fa-layer-group"></i> 轮播配置
            </span>
        </div>
        <div id="mc-ms-content">
            ${lastSubTab === 'files'
                ? '<div id="mc-ms-files-panel"></div><div id="mc-ms-results-panel" style="margin-top:8px;border-top:1px solid var(--borderColor);padding-top:8px;"><div class="flex-container alignitemscenter" style="justify-content:space-between;"><div style="font-weight:bold;font-size:0.85em;"><i class="fa-solid fa-trophy"></i> 当前匹配结果</div><div class="flex-container alignitemscenter" style="gap:4px;"><span style="font-size:0.78em;color:var(--grey40);">每种</span><input id="mc-ms-results-limit" class="text_pole" type="number" value="' + (data.resultsDisplayLimit ?? 10) + '" min="1" max="999" style="width:45px;font-size:0.78em;padding:2px 4px;"><span style="font-size:0.78em;color:var(--grey40);">个</span></div></div><div id="mc-ms-results-list" style="margin-top:4px;"></div></div>'
                : lastSubTab === 'config'
                    ? '<div id="mc-ms-config-panel"></div>'
                    : '<div id="mc-ms-carousel-panel"></div>'}
        </div>
    </div>`);

    if (lastSubTab === 'files') {
        import('./file-display.js').then(m => m.renderFileDisplay());
        import('./scorer.js').then(s => {
            const last = s.getLastResults();
            import('./match-chat-results.js').then(m => m.renderResultsPanel(last && last.length > 0 ? last : null));
        });
    } else if (lastSubTab === 'config') {
        import('./match-config.js').then(m => m.renderMatchConfig());
    } else {
        import('./carousel-config.js').then(m => m.renderCarouselConfig());
    }
}

export function bindMatchScoringEvents() {
    $(document).off('click', '.mc-ms-tab').on('click', '.mc-ms-tab', function () {
        lastSubTab = $(this).data('ms-tab');
        renderMatchScoring();
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

