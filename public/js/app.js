import { TikTokIOConnection } from './socket.js';
import { addChatItem, clearItems } from './ui/chat.js';
import { addGiftItem, clearGifts } from './ui/gift.js';
import { updateRoomStats, updateDonationStats, syncInitial, resetStats } from './ui/stats.js';
import { setupTabs } from './ui/tabs.js';
import { loadTopDonors, clearTopDonors } from './ui/topDonors.js';
import { initMinecraftUI } from './ui/minecraft.js';
import { initCommandsUI, refreshCommandsData } from './ui/commands.js';
import { showToast } from './ui/dialog.js';

// store stuff here
let viewerCount = 0;
let likeCount = 0;
let sessionGiftCount = 0;
let sessionChatCount = 0;
let sessionFollowCount = 0;
let recentFollowers = [];
let isConnected = false; // track if we actually connected this session

function updateSessionPanel() {
    const diamonds = parseInt($('#totalDiamonds').text().replace(/,/g, '')) || 0;
    const usd = (diamonds * 0.005).toFixed(2);
    $('#sessionViewers').text(viewerCount.toLocaleString());
    $('#sessionLikes').text(likeCount.toLocaleString());
    $('#sessionDiamonds').text(diamonds.toLocaleString());
    $('#sessionUSD').text(`$${usd}`);
    $('#sessionGifts').text(sessionGiftCount.toLocaleString());
    $('#sessionChats').text(sessionChatCount.toLocaleString());
    $('#sessionFollows').text(sessionFollowCount.toLocaleString());
    $('#sessionFollowsBadge').text(sessionFollowCount.toLocaleString());
}

function renderRecentFollowers() {
    const container = $('#recentFollowersList');
    if (recentFollowers.length === 0) return;

    container.empty();
    recentFollowers.forEach(f => {
        const item = $(`
            <div style="display:flex;align-items:center;gap:12px;padding:8px 12px;background:var(--bg3);border-radius:var(--r-md);animation: modalIn 0.3s cubic-bezier(0.16, 1, 0.3, 1);">
                <img src="${f.avatar}" style="width:28px;height:28px;border-radius:50%;object-fit:cover;border:1px solid var(--border);">
                <div style="flex:1;min-width:0;">
                    <div style="font-size:13px;font-weight:600;color:var(--text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${f.name}</div>
                </div>
                <div style="font-size:11px;font-weight:700;color:var(--accent);">Followed</div>
            </div>
        `);
        container.append(item);
    });
}

// Connection
const connection = new TikTokIOConnection();

$(document).ready(() => {
    setupTabs();

    // clear top donors on page load
    clearTopDonors();

    $('#uniqueIdInput').val(localStorage.getItem('tiktokUsername') || '');

    $('#connectButton').click(connect);
    $('#syncInitialBtn').click(syncInitial);
    $('#topDonorsTab').click(() => { if (isConnected) loadTopDonors(); });
    $('#refreshTopDonorsBtn').click(() => { if (isConnected) loadTopDonors(); });

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
        $('#sessionStatus').text('Connecting...').css('color', 'var(--dim)');

        // clear old data
        isConnected = false;
        sessionGiftCount = 0;
        sessionChatCount = 0;
        sessionFollowCount = 0;
        recentFollowers = [];
        clearItems();
        clearGifts();
        resetStats();
        clearTopDonors();
        updateSessionPanel();
        $('#recentFollowersList').html('<div class="follower-placeholder" style="text-align:center;padding:16px 0;font-size:12px;color:var(--dim);">No new followers yet</div>');

        connection.connect(uniqueId, {
            enableExtendedGiftInfo: true
        }).then(state => {
            isConnected = true;
            $('#statusDot').removeClass('loading error').addClass('connected');
            $('#statusText').text(`Connected: @${uniqueId}`);
            $('#sessionStatus').text('Connected').css('color', 'var(--success)');
        }).catch(err => {
            isConnected = false;
            $('#statusDot').removeClass('loading success connected').addClass('error');
            $('#statusText').text(err.toString());
            $('#sessionStatus').text('Error').css('color', 'var(--danger)');
        });
    } else {
        showToast('Please enter a TikTok username', 'warning');
    }
}

// listen to backend events
connection.on('statUpdate', (data) => {
    // only reload top donors if we're actually in an active session
    if (!isConnected) return;
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
        updateSessionPanel();
    }
});

connection.on('like', (msg) => {
    if (typeof msg.totalLikeCount === 'number') {
        likeCount = msg.totalLikeCount;
        updateRoomStats(viewerCount, likeCount);
        updateSessionPanel();
    }
});

connection.on('chat', (msg) => {
    sessionChatCount++;
    updateSessionPanel();
    addChatItem('', msg, msg.comment);
});

connection.on('gift', (data) => {
    // tiktok spam events for streaks (1, 2, 3...)
    // so only count if it's the final one
    if (data.giftType === 1 && !data.repeatEnd) {
        // streak still going, wait
    } else {
        // streak ended, add total
        sessionGiftCount += (data.repeatCount || 1);
        updateSessionPanel();
    }

    // update ui so we can see the streak animation
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

    if (data.displayType.includes('follow')) {
        sessionFollowCount++;
        recentFollowers.unshift({
            name: data.nickname || data.uniqueId || 'Someone',
            avatar: data.profilePictureUrl || 'https://www.tiktok.com/static/images/avatar_default.png'
        });
        if (recentFollowers.length > 4) recentFollowers.pop();
        updateSessionPanel();
        renderRecentFollowers();
    }
});

connection.on('streamEnd', () => {
    $('#statusDot').removeClass('loading success').addClass('error');
    $('#statusText').text('Stream ended.');
});
