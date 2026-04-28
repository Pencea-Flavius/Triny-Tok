import { showToast, showAlert, showConfirm } from './dialog.js';
import { GiftDropdown } from './components/GiftDropdown.js';

export let refreshCommandsData = () => { };

let socket = null;

export function initCommandsUI(ioConnection) {
    if (ioConnection) socket = ioConnection.socket;
    const tableBody = $('#commandsTableBody');
    const modal = $('#commandModal');
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
    const giftDropdown = new GiftDropdown({
        inputId: 'giftNameInput',
        resultsId: 'giftSearchResults',
        previewId: 'giftImagePreview',
        onSelect: (name) => {},
        onDelete: async (gift) => {
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
                        refreshCommandsData();
                    } else {
                        const err = await res.json();
                        showToast(err.error || 'Failed to delete gift', 'error');
                    }
                } catch (e) {
                    showToast('Connection error: ' + e.message, 'error');
                }
            }
        }
    });

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
            giftDropdown.updateGifts(availableGifts);
            renderCommands(cmdData.commands);

            followInput.val(cmdData.followCommand?.command || '');
            likeThresholdInput.val(cmdData.likeCommand?.minLikes || 100);
            likeInput.val(cmdData.likeCommand?.command || '');

        } catch (e) {
            console.error('Failed to load data:', e);
        }
    }

    refreshCommandsData = loadData;



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
                            <button class="btn-primary btn-sm btn-test" data-gift="${giftName}">
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>
                                Test
                            </button>
                            <button class="btn-secondary btn-sm btn-edit" data-gift="${giftName}">
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                                Edit
                            </button>
                            <button class="btn-danger btn-sm btn-delete" data-gift="${giftName}">
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"></path></svg>
                                Delete
                            </button>
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
        giftDropdown.setValue(gift || '');

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
        modal.css('display', 'flex');
    }

    function closeModal() {
        modal.hide();
        giftDropdown.reset();
        cmdInput.val('');
        cooldownInput.val(0);
        waitStreakInput.prop('checked', true);
        waitStreakInput.trigger('change');
        currentEditGiftName = null;
    }

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
        const gift = giftDropdown.getValue();
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
