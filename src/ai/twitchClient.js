
let tokenCache = { token: null, expiresAt: 0 };
let gamesCache = { data: null, timestamp: 0 };
const GAMES_CACHE_TTL = 10 * 60 * 1000; // 10 min

async function getAccessToken() {
    if (tokenCache.token && Date.now() < tokenCache.expiresAt - 60000) {
        return tokenCache.token;
    }

    const clientId = process.env.TWITCH_CLIENT_ID;
    const clientSecret = process.env.TWITCH_CLIENT_SECRET;

    const res = await fetch('https://id.twitch.tv/oauth2/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: 'client_id=' + clientId + '&client_secret=' + clientSecret + '&grant_type=client_credentials',
    });

    if (!res.ok) throw new Error('Twitch token error: ' + res.status);

    const json = await res.json();
    tokenCache = { token: json.access_token, expiresAt: Date.now() + json.expires_in * 1000 };
    return tokenCache.token;
}

async function getTopGames(limit = 10) {
    if (!process.env.TWITCH_CLIENT_ID || !process.env.TWITCH_CLIENT_SECRET) {
        return { error: 'Twitch credentials not configured (TWITCH_CLIENT_ID / TWITCH_CLIENT_SECRET missing from .env)' };
    }

    if (gamesCache.data && Date.now() - gamesCache.timestamp < GAMES_CACHE_TTL) {
        return gamesCache.data;
    }

    try {
        const token = await getAccessToken();
        const res = await fetch('https://api.twitch.tv/helix/streams?first=' + limit + '&type=live', {
            headers: {
                'Client-ID': TWITCH_CLIENT_ID,
                'Authorization': 'Bearer ' + token,
            },
        });

        if (!res.ok) throw new Error('Twitch API error: ' + res.status);

        const json = await res.json();

        // aggregate viewer counts per game
        const gameMap = {};
        for (const stream of json.data || []) {
            const name = stream.game_name;
            if (!name) continue;
            if (!gameMap[name]) gameMap[name] = { game: name, viewers: 0, streams: 0 };
            gameMap[name].viewers += stream.viewer_count;
            gameMap[name].streams += 1;
        }

        const result = Object.values(gameMap)
            .sort((a, b) => b.viewers - a.viewers)
            .slice(0, limit);

        gamesCache = { data: result, timestamp: Date.now() };
        return result;
    } catch (err) {
        console.error('[Twitch]', err.message);
        return { error: err.message };
    }
}

// Fetch top games by category (more accurate — uses /games/top endpoint)
async function getTopGamesByCategory(limit = 10) {
    if (!process.env.TWITCH_CLIENT_ID || !process.env.TWITCH_CLIENT_SECRET) {
        return { error: 'Twitch credentials not configured (TWITCH_CLIENT_ID / TWITCH_CLIENT_SECRET missing from .env)' };
    }

    if (gamesCache.data && Date.now() - gamesCache.timestamp < GAMES_CACHE_TTL) {
        return gamesCache.data;
    }

    try {
        const token = await getAccessToken();
        const res = await fetch('https://api.twitch.tv/helix/games/top?first=' + limit, {
            headers: {
                'Client-ID': process.env.TWITCH_CLIENT_ID,
                'Authorization': 'Bearer ' + token,
            },
        });

        if (!res.ok) throw new Error('Twitch API error: ' + res.status);

        const json = await res.json();
        const result = (json.data || []).map((g, i) => ({ rank: i + 1, game: g.name }));

        gamesCache = { data: result, timestamp: Date.now() };
        return result;
    } catch (err) {
        console.error('[Twitch]', err.message);
        return { error: err.message };
    }
}

module.exports = { getTopGamesByCategory };
