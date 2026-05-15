const fs   = require('fs');
const path = require('path');

const configPath = path.join(__dirname, '../config/config.json');
const configDir  = path.dirname(configPath);
if (!fs.existsSync(configDir)) fs.mkdirSync(configDir, { recursive: true });

let config = {
    minecraft:    { host: 'localhost', port: 25575, password: '', enabled: false, autoConnect: false },
    isaac:        { port: 58431, enabled: true },
    repo:         { port: 51337, enabled: false },
    giftCommands: {},
    isaacCommands: {},
    repoCommands:  {},
    goiCommands:   {},
    followCommand: { command: '', cooldown: 0 },
    likeCommand:   { command: '', minLikes: 100 },
    targetPlayers: [],
};

try {
    if (fs.existsSync(configPath)) {
        config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    } else {
        fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
    }
} catch (e) {
    console.error('Failed to load config.json:', e);
}

const GIFT_IMG_DIR = path.join(__dirname, '../public/images/gifts');
if (!fs.existsSync(GIFT_IMG_DIR)) fs.mkdirSync(GIFT_IMG_DIR, { recursive: true });

const ISAAC_DEFAULT_PROFILES = [
    { id: 'boss_rush',       name: 'Boss Rush',       desc: 'Spawns 3 random bosses',                                           category: 'Chaos'      },
    { id: 'total_chaos',     name: 'Total Chaos',     desc: '5 items + 10 enemies + all curses at once',                        category: 'Chaos'      },
    { id: 'mob_rush',        name: 'Mob Rush',        desc: '15 random enemies swarm the room',                                 category: 'Chaos'      },
    { id: 'all_curses',      name: 'All Curses',      desc: 'Every floor curse at once',                                        category: 'Curses'     },
    { id: 'curse_roulette',  name: 'Curse Roulette',  desc: 'Random curse applied',                                             category: 'Curses'     },
    { id: 'near_death',      name: 'Near Death',      desc: 'Reduces to half a heart',                                          category: 'Punishment' },
    { id: 'item_yoink',      name: 'Item Yoink',      desc: 'Removes a random held item',                                      category: 'Punishment' },
    { id: 'nightmare',       name: 'Nightmare',       desc: 'Near death + all curses + enemy wave',                             category: 'Punishment' },
    { id: 'upside_down',     name: 'Upside Down',     desc: 'Reversed controls for 30 seconds',                                 category: 'Timed'      },
    { id: 'speed_demon',     name: 'Speed Demon',     desc: 'Double speed for 30 seconds',                                      category: 'Timed'      },
    { id: 'god_mode',        name: 'God Mode',        desc: 'Invincible for 15 seconds',                                        category: 'Timed'      },
    { id: 'full_heal',       name: 'Full Heal',       desc: 'Restores all health',                                              category: 'Buff'       },
    { id: 'devil_deal',      name: 'Free Devil Deal', desc: 'Gives a random devil collectible',                                 category: 'Buff'       },
    { id: 'supply_drop',     name: 'Supply Drop',     desc: '10 coins + 5 bombs + 5 keys',                                     category: 'Buff'       },
    { id: 'jackpot',         name: 'Jackpot',         desc: 'Random item + full heal + supplies',                               category: 'Buff'       },
    { id: 'sacrifice',       name: 'Sacrifice',       desc: 'Drops to half heart — then immediately gives a devil item',        category: 'Buff'       },
    { id: 'chaos_reroll',    name: 'Chaos Reroll',    desc: 'Spawns 5 item pedestals + enemies, then D6s them all 3 times',    category: 'Chaos'      },
    { id: 'cursed_blessing', name: 'Cursed Blessing', desc: '3 random items directly into inventory — but every floor curse activates', category: 'Chaos' },
    { id: 'worm_trio',       name: 'Worm Trio',       desc: 'Spawns Pin, Scolex, and The Frail',                               category: 'Chaos'      },
    { id: 'trapdoor',        name: 'Trapdoor',        desc: 'Spawns a trapdoor under you',                                     category: 'Chaos'      },
    { id: 'item_drain',      name: 'Item Drain',      desc: 'Removes 3 random held items',                                     category: 'Punishment' },
    { id: 'health_scare',    name: 'Health Scare',    desc: 'Near death + reversed controls for 30s',                          category: 'Punishment' },
    { id: 'absolute_trade',  name: 'The Trade',       desc: 'Removes 2 held items, gives a devil item + full heal',            category: 'Punishment' },
    { id: 'retro_vision',    name: 'Retro Vision',    desc: 'Adds intense pixelation to the screen',                           category: 'Glitch'     },
    { id: 'glitch_storm',    name: 'Glitch Storm',    desc: 'Spawns 3 TMTRAINER items',                                        category: 'Glitch'     },
];

const PRESET_DETAIL_TABLE = {
    minecraft: 'preset_minecraft',
    isaac:     'preset_isaac',
    repo:      'preset_repo',
    goi:       'preset_goi',
};

function saveConfig() {
    fs.writeFileSync(ctx.configPath, JSON.stringify(ctx.config, null, 2));
}

function localGiftImagePath(giftId, remoteUrl) {
    const ext = remoteUrl.includes('.png') ? '.png' : '.webp';
    return path.join(GIFT_IMG_DIR, `${giftId}${ext}`);
}

function localGiftImageUrl(giftId, remoteUrl) {
    const ext = remoteUrl.includes('.png') ? '.png' : '.webp';
    return `/images/gifts/${giftId}${ext}`;
}

async function downloadGiftImage(giftId, remoteUrl) {
    if (!giftId || !remoteUrl) return;
    const dest = localGiftImagePath(giftId, remoteUrl);
    if (fs.existsSync(dest)) return;
    try {
        const res = await fetch(remoteUrl, { signal: AbortSignal.timeout(8000) });
        if (!res.ok) return;
        const buf = Buffer.from(await res.arrayBuffer());
        fs.writeFileSync(dest, buf);
    } catch { /* skip silently */ }
}

function renameKey(obj, oldKey, newKey, newValue) {
    const result = {};
    for (const [k, v] of Object.entries(obj)) {
        result[k === oldKey ? newKey : k] = k === oldKey ? newValue : v;
    }
    return result;
}

const ctx = {
    config,
    configPath,
    GIFT_IMG_DIR,
    ISAAC_DEFAULT_PROFILES,
    PRESET_DETAIL_TABLE,
    availableGifts: [],
    donorStats:     {},
    trackedDiamonds:       0,
    initialDonorsSynced:   false,
    initialDonorsSum:      0,
    initialTopDonors:      [],
    giftCooldowns: new Map(),
    tiktokConnectionWrapper: null,
    tiktokOwnerSocketId:     null,
    io: null,
    saveConfig,
    localGiftImagePath,
    localGiftImageUrl,
    downloadGiftImage,
    renameKey,
};

module.exports = ctx;
