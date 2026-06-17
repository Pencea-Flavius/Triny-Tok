const ctx            = require('../context');
const db             = require('../database/db_manager');
const minecraftBridge = require('../tiktok/minecraftBridge');
const isaacBridge    = require('../tiktok/isaacBridge');
const repoBridge     = require('../tiktok/repoBridge');
const goiBridge      = require('../tiktok/goiBridge');
const logger         = require('../utils/eventLogger');

// Resolves a REPO effect's targeting mode: prefers the new `target` enum
// ('local' | 'random' | 'all'), falling back to the legacy `targetRandom` bool.
function resolveRepoTarget(effect) {
    if (effect && typeof effect === 'object') {
        if (effect.target === 'local' || effect.target === 'random' || effect.target === 'all') return effect.target;
        if (effect.targetRandom) return 'random';
    }
    return 'local';
}

// Resolve a gift's effect from a {giftName: effect} map, tolerating the fact that
// the live giftName can differ from the catalog/config name (e.g. live "TOFU Cat"
// vs catalog "Tofu"). Tries: exact name -> giftId -> catalog name -> case-insensitive.
// The config/presets stay keyed by gift NAME (so the UI, AI and presets keep
// working), but matching a live gift is anchored on the stable giftId so it never
// breaks when the live name differs from the catalog name (e.g. "TOFU Cat" vs "Tofu").
function resolveEffect(map, msg) {
    if (!map || typeof map !== 'object') return undefined;
    const id = msg.giftId;

    // 1. exact live name
    if (msg.giftName && map[msg.giftName] !== undefined) return map[msg.giftName];

    // 2. by id - anchor each configured gift on its own catalog id and compare.
    //    Catalog never renames an existing id, so config "Tofu" -> id 10604 == live id.
    if (id != null) {
        for (const key of Object.keys(map)) {
            const cat = ctx.availableGifts.find(g => g.name === key);
            if (cat && cat.id === id) return map[key];
        }
        // 2b. live id -> catalog name -> map (config keyed under a name variant)
        const byId = ctx.availableGifts.find(g => g.id === id);
        if (byId && map[byId.name] !== undefined) return map[byId.name];
    }

    // 3. case-insensitive name as a last resort
    if (msg.giftName) {
        const lower = msg.giftName.toLowerCase();
        const key = Object.keys(map).find(k => k.toLowerCase() === lower);
        if (key) return map[key];
    }
    return undefined;
}

const DEFAULT_AVATAR = 'https://www.tiktok.com/static/images/avatar_default.png';

// No more unavatar.io. Viewers' avatars come from the real TikTok CDN url in their
// events; when we don't have one we just use the default placeholder.
function avatarUrl() {
    return DEFAULT_AVATAR;
}

function injectAvatar(msg) {
    if (!msg) return msg;
    if (msg.profilePictureUrl && msg.profilePictureUrl.includes('tiktokcdn.com')) return msg;
    const uid = msg.uniqueId || (msg.user && (msg.user.uniqueId || msg.user.displayId)) || 'Unknown';
    msg.profilePictureUrl = msg.profilePictureUrl || avatarUrl(uid);
    if (msg.user && !msg.user.profilePictureUrl) msg.user.profilePictureUrl = msg.profilePictureUrl;
    return msg;
}

function upsertDonor(userId, uniqueId, nickname, profilePictureUrl, diamonds, lastGift) {
    let donor = null;
    let key = userId || uniqueId;

    if (userId && ctx.donorStats[userId]) {
        donor = ctx.donorStats[userId];
    } else if (uniqueId) {
        donor = Object.values(ctx.donorStats).find(d => d.uniqueId === uniqueId);
    }

    if (donor) {
        donor.totalDiamonds += parseInt(diamonds);
        if (lastGift) donor.lastGift = lastGift;
        if (nickname && nickname !== 'Unknown') donor.nickname = nickname;
        if (profilePictureUrl) {
            donor.profilePictureUrl = profilePictureUrl;
        } else if (uniqueId && (!donor.profilePictureUrl || donor.profilePictureUrl.includes('avatar_default'))) {
            donor.profilePictureUrl = avatarUrl(uniqueId);
        }
        if (userId && (!donor.userId || donor.userId.startsWith('init_'))) donor.userId = userId;
        if (uniqueId) donor.uniqueId = uniqueId;
        if (userId && !ctx.donorStats[userId]) ctx.donorStats[userId] = donor;
    } else {
        key = key || `init_${Math.random()}`;
        ctx.donorStats[key] = {
            userId,
            uniqueId,
            nickname: nickname || uniqueId || 'Unknown',
            profilePictureUrl: profilePictureUrl || avatarUrl(uniqueId),
            totalDiamonds: parseInt(diamonds),
            lastGift: lastGift || '',
        };
        donor = ctx.donorStats[key];
    }

    if (donor.userId && !donor.userId.startsWith('init_') && db) {
        db.upsertUser({
            userId: donor.userId,
            uniqueId: donor.uniqueId,
            nickname: donor.nickname,
            addedDiamonds: parseInt(diamonds),
        }).catch(err => console.error('[DB] Failed to upsert user', err));
    }
}

async function finalizeGift(msg, updateDbAndCommand = true) {
    const { config, availableGifts, giftCooldowns, io } = ctx;
    const totalDiamonds = (msg.diamondCount || 0) * (msg.repeatCount || 1);

    logger.logEvent('gift', msg);

    if (totalDiamonds > 0 && updateDbAndCommand) {
        ctx.trackedDiamonds += totalDiamonds;
        upsertDonor(msg.userId, msg.uniqueId, msg.nickname, msg.profilePictureUrl, totalDiamonds, msg.giftName);

        if (msg.userId && msg.giftId && db) {
            db.recordDonation(msg.userId, msg.giftId, msg.repeatCount || 1, totalDiamonds)
                .catch(err => console.error('[DB] Failed to record donation', err));
        }

        const freshImageUrl = (msg.giftDetails?.giftImage?.urlList?.[0]) || msg.giftPictureUrl || '';
        const exists = availableGifts.find(g => g.id === msg.giftId);
        if (!exists && msg.giftId && msg.giftName && db) {
            const newGift = { id: msg.giftId, name: msg.giftName, diamondCount: msg.diamondCount || 0, imageUrl: freshImageUrl };
            availableGifts.push(newGift);
            io.emit('giftsUpdated');
            db.upsertGift(newGift)
                .then(() => console.info(`[DB] Auto-learned new gift: ${msg.giftName}`))
                .catch(err => console.error('[DB] Failed to learn new gift', err));
            if (freshImageUrl) ctx.downloadGiftImage(msg.giftId, freshImageUrl);
        } else if (exists && freshImageUrl && freshImageUrl !== (exists.imageUrl || exists.image?.url_list?.[0] || '')) {
            exists.imageUrl = freshImageUrl;
            if (exists.image) exists.image.url_list = [freshImageUrl];
            io.emit('giftsUpdated');
            if (db && exists.id) {
                db.upsertGift({ id: exists.id, name: exists.name, diamondCount: exists.diamond_count || exists.diamondCount || 0, imageUrl: freshImageUrl })
                    .catch(err => console.error('[DB] Failed to refresh gift image', err));
            }
            ctx.downloadGiftImage(exists.id, freshImageUrl, true);
        }
    }

    injectAvatar(msg);
    io.emit('gift', msg);
    io.emit('statUpdate', {
        trackedDiamonds: ctx.trackedDiamonds,
        initialDonorsSynced: ctx.initialDonorsSynced,
        initialDonorsSum: ctx.initialDonorsSum,
    });

    if (!updateDbAndCommand) return;

    // ── Minecraft gift commands ───────────────────────────────────────────────
    const giftCmd = resolveEffect(config.giftCommands, msg);
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

        const sender           = msg.nickname || msg.uniqueId;
        const executions       = giftCmd.waitForStreak === false ? (msg.repeatCount || 1) : 1;
        const countPlaceholder = giftCmd.waitForStreak === false ? 1 : (msg.repeatCount || 1);
        const delayMs          = (giftCmd.executeDelay || 0.2) * 1000;
        const targets          = config.targetPlayers || [];
        const randomPlayer     = targets.length > 0 ? targets[Math.floor(Math.random() * targets.length)] : 'Player';

        for (let i = 0; i < executions; i++) {
            for (const cmd of cmds) {
                if (!cmd.trim()) continue;
                const finalCmd = cmd
                    .replace(/\{username\}/g,  msg.uniqueId  || 'Unknown')
                    .replace(/\{nickname\}/g,  msg.nickname  || 'Unknown')
                    .replace(/\{giftname\}/g,  msg.giftName  || 'Gift')
                    .replace(/\{playername\}/g, randomPlayer)
                    .replace(/\{count\}/g,     countPlaceholder);
                const response = await minecraftBridge.sendCommand(finalCmd);
                if (response !== null) {
                    io.emit('rconLog', { command: finalCmd, response, type: 'gift', giftName: msg.giftName });
                }
            }
            console.info(`[Gift] Triggered command for ${msg.giftName} (Exec: ${i + 1}/${executions}) from ${sender}`);
            if (executions > 1 && i < executions - 1) await new Promise(r => setTimeout(r, delayMs));
        }
        giftCooldowns.set(msg.giftName, Date.now());
    }

    // ── Isaac ─────────────────────────────────────────────────────────────────
    const isaacEffect = resolveEffect(config.isaacCommands, msg);
    if (isaacEffect && isaacBridge.isConnected) {
        const waitForStreak = (typeof isaacEffect === 'object' && isaacEffect.waitForStreak !== undefined) ? isaacEffect.waitForStreak : true;
        const executions = waitForStreak === false ? (msg.repeatCount || 1) : 1;
        for (let i = 0; i < executions; i++) {
            isaacBridge.activateProfile(isaacEffect, msg.nickname || msg.uniqueId, msg.giftName);
            if (executions > 1 && i < executions - 1) await new Promise(r => setTimeout(r, 200));
        }
        console.info(`[Isaac] Triggered effect for ${msg.giftName} (Exec: ${executions})`);
        io.emit('isaacLog', { effect: isaacEffect, giftName: msg.giftName, viewer: msg.nickname || msg.uniqueId });
    }

    // ── R.E.P.O. ──────────────────────────────────────────────────────────────
    const repoEffect = resolveEffect(config.repoCommands, msg);
    if (repoEffect && repoBridge.isConnected) {
        const code         = typeof repoEffect === 'string' ? repoEffect : repoEffect.code;
        const duration     = (typeof repoEffect === 'object' && repoEffect.duration) ? repoEffect.duration : 0;
        const waitForStreak = (typeof repoEffect === 'object' && repoEffect.waitForStreak !== undefined) ? repoEffect.waitForStreak : true;
        const target       = resolveRepoTarget(repoEffect);
        const count        = (typeof repoEffect === 'object' && repoEffect.count) ? repoEffect.count : 1;
        const executions   = waitForStreak === false ? (msg.repeatCount || 1) : 1;
        for (let i = 0; i < executions; i++) {
            repoBridge.sendEffect(code, msg.nickname || msg.uniqueId, duration, target, count);
            if (executions > 1 && i < executions - 1) await new Promise(r => setTimeout(r, 200));
        }
        console.info(`[Repo] Triggered effect ${code} for ${msg.giftName}`);
        io.emit('repoLog', { code, giftName: msg.giftName, viewer: msg.nickname || msg.uniqueId });
    }

    // ── Getting Over It ───────────────────────────────────────────────────────
    const goiEffect = resolveEffect(config.goiCommands, msg);
    if (goiEffect && goiBridge.isConnected) {
        const goiCode        = typeof goiEffect === 'string' ? goiEffect : goiEffect.code;
        const goiDuration    = (typeof goiEffect === 'object' && goiEffect.duration) ? goiEffect.duration : 0;
        const goiCount       = (typeof goiEffect === 'object' && goiEffect.count) ? goiEffect.count : 1;
        const goiPower       = (typeof goiEffect === 'object' && goiEffect.power) ? goiEffect.power : 0;
        const goiWaitForStreak = (typeof goiEffect === 'object' && goiEffect.waitForStreak !== undefined) ? goiEffect.waitForStreak : true;
        const goiExecutions  = goiWaitForStreak === false ? (msg.repeatCount || 1) : 1;
        for (let i = 0; i < goiExecutions; i++) {
            goiBridge.sendEffect(goiCode, msg.nickname || msg.uniqueId, goiDuration, goiCount, goiPower);
            if (goiExecutions > 1 && i < goiExecutions - 1) await new Promise(r => setTimeout(r, 200));
        }
        console.info(`[GOI] Triggered effect ${goiCode} for ${msg.giftName}`);
        io.emit('goiLog', { code: goiCode, giftName: msg.giftName, viewer: msg.nickname || msg.uniqueId });
    }
}

module.exports = { avatarUrl, injectAvatar, upsertDonor, finalizeGift };
