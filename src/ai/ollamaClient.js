
const OLLAMA_URL = process.env.OLLAMA_URL || 'http://localhost:11434';
const MODEL = process.env.OLLAMA_MODEL || 'qwen2.5:7b';
const { getTopGamesByCategory } = require('./twitchClient');
const db = require('../database/db_manager');

async function ollamaChat(messages, tools) {
    const res = await fetch(`${OLLAMA_URL}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: MODEL, messages, tools, stream: false }),
    });

    if (!res.ok) {
        const text = await res.text().catch(() => '');
        throw new Error(`Ollama error ${res.status}: ${text}`);
    }

    const json = await res.json();
    return json.message;
}

async function runAgent(messages, tools, toolHandlers, label = 'agent') {
    const msgs = [...messages];
    const tag = `[AI:${label}]`;
    const isPreset = label.startsWith('preset-');
    let calledCreatePreset = false;

    console.log(`\n${tag} ─── start ───────────────────────────────`);
    console.log(`${tag} prompt: ${messages[messages.length - 1].content.slice(0, 120)}${messages[messages.length - 1].content.length > 120 ? '…' : ''}`);

    for (let i = 0; i < 12; i++) {
        console.log(`${tag} → thinking... (step ${i + 1})`);
        const msg = await ollamaChat(msgs, tools);
        msgs.push(msg);

        if (!msg.tool_calls || msg.tool_calls.length === 0) {
            // Preset agents must call create_preset before finishing
            if (isPreset && !calledCreatePreset) {
                console.log(`${tag} ⚠ no tool call — nudging to use tools`);
                const isMinecraft = label === 'preset-minecraft';
                const cmdField = isMinecraft ? '"gift_commands"' : '"commands"';
                const nudgeCount = msgs.filter(m => m.role === 'user' && m.content && m.content.includes('call a tool')).length;
                const hasSearchTools = tools.some(t => t.function && t.function.name.startsWith('search_'));
                let nudge;
                if (nudgeCount === 0 && hasSearchTools) {
                    nudge = `You must call a tool. If the user mentioned any item, enemy, or boss by name, call the appropriate search tool first. Otherwise call create_preset directly with all gift keys mapped.`;
                } else {
                    const cmdExample = isMinecraft
                        ? '"gift_commands": { "Rose": ["/give {playername} minecraft:diamond 1"], "Heart": ["/effect give {playername} minecraft:regeneration 10 1 true"], "Galaxy Brain": ["/effect give {playername} minecraft:speed 20 2 true"] }'
                        : label === 'preset-repo'
                            ? '"commands": { "Rose": { "code": "player_heal", "targetRandom": false }, "Heart": { "code": "player_fast", "targetRandom": true, "duration": 10 } }'
                            : label === 'preset-goi'
                                ? '"commands": { "Rose": { "code": "launch" }, "Heart": { "code": "zero_gravity", "duration": 15 } }'
                                : '"commands": { "Rose": "boss_rush", "Heart": { "action": "spawn_item", "itemId": 214, "amount": 1, "autoCollect": true } }';
                    nudge = `You MUST call the create_preset tool now. Do not explain — just call it. Required fields: "name" (string) and ${cmdField} (object mapping gift names to effects). EVERY gift must have a real effect assigned — no empty arrays. Example: { "name": "My Preset", ${cmdExample} }`;
                }
                msgs.push({ role: 'user', content: nudge });
                continue;
            }
            console.log(`${tag} ✓ final answer: ${(msg.content || '').slice(0, 160)}${(msg.content || '').length > 160 ? '…' : ''}`);
            console.log(`${tag} ─── done ────────────────────────────────\n`);
            return msg.content;
        }

        for (const call of msg.tool_calls) {
            const name = call.function.name;
            const args = call.function.arguments || {};
            console.log(`${tag} ⚙  tool call: ${name}(${JSON.stringify(args)})`);

            if (name === 'create_preset') calledCreatePreset = true;

            const handler = toolHandlers[name];
            let result;
            if (handler) {
                try {
                    result = await handler(args);
                    const preview = JSON.stringify(result).slice(0, 200);
                    console.log(`${tag}    └─ result: ${preview}${JSON.stringify(result).length > 200 ? '…' : ''}`);
                } catch (err) {
                    result = { error: err.message };
                    console.log(`${tag}    └─ error: ${err.message}`);
                }
            } else {
                result = { error: `Unknown tool: ${name}` };
                console.log(`${tag}    └─ unknown tool`);
            }

            msgs.push({ role: 'tool', content: JSON.stringify(result) });

            if (name === 'create_preset') {
                if (result && result.error) {
                    calledCreatePreset = false;
                    const hadCommands = args.commands || args.gift_commands;
                    // Collect all search results from conversation history to remind model
                    const searchResults = msgs
                        .filter(m => m.role === 'tool')
                        .map(m => { try { return JSON.parse(m.content); } catch { return null; } })
                        .filter(r => r && r.results && r.results.length > 0)
                        .flatMap(r => r.results);
                    const searchHint = searchResults.length > 0
                        ? ` Remember to include ALL searched items/bosses in your commands: ${JSON.stringify(searchResults)}.`
                        : '';
                    const fixHint = hadCommands
                        ? `Call create_preset again. Assign a real effect to EVERY gift key — do not leave any with empty arrays or missing commands.${searchHint}`
                        : `Call create_preset with "name" and "commands" covering all gift keys.${searchHint}`;
                    msgs.push({ role: 'user', content: `create_preset failed: ${result.error}. ${fixHint}` });
                } else if (result && result.success) {
                    console.log(`${tag} ─── done (preset saved) ──────────────\n`);
                    return result.message || 'Preset saved.';
                }
            }
        }
    }

    throw new Error('Agent exceeded maximum tool call iterations');
}

const SUPPORTED_GAMES = ['Minecraft', 'The Binding of Isaac', 'R.E.P.O.', 'Getting Over It'];

// Agent 1 — game suggestion
async function suggestGame(prefsLoader, userPrompt) {
    const tools = [
        {
            type: 'function',
            function: {
                name: 'get_trending_games',
                description: 'Get the current top 10 games on Twitch by viewer count. Returns a ranked list with game names. Use this to see what is popular right now before making a suggestion.',
                parameters: { type: 'object', properties: {}, required: [] },
            },
        },
        {
            type: 'function',
            function: {
                name: 'get_user_preferences',
                description: "Get the user's saved streaming preferences: favorite games, streaming style, audience type, schedule, and game genres.",
                parameters: { type: 'object', properties: {}, required: [] },
            },
        },
    ];

    const toolHandlers = {
        get_trending_games: async () => {
            const result = await getTopGamesByCategory(10);
            if (result.error) return { error: result.error, note: 'Twitch data unavailable, suggest based on preferences only.' };
            const supportedLower = SUPPORTED_GAMES.map(g => g.toLowerCase().replace(/[^a-z0-9]/g, ''));
            const annotated = result.map(g => {
                const normalized = g.game.toLowerCase().replace(/[^a-z0-9]/g, '');
                const supported = supportedLower.some(s => s === normalized || s.includes(normalized) || normalized.includes(s));
                return { ...g, supported_in_app: supported };
            });
            return { trending: annotated };
        },
        get_user_preferences: async () => prefsLoader(),
    };

    const prompt = userPrompt && userPrompt.trim()
        ? userPrompt.trim()
        : 'What game should I stream today?';

    const messages = [
        {
            role: 'system',
            content: `You are a TikTok streaming advisor with personality. You have two tools: get_trending_games (Twitch top 10 right now) and get_user_preferences (streamer's saved preferences). Always call get_trending_games first. Then optionally call get_user_preferences if the user asks about their taste or mood.

Each game in the trending list has a field "supported_in_app": true or false. You MUST use that field — do not guess. If the recommended game has supported_in_app: true, say the app supports it with full gift effects. If supported_in_app: false, say it has no app integration yet.

After gathering data, give a proper recommendation:
1. Briefly mention 2-3 of the most interesting games from the trending list and why they are popping off right now.
2. Give a clear final recommendation — one game — with a specific reason why it fits the moment.
3. State the support status using ONLY the supported_in_app field from the data, not your own knowledge.
4. End with one short sentence that gets the streamer hyped to go live.

Write like a knowledgeable friend, not a robot. Be direct and specific. Plain text only, no markdown, no bullet points, no asterisks. Around 6-8 sentences total.`,
        },
        { role: 'user', content: prompt },
    ];

    return runAgent(messages, tools, toolHandlers, 'game-suggest');
}

// Agent 2 — preset creation (server gathers the data, AI only calls create_preset)
async function suggestPreset(game, handlers, userPrompt) {
    // ── gather all data server-side ────────────────────────────────────
    const [donations, existingPresets] = await Promise.all([
        handlers.getDonations(),
        handlers.getExistingPresets ? handlers.getExistingPresets() : Promise.resolve([]),
    ]);
    const realGifts = (donations.topGifts || []).map(g => ({ gift: g.gift, diamonds: g.diamonds || 0, count: g.count || 1, real: true }));
    const preferredGifts = (donations.preferredGifts || []).map(g => ({ gift: g.gift, diamonds: g.diamonds || 0, count: 0, real: false, preferred: true }));
    const fallbackGifts = (donations.fallbackGifts || [])
        .map(g => typeof g === 'string' ? { gift: g, diamonds: 0, count: 0, real: false } : { ...g, count: 0, real: false });
    const giftList = [...realGifts, ...preferredGifts, ...fallbackGifts]
        .filter((g, i, a) => a.findIndex(x => x.gift === g.gift) === i)
        .slice(0, 12);

    let context = '';

    // Donation history summary for AI context
    const hasDonationHistory = realGifts.length > 0;
    const donationSummary = hasDonationHistory
        ? `DONATION HISTORY (viewers who donated on this live stream):
${realGifts.map(g => `  ${g.gift}: donated ${g.count}x (${g.diamonds} diamonds each)`).join('\n')}
Most popular gift: ${realGifts[0].gift} (${realGifts[0].count}x)
Most valuable gift: ${[...realGifts].sort((a, b) => b.diamonds - a.diamonds)[0].gift} (${[...realGifts].sort((a, b) => b.diamonds - a.diamonds)[0].diamonds} diamonds)`
        : 'DONATION HISTORY: No donation data yet for this stream.';

    // Gift list for preset keys — real donations first, preferred second, fallback last
    const realLines = giftList.filter(g => g.real).map(g => `  "${g.gift}" — ${g.diamonds} diamonds, donated ${g.count}x`);
    const preferredLines = giftList.filter(g => g.preferred && !g.real).map(g => `  "${g.gift}" — ${g.diamonds} diamonds`);
    const fallbackLines = giftList.filter(g => !g.real && !g.preferred).map(g => `  "${g.gift}" — ${g.diamonds} diamonds`);
    const giftCostHint = `PRESET GIFT KEYS — use ONLY the quoted names as command keys (without quotes). Match effect strength to diamond cost.
Gifts viewers actually donated (highest priority — assign effects that reward donation frequency and value):
${realLines.length > 0 ? realLines.join('\n') : '  (none yet)'}
${preferredLines.length > 0 ? `Preferred gifts (commonly used by this streamer — include these):\n${preferredLines.join('\n')}` : ''}
${fallbackLines.length > 0 ? `Other available gifts (fill remaining keys):\n${fallbackLines.join('\n')}` : ''}`;

    const existingPresetsHint = existingPresets.length > 0
        ? `EXISTING PRESETS (streamer already has these — learn their gift/effect patterns, do NOT duplicate names or identical mappings):
${existingPresets.map(p => {
    const giftLines = (p.giftsUsed || []).map(g => `      ${g.gift}${g.diamonds !== null ? ` (${g.diamonds} diamonds)` : ''}: ${JSON.stringify(p.commands[g.gift])}`);
    return `  "${p.name}":\n${giftLines.join('\n')}`;
}).join('\n')}`
        : '';

    if (game === 'isaac') {
        const [profiles, activeItems, passiveItems, bosses] = await Promise.all([
            handlers.getProfiles(null),
            handlers.getItems({ type: 'Active', quality: 3 }, 8),
            handlers.getItems({ type: 'Passive', quality: 3 }, 8),
            handlers.getBosses(16),
        ]);
        context = `PROFILES (use id as string value): ${JSON.stringify(profiles.map(p => ({ id: p.id, name: p.name, category: p.category })))}
ACTIVE ITEMS (use_item or spawn_item): ${JSON.stringify(activeItems.map(i => ({ itemId: i.itemId, name: i.name })))}
PASSIVE ITEMS (spawn_item only): ${JSON.stringify(passiveItems.map(i => ({ itemId: i.itemId, name: i.name })))}
BOSSES (spawn_boss): ${JSON.stringify(bosses.map(b => ({ bossId: b.bossId, name: b.name })))}`;
    } else if (game === 'repo') {
        const [effects, guns, medicals, enemies, valuables] = await Promise.all([
            handlers.getEffects(),
            handlers.getItems({ type: 'Gun' }, 5),
            handlers.getItems({ type: 'Medical' }, 4),
            handlers.getEnemies(null, 8),
            handlers.getValuables(5),
        ]);
        const playerEffects = effects.filter(e => e.category !== 'Upgrade');
        const upgradeEffects = effects.filter(e => e.category === 'Upgrade');
        context = `PLAYER EFFECTS (instant/timed, use id as code): ${JSON.stringify(playerEffects.map(e => ({ id: e.id, name: e.name, timed: e.timed })))}
UPGRADE EFFECTS (apply upgrade directly to player, use id as code — ONLY use these exact ids): ${JSON.stringify(upgradeEffects.map(e => ({ id: e.id, name: e.name })))}
GUNS (spawn on ground, use id as code): ${JSON.stringify(guns.map(i => ({ id: i.id, name: i.name })))}
MEDICAL (spawn on ground, use id as code): ${JSON.stringify(medicals.map(i => ({ id: i.id, name: i.name })))}
ENEMIES (spawn enemy, use id as code): ${JSON.stringify(enemies.map(e => ({ id: e.id, name: e.name, danger: e.danger_level })))}
VALUABLES (spawn valuable, use id as code): ${JSON.stringify(valuables.map(v => ({ id: v.id, name: v.name })))}`;
    }

    // create_preset — exact format differs per game
    let createDesc, createParams;
    if (game === 'isaac') {
        createDesc = 'Save the Isaac preset. EVERY key must be a TikTok gift name. EVERY item/boss you searched for MUST appear as a command value — do not waste search results. Values: profile string like "boss_rush" | {"action":"use_item","itemId":N} for Active items | {"action":"spawn_item","itemId":N,"amount":1,"autoCollect":true/false} for any item | {"action":"spawn_boss","bossId":"X","amount":1} where bossId is the exact id from search or BOSSES list. NEVER invent itemId or bossId.';
        createParams = {
            type: 'object',
            properties: {
                name: { type: 'string' },
                commands: {
                    type: 'object',
                    description: 'Keys MUST be gift names from the PRESET GIFT KEYS list — NOT itemIds, NOT bossIds. Example where user asked for Death Certificate (id 628, Active) and Binge Eater (id 664, Passive): {"Rose":{"action":"use_item","itemId":628},"Heart":{"action":"spawn_item","itemId":664,"amount":1,"autoCollect":true},"Perfume":"boss_rush","Doughnut":{"action":"spawn_item","itemId":214,"amount":1,"autoCollect":false},"Gold Bar":{"action":"spawn_boss","bossId":"84.0","amount":1},"Ice Cream Cone":"chaos_reroll","Finger Heart":{"action":"spawn_item","itemId":42,"amount":1,"autoCollect":true}}',
                },
            },
            required: ['name', 'commands'],
        };
    } else if (game === 'repo') {
        createDesc = 'Save the Repo preset. KEY = TikTok gift name (e.g. "Rose", "Heart"). VALUE = { "code": "<effect_id>", "targetRandom": bool }. WRONG: {"spawnenemy_Hunter":{"code":"Rose",...}} RIGHT: {"Rose":{"code":"spawnenemy_Hunter",...}}. Add "duration":N only for timed effects. EVERY searched id MUST appear as a "code" value — never as a key.';
        createParams = {
            type: 'object',
            properties: {
                name: { type: 'string' },
                commands: {
                    type: 'object',
                    description: 'Keys MUST be gift names from the PRESET GIFT KEYS list — NOT effect ids. Example where user asked for Huntsman (id "spawnenemy_Hunter") and grenades: {"Rose":{"code":"spawnenemy_Hunter","targetRandom":true},"Heart":{"code":"spawncollectable_ItemGrenadeExplosive","targetRandom":true},"Doughnut":{"code":"player_heal","targetRandom":false},"Perfume":{"code":"player_fast","targetRandom":true,"duration":10},"Ice Cream Cone":{"code":"player_upgrade_health","targetRandom":false},"Gold Bar":{"code":"spawncollectable_ItemGrenadeStun","targetRandom":true},"Finger Heart":{"code":"player_upgrade_jump","targetRandom":false}}',
                },
            },
            required: ['name', 'commands'],
        };
    } else if (game === 'goi') {
        createDesc = 'Save the GOI preset. commands keys = TikTok gift names. Each value = { "code": string, "duration": N (only for timed), "count": N (only for counted) }. INSTANT (no extra field): launch, shove_left, shove_right, reset_progress. COUNTED (must have "count"): spawn_hat, spawn_orange, spawn_gift — always include at least one of these, they spawn fun objects in the world. TIMED (must have "duration"): low_gravity, high_gravity, zero_gravity, low_friction, high_friction, flip_camera, spin_camera, invert_mouse.';
        createParams = {
            type: 'object',
            properties: {
                name: { type: 'string' },
                commands: {
                    type: 'object',
                    description: 'Keys MUST be gift names from the PRESET GIFT KEYS list — NOT effect codes. Example: { "Rose": { "code": "launch" }, "Doughnut": { "code": "zero_gravity", "duration": 15 }, "Heart": { "code": "spawn_hat", "count": 3 }, "Ice Cream Cone": { "code": "reset_progress" }, "Finger Heart": { "code": "flip_camera", "duration": 10 } }',
                },
            },
            required: ['name', 'commands'],
        };
    } else {
        createDesc = 'Save the Minecraft preset. gift_commands keys = TikTok gift names. Each value is an ARRAY of RCON command strings. CRITICAL: always use a colon ":" in namespaced IDs — "minecraft:zombie" NOT "minecraft*zombie". NEVER use bare /summon — always "execute at {playername} run summon minecraft:X ~ ~ ~". Only use entity/item/effect IDs from the valid lists in the system prompt.';
        createParams = {
            type: 'object',
            properties: {
                name: { type: 'string', description: 'Creative preset name' },
                gift_commands: {
                    type: 'object',
                    description: 'Each value is an array of command strings. To name a mob after the gift sender use NBT: {CustomName:\'\\"{username}\\"\',CustomNameVisible:1b}. Examples: ["/give {playername} minecraft:diamond 1"] or ["execute at {playername} run summon minecraft:zombie ~ ~ ~"] or ["/effect give {playername} minecraft:speed 20 2 true"].',
                },
            },
            required: ['name', 'gift_commands'],
        };
    }
    const createTool = { type: 'function', function: { name: 'create_preset', description: createDesc, parameters: createParams } };

    const searchParam = { type: 'object', properties: { query: { type: 'string', description: 'Partial or full name to search for' } }, required: ['query'] };
    const searchTools = [];
    const toolHandlers = { create_preset: async (a) => handlers.createPreset(a) };

    // fuzzy fallback: if exact LIKE finds nothing, retry with each word token >= 3 chars
    const fuzzySearch = async (searchFn, mapFn, query) => {
        if (!query || typeof query !== 'string') return { error: 'query must be a string — pass only the name to search, e.g. "Huntsman"' };
        let rows = await searchFn(query);
        if (!rows.length) {
            const tokens = query.split(/[^a-zA-Z0-9]+/).filter(t => t.length >= 3);
            for (const token of tokens) {
                rows = await searchFn(token);
                if (rows.length) break;
            }
        }
        if (!rows.length) return { results: [], note: `No results for "${query}". Try a shorter or different spelling.` };
        return { results: rows.map(mapFn) };
    };

    if (game === 'isaac') {
        searchTools.push(
            { type: 'function', function: { name: 'search_boss', description: 'Search Isaac bosses by name. Returns matching bosses with their exact bossId — use that bossId in spawn_boss commands. If unsure of spelling, try a shorter substring.', parameters: searchParam } },
            { type: 'function', function: { name: 'search_item', description: 'Search Isaac items by name. Returns matching items with itemId and type (Active/Passive). If unsure of spelling, try a shorter substring (e.g. "certificate" instead of "death certificate").', parameters: searchParam } }
        );
        toolHandlers.search_boss = ({ query }) => fuzzySearch(db.searchIsaacBosses.bind(db), r => ({ bossId: r.id, name: r.name }), query);
        toolHandlers.search_item = ({ query }) => fuzzySearch(db.searchIsaacItems.bind(db), r => ({ itemId: r.id, name: r.name, quality: r.quality, type: r.type || null }), query);
    } else if (game === 'repo') {
        searchTools.push(
            { type: 'function', function: { name: 'search_enemy',    description: 'Search R.E.P.O. enemies by name. Returns matching enemies with their exact id. Try shorter substrings if unsure of spelling.', parameters: searchParam } },
            { type: 'function', function: { name: 'search_item',     description: 'Search R.E.P.O. items (guns, medicals, equipment) by name. Returns matching items with their exact id.', parameters: searchParam } },
            { type: 'function', function: { name: 'search_valuable', description: 'Search R.E.P.O. valuables by name. Returns matching valuables with their exact id.', parameters: searchParam } }
        );
        toolHandlers.search_enemy    = ({ query }) => fuzzySearch(db.searchRepoEnemies.bind(db),   r => ({ id: r.id, name: r.name, danger_level: r.danger_level }), query);
        toolHandlers.search_item     = ({ query }) => fuzzySearch(db.searchRepoItems.bind(db),     r => ({ id: r.id, name: r.name, type: r.item_type }), query);
        toolHandlers.search_valuable = ({ query }) => fuzzySearch(db.searchRepoValuables.bind(db), r => ({ id: r.id, name: r.name }), query);
    }

    // ── system prompt with all data embedded ────────────────────────────
    let systemContent, userContent;

    if (game === 'isaac') {
        systemContent = `You are a TikTok streaming preset builder for Isaac. Your job: search for any requested items/bosses, then call create_preset once with ALL gift keys mapped.

WORKFLOW:
1. Read the user request. Find every Isaac item or boss name mentioned.
2. Call search_item for each item name, search_boss for each boss name. Try shorter substrings if no results.
3. Call create_preset. Every item/boss from your searches MUST appear as a command value — searched and ignored = wrong.

${donationSummary}
${giftCostHint}
${existingPresetsHint}
${context}
COMMAND VALUES (pick one per gift key):
- "boss_rush" / "chaos_reroll" / "nightmare" / "jackpot" / "devil_deal" / "angel_deal" / "curse_room" / "sacrifice_room" — profile shortcuts
- {"action":"use_item","itemId":N} — Active item only (triggers it like a pickup)
- {"action":"spawn_item","itemId":N,"amount":1,"autoCollect":true} — item goes directly to inventory
- {"action":"spawn_item","itemId":N,"amount":1,"autoCollect":false} — item drops on floor
- {"action":"spawn_boss","bossId":"X","amount":1} — bossId = exact id from search results or BOSSES list, never a name

Use ONLY itemId/bossId values from search results or the provided lists. Never invent ids. Give the preset a creative name.`;
    } else if (game === 'repo') {
        systemContent = `You are a TikTok streaming preset builder for R.E.P.O. Call create_preset exactly once.

━━━ STRUCTURE — READ THIS FIRST ━━━
commands = { "<TikTok gift name>": { "code": "<effect_id>", ... }, ... }

  KEYS   = TikTok gift names from the PRESET GIFT KEYS list below
  VALUES = objects where "code" is an effect/spawn id

  ✗ WRONG: { "spawnenemy_Hunter": { "code": "<gift name>", "targetRandom": true } }
  ✓ RIGHT: { "<gift name>":       { "code": "spawnenemy_Hunter", "targetRandom": true } }

  ✗ WRONG: { "player_heal": { "code": "<gift name>", "targetRandom": false } }
  ✓ RIGHT: { "<gift name>": { "code": "player_heal",  "targetRandom": false } }

━━━ SEARCH RULE ━━━
If the user mentions a specific enemy, item, or valuable by name, search for it first (search_enemy / search_item / search_valuable), then use its exact returned id as "code". Every search result MUST appear in the preset.

${donationSummary}
${giftCostHint}
${existingPresetsHint}
${context}
━━━ VALUE FORMAT ━━━
{ "code": "<exact id>", "targetRandom": bool }
- Add "duration": N (5–30 s) ONLY when timed:true in the list above
- "code" must be an exact id from search results or the lists above — never invent one
- For upgrades use ONLY ids from the UPGRADE EFFECTS list
- Mix player effects, upgrades, gun/medical spawns, enemies, valuables
- Give the preset a creative name.`;
    } else if (game === 'goi') {
        systemContent = `You are a TikTok streaming preset builder for Getting Over It (GOI). Call create_preset exactly once.
${donationSummary}
${giftCostHint}
${existingPresetsHint}
EFFECT CODES — use ONLY these. Each type has a DIFFERENT extra field:

  INSTANT — no extra field at all:
    launch, shove_left, shove_right, reset_progress
    e.g. { "code": "launch" }

  COUNTED — MUST have "count": N (integer ≥ 1), NEVER "duration":
    spawn_hat, spawn_orange, spawn_gift
    e.g. { "code": "spawn_hat", "count": 2 }
    ✗ WRONG: { "code": "spawn_hat", "duration": 10 }
    ✓ RIGHT: { "code": "spawn_hat", "count": 2 }

  TIMED — MUST have "duration": N seconds (5–30), NEVER "count":
    low_gravity, high_gravity, zero_gravity, low_friction, high_friction, flip_camera, spin_camera, invert_mouse
    e.g. { "code": "zero_gravity", "duration": 15 }
    ✗ WRONG: { "code": "zero_gravity", "count": 3 }
    ✓ RIGHT: { "code": "zero_gravity", "duration": 15 }

You MUST include spawn_hat, spawn_orange, AND spawn_gift (all three) — they spawn physical objects in the world.
Match chaos to diamond cost — cheap gifts: shove_left/shove_right, expensive: reset_progress/zero_gravity.
Give a creative name different from existing ones.`;
    } else {
        systemContent = `You are a Minecraft TikTok preset builder. Call create_preset once.
${donationSummary}
${giftCostHint}
${existingPresetsHint}
PLACEHOLDERS — these are replaced at runtime before the command is sent:
- {playername} = the Minecraft player being targeted (randomly picked from the streamer's player list). Use this for /give, /effect, /tp, and as the position anchor in execute.
- {username} = TikTok username of the viewer who sent the gift. Use this for CustomName on mobs so the spawned mob is named after the viewer.
- {nickname} = TikTok display name of the viewer (prettier version of username).
- {count} = how many gifts were sent in this streak.
- {giftname} = name of the TikTok gift that was sent.

CORRECT CustomName syntax — use single quotes, double-quoted name inside:
  execute at {playername} run summon minecraft:zombie ~ ~ ~ {CustomName:'"{username}"',CustomNameVisible:1b}
  execute at {playername} run summon minecraft:creeper ~ ~1 ~ {CustomName:'"{username}"',CustomNameVisible:1b,powered:1b}
When the user asks to name mobs after the gift sender, always add {CustomName:'"{username}"',CustomNameVisible:1b} to the summon NBT.

CONTEXT: commands run via RCON from the server process — it has NO world position.
- NEVER use bare /summon — it spawns at world spawn (0,0,0), not near the player.
- To spawn near the player: execute at {playername} run summon minecraft:X ~ ~ ~
- Effects: /effect give {playername} minecraft:X <seconds> <level> true
- Items: /give {playername} minecraft:X <count>
- Weather/time need no target: /weather thunder 120, /time set night

VALID ENTITIES (hostile): minecraft:zombie, minecraft:skeleton, minecraft:creeper, minecraft:spider, minecraft:witch, minecraft:enderman, minecraft:blaze, minecraft:ghast, minecraft:slime, minecraft:wither_skeleton, minecraft:phantom, minecraft:drowned, minecraft:husk, minecraft:pillager, minecraft:ravager, minecraft:vex, minecraft:evoker, minecraft:warden, minecraft:lightning_bolt, minecraft:falling_block
VALID ENTITIES (passive): minecraft:pig, minecraft:cow, minecraft:sheep, minecraft:chicken, minecraft:wolf, minecraft:cat, minecraft:horse

VALID ITEMS: minecraft:diamond, minecraft:emerald, minecraft:gold_ingot, minecraft:netherite_ingot, minecraft:golden_apple, minecraft:enchanted_golden_apple, minecraft:cooked_beef, minecraft:bread, minecraft:ender_pearl, minecraft:nether_star, minecraft:totem_of_undying, minecraft:elytra, minecraft:diamond_sword, minecraft:diamond_pickaxe, minecraft:diamond_chestplate, minecraft:obsidian, minecraft:tnt, minecraft:anvil, minecraft:experience_bottle, minecraft:fire_charge, minecraft:snowball

VALID EFFECTS: minecraft:speed, minecraft:slowness, minecraft:haste, minecraft:mining_fatigue, minecraft:strength, minecraft:instant_health, minecraft:instant_damage, minecraft:jump_boost, minecraft:nausea, minecraft:regeneration, minecraft:resistance, minecraft:fire_resistance, minecraft:water_breathing, minecraft:invisibility, minecraft:blindness, minecraft:night_vision, minecraft:hunger, minecraft:weakness, minecraft:poison, minecraft:wither, minecraft:health_boost, minecraft:absorption, minecraft:saturation, minecraft:glowing, minecraft:levitation, minecraft:luck, minecraft:unluck, minecraft:slow_falling, minecraft:darkness

Each gift_commands value is an array of command strings. Match effect strength to diamond cost. Give a creative name.`;
    }

    userContent = userPrompt && userPrompt.trim() ? userPrompt.trim() : `Create a fun preset for ${game}.`;

    const messages = [
        { role: 'system', content: systemContent },
        { role: 'user',   content: userContent },
    ];

    return runAgent(messages, [...searchTools, createTool], toolHandlers, `preset-${game}`);
}

async function checkOllamaAvailable() {
    try {
        const res = await fetch(`${OLLAMA_URL}/api/tags`, { signal: AbortSignal.timeout(3000) });
        return res.ok;
    } catch {
        return false;
    }
}

module.exports = { suggestGame, suggestPreset, checkOllamaAvailable };
