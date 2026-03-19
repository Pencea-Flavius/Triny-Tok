import { sanitize, generateUsernameLink } from '../utils/dom.js';

/**
 * Add a new message to the chat container
 */
export function addChatItem(color, data, text, summarize) {
    let container = $('.eventcontainer').length ? $('.eventcontainer') : $('.chatcontainer');

    if (container.find('div').length > 500) {
        container.find('div').slice(0, 200).remove();
    }

    // Clear placeholder
    container.find('.placeholder').remove();

    // Simplify logic: if summarizing, remove previous temporary message?
    container.find('.temporary').remove();

    const profilePic = data.profilePictureUrl ||
        data.user?.profilePictureUrl ||
        data.sender?.avatar_thumb?.url_list?.[0] ||
        data.user?.avatar_thumb?.url_list?.[0] ||
        'https://www.tiktok.com/static/images/avatar_default.png';

    container.append(`
        <div class=${summarize ? 'temporary' : 'static'}>
            <img class="miniprofilepicture" src="${profilePic}" onerror="this.src='https://www.tiktok.com/static/images/avatar_default.png';">
            <span>
                <b>${generateUsernameLink(data)}:</b> 
                <span style="color:${color}">${sanitize(text)}</span>
            </span>
        </div>
    `);

    container.stop();
    container.animate({
        scrollTop: container[0].scrollHeight
    }, 400);
}

export function clearItems() {
    $('.chatcontainer').empty().append('<div class="static placeholder">Waiting for messages...</div>');
}
