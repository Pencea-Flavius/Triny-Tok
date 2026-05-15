const express = require('express');
const router  = express.Router();
const ctx     = require('../context');

router.get('/commands', (req, res) => {
    res.json({ success: true, commands: ctx.config.giftCommands, followCommand: ctx.config.followCommand, likeCommand: ctx.config.likeCommand });
});

router.post('/commands', express.json(), (req, res) => {
    const { giftName, oldGiftName, command, action, followCommand, likeCommand } = req.body;

    if (followCommand) ctx.config.followCommand = followCommand;
    if (likeCommand)   ctx.config.likeCommand   = likeCommand;

    if (giftName) {
        if (action === 'delete') {
            delete ctx.config.giftCommands[giftName];
        } else {
            const value = typeof command === 'object' ? command : { command };
            if (oldGiftName && oldGiftName !== giftName) {
                ctx.config.giftCommands = ctx.renameKey(ctx.config.giftCommands, oldGiftName, giftName, value);
            } else {
                ctx.config.giftCommands[giftName] = value;
            }
        }
    }

    try {
        ctx.saveConfig();
        res.json({ success: true, commands: ctx.config.giftCommands, followCommand: ctx.config.followCommand, likeCommand: ctx.config.likeCommand });
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

router.get('/config', (req, res) => {
    res.json({ success: true, config: ctx.config });
});

router.post('/config', express.json(), (req, res) => {
    Object.assign(ctx.config, req.body);
    try {
        ctx.saveConfig();
        res.json({ success: true, config: ctx.config });
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

module.exports = router;
