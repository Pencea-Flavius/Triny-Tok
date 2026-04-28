import { showToast, showConfirm } from './dialog.js';
import { GiftDropdown } from './components/GiftDropdown.js';

const CATEGORY_COLORS = {
    'Chaos':      '#e05252',
    'Curses':     '#9b59b6',
    'Punishment': '#e07c2a',
    'Timed':      '#3498db',
    'Boon':       '#27ae60',
};

let socket = null;
let availableGifts = [];
let availableEffects = {};
let currentCommands = {};
let selectedEffectId = null;
let editingGiftName = null;

export function initIsaacUI(ioConnection) {
    if (ioConnection) socket = ioConnection.socket;

    const tableBody      = $('#isaacEffectsTableBody');
    const modal          = $('#isaacEffectModal');
    const effectCards    = $('#isaacEffectCards');
    const addBtn         = $('#addIsaacEffectBtn');
    const saveBtn        = $('#saveIsaacEffectBtn');
    const cancelBtn      = $('#cancelIsaacModalBtn');
    const log            = $('#isaacLog');
    const logWrap        = $('#isaacLogWrap');
    const statusText     = $('#isaacStatusText');
    const statusBadgeDot = $('#isaacStatusBadgeDot');
    const sidebarDot     = $('#isaacStatusDot');

    const giftDropdown = new GiftDropdown({
        inputId: 'isaacGiftInput',
        resultsId: 'isaacGiftResults',
        previewId: 'isaacGiftImagePreview'
    });

    // ── Status ───────────────────────────────────────────────────────────────

    function setStatus(connected) {
        const color = connected ? '#27ae60' : '#444';
        statusBadgeDot.css('background', color);
        sidebarDot.css('background', color);
        statusText.text(connected ? 'TBOI mod connected' : 'Waiting for TBOI mod...');
    }

    if (socket) {
        socket.on('isaacStatus', (data) => setStatus(data.isConnected));
        socket.on('isaacResponse', (data) => {
            // Optional: show response from Isaac mod
        });
        socket.on('isaacLog', (data) => {
            logWrap.show();
            const entry = $(`<div>${data.viewer} sent <b>${data.giftName}</b> → <span style="color:var(--accent)">${data.effect}</span></div>`);
            log.prepend(entry);
            while (log.children().length > 20) log.children().last().remove();
        });
    }

    // ── Load data ────────────────────────────────────────────────────────────

    async function loadData() {
        try {
            const [effectsRes, commandsRes, giftsRes] = await Promise.all([
                fetch('/api/isaac/effects'),
                fetch('/api/isaac/commands'),
                fetch('/api/gifts'),
            ]);
            const effectsData  = await effectsRes.json();
            const commandsData = await commandsRes.json();
            const giftsData    = await giftsRes.json();

            availableEffects = effectsData.effects || {};
            currentCommands  = commandsData.commands || {};
            availableGifts   = giftsData.gifts || [];

            giftDropdown.updateGifts(availableGifts);

            renderTable();
        } catch (e) {
            console.error('[Isaac UI] Failed to load data:', e);
        }
    }

    // ── Table ────────────────────────────────────────────────────────────────

    function renderTable() {
        tableBody.empty();
        const keys = Object.keys(currentCommands);

        if (keys.length === 0) {
            tableBody.append('<tr><td colspan="3" style="text-align:center;padding:20px;">No effects added yet</td></tr>');
            return;
        }

        keys.forEach(giftName => {
            const effectId = currentCommands[giftName];
            const effect   = availableEffects[effectId] || {};
            const gift     = availableGifts.find(g => g.name === giftName);
            const imgSrc   = gift?.image?.url_list?.[0] || '';
            const catColor = CATEGORY_COLORS[effect.category] || '#888';

            const row = $(`
                <tr>
                    <td>
                        <div style="display:flex;align-items:center;gap:10px;">
                            ${imgSrc ? `<img src="${imgSrc}" style="width:28px;height:28px;border-radius:6px;border:1px solid var(--border);">` : ''}
                            <b>${giftName}</b>
                        </div>
                    </td>
                    <td>
                        <div style="display:flex;align-items:center;gap:8px;">
                            <span style="background:${catColor}22;color:${catColor};border:1px solid ${catColor}55;border-radius:4px;padding:2px 7px;font-size:0.72rem;font-weight:600;">${effect.category || ''}</span>
                            <span style="font-weight:600;">${effect.label || effectId}</span>
                            <span style="color:var(--text-muted);font-size:0.78rem;">${effect.desc || ''}</span>
                        </div>
                    </td>
                    <td>
                        <div style="display:flex;gap:6px;justify-content:center;">
                            <button class="btn-secondary btn-sm btn-isaac-edit" data-gift="${giftName}">Edit</button>
                            <button class="btn-danger btn-sm btn-isaac-delete" data-gift="${giftName}">Delete</button>
                        </div>
                    </td>
                </tr>
            `);
            tableBody.append(row);
        });

        $('.btn-isaac-edit').off().click(function () {
            openModal($(this).data('gift'));
        });
        $('.btn-isaac-delete').off().click(function () {
            const giftName = $(this).data('gift');
            showConfirm({
                title: 'Remove Effect?',
                message: `Remove effect for <b>${giftName}</b>?`,
                confirmText: 'Remove',
                cancelText: 'Cancel',
                danger: true
            }).then(confirmed => {
                if (confirmed) saveEffect(giftName, null, 'delete');
            });
        });
    }

    // ── Effect cards ─────────────────────────────────────────────────────────

    function renderEffectCards(selectedId) {
        effectCards.empty();
        const grouped = {};
        Object.entries(availableEffects).forEach(([id, eff]) => {
            const cat = eff.category || 'Other';
            if (!grouped[cat]) grouped[cat] = [];
            grouped[cat].push({ id, ...eff });
        });

        Object.entries(grouped).forEach(([cat, effects]) => {
            const catColor = CATEGORY_COLORS[cat] || '#888';
            const header = $(`<div style="grid-column:1/-1;font-size:0.72rem;font-weight:700;text-transform:uppercase;letter-spacing:.07em;color:${catColor};margin-top:8px;margin-bottom:2px;">${cat}</div>`);
            effectCards.append(header);

            effects.forEach(eff => {
                const isSelected = eff.id === selectedId;
                const card = $(`
                    <div class="isaac-effect-card ${isSelected ? 'selected' : ''}" data-effect="${eff.id}"
                        style="border:2px solid ${isSelected ? catColor : 'var(--border)'};border-radius:8px;padding:10px 12px;cursor:pointer;transition:border-color .15s,background .15s;background:${isSelected ? catColor + '18' : 'var(--bg-card)'};">
                        <div style="font-weight:600;font-size:0.85rem;margin-bottom:2px;">${eff.label}</div>
                        <div style="font-size:0.75rem;color:var(--text-muted);">${eff.desc}</div>
                    </div>
                `);
                card.click(function () {
                    selectedEffectId = eff.id;
                    renderEffectCards(eff.id);
                });
                effectCards.append(card);
            });
        });
    }



    function openModal(giftName) {
        editingGiftName = giftName || null;
        selectedEffectId = giftName ? currentCommands[giftName] : null;

        giftDropdown.setValue(giftName || '');
        $('#isaacModalTitle').text(giftName ? 'Edit TBOI Effect' : 'Add TBOI Effect');
        renderEffectCards(selectedEffectId);
        modal.css('display', 'flex');
    }

    function closeModal() {
        modal.hide();
        giftDropdown.reset();
        selectedEffectId = null;
        editingGiftName  = null;
        effectCards.empty();
    }

    addBtn.click(() => openModal(null));
    cancelBtn.click(closeModal);

    saveBtn.click(() => {
        const giftName = giftDropdown.getValue();
        if (!giftName) { showToast('Please enter a gift name', 'warning'); return; }
        if (!selectedEffectId) { showToast('Please select an effect', 'warning'); return; }
        saveEffect(giftName, selectedEffectId, 'save');
    });

    // ── Save ─────────────────────────────────────────────────────────────────

    async function saveEffect(giftName, effectId, action) {
        try {
            const res = await fetch('/api/isaac/commands', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ giftName, effectId, action })
            });
            const data = await res.json();
            if (data.success) {
                currentCommands = data.commands;
                renderTable();
                closeModal();
                showToast(action === 'delete' ? 'Effect removed' : 'Effect saved!', 'success');
            } else {
                showToast('Error: ' + data.error, 'error');
            }
        } catch (e) {
            showToast('Connection error', 'error');
        }
    }

    loadData();
}
