import { sanitize, generateUsernameLink, isPendingStreak } from '../utils/dom.js';

// throw new gift inside the box
export function addGiftItem(data) {
    let container = $('.eventcontainer').length ? $('.eventcontainer') : $('.giftcontainer');

    if (container.find('div').length > 200) {
        container.find('div').slice(0, 100).remove();
    }

    // remove waiting text
    container.find('.placeholder').remove();

    // robust streak id so we dont mix them up
    let streakId = (data.userId || '0').toString() + '_' + (data.giftId || '0');

    // find the pfp
    const profilePic = data.profilePictureUrl ||
        data.user?.profilePictureUrl ||
        data.sender?.avatar_thumb?.url_list?.[0] ||
        data.user?.avatar_thumb?.url_list?.[0] ||
        'https://www.tiktok.com/static/images/avatar_default.png';

    // grab the gift icon url
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
            <img class="gifticon" src="${sanitize(iconUrl)}" alt="">
            <div class="gift-main">
                <div class="gift-who">
                    <img class="miniprofilepicture" src="${sanitize(profilePic)}" alt="" onerror="this.src='https://www.tiktok.com/static/images/avatar_default.png';">
                    <b>${generateUsernameLink(data)}</b>
                </div>
                <div class="gift-what">${sanitize(describe)} <span>ID ${sanitize(data.giftId)}</span></div>
            </div>
            <div class="gift-count ${pending ? 'is-pending' : ''}">x${repeatCount.toLocaleString()}</div>
            <div class="gift-cost">${totalDiamonds.toLocaleString()} ${totalDiamonds === 1 ? 'diamond' : 'diamonds'}</div>
        </div>
    `;

    let existingStreakItem = container.find(`[data-streakid='${streakId}']`);

    if (existingStreakItem.length) {
        existingStreakItem.replaceWith(html);
    } else {
        container.append(html);
    }

    if ($('#giftAutoScroll').length === 0 || $('#giftAutoScroll').is(':checked')) {
        container.stop();
        container.animate({
            scrollTop: container[0].scrollHeight
        }, 800);
    }
}

export function clearGifts() {
    $('.giftcontainer').empty().append('<div class="static placeholder">Waiting for gifts...</div>');
}
