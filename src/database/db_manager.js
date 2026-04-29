const sqlite3 = require('sqlite3').verbose();
const { open } = require('sqlite');
const path = require('path');
const fs = require('fs');

class DatabaseManager {
    constructor() {
        if (!DatabaseManager.instance) {
            this.globalDbPromise = null; // global.db — gifts (pushable)
            this.localDbPromise = null;  // trinytok.db — streamers/users/donations (gitignored)
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
            await db.exec(`
                CREATE TABLE IF NOT EXISTS gifts (
                    id INTEGER PRIMARY KEY,
                    name TEXT NOT NULL,
                    diamondCount INTEGER NOT NULL,
                    imageUrl TEXT
                );
            `);
            console.log('[DB] Connected to global.db (gifts).');
            return db;
        }).catch(err => {
            console.error('[DB] global.db connection error:', err);
            this.globalDbPromise = null;
            throw err;
        });

        return this.globalDbPromise;
    }

    async connectLocal() {
        if (this.localDbPromise) return this.localDbPromise;

        const dbPath = path.join(__dirname, '../../data/trinytok.db');
        const dataDir = path.dirname(dbPath);
        if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

        this.localDbPromise = open({
            filename: dbPath,
            driver: sqlite3.Database
        }).then(async (db) => {
            await db.exec(`PRAGMA foreign_keys = ON;`);
            await db.exec(`
                CREATE TABLE IF NOT EXISTS streamers (
                    id INTEGER PRIMARY KEY,
                    uniqueId TEXT UNIQUE NOT NULL
                );

                CREATE TABLE IF NOT EXISTS users (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    streamerId INTEGER NOT NULL,
                    userId TEXT NOT NULL,
                    uniqueId TEXT,
                    nickname TEXT,
                    profilePictureUrl TEXT,
                    totalDiamonds INTEGER DEFAULT 0,
                    lastSeen DATETIME DEFAULT CURRENT_TIMESTAMP,
                    UNIQUE(streamerId, userId),
                    FOREIGN KEY(streamerId) REFERENCES streamers(id)
                );

                CREATE TABLE IF NOT EXISTS donations (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    streamerId INTEGER NOT NULL,
                    userId TEXT,
                    giftId INTEGER,
                    count INTEGER DEFAULT 1,
                    totalDiamonds INTEGER DEFAULT 0,
                    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY(streamerId) REFERENCES streamers(id)
                );
            `);
            console.log('[DB] Connected to trinytok.db (users/donations).');
            return db;
        }).catch(err => {
            console.error('[DB] trinytok.db connection error:', err);
            this.localDbPromise = null;
            throw err;
        });

        return this.localDbPromise;
    }

    async setCurrentStreamer(uniqueId) {
        const normalized = uniqueId.replace(/^@/, '').trim().toLowerCase();
        const db = await this.connectLocal();
        await db.run(`INSERT OR IGNORE INTO streamers (uniqueId) VALUES (?)`, [normalized]);
        const row = await db.get(`SELECT id FROM streamers WHERE uniqueId = ?`, [normalized]);
        this.currentStreamerId = row.id;
        console.log(`[DB] Streamer context: @${normalized} (id=${this.currentStreamerId})`);
    }

    // --- Users (trinytok.db) ---
    async upsertUser(user) {
        if (!this.currentStreamerId) return;
        const db = await this.connectLocal();
        const { userId, uniqueId, nickname, profilePictureUrl, addedDiamonds = 0 } = user;

        await db.run(`
            INSERT INTO users (streamerId, userId, uniqueId, nickname, profilePictureUrl, totalDiamonds, lastSeen)
            VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
            ON CONFLICT(streamerId, userId) DO UPDATE SET
                uniqueId = excluded.uniqueId,
                nickname = excluded.nickname,
                profilePictureUrl = excluded.profilePictureUrl,
                totalDiamonds = totalDiamonds + excluded.totalDiamonds,
                lastSeen = CURRENT_TIMESTAMP
        `, [this.currentStreamerId, userId, uniqueId, nickname, profilePictureUrl, addedDiamonds]);
    }

    async getTopDonors(limit = 50) {
        if (!this.currentStreamerId) return [];
        const db = await this.connectLocal();
        return db.all(
            `SELECT * FROM users WHERE streamerId = ? ORDER BY totalDiamonds DESC LIMIT ?`,
            [this.currentStreamerId, limit]
        );
    }

    async getTotalDiamonds() {
        if (!this.currentStreamerId) return 0;
        const db = await this.connectLocal();
        const result = await db.get(
            `SELECT SUM(totalDiamonds) as sum FROM users WHERE streamerId = ?`,
            [this.currentStreamerId]
        );
        return result.sum || 0;
    }

    // --- Gifts (global.db) ---
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

    // --- Donations (trinytok.db) ---
    async recordDonation(userId, giftId, count, totalDiamonds) {
        if (!this.currentStreamerId) return;
        const db = await this.connectLocal();
        await db.run(`
            INSERT INTO donations (streamerId, userId, giftId, count, totalDiamonds)
            VALUES (?, ?, ?, ?, ?)
        `, [this.currentStreamerId, userId, giftId, count, totalDiamonds]);
    }
}

const instance = new DatabaseManager();
module.exports = instance;
