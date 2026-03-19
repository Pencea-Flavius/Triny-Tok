# TrinyTok

**TrinyTok** is a real-time TikTok LIVE integration platform that bridges your stream with games — viewers interact with your gameplay through gifts, likes, and follows.

## Features

- **Real-Time Gift Tracking** — tracks diamonds live with full donor stats
- **Top Donors Leaderboard** — auto-deduplication and ranking of your biggest supporters
- **SQLite Database** — all donations, users, and gifts are persisted across sessions
- **Auto-Learning Gifts** — new gifts are automatically detected and saved during live streams
- **Game Integration** — TikTok gifts trigger in-game events (currently: Minecraft via RCON)
- **Command Manager** — map any gift to any command directly from the Dashboard
- **OBS Overlay** — clean overlay page for streaming software
- **Modern Dashboard** — Glassmorphism UI with Dark Mode

## Getting Started

```bash
# 1. Clone the repository
git clone https://github.com/Pencea-Flavius/Triny-Tok.git
cd Triny-Tok

# 2. Install dependencies
npm install

# 3. Start the server
npm start
# Dashboard available at http://localhost:3000
```

## Configuration

1. **TikTok**: Enter your username (e.g. `@yourusername`) and click **Connect**
2. **Game Bridge**: Connect to your game server (host + port) from the Dashboard
3. **Gift Commands**: In the **Commands** tab, map gifts to in-game commands using `{username}` as a placeholder

## Supported Games

| Game | Status | Bridge |
|------|--------|--------|
| Minecraft (Java) | Supported | RCON |
| More games | Planned | — |

## Requirements

- **Node.js** >= 16

## License

MIT
