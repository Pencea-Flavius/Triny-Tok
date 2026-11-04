// Who may change the app, and what of the config may be shown.
//
// TrinyTok has no login for its normal use: the streamer opens /app on their own PC.
// So the same machine is trusted, and anyone else must be a logged-in admin.

const LOOPBACK_ADDRESSES = new Set(['127.0.0.1', '::1', '::ffff:127.0.0.1']);
const LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]']);

function hostnameOf(host) {
    try { return new URL('http://' + host).hostname; } catch { return ''; }
}

// A page on another site must not be able to drive the app through the browser.
function isSameOrigin(req) {
    const origin = req.headers.origin;
    if (!origin) return true;
    try { return new URL(origin).host === req.headers.host; } catch { return false; }
}

// The Host check stops DNS rebinding; x-forwarded-for means a proxy is in front, so not local.
function isLocal(req) {
    return LOOPBACK_ADDRESSES.has(req.socket?.remoteAddress)
        && !req.headers['x-forwarded-for']
        && LOOPBACK_HOSTS.has(hostnameOf(req.headers.host || ''));
}

function isTrusted(req) {
    if (!isSameOrigin(req)) return false;
    return isLocal(req) || !!req.session?.user?.isAdmin;
}

function requireTrustedForWrites(req, res, next) {
    if (req.method === 'GET' || req.method === 'HEAD' || isTrusted(req)) return next();
    res.status(403).json({ success: false, error: 'Forbidden' });
}

// The RCON password stays on the server: the page only learns that one is saved.
function publicMinecraft(minecraft = {}) {
    const { password, ...rest } = minecraft;
    return { ...rest, hasPassword: !!password };
}

function publicConfig(config) {
    return { ...config, minecraft: publicMinecraft(config.minecraft) };
}

// An empty password from the page means "keep the saved one".
function mergeMinecraft(current = {}, incoming = {}) {
    const merged = { ...current, ...incoming };
    if (!incoming.password) merged.password = current.password || '';
    delete merged.hasPassword;
    return merged;
}

// Only settings that already exist can be written.
function applyConfigUpdate(config, body = {}) {
    for (const key of Object.keys(body)) {
        if (!Object.prototype.hasOwnProperty.call(config, key)) continue;
        config[key] = key === 'minecraft' ? mergeMinecraft(config.minecraft, body.minecraft) : body[key];
    }
}

module.exports = { isSameOrigin, isLocal, isTrusted, requireTrustedForWrites, publicMinecraft, publicConfig, mergeMinecraft, applyConfigUpdate };
