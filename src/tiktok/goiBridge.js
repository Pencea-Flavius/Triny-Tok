const net = require('net');
const EventEmitter = require('events');

class GoiBridge extends EventEmitter {
    constructor() {
        super();
        this.server = null;
        this.socket = null;
        this.isConnected = false;
        this.port = 52000;
        this._buffer = '';
        this._requestId = 1;
        this._pending = new Map();
    }

    start(port) {
        if (port) this.port = port;
        if (this.server) return;

        this.server = net.createServer((socket) => {
            if (this.socket) {
                console.warn('[GOI] Second mod connection rejected');
                socket.destroy();
                return;
            }

            console.info(`[GOI] Mod connected from ${socket.remoteAddress}`);
            this.socket = socket;
            this._buffer = '';
            this.isConnected = true;
            this.emit('statusChange', true);

            socket.on('data', (chunk) => {
                this._buffer += chunk.toString();
                const parts = this._buffer.split('\0');
                this._buffer = parts.pop();

                parts.forEach(raw => {
                    const msg = raw.trim();
                    if (!msg) return;
                    try {
                        const parsed = JSON.parse(msg);
                        if (parsed.id === 0 && parsed.status === 255) return;
                        this._handleResponse(parsed);
                    } catch (e) {
                        console.error('[GOI] JSON Parse Error:', e.message, 'Raw:', msg);
                    }
                });
            });

            socket.on('close', () => {
                console.info('[GOI] Mod disconnected');
                this.isConnected = false;
                this.socket = null;
                this._buffer = '';
                this._pending.forEach(p => { clearTimeout(p.timeout); p.resolve({ status: 1, message: 'Disconnected' }); });
                this._pending.clear();
                this.emit('statusChange', false);
            });

            socket.on('error', (err) => {
                console.error('[GOI] Socket error:', err.message);
                this.isConnected = false;
                this.socket = null;
                this._buffer = '';
                this._pending.forEach(p => { clearTimeout(p.timeout); p.resolve({ status: 1, message: err.message }); });
                this._pending.clear();
                this.emit('statusChange', false, err.message);
            });
        });

        this.server.listen(this.port, '0.0.0.0', () => {
            console.info(`[GOI] TCP server listening on 0.0.0.0:${this.port}`);
        });

        this.server.on('error', (err) => {
            console.error('[GOI] Server error:', err.message);
        });
    }

    _handleResponse(msg) {
        const pending = this._pending.get(msg.id);
        if (pending) {
            clearTimeout(pending.timeout);
            this._pending.delete(msg.id);
            pending.resolve(msg);
        }
        this.emit('response', msg);
    }

    sendEffect(code, viewer, durationSec = 0, count = 1) {
        if (!this.isConnected || !this.socket) return Promise.resolve(false);

        const id = this._requestId++;
        const request = {
            id,
            code,
            type: '1',
            duration: Math.round(durationSec * 1000),
            viewer: viewer || 'TikTok',
            count: count || 1
        };

        return new Promise((resolve) => {
            const timeout = setTimeout(() => {
                this._pending.delete(id);
                resolve({ id, status: 1, message: 'Timeout' });
            }, 5000);

            this._pending.set(id, { resolve, timeout });

            try {
                const json = JSON.stringify(request) + '\0';
                this.socket.write(json);
            } catch (e) {
                clearTimeout(timeout);
                this._pending.delete(id);
                console.error('[GOI] Failed to send effect:', e.message);
                resolve({ id, status: 1, message: e.message });
            }
        });
    }

    stop() {
        if (this.socket) { this.socket.destroy(); this.socket = null; }
        if (this.server) { this.server.close(); this.server = null; }
        this.isConnected = false;
        this._pending.forEach(p => { clearTimeout(p.timeout); p.resolve({ status: 1, message: 'Bridge stopped' }); });
        this._pending.clear();
    }
}

module.exports = new GoiBridge();
