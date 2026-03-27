import { sanitize, generateUsernameLink } from '../utils/dom.js';

// add msg to chat feed
export function addChatItem(color, data, text, summarize) {
    let container = $('.eventcontainer').length ? $('.eventcontainer') : $('.chatcontainer');

    if (container.find('div').length > 500) {
        container.find('div').slice(0, 200).remove();
    }

    // remove waiting text
    container.find('.placeholder').remove();

    // drop old temp messages if this is a summary
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

    if ($('#chatAutoScroll').length === 0 || $('#chatAutoScroll').is(':checked')) {
        container.stop();
        container.animate({
            scrollTop: container[0].scrollHeight
        }, 400);
    }
}

export function clearItems() {
    $('.chatcontainer').empty().append('<div class="static placeholder">Waiting for messages...</div>');
}
