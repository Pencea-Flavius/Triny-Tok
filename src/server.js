process.env.DOTENV_CONFIG_QUIET = 'true';
require('dotenv').config();

const express = require('express');
const { createServer } = require('http');
const { Server } = require('socket.io');
const { TikTokConnectionWrapper, getGlobalConnectionCount } = require('./tiktok/connectionWrapper');
const { clientBlocked } = require('./utils/limiter');
const minecraftBridge = require('./tiktok/minecraftBridge');
const path = require('path');
const fs = require('fs');
const db = require('./database/db_manager');

// Load Config
const configPath = path.join(__dirname, '../config/config.json');
// Ensure config directory exists
const configDir = path.dirname(configPath);
if (!fs.existsSync(configDir)) {
    fs.mkdirSync(configDir, { recursive: true });
}

let config = {
    minecraft: { host: 'localhost', port: 25575, password: '', enabled: false },
    giftCommands: {},
    followCommand: { command: "", cooldown: 0 },
    likeCommand: { command: "", minLikes: 100 }
};

try {
    if (fs.existsSync(configPath)) {
        config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    } else {
        // Create default config file if it doesn't exist
        fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
    }
} catch (e) {
    console.error('Failed to load config.json:', e);
}

// Load Gifts from DB
let availableGifts = [];

async function initDatabase() {
    try {
        await db.connect();
        availableGifts = await db.getGifts();
        console.info(`[DB] Loaded ${availableGifts.length} gifts from SQLite.`);
    } catch (e) {
        console.error('[DB] Failed to load gifts from database', e);
    }
}
initDatabase();
const app = express();
const httpServer = createServer(app);

// Enable cross origin resource sharing
const io = new Server(httpServer, {
    cors: {
        origin: '*'
    }
});

// Listen to Minecraft Connection Status and update clients
minecraftBridge.on('statusChange', (isConnected, errorMsg) => {
    io.emit('minecraftStatus', { 
        isConnected, 
        config: config.minecraft, 
        error: errorMsg || null 
    });
});


// Tracking State
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

    // Persist to Database asynchronously
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

// Helper function for gift processing, moved to global scope
function finalizeGift(msg) {
    const totalDiamonds = (msg.diamondCount || 0) * (msg.repeatCount || 1);

    if (totalDiamonds > 0) {
        trackedDiamonds += totalDiamonds;
        upsertDonor(msg.userId, msg.uniqueId, msg.nickname, msg.profilePictureUrl, totalDiamonds, msg.giftName);
        
        // Persist Donation Record
        if (msg.userId && msg.giftId && db) {
            db.recordDonation(msg.userId, msg.giftId, msg.repeatCount || 1, totalDiamonds)
              .catch(err => console.error('[DB] Failed to record donation', err));
        }

        // Auto-Learning: If this gift is new, add it to DB and cache
        const exists = availableGifts.find(g => g.id === msg.giftId);
        if (!exists && msg.giftId && msg.giftName && db) {
            const newGift = {
                id: msg.giftId,
                name: msg.giftName,
                diamondCount: msg.diamondCount || 0,
                imageUrl: (msg.giftDetails && msg.giftDetails.giftImage && msg.giftDetails.giftImage.urlList && msg.giftDetails.giftImage.urlList[0]) || msg.giftPictureUrl || ''
            };
            availableGifts.push(newGift); // Update cache locally
            io.emit('giftsUpdated');      // Notify UI
            db.upsertGift(newGift).then(() => {
                console.info(`[DB] Auto-learned new gift: ${msg.giftName}`);
            }).catch(err => console.error('[DB] Failed to learn new gift', err));
        }
    }

    io.emit('gift', msg);
    io.emit('statUpdate', { trackedDiamonds, initialDonorsSynced, initialDonorsSum });

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
        cmds.forEach(cmd => {
            if (!cmd.trim()) return;
            // Use msg.repeatCount in command replacement if needed, though usually it's handled by trigger frequency
            // But here we trigger it once at end of streak, so we might want to pass the count
            const finalCmd = cmd.replace('{username}', sender).replace('{count}', msg.repeatCount || 1);
            minecraftBridge.sendCommand(finalCmd, sender);
        });
        console.info(`[Gift] Triggered command for ${msg.giftName} (x${msg.repeatCount || 1}) from ${sender}`);
        giftCooldowns.set(msg.giftName, now);
    }
}

io.on('connection', (socket) => {
    console.info('New connection from origin', socket.handshake.headers['origin'] || socket.handshake.headers['referer']);

    // Emit initial stats and config to new client
    socket.emit('statUpdate', { trackedDiamonds, initialDonorsSynced, initialDonorsSum });
    socket.emit('minecraftStatus', { isConnected: minecraftBridge.isConnected, config: config.minecraft });

    // Minecraft Control
    socket.on('minecraftConnect', (data) => {
        // Save settings immediately so they are not lost on error
        config.minecraft.host = data.host;
        config.minecraft.port = data.port;
        config.minecraft.password = data.password;
        fs.writeFileSync(configPath, JSON.stringify(config, null, 2));

        minecraftBridge.connect(data.host, data.port, data.password).then(() => {
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

    socket.on('testCommand', (data) => {
        const giftName = data.giftName;
        const giftCmd = config.giftCommands[giftName];

        if (giftCmd && minecraftBridge.isConnected) {
            let cmds = [];
            if (typeof giftCmd === 'string') cmds = [giftCmd];
            else if (typeof giftCmd.command === 'string') cmds = giftCmd.command.split('\n');
            else if (Array.isArray(giftCmd.command)) cmds = giftCmd.command;
            else if (giftCmd.command) cmds = [giftCmd.command];

            const sender = 'Tester';
            cmds.forEach(cmd => {
                if (!cmd.trim()) return;
                minecraftBridge.sendCommand(cmd.replace('{username}', sender), sender);
            });
            console.info(`[Test] Triggered command for ${giftName}`);
        }
    });

    socket.on('setUniqueId', (uniqueId, options) => {
        // RESET TRACKING STATE FOR NEW SESSION
        trackedDiamonds = 0;
        donorStats = {};
        initialDonorsSynced = false;
        initialDonorsSum = 0;
        initialTopDonors = [];

        // Notify ALL clients of reset stats immediately
        io.emit('statUpdate', { trackedDiamonds, initialDonorsSynced, initialDonorsSum });

        // Security check
        if (typeof options === 'object' && options) {
            delete options.requestOptions;
            delete options.websocketOptions;
        } else {
            options = {};
        }

        // Force disable extended gift info to prevent 403 connection crash (TikTok locked this endpoint)
        options.enableExtendedGiftInfo = false;

        if (process.env.SESSIONID) {
            options.sessionId = process.env.SESSIONID;
        }

        if (process.env.ENABLE_RATE_LIMIT && clientBlocked(io, socket)) {
            socket.emit('tiktokDisconnected', 'Rate limit exceeded.');
            return;
        }

        // DISCONNECT OLD WRAPPER IF EXISTS
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

            // Initial Top Donors Extraction
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

        // GLOBAL TIKTOK EVENT HANDLERS (EMIT TO ALL)
        tiktokConnectionWrapper.connection.on('roomUser', msg => io.emit('roomUser', msg));
        tiktokConnectionWrapper.connection.on('member', msg => io.emit('member', msg));
        tiktokConnectionWrapper.connection.on('chat', msg => io.emit('chat', msg));
        tiktokConnectionWrapper.connection.on('subscribe', msg => io.emit('subscribe', msg));

        const activeStreaks = new Map();
        tiktokConnectionWrapper.connection.on('gift', msg => {
            const streakId = `${msg.userId}_${msg.giftId}`;
            const giftCmd = config.giftCommands[msg.giftName];
            const waitForStreak = (typeof giftCmd === 'object' && giftCmd.waitForStreak !== undefined) ? giftCmd.waitForStreak : true;

            if (msg.giftType === 1 && waitForStreak) {
                if (activeStreaks.has(streakId)) clearTimeout(activeStreaks.get(streakId).timeout);
                if (msg.repeatEnd) {
                    finalizeGift(msg);
                    activeStreaks.delete(streakId);
                } else {
                    const timeout = setTimeout(() => {
                        if (activeStreaks.has(streakId)) {
                            finalizeGift(activeStreaks.get(streakId).msg);
                            activeStreaks.delete(streakId);
                        }
                    }, 10000);
                    activeStreaks.set(streakId, { timeout, msg });
                }
            } else {
                finalizeGift(msg);
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
                        minecraftBridge.sendCommand(cmd.replace('{username}', sender), sender);
                    });
                }
            }
            io.emit('social', msg);
        });

        let currentLikes = 0;
        tiktokConnectionWrapper.connection.on('like', msg =>{
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
                            minecraftBridge.sendCommand(cmd.replace('{username}', sender), sender);
                        });
                    }
                }
            }
            io.emit('like', msg);
        });
    });

    // Only the socket that created the TikTok connection should clean it up
    socket.on('disconnect', () => {
        if (socket.id === tiktokOwnerSocketId && tiktokConnectionWrapper) {
            try { tiktokConnectionWrapper.disconnect(); } catch (e) {}
            tiktokConnectionWrapper = null;
            tiktokOwnerSocketId = null;
        }
    });
});

// API Endpoints for UI
app.get('/api/top-donors', (req, res) => {
    const donors = Array.from(new Set(Object.values(donorStats)))
        .sort((a, b) => b.totalDiamonds - a.totalDiamonds)
        .slice(0, 50);
    res.json({ success: true, donors });
});

app.get('/api/donation-stats', (req, res) => {
    res.json({ success: true, trackedDiamonds, initialDonorsSum, initialDonorsSynced });
});

app.post('/api/sync-initial', (req, res) => {
    if (!initialDonorsSynced) {
        trackedDiamonds += initialDonorsSum;

        // Sync individual donors into donorStats
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

// Command Management API
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
            // Renaming logic
            if (oldGiftName && oldGiftName !== giftName) {
                delete config.giftCommands[oldGiftName];
            }

            // Support detailed objects
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
    // Normalize DB format (camelCase) to frontend format (snake_case / nested image)
    const normalized = availableGifts.map(g => ({
        id: g.id,
        name: g.name,
        diamond_count: g.diamond_count ?? g.diamondCount ?? 0,
        image: { url_list: g.imageUrl ? [g.imageUrl] : (g.image?.url_list || []) }
    }));
    res.json({ success: true, gifts: normalized });
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

// Emit global stats
setInterval(() => {
    io.emit('statistic', { globalConnectionCount: getGlobalConnectionCount() });
}, 5000);

app.use(express.static(path.join(__dirname, '../public')));

const port = process.env.PORT || 8081;
httpServer.listen(port, () => {
    console.info(`Server running! Please visit http://localhost:${port}`);

    // Auto-connect Minecraft if enabled
    if (config.minecraft.enabled) {
        minecraftBridge.connect(config.minecraft.host, config.minecraft.port).then(() => {
            io.emit('minecraftStatus', { isConnected: true, config: config.minecraft });
        }).catch(() => { });
    }
});
