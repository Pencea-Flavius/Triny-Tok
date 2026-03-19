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

        // Sort available gifts by price (diamond_count) low to high
        const sortedGifts = [...availableGifts].sort((a, b) => (a.diamond_count || 0) - (b.diamond_count || 0));

        const filtered = sortedGifts.filter(gift =>
            gift.name.toLowerCase().includes(query.toLowerCase())
        ); // Show all matches

        if (filtered.length === 0) {
            giftSearchResults.hide();
            return;
        }

        filtered.forEach(gift => {
            const imgSrc = gift.image?.url_list?.[0] || 'https://p16-webcast.tiktokcdn.com/img/maliva/webcast-va/eba3a9bb85c33e017f3648eaf88d7189~tplv-obj.png';
            const price = gift.diamond_count || 0;

            const item = $(`
                <div class="gift-search-item" data-name="${gift.name}">
                    <img src="${imgSrc}">
                    <div class="gift-search-info">
                        <span class="gift-search-name">${gift.name}</span>
                        <span class="gift-search-price">${price} 💎</span>
                    </div>
                </div>
            `);

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
        $('#deleteGiftName').text(giftName);
        $('#deleteConfirmModal').css('display', 'flex');

        $('#confirmDeleteBtn').off().click(async function () {
            await updateCommand(giftName, null, 'delete');
            $('#deleteConfirmModal').hide();
        });

        $('#cancelDeleteBtn').off().click(function () {
            $('#deleteConfirmModal').hide();
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
                alert('Error: ' + data.error);
            }
        } catch (e) {
            alert('Connection error');
        }
    }

    function openModal(gift = '', cmdObj = null) {
        currentEditGiftName = gift;
        giftInput.val(gift);

        if (typeof cmdObj === 'string') {
            cmdInput.val(cmdObj);
            cooldownInput.val(0);
            waitStreakInput.prop('checked', true);
        } else if (cmdObj) {
            cmdInput.val(cmdObj.command || '');
            cooldownInput.val(cmdObj.cooldown || 0);
            waitStreakInput.prop('checked', cmdObj.waitForStreak !== false);
        } else {
            cmdInput.val('');
            cooldownInput.val(0);
            waitStreakInput.prop('checked', true);
        }

        modalTitle.text(gift ? 'Edit Command' : 'Add Command');
        // giftInput.prop('disabled', !!gift); // Removed to allow editing gift name
        updateImagePreview(gift);
        modal.css('display', 'flex');
    }

    function closeModal() {
        modal.hide();
        giftInput.val('');
        cmdInput.val('');
        cooldownInput.val(0);
        waitStreakInput.prop('checked', true);
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

    addBtn.click(() => openModal());
    closeBtn.click(() => closeModal());

    saveBtn.click(() => {
        const gift = giftInput.val().trim();
        const cmd = cmdInput.val().trim();
        const cooldown = parseInt(cooldownInput.val()) || 0;
        const waitForStreak = waitStreakInput.is(':checked');

        if (gift && cmd) {
            updateCommand(gift, {
                command: cmd,
                cooldown: cooldown,
                waitForStreak: waitForStreak
            }, 'save', currentEditGiftName);
        } else {
            alert('Please fill in both fields');
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
                alert('Social Triggers saved!');
            }
        } catch (e) {
            alert('Connection error');
        }
    });

    loadData();
}
