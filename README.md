# TrinyTok

TrinyTok is a real-time integration platform that connects your TikTok LIVE stream directly to your games. It allows your viewers to interact with your gameplay through gifts, likes, and follows, creating an engaging experience for everyone involved.

## Features

- Real-Time Tracking: Keeps track of donations, diamonds, and viewer stats live.
- Leaderboards: Automatically ranks your top supporters and deduplicates entries.
- Persistent Storage: Uses SQLite to safely store all session data, users, and gift history.
- Auto-Learning: Detects and remembers new gifts automatically as they happen on stream.
- Game Integration: Triggers specific in-game events when viewers interact on TikTok. 
- Command Manager: Easily map any TikTok gift to custom game commands right from the dashboard.
- OBS Overlay: Provides a clean, ready-to-use overlay for your streaming software.
- Dashboard: A modern interface to manage everything seamlessly.

## Getting Started

1. Clone the repository
```bash
git clone https://github.com/Pencea-Flavius/Triny-Tok.git
cd Triny-Tok
```

2. Install dependencies
```bash
npm install
```

3. Start the server
```bash
npm start
```
The dashboard will be available at http://localhost:3000

## Configuration

1. TikTok Setup: Enter your username (e.g. @yourusername) in the dashboard and connect.
2. Game Bridge: Set up the connection to your game or server directly from the interface.

## Supported Games

- Minecraft (Java Edition) via RCON
- The Binding of Isaac

We plan to add support for more games in the future.

## Requirements

- Node.js version 16 or newer.

## License

MIT
