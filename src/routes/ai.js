const express = require('express');
const router  = express.Router();
const db      = require('../database/db_manager');
const auth    = require('../auth/auth');
const isaacBridge = require('../tiktok/isaacBridge');
const { suggestGame, suggestPreset, checkOllamaAvailable } = require('../ai/ollamaClient');
const ctx     = require('../context');

const { PRESET_DETAIL_TABLE } = ctx;

router.get('/status', async (req, res) => {
    const available = await checkOllamaAvailable();
    res.json({ available, model: process.env.OLLAMA_MODEL || 'qwen2.5:7b' });
});

router.get('/game-suggestion', auth.requireAuth, async (req, res) => {
    try {
        const available = await checkOllamaAvailable();
        if (!available) return res.status(503).json({ success: false, error: 'Ollama is not running. Start it with: ollama serve' });

        const userPrefs  = await db.getUserPreferences(req.session.user.id);
        const prefsLoader = async () => {
            if (!userPrefs) return { note: 'No preferences set — go to account page to set them' };
            const parse = (v) => { try { return JSON.parse(v); } catch { return []; } };
            return {
                favorite_games:  parse(userPrefs.favorite_games),
                streaming_style: parse(userPrefs.streaming_genre),
                audience:        parse(userPrefs.target_audience),
                schedule:        parse(userPrefs.streaming_schedule),
                game_genres:     parse(userPrefs.game_genres),
            };
        };
        const suggestion = await suggestGame(prefsLoader, req.query.prompt || '');
        res.json({ success: true, suggestion, model: process.env.OLLAMA_MODEL || 'qwen2.5:7b' });
    } catch (e) {
        console.error('[AI game-suggestion]', e.message);
        res.status(500).json({ success: false, error: e.message });
    }
});

router.post('/preset-suggestion', express.json(), auth.requireAuth, async (req, res) => {
    try {
        const available = await checkOllamaAvailable();
        if (!available) return res.status(503).json({ success: false, error: 'Ollama is not running. Start it with: ollama serve' });

        const { game, prompt: userPrompt } = req.body;
        if (!game || !['minecraft', 'isaac', 'repo', 'goi'].includes(game)) {
            return res.status(400).json({ success: false, error: 'Invalid game' });
        }

        const globalDb   = await db.connectGlobal();
        const streamerId = db.currentStreamerId;
        const { availableGifts, config, ISAAC_DEFAULT_PROFILES } = ctx;

        const rnd = (arr, n) => {
            const copy = [...arr];
            for (let i = copy.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [copy[i], copy[j]] = [copy[j], copy[i]];
            }
            return copy.slice(0, n);
        };

        // ── getDonations ──────────────────────────────────────────────────────
        const MIN_GIFTS = 8;
        const getDonations = async () => {
            const preferredRaw  = await db.getAiPreferredGifts();
            const preferredGifts = preferredRaw.map(p => {
                const match = availableGifts.find(g => g.name.trim() === p.name.trim());
                return match
                    ? { gift: match.name, diamonds: match.diamond_count ?? match.diamondCount ?? 0, preferred: true }
                    : { gift: p.name, diamonds: p.diamond_count || 0, preferred: true };
            });

            if (!streamerId) {
                const prefNames = new Set(preferredGifts.map(g => g.gift));
                const pool      = availableGifts.filter(g => !prefNames.has(g.name));
                const needed    = Math.max(0, MIN_GIFTS - preferredGifts.length);
                const fallbackGifts = needed > 0
                    ? rnd(pool, needed).map(g => ({ gift: g.name, diamonds: g.diamond_count ?? g.diamondCount ?? 0 }))
                    : [];
                return { topGifts: [], preferredGifts, fallbackGifts, note: 'No stream session — using preferred + catalog gifts' };
            }

            const rows    = await db.getRecentDonations(streamerId, 50);
            const summary = {};
            for (const d of rows) {
                const n = d.giftName || 'Unknown';
                if (!summary[n]) summary[n] = { count: 0, diamonds: d.giftDiamonds || 0 };
                summary[n].count += d.count || 1;
            }
            const topGifts = Object.entries(summary)
                .sort((a, b) => b[1].count - a[1].count)
                .slice(0, 15)
                .map(([name, stats]) => ({ gift: name, count: stats.count, diamonds: stats.diamonds }));

            const realNames      = new Set(topGifts.map(g => g.gift));
            const preferredExtra = preferredGifts.filter(p => !realNames.has(p.gift));
            let fallbackGifts    = [];
            const coveredCount   = topGifts.length + preferredExtra.length;
            if (coveredCount < MIN_GIFTS) {
                const knownNames = new Set([...realNames, ...preferredExtra.map(p => p.gift)]);
                const pool  = availableGifts.filter(g => !knownNames.has(g.name));
                const needed = MIN_GIFTS - coveredCount;
                fallbackGifts = rnd(pool, needed).map(g => ({ gift: g.name, diamonds: g.diamond_count ?? g.diamondCount ?? 0 }));
            }
            return { topGifts, preferredGifts: preferredExtra, fallbackGifts };
        };

        // ── catalog loaders ───────────────────────────────────────────────────
        const isaacProfiles = isaacBridge.profiles.length > 0 ? isaacBridge.profiles : (config.isaacProfiles || ISAAC_DEFAULT_PROFILES);
        let allIsaacItems = [], allIsaacBosses = [], allRepoItems = [], allRepoEnemies = [], allRepoValuables = [];
        if (game === 'isaac') {
            [allIsaacItems, allIsaacBosses] = await Promise.all([db.getIsaacItems(), db.getIsaacBosses()]);
        } else if (game === 'repo') {
            [allRepoItems, allRepoEnemies, allRepoValuables] = await Promise.all([db.getRepoItems(), db.getRepoEnemies(), db.getRepoValuables()]);
        }

        const getProfiles = (category) => {
            let pool = isaacProfiles;
            if (category) pool = pool.filter(p => p.category?.toLowerCase() === category.toLowerCase());
            return pool.map(p => ({ id: p.id, name: p.name, desc: p.desc, category: p.category }));
        };
        const getItems = (filters, n) => {
            if (game === 'isaac') {
                let pool = allIsaacItems;
                if (filters.quality) pool = pool.filter(r => (r.quality || 0) >= filters.quality);
                if (filters.pool)    pool = pool.filter(r => r.pool?.toLowerCase().includes(filters.pool.toLowerCase()));
                if (filters.type)    pool = pool.filter(r => r.type?.toLowerCase().includes(filters.type.toLowerCase()));
                return rnd(pool, n).map(r => ({ itemId: r.id, name: r.name, quality: r.quality, pool: r.pool || null, type: r.type || null }));
            }
            let pool = allRepoItems;
            if (filters.type) pool = pool.filter(r => r.item_type?.toLowerCase() === filters.type.toLowerCase());
            return rnd(pool, n).map(r => ({ id: r.id, name: r.name, type: r.item_type || null }));
        };
        const getBosses    = (n) => rnd(allIsaacBosses, n).map(r => ({ bossId: r.id, name: r.name }));
        const getValuables = (n) => rnd(allRepoValuables, n).map(r => ({ id: r.id, name: r.name }));
        const getEnemies   = (danger, n) => {
            let pool = allRepoEnemies;
            if (danger !== null && danger !== undefined) {
                const lvl = { low: 1, medium: 2, high: 3 }[String(danger).toLowerCase()] || Number(danger);
                if (lvl) pool = pool.filter(r => r.danger_level === lvl);
            }
            return rnd(pool, n).map(r => ({ id: r.id, name: r.name, danger_level: r.danger_level, hp: r.hp }));
        };
        const getEffects = () => [
            { id: 'player_heal',                name: 'Heal',                  category: 'Player',   desc: '+100 health',                         timed: false },
            { id: 'player_hurt',                name: 'Hurt',                  category: 'Player',   desc: '-25 health',                          timed: false },
            { id: 'player_kill',                name: 'Kill',                  category: 'Player',   desc: 'Instant death',                       timed: false },
            { id: 'player_refill_energy',       name: 'Refill Stamina',        category: 'Player',   desc: 'Full stamina',                        timed: false },
            { id: 'player_drain_energy',        name: 'Drain Stamina',         category: 'Player',   desc: 'Zero stamina',                        timed: false },
            { id: 'player_invincible',          name: 'Invincible',            category: 'Toggle',   desc: 'God mode',                            timed: true  },
            { id: 'player_infinitestam',        name: 'Infinite Stamina',      category: 'Toggle',   desc: 'Infinite stamina',                    timed: true  },
            { id: 'player_disableinput',        name: 'Disable Input',         category: 'Toggle',   desc: 'Freeze controls',                     timed: true  },
            { id: 'player_disablecrouch',       name: 'Disable Crouch',        category: 'Toggle',   desc: "Can't crouch",                        timed: true  },
            { id: 'player_fast',                name: 'Speed Boost',           category: 'Movement', desc: '2x speed',                            timed: true  },
            { id: 'player_slow',                name: 'Slow',                  category: 'Movement', desc: '0.5x speed',                          timed: true  },
            { id: 'player_antigravity',         name: 'Anti Gravity',          category: 'Movement', desc: 'Float',                               timed: true  },
            { id: 'player_teleport_random',     name: 'TP to Random Player',   category: 'Movement', desc: 'TP to a random player',               timed: false },
            { id: 'player_teleport_extraction', name: 'TP to Extraction',      category: 'Movement', desc: 'TP to nearest exit',                  timed: false },
            { id: 'player_teleport_truck',      name: 'TP to Truck',           category: 'Movement', desc: 'TP back to truck',                    timed: false },
            { id: 'player_teleport_room',       name: 'TP to Random Room',     category: 'Movement', desc: 'TP to random level point',            timed: false },
            { id: 'playerPitch_high',           name: 'High Pitch',            category: 'Voice',    desc: 'Chipmunk voice',                      timed: true  },
            { id: 'playerPitch_low',            name: 'Low Pitch',             category: 'Voice',    desc: 'Deep voice',                          timed: true  },
            { id: 'revive_all',                 name: 'Revive All',            category: 'World',    desc: 'Revives all dead players',            timed: false },
            { id: 'closeAllDoors',              name: 'Close All Doors',       category: 'World',    desc: 'Slams every door',                    timed: false },
            { id: 'increase_haul_goal',         name: 'Increase Quota (1.5x)', category: 'World',    desc: 'Multiplies quota by 1.5',             timed: false },
            { id: 'decrease_haul_goal',         name: 'Decrease Quota (0.5x)', category: 'World',    desc: 'Multiplies quota by 0.5',             timed: false },
            { id: 'destroy_random_item',        name: 'Destroy Random Item',   category: 'World',    desc: 'Destroys a random valuable',          timed: false },
            { id: 'player_upgrade_energy',      name: 'Upgrade Stamina',       category: 'Upgrade',  desc: 'Apply stamina upgrade directly',      timed: false },
            { id: 'player_upgrade_health',      name: 'Upgrade Health',        category: 'Upgrade',  desc: 'Apply health upgrade directly',       timed: false },
            { id: 'player_upgrade_jump',        name: 'Upgrade Extra Jump',    category: 'Upgrade',  desc: 'Apply extra jump upgrade directly',   timed: false },
            { id: 'player_upgrade_grabrange',   name: 'Upgrade Grab Range',    category: 'Upgrade',  desc: 'Apply grab range upgrade directly',   timed: false },
            { id: 'player_upgrade_grabstrength',name: 'Upgrade Grab Strength', category: 'Upgrade',  desc: 'Apply grab strength upgrade',         timed: false },
            { id: 'player_upgrade_sprint',      name: 'Upgrade Sprint Speed',  category: 'Upgrade',  desc: 'Apply sprint speed upgrade directly', timed: false },
            { id: 'player_upgrade_tumble',      name: 'Upgrade Tumble',        category: 'Upgrade',  desc: 'Apply tumble launch upgrade',         timed: false },
            { id: 'player_upgrade_map',         name: 'Upgrade Map Count',     category: 'Upgrade',  desc: 'Add player slot to map',              timed: false },
        ];

        // ── createPreset ──────────────────────────────────────────────────────
        let createdPreset = null;
        const createPreset = async (args) => {
            const rawName = (args.name || '').trim();
            if (!rawName) return { error: 'name is required. You must provide a name field.' };
            const pname = rawName
                .replace(/([a-z])([A-Z])/g, '$1 $2')
                .replace(/[_-]+/g, ' ')
                .replace(/\s+/g, ' ')
                .trim()
                .replace(/\b\w/g, c => c.toUpperCase());
            const rawCmds = args.commands || args.gift_commands || {};
            const cmdCount = Object.keys(rawCmds).length;
            if (cmdCount < 7) return { error: `Too few gift mappings (${cmdCount}). You must map at least 7 gifts — use ALL the gift names from the PRESET GIFT KEYS list in the system prompt, not just a few.` };
            const emptyKeys = Object.entries(rawCmds)
                .filter(([, v]) => {
                    if (Array.isArray(v)) return v.length === 0 || v.every(s => !s || !String(s).trim());
                    if (v === null || v === undefined || v === '') return true;
                    if (typeof v === 'object' && !Array.isArray(v)) return Object.keys(v).length === 0;
                    return false;
                })
                .map(([k]) => k);
            if (emptyKeys.length > 0) return { error: `These gifts have no command assigned: ${emptyKeys.join(', ')}. Every gift key must have a real effect — fill them all in.` };

            const availableGiftNames = new Set(availableGifts.map(g => g.name.trim()));
            const unknownGifts = Object.keys(rawCmds).filter(k => !availableGiftNames.has(k));
            if (unknownGifts.length > 0) return { error: `These gift names do not exist in the gift database: ${unknownGifts.join(', ')}. Use ONLY the exact gift names from the PRESET GIFT KEYS list provided in the system prompt — do not invent names.` };

            const detail = PRESET_DETAIL_TABLE[game];
            const INVALID_KEYS = new Set(['action','itemId','bossId','amount','autoCollect','code','duration','targetRandom','type','quality','pool']);
            const sanitizeCommands = (cmds) => {
                if (!cmds || typeof cmds !== 'object') return {};
                return Object.fromEntries(Object.entries(cmds).filter(([k]) => !INVALID_KEYS.has(k)));
            };
            const fixIsaacCommands = async (cmds) => {
                const activeIds = new Set(
                    (await globalDb.all(`SELECT i.id FROM isaac_items i JOIN isaac_item_types it ON i.id=it.item_id JOIN isaac_types t ON it.type_id=t.id WHERE t.name='Active'`))
                    .map(r => r.id)
                );
                const fixed = {};
                for (const [gift, val] of Object.entries(cmds)) {
                    if (val && typeof val === 'object' && val.action === 'use_item' && !activeIds.has(val.itemId)) {
                        console.info(`[AI] fixed use_item→spawn_item for itemId ${val.itemId} (not Active)`);
                        fixed[gift] = { action: 'spawn_item', itemId: val.itemId, amount: 1, autoCollect: false };
                    } else {
                        fixed[gift] = val;
                    }
                }
                return fixed;
            };

            let data;
            if (game === 'isaac') {
                data = { isaac_commands: JSON.stringify(await fixIsaacCommands(sanitizeCommands(args.commands))) };
            } else if (game === 'repo') {
                const TIMED_REPO = new Set(['player_invincible','player_infinitestam','player_disableinput','player_disablecrouch','player_fast','player_slow','player_antigravity','playerPitch_high','playerPitch_low']);
                const repoErrors = [];
                for (const [gift, val] of Object.entries(args.commands || {})) {
                    if (!val || typeof val !== 'object') continue;
                    if (TIMED_REPO.has(val.code) && val.duration === undefined)
                        repoErrors.push(`"${gift}": ${val.code} is timed — add "duration": N (5-30 seconds)`);
                    if (!TIMED_REPO.has(val.code) && val.duration !== undefined)
                        repoErrors.push(`"${gift}": ${val.code} is instant — remove "duration"`);
                }
                if (repoErrors.length > 0) return { error: `Wrong fields used:\n${repoErrors.join('\n')}\nFix these and call create_preset again.` };
                data = { repo_commands: JSON.stringify(sanitizeCommands(args.commands)) };
            } else if (game === 'goi') {
                const TIMED_GOI   = new Set(['low_gravity','high_gravity','zero_gravity','low_friction','high_friction','flip_camera','spin_camera','invert_mouse']);
                const COUNTED_GOI  = new Set(['spawn_hat','spawn_orange','spawn_gift']);
                const INSTANT_GOI  = new Set(['launch','shove_left','shove_right','reset_progress']);
                const goiErrors = [];
                for (const [gift, val] of Object.entries(args.commands || {})) {
                    if (!val || typeof val !== 'object') continue;
                    if (TIMED_GOI.has(val.code) && val.count !== undefined)
                        goiErrors.push(`"${gift}": ${val.code} is TIMED — use "duration" not "count"`);
                    if (TIMED_GOI.has(val.code) && val.duration === undefined)
                        goiErrors.push(`"${gift}": ${val.code} is TIMED — add "duration": N (5-30 seconds)`);
                    if (COUNTED_GOI.has(val.code) && val.duration !== undefined)
                        goiErrors.push(`"${gift}": ${val.code} is COUNTED — use "count" not "duration"`);
                    if (COUNTED_GOI.has(val.code) && val.count === undefined)
                        goiErrors.push(`"${gift}": ${val.code} is COUNTED — add "count": N`);
                    if (INSTANT_GOI.has(val.code) && (val.duration !== undefined || val.count !== undefined))
                        goiErrors.push(`"${gift}": ${val.code} is INSTANT — remove all extra fields, just { "code": "${val.code}" }`);
                }
                if (goiErrors.length > 0) return { error: `Wrong fields used:\n${goiErrors.join('\n')}\nFix these and call create_preset again.` };
                data = { goi_commands: JSON.stringify(sanitizeCommands(args.commands)) };
            } else {
                console.info('[AI minecraft] raw args:', JSON.stringify(args));
                const rawGiftCmds = args.gift_commands || args.commands || {};
                const normalizedGiftCmds = Object.fromEntries(
                    Object.entries(rawGiftCmds).map(([gift, val]) => {
                        if (Array.isArray(val))        return [gift, { command: val.join('\n'), cooldown: 0 }];
                        if (typeof val === 'string')   return [gift, { command: val, cooldown: 0 }];
                        if (val && typeof val === 'object') {
                            if (typeof val.command === 'string') return [gift, val];
                            if (Array.isArray(val.commands))     return [gift, { command: val.commands.join('\n'), cooldown: val.cooldown || 0 }];
                        }
                        return [gift, val];
                    })
                );
                console.info('[AI minecraft] normalized:', JSON.stringify(normalizedGiftCmds));
                data = {
                    host:           (config.minecraft?.host) || 'localhost',
                    port:           (config.minecraft?.port) || 25575,
                    auto_connect:   0,
                    target_players: JSON.stringify(config.targetPlayers || []),
                    gift_commands:  JSON.stringify(normalizedGiftCmds),
                    follow_command: JSON.stringify(args.follow_command || {}),
                    like_command:   JSON.stringify(args.like_command   || {}),
                };
            }

            const cols = Object.keys(data);
            const vals = Object.values(data);
            const existing = await globalDb.get('SELECT id FROM presets WHERE account_id = ? AND name = ? AND game = ?', [req.session.user.id, pname, game]);
            let presetId;
            if (existing) {
                presetId = existing.id;
                await globalDb.run('UPDATE presets SET created_at = CURRENT_TIMESTAMP WHERE id = ?', [presetId]);
                await globalDb.run('UPDATE ' + detail + ' SET ' + cols.map(c => c + ' = ?').join(', ') + ' WHERE preset_id = ?', [...vals, presetId]);
            } else {
                const r = await globalDb.run('INSERT INTO presets (account_id, name, game) VALUES (?, ?, ?)', [req.session.user.id, pname, game]);
                presetId = r.lastID;
                await globalDb.run('INSERT INTO ' + detail + ' (preset_id, ' + cols.join(', ') + ') VALUES (?, ' + cols.map(() => '?').join(', ') + ')', [presetId, ...vals]);
            }
            createdPreset = { id: presetId, name: pname };
            return { success: true, message: `Preset "${pname}" saved.` };
        };

        // ── existing presets ──────────────────────────────────────────────────
        const commandCol = { isaac: 'isaac_commands', repo: 'repo_commands', goi: 'goi_commands', minecraft: 'gift_commands' }[game];
        const getExistingPresets = async () => {
            const detail = PRESET_DETAIL_TABLE[game];
            const rows = await globalDb.all(
                `SELECT p.name, d.${commandCol} as cmds FROM presets p JOIN ${detail} d ON d.preset_id = p.id WHERE p.account_id = ? AND p.game = ? ORDER BY p.created_at DESC LIMIT 5`,
                [req.session.user.id, game]
            );
            const giftCostMap = Object.fromEntries(availableGifts.map(g => [g.name, g.diamond_count || 0]));
            return rows.map(r => {
                const commands  = (() => { try { return JSON.parse(r.cmds || '{}'); } catch { return {}; } })();
                const giftsUsed = Object.keys(commands).map(g => ({ gift: g, diamonds: giftCostMap[g] ?? null }));
                return { name: r.name, commands, giftsUsed };
            });
        };

        // ── call AI ───────────────────────────────────────────────────────────
        const suggestion = await suggestPreset(game, {
            getDonations, getProfiles, getItems, getBosses,
            getEffects, getEnemies, getValuables, createPreset,
            getExistingPresets,
        }, userPrompt);

        if (!createdPreset) {
            return res.status(500).json({ success: false, error: 'AI did not create a preset. Try again — it sometimes needs a retry.' });
        }

        const updatedPresets = await globalDb.all(
            'SELECT id, name, created_at FROM presets WHERE account_id = ? AND game = ? ORDER BY created_at DESC',
            [req.session.user.id, game]
        );
        res.json({ success: true, suggestion, preset_created: true, preset_name: createdPreset.name, presets: updatedPresets, model: process.env.OLLAMA_MODEL || 'qwen2.5:7b' });
    } catch (e) {
        console.error('[AI preset-suggestion]', e.message);
        res.status(500).json({ success: false, error: e.message });
    }
});

module.exports = router;
