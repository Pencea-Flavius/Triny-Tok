const net = require('net');
const EventEmitter = require('events');

class IsaacBridge extends EventEmitter {
    constructor() {
        super();
        this.server = null;
        this.socket = null;
        this.isConnected = false;
        this.port = 58431;
        this._buffer = '';
    }

    start(port) {
        if (port) this.port = port;
        if (this.server) return;

        this.server = net.createServer((socket) => {
            if (this.socket) {
                console.warn('[Isaac] Second mod connection rejected — only one allowed');
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
                        this.emit('response', parsed);
                    } catch (e) { }
                });
            });

            socket.on('close', () => {
                console.info('[Isaac] Mod disconnected');
                this.isConnected = false;
                this.socket = null;
                this._buffer = '';
                this.emit('statusChange', false);
            });

            socket.on('error', (err) => {
                console.error('[Isaac] Socket error:', err.message);
                this.isConnected = false;
                this.socket = null;
                this._buffer = '';
                this.emit('statusChange', false, err.message);
            });
        });

        this.server.listen(this.port, '127.0.0.1', () => {
            console.info(`[Isaac] TCP server listening on 127.0.0.1:${this.port}`);
        });

        this.server.on('error', (err) => {
            console.error('[Isaac] Server error:', err.message);
        });
    }

    sendEffect(effectId, viewer, giftName) {
        if (!this.isConnected || !this.socket) return false;
        const payload = JSON.stringify({ effect: effectId, viewer: viewer || 'Unknown', giftName: giftName || '' }) + '\0';
        try {
            this.socket.write(payload);
            return true;
        } catch (e) {
            console.error('[Isaac] Failed to send effect:', e.message);
            return false;
        }
    }

    stop() {
        if (this.socket) { this.socket.destroy(); this.socket = null; }
        if (this.server) { this.server.close(); this.server = null; }
        this.isConnected = false;
    }
}

IsaacBridge.EFFECTS = {
    // ── Chaos ───────────────────────────────────────
    boss_wave: {
        label: 'Boss Wave',
        desc: 'Spawns 3 random bosses in the current room',
        category: 'Chaos'
    },
    enemy_wave: {
        label: 'Enemy Wave',
        desc: 'Spawns 15 random enemies',
        category: 'Chaos'
    },
    chaos_mode: {
        label: 'Chaos Mode',
        desc: 'Spawns 5 random items AND 10 enemies at once',
        category: 'Chaos'
    },
    // ── Curses ──────────────────────────────────────
    all_curses: {
        label: 'All Curses',
        desc: 'Applies every floor curse simultaneously',
        category: 'Curses'
    },
    random_curse: {
        label: 'Random Curse',
        desc: 'Applies one random curse to the floor',
        category: 'Curses'
    },
    curse_labyrinth: {
        label: 'Curse of the Labyrinth',
        desc: 'Doubles the current floor length',
        category: 'Curses'
    },
    // ── Player punishment ───────────────────────────
    near_death: {
        label: 'Near Death',
        desc: 'Reduces player to half a heart',
        category: 'Punishment'
    },
    remove_item: {
        label: 'Item Yoink',
        desc: 'Removes a random held collectible',
        category: 'Punishment'
    },
    controls_reversed: {
        label: 'Reverse Controls',
        desc: 'Flips player controls for 30 seconds',
        category: 'Timed'
    },
    inverse_screen: {
        label: 'Flip Screen',
        desc: 'Inverts the screen for 20 seconds',
        category: 'Timed'
    },
    // ── Player boons ────────────────────────────────
    full_heal: {
        label: 'Full Heal',
        desc: 'Completely fills player health',
        category: 'Boon'
    },
    give_devil_item: {
        label: 'Devil Deal',
        desc: 'Gives a random devil-pool collectible for free',
        category: 'Boon'
    },
    give_random_item: {
        label: 'Random Item',
        desc: 'Gives a random collectible',
        category: 'Boon'
    },
    add_resources: {
        label: 'Supply Drop',
        desc: 'Gives 10 coins, 5 bombs, 5 keys',
        category: 'Boon'
    },
    // ── Timed buffs ─────────────────────────────────
    speed_boost: {
        label: 'Speed Boost',
        desc: 'Doubles movement speed for 30 seconds',
        category: 'Timed'
    },
    damage_boost: {
        label: 'Damage Boost',
        desc: 'Doubles damage for 30 seconds',
        category: 'Timed'
    },
    god_mode: {
        label: 'God Mode',
        desc: 'Player is invincible for 15 seconds',
        category: 'Timed'
    },
};

module.exports = new IsaacBridge();
