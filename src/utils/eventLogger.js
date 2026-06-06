const fs   = require('fs');
const path = require('path');
const ctx  = require('../context');

const LOG_DIR  = path.join(__dirname, '../../logs');
const LOG_FILE = path.join(LOG_DIR, 'events.txt');

if (!fs.existsSync(LOG_DIR)) fs.mkdirSync(LOG_DIR, { recursive: true });

// the categories that can be toggled on/off by the admin
const CATEGORIES = ['gift', 'chat', 'like', 'follow', 'share', 'member'];

const LABELS = {
    gift:   'GIFT  ',
    chat:   'CHAT  ',
    like:   'LIKE  ',
    follow: 'FOLLOW',
    share:  'SHARE ',
    member: 'MEMBER',
};

function timestamp() {
    const d = new Date();
    const p = n => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}

function who(msg) {
    const uid  = msg.uniqueId ? `@${msg.uniqueId}` : '@unknown';
    const nick = msg.nickname && msg.nickname !== msg.uniqueId ? ` (${msg.nickname})` : '';
    return `${uid}${nick}`;
}

// build a human-readable one-liner per category
function format(category, msg) {
    switch (category) {
        case 'gift': {
            const count    = msg.repeatCount || 1;
            const diamonds = (msg.diamondCount || 0) * count;
            return `${who(msg)} sent "${msg.giftName || 'Gift'}" [id ${msg.giftId ?? '?'}] x${count} = ${diamonds} diamonds`;
        }
        case 'chat':
            return `${who(msg)}: ${msg.comment || ''}`;
        case 'like':
            return `${who(msg)} +${msg.likeCount || 0} likes (total ${msg.totalLikeCount || 0})`;
        case 'follow':
            return `${who(msg)} followed`;
        case 'share':
            return `${who(msg)} shared the live`;
        case 'member':
            return `${who(msg)} joined`;
        default:
            return who(msg);
    }
}

// returns the current logging settings, filling in defaults
function settings() {
    const cfg = ctx.config.logging || {};
    return {
        enabled: !!cfg.enabled,
        events:  cfg.events || {},
    };
}

function isEnabled(category) {
    const s = settings();
    return s.enabled && !!s.events[category];
}

function logEvent(category, msg) {
    if (!isEnabled(category)) return;
    const line = `[${timestamp()}] ${LABELS[category] || category} ${format(category, msg)}\n`;
    fs.appendFile(LOG_FILE, line, err => {
        if (err) console.error('[Logger] Failed to write event log', err.message);
    });
}

// read the last `lines` lines of the log file (for the admin viewer)
function tail(lines = 200) {
    try {
        if (!fs.existsSync(LOG_FILE)) return '';
        const all = fs.readFileSync(LOG_FILE, 'utf8').split('\n').filter(Boolean);
        return all.slice(-lines).join('\n');
    } catch {
        return '';
    }
}

function clear() {
    try { fs.writeFileSync(LOG_FILE, ''); } catch { /* ignore */ }
}

module.exports = { logEvent, tail, clear, settings, CATEGORIES, LOG_FILE };
