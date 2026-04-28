const net = require('net');
const EventEmitter = require('events');

class IsaacBridge extends EventEmitter {
    constructor() {
        super();
        this.server = null;
        this.socket = null;
        this.isConnected = false;
        this.port = 58430;
        this._buffer = '';
        this.profiles = [];  // populated when Isaac mod connects and sends profile list
    }

    start(port) {
        if (port) this.port = port;
        if (this.server) return;

        this.server = net.createServer((socket) => {
            if (this.socket) {
                console.warn('[Isaac] Second mod connection rejected');
                socket.destroy();
                return;
            }

            console.info(`[Isaac] Mod connected from ${socket.remoteAddress}`);
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
                        this._handleMessage(parsed);
                    } catch (e) {
                        console.error('[Isaac] JSON Parse Error:', e.message, 'Raw:', msg);
                    }
                });
            });

            socket.on('close', () => {
                console.info('[Isaac] Mod disconnected');
                this.isConnected = false;
                this.socket = null;
                this._buffer = '';
                this.profiles = [];
                this.emit('statusChange', false);
                this.emit('profilesUpdated', []);
            });

            socket.on('error', (err) => {
                console.error('[Isaac] Socket error:', err.message);
                this.isConnected = false;
                this.socket = null;
                this._buffer = '';
                this.profiles = [];
                this.emit('statusChange', false, err.message);
                this.emit('profilesUpdated', []);
            });
        });

        this.server.listen(this.port, '0.0.0.0', () => {
            console.info(`[Isaac] TCP server listening on 0.0.0.0:${this.port}`);
        });

        this.server.on('error', (err) => {
            console.error('[Isaac] Server error:', err.message);
        });
    }

    _handleMessage(msg) {
        if (msg.type === 'profiles') {
            this.profiles = Array.isArray(msg.profiles) ? msg.profiles : [];
            console.info(`[Isaac] Received ${this.profiles.length} profiles from mod`);
            this.emit('profilesUpdated', this.profiles);
        } else if (msg.type === 'result') {
            this.emit('result', msg);
        }
    }

    activateProfile(effectConfig, viewer, giftName) {
        if (!this.isConnected || !this.socket) return false;
        
        let payloadObj = {
            viewer: viewer || 'Unknown',
            giftName: giftName || ''
        };
        
        if (typeof effectConfig === 'string') {
            payloadObj.type = 'activate'; // Legacy behavior
            payloadObj.profileId = effectConfig;
        } else if (typeof effectConfig === 'object') {
            Object.assign(payloadObj, effectConfig);
        }
        
        const payload = JSON.stringify(payloadObj) + '\n';
        try {
            console.info(`[Isaac] Sending to mod: ${payload.trim()}`);
            this.socket.write(payload);
            return true;
        } catch (e) {
            console.error('[Isaac] Failed to send activate:', e.message);
            return false;
        }
    }

    stop() {
        if (this.socket) { this.socket.destroy(); this.socket = null; }
        if (this.server) { this.server.close(); this.server = null; }
        this.isConnected = false;
        this.profiles = [];
    }
}

module.exports = new IsaacBridge();
