const express   = require('express');
const router    = express.Router();
const goiBridge = require('../tiktok/goiBridge');
const ctx       = require('../context');

router.get('/commands', (req, res) => {
    res.json({ success: true, commands: ctx.config.goiCommands || {} });
});

router.post('/commands', express.json(), (req, res) => {
    const { giftName, effect, action, oldGiftName } = req.body;
    if (!ctx.config.goiCommands) ctx.config.goiCommands = {};

    if (action === 'delete' && giftName) {
        delete ctx.config.goiCommands[giftName];
    } else if (giftName && effect) {
        if (oldGiftName && oldGiftName !== giftName) {
            ctx.config.goiCommands = ctx.renameKey(ctx.config.goiCommands, oldGiftName, giftName, effect);
        } else {
            ctx.config.goiCommands[giftName] = effect;
        }
    }

    try {
        ctx.saveConfig();
        res.json({ success: true, commands: ctx.config.goiCommands });
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

router.post('/test', express.json(), (req, res) => {
    const { giftName } = req.body;
    if (!ctx.config.goiCommands) return res.status(404).json({ success: false, error: 'No GOI commands configured' });
    const effect = ctx.config.goiCommands[giftName];
    if (!effect) return res.status(404).json({ success: false, error: 'Effect not found for this gift' });
    if (!goiBridge.isConnected) return res.status(503).json({ success: false, error: 'GOI mod not connected' });

    const code     = typeof effect === 'string' ? effect : effect.code;
    const duration = (typeof effect === 'object' && effect.duration) ? effect.duration : 0;
    const count    = (typeof effect === 'object' && effect.count)    ? effect.count    : 1;

    goiBridge.sendEffect(code, 'TestUser', duration, count)
        .then(r => {
            if (!r || typeof r !== 'object') return res.json({ success: false, error: 'Mod did not respond' });
            res.json({ success: r.status === 0, error: r.status !== 0 ? (r.message || 'Unknown mod error') : undefined, response: r });
        })
        .catch(e => res.status(500).json({ success: false, error: e.message }));
});

module.exports = router;
