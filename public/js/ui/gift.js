import { sanitize, generateUsernameLink, isPendingStreak } from '../utils/dom.js';

/**
 * Add a new gift to the gift container
 */
export function addGiftItem(data) {
    let container = $('.eventcontainer').length ? $('.eventcontainer') : $('.giftcontainer');

    if (container.find('div').length > 200) {
        container.find('div').slice(0, 100).remove();
    }

    // Clear placeholder
    container.find('.placeholder').remove();

    // Fix streak ID generation to be robust
    let streakId = (data.userId || '0').toString() + '_' + (data.giftId || '0');

    // Profile Pic Logic
    const profilePic = data.profilePictureUrl ||
        data.user?.profilePictureUrl ||
        data.sender?.avatar_thumb?.url_list?.[0] ||
        data.user?.avatar_thumb?.url_list?.[0] ||
        'https://www.tiktok.com/static/images/avatar_default.png';

    // Gift Icon Logic
    const iconUrl = data.giftPictureUrl ||
        data.gift?.icon?.url_list?.[0] ||
        data.extendedGiftInfo?.icon?.url_list?.[0] ||
        '';

    const giftName = data.giftName || data.extendedGiftInfo?.name || 'Gift';
    const repeatCount = data.repeatCount || 1;
    const totalDiamonds = (data.diamondCount || 0) * repeatCount;
    const describe = data.describe || `sent ${giftName}`;
    const pending = isPendingStreak(data);

    let html = `
        <div ${pending ? `data-streakid="${streakId}"` : ''} class="gift-item">
            <img class="miniprofilepicture" src="${profilePic}" onerror="this.src='https://www.tiktok.com/static/images/avatar_default.png';">
            <div style="flex: 1;">
                <div style="font-size: 0.9rem;">
                    <b>${generateUsernameLink(data)}:</b> <span>${sanitize(describe)}</span>
                </div>
                <div class="gift-details">
                    <img class="gifticon" src="${iconUrl}">
                    <div class="gift-info-text">
                        <span>Name: <b>${sanitize(giftName)}</b> (ID:${data.giftId})</span><br>
                        <span>Repeat: <b style="${pending ? 'color:red' : ''}">x${repeatCount.toLocaleString()}</b></span><br>
                        <span>Cost: <b>${totalDiamonds.toLocaleString()} Diamonds</b></span>
                    </div>
                </div>
            </div>
        </div>
    `;

    let existingStreakItem = container.find(`[data-streakid='${streakId}']`);

    if (existingStreakItem.length) {
        existingStreakItem.replaceWith(html);
    } else {
        container.append(html);
    }

    container.stop();
    container.animate({
        scrollTop: container[0].scrollHeight
    }, 800);
}

export function clearGifts() {
    $('.giftcontainer').empty().append('<div class="static placeholder">Waiting for gifts...</div>');
}
