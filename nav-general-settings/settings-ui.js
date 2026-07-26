// nav-general-settings/settings-ui.js — 通用配置 UI（导航调度）

import { renderAnimTypes, bindAnimEvents } from './anim-types.js';
import { renderBounceEditor, initBounceEditor, bindBounceEvents } from './bounce-presets/index.js';
import { renderUiConfig, bindUiEvents } from './ui-config.js';

let _gsSubTab = 'ui';

function gsTabStyle(tab) {
    const active = _gsSubTab === tab;
    return `flex:1;text-align:center;padding:4px 0;cursor:pointer;font-size:0.82em;${active ? 'border-bottom:2px solid var(--primary);font-weight:bold;' : 'color:var(--grey40);'}`;
}

export function renderGeneralSettings() {
    const $panel = $('#mc-general-panel');
    if (!$panel.length) return;

    $panel.html(`
    <div style="padding:4px;">
        <div class="mc-gs-nav flex-container alignitemscenter" style="border-bottom:1px solid var(--borderColor);margin-bottom:6px;">
            <span class="mc-gs-tab" data-gs-tab="ui" style="${gsTabStyle('ui')}">
                <i class="fa-solid fa-palette"></i> UI配置
            </span>
            <span class="mc-gs-tab" data-gs-tab="anim" style="${gsTabStyle('anim')}">
                <i class="fa-solid fa-film"></i> 轮播类型
            </span>
            <span class="mc-gs-tab" data-gs-tab="bounce" style="${gsTabStyle('bounce')}">
                <i class="fa-solid fa-hand-pointer"></i> 动态图预设
            </span>
        </div>
        <div id="mc-gs-content">
            ${_gsSubTab === 'ui' ? renderUiConfig() : _gsSubTab === 'anim' ? renderAnimTypes() : renderBounceEditor()}
        </div>
    </div>`);

    if (_gsSubTab === 'bounce') initBounceEditor();
}

export function bindGeneralEvents() {
    $(document).off('click', '.mc-gs-tab').on('click', '.mc-gs-tab', function () {
        _gsSubTab = $(this).data('gs-tab');
        renderGeneralSettings();
        bindGeneralEvents();
    });

    if (_gsSubTab === 'ui') {
        bindUiEvents();
    } else if (_gsSubTab === 'bounce') {
        bindBounceEvents();
    } else {
        bindAnimEvents();
    }
}
