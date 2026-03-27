import { showToast, showAlert, showConfirm } from './dialog.js';

export let refreshCommandsData = () => { };

let socket = null;

export function initCommandsUI(ioConnection) {
    if (ioConnection) socket = ioConnection.socket;
    const tableBody = $('#commandsTableBody');
    const modal = $('#commandModal');
    const giftInput = $('#giftNameInput');
    const cmdInput = $('#commandInput');
    const cooldownInput = $('#cooldownInput');
    const waitStreakInput = $('#waitStreakInput');
    const delayConfigRow = $('#delayConfigRow');
    const executeDelayInput = $('#executeDelayInput');
    const delayValueDisplay = $('#delayValueDisplay');
    const saveBtn = $('#saveCommandBtn');
    const closeBtn = $('#closeModalBtn');
    const addBtn = $('#addCommandBtn');
    const modalTitle = $('#modalTitle');
    const giftSuggestions = $('#giftSuggestions');
    const giftSearchResults = $('#giftSearchResults');
    const giftImagePreview = $('#giftImagePreview');

    const socialBtn = $('#socialTriggersBtn');
    const socialModal = $('#socialTriggersModal');
    const followInput = $('#followCmdInput');
    const likeThresholdInput = $('#likeThresholdInput');
    const likeInput = $('#likeCmdInput');
    const saveSocialBtn = $('#saveSocialBtn');
    const closeSocialBtn = $('#closeSocialBtn');

    let currentEditGiftName = null;
    let availableGifts = [];

    async function loadData() {
        try {
            const [cmdRes, giftRes] = await Promise.all([
                fetch('/api/commands'),
                fetch('/api/gifts')
            ]);

            const cmdData = await cmdRes.json();
            const giftData = await giftRes.json();

            availableGifts = giftData.gifts || [];
            updateSuggestions();
            renderCommands(cmdData.commands);

            followInput.val(cmdData.followCommand?.command || '');
            likeThresholdInput.val(cmdData.likeCommand?.minLikes || 100);
            likeInput.val(cmdData.likeCommand?.command || '');

        } catch (e) {
            console.error('Failed to load data:', e);
        }
    }

    refreshCommandsData = loadData;

    function updateSuggestions(query = '') {
        giftSearchResults.empty();

        // sort cheapest to most expensive
        const sortedGifts = [...availableGifts].sort((a, b) => (a.diamond_count || 0) - (b.diamond_count || 0));

        const filtered = sortedGifts.filter(gift =>
            gift.name.toLowerCase().includes(query.toLowerCase())
        ); // show any match

        if (filtered.length === 0) {
            giftSearchResults.hide();
            return;
        }

        filtered.forEach(gift => {
            const imgSrc = gift.image?.url_list?.[0] || 'https://p16-webcast.tiktokcdn.com/img/maliva/webcast-va/eba3a9bb85c33e017f3648eaf88d7189~tplv-obj.png';
            const price = gift.diamond_count || 0;

            const item = $(`
                <div class="gift-search-item" data-name="${gift.name}">
                    <div style="display: flex; align-items: center; gap: 10px; flex: 1;">
                        <img src="${imgSrc}">
                        <div class="gift-search-info">
                            <span class="gift-search-name">${gift.name}</span>
                            <span class="gift-search-price">
                                ${price} <svg width="12" height="12" viewBox="0 0 640 640" fill="currentColor" style="margin-left: 2px; opacity: 0.9;"><path d="M232.5 136L320 229L407.5 136L232.5 136zM447.9 163.1L375.6 240L504.6 240L448 163.1zM497.9 288L142.1 288L320 484.3L497.9 288zM135.5 240L264.5 240L192.2 163.1L135.6 240zM569.8 280.1L337.8 536.1C333.3 541.1 326.8 544 320 544C313.2 544 306.8 541.1 302.2 536.1L70.2 280.1C62.5 271.6 61.9 258.9 68.7 249.7L180.7 97.7C185.2 91.6 192.4 87.9 200 87.9L440 87.9C447.6 87.9 454.8 91.5 459.3 97.7L571.3 249.7C578.1 258.9 577.4 271.6 569.8 280.1z"/></svg>
                            </span>
                        </div>
                    </div>
                    <button class="btn-icon-danger btn-delete-gift-db" title="Delete from Database" data-id="${gift.id}">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                    </button>
                </div>
            `);

            item.find('.btn-delete-gift-db').click(async function (e) {
                e.stopPropagation();
                const confirmed = await showConfirm({
                    title: 'Delete Gift from Database',
                    message: `Remove <b>${gift.name}</b> from the database? It will disappear from the gift list.`,
                    confirmText: 'Delete',
                    cancelText: 'Cancel',
                    danger: true
                });
                if (confirmed) {
                    try {
                        const res = await fetch(`/api/gifts/${gift.id}`, { method: 'DELETE' });
                        if (res.ok) {
                            showToast(`"${gift.name}" removed from database`, 'success');
                            loadData();
                        } else {
                            const err = await res.json();
                            showToast(err.error || 'Failed to delete gift', 'error');
                        }
                    } catch (e) {
                        showToast('Connection error: ' + e.message, 'error');
                    }
                }
            });

            item.click(function () {
                giftInput.val(gift.name);
                updateImagePreview(gift.name);
                giftSearchResults.hide();
            });

            giftSearchResults.append(item);
        });

        giftSearchResults.show();
    }

    giftInput.on('focus', function () {
        updateSuggestions($(this).val());
    });

    giftInput.on('input', function () {
        const val = $(this).val();
        updateSuggestions(val);
        updateImagePreview(val);
    });

    $(document).on('click', function (e) {
        if (!$(e.target).closest('#giftNameInput, #giftSearchResults').length) {
            giftSearchResults.hide();
        }
    });

    function renderCommands(commands) {
        tableBody.empty();
        const keys = Object.keys(commands);

        if (keys.length === 0) {
            tableBody.append('<tr><td colspan="3" style="text-align: center; padding: 20px;">No commands added</td></tr>');
            return;
        }

        keys.forEach(giftName => {
            const cmdObj = commands[giftName];
            const cmdText = typeof cmdObj === 'string' ? cmdObj : (cmdObj.command || '');
            const displayCmd = cmdText.split('\n').join(' | ');

            const gift = availableGifts.find(g => g.name === giftName);
            const imgSrc = gift?.image?.url_list?.[0] || 'https://p16-webcast.tiktokcdn.com/img/maliva/webcast-va/eba3a9bb85c33e017f3648eaf88d7189~tplv-obj.png';

            const row = $(`
                <tr>
                    <td>
                        <div style="display: flex; align-items: center; gap: 12px;">
                            <img src="${imgSrc}" style="width: 32px; height: 32px; border-radius: 6px; border: 1px solid var(--border);">
                            <b style="font-weight: 600;">${giftName}</b>
                        </div>
                    </td>
                    <td style="font-family: 'JetBrains Mono', monospace; font-size: 0.8rem; color: var(--text-muted); max-width: 400px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${displayCmd}</td>
                    <td>
                        <div style="display: flex; gap: 8px; justify-content: center;">
                            <button class="btn-primary btn-sm btn-test" data-gift="${giftName}">Test</button>
                            <button class="btn-secondary btn-sm btn-edit" data-gift="${giftName}">Edit</button>
                            <button class="btn-danger btn-sm btn-delete" data-gift="${giftName}">Delete</button>
                        </div>
                    </td>
                </tr>
            `);
            tableBody.append(row);
        });

        $('.btn-edit').off().click(function () {
            const gift = $(this).data('gift');
            const cmdObj = commands[gift];
            openModal(gift, cmdObj);
        });

        $('.btn-delete').off().click(function () {
            const gift = $(this).data('gift');
            openDeleteModal(gift);
        });

        $('.btn-test').off().click(function () {
            const gift = $(this).data('gift');
            if (socket) {
                socket.emit('testCommand', { giftName: gift });
            }
        });
    }

    function openDeleteModal(giftName) {
        showConfirm({
            title: 'Delete Command?',
            message: `Remove the command for <b>${giftName}</b>? This cannot be undone.`,
            confirmText: 'Delete',
            cancelText: 'Cancel',
            danger: true
        }).then(confirmed => {
            if (confirmed) updateCommand(giftName, null, 'delete');
        });
    }

    async function updateCommand(giftName, command, action = 'save', oldGiftName = null) {
        try {
            const res = await fetch('/api/commands', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ giftName, oldGiftName, command, action })
            });
            const data = await res.json();
            if (data.success) {
                renderCommands(data.commands);
                closeModal();
            } else {
                showToast('Error: ' + data.error, 'error');
            }
        } catch (e) {
            showToast('Connection error', 'error');
        }
    }

    function openModal(gift = '', cmdObj = null) {
        currentEditGiftName = gift;
        giftInput.val(gift);

        if (typeof cmdObj === 'string') {
            cmdInput.val(cmdObj);
            cooldownInput.val(0);
            waitStreakInput.prop('checked', true);
            executeDelayInput.val(0.2);
        } else if (cmdObj) {
            cmdInput.val(cmdObj.command || '');
            cooldownInput.val(cmdObj.cooldown || 0);
            waitStreakInput.prop('checked', cmdObj.waitForStreak !== false);
            executeDelayInput.val(cmdObj.executeDelay || 0.2);
        } else {
            cmdInput.val('');
            cooldownInput.val(0);
            waitStreakInput.prop('checked', true);
            executeDelayInput.val(0.2);
        }
        waitStreakInput.trigger('change');
        executeDelayInput.trigger('input');

        modalTitle.text(gift ? 'Edit Command' : 'Add Command');
        // giftInput.prop('disabled', !!gift); // let users edit the name
        updateImagePreview(gift);
        modal.css('display', 'flex');
    }

    function closeModal() {
        modal.hide();
        giftInput.val('');
        cmdInput.val('');
        cooldownInput.val(0);
        waitStreakInput.prop('checked', true);
        waitStreakInput.trigger('change');
        giftImagePreview.html('<span style="font-size: 0.8rem; color: var(--text-muted);">IMAGE</span>');
        currentEditGiftName = null;
    }

    function updateImagePreview(name) {
        const gift = availableGifts.find(g => g.name === name);
        if (gift && gift.image && gift.image.url_list && gift.image.url_list[0]) {
            giftImagePreview.html(`<img src="${gift.image.url_list[0]}" style="width: 100%; height: 100%; object-fit: cover;">`);
        } else {
            giftImagePreview.html('<span style="font-size: 0.8rem; color: var(--text-muted);">NONE</span>');
        }
    }

    giftInput.on('input', function () {
        updateImagePreview($(this).val());
    });

    waitStreakInput.change(function () {
        if ($(this).is(':checked')) {
            delayConfigRow.hide();
        } else {
            delayConfigRow.css('display', 'flex');
        }
    });

    executeDelayInput.on('input', function () {
        delayValueDisplay.text($(this).val() + 's');
    });

    addBtn.click(() => openModal());
    closeBtn.click(() => closeModal());

    saveBtn.click(() => {
        const gift = giftInput.val().trim();
        const cmd = cmdInput.val().trim();
        const cooldown = parseInt(cooldownInput.val()) || 0;
        const waitForStreak = waitStreakInput.is(':checked');
        const executeDelay = parseFloat(executeDelayInput.val()) || 0.2;

        if (gift && cmd) {
            updateCommand(gift, {
                command: cmd,
                cooldown: cooldown,
                waitForStreak: waitForStreak,
                executeDelay: executeDelay
            }, 'save', currentEditGiftName);
        } else {
            showToast('Please fill in both Gift Name and Command fields', 'warning');
        }
    });

    socialBtn.click(() => socialModal.css('display', 'flex'));
    closeSocialBtn.click(() => socialModal.hide());
    saveSocialBtn.click(async () => {
        const follow = followInput.val().trim();
        const likeThreshold = parseInt(likeThresholdInput.val()) || 100;
        const like = likeInput.val().trim();

        try {
            const res = await fetch('/api/commands', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    followCommand: { command: follow },
                    likeCommand: { command: like, minLikes: likeThreshold }
                })
            });
            if (res.ok) {
                socialModal.hide();
                showToast('Social Triggers saved!', 'success');
            }
        } catch (e) {
            showToast('Connection error', 'error');
        }
    });

    loadData();
}
