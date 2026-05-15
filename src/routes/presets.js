const express = require('express');
const router  = express.Router();
const db      = require('../database/db_manager');
const auth    = require('../auth/auth');
const ctx     = require('../context');

const { PRESET_DETAIL_TABLE } = ctx;

function extractGameConfig(game) {
    const { config } = ctx;
    if (game === 'minecraft') return {
        host:           config.minecraft?.host,
        port:           config.minecraft?.port,
        auto_connect:   config.minecraft?.autoConnect ? 1 : 0,
        target_players: JSON.stringify(config.targetPlayers || []),
        gift_commands:  JSON.stringify(config.giftCommands  || {}),
        follow_command: JSON.stringify(config.followCommand || {}),
        like_command:   JSON.stringify(config.likeCommand   || {}),
    };
    if (game === 'isaac') return { isaac_commands: JSON.stringify(config.isaacCommands || {}) };
    if (game === 'repo')  return { repo_commands:  JSON.stringify(config.repoCommands  || {}) };
    if (game === 'goi')   return { goi_commands:   JSON.stringify(config.goiCommands   || {}) };
}

router.get('/:game', (req, res) => {
    if (!req.session.user) return res.json({ success: true, presets: [] });
    const { game } = req.params;
    if (!PRESET_DETAIL_TABLE[game]) return res.status(400).json({ success: false, error: 'Invalid game' });
    db.connectGlobal()
        .then(gdb => gdb.all(`SELECT id, name, created_at FROM presets WHERE account_id = ? AND game = ? ORDER BY created_at DESC`, [req.session.user.id, game]))
        .then(presets => res.json({ success: true, presets }))
        .catch(e => res.status(500).json({ success: false, error: e.message }));
});

router.post('/:game', express.json(), auth.requireAuth, async (req, res) => {
    const { game } = req.params;
    const detail   = PRESET_DETAIL_TABLE[game];
    if (!detail) return res.status(400).json({ success: false, error: 'Invalid game' });
    const { name } = req.body;
    if (!name?.trim()) return res.status(400).json({ success: false, error: 'Name is required' });
    try {
        const gdb  = await db.connectGlobal();
        const existing = await gdb.get(
            `SELECT id FROM presets WHERE account_id = ? AND name = ? AND game = ?`,
            [req.session.user.id, name.trim(), game]
        );
        const data = extractGameConfig(game);
        const cols = Object.keys(data);
        const vals = Object.values(data);
        let presetId;
        if (existing) {
            presetId = existing.id;
            await gdb.run(`UPDATE presets SET created_at = CURRENT_TIMESTAMP WHERE id = ?`, [presetId]);
            await gdb.run(`UPDATE ${detail} SET ${cols.map(c => `${c} = ?`).join(', ')} WHERE preset_id = ?`, [...vals, presetId]);
        } else {
            const r = await gdb.run(`INSERT INTO presets (account_id, name, game) VALUES (?, ?, ?)`, [req.session.user.id, name.trim(), game]);
            presetId = r.lastID;
            await gdb.run(`INSERT INTO ${detail} (preset_id, ${cols.join(', ')}) VALUES (?, ${cols.map(() => '?').join(', ')})`, [presetId, ...vals]);
        }
        const presets = await gdb.all(`SELECT id, name, created_at FROM presets WHERE account_id = ? AND game = ? ORDER BY created_at DESC`, [req.session.user.id, game]);
        res.json({ success: true, presets });
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

router.post('/:id/load', express.json(), auth.requireAuth, async (req, res) => {
    try {
        const gdb    = await db.connectGlobal();
        const preset = await gdb.get(`SELECT p.game FROM presets p WHERE p.id = ? AND p.account_id = ?`, [req.params.id, req.session.user.id]);
        if (!preset) return res.status(404).json({ success: false, error: 'Preset not found' });
        const detail = PRESET_DETAIL_TABLE[preset.game];
        const row    = await gdb.get(`SELECT * FROM ${detail} WHERE preset_id = ?`, [req.params.id]);
        if (!row) return res.status(404).json({ success: false, error: 'Preset data missing' });

        const { config } = ctx;
        if (preset.game === 'minecraft') {
            if (!config.minecraft) config.minecraft = {};
            if (row.host)           config.minecraft.host        = row.host;
            if (row.port)           config.minecraft.port        = row.port;
            if (row.auto_connect !== null) config.minecraft.autoConnect = !!row.auto_connect;
            if (row.target_players) config.targetPlayers = JSON.parse(row.target_players);
            if (row.gift_commands)  config.giftCommands  = JSON.parse(row.gift_commands);
            if (row.follow_command) config.followCommand = JSON.parse(row.follow_command);
            if (row.like_command)   config.likeCommand   = JSON.parse(row.like_command);
        } else if (preset.game === 'isaac') {
            if (row.isaac_commands) config.isaacCommands = JSON.parse(row.isaac_commands);
        } else if (preset.game === 'repo') {
            if (row.repo_commands)  config.repoCommands  = JSON.parse(row.repo_commands);
        } else if (preset.game === 'goi') {
            if (row.goi_commands)   config.goiCommands   = JSON.parse(row.goi_commands);
        }
        ctx.saveConfig();
        res.json({ success: true, config });
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

router.delete('/:id', auth.requireAuth, async (req, res) => {
    try {
        const gdb    = await db.connectGlobal();
        const preset = await gdb.get(`SELECT game FROM presets WHERE id = ? AND account_id = ?`, [req.params.id, req.session.user.id]);
        if (!preset) return res.status(404).json({ success: false, error: 'Not found' });
        await gdb.run(`DELETE FROM presets WHERE id = ?`, [req.params.id]);
        const presets = await gdb.all(`SELECT id, name, created_at FROM presets WHERE account_id = ? AND game = ? ORDER BY created_at DESC`, [req.session.user.id, preset.game]);
        res.json({ success: true, presets });
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

module.exports = router;
