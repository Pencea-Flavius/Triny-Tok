/**
 * db-clean.js — Strip all live/user data from global.db before pushing.
 * Keeps: gifts, isaac_*, repo_* tables intact.
 *
 * Usage: npm run db:clean
 */

const sqlite3 = require('sqlite3').verbose();
const { open } = require('sqlite');
const path = require('path');

async function clean() {
    const db = await open({
        filename: path.join(__dirname, '../../data/global.db'),
        driver: sqlite3.Database
    });

    await db.exec(`PRAGMA foreign_keys = OFF;`);

    const counts = {};
    for (const t of ['app_accounts', 'donations', 'users', 'streamers', 'presets', 'preset_minecraft', 'preset_isaac', 'preset_repo', 'preset_goi']) {
        const row = await db.get(`SELECT COUNT(*) as n FROM ${t}`).catch(() => ({ n: 0 }));
        counts[t] = row.n;
    }

    await db.exec(`
        DELETE FROM preset_minecraft;
        DELETE FROM preset_isaac;
        DELETE FROM preset_repo;
        DELETE FROM preset_goi;
        DELETE FROM presets;
        DELETE FROM donations;
        DELETE FROM users;
        DELETE FROM streamers;
        DELETE FROM app_accounts;
        DELETE FROM sqlite_sequence WHERE name IN ('donations','users','streamers','app_accounts','presets');
    `);

    await db.exec(`PRAGMA foreign_keys = ON;`);
    await db.exec(`VACUUM;`);
    await db.close();

    console.log(`[db:clean] Removed:`);
    for (const [t, n] of Object.entries(counts)) {
        console.log(`  - ${n} row(s) from ${t}`);
    }
    console.log(`[db:clean] global.db is clean. Gifts, Isaac, Repo and GOI data untouched.`);
}

clean().catch(err => {
    console.error('[db:clean] Error:', err.message);
    process.exit(1);
});
