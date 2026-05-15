'use strict';

/**
 * API integration tests.
 * These tests require the server to be running on PORT (default 3000).
 * Run `npm run dev` or `npm start` before running tests, or set TEST_API_URL.
 *
 * If the server is not running, all tests are skipped gracefully.
 */

const BASE = process.env.TEST_API_URL || 'http://localhost:3000';

async function get(path) {
    const res = await fetch(BASE + path, { redirect: 'manual' });
    return res;
}

async function post(path, body) {
    const res = await fetch(BASE + path, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        redirect: 'manual',
    });
    return res;
}

async function serverIsUp() {
    try {
        await fetch(BASE + '/', { signal: AbortSignal.timeout(1500) });
        return true;
    } catch {
        return false;
    }
}

describe('Public API routes (requires running server)', () => {
    let skip = false;

    beforeAll(async () => {
        skip = !(await serverIsUp());
        if (skip) console.warn('Server not running — skipping API tests. Start with npm run dev.');
    });

    test('GET / returns 200', async () => {
        if (skip) return;
        const res = await get('/');
        expect(res.status).toBe(200);
    });

    test('GET /app returns 200', async () => {
        if (skip) return;
        const res = await get('/app');
        expect(res.status).toBe(200);
    });

    test('GET /api/gifts returns gifts array', async () => {
        if (skip) return;
        const res = await get('/api/gifts');
        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body).toHaveProperty('gifts');
        expect(Array.isArray(body.gifts)).toBe(true);
    });

    test('GET /api/config returns minecraft config', async () => {
        if (skip) return;
        const res = await get('/api/config');
        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body).toHaveProperty('minecraft');
    });

    test('GET /api/top-donors returns array', async () => {
        if (skip) return;
        const res = await get('/api/top-donors');
        expect(res.status).toBe(200);
        const body = await res.json();
        expect(Array.isArray(body)).toBe(true);
    });

    test('GET /admin without auth redirects to login', async () => {
        if (skip) return;
        const res = await get('/admin');
        expect([302, 401, 403]).toContain(res.status);
    });

    test('POST /api/ai/preset-suggestion without auth is rejected', async () => {
        if (skip) return;
        const res = await post('/api/ai/preset-suggestion', { game: 'minecraft' });
        expect([302, 401, 403]).toContain(res.status);
    });

    test('GET /api/ai/game-suggestion without auth is rejected', async () => {
        if (skip) return;
        const res = await get('/api/ai/game-suggestion');
        expect([302, 401, 403]).toContain(res.status);
    });
});
