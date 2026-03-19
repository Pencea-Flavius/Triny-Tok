const sqlite3 = require('sqlite3').verbose();
const { open } = require('sqlite');
const path = require('path');
const fs = require('fs');

class DatabaseManager {
    constructor() {
        if (!DatabaseManager.instance) {
            this.dbPromise = null;
            DatabaseManager.instance = this;
        }
        return DatabaseManager.instance;
    }

    async connect() {
        if (this.dbPromise) return this.dbPromise;

        const dbPath = path.join(__dirname, '../../data/trinytok.db');
        
        // Ensure data directory exists
        const dataDir = path.dirname(dbPath);
        if (!fs.existsSync(dataDir)) {
            fs.mkdirSync(dataDir, { recursive: true });
        }

        this.dbPromise = open({
            filename: dbPath,
            driver: sqlite3.Database
        }).then(async (db) => {
            console.log('[DB] Connected to SQLite database.');
            await this.initSchema(db);
            return db;
        }).catch(err => {
            console.error('[DB] Connection error:', err);
            this.dbPromise = null;
            throw err;
        });

        return this.dbPromise;
    }

    async initSchema(db) {
        await db.exec(`
            CREATE TABLE IF NOT EXISTS users (
                userId TEXT PRIMARY KEY,
                uniqueId TEXT,
                nickname TEXT,
                profilePictureUrl TEXT,
                totalDiamonds INTEGER DEFAULT 0,
                lastSeen DATETIME DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS gifts (
                id INTEGER PRIMARY KEY,
                name TEXT NOT NULL,
                diamondCount INTEGER NOT NULL,
                imageUrl TEXT
            );

            CREATE TABLE IF NOT EXISTS donations (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                userId TEXT,
                giftId INTEGER,
                count INTEGER DEFAULT 1,
                totalDiamonds INTEGER DEFAULT 0,
                timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY(userId) REFERENCES users(userId),
                FOREIGN KEY(giftId) REFERENCES gifts(id)
            );
        `);
        console.log('[DB] Schema initialized successfully.');
    }

    // --- Users ---
    async upsertUser(user) {
        const db = await this.connect();
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
        const db = await this.connect();
        return await db.all(`SELECT * FROM users ORDER BY totalDiamonds DESC LIMIT ?`, [limit]);
    }

    async getTotalDiamonds() {
        const db = await this.connect();
        const result = await db.get(`SELECT SUM(totalDiamonds) as sum FROM users`);
        return result.sum || 0;
    }

    // --- Gifts ---
    async upsertGift(gift) {
        const db = await this.connect();
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
        const db = await this.connect();
        return await db.all(`SELECT * FROM gifts`);
    }

    // --- Donations ---
    async recordDonation(userId, giftId, count, totalDiamonds) {
        const db = await this.connect();
        await db.run(`
            INSERT INTO donations (userId, giftId, count, totalDiamonds)
            VALUES (?, ?, ?, ?)
        `, [userId, giftId, count, totalDiamonds]);
    }
}

const instance = new DatabaseManager();
module.exports = instance;
