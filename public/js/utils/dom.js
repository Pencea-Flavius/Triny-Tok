// dom utilities

// basic xss prevention
export function sanitize(text) {
    if (!text) return '';
    return text.toString()
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

export function generateUsernameLink(data) {
    const uniqueId = data.uniqueId || data.sender?.uniqueId || data.user?.uniqueId || 'Unknown';
    const nickname = data.nickname || data.sender?.nickname || data.user?.nickname || '';
    return `<a class="usernamelink" href="https://www.tiktok.com/@${encodeURIComponent(uniqueId)}" target="_blank">${sanitize(nickname)} (@${sanitize(uniqueId)})</a>`;
}

export function isPendingStreak(data) {
    return data.giftType === 1 && !data.repeatEnd;
}
