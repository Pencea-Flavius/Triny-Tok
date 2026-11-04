process.env.DOTENV_CONFIG_QUIET = 'true';
require('dotenv').config();

const express  = require('express');
const helmet   = require('helmet');
const session  = require('express-session');
const { createServer } = require('http');
const { Server }       = require('socket.io');
const path = require('path');
const crypto = require('crypto');
const fs   = require('fs');
const db   = require('./database/db_manager');
const ctx  = require('./context');
const minecraftBridge = require('./tiktok/minecraftBridge');
const isaacBridge     = require('./tiktok/isaacBridge');
const repoBridge      = require('./tiktok/repoBridge');
const goiBridge       = require('./tiktok/goiBridge');
const access = require('./auth/access');

// ── Database init ─────────────────────────────────────────────────────────────
async function initDatabase() {
    try {
        await db.connectGlobal();
        ctx.availableGifts = (await db.getGifts()).map(g => ({ ...g, name: (g.name || '').trim() }));
        console.info(`[DB] Loaded ${ctx.availableGifts.length} gifts from SQLite.`);
        (async () => {
            let downloaded = 0;
            for (const g of ctx.availableGifts) {
                const url = g.imageUrl || g.image?.url_list?.[0];
                if (!url) continue;
                const dest = ctx.localGiftImagePath(g.id, url);
                if (fs.existsSync(dest)) continue;
                await ctx.downloadGiftImage(g.id, url);
                downloaded++;
                if (downloaded % 50 === 0) await new Promise(r => setTimeout(r, 500));
            }
            if (downloaded > 0) console.info(`[Gifts] Cached ${downloaded} gift images locally.`);
        })();
    } catch (e) {
        console.error('[DB] Failed to load gifts from database', e);
    }
}
initDatabase();

// ── Express app ───────────────────────────────────────────────────────────────
const app        = express();
const httpServer = createServer(app);

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, '../views'));
// Inline scripts and handlers are still used across the views, so they stay allowed;
// everything else is limited to what the app really loads.
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'", "'unsafe-inline'", 'https://cdnjs.cloudflare.com'],
            scriptSrcAttr: ["'unsafe-inline'"],
            styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
            fontSrc: ["'self'", 'https://fonts.gstatic.com'],
            imgSrc: ["'self'", 'data:', 'blob:', 'https:'],
            connectSrc: ["'self'", 'ws:', 'wss:', 'https:'],
            objectSrc: ["'none'"],
            baseUri: ["'self'"],
            formAction: ["'self'"],
            frameAncestors: ["'self'"],
            upgradeInsecureRequests: null,
        },
    },
}));
app.use(express.urlencoded({ extended: true }));

if (!process.env.SESSION_SECRET && process.env.NODE_ENV === 'production') {
    console.error('SESSION_SECRET must be set in production.');
    process.exit(1);
}
if (!process.env.SESSION_SECRET) console.warn('SESSION_SECRET is not set: using a random one, so logins end when the server restarts.');

const sessionMiddleware = session({
    secret: process.env.SESSION_SECRET || crypto.randomBytes(32).toString('hex'),
    resave: false,
    saveUninitialized: false,
    cookie: { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', maxAge: 7 * 24 * 60 * 60 * 1000 },
});
app.use(sessionMiddleware);
app.use((req, res, next) => { res.locals.user = req.session.user || null; next(); });

// ── Socket.io ─────────────────────────────────────────────────────────────────
const allowedOrigin = process.env.APP_ORIGIN || `http://localhost:${process.env.PORT || 8081}`;
const io = new Server(httpServer, {
    cors: { origin: allowedOrigin, credentials: true },
    // Browsers do not apply CORS to WebSockets, so other sites are refused here.
    allowRequest: (req, callback) => callback(null, access.isSameOrigin(req)),
});
ctx.io   = io;
io.use((socket, next) => sessionMiddleware(socket.request, socket.request.res || {}, next));

// Bridge status → broadcast
minecraftBridge.on('statusChange', (isConnected, errorMsg) => {
    io.emit('minecraftStatus', { isConnected, config: access.publicMinecraft(ctx.config.minecraft), error: errorMsg || null });
});
isaacBridge.on('statusChange', (isConnected, errorMsg) => {
    io.emit('isaacStatus', { isConnected, serverActive: !!isaacBridge.server, error: errorMsg || null });
});
isaacBridge.on('profilesUpdated', (profiles) => {
    if (profiles.length > 0) {
        const oldStr = JSON.stringify(ctx.config.isaacProfiles || []);
        const newStr = JSON.stringify(profiles);
        if (oldStr !== newStr) {
            console.info(`[Isaac] Profiles changed (${profiles.length}). Saving to config.`);
            ctx.config.isaacProfiles = profiles;
            setTimeout(() => ctx.saveConfig(), 0);
        }
    }
    io.emit('isaacProfiles', profiles.length > 0 ? profiles : (ctx.config.isaacProfiles || ctx.ISAAC_DEFAULT_PROFILES));
});
isaacBridge.on('result', (data) => io.emit('isaacResult', data));
repoBridge.on('statusChange', (isConnected, errorMsg) => {
    io.emit('repoStatus', { isConnected, serverActive: !!repoBridge.server, error: errorMsg || null });
});
repoBridge.on('response', (data) => io.emit('repoResponse', data));
goiBridge.on('statusChange', (isConnected, errorMsg) => {
    io.emit('goiStatus', { isConnected, serverActive: !!goiBridge.server, error: errorMsg || null });
});
goiBridge.on('response', (data) => io.emit('goiResponse', data));


require('./socket/index').setupSocket(io);

// ── API routes ────────────────────────────────────────────────────────────────
app.use('/api', access.requireTrustedForWrites);
app.use('/api',          require('./routes/live'));
app.use('/api/gifts',    require('./routes/gifts'));
app.use('/api',          require('./routes/commands'));
app.use('/api/presets',  require('./routes/presets'));
app.use('/api/isaac',    require('./routes/isaac'));
app.use('/api/repo',     require('./routes/repo'));
app.use('/api/goi',      require('./routes/goi'));
app.use('/api/overlay',  require('./routes/overlay'));
app.use('/api/ai',       require('./routes/ai'));

// ── Page routes ───────────────────────────────────────────────────────────────
app.get('/', (req, res) => res.render('index'));

app.get('/app',        (req, res) => res.render('app', { tiktokUsername: req.session.user?.username || '', isAdmin: req.session.user?.isAdmin || false }));
app.get('/app/{*path}',(req, res) => res.render('app', { tiktokUsername: req.session.user?.username || '', isAdmin: req.session.user?.isAdmin || false }));

app.use('/admin',   require('./routes/admin'));
app.use('/',        require('./routes/auth'));
app.use('/account', require('./routes/account'));

app.use(express.static(path.join(__dirname, '../public')));

// ── Start ─────────────────────────────────────────────────────────────────────
const port = process.env.PORT || 8081;
// Only this PC by default. Set HOST=0.0.0.0 to open it to the network (then changes need an admin login).
const host = process.env.HOST || '127.0.0.1';
httpServer.listen(port, host, () => {
    console.info(`Server running! Please visit http://localhost:${port}`);
    if (ctx.config.minecraft.autoConnect) {
        ctx.config.minecraft.enabled = true;
        minecraftBridge.connect(ctx.config.minecraft.host, ctx.config.minecraft.port, ctx.config.minecraft.password, true)
            .then(() => io.emit('minecraftStatus', { isConnected: true, config: access.publicMinecraft(ctx.config.minecraft) }))
            .catch(() => {});
    } else {
        ctx.config.minecraft.enabled = false;
    }
});
