const express = require('express');
const router  = express.Router();
const auth    = require('../auth/auth');

router.get('/login', (req, res) => {
    if (req.session.user) return res.redirect('/app');
    const success = req.query.verified ? 'Account created! You can now sign in.'
                  : req.query.reset    ? 'Password updated! You can now sign in.'
                  : null;
    const referer    = req.headers.referer || '';
    const defaultNext = referer && new URL(referer, 'http://localhost').pathname !== '/login'
        ? new URL(referer, 'http://localhost').pathname
        : '/app';
    const nextUrl = req.query.next || defaultNext;
    res.render('login', { error: null, success, next: nextUrl });
});

router.post('/login', async (req, res) => {
    const { email, password } = req.body;
    try {
        const user = await auth.login(email, password);
        req.session.user = user;
        const raw  = req.body.next || req.query.next || '/app';
        const next = raw.startsWith('/') ? raw : '/app';
        res.redirect(next);
    } catch (err) {
        res.render('login', { error: err.message });
    }
});

router.get('/register', (req, res) => {
    if (req.session.user) return res.redirect('/app');
    res.render('register', { error: null, values: {} });
});

router.post('/register', async (req, res) => {
    const { username, email, firstName, lastName, password, password2, birthDate } = req.body;
    if (password !== password2) {
        return res.render('register', { error: 'Passwords do not match', values: req.body });
    }
    const parseMulti = (val) => !val ? [] : Array.isArray(val) ? val : [val];
    const preferences = {
        favoriteGames:     parseMulti(req.body.favoriteGames),
        streamingGenre:    parseMulti(req.body.streamingGenre),
        targetAudience:    parseMulti(req.body.targetAudience),
        streamingSchedule: parseMulti(req.body.streamingSchedule),
        gameGenres:        parseMulti(req.body.gameGenres),
    };
    const hasPrefs = Object.values(preferences).some(v => v.length > 0);
    try {
        const token   = await auth.register({ username, email, firstName, lastName, password, birthDate, preferences: hasPrefs ? preferences : null });
        const baseUrl = `${req.protocol}://${req.get('host')}`;
        await auth.sendVerificationEmail(email, token, baseUrl);
        res.redirect(`/register/pending?email=${encodeURIComponent(email)}`);
    } catch (err) {
        res.render('register', { error: err.message, values: req.body });
    }
});

router.get('/register/pending', (req, res) => {
    res.render('verify-email', { state: 'pending', email: req.query.email || '' });
});

router.get('/verify-email/:token', async (req, res) => {
    try {
        await auth.verifyEmail(req.params.token);
        res.render('verify-email', { state: 'success', email: '' });
    } catch (err) {
        res.render('verify-email', { state: 'error', email: '', error: err.message });
    }
});

router.get('/password-reset', (req, res) => res.render('password-reset-request', { sent: false }));

router.post('/password-reset', async (req, res) => {
    const { email } = req.body;
    try {
        const token = await auth.requestPasswordReset(email);
        if (token && process.env.SMTP_USER) {
            const baseUrl = `${req.protocol}://${req.get('host')}`;
            await auth.sendPasswordResetEmail(email, token, baseUrl);
        }
    } catch (_) { /* silently ignore */ }
    res.render('password-reset-request', { sent: true });
});

router.get('/password-reset/:token', (req, res) => {
    res.render('password-reset-confirm', { token: req.params.token, error: null });
});

router.post('/password-reset/:token', async (req, res) => {
    const { password, password2 } = req.body;
    if (password !== password2) {
        return res.render('password-reset-confirm', { token: req.params.token, error: 'Passwords do not match' });
    }
    try {
        await auth.resetPassword(req.params.token, password);
        res.redirect('/login?reset=1');
    } catch (err) {
        res.render('password-reset-confirm', { token: req.params.token, error: err.message });
    }
});

router.get('/logout', (req, res) => {
    req.session.destroy(() => res.redirect('/'));
});

module.exports = router;
