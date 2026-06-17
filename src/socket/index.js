const { TikTokConnectionWrapper, getGlobalConnectionCount } = require('../tiktok/connectionWrapper');
const { clientBlocked } = require('../utils/limiter');
const minecraftBridge  = require('../tiktok/minecraftBridge');
const isaacBridge      = require('../tiktok/isaacBridge');
const repoBridge       = require('../tiktok/repoBridge');
const goiBridge        = require('../tiktok/goiBridge');
const terrariaBridge   = require('../tiktok/terrariaBridge');
const db               = require('../database/db_manager');
const ctx              = require('../context');
const logger           = require('../utils/eventLogger');
const { avatarUrl, injectAvatar, finalizeGift } = require('../events/giftHandler');

function setupSocket(io) {
    io.on('connection', (socket) => {
        console.info('New connection from origin', socket.handshake.headers['origin'] || socket.handshake.headers['referer']);

        socket.emit('statUpdate', { trackedDiamonds: ctx.trackedDiamonds, initialDonorsSynced: ctx.initialDonorsSynced, initialDonorsSum: ctx.initialDonorsSum });
        socket.emit('minecraftStatus', { isConnected: minecraftBridge.isConnected, config: ctx.config.minecraft });
        socket.emit('isaacStatus',  { isConnected: isaacBridge.isConnected,  serverActive: !!isaacBridge.server  });
        socket.emit('isaacProfiles', isaacBridge.profiles.length > 0 ? isaacBridge.profiles : (ctx.config.isaacProfiles || ctx.ISAAC_DEFAULT_PROFILES));
        socket.emit('repoStatus', { isConnected: repoBridge.isConnected, serverActive: !!repoBridge.server });
        socket.emit('goiStatus',  { isConnected: goiBridge.isConnected,  serverActive: !!goiBridge.server  });
        socket.emit('terrariaStatus', { isConnected: terrariaBridge.isConnected, serverActive: !!terrariaBridge.server });

        // ── Minecraft ─────────────────────────────────────────────────────────
        socket.on('minecraftConnect', (data) => {
            ctx.config.minecraft.host     = data.host;
            ctx.config.minecraft.port     = data.port;
            ctx.config.minecraft.password = data.password;
            if (data.autoConnect !== undefined) ctx.config.minecraft.autoConnect = data.autoConnect;
            ctx.saveConfig();

            minecraftBridge.connect(data.host, data.port, data.password, data.autoConnect).then(() => {
                ctx.config.minecraft.enabled = true;
                ctx.saveConfig();
            }).catch(err => socket.emit('minecraftError', err.message));
        });

        socket.on('minecraftDisconnect', () => {
            minecraftBridge.disconnect();
            ctx.config.minecraft.enabled = false;
            ctx.saveConfig();
            io.emit('minecraftStatus', { isConnected: false, config: ctx.config.minecraft });
        });

        // ── Isaac ─────────────────────────────────────────────────────────────
        socket.on('isaacStart', () => {
            isaacBridge.start(ctx.config.isaac?.port || 58430);
            io.emit('isaacStatus', { isConnected: isaacBridge.isConnected, serverActive: true });
        });

        socket.on('isaacStop', () => {
            isaacBridge.stop();
            io.emit('isaacStatus', { isConnected: false, serverActive: false });
        });

        // ── R.E.P.O. ──────────────────────────────────────────────────────────
        socket.on('repoStart', () => {
            repoBridge.start(ctx.config.repo?.port || 51337);
            io.emit('repoStatus', { isConnected: repoBridge.isConnected, serverActive: true });
        });

        socket.on('repoStop', () => {
            repoBridge.stop();
            io.emit('repoStatus', { isConnected: false, serverActive: false });
        });

        // ── Getting Over It ───────────────────────────────────────────────────
        socket.on('goiStart', () => {
            goiBridge.start(ctx.config.goi?.port || 52000);
            io.emit('goiStatus', { isConnected: goiBridge.isConnected, serverActive: true });
        });

        socket.on('goiStop', () => {
            goiBridge.stop();
            io.emit('goiStatus', { isConnected: false, serverActive: false });
        });

        // ── Terraria ──────────────────────────────────────────────────────────
        socket.on('terrariaStart', () => {
            terrariaBridge.start(ctx.config.terraria?.port || 53000);
            io.emit('terrariaStatus', { isConnected: terrariaBridge.isConnected, serverActive: true });
        });

        socket.on('terrariaStop', () => {
            terrariaBridge.stop();
            io.emit('terrariaStatus', { isConnected: false, serverActive: false });
        });

        // ── RCON test / manual ────────────────────────────────────────────────
        socket.on('testCommand', async (data) => {
            const giftName = data.giftName;
            const giftCmd  = ctx.config.giftCommands[giftName];
            if (!giftCmd || !minecraftBridge.isConnected) return;

            let cmds = [];
            if (typeof giftCmd === 'string') cmds = [giftCmd];
            else if (typeof giftCmd.command === 'string') cmds = giftCmd.command.split('\n');
            else if (Array.isArray(giftCmd.command)) cmds = giftCmd.command;
            else if (giftCmd.command) cmds = [giftCmd.command];

            const targets      = ctx.config.targetPlayers || [];
            const randomPlayer = targets.length > 0 ? targets[Math.floor(Math.random() * targets.length)] : 'Player';

            for (const cmd of cmds) {
                if (!cmd.trim()) continue;
                const finalCmd = cmd
                    .replace(/\{username\}/g,  'Tester')
                    .replace(/\{nickname\}/g,  'Tester')
                    .replace(/\{giftname\}/g,  giftName)
                    .replace(/\{playername\}/g, randomPlayer)
                    .replace(/\{count\}/g, 1);
                const response = await minecraftBridge.sendCommand(finalCmd);
                if (response !== null) socket.emit('rconLog', { command: finalCmd, response, type: 'test' });
            }
            console.info(`[Test] Triggered command for ${giftName}`);
        });

        socket.on('rconCommand', async (command) => {
            if (minecraftBridge.isConnected) {
                const response = await minecraftBridge.sendCommand(command);
                socket.emit('rconLog', { command, response: response || 'No response', type: 'manual' });
            } else {
                socket.emit('rconLog', { command, response: 'Bridge not connected', type: 'error' });
            }
        });

        // ── TikTok connection ─────────────────────────────────────────────────
        socket.on('setUniqueId', (uniqueId, options) => {
            ctx.trackedDiamonds     = 0;
            ctx.donorStats          = {};
            ctx.initialDonorsSynced = false;
            ctx.initialDonorsSum    = 0;
            ctx.initialTopDonors    = [];
            io.emit('statUpdate', { trackedDiamonds: 0, initialDonorsSynced: false, initialDonorsSum: 0 });

            if (typeof options === 'object' && options) {
                delete options.requestOptions;
                delete options.websocketOptions;
            } else {
                options = {};
            }

            db.setCurrentStreamer(uniqueId).catch(err => {
                console.error(`[DB] Failed switching to streamer @${uniqueId}`, err);
            });

            options.enableExtendedGiftInfo  = false;
            options.processInitialData      = false;
            options.fetchRoomInfoOnConnect  = true;

            if (process.env.SESSIONID) {
                options.session = { cookie: { sessionid: process.env.SESSIONID } };
            }

            if (process.env.ENABLE_RATE_LIMIT && clientBlocked(io, socket)) {
                socket.emit('tiktokDisconnected', 'Rate limit exceeded.');
                return;
            }

            if (ctx.tiktokConnectionWrapper) {
                try { ctx.tiktokConnectionWrapper.disconnect(); } catch (e) { /* ignore */ }
            }

            try {
                ctx.tiktokConnectionWrapper = new TikTokConnectionWrapper(uniqueId, options, true);
                ctx.tiktokOwnerSocketId     = socket.id;
                ctx.tiktokConnectionWrapper.connect();
            } catch (err) {
                socket.emit('tiktokDisconnected', err.toString());
                return;
            }

            ctx.tiktokConnectionWrapper.once('connected', state => {
                socket.emit('tiktokConnected', state);

                const liveAvatarUrl = state?.roomInfo?.data?.owner?.avatarThumb?.urlList?.[0]
                                   || state?.roomInfo?.owner?.profilePictureUrl
                                   || null;
                if (liveAvatarUrl && socket.request?.session?.user?.id) {
                    db.connectGlobal().then(gdb => {
                        gdb.run('UPDATE app_accounts SET tiktok_avatar = ? WHERE id = ?', [liveAvatarUrl, socket.request.session.user.id])
                           .then(() => {
                               socket.request.session.user.tiktokAvatar = liveAvatarUrl;
                               socket.request.session.save?.();
                           });
                    }).catch(() => {});
                }

                const roomData = state.roomInfo?.data || state.roomInfo || state.data || state;

                // seed current viewer/like counts from roomInfo so UI doesn't show 0 until first event
                const initialViewers = parseInt(
                    roomData.user_count ?? roomData.userCount ?? roomData.stats?.total_user ?? 0, 10
                ) || 0;
                const initialLikes = parseInt(
                    roomData.like_count ?? roomData.likeCount ?? roomData.stats?.like_count ?? 0, 10
                ) || 0;
                if (initialViewers) io.emit('roomUser', { viewerCount: initialViewers });
                if (initialLikes)   io.emit('like',     { totalLikeCount: initialLikes });

                const fans     = roomData.top_fans || roomData.topFans || [];
                ctx.initialDonorsSum  = 0;
                ctx.initialTopDonors  = [];
                if (Array.isArray(fans)) {
                    fans.forEach(f => {
                        const diamonds = parseInt(f.fan_ticket || f.fanTicket || 0);
                        ctx.initialDonorsSum += diamonds;
                        const user = f.user || {};
                        const uid  = user.display_id || user.uniqueId || user.displayId || 'Unknown';
                        // top_fans usually omit the @handle but DO include a CDN avatar — keep it
                        const cdnAvatar = user.avatar_thumb?.url_list?.[0]
                                       || user.avatarThumb?.urlList?.[0]
                                       || user.avatar_medium?.url_list?.[0]
                                       || user.avatarMedium?.urlList?.[0]
                                       || null;
                        ctx.initialTopDonors.push({
                            userId: user.user_id || user.userId || f.userId || `init_${Math.random()}`,
                            nickname: user.nickname || user.displayId || 'Unknown',
                            uniqueId: uid,
                            // real CDN avatar from top_fans, else default placeholder
                            profilePictureUrl: cdnAvatar || avatarUrl(),
                            totalDiamonds: diamonds,
                        });
                    });
                }
                io.emit('statUpdate', { initialDonorsSum: ctx.initialDonorsSum });
            });

            ctx.tiktokConnectionWrapper.once('disconnected', reason => io.emit('tiktokDisconnected', reason));
            ctx.tiktokConnectionWrapper.connection.on('streamEnd', () => io.emit('streamEnd'));

            ctx.tiktokConnectionWrapper.connection.on('roomUser',  msg => io.emit('roomUser',  injectAvatar(msg)));
            ctx.tiktokConnectionWrapper.connection.on('member',    msg => { logger.logEvent('member', msg); io.emit('member', injectAvatar(msg)); });
            ctx.tiktokConnectionWrapper.connection.on('chat',      msg => { logger.logEvent('chat',   msg); io.emit('chat',   injectAvatar(msg)); });
            ctx.tiktokConnectionWrapper.connection.on('subscribe', msg => io.emit('subscribe', injectAvatar(msg)));

            const activeStreaks = new Map();
            ctx.tiktokConnectionWrapper.connection.on('gift', msg => {
                const streakId = `${msg.userId}_${msg.giftId}`;
                if (msg.giftType === 1) {
                    if (activeStreaks.has(streakId)) clearTimeout(activeStreaks.get(streakId).timeout);
                    if (!msg.repeatEnd) io.emit('gift', injectAvatar(msg));
                    if (msg.repeatEnd) {
                        finalizeGift(msg, true);
                        activeStreaks.delete(streakId);
                    } else {
                        const timeout = setTimeout(() => {
                            if (activeStreaks.has(streakId)) {
                                finalizeGift(activeStreaks.get(streakId).msg, true);
                                activeStreaks.delete(streakId);
                            }
                        }, 10000);
                        activeStreaks.set(streakId, { timeout, msg });
                    }
                } else {
                    finalizeGift(msg, true);
                }
            });

            ctx.tiktokConnectionWrapper.connection.on('social', msg => {
                if (msg.type === 'follow')      logger.logEvent('follow', msg);
                else if (msg.type === 'share')  logger.logEvent('share', msg);
                
                if (msg.type === 'follow') {
                    const mockGift = {
                        ...msg,
                        giftName: 'Follow',
                        giftId: 'virtual_follow',
                        repeatCount: 1,
                        diamondCount: 0
                    };
                    finalizeGift(mockGift, true);
                }
                io.emit('social', injectAvatar(msg));
            });

            const userLikes = new Map();
            ctx.tiktokConnectionWrapper.connection.on('like', msg => {
                logger.logEvent('like', msg);
                
                let minLikes = Infinity;
                if (ctx.config.giftCommands?.['Like']?.minLikes) minLikes = Math.min(minLikes, ctx.config.giftCommands['Like'].minLikes);
                if (ctx.config.repoCommands?.['Like']?.minLikes) minLikes = Math.min(minLikes, ctx.config.repoCommands['Like'].minLikes);
                if (ctx.config.isaacCommands?.['Like']?.minLikes) minLikes = Math.min(minLikes, ctx.config.isaacCommands['Like'].minLikes);
                if (ctx.config.goiCommands?.['Like']?.minLikes) minLikes = Math.min(minLikes, ctx.config.goiCommands['Like'].minLikes);
                if (ctx.config.terrariaCommands?.['Like']?.minLikes) minLikes = Math.min(minLikes, ctx.config.terrariaCommands['Like'].minLikes);

                if (minLikes !== Infinity && minLikes > 0) {
                    const uid = msg.userId || msg.uniqueId;
                    const current = (userLikes.get(uid) || 0) + msg.likeCount;
                    if (current >= minLikes) {
                        const triggers = Math.floor(current / minLikes);
                        // Reset to 0 after trigger — don't carry over remainder.
                        // Carrying the remainder caused re-triggers too early on
                        // subsequent like events (e.g. give 1000 → trigger, then
                        // give 10 more → 10 stays, give 1000 again → 1010 >= 1000 → re-triggers).
                        userLikes.set(uid, 0);
                        
                        for (let i = 0; i < triggers; i++) {
                            const mockGift = {
                                ...msg,
                                giftName: 'Like',
                                giftId: 'virtual_like',
                                repeatCount: 1,
                                diamondCount: 0
                            };
                            finalizeGift(mockGift, true);
                        }
                    } else {
                        userLikes.set(uid, current);
                    }
                }
                io.emit('like', injectAvatar(msg));
            });
        });

        socket.on('tiktokDisconnect', () => {
            if (ctx.tiktokConnectionWrapper) {
                ctx.tiktokConnectionWrapper.disconnect();
                ctx.tiktokConnectionWrapper = null;
                ctx.tiktokOwnerSocketId     = null;
                socket.emit('tiktokDisconnected', 'Disconnected by user');
            }
        });

        socket.on('disconnect', () => {
            if (socket.id === ctx.tiktokOwnerSocketId && ctx.tiktokConnectionWrapper) {
                try { ctx.tiktokConnectionWrapper.disconnect(); } catch (e) { /* ignore */ }
                ctx.tiktokConnectionWrapper = null;
                ctx.tiktokOwnerSocketId     = null;
            }
        });
    });

    setInterval(() => {
        io.emit('statistic', { globalConnectionCount: getGlobalConnectionCount() });
    }, 5000);
}

module.exports = { setupSocket };
