import { TikTokIOConnection } from './socket.js';
import { addChatItem, clearItems } from './ui/chat.js';
import { addGiftItem, clearGifts } from './ui/gift.js';
import { updateRoomStats, updateDonationStats, syncInitial, resetStats } from './ui/stats.js';
import { setupTabs } from './ui/tabs.js';
import { loadTopDonors, clearTopDonors } from './ui/topDonors.js';
import { initMinecraftUI } from './ui/minecraft.js';
import { initCommandsUI, refreshCommandsData } from './ui/commands.js';

// Global state
let viewerCount = 0;
let likeCount = 0;

// Connection
const connection = new TikTokIOConnection();

$(document).ready(() => {
    setupTabs();

    $('#uniqueIdInput').val(localStorage.getItem('tiktokUsername') || '');

    $('#connectButton').click(connect);
    $('#syncInitialBtn').click(syncInitial);
    $('#topDonorsTab').click(loadTopDonors);
    $('#refreshTopDonorsBtn').click(loadTopDonors);

    $('#uniqueIdInput').on('keyup', (e) => {
        if (e.key === 'Enter') connect();
    });

    // Minecraft & Commands
    initMinecraftUI(connection);
    initCommandsUI(connection);
});

function connect() {
    let uniqueId = $('#uniqueIdInput').val();
    if (uniqueId !== '') {
        localStorage.setItem('tiktokUsername', uniqueId);
        $('#statusDot').removeClass('success error').addClass('loading');
        $('#statusText').text('Connecting...');

        // Reset UI for new session
        clearItems();
        clearGifts();
        resetStats();
        clearTopDonors();

        connection.connect(uniqueId, {
            enableExtendedGiftInfo: true
        }).then(state => {
            $('#statusDot').removeClass('loading error').addClass('success');
            $('#statusText').text(`Connected: @${uniqueId}`);

            // Initial stats will be handled via 'statUpdate' socket event
        }).catch(err => {
            $('#statusDot').removeClass('loading success').addClass('error');
            $('#statusText').text(err.toString());
        });
    } else {
        alert('Enter a username');
    }
}

// Socket events
connection.on('statUpdate', (data) => {
    // This event carries trackedDiamonds, initialDonorsSum, etc.
    // We need to keep a local cache or fetch from /api/donation-stats to be sure
    fetch('/api/donation-stats')
        .then(r => r.json())
        .then(res => {
            if (res.success) {
                updateDonationStats(res.trackedDiamonds, res.initialDonorsSum, res.initialDonorsSynced);
                loadTopDonors();
            }
        });
});

connection.on('giftsUpdated', () => {
    refreshCommandsData();
});

connection.on('roomUser', (msg) => {
    if (typeof msg.viewerCount === 'number') {
        viewerCount = msg.viewerCount;
        updateRoomStats(viewerCount, likeCount);
    }
});

connection.on('like', (msg) => {
    if (typeof msg.totalLikeCount === 'number') {
        likeCount = msg.totalLikeCount;
        updateRoomStats(viewerCount, likeCount);
    }
});

connection.on('chat', (msg) => {
    addChatItem('', msg, msg.comment);
});

connection.on('gift', (data) => {
    addGiftItem(data);
});

connection.on('member', (msg) => {
    let text = msg.label ? msg.label.replace('{0:user}', '').replace('joined the member club', 'joined') : 'joined';
    if (text.includes('member club')) text = 'joined';
    addChatItem('#21b2c2', msg, text, true);
});

connection.on('social', (data) => {
    let color = data.displayType.includes('follow') ? '#ff005e' : '#2fb816';
    let text = data.label ? data.label.replace('{0:user}', '') : (data.displayType.includes('follow') ? 'followed' : 'shared');
    addChatItem(color, data, text);
});

connection.on('streamEnd', () => {
    $('#statusDot').removeClass('loading success').addClass('error');
    $('#statusText').text('Stream ended.');
});
