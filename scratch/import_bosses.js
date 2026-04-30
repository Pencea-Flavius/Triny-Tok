const sqlite3 = require('sqlite3').verbose();
const { open } = require('sqlite');
const path = require('path');
const fs = require('fs');

async function run() {
    const dbPath = path.join(__dirname, '../data/global.db');
    const bossesJsonPath = path.join(__dirname, '../../bosses.json');

    if (!fs.existsSync(bossesJsonPath)) {
        console.error('bosses.json not found at', bossesJsonPath);
        return;
    }

    const bosses = JSON.parse(fs.readFileSync(bossesJsonPath, 'utf8'));
    console.log(`Read ${bosses.length} bosses from JSON.`);

    const db = await open({
        filename: dbPath,
        driver: sqlite3.Database
    });

    await db.exec(`
        CREATE TABLE IF NOT EXISTS isaac_bosses (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            base_hp INTEGER,
            stage_hp INTEGER
        );
    `);

    console.log('Table isaac_bosses ensured.');

    await db.run('DELETE FROM isaac_bosses'); // Clear old data

    const stmt = await db.prepare('INSERT INTO isaac_bosses (id, name, base_hp, stage_hp) VALUES (?, ?, ?, ?)');

    for (const boss of bosses) {
        if (!boss.entity_id) continue;
        await stmt.run(boss.entity_id, boss.name, boss.base_hp || 0, boss.stage_hp || 0);
    }

    await stmt.finalize();
    console.log('Imported bosses into global.db.');

    await db.close();
}

run().catch(console.error);
