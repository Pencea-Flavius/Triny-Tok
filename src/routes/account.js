const express = require('express');
const bcrypt  = require('bcrypt');
const router  = express.Router();
const db      = require('../database/db_manager');
const auth    = require('../auth/auth');

router.get('/', auth.requireAuth, async (req, res) => {
    const gdb         = await db.connectGlobal();
    const account     = await gdb.get('SELECT * FROM app_accounts WHERE id = ?', [req.session.user.id]);
    const preferences = await db.getUserPreferences(req.session.user.id);
    res.render('account', { account, preferences, success: req.query.saved ? 'Changes saved.' : null, errors: {} });
});

router.post('/username', auth.requireAuth, async (req, res) => {
    const { username } = req.body;
    const gdb          = await db.connectGlobal();
    const account      = await gdb.get('SELECT * FROM app_accounts WHERE id = ?', [req.session.user.id]);
    try {
        await gdb.run('UPDATE app_accounts SET username = ? WHERE id = ?', [username, req.session.user.id]);
        req.session.user.username = username;
        res.redirect('/account?saved=1');
    } catch (err) {
        res.render('account', { account, success: null, errors: { username: 'Username already taken' } });
    }
});

router.post('/password', auth.requireAuth, async (req, res) => {
    const { currentPassword, newPassword, newPassword2 } = req.body;
    const gdb     = await db.connectGlobal();
    const account = await gdb.get('SELECT * FROM app_accounts WHERE id = ?', [req.session.user.id]);
    const match   = await bcrypt.compare(currentPassword, account.password_hash);
    if (!match) return res.render('account', { account, success: null, errors: { password: 'Current password is incorrect' } });
    if (newPassword !== newPassword2) return res.render('account', { account, success: null, errors: { password: 'New passwords do not match' } });
    const hash = await bcrypt.hash(newPassword, 12);
    await gdb.run('UPDATE app_accounts SET password_hash = ? WHERE id = ?', [hash, req.session.user.id]);
    res.redirect('/account?saved=1');
});

router.post('/preferences', auth.requireAuth, async (req, res) => {
    const parseMulti = (val) => !val ? [] : Array.isArray(val) ? val : [val];
    const preferences = {
        favoriteGames:     parseMulti(req.body.favoriteGames),
        streamingGenre:    parseMulti(req.body.streamingGenre),
        targetAudience:    parseMulti(req.body.targetAudience),
        streamingSchedule: parseMulti(req.body.streamingSchedule),
        gameGenres:        parseMulti(req.body.gameGenres),
    };
    await db.saveUserPreferences(req.session.user.id, preferences);
    res.redirect('/account?saved=1');
});

router.post('/delete', auth.requireAuth, async (req, res) => {
    const gdb = await db.connectGlobal();
    await gdb.run('DELETE FROM app_accounts WHERE id = ?', [req.session.user.id]);
    req.session.destroy(() => res.redirect('/'));
});

router.get('/donors-summary', auth.requireAuth, async (req, res) => {
    try {
        const gdb      = await db.connectGlobal();
        const streamer = await gdb.get('SELECT id FROM streamers WHERE uniqueId = ?', [req.session.user.username.toLowerCase()]);
        if (!streamer) return res.json({ success: true, donors: [] });
        const donors = await gdb.all(`
            SELECT u.uniqueId, u.nickname, u.totalDiamonds,
                   (SELECT g.name FROM donations d LEFT JOIN gifts g ON g.id = d.giftId
                    WHERE d.user_id = u.id ORDER BY d.timestamp DESC LIMIT 1) as lastGift
            FROM users u
            WHERE u.streamerId = ? AND u.totalDiamonds > 0
            ORDER BY u.totalDiamonds DESC
        `, [streamer.id]);
        res.json({ success: true, donors });
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

router.get('/donors', auth.requireAuth, async (req, res) => {
    const gdb      = await db.connectGlobal();
    const streamer = await gdb.get('SELECT id FROM streamers WHERE uniqueId = ?', [req.session.user.username.toLowerCase()]);
    if (!streamer) return res.render('donors', { donors: [], total: 0, page: 1, pageSize: 30, totalDiamonds: 0, user: req.session.user });
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const data = await db.getAllDonors(streamer.id, page);
    const { sum } = await gdb.get('SELECT SUM(totalDiamonds) as sum FROM users WHERE streamerId = ?', [streamer.id]) || {};
    res.render('donors', { ...data, totalDiamonds: sum || 0, user: req.session.user });
});

router.get('/donations', auth.requireAuth, async (req, res) => {
    const gdb      = await db.connectGlobal();
    const streamer = await gdb.get('SELECT id FROM streamers WHERE uniqueId = ?', [req.session.user.username.toLowerCase()]);
    if (!streamer) return res.render('donations', { donations: [], total: 0, page: 1, pageSize: 50, user: req.session.user });
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const data = await db.getDonationHistory(streamer.id, page);
    res.render('donations', { ...data, user: req.session.user });
});

module.exports = router;
