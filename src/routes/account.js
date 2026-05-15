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

module.exports = router;
