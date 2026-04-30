import { showToast, showConfirm } from './dialog.js';
import { GiftDropdown } from './components/GiftDropdown.js';
import { makeGiftCell, makeActionCell } from './components/GiftActionButtons.js';

const QUALITY_COLORS = ['#888', '#a3e4a3', '#5bb8ff', '#c084fc', '#fbbf24'];
const CATEGORY_COLORS = {
    'Chaos':      '#e05252',
    'Curses':     '#9b59b6',
    'Punishment': '#e07c2a',
    'Timed':      '#3498db',
    'Buff':       '#27ae60',
    'Glitch':     '#00d2d3',
    'Other':      '#888888',
};

let socket           = null;
let availableGifts   = [];
let profiles         = [];
let currentCommands  = {};
let isaacItems       = [];
let isaacBosses      = [];
let giftDropdown     = null;
let serverActive     = false;
let isConnected      = false;

export function initIsaacUI(ioConnection) {
    if (ioConnection) socket = ioConnection.socket;

    const tableBody       = $('#isaacEffectsTableBody');
    const modal           = $('#isaacEffectModal');
    const addBtn          = $('#addIsaacEffectBtn');
    const sidebarDot      = $('#isaacStatusDot');
    const statusTextLarge = $('#isaacStatusTextLarge');
    const sidebarStatusDot = $('#isaacSidebarStatusDot');
    const connectBtn      = $('#isaacConnectBtn');

    giftDropdown = new GiftDropdown({
        inputId:   'isaacGiftInput',
        resultsId: 'isaacGiftResults',
        previewId: 'isaacGiftImagePreview',
    });

    const itemSearchInput = $('#isaacItemSearchInput');
    const itemSearchResults = $('#isaacItemSearchResults');
    const itemSelectedId = $('#isaacSelectedItemId');
    const itemPreview = $('#isaacItemPreview');
    const itemNameLabel = $('#isaacItemNameLabel');
    const itemQualityBadge = $('#isaacItemQualityBadge');

    itemSearchInput.on('input focus', function() {
        const query = $(this).val();
        updateItemSuggestions(query);
    });

    const bossSearchInput = $('#isaacBossSearchInput');
    const bossSearchResults = $('#isaacBossSearchResults');
    const bossSelectedId = $('#isaacSelectedBossId');
    const bossPreview = $('#isaacBossPreview');
    const bossNameLabel = $('#isaacBossNameLabel');

    bossSearchInput.on('input focus', function() {
        const query = $(this).val();
        updateBossSuggestions(query);
    });

    function populateFilters(meta) {
        const typeSelect = $('#isaacFilterType');
        const poolSelect = $('#isaacFilterPool');
        
        typeSelect.find('option:not(:first)').remove();
        poolSelect.find('option:not(:first)').remove();
        
        if (meta.types) {
            meta.types.forEach(t => typeSelect.append(`<option value="${t}">${t}</option>`));
        }
        if (meta.pools) {
            meta.pools.forEach(p => poolSelect.append(`<option value="${p}">${p}</option>`));
        }
    }

    function updateItemSuggestions(query = '') {
        const results = $('#isaacItemSearchResults');
        results.empty();

        const qualityFilter = $('#isaacFilterQuality').val();
        const typeFilter = $('#isaacFilterType').val();
        const poolFilter = $('#isaacFilterPool').val();

        const filtered = isaacItems.filter(item => {
            const matchesQuery = item.name.toLowerCase().includes(query.toLowerCase());
            const matchesQuality = !qualityFilter || item.quality === parseInt(qualityFilter);
            const matchesType = !typeFilter || (item.type && item.type.includes(typeFilter));
            const matchesPool = !poolFilter || (item.pool && item.pool.includes(poolFilter));
            
            return matchesQuery && matchesQuality && matchesType && matchesPool;
        });

        // Add Random Item at the top if it matches the query
        if (!query || 'random item'.includes(query.toLowerCase())) {
            const randomItem = { id: -1, name: 'Random Item', quality: 0, description: 'Spawns a random collectible item' };
            results.append(createItemElement(randomItem));
        }

        filtered.slice(0, 50).forEach(it => {
            results.append(createItemElement(it));
        });
        
        if (results.children().length === 0) { results.hide(); return; }
        results.show();
    }

    function createItemElement(it) {
        const s = getItemSprite(it.id);
        const iconHtml = s
            ? `<div class="isaac-sprite" style="background-position:${s.x}px ${s.y}px;"></div>`
            : `<span style="font-size:9px;color:var(--dim);">?</span>`;

        const item = $(`
            <div class="isaac-item-result">
                <div class="isaac-item-icon">${iconHtml}</div>
                <div class="item-info">
                    <div class="item-name">${it.name}</div>
                    <div class="item-meta">
                        ${it.pool ? `<span class="pool-tag">${it.pool}</span>` : ''}
                        ${it.type ? `<span class="type-tag">${it.type}</span>` : ''}
                    </div>
                </div>
                <div class="item-quality" style="border-left: 3px solid ${QUALITY_COLORS[it.quality] || '#888'};">Q${it.quality}</div>
            </div>
        `);
        item.on('click', () => {
            selectItem(it);
            itemSearchResults.hide();
        });
        return item;
    }

    function selectItem(it) {
        itemSelectedId.val(it.id);
        itemSearchInput.val(it.name);
        itemNameLabel.text(it.name).show();

        const s = getItemSprite(it.id);
        if (s) {
            itemPreview.html(`<div class="isaac-sprite" style="background-position:${s.x}px ${s.y}px; filter:drop-shadow(0 0 6px var(--accent-glow));"></div>`);
        } else {
            itemPreview.html(`<span style="font-size:9px;color:var(--dim);">?</span>`);
        }
        itemQualityBadge.text(`Quality ${it.quality}`).css('background', QUALITY_COLORS[it.quality] || '#888').show();

        const isActive = it.type && it.type.toLowerCase().includes('active');
        if (isActive) {
            $('#isaacUseEffectRow').show();
        } else {
            $('#isaacUseEffectRow').hide();
            $('#isaacUseEffectOnly').prop('checked', false);
        }
        updateSpawnOptionsVisibility();
    }

    function updateBossSuggestions(query = '') {
        bossSearchResults.empty();
        const filtered = isaacBosses.filter(b => b.name.toLowerCase().includes(query.toLowerCase()));
        
        filtered.slice(0, 30).forEach(b => {
            const img = getBossImage(b.name);
            const bossEl = $(`
                <div class="isaac-item-result">
                    <div class="isaac-item-icon">
                        <img src="${img}" style="width:32px;height:32px;object-fit:contain;" onerror="this.src='/images/Isaac/boss.png'">
                    </div>
                    <div class="item-info">
                        <div class="item-name">${b.name}</div>
                        <div class="item-meta">
                            <span class="type-tag">ID: ${b.id}</span>
                        </div>
                    </div>
                    <div class="item-quality" style="border-left:3px solid var(--accent);font-size:0.6rem;">BOSS</div>
                </div>
            `);
            bossEl.on('click', () => {
                selectBoss(b);
                bossSearchResults.hide();
            });
            bossSearchResults.append(bossEl);
        });

        if (bossSearchResults.children().length === 0) { bossSearchResults.hide(); return; }
        bossSearchResults.show();
    }

    function selectBoss(b) {
        bossSelectedId.val(b.id);
        bossSearchInput.val(b.name);
        bossNameLabel.text(b.name).show();
        
        const img = getBossImage(b.name);
        bossPreview.html(`<img src="${img}" style="width:100%;height:100%;object-fit:contain;filter:drop-shadow(0 0 6px var(--accent-glow));" onerror="this.src='/images/Isaac/boss.png'">`);
        
        $('#isaacBossBaseHp').text(b.base_hp || '???');
        $('#isaacBossHpInfo').show();
    }

    function getBossImage(name) {
        if (!name) return null;
        let cleanName = name.replace(' (Boss)', '');
        
        // Handle special character encoding for URLs (especially for ???)
        cleanName = cleanName.replace(/\?/g, '%3F');
        cleanName = cleanName.replace(/'/g, '%27');
        cleanName = cleanName.replace(/ /g, '_');

        // Suffix mapping
        let suffix = '_portrait.webp';
        
        const ingameBosses = ["Ultra_Death", "Ultra_Famine", "Ultra_Pestilence", "Ultra_War", "The_Beast", "Ultra_Greedier"];
        if (ingameBosses.includes(cleanName)) {
            suffix = '_ingame.webp';
        }

        // Special cases for filenames with extra suffixes
        if (cleanName === "Lil_Blub" || cleanName === "Wormwood") {
            cleanName += "_29";
        }

        return `/images/Isaac/Bosses/Boss_${cleanName}${suffix}`;
    }

    function updateSpawnOptionsVisibility() {
        const useEffectOnly = $('#isaacUseEffectOnly').is(':checked');
        $('#isaacItemSpawnOptions').toggle(!useEffectOnly);
    }

    $(document).on('click', (e) => {
        if (!$(e.target).closest('#isaacItemSearchWrapper, #isaacItemSearchResults').length) {
            itemSearchResults.hide();
        }
        if (!$(e.target).closest('#isaacBossSearchWrapper, #isaacBossSearchResults').length) {
            bossSearchResults.hide();
        }
    });

    // ── UI Actions ────────────────────────────────────────────────────────────
    $('#isaacSetupBtn').off('click').on('click', () => $('#isaacSetupModal').css('display', 'flex'));
    $('#closeIsaacSetupBtn, #gotItBtn').off('click').on('click', () => $('#isaacSetupModal').hide());
    addBtn.off('click').on('click', () => openModal());

    $('#isaacModeCustomBtn').off('click').on('click', () => {
        $('#isaacModeCustomBtn').addClass('active');
        $('#isaacModeProfileBtn').removeClass('active');
        $('#isaacCustomActionView').show();
        $('#isaacProfileView').hide();
    });

    $('#isaacModeProfileBtn').off('click').on('click', () => {
        $('#isaacModeProfileBtn').addClass('active');
        $('#isaacModeCustomBtn').removeClass('active');
        $('#isaacProfileView').show();
        $('#isaacCustomActionView').hide();
        renderProfileCards(window.selectedIsaacProfile || null);
    });

    $('#isaacUseEffectOnly').off('change').on('change', updateSpawnOptionsVisibility);

    $('.isaac-action-tab').off('click').on('click', function () {
        $('.isaac-action-tab').removeClass('active');
        $(this).addClass('active');
        $('.isaac-action-fields').hide();
        $(`#fields_${$(this).data('action')}`).show();
    });

    connectBtn.off('click').on('click', () => {
        socket.emit(!serverActive ? 'isaacStart' : 'isaacStop');
    });

    $('#saveIsaacEffectBtn').off('click').on('click', saveCurrentMapping);
    $('#cancelIsaacModalBtn, #closeIsaacModalBtn').off('click').on('click', () => { modal.hide(); resetModal(); });

    // ── Status Engine ──────────────────────────────────────────────────────────
    function updateUI(connected, active) {
        isConnected = !!connected;
        serverActive = !!active;

        const bridgeCard = $('#isaacBridgeCard');
        const statusIndicator = $('#isaacStatusIndicator');
        const btnText = $('#isaacBtnText');
        const btnIcon = $('#isaacBtnIcon');

        // Update Button
        btnText.text(serverActive ? 'Stop Bridge' : 'Start Bridge');
        connectBtn.removeClass('btn-primary btn-secondary').addClass(serverActive ? 'btn-secondary' : 'btn-primary');
        
        btnIcon.html(serverActive 
            ? `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><rect x="6" y="6" width="12" height="12"></rect></svg>`
            : `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>`
        );

        if (!serverActive) {
            statusTextLarge.text('Offline').css('color', 'var(--dim)');
            statusIndicator.css({
                'background': 'var(--danger)',
                'box-shadow': '0 0 12px var(--danger)'
            });
            bridgeCard.css('border-left-color', 'var(--danger)');
        } else {
            const statusColor = isConnected ? 'var(--success)' : 'var(--warning)';
            statusTextLarge.text(isConnected ? 'Connected' : 'Listening...').css('color', statusColor);
            statusIndicator.css({
                'background': statusColor,
                'box-shadow': `0 0 12px ${statusColor}`
            });
            bridgeCard.css('border-left-color', statusColor);
        }

        sidebarDot.toggle(isConnected).css('background', 'var(--success)');
    }

    if (socket) {
        socket.on('isaacStatus', data => updateUI(data.isConnected, data.serverActive));
        socket.on('isaacProfiles', data => { profiles = data; renderTable(); });
    }

    // ── Data & Rendering ───────────────────────────────────────────────────────
    async function loadAllData() {
        try {
            const [itemsRes, bossesRes, cmdsRes, giftsRes, profsRes, metaRes] = await Promise.all([
                fetch('/api/isaac/items').then(r => r.json()),
                fetch('/api/isaac/bosses').then(r => r.json()),
                fetch('/api/isaac/commands').then(r => r.json()),
                fetch('/api/gifts').then(r => r.json()),
                fetch('/api/isaac/profiles').then(r => r.json()),
                fetch('/api/isaac/metadata').then(r => r.json())
            ]);

            isaacItems = itemsRes;
            isaacBosses = bossesRes;
            populateFilters(metaRes);
            currentCommands = cmdsRes.commands || {};
            availableGifts = giftsRes.gifts || [];
            profiles = profsRes.profiles || [];

            giftDropdown.updateGifts(availableGifts);
            renderTable();
        } catch (e) { console.error('[Isaac] Load Error', e); }
    }

    function getItemSprite(id) {
        id = parseInt(id);
        if (id === -1) {
            // Random Item icon (the one after Mom's Ring)
            const momsRingIdx = isaacItems.findIndex(it => it.id === 732);
            let gIdx = (momsRingIdx !== -1 ? momsRingIdx : 731) + 1;
            // Offsets for ID 733 (next one)
            gIdx++; // for id >= 475
            gIdx++; // for id >= 649
            if (gIdx >= 548) gIdx += 12;
            return { x: -( (gIdx % 20) * 44), y: -(Math.floor(gIdx / 20) * 44) };
        }
        const idx = isaacItems.findIndex(it => it.id === id);
        if (idx === -1) return null;
        let gIdx = idx;
        if (id >= 475) gIdx++; if (id >= 649) gIdx++; if (gIdx >= 548) gIdx += 12;
        return { x: -( (gIdx % 20) * 44), y: -(Math.floor(gIdx / 20) * 44) };
    }

    const ISAAC_DEFAULT_PROFILES = [
        { id: 'boss_rush', name: 'Boss Rush' },
        { id: 'total_chaos', name: 'Total Chaos' },
        { id: 'mob_rush', name: 'Mob Rush' },
        { id: 'all_curses', name: 'All Curses' },
        { id: 'curse_roulette', name: 'Curse Roulette' },
        { id: 'near_death', name: 'Near Death' },
        { id: 'item_yoink', name: 'Item Yoink' },
        { id: 'nightmare', name: 'Nightmare' },
        { id: 'upside_down', name: 'Upside Down' },
        { id: 'speed_demon', name: 'Speed Demon' },
        { id: 'god_mode', name: 'God Mode' },
        { id: 'full_heal', name: 'Full Heal' },
        { id: 'devil_deal', name: 'Free Devil Deal' },
        { id: 'supply_drop', name: 'Supply Drop' },
        { id: 'jackpot', name: 'Jackpot' },
        { id: 'sacrifice', name: 'Sacrifice' },
        { id: 'chaos_reroll', name: 'Chaos Reroll' },
        { id: 'cursed_blessing', name: 'Cursed Blessing' },
        { id: 'worm_trio', name: 'Worm Trio' },
        { id: 'trapdoor', name: 'Trapdoor' },
        { id: 'item_drain', name: 'Item Drain' },
        { id: 'health_scare', name: 'Health Scare' },
        { id: 'absolute_trade', name: 'The Trade' },
        { id: 'retro_vision', name: 'Retro Vision' },
        { id: 'glitch_storm', name: 'Glitch Storm' }
    ];

    function getEffectName(id) {
        if (!id) return 'Unknown';
        const p = profiles.find(x => x.id === id) || ISAAC_DEFAULT_PROFILES.find(x => x.id === id);
        return p ? p.name : id;
    }

    function renderTable() {
        tableBody.empty();
        const keys = Object.keys(currentCommands);
        if (!keys.length) return tableBody.append('<tr><td colspan="3" style="text-align:center;padding:30px;color:var(--dim);">No effects mapped.</td></tr>');

        keys.forEach(giftName => {
            const effect = currentCommands[giftName];
            const gift = availableGifts.find(g => g.name === giftName);

            let title = '', icon = null;
            if (typeof effect === 'string') {
                title = getEffectName(effect);
            } else if (effect && effect.type === 'activate') {
                title = getEffectName(effect.profileId);
            } else if (effect && effect.profileId) {
                title = getEffectName(effect.profileId);
            } else if (effect && (effect.action === 'spawn_item' || effect.action === 'use_item')) {
                const iname = effect.itemId === -1 ? 'Random Item' : (isaacItems.find(x => x.id === effect.itemId)?.name || `Item #${effect.itemId}`);
                title = effect.action === 'use_item' ? `⚡ ${iname}` : iname;
                const s = getItemSprite(effect.itemId);
                if (s) icon = $(`<div class="isaac-sprite" style="background-position:${s.x}px ${s.y}px;transform:scale(0.5);margin:-12px;"></div>`);
            } else if (effect && effect.action === 'spawn_boss') {
                const boss = isaacBosses.find(b => b.id === String(effect.bossId));
                title = boss ? boss.name : `Boss ID: ${effect.bossId}`;
                const img = getBossImage(title);
                icon = $(`<img src="${img}" style="width:24px;height:24px;object-fit:contain;" onerror="this.src='/images/Isaac/boss.png'">`);
            } else if (effect && effect.action === 'spawn_entity') {
                title = `Summon ID: ${effect.entityId || ''}`;
            } else {
                title = JSON.stringify(effect);
            }

            const effectTd = $('<td class="command-cell"></td>');
            const effectInner = $('<div style="display:flex;align-items:center;gap:8px;"></div>');
            if (icon) effectInner.append(icon);
            effectInner.append($('<span></span>').text(title));
            effectTd.append(effectInner);

            const row = $('<tr></tr>');
            row.append(
                makeGiftCell(giftName, gift),
                effectTd,
                makeActionCell(giftName, {
                    onTest:   (g) => window.testIsaac(g),
                    onEdit:   (g) => openModal(g),
                    onDelete: (g) => window.deleteIsaacMapping(g)
                })
            );
            tableBody.append(row);
        });
    }

    function resetModal() {
        $('#isaacModeCustomBtn').addClass('active');
        $('#isaacModeProfileBtn').removeClass('active');
        $('#isaacCustomActionView').show();
        $('#isaacProfileView').hide();
        $('.isaac-action-tab').removeClass('active').first().addClass('active');
        $('.isaac-action-fields').hide();
        $('#fields_spawn_item').show();
        itemSelectedId.val('');
        itemSearchInput.val('');
        
        $('#isaacFilterQuality, #isaacFilterType, #isaacFilterPool').on('change', () => {
            updateItemSuggestions($('#isaacItemSearchInput').val());
            $('#isaacItemSearchResults').show();
        });

        $('#isaacItemAutoCollect').prop('checked', false);
        $('#isaacUseEffectOnly').prop('checked', false);
        $('#isaacUseEffectRow').hide();
        $('#isaacItemSpawnOptions').show();
        $('#isaacWaitStreak').prop('checked', true);
        $('#isaacEntityIdInput').val('');
        $('#isaacEntityAmountInput').val(1);
        itemPreview.html('<span style="font-size:9px;color:var(--text-muted);">ITEM</span>');
        itemNameLabel.hide();
        itemQualityBadge.hide();

        bossSelectedId.val('');
        bossSearchInput.val('');
        bossPreview.html('<span style="font-size:9px;color:var(--text-muted);">BOSS</span>');
        bossNameLabel.hide();
        $('#isaacBossHpInfo').hide();
        $('#isaacBossAmountInput').val(1);

        window.selectedIsaacProfile = null;
    }

    function openModal(editGiftName) {
        resetModal();
        if (editGiftName) {
            giftDropdown.setValue(editGiftName);
            $('#isaacModalTitle').text('Edit TBOI Effect');
            const effect = currentCommands[editGiftName];
            if (typeof effect === 'string') {
                $('#isaacModeProfileBtn').trigger('click');
                renderProfileCards(effect);
                window.selectedIsaacProfile = effect;
            } else if (effect && (effect.action === 'spawn_item' || effect.action === 'use_item')) {
                const it = effect.itemId === -1
                    ? { id: -1, name: 'Random Item', quality: 0, description: 'Spawns a random collectible item' }
                    : isaacItems.find(x => x.id === effect.itemId);
                if (it) selectItem(it);
                if (effect.action === 'use_item') {
                    $('#isaacUseEffectOnly').prop('checked', true);
                    updateSpawnOptionsVisibility();
                } else {
                    $('#isaacItemAmountInput').val(effect.amount || 1);
                    $('#isaacItemAutoCollect').prop('checked', !!effect.autoCollect);
                }
            } else if (effect && effect.action === 'spawn_entity') {
                $('.isaac-action-tab[data-action="spawn_entity"]').trigger('click');
                $('#isaacEntityIdInput').val(effect.entityId || '');
                $('#isaacEntityAmountInput').val(effect.amount || 1);
            } else if (effect && effect.action === 'spawn_boss') {
                $('.isaac-action-tab[data-action="spawn_boss"]').trigger('click');
                const b = isaacBosses.find(x => x.id === String(effect.bossId));
                if (b) selectBoss(b);
                $('#isaacBossAmountInput').val(effect.amount || 1);
            }
            
            if (effect && typeof effect === 'object') {
                $('#isaacWaitStreak').prop('checked', effect.waitForStreak !== false);
            }
        } else {
            giftDropdown.setValue('');
            $('#isaacModalTitle').text('Add TBOI Effect');
            renderProfileCards(null);
        }
        modal.css('display', 'flex');
    }

    function renderProfileCards(selId) {
        const cards = $('#isaacEffectCards').empty();

        const byCategory = {};
        profiles.forEach(p => {
            const cat = p.category || 'Other';
            if (!byCategory[cat]) byCategory[cat] = [];
            byCategory[cat].push(p);
        });

        const catOrder = ['Chaos', 'Curses', 'Punishment', 'Timed', 'Buff', 'Glitch', 'Other'];
        catOrder.forEach(cat => {
            if (!byCategory[cat]) return;
            const catColor = CATEGORY_COLORS[cat] || '#888';
            const section = $(`<div style="grid-column:1/-1;margin-top:4px;"></div>`);
            section.append(`<div style="font-size:10px;font-weight:800;letter-spacing:1.2px;text-transform:uppercase;color:${catColor};margin-bottom:6px;padding-left:2px;">${cat}</div>`);
            const grid = $(`<div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;"></div>`);
            byCategory[cat].forEach(p => {
                const isSelected = p.id === selId;
                const card = $(`
                    <div class="isaac-effect-card ${isSelected ? 'selected' : ''}"
                         style="padding:9px 11px;border:1px solid ${isSelected ? catColor : 'var(--border)'};border-radius:8px;cursor:pointer;background:${isSelected ? catColor + '22' : 'var(--bg3)'};transition:border-color .15s,background .15s;">
                        <div style="font-weight:700;font-size:.82rem;color:var(--text);margin-bottom:2px;">${p.name}</div>
                        ${p.desc ? `<div style="font-size:.72rem;color:var(--text-muted);line-height:1.4;">${p.desc}</div>` : ''}
                    </div>
                `);
                card.on('click', () => { renderProfileCards(p.id); window.selectedIsaacProfile = p.id; });
                grid.append(card);
            });
            section.append(grid);
            cards.append(section);
        });

        if (!profiles.length) {
            cards.append(`<div style="grid-column:1/-1;text-align:center;padding:20px;color:var(--dim);font-size:.85rem;">No profiles received yet. Start the bridge and open a run.</div>`);
        }
    }

    function saveCurrentMapping() {
        const giftName = giftDropdown.getValue();
        let payload = null;
        let isProfileMode = $('#isaacModeProfileBtn').hasClass('active');

        if (isProfileMode) {
            if (window.selectedIsaacProfile) {
                payload = {
                    type: 'activate',
                    profileId: window.selectedIsaacProfile,
                    waitForStreak: $('#isaacWaitStreak').is(':checked')
                };
            }
        } else {
            const action = $('.isaac-action-tab.active').data('action') || 'spawn_item';
            const waitForStreak = $('#isaacWaitStreak').is(':checked');
            
            if (action === 'spawn_item') {
                const itemId = parseInt($('#isaacSelectedItemId').val());
                if (itemId || itemId === -1) {
                    const useEffectOnly = $('#isaacUseEffectOnly').is(':checked');
                    if (useEffectOnly) {
                        payload = {
                            type: 'custom_action',
                            action: 'use_item',
                            itemId,
                            waitForStreak
                        };
                    } else {
                        payload = {
                            type: 'custom_action',
                            action: 'spawn_item',
                            itemId,
                            amount: parseInt($('#isaacItemAmountInput').val()) || 1,
                            autoCollect: $('#isaacItemAutoCollect').is(':checked'),
                            waitForStreak
                        };
                    }
                }
            } else if (action === 'spawn_boss') {
                const bossId = $('#isaacSelectedBossId').val();
                if (bossId) {
                    payload = {
                        type: 'custom_action',
                        action: 'spawn_boss',
                        bossId,
                        amount: parseInt($('#isaacBossAmountInput').val()) || 1,
                        waitForStreak
                    };
                }
            } else if (action === 'spawn_entity') {
                const entityId = $('#isaacEntityIdInput').val().trim();
                if (entityId) {
                    payload = { 
                        type: 'custom_action', 
                        action: 'spawn_entity', 
                        entityId, 
                        amount: parseInt($('#isaacEntityAmountInput').val()) || 1,
                        waitForStreak
                    };
                }
            }
        }

        // Validation
        if (!giftName) {
            showToast('You must choose a gift!', 'warning');
            return;
        }
        if (!payload) {
            showToast(isProfileMode ? 'You must choose an effect from the list!' : 'You must complete the action details!', 'warning');
            return;
        }

        // Check for duplicates (if not editing the same gift)
        const isEdit = $('#isaacModalTitle').text().includes('Edit');
        if (!isEdit && currentCommands[giftName]) {
            showToast(`The gift "${giftName}" already has an effect set! Delete the old one first.`, 'error');
            return;
        }

        saveMapping(giftName, payload, 'save');
    }

    async function saveMapping(giftName, effectId, action) {
        try {
            const r = await fetch('/api/isaac/commands', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ giftName, effectId, action })
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

    window.testIsaac = (g) => {
        fetch('/api/isaac/test', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ giftName: g }) })
        .then(r => r.json()).then(res => showToast(res.success ? 'Sent!' : res.error, res.success ? 'success' : 'error'));
    };

    window.deleteIsaacMapping = (g) => {
        showConfirm({ title: 'Delete?', message: `Remove ${g}?` }).then(ok => { if(ok) saveMapping(g, null, 'delete'); });
    };

    loadAllData();
}
