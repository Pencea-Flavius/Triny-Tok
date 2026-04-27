const sqlite3 = require('sqlite3').verbose();
const { open } = require('sqlite');
const path = require('path');
const fs = require('fs');

class DatabaseManager {
    constructor() {
        if (!DatabaseManager.instance) {
            this.globalDbPromise = null;
            this.streamerDbPromise = null;
            this.currentStreamer = null;
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
            console.log('[DB] Connected to Global SQLite database (gifts).');
            await db.exec(`
                CREATE TABLE IF NOT EXISTS gifts (
                    id INTEGER PRIMARY KEY,
                    name TEXT NOT NULL,
                    diamondCount INTEGER NOT NULL,
                    imageUrl TEXT
                );
            `);
            return db;
        }).catch(err => {
            console.error('[DB] Global connection error:', err);
            this.globalDbPromise = null;
            throw err;
        });

        return this.globalDbPromise;
    }

    async connectStreamer(uniqueId) {
        // If already connected to this streamer, return
        if (this.currentStreamer === uniqueId && this.streamerDbPromise) {
            return this.streamerDbPromise;
        }

        // Close previous if different
        if (this.streamerDbPromise) {
            try {
                const oldDb = await this.streamerDbPromise;
                await oldDb.close();
            } catch (e) {
                console.error('[DB] Failed closing previous streamer DB', e);
            }
        }

        const safeId = uniqueId.replace(/[^a-zA-Z0-9_-]/g, '_');
        const dbPath = path.join(__dirname, `../../data/streamer_${safeId}.db`);
        this.currentStreamer = uniqueId;

        this.streamerDbPromise = open({
            filename: dbPath,
            driver: sqlite3.Database
        }).then(async (db) => {
            console.log(`[DB] Connected to Streamer DB for @${uniqueId}`);
            await db.exec(`
                CREATE TABLE IF NOT EXISTS users (
                    userId TEXT PRIMARY KEY,
                    uniqueId TEXT,
                    nickname TEXT,
                    profilePictureUrl TEXT,
                    totalDiamonds INTEGER DEFAULT 0,
                    lastSeen DATETIME DEFAULT CURRENT_TIMESTAMP
                );

                CREATE TABLE IF NOT EXISTS donations (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    userId TEXT,
                    giftId INTEGER,
                    count INTEGER DEFAULT 1,
                    totalDiamonds INTEGER DEFAULT 0,
                    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY(userId) REFERENCES users(userId)
                );
            `);
            return db;
        }).catch(err => {
            console.error(`[DB] Streamer connection error for @${uniqueId}:`, err);
            this.streamerDbPromise = null;
            this.currentStreamer = null;
            throw err;
        });

        return this.streamerDbPromise;
    }

    // --- Users (Streamer DB) ---
    async upsertUser(user) {
        if (!this.streamerDbPromise) return;
        const db = await this.streamerDbPromise;
        const { userId, uniqueId, nickname, profilePictureUrl, addedDiamonds = 0 } = user;
        
        await db.run(`
            INSERT INTO users (userId, uniqueId, nickname, profilePictureUrl, totalDiamonds, lastSeen)
            VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
            ON CONFLICT(userId) DO UPDATE SET 
                uniqueId = excluded.uniqueId,
                nickname = excluded.nickname,
                profilePictureUrl = excluded.profilePictureUrl,
                totalDiamonds = totalDiamonds + excluded.totalDiamonds,
                lastSeen = CURRENT_TIMESTAMP
        `, [userId, uniqueId, nickname, profilePictureUrl, addedDiamonds]);
    }

    async getTopDonors(limit = 50) {
        if (!this.streamerDbPromise) return [];
        const db = await this.streamerDbPromise;
        return await db.all(`SELECT * FROM users ORDER BY totalDiamonds DESC LIMIT ?`, [limit]);
    }

    async getTotalDiamonds() {
        if (!this.streamerDbPromise) return 0;
        const db = await this.streamerDbPromise;
        const result = await db.get(`SELECT SUM(totalDiamonds) as sum FROM users`);
        return result.sum || 0;
    }

    // --- Gifts (Global DB) ---
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
        return await db.all(`SELECT * FROM gifts`);
    }

    async deleteGift(id) {
        const db = await this.connectGlobal();
        const result = await db.run(`DELETE FROM gifts WHERE id = ?`, [id]);
        return result.changes;
    }

    // --- Donations (Streamer DB) ---
    async recordDonation(userId, giftId, count, totalDiamonds) {
        if (!this.streamerDbPromise) return;
        const db = await this.streamerDbPromise;
        await db.run(`
            INSERT INTO donations (userId, giftId, count, totalDiamonds)
            VALUES (?, ?, ?, ?)
        `, [userId, giftId, count, totalDiamonds]);
    }
}

const instance = new DatabaseManager();
module.exports = instance;
