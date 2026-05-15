const express = require('express');
const path    = require('path');
const fs      = require('fs');
const router  = express.Router();
const ctx     = require('../context');
const { avatarUrl, upsertDonor } = require('../events/giftHandler');

router.get('/top-donors', (req, res) => {
    const donors = Array.from(new Set(Object.values(ctx.donorStats)))
        .sort((a, b) => b.totalDiamonds - a.totalDiamonds)
        .slice(0, 50)
        .map(d => ({ ...d, profilePictureUrl: avatarUrl(d.uniqueId) }));
    res.json({ success: true, donors });
});

router.get('/demo-users', (req, res) => {
    try {
        const demoPath = path.join(__dirname, '../../data/demo_users.json');
        if (!fs.existsSync(demoPath)) return res.json({ success: true, users: [] });
        const data = JSON.parse(fs.readFileSync(demoPath, 'utf8'));
        res.json({ success: true, users: Object.values(data) });
    } catch (e) {
        res.json({ success: false, users: [], error: e.message });
    }
});

router.get('/donation-stats', (req, res) => {
    res.json({ success: true, trackedDiamonds: ctx.trackedDiamonds, initialDonorsSum: ctx.initialDonorsSum, initialDonorsSynced: ctx.initialDonorsSynced });
});

router.post('/sync-initial', (req, res) => {
    if (ctx.initialDonorsSynced) return res.json({ success: false, error: 'Already synced' });
    ctx.trackedDiamonds += ctx.initialDonorsSum;
    ctx.initialTopDonors.forEach(donor => {
        if (donor.userId || donor.uniqueId) {
            upsertDonor(donor.userId, donor.uniqueId, donor.nickname, donor.profilePictureUrl, donor.totalDiamonds, 'Initial Sync');
        }
    });
    ctx.initialDonorsSynced = true;
    ctx.io.emit('statUpdate', { trackedDiamonds: ctx.trackedDiamonds, initialDonorsSynced: true });
    res.json({ success: true, added: ctx.initialDonorsSum });
});

module.exports = router;
