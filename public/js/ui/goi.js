import { showToast, showConfirm } from './dialog.js';
import { GiftDropdown } from './components/GiftDropdown.js';
import { makeGiftCell, makeActionCell } from './components/GiftActionButtons.js';

const GOI_EFFECTS = [
    // Instant
    { id: 'launch',          name: 'Launch Player',   category: 'Instant',  desc: 'Blast the player upward',    timed: false, counted: false, powered: true },
    { id: 'shove_left',      name: 'Shove Left',      category: 'Instant',  desc: 'Shove the player left',      timed: false, counted: false, powered: true },
    { id: 'shove_right',     name: 'Shove Right',     category: 'Instant',  desc: 'Shove the player right',     timed: false, counted: false, powered: true },
    { id: 'reset_progress',  name: 'Reset Progress',  category: 'Instant',  desc: 'Reset ALL progress (evil!)', timed: false, counted: false },
    { id: 'spawn_hat',       name: 'Spawn Hat',       category: 'Instant',  desc: 'Drop hats on the player',    timed: false, counted: true  },
    { id: 'spawn_orange',    name: 'Spawn Orange',    category: 'Instant',  desc: 'Drop oranges on the player', timed: false, counted: true  },
    { id: 'spawn_gift',      name: 'Spawn Gift',      category: 'Instant',  desc: 'Drop gift boxes on the player', timed: false, counted: true  },
    // Gravity
    { id: 'low_gravity',     name: 'Low Gravity',     category: 'Gravity',  desc: 'Fall slower',                timed: true,  counted: false },
    { id: 'high_gravity',    name: 'High Gravity',    category: 'Gravity',  desc: 'Fall faster',                timed: true,  counted: false },
    { id: 'zero_gravity',    name: 'Zero Gravity',    category: 'Gravity',  desc: 'Float around',               timed: true,  counted: false },
    // Friction
    { id: 'low_friction',    name: 'Low Friction',    category: 'Friction', desc: 'Slippery surfaces',          timed: true,  counted: false },
    { id: 'high_friction',   name: 'High Friction',   category: 'Friction', desc: 'Everything sticky',          timed: true,  counted: false },
    { id: 'bouncy',          name: 'Bouncy',          category: 'Friction', desc: 'Everything bounces like rubber', timed: true, counted: false },
    // Camera
    { id: 'flip_camera',     name: 'Flip Camera',     category: 'Camera',   desc: 'Upside down view',           timed: true,  counted: false },
    { id: 'spin_camera',     name: 'Spin Camera',     category: 'Camera',   desc: 'Camera spins continuously',  timed: true,  counted: false },
    // Input
    { id: 'invert_mouse',    name: 'Invert Mouse',    category: 'Input',    desc: 'Reversed mouse input',       timed: true,  counted: false },
    // Hammer
    { id: 'big_hammer',      name: 'Big Hammer',      category: 'Hammer',   desc: 'Giant hammer for a few seconds',        timed: true,  counted: false },
    { id: 'small_hammer',    name: 'Small Hammer',    category: 'Hammer',   desc: 'Tiny hammer for a few seconds',         timed: true,  counted: false },
    { id: 'rolling_over_it', name: 'Rolling Over It', category: 'Hammer',   desc: 'Pot rolls like a ball (experimental)',  timed: true,  counted: false },
    { id: 'only_hammer',     name: 'Only Hammer',     category: 'Hammer',   desc: 'Pot passes through — only the hammer collides', timed: true, counted: false },
];


const ALL_CATEGORIES = ['Instant', 'Gravity', 'Friction', 'Camera', 'Input', 'Hammer'];

let socket = null;
let availableGifts = [];
let currentCommands = {};
let giftDropdown = null;
let serverActive = false;
let isConnected = false;
let selectedEffect = null;
let activeCategory = 'Instant';

export function initGoiUI(ioConnection) {
    if (ioConnection) socket = ioConnection.socket;

    const tableBody       = $('#goiEffectsTableBody');
    const modal           = $('#goiEffectModal');
    const addBtn          = $('#addGoiEffectBtn');
    const sidebarDot      = $('#goiStatusSidebarDot');
    const statusTextLarge = $('#goiStatusTextLarge');
    const connectBtn      = $('#goiConnectBtn');

    giftDropdown = new GiftDropdown({
        inputId:   'goiGiftInput',
        resultsId: 'goiGiftResults',
        previewId: 'goiGiftImagePreview',
    });

    const triggerRadios = $('input[name="triggerType_goi"]');
    const goiGiftSelectorWrapper = $('#goiGiftSelectorWrapper');
    const goiLikesConfigRow = $('#goiLikesConfigRow');
    const goiLikesRequired = $('#goiLikesRequired');

    triggerRadios.change(function() {
        const val = $(this).val();
        if (val === 'gift') {
            goiGiftSelectorWrapper.show();
            goiLikesConfigRow.hide();
        } else if (val === 'follow') {
            goiGiftSelectorWrapper.hide();
            goiLikesConfigRow.hide();
        } else if (val === 'like') {
            goiGiftSelectorWrapper.hide();
            goiLikesConfigRow.show();
        }
    });

    buildCategoryTabs();

    $('#goiSetupBtn').off('click').on('click', () => $('#goiSetupModal').css('display', 'flex'));
    $('#closeGoiSetupBtn, #goiGotItBtn').off('click').on('click', () => $('#goiSetupModal').hide());
    addBtn.off('click').on('click', () => openModal());

    connectBtn.off('click').on('click', () => {
        socket.emit(!serverActive ? 'goiStart' : 'goiStop');
    });

    $('#saveGoiEffectBtn').off('click').on('click', saveCurrentMapping);
    $('#cancelGoiModalBtn').off('click').on('click', () => { modal.hide(); resetModal(); });

    function updateUI(connected, active) {
        isConnected  = !!connected;
        serverActive = !!active;

        const bridgeCard      = $('#goiBridgeCard');
        const btnText         = $('#goiBtnText');
        const btnIcon         = $('#goiBtnIcon');

        btnText.text(serverActive ? 'Stop Bridge' : 'Start Bridge');
        connectBtn.removeClass('btn-primary btn-secondary').addClass(serverActive ? 'btn-secondary' : 'btn-primary');

        btnIcon.html(serverActive
            ? `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><rect x="6" y="6" width="12" height="12"></rect></svg>`
            : `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>`
        );

        const state = !serverActive ? 'off' : (isConnected ? 'connected' : 'listening');
        bridgeCard.attr('data-state', state);
        statusTextLarge.text({ off: 'Offline', connected: 'Connected', listening: 'Listening...' }[state]);

        sidebarDot.toggle(isConnected).css('background', 'var(--success)');
    }

    if (socket) {
        socket.on('goiStatus', data => updateUI(data.isConnected, data.serverActive));
    }

    function buildCategoryTabs() {
        const container = $('#goiCategoryTabs').empty();
        container.css({
            'display': 'flex', 'gap': '2px', 'background': 'var(--bg2)',
            'padding': '3px', 'border-radius': '10px', 'border': '1px solid var(--border)',
            'overflow-x': 'auto', 'scrollbar-width': 'none', 'margin-bottom': '4px'
        });

        ALL_CATEGORIES.forEach(cat => {
            const isActive = activeCategory === cat;
            const btn = $(`
                <button class="cat-tab ${isActive ? 'active' : ''}">
                    ${cat}
                </button>
            `);
            btn.on('click', () => { activeCategory = cat; buildCategoryTabs(); renderEffectCards(selectedEffect?.id); });
            container.append(btn);
        });
    }

    function renderEffectCards(selId) {
        const cards    = $('#goiEffectCards').empty();
        const filtered = GOI_EFFECTS.filter(e => e.category === activeCategory);

        filtered.forEach(e => {
            const isSelected = e.id === selId;
            const card = $(`
                <div style="
                    padding:12px; border:1px solid ${isSelected ? 'var(--accent)' : 'var(--border)'}; border-radius: 4px;
                    cursor:pointer; background:${isSelected ? 'var(--accent-dim)' : 'var(--bg4)'};
                    transition: background-color .2s cubic-bezier(0.4,0,0.2,1), border-color .2s cubic-bezier(0.4,0,0.2,1), color .2s cubic-bezier(0.4,0,0.2,1), box-shadow .2s cubic-bezier(0.4,0,0.2,1), opacity .2s cubic-bezier(0.4,0,0.2,1), transform .2s cubic-bezier(0.4,0,0.2,1);
                    display:flex; flex-direction:column; gap:4px; position:relative; overflow:hidden;
                    box-shadow:${isSelected ? 'none' : 'none'};
                ">
                    ${isSelected ? `<div style="position:absolute;top:0;right:0;width:30px;height:30px;background:var(--accent);
                        clip-path:polygon(100% 0,0 0,100% 100%);display:flex;align-items:flex-start;justify-content:flex-end;padding:4px;">
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" style="stroke:var(--on-accent)" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                    </div>` : ''}
                    <div style="font-weight:800;font-size:.85rem;color:${isSelected ? 'var(--text)' : 'var(--muted)'};display:flex;align-items:center;gap:6px;">
                        ${e.name}
                        ${e.timed ? `<span class="tag">Timed</span>` : ''}
                    </div>
                    ${e.desc ? `<div style="font-size:.7rem;color:var(--dim);line-height:1.3;">${e.desc}</div>` : ''}
                </div>
            `);
            card.on('mouseover', function() { if (!isSelected) $(this).css({ 'border-color': 'var(--accent)', 'background': 'var(--bg3)' }); });
            card.on('mouseout',  function() { if (!isSelected) $(this).css({ 'border-color': 'var(--border)', 'background': 'var(--bg4)' }); });
            card.on('click', () => { selectedEffect = e; renderEffectCards(e.id); $('#goiDurationRow').toggle(!!e.timed); $('#goiCountRow').toggle(!!e.counted); $('#goiPowerRow').toggle(!!e.powered); });
            cards.append(card);
        });

        if (!filtered.length) {
            cards.append(`<div style="grid-column:1/-1;text-align:center;padding:40px;color:var(--dim);font-size:.85rem;">No effects in this category.</div>`);
        }
    }

    function getEffectName(effect) {
        const code  = typeof effect === 'string' ? effect : effect.code;
        const found = GOI_EFFECTS.find(e => e.id === code);
        return found ? found.name : code;
    }

    function renderTable() {
        tableBody.empty();
        const keys = Object.keys(currentCommands);
        if (!keys.length) return tableBody.append('<tr><td colspan="3" style="text-align:center;padding:40px 20px;color:var(--muted);">No effects yet. Click Add Effect to map a TikTok gift.</td></tr>');

        keys.forEach(giftName => {
            const effect = currentCommands[giftName];
            const gift   = availableGifts.find(g => g.name === giftName);
            const code   = typeof effect === 'string' ? effect : effect.code;
            const found  = GOI_EFFECTS.find(e => e.id === code);

            const effectTd = $('<td class="effect-cell"></td>');
            const inner    = $('<div style="display:flex;align-items:center;gap:8px;"></div>');
            if (found) inner.append($(`<span class="tag">${found.category}</span>`));
            inner.append($('<span></span>').text(getEffectName(effect)));
            if (typeof effect === 'object' && effect.count > 1) inner.append($(`<span style="font-size:9px;padding:1px 6px;border-radius:3px;background:var(--bg3);color:var(--dim);font-weight: 600;">×${effect.count}</span>`));
            effectTd.append(inner);

            const row = $('<tr></tr>');
            row.append(
                makeGiftCell(giftName, gift),
                effectTd,
                makeActionCell(giftName, {
                    onTest:   g => window.testGoiEffect(g),
                    onEdit:   g => openModal(g),
                    onDelete: g => window.deleteGoiMapping(g)
                })
            );
            tableBody.append(row);
        });
    }

    function resetModal() {
        selectedEffect = null;
        activeCategory = 'Instant';
        buildCategoryTabs();
        renderEffectCards(null);
        $('#goiDurationRow').hide();
        $('#goiEffectDuration').val(30);
        $('#goiCountRow').hide();
        $('#goiEffectCount').val(1);
        $('#goiPowerRow').hide();
        $('#goiEffectPower').val(1);
        $('#goiWaitStreak').prop('checked', true);
        $('input[name="triggerType_goi"][value="gift"]').prop('checked', true).trigger('change');
    }

    let editingGiftName = null;

    function openModal(editGiftName) {
        resetModal();
        editingGiftName = editGiftName || null;
        if (editGiftName) {
            if (editGiftName === 'Follow') {
                $('input[name="triggerType_goi"][value="follow"]').prop('checked', true).trigger('change');
            } else if (editGiftName === 'Like') {
                $('input[name="triggerType_goi"][value="like"]').prop('checked', true).trigger('change');
                const effect = currentCommands[editGiftName];
                if (effect && effect.minLikes) goiLikesRequired.val(effect.minLikes);
                else goiLikesRequired.val(100);
            } else {
                $('input[name="triggerType_goi"][value="gift"]').prop('checked', true).trigger('change');
                giftDropdown.setValue(editGiftName);
            }

            $('#goiModalTitle').text('Edit GOI Effect');
            const effect = currentCommands[editGiftName];
            const code   = typeof effect === 'string' ? effect : effect.code;
            const found  = GOI_EFFECTS.find(e => e.id === code);
            if (found) {
                selectedEffect = found;
                activeCategory = found.category;
                buildCategoryTabs();
                renderEffectCards(found.id);
                if (found.timed) {
                    $('#goiDurationRow').show();
                    $('#goiEffectDuration').val((typeof effect === 'object' && effect.duration) ? effect.duration : 30);
                }
                if (found.counted) {
                    $('#goiCountRow').show();
                    $('#goiEffectCount').val((typeof effect === 'object' && effect.count) ? effect.count : 1);
                }
                if (found.powered) {
                    $('#goiPowerRow').show();
                    $('#goiEffectPower').val((typeof effect === 'object' && effect.power) ? effect.power : 1);
                }
            }
            if (typeof effect === 'object') {
                $('#goiWaitStreak').prop('checked', effect.waitForStreak !== false);
            }
        } else {
            giftDropdown.setValue('');
            $('#goiModalTitle').text('Add GOI Effect');
            $('#goiWaitStreak').prop('checked', true);
        }
        modal.css('display', 'flex');
    }

    function saveCurrentMapping() {
        const triggerType = $('input[name="triggerType_goi"]:checked').val();
        let giftName = '';
        if (triggerType === 'gift') {
            giftName = giftDropdown.getValue();
        } else if (triggerType === 'follow') {
            giftName = 'Follow';
        } else if (triggerType === 'like') {
            giftName = 'Like';
        }

        if (!giftName)     { showToast('You must choose a gift!', 'warning');  return; }
        if (!selectedEffect) { showToast('You must choose an effect!', 'warning'); return; }

        if (currentCommands[giftName] && giftName !== editingGiftName) {
            showToast(`"${giftName}" already has an effect! Delete it first.`, 'error');
            return;
        }

        const payload = {
            code: selectedEffect.id,
            waitForStreak: $('#goiWaitStreak').is(':checked'),
            ...(selectedEffect.timed    ? { duration: parseInt($('#goiEffectDuration').val()) || 30 } : {}),
            ...(selectedEffect.counted  ? { count:    parseInt($('#goiEffectCount').val())    || 1  } : {}),
            ...(selectedEffect.powered  ? { power:    parseFloat($('#goiEffectPower').val())   || 1  } : {})
        };

        if (triggerType === 'like') {
            payload.minLikes = parseInt(goiLikesRequired.val()) || 100;
        }

        saveMapping(giftName, payload, 'save', editingGiftName !== giftName ? editingGiftName : null);
        editingGiftName = null;
    }

    async function saveMapping(giftName, effect, action, oldGiftName) {
        try {
            const r = await fetch('/api/goi/commands', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ giftName, effect, action, oldGiftName })
            });
            const d = await r.json();
            if (d.success) {
                currentCommands = d.commands;
                renderTable();
                modal.hide();
                resetModal();
                showToast(action === 'delete' ? 'Mapping removed' : 'Mapping saved!', 'success');
            } else {
                showToast(d.error || 'Failed to save mapping', 'error');
            }
        } catch (e) {
            showToast('Connection error: ' + e.message, 'error');
        }
    }

    window.testGoiEffect = (g) => {
        fetch('/api/goi/test', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ giftName: g }) })
            .then(r => r.json()).then(res => showToast(res.success ? 'Sent!' : res.error, res.success ? 'success' : 'error'));
    };

    window.deleteGoiMapping = (g) => {
        showConfirm({ title: 'Delete?', message: `Remove mapping for ${g}?` }).then(ok => { if (ok) saveMapping(g, null, 'delete'); });
    };

    async function loadAllData() {
        try {
            const [cmdsRes, giftsRes] = await Promise.all([
                fetch('/api/goi/commands').then(r => r.json()),
                fetch('/api/gifts').then(r => r.json())
            ]);
            currentCommands = cmdsRes.commands || {};
            availableGifts  = giftsRes.gifts || [];
            giftDropdown.updateGifts(availableGifts);
            renderTable();
        } catch (e) { console.error('[GOI] Load Error', e); }
    }

    loadAllData();
}
