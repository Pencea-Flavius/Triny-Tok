const express = require('express');
const fs      = require('fs');
const router  = express.Router();
const db      = require('../database/db_manager');
const auth    = require('../auth/auth');
const ctx     = require('../context');

router.get('/', auth.requireAuth, auth.requireAdmin, async (req, res) => {
    try {
        const gdb     = await db.connectGlobal();
        const tab     = req.query.tab || 'gifts';
        const search  = req.query.search || '';
        const sort    = req.query.sort   || '';
        const dir     = req.query.dir === 'desc' ? 'DESC' : 'ASC';

        const ALLOWED_GIFT_SORT     = { name: 'name', diamonds: 'diamondCount', id: 'id' };
        const ALLOWED_ACCOUNT_SORT  = { username: 'username', email: 'email', created: 'created_at', admin: 'is_admin' };
        const ALLOWED_DONOR_SORT    = { nickname: 'nickname', diamonds: 'totalDiamonds', seen: 'lastSeen' };
        const ALLOWED_DONATION_SORT = { diamonds: 'totalDiamonds', date: 'timestamp' };

        const stats = {
            accounts:      (await gdb.get(`SELECT COUNT(*) as c FROM app_accounts`)).c,
            gifts:         (await gdb.get(`SELECT COUNT(*) as c FROM gifts`)).c,
            donations:     (await gdb.get(`SELECT COUNT(*) as c FROM donations`)).c,
            donors:        (await gdb.get(`SELECT COUNT(*) as c FROM users`)).c,
            streamers:     (await gdb.get(`SELECT COUNT(*) as c FROM streamers`)).c,
            isaacItems:    (await gdb.get(`SELECT COUNT(*) as c FROM isaac_items`)).c,
            isaacBosses:   (await gdb.get(`SELECT COUNT(*) as c FROM isaac_bosses`)).c,
            repoItems:     (await gdb.get(`SELECT COUNT(*) as c FROM repo_items`)).c,
            repoValuables: (await gdb.get(`SELECT COUNT(*) as c FROM repo_valuables`)).c,
            repoEnemies:   (await gdb.get(`SELECT COUNT(*) as c FROM repo_enemies`)).c,
        };

        let gifts = [], accounts = [], donors = [], donations = [], aiPreferredGifts = [], streamers = [];

        if (tab === 'streamers') {
            const ALLOWED_STREAMER_SORT = { uniqueId: 's.uniqueId', donations: 'donationCount', diamonds: 'totalDiamonds', account: 'a.username' };
            const col    = ALLOWED_STREAMER_SORT[sort] || 'totalDiamonds';
            const where  = search ? `WHERE s.uniqueId LIKE ? OR a.username LIKE ?` : '';
            const params = search ? [`%${search}%`, `%${search}%`] : [];
            streamers = await gdb.all(`
                SELECT s.id, s.uniqueId, a.username, a.email,
                       COUNT(DISTINCT d.id) as donationCount,
                       COALESCE(SUM(d.totalDiamonds), 0) as totalDiamonds
                FROM streamers s
                LEFT JOIN app_accounts a ON a.id = s.account_id
                LEFT JOIN donations d ON d.streamerId = s.id
                ${where}
                GROUP BY s.id
                ORDER BY ${col} ${dir}
            `, params);
        } else if (tab === 'aiGifts') {
            aiPreferredGifts = await db.getAiPreferredGifts();
        } else if (tab === 'gifts') {
            const col    = ALLOWED_GIFT_SORT[sort] || 'name';
            const where  = search ? `WHERE name LIKE ?` : '';
            const params = search ? [`%${search}%`] : [];
            gifts = await gdb.all(`SELECT * FROM gifts ${where} ORDER BY ${col} ${dir}`, params);
        } else if (tab === 'accounts') {
            const col    = ALLOWED_ACCOUNT_SORT[sort] || 'created_at';
            const where  = search ? `WHERE username LIKE ? OR email LIKE ?` : '';
            const params = search ? [`%${search}%`, `%${search}%`] : [];
            accounts = await gdb.all(`SELECT id, username, email, first_name, last_name, created_at, email_verified, is_admin FROM app_accounts ${where} ORDER BY ${col} ${dir}`, params);
        } else if (tab === 'donors') {
            const col    = ALLOWED_DONOR_SORT[sort] || 'totalDiamonds';
            const where  = search ? `WHERE nickname LIKE ? OR uniqueId LIKE ?` : '';
            const params = search ? [`%${search}%`, `%${search}%`] : [];
            donors = await gdb.all(`SELECT * FROM users ${where} ORDER BY ${col} ${dir} LIMIT 200`, params);
        } else if (tab === 'donations') {
            const col  = ALLOWED_DONATION_SORT[sort] || 'timestamp';
            donations  = await gdb.all(
                `SELECT d.*, g.name as giftName, g.diamondCount as giftDiamonds, u.nickname, u.uniqueId
                 FROM donations d
                 LEFT JOIN gifts g ON g.id = d.giftId
                 LEFT JOIN users u ON u.id = d.user_id
                 ORDER BY ${col} ${dir} LIMIT 200`
            );
        }

        const allGiftsNormalized = ctx.availableGifts.map(g => {
            const remoteUrl = g.imageUrl || g.image?.url_list?.[0] || '';
            let imageUrl    = remoteUrl;
            if (remoteUrl && g.id) {
                const local = ctx.localGiftImagePath(g.id, remoteUrl);
                if (fs.existsSync(local)) imageUrl = ctx.localGiftImageUrl(g.id, remoteUrl);
            }
            return { id: g.id, name: g.name, diamond_count: g.diamond_count ?? g.diamondCount ?? 0, imageUrl };
        });

        res.render('admin', {
            tab, search, sort, dir: req.query.dir || 'asc',
            stats, gifts, accounts, donors, donations, streamers,
            aiPreferredGifts, allGifts: allGiftsNormalized,
            success: req.query.success || null,
            error:   req.query.error   || null,
        });
    } catch (e) {
        console.error('[Admin]', e);
        res.status(500).send('Error loading admin page: ' + e.message);
    }
});

router.post('/gifts/:id/delete', auth.requireAuth, auth.requireAdmin, async (req, res) => {
    try {
        const id  = parseInt(req.params.id);
        const gdb = await db.connectGlobal();
        await gdb.run(`DELETE FROM gifts WHERE id = ?`, [id]);
        const idx = ctx.availableGifts.findIndex(g => g.id === id);
        if (idx !== -1) ctx.availableGifts.splice(idx, 1);
        const search = req.query.search ? `&search=${encodeURIComponent(req.query.search)}` : '';
        const sortQs = req.query.sort   ? `&sort=${req.query.sort}&dir=${req.query.dir || 'asc'}` : '';
        res.redirect(`/admin?tab=gifts&success=Gift+deleted${search}${sortQs}`);
    } catch (e) {
        res.status(500).send('Error deleting gift');
    }
});

router.post('/accounts/:id/delete', auth.requireAuth, auth.requireAdmin, async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        if (id === req.session.user.id) return res.redirect('/admin?tab=accounts&error=Cannot+delete+your+own+account');
        const gdb = await db.connectGlobal();
        await gdb.run(`DELETE FROM app_accounts WHERE id = ?`, [id]);
        res.redirect('/admin?tab=accounts&success=Account+deleted');
    } catch (e) {
        res.status(500).send('Error deleting account');
    }
});

router.post('/accounts/:id/toggle-admin', auth.requireAuth, auth.requireAdmin, async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        if (id === req.session.user.id) return res.redirect('/admin?tab=accounts&error=Cannot+change+your+own+admin+status');
        const gdb     = await db.connectGlobal();
        const account = await gdb.get(`SELECT is_admin FROM app_accounts WHERE id = ?`, [id]);
        if (!account) return res.redirect('/admin?tab=accounts&error=Account+not+found');
        await gdb.run(`UPDATE app_accounts SET is_admin = ? WHERE id = ?`, [account.is_admin ? 0 : 1, id]);
        res.redirect('/admin?tab=accounts&success=Admin+status+updated');
    } catch (e) {
        res.status(500).send('Error updating admin status');
    }
});

router.post('/ai-gifts/add', auth.requireAuth, auth.requireAdmin, async (req, res) => {
    try {
        const { giftName } = req.body;
        if (!giftName?.trim()) return res.redirect('/admin?tab=aiGifts&error=Gift+name+required');
        const gift     = ctx.availableGifts.find(g => g.name.trim() === giftName.trim());
        const diamonds = gift ? (gift.diamond_count ?? gift.diamondCount ?? 0) : 0;
        await db.addAiPreferredGift(giftName.trim(), diamonds);
        res.redirect('/admin?tab=aiGifts&success=Gift+added');
    } catch (e) {
        res.redirect('/admin?tab=aiGifts&error=' + encodeURIComponent(e.message));
    }
});

router.post('/ai-gifts/:id/delete', auth.requireAuth, auth.requireAdmin, async (req, res) => {
    try {
        await db.removeAiPreferredGift(parseInt(req.params.id));
        res.redirect('/admin?tab=aiGifts&success=Gift+removed');
    } catch (e) {
        res.status(500).send('Error removing preferred gift');
    }
});

module.exports = router;
