/**
 * db-clean.js — Run this before `git push` to strip live TikTok data from global.db.

 * Usage: npm run db:clean
 */

const sqlite3 = require('sqlite3').verbose();
const { open } = require('sqlite');
const path = require('path');

async function clean() {
    const db = await open({
        filename: path.join(__dirname, '../data/global.db'),
        driver: sqlite3.Database
    });

    await db.exec(`PRAGMA foreign_keys = OFF;`);

    const { donations } = await db.get(`SELECT COUNT(*) as donations FROM donations`);
    const { users } = await db.get(`SELECT COUNT(*) as users FROM users`);
    const { streamers } = await db.get(`SELECT COUNT(*) as streamers FROM streamers`);

    await db.exec(`
        DELETE FROM donations;
        DELETE FROM users;
        DELETE FROM streamers;
    `);

    await db.exec(`PRAGMA foreign_keys = ON;`);
    await db.exec(`VACUUM;`);
    await db.close();

    console.log(`[db:clean] Removed:`);
    console.log(`  - ${donations} donation(s)`);
    console.log(`  - ${users} user(s)`);
    console.log(`  - ${streamers} streamer(s)`);
    console.log(`[db:clean] global.db is clean and ready to push.`);
}

clean().catch(err => {
    console.error('[db:clean] Error:', err.message);
    process.exit(1);
});
