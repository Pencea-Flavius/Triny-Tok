const express    = require('express');
const path       = require('path');
const fs         = require('fs');
const router     = express.Router();
const db         = require('../database/db_manager');
const repoBridge = require('../tiktok/repoBridge');
const ctx        = require('../context');

router.get('/images', (req, res) => {
    const base = path.join(__dirname, '../../public/images/repo');
    const read = (dir) => { try { return fs.readdirSync(path.join(base, dir)); } catch { return []; } };
    res.json({ items: read('items'), valuables: read('valuables'), enemies: read('enemies') });
});

router.get('/valuables', async (req, res) => {
    try { res.json({ success: true, valuables: await db.getRepoValuables() }); }
    catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

router.get('/items', async (req, res) => {
    try { res.json({ success: true, items: await db.getRepoItems() }); }
    catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

router.get('/enemies', async (req, res) => {
    try { res.json({ success: true, enemies: await db.getRepoEnemies() }); }
    catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

router.get('/commands', (req, res) => {
    res.json({ success: true, commands: ctx.config.repoCommands || {} });
});

router.post('/commands', express.json(), (req, res) => {
    const { giftName, effect, action, oldGiftName } = req.body;
    if (!ctx.config.repoCommands) ctx.config.repoCommands = {};

    if (action === 'delete' && giftName) {
        delete ctx.config.repoCommands[giftName];
    } else if (giftName && effect) {
        if (oldGiftName && oldGiftName !== giftName) {
            ctx.config.repoCommands = ctx.renameKey(ctx.config.repoCommands, oldGiftName, giftName, effect);
        } else {
            ctx.config.repoCommands[giftName] = effect;
        }
    }

    try {
        ctx.saveConfig();
        res.json({ success: true, commands: ctx.config.repoCommands });
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

router.post('/test', express.json(), (req, res) => {
    const { giftName } = req.body;
    if (!ctx.config.repoCommands) return res.status(404).json({ success: false, error: 'No REPO commands configured' });
    const effect = ctx.config.repoCommands[giftName];
    if (!effect) return res.status(404).json({ success: false, error: 'Effect not found for this gift' });
    if (!repoBridge.isConnected) return res.status(503).json({ success: false, error: 'REPO mod not connected' });

    const code         = typeof effect === 'string' ? effect : effect.code;
    const duration     = (typeof effect === 'object' && effect.duration) ? effect.duration : 0;
    const targetRandom = (typeof effect === 'object' && effect.targetRandom !== undefined) ? effect.targetRandom : false;

    repoBridge.sendEffect(code, 'TestUser', duration, targetRandom)
        .then(r => {
            if (!r || typeof r !== 'object') return res.json({ success: false, error: 'Mod did not respond' });
            res.json({ success: r.status === 0, error: r.status !== 0 ? (r.message || 'Unknown mod error') : undefined, response: r });
        })
        .catch(e => res.status(500).json({ success: false, error: e.message }));
});

module.exports = router;
