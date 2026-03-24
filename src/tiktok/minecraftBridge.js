const { Rcon } = require('rcon-client');
const EventEmitter = require('events');

const RECONNECT_BASE_DELAY = 2000;   // 2 seconds
const RECONNECT_MAX_DELAY = 30000;  // 30 seconds

class MinecraftBridge extends EventEmitter {
    constructor() {
        super();
        this.client = null;
        this.isConnected = false;
        this._manualDisconnect = false;
        this._reconnectAttempt = 0;
        this._reconnectTimer = null;
        this.config = {
            host: '127.0.0.1',
            port: 25575,
            password: '',
            autoReconnect: false
        };
    }

    async connect(host, port, password, autoReconnect) {
        // Clear any existing reconnect timer to prevent parallel connection loops
        if (this._reconnectTimer) {
            clearTimeout(this._reconnectTimer);
            this._reconnectTimer = null;
        }

        if (this.client) {
            await this.disconnect();
        }

        if (host !== undefined) this.config.host = host;
        if (port !== undefined) this.config.port = port;
        if (password !== undefined) this.config.password = password;
        if (autoReconnect !== undefined) this.config.autoReconnect = autoReconnect;

        if (this.config.host === 'localhost') {
            this.config.host = '127.0.0.1'; // Fix potential Node 17+ localhost resolution issues
        }

        this._manualDisconnect = false;

        let retries = 3;
        let lastErr = null;

        while (retries > 0) {
            try {
                this.client = await Rcon.connect({
                    host: this.config.host,
                    port: this.config.port,
                    password: this.config.password,
                    timeout: 10000
                });

                console.info(`✅ Connected to Minecraft via RCON at ${this.config.host}:${this.config.port}`);
                this.isConnected = true;
                this._reconnectAttempt = 0;
                this.emit('statusChange', true);

                this.client.on('error', (err) => {
                    console.error(`❌ RCON Error: ${err.message}`);
                    this.isConnected = false;
                    this.emit('statusChange', false, err.message);
                });

                this.client.on('end', () => {
                    this.isConnected = false;
                    this.client = null;
                    this.emit('statusChange', false, 'RCON connection ended');
                    if (!this._manualDisconnect) {
                        this._scheduleReconnect();
                    }
                });

                return true;
            } catch (err) {
                lastErr = err;
                retries--;
                if (retries > 0 && !this._manualDisconnect) {
                    console.warn(`⚠️ RCON Connection Failed (${err.message}). Retrying... (${retries} attempts left)`);
                    await new Promise(res => setTimeout(res, 1500)); // wait 1.5s before retry
                }
            }
        }

        console.error(`❌ RCON Connection Failed definitively: ${lastErr.message}`);
        this.isConnected = false;
        this.emit('statusChange', false, lastErr.message);
        if (!this._manualDisconnect) {
            this._scheduleReconnect();
        }
        throw lastErr;
    }

    _scheduleReconnect() {
        if (this._reconnectTimer) return;
        if (!this.config.autoReconnect) return;

        const delay = Math.min(
            RECONNECT_BASE_DELAY * Math.pow(2, this._reconnectAttempt),
            RECONNECT_MAX_DELAY
        );
        this._reconnectAttempt++;

        console.info(`🔄 RCON reconnect attempt ${this._reconnectAttempt} in ${delay / 1000}s...`);

        this._reconnectTimer = setTimeout(async () => {
            this._reconnectTimer = null;
            if (this._manualDisconnect) return;
            try {
                await this.connect();
            } catch {
                // connect() already schedules the next attempt on failure
            }
        }, delay);
    }

    async disconnect() {
        this._manualDisconnect = true;
        if (this._reconnectTimer) {
            clearTimeout(this._reconnectTimer);
            this._reconnectTimer = null;
        }
        if (this.client) {
            await this.client.end();
            this.client = null;
            this.isConnected = false;
            this.emit('statusChange', false);
        }
    }

    async sendCommand(command, user, count = 1) {
        if (!this.isConnected || !this.client) {
            return false;
        }

        try {
            await this.client.send(command);
            return true;
        } catch (e) {
            console.error('❌ Failed to send command to Minecraft:', e.message);
            return false;
        }
    }
}

module.exports = new MinecraftBridge();
