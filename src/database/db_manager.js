const sqlite3 = require('sqlite3').verbose();
const { open } = require('sqlite');
const path = require('path');
const fs = require('fs');

class DatabaseManager {
    constructor() {
        if (!DatabaseManager.instance) {
            this.globalDbPromise = null;
            this.currentStreamerId = null;
            DatabaseManager.instance = this;
        }
        return DatabaseManager.instance;
    }

    async connectGlobal() {
        if (this.globalDbPromise) return this.globalDbPromise;

        const dbPath = path.join(__dirname, '../../data/global.db');
        const dataDir = path.dirname(dbPath);
        if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

        this.globalDbPromise = open({
            filename: dbPath,
            driver: sqlite3.Database
        }).then(async (db) => {
            await db.exec(`PRAGMA foreign_keys = ON;`);
            await db.exec(`
                CREATE TABLE IF NOT EXISTS gifts (
                    id INTEGER PRIMARY KEY,
                    name TEXT NOT NULL,
                    diamondCount INTEGER NOT NULL,
                    imageUrl TEXT
                );

                CREATE TABLE IF NOT EXISTS isaac_items (
                    id INTEGER PRIMARY KEY,
                    name TEXT NOT NULL,
                    quality INTEGER
                );

                CREATE TABLE IF NOT EXISTS isaac_types (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    name TEXT UNIQUE NOT NULL
                );

                CREATE TABLE IF NOT EXISTS isaac_item_types (
                    item_id INTEGER,
                    type_id INTEGER,
                    PRIMARY KEY (item_id, type_id),
                    FOREIGN KEY (item_id) REFERENCES isaac_items(id) ON DELETE CASCADE,
                    FOREIGN KEY (type_id) REFERENCES isaac_types(id) ON DELETE CASCADE
                );

                CREATE TABLE IF NOT EXISTS isaac_pools (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    name TEXT UNIQUE NOT NULL
                );

                CREATE TABLE IF NOT EXISTS isaac_item_pools (
                    item_id INTEGER,
                    pool_id INTEGER,
                    PRIMARY KEY (item_id, pool_id),
                    FOREIGN KEY (item_id) REFERENCES isaac_items(id) ON DELETE CASCADE,
                    FOREIGN KEY (pool_id) REFERENCES isaac_pools(id) ON DELETE CASCADE
                );

                CREATE TABLE IF NOT EXISTS isaac_bosses (
                    id TEXT PRIMARY KEY,
                    name TEXT NOT NULL,
                    base_hp INTEGER,
                    stage_hp INTEGER
                );

                CREATE TABLE IF NOT EXISTS repo_valuables (
                    id TEXT PRIMARY KEY,
                    name TEXT NOT NULL,
                    biome TEXT,
                    size TEXT NOT NULL,
                    mass REAL
                );

                CREATE TABLE IF NOT EXISTS repo_items (
                    id TEXT PRIMARY KEY,
                    name TEXT NOT NULL,
                    item_type TEXT
                );

                CREATE TABLE IF NOT EXISTS repo_enemies (
                    id TEXT PRIMARY KEY,
                    name TEXT NOT NULL,
                    in_game_name TEXT,
                    hp INTEGER,
                    danger_level INTEGER,
                    damage TEXT,
                    strength_breakpoint INTEGER,
                    strength_breakpoint_stunned INTEGER,
                    attacks_crouched TEXT,
                    orb_size TEXT,
                    behavior TEXT
                );

                CREATE TABLE IF NOT EXISTS app_accounts (
                    id                   INTEGER PRIMARY KEY AUTOINCREMENT,
                    username             TEXT UNIQUE NOT NULL,
                    email                TEXT UNIQUE NOT NULL,
                    first_name           TEXT NOT NULL,
                    last_name            TEXT NOT NULL,
                    password_hash        TEXT NOT NULL,
                    birth_date           DATE NOT NULL,
                    email_verified       INTEGER DEFAULT 0,
                    verification_token   TEXT,
                    reset_token          TEXT,
                    reset_token_expires  DATETIME,
                    created_at           DATETIME DEFAULT CURRENT_TIMESTAMP
                );

                CREATE TABLE IF NOT EXISTS streamers (
                    id         INTEGER PRIMARY KEY,
                    uniqueId   TEXT UNIQUE NOT NULL,
                    account_id INTEGER REFERENCES app_accounts(id) ON DELETE SET NULL
                );

                CREATE TABLE IF NOT EXISTS users (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    streamerId INTEGER NOT NULL,
                    userId TEXT NOT NULL,
                    uniqueId TEXT,
                    nickname TEXT,
                    totalDiamonds INTEGER DEFAULT 0,
                    lastSeen DATETIME DEFAULT CURRENT_TIMESTAMP,
                    UNIQUE(streamerId, userId),
                    FOREIGN KEY(streamerId) REFERENCES streamers(id) ON DELETE CASCADE
                );

                CREATE TABLE IF NOT EXISTS donations (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    streamerId INTEGER NOT NULL,
                    userId TEXT,
                    user_id INTEGER,
                    giftId INTEGER,
                    count INTEGER DEFAULT 1,
                    totalDiamonds INTEGER DEFAULT 0,
                    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY(streamerId) REFERENCES streamers(id) ON DELETE CASCADE,
                    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE SET NULL,
                    FOREIGN KEY(giftId) REFERENCES gifts(id)
                );
            `);

            console.log('[DB] Connected to global.db.');

            // Migration: drop profilePictureUrl column if it still exists from an older schema
            // (avatars are now always derived from uniqueId via unavatar.io at runtime)
            try {
                const cols = await db.all(`PRAGMA table_info(users)`);
                if (cols.some(c => c.name === 'profilePictureUrl')) {
                    await db.run(`ALTER TABLE users DROP COLUMN profilePictureUrl`);
                    console.log('[DB] Migration: dropped profilePictureUrl column from users table.');
                }
            } catch (e) {
                console.warn('[DB] Migration warning (profilePictureUrl):', e.message);
            }

            return db;
        }).catch(err => {
            console.error('[DB] global.db connection error:', err);
            this.globalDbPromise = null;
            throw err;
        });

        return this.globalDbPromise;
    }

    // Alias — păstrat ca să nu crape nimic din cod vechi
    async connectLocal() {
        return this.connectGlobal();
    }

    // --- App Accounts ---
    async createAccount({ username, email, firstName, lastName, passwordHash, birthDate }) {
        const db = await this.connectGlobal();
        const result = await db.run(
            `INSERT INTO app_accounts (username, email, first_name, last_name, password_hash, birth_date)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [username, email, firstName, lastName, passwordHash, birthDate]
        );
        // Automatically link to streamer (username = TikTok handle)
        const normalized = username.replace(/^@/, '').trim().toLowerCase();
        await db.run(`INSERT OR IGNORE INTO streamers (uniqueId) VALUES (?)`, [normalized]);
        await db.run(`UPDATE streamers SET account_id = ? WHERE uniqueId = ?`, [result.lastID, normalized]);
        return result.lastID;
    }

    async getAccountByUsername(username) {
        const db = await this.connectGlobal();
        return db.get(`SELECT * FROM app_accounts WHERE username = ?`, [username]);
    }

    async getAccountByEmail(email) {
        const db = await this.connectGlobal();
        return db.get(`SELECT * FROM app_accounts WHERE email = ?`, [email]);
    }

    async getAccountById(id) {
        const db = await this.connectGlobal();
        return db.get(`SELECT * FROM app_accounts WHERE id = ?`, [id]);
    }

    async setCurrentStreamer(uniqueId) {
        const normalized = uniqueId.replace(/^@/, '').trim().toLowerCase();
        const db = await this.connectGlobal();
        await db.run(`INSERT OR IGNORE INTO streamers (uniqueId) VALUES (?)`, [normalized]);
        const row = await db.get(`SELECT id FROM streamers WHERE uniqueId = ?`, [normalized]);
        this.currentStreamerId = row.id;
        console.log(`[DB] Streamer context: @${normalized} (id=${this.currentStreamerId})`);
    }

    // --- Users ---
    async upsertUser(user) {
        if (!this.currentStreamerId) return;
        const db = await this.connectGlobal();
        const { userId, uniqueId, nickname, addedDiamonds = 0 } = user;

        // NOTE: profilePictureUrl is intentionally NOT stored — TikTok CDN URLs are signed
        // and expire after a few days. The avatar is always generated dynamically from uniqueId.
        await db.run(`
            INSERT INTO users (streamerId, userId, uniqueId, nickname, totalDiamonds, lastSeen)
            VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
            ON CONFLICT(streamerId, userId) DO UPDATE SET
                uniqueId = excluded.uniqueId,
                nickname = excluded.nickname,
                totalDiamonds = totalDiamonds + excluded.totalDiamonds,
                lastSeen = CURRENT_TIMESTAMP
        `, [this.currentStreamerId, userId, uniqueId, nickname, addedDiamonds]);
    }

    async getTopDonors(limit = 50) {
        if (!this.currentStreamerId) return [];
        const db = await this.connectGlobal();
        return db.all(
            `SELECT * FROM users WHERE streamerId = ? ORDER BY totalDiamonds DESC LIMIT ?`,
            [this.currentStreamerId, limit]
        );
    }

    async getTotalDiamonds() {
        if (!this.currentStreamerId) return 0;
        const db = await this.connectGlobal();
        const result = await db.get(
            `SELECT SUM(totalDiamonds) as sum FROM users WHERE streamerId = ?`,
            [this.currentStreamerId]
        );
        return result.sum || 0;
    }

    // --- Gifts ---
    async upsertGift(gift) {
        const db = await this.connectGlobal();
        const { id, name, diamondCount, imageUrl } = gift;
        await db.run(`
            INSERT INTO gifts (id, name, diamondCount, imageUrl)
            VALUES (?, ?, ?, ?)
            ON CONFLICT(id) DO UPDATE SET
                name = excluded.name,
                diamondCount = excluded.diamondCount,
                imageUrl = excluded.imageUrl
        `, [id, name, diamondCount, imageUrl]);
    }

    async getGifts() {
        const db = await this.connectGlobal();
        return db.all(`SELECT * FROM gifts`);
    }

    async deleteGift(id) {
        const db = await this.connectGlobal();
        const result = await db.run(`DELETE FROM gifts WHERE id = ?`, [id]);
        return result.changes;
    }

    // --- Donations ---
    async recordDonation(userId, giftId, count, totalDiamonds) {
        if (!this.currentStreamerId) return;
        const db = await this.connectGlobal();

        // Look up the user's integer PK so we have a real FK
        const userRow = await db.get(
            `SELECT id FROM users WHERE streamerId = ? AND userId = ?`,
            [this.currentStreamerId, userId]
        );

        await db.run(`
            INSERT INTO donations (streamerId, userId, user_id, giftId, count, totalDiamonds)
            VALUES (?, ?, ?, ?, ?, ?)
        `, [this.currentStreamerId, userId, userRow?.id ?? null, giftId, count, totalDiamonds]);
    }

    // --- Isaac Items ---
    async upsertIsaacItem(item) {
        const db = await this.connectGlobal();
        const { id, name, quality, type, pool } = item;

        await db.run(`
            INSERT INTO isaac_items (id, name, quality)
            VALUES (?, ?, ?)
            ON CONFLICT(id) DO UPDATE SET
                name = excluded.name,
                quality = excluded.quality
        `, [id, name, quality]);

        if (type) {
            const typeNames = type.split(',').map(t => t.trim()).filter(t => t);
            await db.run(`DELETE FROM isaac_item_types WHERE item_id = ?`, [id]);
            for (const typeName of typeNames) {
                await db.run(`INSERT OR IGNORE INTO isaac_types (name) VALUES (?)`, [typeName]);
                const typeRow = await db.get(`SELECT id FROM isaac_types WHERE name = ?`, [typeName]);
                await db.run(`INSERT OR IGNORE INTO isaac_item_types (item_id, type_id) VALUES (?, ?)`, [id, typeRow.id]);
            }
        }

        if (pool) {
            const poolNames = pool.split(',').map(p => p.trim()).filter(p => p);
            await db.run(`DELETE FROM isaac_item_pools WHERE item_id = ?`, [id]);
            for (const poolName of poolNames) {
                await db.run(`INSERT OR IGNORE INTO isaac_pools (name) VALUES (?)`, [poolName]);
                const poolRow = await db.get(`SELECT id FROM isaac_pools WHERE name = ?`, [poolName]);
                await db.run(`INSERT OR IGNORE INTO isaac_item_pools (item_id, pool_id) VALUES (?, ?)`, [id, poolRow.id]);
            }
        }
    }

    async getIsaacItems() {
        const db = await this.connectGlobal();
        return db.all(`
            SELECT
                i.*,
                GROUP_CONCAT(DISTINCT p.name) as pool,
                GROUP_CONCAT(DISTINCT t.name) as type
            FROM isaac_items i
            LEFT JOIN isaac_item_pools ip ON i.id = ip.item_id
            LEFT JOIN isaac_pools p ON ip.pool_id = p.id
            LEFT JOIN isaac_item_types it ON i.id = it.item_id
            LEFT JOIN isaac_types t ON it.type_id = t.id
            GROUP BY i.id
            ORDER BY i.id
        `);
    }

    async getIsaacPools() {
        const db = await this.connectGlobal();
        return db.all(`SELECT name FROM isaac_pools ORDER BY name`);
    }

    async getIsaacTypes() {
        const db = await this.connectGlobal();
        return db.all(`SELECT name FROM isaac_types ORDER BY name`);
    }

    // --- Isaac Bosses ---
    async getIsaacBosses() {
        const db = await this.connectGlobal();
        return db.all(`SELECT * FROM isaac_bosses ORDER BY name`);
    }

    // --- REPO Valuables ---
    async getRepoValuables() {
        const db = await this.connectGlobal();
        return db.all(`SELECT * FROM repo_valuables ORDER BY biome NULLS FIRST, size, name`);
    }

    async updateValuableMass(id, mass) {
        const db = await this.connectGlobal();
        await db.run(`UPDATE repo_valuables SET mass = ? WHERE id = ?`, [mass, id]);
    }

    // --- REPO Items ---
    async getRepoItems() {
        const db = await this.connectGlobal();
        return db.all(`SELECT * FROM repo_items ORDER BY name`);
    }

    // --- REPO Enemies ---
    async getRepoEnemies() {
        const db = await this.connectGlobal();
        return db.all(`SELECT * FROM repo_enemies ORDER BY name`);
    }

    async updateEnemyStats(id, stats) {
        const db = await this.connectGlobal();
        const fields = Object.keys(stats).map(k => `${k} = ?`).join(', ');
        await db.run(
            `UPDATE repo_enemies SET ${fields} WHERE id = ?`,
            [...Object.values(stats), id]
        );
    }
}


const instance = new DatabaseManager();
module.exports = instance;
