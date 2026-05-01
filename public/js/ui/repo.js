import { showToast, showConfirm } from './dialog.js';
import { GiftDropdown } from './components/GiftDropdown.js';
import { makeGiftCell, makeActionCell } from './components/GiftActionButtons.js';

const REPO_EFFECTS = [
    // Player
    { id: 'player_heal',          name: 'Heal',              category: 'Player',   desc: '+100 health',           timed: false },
    { id: 'player_hurt',          name: 'Hurt',              category: 'Player',   desc: '-20 health',            timed: false },
    { id: 'player_kill',          name: 'Kill',              category: 'Player',   desc: 'Instant death',         timed: false },
    { id: 'player_refill_energy', name: 'Refill Stamina',    category: 'Player',   desc: 'Full stamina',          timed: false },
    { id: 'player_drain_energy',  name: 'Drain Stamina',     category: 'Player',   desc: 'Zero stamina',          timed: false },
    // Toggle/Timed
    { id: 'player_invincible',    name: 'Invincible',        category: 'Toggle',   desc: 'God mode',              timed: true  },
    { id: 'player_infinitestam',  name: 'Infinite Stamina',  category: 'Toggle',   desc: 'Infinite stamina',      timed: true  },
    { id: 'player_disableinput',  name: 'Disable Input',     category: 'Toggle',   desc: 'Freeze controls',       timed: true  },
    { id: 'player_disablecrouch', name: 'Disable Crouch',    category: 'Toggle',   desc: "Can't crouch",          timed: true  },
    // Movement
    { id: 'player_fast',                       name: 'Speed Boost',          category: 'Movement', desc: '2× speed',              timed: true  },
    { id: 'player_slow',                       name: 'Slow',                 category: 'Movement', desc: '0.5× speed',            timed: true  },
    { id: 'player_antigravity',                name: 'Anti Gravity',         category: 'Movement', desc: 'Float',                 timed: true  },
    { id: 'player_teleport',                   name: 'Teleport to Player',   category: 'Movement', desc: 'TP to random player',   timed: false },
    { id: 'randomPlayer_teleport',             name: 'Teleport Random',      category: 'Movement', desc: 'TP random player',      timed: false },
    { id: 'player_teleport_extraction',        name: 'TP to Extraction',     category: 'Movement', desc: 'TP to exit',            timed: false },
    { id: 'randomPlayer_teleport_extraction',  name: 'TP Random Extraction', category: 'Movement', desc: 'TP random to exit',     timed: false },
    // Voice
    { id: 'playerPitch_high', name: 'High Pitch',  category: 'Voice', desc: 'Chipmunk voice', timed: true },
    { id: 'playerPitch_low',  name: 'Low Pitch',   category: 'Voice', desc: 'Deep voice',     timed: true },
    // Upgrades
    { id: 'player_upgrade_energy',       name: 'Upgrade Energy',       category: 'Upgrade', desc: 'Upgrade stamina bar',    timed: false },
    { id: 'player_upgrade_health',       name: 'Upgrade Health',       category: 'Upgrade', desc: 'Upgrade max HP',         timed: false },
    { id: 'player_upgrade_jump',         name: 'Upgrade Jump',         category: 'Upgrade', desc: 'Extra jump upgrade',     timed: false },
    { id: 'player_upgrade_grabrange',    name: 'Upgrade Grab Range',   category: 'Upgrade', desc: 'Longer grab range',      timed: false },
    { id: 'player_upgrade_grabstrength', name: 'Upgrade Grab Strength',category: 'Upgrade', desc: 'Stronger grab',          timed: false },
    { id: 'player_upgrade_sprint',       name: 'Upgrade Sprint',       category: 'Upgrade', desc: 'Faster sprint speed',    timed: false },
    { id: 'player_upgrade_throw',        name: 'Upgrade Throw',        category: 'Upgrade', desc: 'Stronger throw',         timed: false },
    { id: 'player_upgrade_tumble',       name: 'Upgrade Tumble',       category: 'Upgrade', desc: 'Better tumble launch',   timed: false },
    { id: 'player_upgrade_map',          name: 'Upgrade Map',          category: 'Upgrade', desc: 'Expand map player count',timed: false },
    // World
    { id: 'closeAllDoors',        name: 'Close All Doors',       category: 'World', desc: 'Slams every door',         timed: false },
    { id: 'increase_haul_goal',   name: 'Increase Haul Goal',    category: 'World', desc: '1.5× quota',               timed: false },
    { id: 'decrease_haul_goal',   name: 'Decrease Haul Goal',    category: 'World', desc: '0.5× quota',               timed: false },
    { id: 'destroy_random_item',  name: 'Destroy Random Item',   category: 'World', desc: 'Destroys a random valuable',timed: false },
    { id: 'praise_crowd_control', name: 'Praise TrinyTok',       category: 'World', desc: 'Shows praise message',      timed: false },
    // Item Spawns
    { id: 'spawncollectable_ItemHealthPackLarge',    name: 'Spawn Large Health Pack',   category: 'Item Spawn', desc: '',  timed: false },
    { id: 'spawncollectable_ItemHealthPackMedium',   name: 'Spawn Medium Health Pack',  category: 'Item Spawn', desc: '',  timed: false },
    { id: 'spawncollectable_ItemHealthPackSmall',    name: 'Spawn Small Health Pack',   category: 'Item Spawn', desc: '',  timed: false },
    { id: 'spawncollectable_ItemGrenadeExplosive',   name: 'Spawn Explosive Grenade',   category: 'Item Spawn', desc: '',  timed: false },
    { id: 'spawncollectable_ItemGrenadeShockwave',   name: 'Spawn Shockwave Grenade',   category: 'Item Spawn', desc: '',  timed: false },
    { id: 'spawncollectable_ItemGrenadeStun',        name: 'Spawn Stun Grenade',        category: 'Item Spawn', desc: '',  timed: false },
    { id: 'spawncollectable_ItemGrenadeDuctTaped',   name: 'Spawn Duct Tape Grenade',   category: 'Item Spawn', desc: '',  timed: false },
    { id: 'spawncollectable_ItemGrenadeHuman',       name: 'Spawn Human Grenade',       category: 'Item Spawn', desc: '',  timed: false },
    { id: 'spawncollectable_ItemGunHandgun',         name: 'Spawn Handgun',             category: 'Item Spawn', desc: '',  timed: false },
    { id: 'spawncollectable_ItemGunShotgun',         name: 'Spawn Shotgun',             category: 'Item Spawn', desc: '',  timed: false },
    { id: 'spawncollectable_ItemGunTranq',           name: 'Spawn Tranq Gun',           category: 'Item Spawn', desc: '',  timed: false },
    { id: 'spawncollectable_ItemMeleeSword',         name: 'Spawn Sword',               category: 'Item Spawn', desc: '',  timed: false },
    { id: 'spawncollectable_ItemMeleeSledgeHammer',  name: 'Spawn Sledge Hammer',       category: 'Item Spawn', desc: '',  timed: false },
    { id: 'spawncollectable_ItemMeleeBaseballBat',   name: 'Spawn Baseball Bat',        category: 'Item Spawn', desc: '',  timed: false },
    { id: 'spawncollectable_ItemMeleeFryingPan',     name: 'Spawn Frying Pan',          category: 'Item Spawn', desc: '',  timed: false },
    { id: 'spawncollectable_ItemMeleeInflatableHammer', name: 'Spawn Inflatable Hammer',category: 'Item Spawn', desc: '', timed: false },
    { id: 'spawncollectable_ItemRubberDuck',         name: 'Spawn Rubber Duck',         category: 'Item Spawn', desc: '',  timed: false },
    { id: 'spawncollectable_ItemDroneBattery',       name: 'Spawn Drone Battery',       category: 'Item Spawn', desc: '',  timed: false },
    { id: 'spawncollectable_ItemDroneZeroGravity',   name: 'Spawn Zero-G Drone',        category: 'Item Spawn', desc: '',  timed: false },
    { id: 'spawncollectable_ItemOrbZeroGravity',     name: 'Spawn Zero-G Orb',          category: 'Item Spawn', desc: '',  timed: false },
    { id: 'spawncollectable_ItemMineExplosive',      name: 'Spawn Explosive Mine',      category: 'Item Spawn', desc: '',  timed: false },
    { id: 'spawncollectable_ItemMineShockwave',      name: 'Spawn Shockwave Mine',      category: 'Item Spawn', desc: '',  timed: false },
    { id: 'spawncollectable_ItemMineStun',           name: 'Spawn Stun Mine',           category: 'Item Spawn', desc: '',  timed: false },
    { id: 'spawncollectable_ItemCartMedium',         name: 'Spawn Medium Cart',         category: 'Item Spawn', desc: '',  timed: false },
    { id: 'spawncollectable_ItemCartSmall',          name: 'Spawn Small Cart',          category: 'Item Spawn', desc: '',  timed: false },
    { id: 'spawncollectable_ItemExtractionTracker',  name: 'Spawn Extraction Tracker',  category: 'Item Spawn', desc: '',  timed: false },
    { id: 'spawncollectable_ItemPowerCrystal',       name: 'Spawn Power Crystal',       category: 'Item Spawn', desc: '',  timed: false },
    // Valuable Spawns
    { id: 'spawncollectable_ValuableDiamond',          name: 'Spawn Diamond',          category: 'Valuable', desc: 'Tiny',    timed: false },
    { id: 'spawncollectable_ValuableEmeraldBracelet',  name: 'Spawn Emerald Bracelet', category: 'Valuable', desc: 'Tiny',    timed: false },
    { id: 'spawncollectable_ValuableGoblet',           name: 'Spawn Goblet',           category: 'Valuable', desc: 'Tiny',    timed: false },
    { id: 'spawncollectable_ValuablePocketWatch',      name: 'Spawn Pocket Watch',     category: 'Valuable', desc: 'Tiny',    timed: false },
    { id: 'spawncollectable_ValuableCrown',            name: 'Spawn Crown',            category: 'Valuable', desc: 'Small',   timed: false },
    { id: 'spawncollectable_ValuableDoll',             name: 'Spawn Doll',             category: 'Valuable', desc: 'Small',   timed: false },
    { id: 'spawncollectable_ValuableMusicBox',         name: 'Spawn Music Box',        category: 'Valuable', desc: 'Small',   timed: false },
    { id: 'spawncollectable_ValuableGlobe',            name: 'Spawn Globe',            category: 'Valuable', desc: 'Small',   timed: false },
    { id: 'spawncollectable_ValuableGramophone',       name: 'Spawn Gramophone',       category: 'Valuable', desc: 'Medium',  timed: false },
    { id: 'spawncollectable_ValuableRadio',            name: 'Spawn Radio',            category: 'Valuable', desc: 'Medium',  timed: false },
    { id: 'spawncollectable_ValuableTrophy',           name: 'Spawn Trophy',           category: 'Valuable', desc: 'Medium',  timed: false },
    { id: 'spawncollectable_ValuablePiano',            name: 'Spawn Piano',            category: 'Valuable', desc: 'Wide',    timed: false },
    { id: 'spawncollectable_ValuableDinosaur',         name: 'Spawn Dinosaur',         category: 'Valuable', desc: 'Wide',    timed: false },
    { id: 'spawncollectable_ValuableGoldenStatue',     name: 'Spawn Golden Statue',    category: 'Valuable', desc: 'Massive', timed: false },
    { id: 'spawncollectable_ValuableGrandfatherClock', name: 'Spawn Grandfather Clock',category: 'Valuable', desc: 'Massive', timed: false },
];

const CATEGORY_COLORS = {
    'Player':     '#27ae60',
    'Toggle':     '#e05252',
    'Movement':   '#3498db',
    'Voice':      '#9b59b6',
    'Upgrade':    '#f39c12',
    'World':      '#e07c2a',
    'Item Spawn': '#00d2d3',
    'Valuable':   '#fbbf24',
};

const ALL_CATEGORIES = ['Player', 'Toggle', 'Movement', 'Voice', 'Upgrade', 'World', 'Item Spawn', 'Valuable'];

let socket = null;
let availableGifts = [];
let currentCommands = {};
let giftDropdown = null;
let serverActive = false;
let isConnected = false;
let selectedEffect = null;
let activeCategory = 'Player';

export function initRepoUI(ioConnection) {
    if (ioConnection) socket = ioConnection.socket;

    const tableBody       = $('#repoEffectsTableBody');
    const modal           = $('#repoEffectModal');
    const addBtn          = $('#addRepoEffectBtn');
    const sidebarDot      = $('#repoStatusSidebarDot');
    const statusTextLarge = $('#repoStatusTextLarge');
    const connectBtn      = $('#repoConnectBtn');

    giftDropdown = new GiftDropdown({
        inputId:   'repoGiftInput',
        resultsId: 'repoGiftResults',
        previewId: 'repoGiftImagePreview',
    });

    // Build category tabs
    buildCategoryTabs();

    // ── UI Actions ────────────────────────────────────────────────────────────
    $('#repoSetupBtn').off('click').on('click', () => $('#repoSetupModal').css('display', 'flex'));
    $('#closeRepoSetupBtn, #repoGotItBtn').off('click').on('click', () => $('#repoSetupModal').hide());
    addBtn.off('click').on('click', () => openModal());

    connectBtn.off('click').on('click', () => {
        socket.emit(!serverActive ? 'repoStart' : 'repoStop');
    });

    $('#saveRepoEffectBtn').off('click').on('click', saveCurrentMapping);
    $('#cancelRepoModalBtn').off('click').on('click', () => { modal.hide(); resetModal(); });

    // ── Status Engine ──────────────────────────────────────────────────────────
    function updateUI(connected, active) {
        isConnected = !!connected;
        serverActive = !!active;

        const bridgeCard      = $('#repoBridgeCard');
        const statusIndicator = $('#repoStatusIndicator');
        const btnText         = $('#repoBtnText');
        const btnIcon         = $('#repoBtnIcon');

        btnText.text(serverActive ? 'Stop Bridge' : 'Start Bridge');
        connectBtn.removeClass('btn-primary btn-secondary').addClass(serverActive ? 'btn-secondary' : 'btn-primary');

        btnIcon.html(serverActive
            ? `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><rect x="6" y="6" width="12" height="12"></rect></svg>`
            : `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>`
        );

        if (!serverActive) {
            statusTextLarge.text('Offline').css('color', 'var(--dim)');
            statusIndicator.css({ background: 'var(--danger)', 'box-shadow': '0 0 12px var(--danger)' });
            bridgeCard.css('border-left-color', 'var(--danger)');
        } else {
            const statusColor = isConnected ? 'var(--success)' : 'var(--warning)';
            statusTextLarge.text(isConnected ? 'Connected' : 'Listening...').css('color', statusColor);
            statusIndicator.css({ background: statusColor, 'box-shadow': `0 0 12px ${statusColor}` });
            bridgeCard.css('border-left-color', statusColor);
        }

        sidebarDot.toggle(isConnected).css('background', 'var(--success)');
    }

    if (socket) {
        socket.on('repoStatus', data => updateUI(data.isConnected, data.serverActive));
    }

    // ── Category Tabs ──────────────────────────────────────────────────────────
    function buildCategoryTabs() {
        const container = $('#repoCategoryTabs').empty();
        ALL_CATEGORIES.forEach(cat => {
            const color = CATEGORY_COLORS[cat] || '#888';
            const btn = $(`<button style="padding:4px 10px;border-radius:6px;border:1px solid ${activeCategory === cat ? color : 'var(--border)'};background:${activeCategory === cat ? color + '22' : 'transparent'};color:${activeCategory === cat ? color : 'var(--dim)'};font-size:11px;font-weight:700;cursor:pointer;transition:all .15s;">${cat}</button>`);
            btn.on('click', () => {
                activeCategory = cat;
                buildCategoryTabs();
                renderEffectCards(selectedEffect ? selectedEffect.id : null);
            });
            container.append(btn);
        });
    }

    function renderEffectCards(selId) {
        const cards = $('#repoEffectCards').empty();
        const filtered = REPO_EFFECTS.filter(e => e.category === activeCategory);
        const color = CATEGORY_COLORS[activeCategory] || '#888';

        filtered.forEach(e => {
            const isSelected = e.id === selId;
            const card = $(`
                <div style="padding:8px 10px;border:1px solid ${isSelected ? color : 'var(--border)'};border-radius:8px;cursor:pointer;background:${isSelected ? color + '22' : 'var(--bg4)'};transition:border-color .15s,background .15s;">
                    <div style="font-weight:700;font-size:.82rem;color:var(--text);margin-bottom:2px;display:flex;align-items:center;gap:4px;">
                        ${e.timed ? `<span style="font-size:9px;padding:1px 5px;border-radius:3px;background:${color}33;color:${color};font-weight:800;text-transform:uppercase;">TIMED</span>` : ''}
                        ${e.name}
                    </div>
                    ${e.desc ? `<div style="font-size:.72rem;color:var(--text-muted);line-height:1.4;">${e.desc}</div>` : ''}
                </div>
            `);
            card.on('click', () => {
                selectedEffect = e;
                renderEffectCards(e.id);
                $('#repoDurationRow').toggle(!!e.timed);
            });
            cards.append(card);
        });

        if (!filtered.length) {
            cards.append(`<div style="grid-column:1/-1;text-align:center;padding:20px;color:var(--dim);font-size:.85rem;">No effects in this category.</div>`);
        }
    }

    // ── Table Rendering ────────────────────────────────────────────────────────
    function getEffectName(effect) {
        if (!effect) return 'Unknown';
        const code = typeof effect === 'string' ? effect : effect.code;
        const found = REPO_EFFECTS.find(e => e.id === code);
        return found ? found.name : code;
    }

    function renderTable() {
        tableBody.empty();
        const keys = Object.keys(currentCommands);
        if (!keys.length) return tableBody.append('<tr><td colspan="3" style="text-align:center;padding:30px;color:var(--dim);">No effects mapped.</td></tr>');

        keys.forEach(giftName => {
            const effect = currentCommands[giftName];
            const gift   = availableGifts.find(g => g.name === giftName);
            const code   = typeof effect === 'string' ? effect : effect.code;
            const found  = REPO_EFFECTS.find(e => e.id === code);
            const color  = found ? (CATEGORY_COLORS[found.category] || '#888') : '#888';

            const effectTd = $('<td class="command-cell"></td>');
            const inner    = $('<div style="display:flex;align-items:center;gap:8px;"></div>');
            if (found) inner.append($(`<span style="font-size:9px;padding:1px 6px;border-radius:3px;background:${color}33;color:${color};font-weight:800;text-transform:uppercase;">${found.category}</span>`));
            inner.append($('<span></span>').text(getEffectName(effect)));
            effectTd.append(inner);

            const row = $('<tr></tr>');
            row.append(
                makeGiftCell(giftName, gift),
                effectTd,
                makeActionCell(giftName, {
                    onTest:   g => window.testRepoEffect(g),
                    onEdit:   g => openModal(g),
                    onDelete: g => window.deleteRepoMapping(g)
                })
            );
            tableBody.append(row);
        });
    }

    // ── Modal ─────────────────────────────────────────────────────────────────
    function resetModal() {
        selectedEffect = null;
        activeCategory = 'Player';
        buildCategoryTabs();
        renderEffectCards(null);
        $('#repoDurationRow').hide();
        $('#repoEffectDuration').val(10);
        $('#repoWaitStreak').prop('checked', true);
    }

    function openModal(editGiftName) {
        resetModal();
        if (editGiftName) {
            giftDropdown.setValue(editGiftName);
            $('#repoModalTitle').text('Edit R.E.P.O. Effect');
            const effect = currentCommands[editGiftName];
            const code   = typeof effect === 'string' ? effect : effect.code;
            const found  = REPO_EFFECTS.find(e => e.id === code);
            if (found) {
                selectedEffect = found;
                activeCategory = found.category;
                buildCategoryTabs();
                renderEffectCards(found.id);
                if (found.timed) {
                    $('#repoDurationRow').show();
                    $('#repoEffectDuration').val((typeof effect === 'object' && effect.duration) ? effect.duration : 10);
                }
            }
            if (typeof effect === 'object') {
                $('#repoWaitStreak').prop('checked', effect.waitForStreak !== false);
            }
        } else {
            giftDropdown.setValue('');
            $('#repoModalTitle').text('Add R.E.P.O. Effect');
        }
        modal.css('display', 'flex');
    }

    function saveCurrentMapping() {
        const giftName = giftDropdown.getValue();
        if (!giftName) { showToast('You must choose a gift!', 'warning'); return; }
        if (!selectedEffect) { showToast('You must choose an effect!', 'warning'); return; }

        const isEdit = $('#repoModalTitle').text().includes('Edit');
        if (!isEdit && currentCommands[giftName]) {
            showToast(`"${giftName}" already has an effect! Delete it first.`, 'error');
            return;
        }

        const payload = {
            code: selectedEffect.id,
            waitForStreak: $('#repoWaitStreak').is(':checked'),
            ...(selectedEffect.timed ? { duration: parseInt($('#repoEffectDuration').val()) || 10 } : {})
        };

        saveMapping(giftName, payload, 'save');
    }

    async function saveMapping(giftName, effect, action) {
        try {
            const r = await fetch('/api/repo/commands', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ giftName, effect, action })
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

    window.testRepoEffect = (g) => {
        fetch('/api/repo/test', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ giftName: g }) })
            .then(r => r.json()).then(res => showToast(res.success ? 'Sent!' : res.error, res.success ? 'success' : 'error'));
    };

    window.deleteRepoMapping = (g) => {
        showConfirm({ title: 'Delete?', message: `Remove mapping for ${g}?` }).then(ok => { if (ok) saveMapping(g, null, 'delete'); });
    };

    // ── Initial Load ───────────────────────────────────────────────────────────
    async function loadAllData() {
        try {
            const [cmdsRes, giftsRes] = await Promise.all([
                fetch('/api/repo/commands').then(r => r.json()),
                fetch('/api/gifts').then(r => r.json())
            ]);
            currentCommands = cmdsRes.commands || {};
            availableGifts  = giftsRes.gifts || [];
            giftDropdown.updateGifts(availableGifts);
            renderTable();
        } catch (e) { console.error('[Repo] Load Error', e); }
    }

    loadAllData();
}
