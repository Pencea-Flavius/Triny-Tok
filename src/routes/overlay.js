const express = require('express');
const router  = express.Router();
const ctx     = require('../context');
const db      = require('../database/db_manager');
const fs      = require('fs');
const path    = require('path');

const KEY_MAP = {
    goi:       'goiCommands',
    minecraft: 'giftCommands',
    isaac:     'isaacCommands',
    repo:      'repoCommands',
};

const GOI_NAMES = {
    launch:'Launch Player', shove_left:'Shove Left', shove_right:'Shove Right',
    reset_progress:'Reset Progress', spawn_hat:'Spawn Hat', spawn_orange:'Spawn Orange',
    spawn_gift:'Spawn Gift', low_gravity:'Low Gravity', high_gravity:'High Gravity',
    zero_gravity:'Zero Gravity', low_friction:'Low Friction', high_friction:'High Friction',
    bouncy:'Bouncy', flip_camera:'Flip Camera', spin_camera:'Spin Camera',
    invert_mouse:'Invert Mouse', big_hammer:'Big Hammer', small_hammer:'Small Hammer',
    rolling_over_it:'Rolling Over It', only_hammer:'Only Hammer',
};

const ISAAC_MISC = {
    chaos_reroll:'Chaos Reroll', boss_rush:'Boss Rush',
    curse_of_darkness:'Curse of Darkness', curse_of_lost:'Curse of the Lost',
    devil_deal:'Devil Deal', angel_deal:'Angel Deal',
};

function formatEffectName(code) {
    if (!code) return '–';
    return code.toString().replace(/_/g, ' ')
               .split(' ')
               .map(w => w.charAt(0).toUpperCase() + w.slice(1))
               .join(' ');
}

function getIsaacBossImage(name) {
    if (!name) return null;
    let cleanName = name.replace(' (Boss)', '');
    if (cleanName === '???') cleanName = 'Blue_Baby';
    cleanName = cleanName.replace(/\?/g, '%3F').replace(/'/g, '%27').replace(/ /g, '_');
    const ingameBosses = ["Ultra_Death", "Ultra_Famine", "Ultra_Pestilence", "Ultra_War", "The_Beast", "Ultra_Greedier"];
    const suffix = ingameBosses.includes(cleanName) ? '_ingame.webp' : '_portrait.webp';
    return `/images/Isaac/Bosses/Boss_${cleanName}${suffix}`;
}

let isaacItemsCache = null;
async function getIsaacItemSprite(conn, itemId) {
    if (!isaacItemsCache && conn) {
        isaacItemsCache = await conn.all('SELECT id FROM isaac_items ORDER BY id ASC');
    }
    if (!isaacItemsCache) return null;
    const id = parseInt(itemId);

    if (id === -1) {
        const momsRingIdx = isaacItemsCache.findIndex(it => it.id === 732);
        let gIdx = (momsRingIdx !== -1 ? momsRingIdx : 731) + 1;
        gIdx++; 
        gIdx++; 
        if (gIdx >= 548) gIdx += 12;
        return { x: -((gIdx % 20) * 44), y: -(Math.floor(gIdx / 20) * 44) };
    }

    const idx = isaacItemsCache.findIndex(it => it.id === id);
    if (idx === -1) return null;
    let gIdx = idx;
    if (id >= 475) gIdx++; 
    if (id >= 649) gIdx++; 
    if (gIdx >= 548) gIdx += 12;
    return { x: -((gIdx % 20) * 44), y: -(Math.floor(gIdx / 20) * 44) };
}

const REPO_NAMES = {
    player_heal: 'Heal', player_hurt: 'Hurt', player_kill: 'Kill', player_refill_energy: 'Refill Stamina', player_drain_energy: 'Drain Stamina',
    player_invincible: 'Invincible', player_infinitestam: 'Infinite Stamina', player_disableinput: 'Disable Input', player_disablecrouch: 'Disable Crouch',
    player_fast: 'Speed Boost', player_slow: 'Slow', player_antigravity: 'Anti Gravity', player_teleport_random: 'TP to Random Player',
    player_teleport_extraction: 'TP to Extraction', player_teleport_truck: 'TP to Truck', player_teleport_room: 'TP to Random Room',
    playerPitch_high: 'High Pitch', playerPitch_low: 'Low Pitch', revive_all: 'Revive All', closeAllDoors: 'Close All Doors',
    increase_haul_goal: 'Increase Quota', decrease_haul_goal: 'Decrease Quota', destroy_random_item: 'Destroy Random Item',
    
    player_upgrade_energy: 'Stamina Upgrade', player_upgrade_health: 'Health Upgrade', player_upgrade_jump: 'Extra Jump',
    player_upgrade_grabrange: 'Grab Range Upgrade', player_upgrade_grabstrength: 'Strength Upgrade', player_upgrade_sprint: 'Sprint Speed Upgrade',
    player_upgrade_tumble: 'Tumble Launch', player_upgrade_tumbleclimb: 'Tumble Climb', player_upgrade_tumblewings: 'Tumble Wings',
    player_upgrade_crouchrest: 'Crouch Rest Upgrade', player_upgrade_battery: 'Battery Upgrade', player_upgrade_map: 'Player Count Upgrade'
};

async function resolveEffect(game, effect, conn) {
    let count = null;
    let duration = null;

    if (typeof effect === 'object') {
        if (effect.count && effect.count > 1) count = effect.count;
        if (effect.duration) duration = effect.duration;
    }

    // GOI
    if (game === 'goi') {
        const code = typeof effect === 'string' ? effect : (effect.code || '');
        return { effectName: GOI_NAMES[code] || code, effectImage: null, count, duration };
    }
    // Minecraft — show first command line
    if (game === 'minecraft') {
        const cmd = typeof effect === 'object'
            ? (Array.isArray(effect.command) ? effect.command[0] : effect.command)
            : effect;
        return { effectName: cmd || '–', effectImage: null, count, duration };
    }
    // Isaac
    if (game === 'isaac') {
        if (typeof effect === 'string')
            return { effectName: ISAAC_MISC[effect] || formatEffectName(effect), effectImage: null, sprite: null, count, duration };

        const action = effect.action || '';
        if ((action === 'use_item' || action === 'spawn_item') && effect.itemId) {
            const id = parseInt(effect.itemId);
            const sprite = conn ? await getIsaacItemSprite(conn, id) : null;
            if (id === -1) return { effectName: 'Random Item', effectImage: null, sprite, count, duration };

            try {
                const row = conn && await conn.get('SELECT name FROM isaac_items WHERE id = ?', [id]);
                if (row) return { effectName: row.name, effectImage: null, sprite, count, duration };
            } catch (_) {}
            return { effectName: `Item #${id}`, effectImage: null, sprite, count, duration };
        }
        if (action === 'spawn_boss' && effect.bossId) {
            try {
                const row = conn && await conn.get('SELECT name FROM isaac_bosses WHERE id = ?', [effect.bossId]);
                if (row) return { effectName: row.name, effectImage: getIsaacBossImage(row.name), sprite: null, count, duration };
            } catch (_) {}
            return { effectName: `Boss #${effect.bossId}`, effectImage: null, sprite: null, count, duration };
        }
        if (action === 'spawn_custom' && effect.entityId) {
            return { effectName: `Spawn ${effect.entityId}`, effectImage: '/images/Isaac/summon.png', sprite: null, count, duration };
        }
        const code = effect.code || action || '';
        return { effectName: ISAAC_MISC[code] || formatEffectName(code), effectImage: null, sprite: null, count, duration };
    }
    // REPO
    if (game === 'repo') {
        const code = typeof effect === 'string' ? effect : (effect.code || '');
        const low  = code.toLowerCase();
        let effectName = code.replace(/_/g, ' ');
        let effectImage = null;

        const repoImgBase = path.join(__dirname, '../../public/images/repo');
        const readDir = (d) => { try { return fs.readdirSync(path.join(repoImgBase, d)); } catch { return []; } };
        const repoItems = readDir('items'), repoEnemies = readDir('enemies'), repoValuables = readDir('valuables');

        const normalize = (s) => s.toLowerCase().replace(/[^a-z0-9]/g, '');

        try {
            if (low.startsWith('spawnenemy_')) {
                const row = conn && await conn.get('SELECT name, in_game_name FROM repo_enemies WHERE id = ?', [code]);
                if (row) {
                    effectName = `Spawn ${row.name}`;
                    const targetName = normalize(row.in_game_name || row.name);
                    let best = null, bestLen = Infinity;
                    for (const f of repoEnemies) {
                        const fn = normalize(f.replace(/\.(png|jpg|gif)$/i, ''));
                        if (fn.startsWith(targetName) || fn.includes(targetName)) {
                            if (f.length < bestLen) { best = f; bestLen = f.length; }
                        }
                    }
                    if (best) effectImage = `/images/repo/enemies/${encodeURIComponent(best)}`;
                }
            } else if (low.startsWith('spawncollectable_')) {
                // First try repo_items
                let row = conn && await conn.get('SELECT name FROM repo_items WHERE id = ?', [code]);
                if (row) {
                    effectName = `Spawn ${row.name}`;
                    const idForImage = code.slice('spawncollectable_'.length);
                    const ITEM_IMAGE = {
                        ItemMeleeBaseballBat: 'Baseball Bat.PNG', ItemGunStun: 'Bolt zap.png', ItemCartCannon: 'C.A.R.T. Canon.png', ItemCartLaser: 'C.A.R.T. Laser.png', ItemCartSmall: 'CartSmall.png', ItemCartMedium: 'CartBig.png', ItemDroneBattery: 'DroneRecharge.png', ItemDroneFeather: 'DroneFeather.png', ItemDroneIndestructible: 'DroneIndestructible.png', ItemDroneTorque: 'DroneRoll.png', ItemDroneZeroGravity: 'DroneZeroGravity.png', ItemDuckBucket: 'Duck Bucket.png', ItemGrenadeDuctTaped: 'GrenadeDuctTaped.png', ItemGrenadeExplosive: 'Grenade.png', ItemGrenadeHuman: 'GrenadeHuman.png', ItemGrenadeShockwave: 'GrenadeShockwave.png', ItemGrenadeStun: 'GrenadeStun.png', ItemGunHandgun: 'GunHandgun.png', ItemGunLaser: 'PhotonBlaster.png', ItemGunShockwave: 'Pulse Pistol R.E.P.O..png', ItemGunShotgun: 'GunShotgun.png', ItemGunTranq: 'GunTranq.png', ItemHealthPackLarge: 'HealthLarge.png', ItemHealthPackMedium: 'HealthMedium.png', ItemHealthPackSmall: 'HealthSmall.png', ItemMeleeFryingPan: 'MeleeFryingPan.png', ItemMeleeInflatableHammer: 'MeleeInflatableHammer.png', ItemMeleeStunBaton: 'Prodzap2.png', ItemMeleeSledgeHammer: 'MeleeSledgeHammer.png', ItemMeleeSword: 'MeleeSword.png', ItemMineExplosive: 'Mine.png', ItemMineShockwave: 'MineShockwave.png', ItemMineStun: 'Trapzap transparent.png', ItemOrbZeroGravity: 'ZeroGravityOrb.png', ItemPhaseBridge: 'Phase Bridge R.E.P.O..png', ItemPowerCrystal: 'EnergyCrystal.png', ItemReviveItem: 'Defibroo.png', ItemRubberDuck: 'RubberDuck.png', ItemStaffTorque: 'RollStaff.png', ItemStaffVoid: 'VoidStaff.png', ItemStaffZeroGravity: 'ZeroGravityStaff.png', ItemUpgradeDeathHeadBattery: 'Death Head Battery Upgrade.png', ItemUpgradeMapPlayerCount: 'Player Count Upgrade.png', ItemUpgradePlayerCrouchRest: 'Crouch Rest Upgrade.png', ItemUpgradePlayerEnergy: 'Stamina Upgrade.png', ItemUpgradePlayerExtraJump: 'Extra Jump Upgrade.png', ItemUpgradePlayerGrabRange: 'Range Upgrade.png', ItemUpgradePlayerGrabStrength: 'Strength Upgrade.png', ItemUpgradePlayerHealth: 'Upgrade Health Albedo.png', ItemUpgradePlayerSprintSpeed: 'Sprint Speed Upgrade.png', ItemUpgradePlayerTumbleClimb: 'Tumble Climb Upgrade.png', ItemUpgradePlayerTumbleLaunch: 'Tumble Launch Upgrade.png', ItemUpgradePlayerTumbleWings: 'Tumble Wings Upgrade.png', ItemLeafBlower: 'LeafBlower.png', ItemValuableTracker: 'TrackerValuable.png', ItemExtractionTracker: 'TrackerExtraction.png', ItemVehicleSemiscooter: 'Hauler.png', ItemVehicleSemiscooterSmall: 'Scout.png', ItemWalkieTalkieBox: 'Semibot_walkiee.png',
                    };
                    if (ITEM_IMAGE[idForImage]) effectImage = `/images/repo/items/${encodeURIComponent(ITEM_IMAGE[idForImage])}`;
                } else {
                    // Fallback to repo_valuables
                    row = conn && await conn.get('SELECT name FROM repo_valuables WHERE id = ?', [code]);
                    if (row) {
                        effectName = `Spawn ${row.name}`;
                        const nameParts = row.name.toLowerCase().split(' ').filter(p => p.length > 2);
                        let best = null, bestScore = 0;
                        for (const f of repoValuables) {
                            const fn = f.toLowerCase().replace(/\.(png|jpg|gif)$/i, '').replace(/\bvaluable\b/g, '').trim();
                            let score = 0;
                            for (const part of nameParts) {
                                if (fn.includes(part)) score++;
                            }
                            if (score > bestScore || (score === bestScore && score > 0 && f.length < (best || f).length)) {
                                best = f; bestScore = score;
                            }
                        }
                        if (bestScore >= Math.min(nameParts.length, 1) && best) {
                            effectImage = `/images/repo/valuables/${encodeURIComponent(best)}`;
                        }
                    }
                }
            } else {
                if (REPO_NAMES[code]) effectName = REPO_NAMES[code];
            }
        } catch (_) {}
        return { effectName, effectImage, count, duration };
    }

    const fallback = typeof effect === 'string' ? effect : (effect.code || '–');
    return { effectName: fallback, effectImage: null, count, duration };
}

router.get('/', async (req, res) => {
    const game = (req.query.game || 'goi').toLowerCase();
    const key  = KEY_MAP[game];
    if (!key) return res.status(400).json({ error: 'Unknown game' });

    const commands = ctx.config[key] || {};
    let conn;
    try { conn = await db.connectGlobal(); } catch (_) {}

    const gifts = [];
    for (const [giftName, effect] of Object.entries(commands)) {
        const catalog   = ctx.availableGifts.find(g => g.name.trim() === giftName.trim());
        const imagePath = catalog ? ctx.localGiftImageUrl(catalog.id, catalog.imageUrl || '') : null;
        let { effectName, effectImage, sprite, count, duration } = await resolveEffect(game, effect, conn);

        // Override with user custom name if exists
        if (ctx.config.customNames && ctx.config.customNames[game] && ctx.config.customNames[game][giftName.trim()]) {
            effectName = ctx.config.customNames[game][giftName.trim()];
        }

        gifts.push({
            name: giftName.trim(),
            id:   catalog?.id ?? null,
            diamondCount: catalog?.diamondCount ?? 0,
            imagePath,
            effectName,
            effectImage,
            sprite,
            count,
            duration
        });
    }

    gifts.sort((a, b) => (Number(a.diamondCount) || 0) - (Number(b.diamondCount) || 0));
    const customColor = (ctx.config.customColors && ctx.config.customColors[game]) || null;
    res.json({ game, gifts, customColor });
});

router.post('/rename', express.json(), (req, res) => {
    const { game, giftName, customName } = req.body;
    if (!game || !giftName) return res.status(400).json({ error: 'Missing game or giftName' });

    if (!ctx.config.customNames) ctx.config.customNames = {};
    if (!ctx.config.customNames[game]) ctx.config.customNames[game] = {};

    if (customName && customName.trim().length > 0) {
        ctx.config.customNames[game][giftName.trim()] = customName.trim();
    } else {
        delete ctx.config.customNames[game][giftName.trim()]; // clear custom name
    }

    try {
        ctx.saveConfig();
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

router.post('/reset', express.json(), (req, res) => {
    const { game } = req.body;
    if (!game) return res.status(400).json({ error: 'Missing game' });

    let changed = false;
    if (ctx.config.customNames && ctx.config.customNames[game]) {
        delete ctx.config.customNames[game];
        changed = true;
    }
    if (ctx.config.customColors && ctx.config.customColors[game]) {
        delete ctx.config.customColors[game];
        changed = true;
    }

    if (changed) {
        try { ctx.saveConfig(); } catch (e) { return res.status(500).json({ error: e.message }); }
    }
    res.json({ success: true });
});

router.post('/color', express.json(), (req, res) => {
    const { game, color } = req.body;
    if (!game || !color) return res.status(400).json({ error: 'Missing game or color' });

    if (!ctx.config.customColors) ctx.config.customColors = {};
    ctx.config.customColors[game] = color;
    
    try {
        ctx.saveConfig();
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

module.exports = router;
