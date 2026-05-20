const { TikTokLiveConnection, WebcastEvent, ControlEvent } = require('tiktok-live-connector');
const { EventEmitter } = require('events');

let globalConnectionCount = 0;

const DEFAULT_AVATAR = 'https://www.tiktok.com/static/images/avatar_default.png';

function pickAvatar(user) {
    if (!user) return null;
    const candidates = [user.avatarThumb, user.avatarMedium, user.avatarLarge, user.avatarJpg];
    for (const c of candidates) {
        const url = c?.urlList?.[0];
        if (url) return url;
    }
    return null;
}

function normalizeUser(user) {
    if (!user) return { userId: '', uniqueId: '', nickname: '', profilePictureUrl: null };
    return {
        userId: user.id?.toString() || '',
        uniqueId: user.displayId || '',
        nickname: user.nickname || '',
        profilePictureUrl: pickAvatar(user),
    };
}

// flatten proto messages to the legacy flat shape the rest of the app expects
function normalize(type, data) {
    if (!data) return data;
    const base = normalizeUser(data.user);

    switch (type) {
        case 'chat':
            return {
                ...base,
                comment: data.content || '',
                msgId: data.common?.msgId?.toString(),
                emotes: (data.emotes || []).map(e => ({
                    emoteId: e.emote?.emoteId,
                    emoteImageUrl: e.emote?.image?.urlList?.[0],
                    placeInComment: e.placeInComment,
                })),
                raw: data,
            };

        case 'gift': {
            const gift = data.gift || {};
            return {
                ...base,
                giftId: gift.id ? parseInt(gift.id, 10) : parseInt(data.giftId, 10),
                giftName: gift.name || '',
                diamondCount: gift.diamondCount || 0,
                giftType: gift.type ?? 0,
                giftPictureUrl: gift.image?.urlList?.[0] || '',
                repeatCount: data.repeatCount || 1,
                repeatEnd: !!data.repeatEnd,
                groupId: data.groupId,
                receiverUserId: data.toUser?.id?.toString(),
                describe: gift.describe || '',
                giftDetails: {
                    giftName: gift.name,
                    giftType: gift.type,
                    giftImage: gift.image ? { urlList: gift.image.urlList } : null,
                    diamondCount: gift.diamondCount,
                    describe: gift.describe,
                },
                raw: data,
            };
        }

        case 'like':
            return {
                ...base,
                likeCount: data.count || 0,
                totalLikeCount: parseInt(data.total || 0, 10),
                raw: data,
            };

        case 'social': {
            const key = data.common?.displayText?.key || '';
            const label = data.common?.displayText?.defaultPattern || '';
            const isFollow = key.includes('follow') || key.includes('pm_mt_guidance_viewer_follow_anchor');
            const isShare  = key.includes('share');
            return {
                ...base,
                displayType: isFollow ? 'pm_main_follow_message_viewer_2' : (isShare ? 'pm_mt_msg_share' : key),
                label,
                type: isFollow ? 'follow' : (isShare ? 'share' : 'social'),
                raw: data,
            };
        }

        case 'member':
            return {
                ...base,
                label: data.common?.displayText?.defaultPattern || 'joined',
                actionId: data.action,
                raw: data,
            };

        case 'roomUser': {
            const total = parseInt(data.total || data.totalUser || 0, 10);
            const topViewers = (data.topViewers || data.ranksList || []).map(v => ({
                user: v.user ? normalizeUser(v.user) : null,
                coinCount: v.coinCount ? parseInt(v.coinCount, 10) : 0,
            }));
            return {
                viewerCount: total,
                topViewers,
                raw: data,
            };
        }

        case 'subscribe':
            return {
                ...base,
                subMonth: data.subMonth || 0,
                raw: data,
            };

        default:
            return { ...base, raw: data };
    }
}

class TikTokConnectionWrapper extends EventEmitter {
    constructor(uniqueId, options, enableLog) {
        super();

        this.uniqueId = uniqueId;
        this.enableLog = enableLog;

        this.clientDisconnected = false;
        this.reconnectEnabled = true;
        this.reconnectCount = 0;
        this.reconnectWaitMs = 1000;
        this.maxReconnectAttempts = 5;

        // strip legacy options that don't exist on v2 anymore
        const cleanOptions = { ...(options || {}) };
        delete cleanOptions.requestOptions;
        delete cleanOptions.websocketOptions;
        delete cleanOptions.disableEulerFallbacks;
        delete cleanOptions.sessionId;

        this._real = new TikTokLiveConnection(uniqueId, cleanOptions);

        // expose an EventEmitter shim so the rest of the app can keep doing
        // `wrapper.connection.on('gift', ...)` with the old flat payload shape
        this.connection = new EventEmitter();

        this._wireEvents();
    }

    _wireEvents() {
        const forward = (protoEvent, outEvent, type = outEvent) => {
            this._real.on(protoEvent, (data) => {
                try {
                    this.connection.emit(outEvent, normalize(type, data));
                } catch (err) {
                    this.log(`Failed to normalize ${protoEvent}: ${err.message}`);
                }
            });
        };

        forward(WebcastEvent.CHAT,      'chat');
        forward(WebcastEvent.GIFT,      'gift');
        forward(WebcastEvent.LIKE,      'like');
        forward(WebcastEvent.MEMBER,    'member');
        forward(WebcastEvent.ROOM_USER, 'roomUser');
        forward(WebcastEvent.SOCIAL,    'social');
        forward(WebcastEvent.FOLLOW,    'social', 'social');
        forward(WebcastEvent.SHARE,     'social', 'social');

        this._real.on(WebcastEvent.STREAM_END, () => {
            this.log('streamEnd');
            this.reconnectEnabled = false;
            this.connection.emit('streamEnd');
        });

        this._real.on(ControlEvent.DISCONNECTED, () => {
            globalConnectionCount = Math.max(0, globalConnectionCount - 1);
            this.log('disconnected');
            this.scheduleReconnect();
        });

        this._real.on(ControlEvent.ERROR, (err) => {
            const info = err?.info || err?.message || String(err);
            if (info && !/falling back/i.test(info)) this.log(`Error: ${info}`);
        });
    }

    async connect(isReconnect) {
        try {
            const state = await this._real.connect();
            this.connectTime = Date.now();
            this.log(`${isReconnect ? 'Reconnected' : 'Connected'} to roomId ${state.roomId}`);
            globalConnectionCount += 1;

            this.reconnectCount = 0;
            this.reconnectWaitMs = 1000;

            if (this.clientDisconnected) {
                await this._real.disconnect();
                return;
            }

            if (!isReconnect) this.emit('connected', state);
        } catch (err) {
            this.log(`${isReconnect ? 'Reconnect' : 'Connection'} failed, ${err}`);
            if (isReconnect) this.scheduleReconnect(err);
            else this.emit('disconnected', err.toString());
        }
    }

    scheduleReconnect(reason) {
        if (!this.reconnectEnabled) return;
        if (this.reconnectCount >= this.maxReconnectAttempts) {
            this.log('Give up connection, max reconnect attempts exceeded');
            this.emit('disconnected', `Connection lost. ${reason || ''}`);
            return;
        }
        this.log(`Try reconnect in ${this.reconnectWaitMs}ms`);
        setTimeout(() => {
            if (!this.reconnectEnabled || this.reconnectCount >= this.maxReconnectAttempts) return;
            this.reconnectCount += 1;
            this.reconnectWaitMs *= 2;
            this.connect(true);
        }, this.reconnectWaitMs);
    }

    disconnect() {
        this.log('Client connection disconnected');
        this.clientDisconnected = true;
        this.reconnectEnabled = false;
        this._real.disconnect().catch(() => {});
    }

    log(s) {
        if (this.enableLog) console.log(`WRAPPER @${this.uniqueId}: ${s}`);
    }
}

module.exports = {
    TikTokConnectionWrapper,
    getGlobalConnectionCount: () => globalConnectionCount,
    DEFAULT_AVATAR,
};
