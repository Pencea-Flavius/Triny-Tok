import { showToast, showConfirm } from './dialog.js';
import { GiftDropdown } from './components/GiftDropdown.js';
import { makeGiftCell, makeActionCell } from './components/GiftActionButtons.js';

// ─── Basic (non-spawn) effects ────────────────────────────────────────────────
const BASIC_EFFECTS = [
    { id: 'player_heal',          name: 'Heal',              category: 'Player',   desc: '+100 health',               timed: false },
    { id: 'player_hurt',          name: 'Hurt',              category: 'Player',   desc: '-25 health',                timed: false },
    { id: 'player_kill',          name: 'Kill',              category: 'Player',   desc: 'Instant death',             timed: false },
    { id: 'player_refill_energy', name: 'Refill Stamina',    category: 'Player',   desc: 'Full stamina',              timed: false },
    { id: 'player_drain_energy',  name: 'Drain Stamina',     category: 'Player',   desc: 'Zero stamina',              timed: false },
    { id: 'player_invincible',    name: 'Invincible',        category: 'Toggle',   desc: 'God mode',                  timed: true  },
    { id: 'player_infinitestam',  name: 'Infinite Stamina',  category: 'Toggle',   desc: 'Infinite stamina',          timed: true  },
    { id: 'player_disableinput',  name: 'Disable Input',     category: 'Toggle',   desc: 'Freeze controls',           timed: true  },
    { id: 'player_disablecrouch', name: 'Disable Crouch',    category: 'Toggle',   desc: "Can't crouch",              timed: true  },
    { id: 'player_fast',                name: 'Speed Boost',         category: 'Movement', desc: '2× speed',          timed: true  },
    { id: 'player_slow',                name: 'Slow',                category: 'Movement', desc: '0.5× speed',        timed: true  },
    { id: 'player_antigravity',         name: 'Anti Gravity',        category: 'Movement', desc: 'Float',             timed: true  },
    { id: 'player_teleport_random',     name: 'TP to Random Player', category: 'Movement', desc: 'TP to a random player', timed: false },
    { id: 'player_teleport_extraction', name: 'TP to Extraction',    category: 'Movement', desc: 'TP to nearest exit', timed: false },
    { id: 'player_teleport_truck',      name: 'TP to Truck',         category: 'Movement', desc: 'TP back to truck',  timed: false },
    { id: 'player_teleport_room',       name: 'TP to Random Room',   category: 'Movement', desc: 'TP to random level point', timed: false },
    { id: 'playerPitch_high', name: 'High Pitch', category: 'Voice', desc: 'Chipmunk voice', timed: true },
    { id: 'playerPitch_low',  name: 'Low Pitch',  category: 'Voice', desc: 'Deep voice',     timed: true },
    { id: 'revive_all',          name: 'Revive All',            category: 'World', desc: 'Revives all dead players',   timed: false },
    { id: 'closeAllDoors',       name: 'Close All Doors',       category: 'World', desc: 'Slams every door',           timed: false },
    { id: 'increase_haul_goal',  name: 'Increase Quota (1.5x)', category: 'World', desc: 'Multiplies quota by 1.5',    timed: false },
    { id: 'decrease_haul_goal',  name: 'Decrease Quota (0.5x)', category: 'World', desc: 'Multiplies quota by 0.5',    timed: false },
    { id: 'destroy_random_item', name: 'Destroy Random Item',   category: 'World', desc: 'Destroys a random valuable', timed: false },
];

const EFFECT_CATEGORIES    = ['Player', 'Toggle', 'Movement', 'Voice', 'World'];
const EFFECT_CATEGORY_COLORS = {
    Player: '#27ae60', Toggle: '#e05252', Movement: '#3498db',
    Voice: '#9b59b6', World: '#e07c2a',
};

// ─── Item image map (id suffix → filename) ───────────────────────────────────
const ITEM_IMAGE = {
    ItemMeleeBaseballBat:           'Baseball Bat.PNG',
    ItemGunStun:                    'Bolt zap.png',
    ItemCartCannon:                 'C.A.R.T. Canon.png',
    ItemCartLaser:                  'C.A.R.T. Laser.png',
    ItemCartSmall:                  'CartSmall.png',
    ItemCartMedium:                 'CartBig.png',
    ItemDroneBattery:               'DroneRecharge.png',
    ItemDroneFeather:               'DroneFeather.png',
    ItemDroneIndestructible:        'DroneIndestructible.png',
    ItemDroneTorque:                'DroneRoll.png',
    ItemDroneZeroGravity:           'DroneZeroGravity.png',
    ItemDuckBucket:                 'Duck Bucket.png',
    ItemGrenadeDuctTaped:           'GrenadeDuctTaped.png',
    ItemGrenadeExplosive:           'Grenade.png',
    ItemGrenadeHuman:               'GrenadeHuman.png',
    ItemGrenadeShockwave:           'GrenadeShockwave.png',
    ItemGrenadeStun:                'GrenadeStun.png',
    ItemGunHandgun:                 'GunHandgun.png',
    ItemGunLaser:                   'PhotonBlaster.png',
    ItemGunShockwave:               'Pulse Pistol R.E.P.O..png',
    ItemGunShotgun:                 'GunShotgun.png',
    ItemGunTranq:                   'GunTranq.png',
    ItemHealthPackLarge:            'HealthLarge.png',
    ItemHealthPackMedium:           'HealthMedium.png',
    ItemHealthPackSmall:            'HealthSmall.png',
    ItemMeleeFryingPan:             'MeleeFryingPan.png',
    ItemMeleeInflatableHammer:      'MeleeInflatableHammer.png',
    ItemMeleeStunBaton:             'Prodzap2.png',
    ItemMeleeSledgeHammer:          'MeleeSledgeHammer.png',
    ItemMeleeSword:                 'MeleeSword.png',
    ItemMineExplosive:              'Mine.png',
    ItemMineShockwave:              'MineShockwave.png',
    ItemMineStun:                   'Trapzap transparent.png',
    ItemOrbZeroGravity:             'ZeroGravityOrb.png',
    ItemPhaseBridge:                'Phase Bridge R.E.P.O..png',
    ItemPowerCrystal:               'EnergyCrystal.png',
    ItemRubberDuck:                 'RubberDuck.png',
    ItemStaffTorque:                'RollStaff.png',
    ItemStaffVoid:                  'VoidStaff.png',
    ItemStaffZeroGravity:           'ZeroGravityStaff.png',
    ItemUpgradeDeathHeadBattery:    'Death Head Battery Upgrade.png',
    ItemUpgradeMapPlayerCount:      'Player Count Upgrade.png',
    ItemUpgradePlayerCrouchRest:    'Crouch Rest Upgrade.png',
    ItemUpgradePlayerEnergy:        'Stamina Upgrade.png',
    ItemUpgradePlayerExtraJump:     'Extra Jump Upgrade.png',
    ItemUpgradePlayerGrabRange:     'Range Upgrade.png',
    ItemUpgradePlayerGrabStrength:  'Strength Upgrade.png',
    ItemUpgradePlayerHealth:        'Upgrade Health Albedo.png',
    ItemUpgradePlayerSprintSpeed:   'Sprint Speed Upgrade.png',
    ItemUpgradePlayerTumbleClimb:   'Tumble Climb Upgrade.png',
    ItemUpgradePlayerTumbleLaunch:  'Tumble Launch Upgrade.png',
    ItemUpgradePlayerTumbleWings:   'Tumble Wings Upgrade.png',
    ItemLeafBlower:                 'LeafBlower.png',
    ItemValuableTracker:            'TrackerValuable.png',
    ItemExtractionTracker:          'TrackerExtraction.png',
};

// Maps spawncollectable upgrade item ID → direct-apply effect code
const UPGRADE_ITEM_TO_EFFECT = {
    'spawncollectable_ItemUpgradePlayerEnergy':      'player_upgrade_energy',
    'spawncollectable_ItemUpgradePlayerHealth':       'player_upgrade_health',
    'spawncollectable_ItemUpgradePlayerExtraJump':    'player_upgrade_jump',
    'spawncollectable_ItemUpgradePlayerGrabRange':    'player_upgrade_grabrange',
    'spawncollectable_ItemUpgradePlayerGrabStrength': 'player_upgrade_grabstrength',
    'spawncollectable_ItemUpgradePlayerSprintSpeed':  'player_upgrade_sprint',
    'spawncollectable_ItemUpgradePlayerTumbleLaunch': 'player_upgrade_tumble',
    'spawncollectable_ItemUpgradeMapPlayerCount':     'player_upgrade_map',
};
const EFFECT_TO_UPGRADE_ITEM = Object.fromEntries(
    Object.entries(UPGRADE_ITEM_TO_EFFECT).map(([k, v]) => [v, k])
);

function getItemCat(item) {
    return item.item_type || 'Other';
}

function normalize(s) { return s.toLowerCase().replace(/[^a-z0-9]/g, ''); }

function findValuableImage(name, availableImages) {
    const nameParts = name.toLowerCase().split(' ').filter(p => p.length > 2);
    let best = null, bestScore = 0;
    for (const f of availableImages) {
        const fn = f.toLowerCase().replace(/\.(png|jpg|gif)$/i, '').replace(/\bvaluable\b/g, '').trim();
        let score = 0;
        for (const part of nameParts) {
            if (fn.includes(part)) score++;
        }
        if (score > bestScore || (score === bestScore && score > 0 && f.length < (best || f).length)) {
            best = f; bestScore = score;
        }
    }
    return bestScore >= Math.min(nameParts.length, 1) ? best : null;
}

function findEnemyImage(inGameName, availableImages) {
    const norm = normalize(inGameName);
    let best = null, bestLen = Infinity;
    for (const f of availableImages) {
        const fn = normalize(f.replace(/\.(png|jpg|gif)$/i, ''));
        if (fn.startsWith(norm) || fn.includes(norm)) {
            if (f.length < bestLen) { best = f; bestLen = f.length; }
        }
    }
    return best;
}

// ─── State ────────────────────────────────────────────────────────────────────
let socket = null;
let availableGifts = [];
let currentCommands = {};
let images = { items: [], valuables: [], enemies: [] };

let giftDropdown = null;
let serverActive = false;
let isConnected  = false;

let selectedEffect = null;
let activeEffectCat = 'Player';
let activeSpawnType = 'spawn_item';

let dbItems     = [];
let dbValuables = [];
let dbEnemies   = [];

export function initRepoUI(ioConnection) {
    if (ioConnection) socket = ioConnection.socket;

    giftDropdown = new GiftDropdown({ inputId: 'repoGiftInput', resultsId: 'repoGiftResults', previewId: 'repoGiftImagePreview' });

    $('#addRepoEffectBtn').on('click', () => openModal());

    $('#repoSetupBtn').on('click', () => $('#repoSetupModal').css('display', 'flex'));
    $('#closeRepoSetupBtn, #repoGotItBtn').on('click', () => $('#repoSetupModal').hide());
    $('#repoConnectBtn').on('click', () => socket.emit(!serverActive ? 'repoStart' : 'repoStop'));

    $('#repoModeSpawnBtn').on('click', () => {
        $('#repoModeSpawnBtn').addClass('active');
        $('#repoModePresetBtn').removeClass('active');
        $('#repoSpawnActionView').css('display', 'flex');
        $('#repoPresetActionView').hide();
    });

    $('#repoModePresetBtn').on('click', () => {
        $('#repoModePresetBtn').addClass('active');
        $('#repoModeSpawnBtn').removeClass('active');
        $('#repoPresetActionView').css('display', 'flex');
        $('#repoSpawnActionView').hide();
        renderEffectCards(selectedEffect ? selectedEffect.id : null);
    });

    $('.repo-action-tab').on('click', function() {
        $('.repo-action-tab').removeClass('active');
        $(this).addClass('active');
        activeSpawnType = $(this).data('action');
        clearSpawnSelection();
        updateCategoryFilter();
        updateSpawnSuggestions();
    });

    $('#repoSpawnSearchInput').on('input focus', function () {
        updateSpawnSuggestions($(this).val());
    });

    $('#repoFilterCategory').on('change', function() {
        updateSpawnSuggestions($('#repoSpawnSearchInput').val());
    });

    $(document).on('click', (e) => {
        if (!$(e.target).closest('#repoSpawnSearchWrapper, #repoSpawnSearchResults').length) {
            $('#repoSpawnSearchResults').hide();
        }
    });

    $('#repoWaitStreak').on('change', function() {
        if ($(this).is(':checked')) {
            $('#repoDelayConfigRow').hide();
        } else {
            $('#repoDelayConfigRow').css('display', 'flex');
        }
    });
    $('#repoExecuteDelayInput').on('input', function() {
        $('#repoDelayValueDisplay').text($(this).val() + 's');
    });

    $('#saveRepoEffectBtn').on('click', saveCurrentMapping);
    $('#cancelRepoModalBtn').on('click', () => { $('#repoEffectModal').hide(); resetModal(); });

    function updateUI(connected, active) {
        isConnected = !!connected;
        serverActive = !!active;
        const bridgeCard      = $('#repoBridgeCard');
        const statusIndicator = $('#repoStatusIndicator');
        const statusTextLarge = $('#repoStatusTextLarge');
        const btnText  = $('#repoBtnText');
        const btnIcon  = $('#repoBtnIcon');
        btnText.text(serverActive ? 'Stop Bridge' : 'Start Bridge');
        $('#repoConnectBtn').removeClass('btn-primary btn-secondary').addClass(serverActive ? 'btn-secondary' : 'btn-primary');
        btnIcon.html(serverActive
            ? `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><rect x="6" y="6" width="12" height="12"></rect></svg>`
            : `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>`
        );
        if (!serverActive) {
            statusTextLarge.text('Offline').css('color', 'var(--dim)');
            statusIndicator.css({ background: 'var(--danger)', 'box-shadow': '0 0 12px var(--danger)' });
            bridgeCard.css('border-left-color', 'var(--danger)');
        } else {
            const sc = isConnected ? 'var(--success)' : 'var(--warning)';
            statusTextLarge.text(isConnected ? 'Connected' : 'Listening...').css('color', sc);
            statusIndicator.css({ background: sc, 'box-shadow': `0 0 12px ${sc}` });
            bridgeCard.css('border-left-color', sc);
        }
        $('#repoStatusSidebarDot').toggle(isConnected).css('background', 'var(--success)');
    }

    if (socket) socket.on('repoStatus', d => updateUI(d.isConnected, d.serverActive));

    function buildEffectCategoryTabs() {
        const container = $('#repoCategoryTabs').empty();
        container.css({ display: 'flex', gap: '2px', background: 'var(--bg2)', padding: '3px', borderRadius: '10px', border: '1px solid var(--border)', overflowX: 'auto', scrollbarWidth: 'none', marginBottom: '4px' });
        EFFECT_CATEGORIES.forEach(cat => {
            const color = EFFECT_CATEGORY_COLORS[cat] || '#888';
            const active = activeEffectCat === cat;
            const btn = $(`<button style="flex:1 0 auto;padding:8px 14px;border-radius:8px;border:none;background:${active ? 'var(--bg-light)' : 'transparent'};color:${active ? 'var(--text)' : 'var(--dim)'};font-size:11px;font-weight:${active ? '800' : '600'};cursor:pointer;transition:all .2s;white-space:nowrap;display:flex;align-items:center;gap:8px;box-shadow:${active ? '0 2px 8px rgba(0,0,0,0.2)' : 'none'};">
                <div style="width:8px;height:8px;border-radius:50%;background:${color};box-shadow:0 0 6px ${color}88;opacity:${active ? 1 : 0.5};transition:opacity .2s;"></div>${cat}</button>`);
            btn.on('click', () => { activeEffectCat = cat; buildEffectCategoryTabs(); renderEffectCards(selectedEffect ? selectedEffect.id : null); });
            container.append(btn);
        });
    }

    function renderEffectCards(selId) {
        const cards = $('#repoEffectCards').empty();
        const filtered = BASIC_EFFECTS.filter(e => e.category === activeEffectCat);
        const color = EFFECT_CATEGORY_COLORS[activeEffectCat] || '#888';
        filtered.forEach(e => {
            const isSel = e.id === selId;
            const card = $(`<div style="padding:12px;border:1px solid ${isSel ? color : 'var(--border)'};border-radius:12px;cursor:pointer;background:${isSel ? color + '15' : 'var(--bg4)'};transition:all .2s;display:flex;flex-direction:column;gap:4px;position:relative;overflow:hidden;">
                ${isSel ? `<div style="position:absolute;top:0;right:0;width:30px;height:30px;background:${color};clip-path:polygon(100% 0,0 0,100% 100%);display:flex;align-items:flex-start;justify-content:flex-end;padding:4px;"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg></div>` : ''}
                <div style="font-weight:800;font-size:.85rem;color:${isSel ? 'var(--text)' : 'var(--text-muted)'};display:flex;align-items:center;gap:6px;">${e.name}${e.timed ? `<span style="font-size:8px;padding:1px 5px;border-radius:4px;background:${color}22;color:${color};font-weight:900;text-transform:uppercase;border:1px solid ${color}33;">TIMED</span>` : ''}</div>
                ${e.desc ? `<div style="font-size:.7rem;color:var(--dim);line-height:1.3;">${e.desc}</div>` : ''}
            </div>`);
            card.on('mouseover', function() { if (!isSel) $(this).css({ borderColor: color + '88', background: 'var(--bg3)' }); });
            card.on('mouseout',  function() { if (!isSel) $(this).css({ borderColor: 'var(--border)', background: 'var(--bg4)' }); });
            card.on('click', () => {
                selectedEffect = e;
                renderEffectCards(e.id);
                $('#repoDurationRow').toggle(!!e.timed);
                $('#repoUpgradeDeliveryRow').toggle(e.category === 'Upgrade' && !!e.upgradeItem);
            });
            cards.append(card);
        });
        if (!filtered.length) cards.append(`<div style="grid-column:1/-1;text-align:center;padding:40px;color:var(--dim);">No effects in this category.</div>`);
    }

    function getEntityImage(entity, type) {
        if (type === 'spawn_item') {
            const key = entity.id.replace('spawncollectable_', '');
            const file = ITEM_IMAGE[key];
            return file ? `/images/repo/items/${encodeURIComponent(file)}` : null;
        }
        if (type === 'spawn_valuable') {
            const file = findValuableImage(entity.name, images.valuables);
            return file ? `/images/repo/valuables/${encodeURIComponent(file)}` : null;
        }
        const file = findEnemyImage(entity.in_game_name || entity.name, images.enemies);
        return file ? `/images/repo/enemies/${encodeURIComponent(file)}` : null;
    }

    function updateCategoryFilter() {
        const select = $('#repoFilterCategory');
        const row = $('#repoSpawnFilters');
        select.find('option:not(:first)').remove();
        if (activeSpawnType === 'spawn_item') {
            const cats = [...new Set(dbItems.map(item => getItemCat(item)))].sort();
            cats.forEach(cat => select.append(`<option value="${cat}">${cat}</option>`));
            row.show();
        } else {
            row.hide();
        }
        select.val('');
    }

    function clearSpawnSelection() {
        $('#repoSpawnSearchInput').val('');
        $('#repoSelectedSpawnId').val('');
        $('#repoSpawnPreview').html('<span style="font-size:9px;color:var(--text-muted);">ICON</span>');
        $('#repoSpawnNameLabel').hide();
        $('#repoUpgradeSpawnRow').hide();
        $('#repoSpawnSearchResults').hide();
    }

    function updateSpawnSuggestions(query = '') {
        const results = $('#repoSpawnSearchResults').empty();

        let entities = [];
        if (activeSpawnType === 'spawn_item') entities = dbItems;
        else if (activeSpawnType === 'spawn_valuable') {
            // Prefer biome-specific over generic (biome:null) for duplicate names
            const nameMap = new Map();
            for (const v of dbValuables) {
                const existing = nameMap.get(v.name);
                if (!existing || (existing.biome === null && v.biome !== null)) {
                    nameMap.set(v.name, v);
                }
            }
            entities = [...nameMap.values()];
        }
        else entities = dbEnemies;

        const catFilter = activeSpawnType === 'spawn_item' ? ($('#repoFilterCategory').val() || '') : '';

        const filtered = entities.filter(e => {
            const label = activeSpawnType === 'spawn_enemy' ? (e.in_game_name || e.name) : e.name;
            if (!label.toLowerCase().includes(query.toLowerCase())) return false;
            if (catFilter) return getItemCat(e) === catFilter;
            return true;
        });

        filtered.forEach(e => {
            const label = activeSpawnType === 'spawn_enemy' ? (e.in_game_name || e.name) : e.name;
            const imgUrl = getEntityImage(e, activeSpawnType);

            const imgHtml = imgUrl
                ? `<img src="${imgUrl}">`
                : `<span style="font-size:9px;color:var(--dim);">?</span>`;

            const item = $(`
                <div class="isaac-item-result">
                    <div class="isaac-item-icon">${imgHtml}</div>
                    <div class="item-info">
                        <div class="item-name">${label}</div>
                    </div>
                </div>
            `);
            item.on('click', () => {
                selectSpawn(e, label, imgUrl);
                results.hide();
            });
            results.append(item);
        });

        if (results.children().length === 0) { results.hide(); return; }
        results.show();
    }

    function selectSpawn(e, label, imgUrl) {
        $('#repoSelectedSpawnId').val(e.id);
        $('#repoSpawnSearchInput').val(label);
        $('#repoSpawnNameLabel').text(label).show();

        if (imgUrl) {
            $('#repoSpawnPreview').html(`<img src="${imgUrl}" style="width:100%;height:100%;object-fit:contain;filter:drop-shadow(0 0 6px var(--accent-glow));">`);
        } else {
            $('#repoSpawnPreview').html(`<span style="font-size:9px;color:var(--text-muted);">?</span>`);
        }

        const isUpgrade = activeSpawnType === 'spawn_item' && e.id.includes('Upgrade');
        $('#repoUpgradeSpawnRow').toggle(isUpgrade);
    }

    function resetModal() {
        $('#repoModeSpawnBtn').trigger('click');
        $('.repo-action-tab[data-action="spawn_item"]').trigger('click');
        clearSpawnSelection();
        $('input[name="repoUpgradeDelivery"][value="direct"]').prop('checked', true);

        selectedEffect = null;
        activeEffectCat = 'Player';
        buildEffectCategoryTabs();
        renderEffectCards(null);
        $('#repoDurationRow').hide();
        $('#repoUpgradeDeliveryRow').hide();
        $('input[name="repoUpgradeDeliveryModal"][value="direct"]').prop('checked', true);
        $('#repoEffectDuration').val(10);
        $('#repoWaitStreak').prop('checked', true).trigger('change');
        $('#repoTargetRandom').prop('checked', false);
        $('#repoExecuteDelayInput').val(0.2);
        $('#repoDelayValueDisplay').text('0.2s');
    }

    let editingGiftName = null;

    function openModal(editGiftName) {
        resetModal();
        editingGiftName = editGiftName || null;
        if (editGiftName) {
            giftDropdown.setValue(editGiftName);
            $('#repoModalTitle').text('Edit R.E.P.O. Effect');
            const effect = currentCommands[editGiftName];
            const code = typeof effect === 'string' ? effect : effect.code;

            // Check if it's a direct-apply upgrade effect (e.g. player_upgrade_energy)
            const upgradeItemCode = EFFECT_TO_UPGRADE_ITEM[code];
            const basicFound = BASIC_EFFECTS.find(e => e.id === code);
            if (basicFound) {
                // Preset Effect
                $('#repoModePresetBtn').trigger('click');
                selectedEffect = basicFound;
                activeEffectCat = basicFound.category;
                buildEffectCategoryTabs();
                renderEffectCards(basicFound.id);
                if (basicFound.timed) { $('#repoDurationRow').show(); $('#repoEffectDuration').val((typeof effect === 'object' && effect.duration) ? effect.duration : 10); }
            } else {
                // Spawn Action
                $('#repoModeSpawnBtn').trigger('click');
                let foundEntity = null;
                let label = '';
                let imgUrl = '';
                // Resolve direct-apply upgrade back to its item ID for editing
                const lookupCode = upgradeItemCode || code;
                if (lookupCode.startsWith('spawnenemy_')) {
                    $('.repo-action-tab[data-action="spawn_enemy"]').trigger('click');
                    foundEntity = dbEnemies.find(e => e.id === lookupCode);
                    if (foundEntity) {
                        label = foundEntity.in_game_name || foundEntity.name;
                        imgUrl = getEntityImage(foundEntity, 'spawn_enemy');
                    }
                } else {
                    foundEntity = dbItems.find(i => i.id === lookupCode);
                    if (foundEntity) {
                        $('.repo-action-tab[data-action="spawn_item"]').trigger('click');
                        label = foundEntity.name;
                        imgUrl = getEntityImage(foundEntity, 'spawn_item');
                    } else {
                        foundEntity = dbValuables.find(v => v.id === lookupCode);
                        if (foundEntity) {
                            $('.repo-action-tab[data-action="spawn_valuable"]').trigger('click');
                            label = foundEntity.name;
                            imgUrl = getEntityImage(foundEntity, 'spawn_valuable');
                        }
                    }
                }
                if (foundEntity) selectSpawn(foundEntity, label, imgUrl);

                if (activeSpawnType === 'spawn_item' && foundEntity && foundEntity.id.includes('Upgrade')) {
                    if (upgradeItemCode) {
                        // Was saved as a direct-apply effect
                        $('input[name="repoUpgradeDelivery"][value="direct"]').prop('checked', true);
                    } else {
                        // Was saved as a spawn item
                        $('input[name="repoUpgradeDelivery"][value="item"]').prop('checked', true);
                    }
                }
            }

            if (typeof effect === 'object') {
                $('#repoWaitStreak').prop('checked', effect.waitForStreak !== false).trigger('change');
                $('#repoTargetRandom').prop('checked', !!effect.targetRandom);
                if (effect.executeDelay) {
                    $('#repoExecuteDelayInput').val(effect.executeDelay);
                    $('#repoDelayValueDisplay').text(effect.executeDelay + 's');
                }
            }
        } else {
            giftDropdown.setValue('');
            $('#repoModalTitle').text('Add R.E.P.O. Effect');
        }
        $('#repoEffectModal').css('display', 'flex');
    }

    function saveCurrentMapping() {
        const giftName = giftDropdown.getValue();
        if (!giftName) { showToast('Choose a gift!', 'warning'); return; }
        
        let code = null;
        let payload = null;
        const isPresetMode = $('#repoModePresetBtn').hasClass('active');
        const waitForStreak = $('#repoWaitStreak').is(':checked');
        const executeDelay = waitForStreak ? undefined : (parseFloat($('#repoExecuteDelayInput').val()) || 0.2);

        if (isPresetMode) {
            if (!selectedEffect) { showToast('Choose an effect!', 'warning'); return; }
            code = selectedEffect.id;
            const upgradeAsItem = selectedEffect.category === 'Upgrade' && selectedEffect.upgradeItem && $('input[name="repoUpgradeDeliveryModal"]:checked').val() === 'item';
            if (upgradeAsItem) code = selectedEffect.upgradeItem;
            payload = { code, waitForStreak, targetRandom: $('#repoTargetRandom').is(':checked'), ...(selectedEffect.timed ? { duration: parseInt($('#repoEffectDuration').val()) || 10 } : {}), ...(executeDelay !== undefined ? { executeDelay } : {}) };
        } else {
            code = $('#repoSelectedSpawnId').val();
            if (!code) { showToast('Choose an entity to spawn!', 'warning'); return; }
            const isUpgradeItem = activeSpawnType === 'spawn_item' && code.includes('Upgrade');
            if (isUpgradeItem && $('input[name="repoUpgradeDelivery"]:checked').val() === 'direct') {
                const effectId = UPGRADE_ITEM_TO_EFFECT[code];
                if (effectId) code = effectId;
            }
            payload = { code, waitForStreak, targetRandom: $('#repoTargetRandom').is(':checked'), ...(executeDelay !== undefined ? { executeDelay } : {}) };
        }

        if (currentCommands[giftName] && giftName !== editingGiftName) { showToast(`"${giftName}" already mapped! Delete it first.`, 'error'); return; }

        saveMapping(giftName, payload, 'save', editingGiftName !== giftName ? editingGiftName : null, () => { $('#repoEffectModal').hide(); resetModal(); editingGiftName = null; });
    }

    function isSpawnCode(code) {
        return code.startsWith('spawncollectable_') || code.startsWith('spawnenemy_');
    }

    function getSpawnLabel(code) {
        if (code.startsWith('spawnenemy_')) {
            const key = code.replace('spawnenemy_', '');
            const e = dbEnemies.find(e2 => e2.id === code);
            return e ? (e.in_game_name || e.name) : key;
        }
        const item = dbItems.find(i => i.id === code) || dbValuables.find(v => v.id === code);
        return item ? item.name : code.replace('spawncollectable_', '');
    }

    function getSpawnBadge(code) {
        if (code.startsWith('spawnenemy_')) return { label: 'Enemy', color: '#7f8c8d' };
        if (dbItems.find(i => i.id === code)) return { label: 'Item', color: '#00d2d3' };
        return { label: 'Valuable', color: '#fbbf24' };
    }

    function renderTables() {
        const tbody = $('#repoEffectsTableBody').empty();
        const keys = Object.keys(currentCommands);

        if (!keys.length) {
            tbody.append('<tr><td colspan="3" style="text-align:center;padding:20px;color:var(--dim);">No effects mapped.</td></tr>');
            return;
        }

        keys.forEach(giftName => {
            const effect = currentCommands[giftName];
            const code   = typeof effect === 'string' ? effect : effect.code;
            const gift   = availableGifts.find(g => g.name === giftName);

            const effectTd = $('<td class="command-cell"></td>');
            if (isSpawnCode(code)) {
                const badge = getSpawnBadge(code);
                const label = getSpawnLabel(code);
                effectTd.append($('<div style="display:flex;align-items:center;gap:8px;"></div>')
                    .append($(`<span style="font-size:9px;padding:1px 6px;border-radius:3px;background:${badge.color}33;color:${badge.color};font-weight:800;text-transform:uppercase;">${badge.label}</span>`))
                    .append($('<span></span>').text(label)));
            } else if (EFFECT_TO_UPGRADE_ITEM[code]) {
                // Direct-apply upgrade effect
                const upgradeItem = dbItems.find(i => i.id === EFFECT_TO_UPGRADE_ITEM[code]);
                const label = upgradeItem ? upgradeItem.name : code.replace('player_upgrade_', 'Upgrade ');
                effectTd.append($('<div style="display:flex;align-items:center;gap:8px;"></div>')
                    .append($(`<span style="font-size:9px;padding:1px 6px;border-radius:3px;background:#f39c1233;color:#f39c12;font-weight:800;text-transform:uppercase;">Upgrade</span>`))
                    .append($('<span></span>').text(label)));
            } else {
                const found = BASIC_EFFECTS.find(e => e.id === code);
                const color = found ? (EFFECT_CATEGORY_COLORS[found.category] || '#888') : '#888';
                effectTd.append($('<div style="display:flex;align-items:center;gap:8px;"></div>')
                    .append(found ? $(`<span style="font-size:9px;padding:1px 6px;border-radius:3px;background:${color}33;color:${color};font-weight:800;text-transform:uppercase;">${found.category}</span>`) : '')
                    .append($('<span></span>').text(found ? found.name : code)));
            }

            const row = $('<tr></tr>').append(
                makeGiftCell(giftName, gift), 
                effectTd,
                makeActionCell(giftName, { onTest: g => window.testRepoEffect(g), onEdit: g => openModal(g), onDelete: g => window.deleteRepoMapping(g) })
            );
            tbody.append(row);
        });
    }

    async function saveMapping(giftName, effect, action, oldGiftName, onSuccess) {
        // support old callers that pass onSuccess as 4th arg (delete flow)
        if (typeof oldGiftName === 'function') { onSuccess = oldGiftName; oldGiftName = null; }
        try {
            const r = await fetch('/api/repo/commands', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ giftName, effect, action, oldGiftName }) });
            const d = await r.json();
            if (d.success) {
                currentCommands = d.commands;
                renderTables();
                onSuccess && onSuccess();
                showToast(action === 'delete' ? 'Mapping removed' : 'Mapping saved!', 'success');
            } else showToast(d.error || 'Failed to save', 'error');
        } catch (e) { showToast('Connection error: ' + e.message, 'error'); }
    }

    window.testRepoEffect = (g) => {
        fetch('/api/repo/test', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ giftName: g }) })
            .then(r => r.json()).then(res => showToast(res.success ? 'Sent!' : res.error, res.success ? 'success' : 'error'));
    };
    window.deleteRepoMapping = (g) => {
        showConfirm({ title: 'Delete?', message: `Remove mapping for ${g}?` }).then(ok => { if (ok) saveMapping(g, null, 'delete'); });
    };

    async function loadAllData() {
        try {
            const [cmdsRes, giftsRes, valuablesRes, itemsRes, enemiesRes, imgsRes] = await Promise.all([
                fetch('/api/repo/commands').then(r => r.json()),
                fetch('/api/gifts').then(r => r.json()),
                fetch('/api/repo/valuables').then(r => r.json()),
                fetch('/api/repo/items').then(r => r.json()),
                fetch('/api/repo/enemies').then(r => r.json()),
                fetch('/api/repo/images').then(r => r.json()),
            ]);
            currentCommands = cmdsRes.commands || {};
            availableGifts  = giftsRes.gifts || [];
            dbValuables = valuablesRes.valuables || [];
            dbItems     = itemsRes.items || [];
            dbEnemies   = enemiesRes.enemies || [];
            images      = imgsRes;

            giftDropdown.updateGifts(availableGifts);
            buildEffectCategoryTabs();
            renderEffectCards(null);
            renderTables();
            $('#repoModeSpawnBtn').trigger('click');
            updateCategoryFilter();
        } catch (e) { console.error('[Repo] Load Error', e); }
    }

    loadAllData();
}
