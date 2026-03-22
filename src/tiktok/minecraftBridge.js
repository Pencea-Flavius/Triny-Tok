const { Rcon } = require('rcon-client');
const EventEmitter = require('events');

class MinecraftBridge extends EventEmitter {
    constructor() {
        super();
        this.client = null;
        this.isConnected = false;
        this.config = {
            host: '127.0.0.1',
            port: 25575,
            password: ''
        };
    }

    async connect(host, port, password) {
        if (this.client) {
            await this.disconnect();
        }

        this.config.host = host || this.config.host;
        this.config.port = port || this.config.port;
        this.config.password = password || this.config.password;

        if (this.config.host === 'localhost') {
            this.config.host = '127.0.0.1'; // Fix potential Node 17+ localhost resolution issues
        }

        try {
            this.client = await Rcon.connect({
                host: this.config.host,
                port: this.config.port,
                password: this.config.password
            });

            console.info(`✅ Connected to Minecraft via RCON at ${this.config.host}:${this.config.port}`);
            this.isConnected = true;
            this.emit('statusChange', true);

            this.client.on('error', (err) => {
                console.error(`❌ RCON Error: ${err.message}`);
                this.isConnected = false;
                this.emit('statusChange', false, err.message);
            });

            this.client.on('end', () => {
                this.isConnected = false;
                this.emit('statusChange', false, 'RCON connection ended');
            });

            return true;
        } catch (err) {
            console.error(`❌ RCON Connection Failed: ${err.message}`);
            this.isConnected = false;
            this.emit('statusChange', false, err.message);
            throw err;
        }
    }

    async disconnect() {
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
            // RCON executes commands directly as if typed in console.
            // No need to JSON stringify like the old plugin
            await this.client.send(command);
            return true;
        } catch (e) {
            console.error('❌ Failed to send command to Minecraft:', e.message);
            return false;
        }
    }
}

module.exports = new MinecraftBridge();
