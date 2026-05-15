const express     = require('express');
const router      = express.Router();
const db          = require('../database/db_manager');
const isaacBridge = require('../tiktok/isaacBridge');
const ctx         = require('../context');

router.get('/items', async (req, res) => {
    try { res.json(await db.getIsaacItems()); }
    catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

router.get('/bosses', async (req, res) => {
    try { res.json(await db.getIsaacBosses()); }
    catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

router.get('/metadata', async (req, res) => {
    try {
        const [pools, types] = await Promise.all([db.getIsaacPools(), db.getIsaacTypes()]);
        res.json({ pools: pools.map(p => p.name), types: types.map(t => t.name) });
    } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

router.get('/profiles', (req, res) => {
    const profiles = isaacBridge.profiles.length > 0
        ? isaacBridge.profiles
        : (ctx.config.isaacProfiles || ctx.ISAAC_DEFAULT_PROFILES);
    res.json({ success: true, profiles });
});

router.get('/commands', (req, res) => {
    res.json({ success: true, commands: ctx.config.isaacCommands || {} });
});

router.post('/commands', express.json(), (req, res) => {
    const { giftName, effectId, action, oldGiftName } = req.body;
    if (!ctx.config.isaacCommands) ctx.config.isaacCommands = {};

    if (action === 'delete' && giftName) {
        delete ctx.config.isaacCommands[giftName];
    } else if (giftName && effectId) {
        if (oldGiftName && oldGiftName !== giftName) {
            ctx.config.isaacCommands = ctx.renameKey(ctx.config.isaacCommands, oldGiftName, giftName, effectId);
        } else {
            ctx.config.isaacCommands[giftName] = effectId;
        }
    }

    try {
        ctx.saveConfig();
        res.json({ success: true, commands: ctx.config.isaacCommands });
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

router.post('/test', express.json(), (req, res) => {
    const { giftName } = req.body;
    console.info(`[Isaac] Test requested for gift: "${giftName}"`);
    if (!ctx.config.isaacCommands) {
        console.error('[Isaac] No commands configured in config.json');
        return res.status(404).json({ success: false, error: 'No Isaac commands configured' });
    }
    const effect = ctx.config.isaacCommands[giftName];
    if (!effect) {
        console.error(`[Isaac] Effect not found for gift "${giftName}". Available:`, Object.keys(ctx.config.isaacCommands));
        return res.status(404).json({ success: false, error: 'Effect not found for this gift' });
    }
    console.info(`[Isaac] Found effect for "${giftName}":`, effect);
    const success = isaacBridge.activateProfile(effect, 'TestUser', giftName);
    if (success) {
        res.json({ success: true });
    } else {
        console.error('[Isaac] Isaac mod is not connected!');
        res.status(503).json({ success: false, error: 'Isaac mod not connected' });
    }
});

module.exports = router;
