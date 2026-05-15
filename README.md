# TrinyTok

TrinyTok is a real-time integration platform that connects your TikTok LIVE stream directly to your games. When viewers send gifts, likes, or follows — effects trigger in-game instantly.

## Features

- **Real-time gift tracking** — captures every gift, follow, and like from your TikTok LIVE
- **Leaderboards** — ranks top supporters live, deduplicates viewer entries automatically
- **Persistent storage** — SQLite stores all session data, viewer history, and gift catalog
- **Auto-learning** — detects and remembers new gifts as they appear on stream
- **Gift → command mapping** — map any TikTok gift to one or more in-game commands
- **Preset system** — save and restore full configurations per game with one click
- **AI preset generator** — generates game presets based on your gift catalog and viewer trends
- **Admin panel** — manage gifts, accounts, donations, and streamers from a single dashboard
- **OBS-ready** — clean overlay for streaming software

## Supported Games

| Game | Mod | Integration |
|------|-----|-------------|
| **Minecraft** (Java Edition) | built-in | RCON — run any command on gift/follow/like |
| **The Binding of Isaac: Repentance** | [Triny-Tok-TBOI-Mod](https://github.com/Pencea-Flavius/Triny-Tok-TBOI-Mod) | TCP on port 58430 — 6 effect categories (chaos, curses, buffs, glitch…) |
| **R.E.P.O.** | [Triny-Tok-R.E.P.O.-Mod](https://github.com/Pencea-Flavius/Triny-Tok-R.E.P.O.-Mod) | TCP on port 51337 — 40+ effects (teleport, spawns, player upgrades…) |
| **Getting Over It** | [Triny-Tok-Getting-over-it-Mod](https://github.com/Pencea-Flavius/Triny-Tok-Getting-over-it-Mod) | TCP on port 52000 — 12 effects (gravity, launch, camera, reset…) |

Each game mod connects to the TrinyTok backend over a local TCP socket. Install the mod for your game, start the bridge from the dashboard, and you're set.

## Getting Started

**Requirements:** Node.js 18+

```bash
git clone https://github.com/Pencea-Flavius/Triny-Tok.git
cd Triny-Tok
npm install
cp .env.example .env   # fill in SESSION_SECRET and SMTP credentials
npm start
```

The dashboard will be available at `http://localhost:8081`

## Configuration

1. **TikTok** — enter your username in the Connect tab and click Connect
2. **Game bridge** — open the game's tab, configure host/port, click Start Bridge, then launch the game
3. **Gift commands** — use the Commands tab to map gifts to in-game actions
4. **Presets** — save your current setup as a preset and restore it anytime (requires account)

## Environment Variables

Copy `.env.example` to `.env` and fill in:

```
SESSION_SECRET=        # any long random string
SMTP_HOST=             # e.g. smtp.gmail.com
SMTP_PORT=587
SMTP_USER=             # your email
SMTP_PASS=             # app password
```

## Development

```bash
npm run dev      # nodemon (auto-restart on changes)
npm test         # jest test suite
npm run lint     # eslint src/
npm run db:clean # drop and recreate the SQLite database
```

## License

MIT
