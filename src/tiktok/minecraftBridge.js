const net = require('net');

class MinecraftBridge {
    constructor() {
        this.client = null;
        this.isConnected = false;
        this.config = {
            host: '127.0.0.1',
            port: 25566
        };
    }

    connect(host, port) {
        if (this.client) {
            this.client.destroy();
        }

        this.config.host = host || this.config.host;
        this.config.port = port || this.config.port;

        this.client = new net.Socket();

        return new Promise((resolve, reject) => {
            this.client.connect(this.config.port, this.config.host, () => {
                console.info(`✅ Connected to Minecraft at ${this.config.host}:${this.config.port}`);
                this.isConnected = true;
                resolve(true);
            });

            this.client.on('error', (err) => {
                console.error(`❌ Minecraft Connection Error: ${err.message}`);
                this.isConnected = false;
                reject(err);
            });

            this.client.on('close', () => {
                this.isConnected = false;
            });
        });
    }

    disconnect() {
        if (this.client) {
            this.client.destroy();
            this.client = null;
            this.isConnected = false;
        }
    }

    sendCommand(command, user, count = 1) {
        if (!this.isConnected || !this.client) {
            return false;
        }

        try {
            const payload = JSON.stringify({ command, user, count });
            this.client.write(payload + '\n');
            return true;
        } catch (e) {
            console.error('❌ Failed to send command to Minecraft:', e.message);
            return false;
        }
    }
}

module.exports = new MinecraftBridge();
