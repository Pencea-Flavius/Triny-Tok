process.env.DOTENV_CONFIG_QUIET = 'true';
require('dotenv').config();

const express = require('express');
const { createServer } = require('http');
const { Server } = require('socket.io');
const { TikTokConnectionWrapper, getGlobalConnectionCount } = require('./tiktok/connectionWrapper');
const { clientBlocked } = require('./utils/limiter');
const minecraftBridge = require('./tiktok/minecraftBridge');
const isaacBridge = require('./tiktok/isaacBridge');
const path = require('path');
const fs = require('fs');
const db = require('./database/db_manager');

// read settings
const configPath = path.join(__dirname, '../config/config.json');
// make sure folder exists
const configDir = path.dirname(configPath);
if (!fs.existsSync(configDir)) {
    fs.mkdirSync(configDir, { recursive: true });
}

let config = {
    minecraft: { host: 'localhost', port: 25575, password: '', enabled: false, autoConnect: false },
    isaac: { port: 58431, enabled: true },
    giftCommands: {},
    isaacCommands: {},
    followCommand: { command: "", cooldown: 0 },
    likeCommand: { command: "", minLikes: 100 },
    targetPlayers: []
};

try {
    if (fs.existsSync(configPath)) {
        config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    } else {
        // make default config if empty
        fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
    }
} catch (e) {
    console.error('Failed to load config.json:', e);
}

// get available gifts
let availableGifts = [];

async function initDatabase() {
    try {
        await db.connectGlobal();
        availableGifts = await db.getGifts();
        console.info(`[DB] Loaded ${availableGifts.length} gifts from SQLite.`);
    } catch (e) {
        console.error('[DB] Failed to load gifts from database', e);
    }
}
initDatabase();
const app = express();
const httpServer = createServer(app);

// setup views
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, '../views'));

// let clients connect
const io = new Server(httpServer, {
    cors: {
        origin: '*'
    }
});

const ISAAC_DEFAULT_PROFILES = [
    { id: 'boss_rush',      name: 'Boss Rush',           desc: 'Spawns 3 random bosses',                    category: 'Chaos' },
    { id: 'total_chaos',    name: 'Total Chaos',          desc: '5 items + 10 enemies + all curses at once', category: 'Chaos' },
    { id: 'mob_rush',       name: 'Mob Rush',             desc: '15 random enemies swarm the room',          category: 'Chaos' },
    { id: 'all_curses',     name: 'All Curses',           desc: 'Every floor curse at once',                 category: 'Curses' },
    { id: 'curse_roulette', name: 'Curse Roulette',       desc: 'Random curse applied',                      category: 'Curses' },
    { id: 'labyrinth',      name: 'Curse of the Labyrinth', desc: 'Doubles the current floor',               category: 'Curses' },
    { id: 'near_death',     name: 'Near Death',           desc: 'Reduces to half a heart',                   category: 'Punishment' },
    { id: 'item_yoink',     name: 'Item Yoink',           desc: 'Removes a random held item',                category: 'Punishment' },
    { id: 'nightmare',      name: 'Nightmare',            desc: 'Near death + all curses + enemy wave',      category: 'Punishment' },
    { id: 'upside_down',    name: 'Upside Down',          desc: 'Reversed controls for 30 seconds',          category: 'Timed' },
    { id: 'speed_demon',    name: 'Speed Demon',          desc: 'Double speed for 30 seconds',               category: 'Timed' },
    { id: 'god_mode',       name: 'God Mode',             desc: 'Invincible for 15 seconds',                 category: 'Timed' },
    { id: 'full_heal',      name: 'Full Heal',            desc: 'Restores all health',                       category: 'Boon' },
    { id: 'devil_deal',     name: 'Free Devil Deal',      desc: 'Gives a random devil collectible',          category: 'Boon' },
    { id: 'supply_drop',    name: 'Supply Drop',          desc: '10 coins + 5 bombs + 5 keys',               category: 'Boon' },
    { id: 'jackpot',        name: 'Jackpot',              desc: 'Random item + full heal + supplies',        category: 'Boon' },
];

// broadcast mc status to everyone
minecraftBridge.on('statusChange', (isConnected, errorMsg) => {
    io.emit('minecraftStatus', {
        isConnected,
        config: config.minecraft,
        error: errorMsg || null
    });
});

// broadcast isaac status and profiles
isaacBridge.on('statusChange', (isConnected, errorMsg) => {
    io.emit('isaacStatus', { isConnected, serverActive: !!isaacBridge.server, error: errorMsg || null });
});

isaacBridge.on('profilesUpdated', (profiles) => {
    if (profiles.length > 0) {
        // Only save if profiles actually changed to avoid unnecessary disk I/O and potential loops
        const oldProfilesStr = JSON.stringify(config.isaacProfiles || []);
        const newProfilesStr = JSON.stringify(profiles);
        
        if (oldProfilesStr !== newProfilesStr) {
            console.info(`[Isaac] Profiles changed (${profiles.length}). Saving to config.`);
            config.isaacProfiles = profiles;
            setImmediate(() => {
                try { 
                    fs.writeFileSync(configPath, JSON.stringify(config, null, 2)); 
                } catch (e) { 
                    console.error('[Isaac] Failed to save profiles:', e.message); 
                }
            });
        }
    }
    io.emit('isaacProfiles', profiles.length > 0 ? profiles : (config.isaacProfiles || ISAAC_DEFAULT_PROFILES));
});

isaacBridge.on('result', (data) => {
    io.emit('isaacResult', data);
});


// app state
let trackedDiamonds = 0;
let donorStats = {}; // { userId: { userId, nickname, uniqueId, profilePictureUrl, totalDiamonds, lastGift } }
let initialDonorsSynced = false;
let initialDonorsSum = 0;
let initialTopDonors = [];
let giftCooldowns = new Map(); // { giftName: lastExecutionTime }
let tiktokConnectionWrapper = null;
let tiktokOwnerSocketId = null; // Which socket created the TikTok connection

function upsertDonor(userId, uniqueId, nickname, profilePictureUrl, diamonds, lastGift) {
    let donor = null;
    let key = userId || uniqueId;

    if (userId && donorStats[userId]) {
        donor = donorStats[userId];
    } else if (uniqueId) {
        donor = Object.values(donorStats).find(d => d.uniqueId === uniqueId);
    }

    if (donor) {
        donor.totalDiamonds += parseInt(diamonds);
        if (lastGift) donor.lastGift = lastGift;
        if (nickname && nickname !== 'Unknown') donor.nickname = nickname;
        if (profilePictureUrl) donor.profilePictureUrl = profilePictureUrl;

        if (userId && (!donor.userId || donor.userId.startsWith('init_'))) donor.userId = userId;
        if (uniqueId) donor.uniqueId = uniqueId;

        if (userId && !donorStats[userId]) {
            donorStats[userId] = donor;
        }
    } else {
        key = key || `init_${Math.random()}`;
        donorStats[key] = {
            userId,
            uniqueId,
            nickname: nickname || uniqueId || 'Unknown',
            profilePictureUrl: profilePictureUrl || '',
            totalDiamonds: parseInt(diamonds),
            lastGift: lastGift || ''
        };
        donor = donorStats[key];
    }

    // save to sqlite async
    if (donor.userId && !donor.userId.startsWith('init_') && db) {
        db.upsertUser({
            userId: donor.userId,
            uniqueId: donor.uniqueId,
            nickname: donor.nickname,
            profilePictureUrl: donor.profilePictureUrl,
            addedDiamonds: parseInt(diamonds)
        }).catch(err => console.error('[DB] Failed to upsert user', err));
    }
}

// handle gift logic globally
async function finalizeGift(msg, updateDbAndCommand = true) {
    const totalDiamonds = (msg.diamondCount || 0) * (msg.repeatCount || 1);

    if (totalDiamonds > 0 && updateDbAndCommand) {
        trackedDiamonds += totalDiamonds;
        upsertDonor(msg.userId, msg.uniqueId, msg.nickname, msg.profilePictureUrl, totalDiamonds, msg.giftName);

        // log donation
        if (msg.userId && msg.giftId && db) {
            db.recordDonation(msg.userId, msg.giftId, msg.repeatCount || 1, totalDiamonds)
                .catch(err => console.error('[DB] Failed to record donation', err));
        }

        // auto learn new gifts
        const exists = availableGifts.find(g => g.id === msg.giftId);
        if (!exists && msg.giftId && msg.giftName && db) {
            const newGift = {
                id: msg.giftId,
                name: msg.giftName,
                diamondCount: msg.diamondCount || 0,
                imageUrl: (msg.giftDetails && msg.giftDetails.giftImage && msg.giftDetails.giftImage.urlList && msg.giftDetails.giftImage.urlList[0]) || msg.giftPictureUrl || ''
            };
            availableGifts.push(newGift); // update local ram
            io.emit('giftsUpdated');      // tell frontend
            db.upsertGift(newGift).then(() => {
                console.info(`[DB] Auto-learned new gift: ${msg.giftName}`);
            }).catch(err => console.error('[DB] Failed to learn new gift', err));
        }
    }

    io.emit('gift', msg);
    io.emit('statUpdate', { trackedDiamonds, initialDonorsSynced, initialDonorsSum });

    if (!updateDbAndCommand) return;

    const giftCmd = config.giftCommands[msg.giftName];
    if (giftCmd && minecraftBridge.isConnected) {
        const now = Date.now();
        const cooldown = (typeof giftCmd === 'object' && giftCmd.cooldown !== undefined) ? giftCmd.cooldown * 1000 : 0;

        if (cooldown > 0 && giftCooldowns.has(msg.giftName) && (now - giftCooldowns.get(msg.giftName)) < cooldown) {
            console.info(`[Gift] Cooldown active for ${msg.giftName}. Skipping command.`);
            return;
        }

        let cmds = [];
        if (typeof giftCmd === 'string') cmds = [giftCmd];
        else if (typeof giftCmd.command === 'string') cmds = giftCmd.command.split('\n');
        else if (Array.isArray(giftCmd.command)) cmds = giftCmd.command;
        else if (giftCmd.command) cmds = [giftCmd.command];

        const sender = msg.nickname || msg.uniqueId;
        const executions = giftCmd.waitForStreak === false ? (msg.repeatCount || 1) : 1;
        const countPlaceholder = giftCmd.waitForStreak === false ? 1 : (msg.repeatCount || 1);
        const delayMs = (giftCmd.executeDelay || 0.2) * 1000;

        for (let i = 0; i < executions; i++) {
            for (const cmd of cmds) {
                if (!cmd.trim()) continue;

                const targets = config.targetPlayers || [];
                const randomPlayer = targets.length > 0 ? targets[Math.floor(Math.random() * targets.length)] : 'Player';

                const finalCmd = cmd
                    .replace(/\{username\}/g, msg.uniqueId || 'Unknown')
                    .replace(/\{nickname\}/g, msg.nickname || 'Unknown')
                    .replace(/\{giftname\}/g, msg.giftName || 'Gift')
                    .replace(/\{playername\}/g, randomPlayer)
                    .replace(/\{count\}/g, countPlaceholder);

                // Capture response and emit to UI
                const response = await minecraftBridge.sendCommand(finalCmd);
                if (response !== null) {
                    io.emit('rconLog', { command: finalCmd, response: response, type: 'gift', giftName: msg.giftName });
                }
            }
            console.info(`[Gift] Triggered command for ${msg.giftName} (Exec: ${i + 1}/${executions}) from ${sender}`);

            if (executions > 1 && i < executions - 1) {
                await new Promise(resolve => setTimeout(resolve, delayMs));
            }
        }
        giftCooldowns.set(msg.giftName, Date.now());
    }

    // Isaac profile trigger
    const isaacProfileId = config.isaacCommands[msg.giftName];
    if (isaacProfileId && isaacBridge.isConnected) {
        const sent = isaacBridge.activateProfile(isaacProfileId, msg.nickname || msg.uniqueId, msg.giftName);
        if (sent) {
            console.info(`[Isaac] Activated profile "${isaacProfileId}" for gift "${msg.giftName}"`);
            io.emit('isaacLog', { profileId: isaacProfileId, giftName: msg.giftName, viewer: msg.nickname || msg.uniqueId });
        }
    }
}

io.on('connection', (socket) => {
    console.info('New connection from origin', socket.handshake.headers['origin'] || socket.handshake.headers['referer']);

    // send current stats over
    socket.emit('statUpdate', { trackedDiamonds, initialDonorsSynced, initialDonorsSum });
    socket.emit('minecraftStatus', { isConnected: minecraftBridge.isConnected, config: config.minecraft });
    socket.emit('isaacStatus', { isConnected: isaacBridge.isConnected, serverActive: !!isaacBridge.server });
    socket.emit('isaacProfiles', isaacBridge.profiles.length > 0 ? isaacBridge.profiles : (config.isaacProfiles || ISAAC_DEFAULT_PROFILES));

    // rcon settings
    socket.on('minecraftConnect', (data) => {
        // save config so it persists
        config.minecraft.host = data.host;
        config.minecraft.port = data.port;
        config.minecraft.password = data.password;
        if (data.autoConnect !== undefined) config.minecraft.autoConnect = data.autoConnect;
        fs.writeFileSync(configPath, JSON.stringify(config, null, 2));

        minecraftBridge.connect(data.host, data.port, data.password, data.autoConnect).then(() => {
            config.minecraft.enabled = true;
            fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
        }).catch(err => {
            socket.emit('minecraftError', err.message);
        });
    });

    socket.on('minecraftDisconnect', () => {
        minecraftBridge.disconnect();
        config.minecraft.enabled = false;
        fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
        io.emit('minecraftStatus', { isConnected: false, config: config.minecraft });
    });

    socket.on('isaacStart', () => {
        isaacBridge.start(config.isaac?.port || 58430);
        io.emit('isaacStatus', { isConnected: isaacBridge.isConnected, serverActive: true });
    });

    socket.on('isaacStop', () => {
        isaacBridge.stop();
        io.emit('isaacStatus', { isConnected: false, serverActive: false });
    });

    socket.on('testCommand', async (data) => {
        const giftName = data.giftName;
        const giftCmd = config.giftCommands[giftName];

        if (giftCmd && minecraftBridge.isConnected) {
            let cmds = [];
            if (typeof giftCmd === 'string') cmds = [giftCmd];
            else if (typeof giftCmd.command === 'string') cmds = giftCmd.command.split('\n');
            else if (Array.isArray(giftCmd.command)) cmds = giftCmd.command;
            else if (giftCmd.command) cmds = [giftCmd.command];

            const sender = 'Tester';
            for (const cmd of cmds) {
                if (!cmd.trim()) continue;
                const finalCmd = cmd.replace('{username}', sender);
                const response = await minecraftBridge.sendCommand(finalCmd);
                if (response !== null) {
                    socket.emit('rconLog', { command: finalCmd, response: response, type: 'test' });
                }
            }
            console.info(`[Test] Triggered command for ${giftName}`);
        }
    });

    socket.on('rconCommand', async (command) => {
        if (minecraftBridge.isConnected) {
            const response = await minecraftBridge.sendCommand(command);
            socket.emit('rconLog', { command: command, response: response || 'No response', type: 'manual' });
        } else {
            socket.emit('rconLog', { command: command, response: 'Bridge not connected', type: 'error' });
        }
    });

    socket.on('setUniqueId', (uniqueId, options) => {
        // clear old state
        trackedDiamonds = 0;
        donorStats = {};
        initialDonorsSynced = false;
        initialDonorsSum = 0;
        initialTopDonors = [];

        // broadcast reset
        io.emit('statUpdate', { trackedDiamonds, initialDonorsSynced, initialDonorsSum });

        // sanitize options
        if (typeof options === 'object' && options) {
            delete options.requestOptions;
            delete options.websocketOptions;
        } else {
            options = {};
        }

        // Initialize user-specific isolated database
        db.connectStreamer(uniqueId).then(() => {
            console.log(`[DB] Streamer context switched to @${uniqueId}`);
        }).catch(err => {
            console.error(`[DB] Failed switching to streamer @${uniqueId}`);
        });

        // tiktok locked this, disable it so we dont crash
        options.enableExtendedGiftInfo = false;

        if (process.env.SESSIONID) {
            options.sessionId = process.env.SESSIONID;
        }

        if (process.env.ENABLE_RATE_LIMIT && clientBlocked(io, socket)) {
            socket.emit('tiktokDisconnected', 'Rate limit exceeded.');
            return;
        }

        // kick old session
        if (tiktokConnectionWrapper) {
            try {
                tiktokConnectionWrapper.disconnect();
            } catch (e) { }
        }

        try {
            tiktokConnectionWrapper = new TikTokConnectionWrapper(uniqueId, options, true);
            tiktokOwnerSocketId = socket.id; // Mark this socket as TikTok owner
            tiktokConnectionWrapper.connect();
        } catch (err) {
            socket.emit('tiktokDisconnected', err.toString());
            return;
        }

        tiktokConnectionWrapper.once('connected', state => {
            socket.emit('tiktokConnected', state);

            /* 
            // SYNC ALL AVAILABLE GIFTS (Blocked by TikTok (403) without premium auth)
            tiktokConnectionWrapper.connection.fetchAvailableGifts()
                .then(gifts => {
                    if (Array.isArray(gifts)) {
                        let updated = false;
                        gifts.forEach(gift => {
                            const exists = availableGifts.find(g => g.id === gift.id || g.name === gift.name);
                            if (!exists) {
                                availableGifts.push({ id: gift.id, name: gift.name, diamond_count: gift.diamond_count, image: { url_list: gift.image?.url_list || [] } });
                                updated = true;
                            } else {
                                // Update metadata if changed
                                if (exists.name !== gift.name || exists.diamond_count !== gift.diamond_count) {
                                    exists.name = gift.name;
                                    exists.diamond_count = gift.diamond_count;
                                    exists.image = { url_list: gift.image?.url_list || [] };
                                    updated = true;
                                }
                            }
                        });
                        if (updated) { saveGiftsCache(); io.emit('giftsUpdated'); }
                    }
                })
                .catch(err => console.error('Failed to sync gifts:', err));
            */

            // NOTE: Extended gift info is disabled to prevent 403 on connection.
            // Gifts are loaded from local data/gifts-cache.json instead.

            // grab top donors
            const roomData = state.roomInfo?.data || state.roomInfo || state.data || state;
            const fans = roomData.top_fans || roomData.topFans || [];
            initialDonorsSum = 0;
            initialTopDonors = [];
            if (Array.isArray(fans)) {
                fans.forEach(f => {
                    const diamonds = parseInt(f.fan_ticket || f.fanTicket || 0);
                    initialDonorsSum += diamonds;
                    const user = f.user || {};
                    initialTopDonors.push({
                        userId: user.user_id || user.userId || f.userId || `init_${Math.random()}`,
                        nickname: user.nickname || user.displayId || 'Unknown',
                        uniqueId: user.display_id || user.uniqueId || user.displayId || 'Unknown',
                        profilePictureUrl: user.avatar_thumb?.url_list?.[0] || user.profilePictureUrl || '',
                        totalDiamonds: diamonds
                    });
                });
            }
            io.emit('statUpdate', { initialDonorsSum });
        });

        tiktokConnectionWrapper.once('disconnected', reason => io.emit('tiktokDisconnected', reason));
        tiktokConnectionWrapper.connection.on('streamEnd', () => io.emit('streamEnd'));

        // forward events to users
        tiktokConnectionWrapper.connection.on('roomUser', msg => io.emit('roomUser', msg));
        tiktokConnectionWrapper.connection.on('member', msg => io.emit('member', msg));
        tiktokConnectionWrapper.connection.on('chat', msg => io.emit('chat', msg));
        tiktokConnectionWrapper.connection.on('subscribe', msg => io.emit('subscribe', msg));

        const activeStreaks = new Map();
        tiktokConnectionWrapper.connection.on('gift', msg => {
            const streakId = `${msg.userId}_${msg.giftId}`;

            if (msg.giftType === 1) {
                if (activeStreaks.has(streakId)) clearTimeout(activeStreaks.get(streakId).timeout);

                // show streaks as they happen so ui looks smooth
                if (!msg.repeatEnd) {
                    io.emit('gift', msg);
                }

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

        tiktokConnectionWrapper.connection.on('social', msg => {
            if (msg.type === 'follow') {
                const followCmd = config.followCommand;
                if (followCmd && followCmd.command && minecraftBridge.isConnected) {
                    const sender = msg.nickname || msg.uniqueId;
                    let cmds = typeof followCmd.command === 'string' ? followCmd.command.split('\n') : [followCmd.command];
                    cmds.forEach(cmd => {
                        if (!cmd.trim()) return;

                        const targets = config.targetPlayers || [];
                        const randomPlayer = targets.length > 0 ? targets[Math.floor(Math.random() * targets.length)] : 'Player';

                        const finalCmd = cmd
                            .replace(/\{username\}/g, msg.uniqueId || 'Unknown')
                            .replace(/\{nickname\}/g, msg.nickname || 'Unknown')
                            .replace(/\{giftname\}/g, 'Follow')
                            .replace(/\{playername\}/g, randomPlayer)
                            .replace(/\{count\}/g, 1);

                        minecraftBridge.sendCommand(finalCmd, sender);
                    });
                }
            }
            io.emit('social', msg);
        });

        let currentLikes = 0;
        tiktokConnectionWrapper.connection.on('like', msg => {
            const likeCmd = config.likeCommand;
            if (likeCmd && likeCmd.command && likeCmd.minLikes > 0 && minecraftBridge.isConnected) {
                currentLikes += msg.likeCount;
                if (currentLikes >= likeCmd.minLikes) {
                    const triggerCount = Math.floor(currentLikes / likeCmd.minLikes);
                    currentLikes %= likeCmd.minLikes;
                    const sender = msg.nickname || msg.uniqueId;
                    let cmds = typeof likeCmd.command === 'string' ? likeCmd.command.split('\n') : [likeCmd.command];
                    for (let i = 0; i < triggerCount; i++) {
                        cmds.forEach(cmd => {
                            if (!cmd.trim()) return;

                            const targets = config.targetPlayers || [];
                            const randomPlayer = targets.length > 0 ? targets[Math.floor(Math.random() * targets.length)] : 'Player';

                            const finalCmd = cmd
                                .replace(/\{username\}/g, msg.uniqueId || 'Unknown')
                                .replace(/\{nickname\}/g, msg.nickname || 'Unknown')
                                .replace(/\{giftname\}/g, 'Like')
                                .replace(/\{playername\}/g, randomPlayer)
                                .replace(/\{count\}/g, currentLikes);

                            minecraftBridge.sendCommand(finalCmd, sender);
                        });
                    }
                }
            }
            io.emit('like', msg);
        });
    });

    // only the owner socket can kill the connection
    socket.on('disconnect', () => {
        if (socket.id === tiktokOwnerSocketId && tiktokConnectionWrapper) {
            try { tiktokConnectionWrapper.disconnect(); } catch (e) { }
            tiktokConnectionWrapper = null;
            tiktokOwnerSocketId = null;
        }
    });
});

// web routes
app.get('/api/top-donors', (req, res) => {
    const donors = Array.from(new Set(Object.values(donorStats)))
        .sort((a, b) => b.totalDiamonds - a.totalDiamonds)
        .slice(0, 50);
    res.json({ success: true, donors });
});

app.get('/api/demo-users', async (req, res) => {
    try {
        const dbInstance = await db.connect();
        const users = await dbInstance.all(
            `SELECT * FROM users WHERE uniqueId IN ("zzflaviusboss", "alexnon3", "ghinescumarius298", "memenorul20", "gtrap_", "umbrahero")`
        );
        res.json({ success: true, users });
    } catch (e) {
        res.json({ success: false, users: [] });
    }
});

app.get('/api/donation-stats', (req, res) => {
    res.json({ success: true, trackedDiamonds, initialDonorsSum, initialDonorsSynced });
});

app.post('/api/sync-initial', (req, res) => {
    if (!initialDonorsSynced) {
        trackedDiamonds += initialDonorsSum;

        // sync each donor to ram
        initialTopDonors.forEach(donor => {
            if (donor.userId || donor.uniqueId) {
                upsertDonor(donor.userId, donor.uniqueId, donor.nickname, donor.profilePictureUrl, donor.totalDiamonds, 'Initial Sync');
            }
        });

        initialDonorsSynced = true;
        io.emit('statUpdate', { trackedDiamonds, initialDonorsSynced });
        res.json({ success: true, added: initialDonorsSum });
    } else {
        res.json({ success: false, error: 'Already synced' });
    }
});

// command settings api
app.get('/api/commands', (req, res) => {
    res.json({ success: true, commands: config.giftCommands, followCommand: config.followCommand, likeCommand: config.likeCommand });
});

app.post('/api/commands', express.json(), (req, res) => {
    const { giftName, oldGiftName, command, action, followCommand, likeCommand } = req.body;

    if (followCommand) config.followCommand = followCommand;
    if (likeCommand) config.likeCommand = likeCommand;

    if (giftName) {
        if (action === 'delete') {
            delete config.giftCommands[giftName];
        } else {
            // clean up old name if they renamed
            if (oldGiftName && oldGiftName !== giftName) {
                delete config.giftCommands[oldGiftName];
            }

            // save complex obj or simple string
            if (typeof command === 'object') {
                config.giftCommands[giftName] = command;
            } else {
                config.giftCommands[giftName] = { command };
            }
        }
    }

    try {
        fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
        res.json({ success: true, commands: config.giftCommands, followCommand: config.followCommand, likeCommand: config.likeCommand });
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

app.get('/api/gifts', (req, res) => {
    // fix the db format to match what the frontend expects
    const normalized = availableGifts.map(g => ({
        id: g.id,
        name: g.name,
        diamond_count: g.diamond_count ?? g.diamondCount ?? 0,
        image: { url_list: g.imageUrl ? [g.imageUrl] : (g.image?.url_list || []) }
    }));
    res.json({ success: true, gifts: normalized });
});

// delete gift from db
app.delete('/api/gifts/:id', async (req, res) => {
    try {
        const giftIdParam = req.params.id;
        const giftId = parseInt(giftIdParam);
        let deleted = false;

        // delete by id
        if (!isNaN(giftId)) {
            const changes = await db.deleteGift(giftId);
            if (changes > 0) deleted = true;
        }

        // fallback find by name
        const cacheIdx = availableGifts.findIndex(g => String(g.id) === String(giftIdParam));
        if (cacheIdx !== -1) {
            // If DB delete didn't work, try by the gift name stored in cache
            if (!deleted && db) {
                const giftName = availableGifts[cacheIdx].name;
                const dbConn = await db.connect();
                const result = await dbConn.run(`DELETE FROM gifts WHERE name = ?`, [giftName]);
                if (result.changes > 0) deleted = true;
            }
            availableGifts.splice(cacheIdx, 1);
            deleted = true; // Removed from cache at minimum
        }

        if (deleted) {
            res.json({ success: true });
        } else {
            res.status(404).json({ success: false, error: 'Gift not found in database or cache' });
        }
    } catch (e) {
        console.error('[DELETE /api/gifts]', e);
        res.status(500).json({ success: false, error: e.message });
    }
});

app.get('/api/config', (req, res) => {
    res.json({ success: true, config });
});

app.post('/api/config', express.json(), (req, res) => {
    config = { ...config, ...req.body };
    try {
        fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
        res.json({ success: true, config });
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

// Isaac API routes
app.get('/api/isaac/profiles', (req, res) => {
    const profiles = isaacBridge.profiles.length > 0 ? isaacBridge.profiles : (config.isaacProfiles || ISAAC_DEFAULT_PROFILES);
    res.json({ success: true, profiles });
});

app.get('/api/isaac/commands', (req, res) => {
    res.json({ success: true, commands: config.isaacCommands || {} });
});

app.post('/api/isaac/commands', express.json(), (req, res) => {
    const { giftName, effectId, action } = req.body;
    if (!config.isaacCommands) config.isaacCommands = {};

    if (action === 'delete' && giftName) {
        delete config.isaacCommands[giftName];
    } else if (giftName && effectId) {
        config.isaacCommands[giftName] = effectId;
    }

    try {
        fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
        res.json({ success: true, commands: config.isaacCommands });
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

app.post('/api/isaac/test', express.json(), (req, res) => {
    const { giftName } = req.body;
    console.info(`[Isaac] Test requested for gift: "${giftName}"`);

    if (!config.isaacCommands) {
        console.error('[Isaac] No commands configured in config.json');
        return res.status(404).json({ success: false, error: 'No Isaac commands configured' });
    }
    
    const effect = config.isaacCommands[giftName];
    if (effect) {
        console.info(`[Isaac] Found effect for "${giftName}":`, effect);
        const success = isaacBridge.activateProfile(effect, 'TestUser', giftName);
        if (success) {
            res.json({ success: true });
        } else {
            console.error('[Isaac] Isaac mod is not connected!');
            res.status(503).json({ success: false, error: 'Isaac mod not connected' });
        }
    } else {
        console.error(`[Isaac] Effect not found for gift "${giftName}". Available:`, Object.keys(config.isaacCommands));
        res.status(404).json({ success: false, error: 'Effect not found for this gift' });
    }
});

// Emit global stats
setInterval(() => {
    io.emit('statistic', { globalConnectionCount: getGlobalConnectionCount() });
}, 5000);

// Homepage (marketing landing page)
app.get('/', (req, res) => {
    res.render('index');
});

// App (tracker tool) — catch-all so /app/* routes work with client-side history API
app.get('/app', (req, res) => res.render('app'));
app.get('/app/{*path}', (req, res) => res.render('app'));

app.use(express.static(path.join(__dirname, '../public')));

const port = process.env.PORT || 8081;
httpServer.listen(port, () => {
    console.info(`Server running! Please visit http://localhost:${port}`);

    // Auto-connect Minecraft if enabled
    // Auto-connect Minecraft if enabled and if autoConnect is explicitly true
    if (config.minecraft.autoConnect) {
        // we can set config.minecraft.enabled back to true since it automatically tried.
        config.minecraft.enabled = true;
        minecraftBridge.connect(config.minecraft.host, config.minecraft.port, config.minecraft.password, config.minecraft.autoConnect).then(() => {
            io.emit('minecraftStatus', { isConnected: true, config: config.minecraft });
        }).catch(() => { });
    } else {
        // Make sure UI sees disconnected if they disable autoConnect
        config.minecraft.enabled = false;
    }
});
