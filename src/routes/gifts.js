const express = require('express');
const path    = require('path');
const fs      = require('fs');
const router  = express.Router();
const db      = require('../database/db_manager');
const auth    = require('../auth/auth');
const ctx     = require('../context');

router.get('/', (req, res) => {
    const normalized = ctx.availableGifts.map(g => {
        const remoteUrl = g.imageUrl || g.image?.url_list?.[0] || '';
        let imageUrl = remoteUrl;
        if (remoteUrl && g.id) {
            const local = ctx.localGiftImagePath(g.id, remoteUrl);
            if (fs.existsSync(local)) imageUrl = ctx.localGiftImageUrl(g.id, remoteUrl);
        }
        return {
            id: g.id,
            name: g.name,
            diamond_count: g.diamond_count ?? g.diamondCount ?? 0,
            image: { url_list: imageUrl ? [imageUrl] : [] },
        };
    });
    res.json({ success: true, gifts: normalized });
});

router.post('/:id/cache-image', express.raw({ type: ['image/*', 'application/octet-stream'], limit: '2mb' }), (req, res) => {
    const giftId     = req.params.id;
    const contentType = req.headers['content-type'] || '';
    const ext        = contentType.includes('png') ? '.png' : '.webp';
    const dest       = path.join(ctx.GIFT_IMG_DIR, `${giftId}${ext}`);
    const otherExt   = ext === '.png' ? '.webp' : '.png';
    const other      = path.join(ctx.GIFT_IMG_DIR, `${giftId}${otherExt}`);
    try {
        if (req.body && req.body.length > 0) {
            if (fs.existsSync(other)) fs.unlinkSync(other);
            fs.writeFileSync(dest, req.body);
        }
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

router.delete('/:id', auth.requireAdmin, async (req, res) => {
    try {
        const giftIdParam = req.params.id;
        const giftId      = parseInt(giftIdParam);
        let deleted = false;

        if (!isNaN(giftId)) {
            const changes = await db.deleteGift(giftId);
            if (changes > 0) deleted = true;
        }

        const cacheIdx = ctx.availableGifts.findIndex(g => String(g.id) === String(giftIdParam));
        if (cacheIdx !== -1) {
            if (!deleted && db) {
                const giftName = ctx.availableGifts[cacheIdx].name;
                const dbConn   = await db.connectGlobal();
                const result   = await dbConn.run(`DELETE FROM gifts WHERE name = ?`, [giftName]);
                if (result.changes > 0) deleted = true;
            }
            ctx.availableGifts.splice(cacheIdx, 1);
            deleted = true;
        }

        if (deleted) {
            res.json({ success: true });
        } else {
            res.status(404).json({ success: false, error: 'Gift not found in database or cache' });
        }
    } catch (e) {
        console.error('[DELETE /api/gifts]', e);
        res.status(500).json({ success: false, error: e.message });
    }
});

module.exports = router;
