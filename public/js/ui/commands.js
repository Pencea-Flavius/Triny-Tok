import { showToast, showAlert, showConfirm } from './dialog.js';
import { GiftDropdown } from './components/GiftDropdown.js';
import { makeGiftCell, makeActionCell } from './components/GiftActionButtons.js';

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
        onDelete: null
    });

    const triggerRadios = $('input[name="triggerType_minecraft"]');
    const mcGiftSelectorWrapper = $('#mcGiftSelectorWrapper');
    const mcLikesConfigRow = $('#mcLikesConfigRow');
    const mcLikesRequired = $('#mcLikesRequired');

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

        } catch (e) {
            console.error('Failed to load data:', e);
        }
    }

    refreshCommandsData = loadData;

    triggerRadios.change(function() {
        const val = $(this).val();
        if (val === 'gift') {
            mcGiftSelectorWrapper.show();
            mcLikesConfigRow.hide();
        } else if (val === 'follow') {
            mcGiftSelectorWrapper.hide();
            mcLikesConfigRow.hide();
        } else if (val === 'like') {
            mcGiftSelectorWrapper.hide();
            mcLikesConfigRow.show();
        }
    });



    function renderCommands(commands) {
        tableBody.empty();
        const keys = Object.keys(commands);

        if (keys.length === 0) {
            tableBody.append('<tr><td colspan="3" style="text-align:center;padding:40px 20px;color:var(--muted);">No commands yet. Click Add Command to map a TikTok gift.</td></tr>');
            return;
        }

        keys.forEach(giftName => {
            const cmdObj = commands[giftName];
            const cmdText = typeof cmdObj === 'string' ? cmdObj : (cmdObj.command || '');
            const displayCmd = cmdText.split('\n').join(' | ');

            const gift = availableGifts.find(g => g.name === giftName);

            const cmdTd = $('<td class="command-cell"></td>');
            $('<div></div>')
                .text(displayCmd)
                .appendTo(cmdTd);

            const row = $('<tr></tr>');
            row.append(
                makeGiftCell(giftName, gift),
                cmdTd,
                makeActionCell(giftName, {
                    onTest: (g) => { if (socket) socket.emit('testCommand', { giftName: g }); },
                    onEdit: (g) => openModal(g, commands[g]),
                    onDelete: (g) => openDeleteModal(g)
                })
            );
            tableBody.append(row);
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
        
        if (gift === 'Follow') {
            $('input[name="triggerType_minecraft"][value="follow"]').prop('checked', true).trigger('change');
        } else if (gift === 'Like') {
            $('input[name="triggerType_minecraft"][value="like"]').prop('checked', true).trigger('change');
            if (cmdObj && cmdObj.minLikes) mcLikesRequired.val(cmdObj.minLikes);
            else mcLikesRequired.val(100);
        } else {
            $('input[name="triggerType_minecraft"][value="gift"]').prop('checked', true).trigger('change');
            giftDropdown.setValue(gift || '');
        }

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
        $('input[name="triggerType_minecraft"][value="gift"]').prop('checked', true).trigger('change');
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
        const triggerType = $('input[name="triggerType_minecraft"]:checked').val();
        let gift = '';
        if (triggerType === 'gift') {
            gift = giftDropdown.getValue();
        } else if (triggerType === 'follow') {
            gift = 'Follow';
        } else if (triggerType === 'like') {
            gift = 'Like';
        }

        const cmd = cmdInput.val().trim();
        const cooldown = parseInt(cooldownInput.val()) || 0;
        const waitForStreak = waitStreakInput.is(':checked');
        const executeDelay = parseFloat(executeDelayInput.val()) || 0.2;

        if (gift && cmd) {
            const payload = {
                command: cmd,
                cooldown: cooldown,
                waitForStreak: waitForStreak,
                executeDelay: executeDelay
            };
            if (triggerType === 'like') {
                payload.minLikes = parseInt(mcLikesRequired.val()) || 100;
            }
            updateCommand(gift, payload, 'save', currentEditGiftName);
        } else {
            showToast('Please fill in both Gift Name and Command fields', 'warning');
        }
    });

    loadData();
}
