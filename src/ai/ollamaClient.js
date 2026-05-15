
const OLLAMA_URL = process.env.OLLAMA_URL || 'http://localhost:11434';
const MODEL = process.env.OLLAMA_MODEL || 'qwen2.5:7b';
const { getTopGamesByCategory } = require('./twitchClient');

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
                const cmdExample = isMinecraft
                    ? '"gift_commands": { "Rose": ["/give {playername} minecraft:diamond 1"], "Heart": ["/effect give {playername} minecraft:regeneration 10 1 true"], "Galaxy Brain": ["/effect give {playername} minecraft:speed 20 2 true"] }'
                    : '"commands": { "GiftName": { ... } }';
                msgs.push({ role: 'user', content: `You MUST call the create_preset tool now. Do not explain — just call it. Required fields: "name" (string) and ${cmdField} (object mapping gift names to effects). Example: { "name": "My Preset", ${cmdExample} }` });
                continue;
            }
            console.log(`${tag} ✓ final answer: ${(msg.content || '').slice(0, 160)}${(msg.content || '').length > 160 ? '…' : ''}`);
            console.log(`${tag} ─── done ────────────────────────────────\n`);
            return msg.content;
        }

        for (const call of msg.tool_calls) {
            const name = call.function.name;
            const args = call.function.arguments || {};
            if (name === 'create_preset') calledCreatePreset = true;
            console.log(`${tag} ⚙  tool call: ${name}(${JSON.stringify(args)})`);

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
                    msgs.push({ role: 'user', content: `create_preset failed: ${result.error}\nCall create_preset again. Required fields: "name" (string, e.g. "Chaos Run") and "commands" (object mapping gift names to effects). Do not omit "name".` });
                } else if (result && result.success) {
                    // success — stop immediately, don't let AI call it again
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
    const realLines = giftList.filter(g => g.real).map(g => `  ${g.gift} (${g.diamonds} diamonds, donated ${g.count}x)`);
    const preferredLines = giftList.filter(g => g.preferred && !g.real).map(g => `  ${g.gift} (${g.diamonds} diamonds)`);
    const fallbackLines = giftList.filter(g => !g.real && !g.preferred).map(g => `  ${g.gift} (${g.diamonds} diamonds)`);
    const giftCostHint = `PRESET GIFT KEYS — choose 5 to 12 of these as command keys. Match effect strength to diamond cost.
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
            handlers.getBosses(8),
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
        createDesc = 'Save the Isaac preset. EVERY key in commands must be a TikTok gift name. Each value is one of these — a profile string like "boss_rush", OR an object like {"action":"spawn_item","itemId":706,"amount":1,"autoCollect":false}, OR {"action":"use_item","itemId":361}, OR {"action":"spawn_boss","bossId":"monstro","amount":1}. NEVER put itemId/amount/autoCollect as top-level keys in commands — they must be inside the object value.';
        createParams = {
            type: 'object',
            properties: {
                name: { type: 'string' },
                commands: { type: 'object', description: 'Example: {"Rose":"boss_rush","Galaxy Brain":{"action":"use_item","itemId":361},"Heart":{"action":"spawn_item","itemId":706,"amount":1,"autoCollect":true},"White Rose":{"action":"spawn_item","itemId":214,"amount":1,"autoCollect":false},"TikTok Universe":{"action":"spawn_boss","bossId":"monstro","amount":1}}' },
            },
            required: ['name', 'commands'],
        };
    } else if (game === 'repo') {
        createDesc = 'Save the Repo preset. commands keys = TikTok gift names. Values = { "code": string, "targetRandom": bool, "duration": N (only for timed effects) }. Code can be: a basic effect id (e.g. "player_heal", "player_fast"), a spawn item id, a spawn enemy id, a spawn valuable id, or an upgrade effect id (e.g. "player_upgrade_energy" to apply upgrade instantly). Mix all types.';
        createParams = {
            type: 'object',
            properties: {
                name: { type: 'string' },
                commands: { type: 'object', description: '{ "GiftName": { "code": "player_heal", "targetRandom": false } } or { "GiftName": { "code": "spawnenemy_...", "targetRandom": true } }' },
            },
            required: ['name', 'commands'],
        };
    } else if (game === 'goi') {
        createDesc = 'Save the GOI preset. commands keys = TikTok gift names. Each value = { "code": string, "duration": N (only for timed effects), "count": N (only for counted effects) }. INSTANT codes (no duration): launch, shove_left, shove_right, reset_progress. COUNTED codes (add count field): spawn_hat, spawn_orange, spawn_gift. TIMED codes (add duration in seconds): low_gravity, high_gravity, zero_gravity, low_friction, high_friction, flip_camera, spin_camera, invert_mouse.';
        createParams = {
            type: 'object',
            properties: {
                name: { type: 'string' },
                commands: {
                    type: 'object',
                    description: 'Example: { "Rose": { "code": "launch" }, "Galaxy Brain": { "code": "zero_gravity", "duration": 15 }, "Heart": { "code": "spawn_hat", "count": 3 }, "TikTok Universe": { "code": "reset_progress" }, "Ice Cream Cone": { "code": "flip_camera", "duration": 10 } }',
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
    const toolHandlers = { create_preset: async (a) => handlers.createPreset(a) };

    // ── system prompt with all data embedded ────────────────────────────
    let systemContent, userContent;

    if (game === 'isaac') {
        systemContent = `You are a TikTok streaming preset builder for Isaac. Call create_preset exactly once with all gift names as keys.
${donationSummary}
${giftCostHint}
${existingPresetsHint}
${context}
Rules:
- Each key = a gift name from the gift list above
- Values: profile id string | {"action":"use_item","itemId":N} for ACTIVE items only | {"action":"spawn_item","itemId":N,"amount":1,"autoCollect":false} spawns item on the floor (player must walk over it) | {"action":"spawn_item","itemId":N,"amount":1,"autoCollect":true} adds item directly to inventory (instant, no pickup needed) | {"action":"spawn_boss","bossId":"id","amount":1}
- autoCollect true = viewer gives a gift, player instantly gets the item — use for rewards and fun. autoCollect false = item drops on floor — use when you want the player to choose whether to pick it up (risky items, curses)
- Mix all types. Use itemId/bossId ONLY from the lists above.
- Give the preset a creative name different from existing ones.`;
    } else if (game === 'repo') {
        systemContent = `You are a TikTok streaming preset builder for R.E.P.O. Call create_preset exactly once with all gift names as keys.
${donationSummary}
${giftCostHint}
${existingPresetsHint}
${context}
Rules:
- Each key = a gift name from the gift list. Values: {"code":"id","targetRandom":bool} or add "duration":N for timed effects.
- "code" MUST be an exact id from the lists above. NEVER invent or guess a code.
- For upgrades, use ONLY ids from UPGRADE EFFECTS (e.g. "player_upgrade_jump"). Do NOT use spawncollectable upgrade ids as codes.
- Timed effects (timed:true) need "duration" in seconds (5-30). Instant effects must NOT have "duration".
- Mix player effects, upgrade effects, gun/medical spawns, enemies and valuables.
- Give the preset a creative name different from existing ones.`;
    } else if (game === 'goi') {
        systemContent = `You are a TikTok streaming preset builder for Getting Over It (GOI). Call create_preset exactly once.
${donationSummary}
${giftCostHint}
${existingPresetsHint}
AVAILABLE EFFECT CODES — use ONLY these exact ids:
  Instant (no duration): launch, shove_left, shove_right, reset_progress
  Counted (add "count": N): spawn_hat, spawn_orange, spawn_gift
  Timed (add "duration": seconds): low_gravity, high_gravity, zero_gravity, low_friction, high_friction, flip_camera, spin_camera, invert_mouse
Format: { "code": "launch" } or { "code": "zero_gravity", "duration": 15 } or { "code": "spawn_hat", "count": 3 }
Match chaos level to diamond cost — cheap gifts get minor effects (shove), expensive gifts get evil ones (reset_progress, zero_gravity).
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

    return runAgent(messages, [createTool], toolHandlers, `preset-${game}`);
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
