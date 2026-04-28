import { showToast, showConfirm } from './dialog.js';
import { GiftDropdown } from './components/GiftDropdown.js';

const QUALITY_COLORS = ['#888', '#a3e4a3', '#5bb8ff', '#c084fc', '#fbbf24'];
const CATEGORY_COLORS = {
    'Chaos':      '#e05252',
    'Curses':     '#9b59b6',
    'Punishment': '#e07c2a',
    'Timed':      '#3498db',
    'Boon':       '#27ae60',
    'Other':      '#888888',
};

let socket           = null;
let availableGifts   = [];
let profiles         = [];
let currentCommands  = {};
let isaacItems       = [];
let giftDropdown     = null;
let serverActive     = false;
let isConnected      = false;

export function initIsaacUI(ioConnection) {
    if (ioConnection) socket = ioConnection.socket;

    const tableBody       = $('#isaacEffectsTableBody');
    const modal           = $('#isaacEffectModal');
    const addBtn          = $('#addIsaacEffectBtn');
    const statusText      = $('#isaacStatusText');
    const statusBadgeDot  = $('#isaacStatusBadgeDot');
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
        const query = $(this).val().toLowerCase();
        renderItemSuggestions(query);
    });

    function renderItemSuggestions(query) {
        itemSearchResults.empty();
        const filtered = isaacItems.filter(it => it.name.toLowerCase().includes(query)).slice(0, 50);
        if (filtered.length === 0) { itemSearchResults.hide(); return; }

        filtered.forEach(it => {
            const sprite = getItemSprite(it.id);
            const item = $(`
                <div class="isaac-item-result" style="display:flex;align-items:center;gap:10px;padding:8px 12px;cursor:pointer;border-bottom:1px solid var(--border-light);">
                    <div class="isaac-sprite" style="background-position:${sprite.x}px ${sprite.y}px;transform:scale(0.5);margin:-10px;"></div>
                    <div style="flex:1;">
                        <div style="font-weight:600;font-size:0.9rem;">${it.name}</div>
                        <div style="font-size:0.7rem;color:var(--text-muted);">${it.description || ''}</div>
                    </div>
                    <div style="background:${QUALITY_COLORS[it.quality] || '#888'};color:white;padding:1px 6px;border-radius:4px;font-size:0.7rem;font-weight:800;">Q${it.quality}</div>
                </div>
            `);
            item.on('click', () => {
                selectItem(it);
                itemSearchResults.hide();
            });
            itemSearchResults.append(item);
        });
        itemSearchResults.show();
    }

    function selectItem(it) {
        itemSelectedId.val(it.id);
        itemSearchInput.val(it.name);
        itemNameLabel.text(it.name).show();
        const sprite = getItemSprite(it.id);
        itemPreview.html(`<div class="isaac-sprite" style="background-position:${sprite.x}px ${sprite.y}px;transform:scale(0.9);"></div>`);
        itemQualityBadge.text(`Quality ${it.quality}`).css('background', QUALITY_COLORS[it.quality] || '#888').show();
    }

    $(document).on('click', (e) => {
        if (!$(e.target).closest('#isaacItemSearchWrapper, #isaacItemSearchResults').length) {
            itemSearchResults.hide();
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

        connectBtn.text(serverActive ? 'Stop Bridge' : 'Start Bridge');
        connectBtn.removeClass('btn-primary btn-secondary').addClass(serverActive ? 'btn-secondary' : 'btn-primary');

        if (!serverActive) {
            statusTextLarge.text('Server Stopped').css('color', 'var(--danger)');
            sidebarStatusDot.hide();
        } else {
            statusTextLarge.text(isConnected ? 'Connected' : 'Listening...').css('color', isConnected ? 'var(--success)' : 'var(--warning)');
            sidebarStatusDot.toggle(isConnected).css('background', 'var(--success)');
        }

        sidebarDot.toggle(isConnected);
        statusBadgeDot.css('background', isConnected ? '#27ae60' : '#444');
        statusText.text(isConnected ? 'TBOI mod connected' : (serverActive ? 'Listening...' : 'Bridge stopped'));
    }

    if (socket) {
        socket.on('isaacStatus', data => updateUI(data.isConnected, data.serverActive));
        socket.on('isaacProfiles', data => { profiles = data; renderTable(); });
    }

    // ── Data & Rendering ───────────────────────────────────────────────────────
    async function loadAllData() {
        try {
            const [itemsRes, cmdsRes, giftsRes, profsRes] = await Promise.all([
                fetch('/data/isaac-items.json').then(r => r.json()),
                fetch('/api/isaac/commands').then(r => r.json()),
                fetch('/api/gifts').then(r => r.json()),
                fetch('/api/isaac/profiles').then(r => r.json())
            ]);

            isaacItems = itemsRes;
            currentCommands = cmdsRes.commands || {};
            availableGifts = giftsRes.gifts || [];
            profiles = profsRes.profiles || [];

            giftDropdown.updateGifts(availableGifts);
            renderTable();
        } catch (e) { console.error('[Isaac] Load Error', e); }
    }

    function getItemSprite(id) {
        const idx = isaacItems.findIndex(it => it.id === parseInt(id));
        if (idx === -1) return null;
        let gIdx = idx;
        if (id >= 475) gIdx++; if (id >= 649) gIdx++; if (gIdx >= 548) gIdx += 12;
        return { x: -( (gIdx % 20) * 44), y: -(Math.floor(gIdx / 20) * 44) };
    }

    function renderTable() {
        tableBody.empty();
        const keys = Object.keys(currentCommands);
        if (!keys.length) return tableBody.append('<tr><td colspan="3" style="text-align:center;padding:30px;color:var(--dim);">No effects mapped.</td></tr>');

        keys.forEach(giftName => {
            const effect = currentCommands[giftName];
            const gift = availableGifts.find(g => g.name === giftName);
            const isProfile = typeof effect === 'string';

            let title = '', icon = '';
            if (isProfile) {
                const p = profiles.find(x => x.id === effect) || { name: effect };
                title = p.name;
            } else if (effect && effect.action === 'spawn_item') {
                const it = isaacItems.find(x => x.id === effect.itemId);
                title = it ? it.name : `Item #${effect.itemId}`;
                const s = it ? getItemSprite(it.id) : null;
                if (s) icon = `<div class="isaac-sprite" style="background-position:${s.x}px ${s.y}px;transform:scale(0.5);margin:-12px;"></div>`;
            } else if (effect && effect.action === 'spawn_entity') {
                title = `Spawn Entity ${effect.entityId || ''}`;
            } else if (effect && effect.action === 'set_health') {
                title = `Set Health: ${effect.hearts || '?'} hearts`;
            } else {
                title = JSON.stringify(effect);
            }

            const row = $(`
                <tr>
                    <td><div style="display:flex;align-items:center;gap:10px;">
                        <img src="${gift?.image?.url_list?.[0] || ''}" style="width:24px;height:24px;border-radius:4px;background:var(--bg3);">
                        <b>${giftName}</b>
                    </div></td>
                    <td><div style="display:flex;align-items:center;gap:8px;">${icon}<span>${title}</span></div></td>
                    <td style="text-align:center;"><div style="display:flex;gap:5px;justify-content:center;">
                        <button class="btn-primary btn-sm btn-isaac-test" data-gift="${giftName}">
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>
                            Test
                        </button>
                        <button class="btn-secondary btn-sm btn-isaac-edit" data-gift="${giftName}">
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                            Edit
                        </button>
                        <button class="btn-danger btn-sm btn-isaac-delete" data-gift="${giftName}">
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"></path></svg>
                            Delete
                        </button>
                    </div></td>
                </tr>
            `);
            tableBody.append(row);
        });

        $('.btn-isaac-test').off().click(function () {
            window.testIsaac($(this).data('gift'));
        });
        $('.btn-isaac-edit').off().click(function () {
            openModal($(this).data('gift'));
        });
        $('.btn-isaac-delete').off().click(function () {
            window.deleteIsaacMapping($(this).data('gift'));
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
        itemPreview.html('<span style="font-size:9px;color:var(--text-muted);">ITEM</span>');
        itemNameLabel.hide();
        itemQualityBadge.hide();
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
            } else if (effect && effect.action === 'spawn_item') {
                const it = isaacItems.find(x => x.id === effect.itemId);
                if (it) selectItem(it);
                $('#isaacItemAmountInput').val(effect.amount || 1);
            } else if (effect && effect.action === 'spawn_entity') {
                $('.isaac-action-tab[data-action="spawn_entity"]').trigger('click');
                $('#isaacEntityIdInput').val(effect.entityId || '');
                $('#isaacEntityAmountInput').val(effect.amount || 1);
            } else if (effect && effect.action === 'set_health') {
                $('.isaac-action-tab[data-action="set_health"]').trigger('click');
                $('#isaacHealthInput').val(effect.hearts || '');
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

        const catOrder = ['Chaos', 'Curses', 'Punishment', 'Timed', 'Boon', 'Other'];
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
            payload = window.selectedIsaacProfile;
        } else {
            const action = $('.isaac-action-tab.active').data('action') || 'spawn_item';
            if (action === 'spawn_item') {
                const itemId = parseInt($('#isaacSelectedItemId').val());
                if (itemId) {
                    payload = { action: 'spawn_item', itemId, amount: parseInt($('#isaacItemAmountInput').val()) || 1 };
                }
            } else if (action === 'spawn_entity') {
                const entityId = $('#isaacEntityIdInput').val().trim();
                if (entityId) {
                    payload = { action: 'spawn_entity', entityId, amount: parseInt($('#isaacEntityAmountInput').val()) || 1 };
                }
            } else if (action === 'set_health') {
                payload = { action: 'set_health', hearts: parseInt($('#isaacHealthInput').val()) || 6 };
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
