# TrinyTok

Connects a TikTok LIVE to the game you're playing. When a viewer sends a gift, follows or likes, something happens in the game: a boss spawns, gravity turns off, your character dies.

![TrinyTok homepage](docs/screenshots/home.jpg)

**This is not open source.** You can read the code and run it for your own streams, but you can't republish it, sell it or reuse it in another product. See [LICENSE](LICENSE).

It started as a project for the *Metode de Dezvoltare Software* course at university and is built as a proof of concept, so expect rough edges.

## Supported games

| Game | Connection | Mod |
|------|------------|-----|
| Minecraft (Java) | RCON | not needed |
| The Binding of Isaac: Repentance | local TCP, port 58430 | [Triny-Tok-TBOI-Mod](https://github.com/Pencea-Flavius/Triny-Tok-TBOI-Mod) |
| R.E.P.O. | local TCP, port 51337 | [Triny-Tok-R.E.P.O.-Mod](https://github.com/Pencea-Flavius/Triny-Tok-R.E.P.O.-Mod) |
| Getting Over It | local TCP, port 52000 | [Triny-Tok-Getting-over-it-Mod](https://github.com/Pencea-Flavius/Triny-Tok-Getting-over-it-Mod) |

Each game's page in the app has a setup guide.

## Running it

You need Node.js 20 or newer.

```bash
git clone https://github.com/Pencea-Flavius/Triny-Tok.git
cd Triny-Tok
npm install
cp .env.example .env
npm start
```

Open http://localhost:8081, enter a TikTok username that is live, then pick a game, start its bridge and choose what each gift does.

## Accounts

You don't need an account to use the app. Without one, your setup is kept in `config/config.json`.

An account adds saved presets and the AI. Signing up asks for an email address and sends a link you have to open before you can log in, so the app needs a mail account to send from. Fill in the `SMTP_` settings in `.env` before registering. With Gmail, that means turning on 2-step verification and using an [app password](https://myaccount.google.com/apppasswords), not your normal one.

To make an account an admin:

```bash
sqlite3 data/global.db "UPDATE app_accounts SET is_admin = 1 WHERE email = 'you@example.com';"
```

## Using it on stream

1. Start the game with its mod installed. In Minecraft, set `enable-rcon=true` and `rcon.password` in `server.properties` and restart the server.
2. In TrinyTok, open the game's page and press **Start Bridge**, or **Connect** for Minecraft. The status changes once the game is connected.
3. Press **Add Effect**, pick a gift, follow or likes as the trigger, and choose what it does. **Test** runs it right away.
4. Go live, then enter your username on the **TikTok Connect** page.
5. In OBS, add a browser source pointing at the page behind the **Overlay** button, so viewers can see which gift does what.

The chat, gift log and top donors pages fill up on their own while you're connected.

## How it works

```
TikTok LIVE ──> tiktok-live-connector ──> Node server ──> RCON ───────> Minecraft
                                               │
                                               ├────────> local TCP ──> game mods
                                               │
                                               └────────> Socket.IO ──> browser
```

The server listens to the live, looks up the gift, follow or like in your config and sends the mapped effect to the game. Minecraft gets a command over RCON. The other games run a mod that connects to the bridge on its port and receives each effect as JSON ending in a null byte.

| Path | What's there |
|------|--------------|
| `src/server.js` | Express, Socket.IO and startup |
| `src/events/giftHandler.js` | turns an event into game effects |
| `src/tiktok/` | the TikTok connection and one bridge per game |
| `src/routes/` | the API |
| `src/ai/` | Ollama and Twitch clients for the AI |
| `views/`, `public/` | pages, styles and browser scripts |
| `public/css/tokens.css` | all colours and fonts |
| `config/config.json` | your current setup (created on first run, not in git) |
| `data/global.db` | accounts, presets and history (copied from `data/seed.db` on first run, not in git) |

```bash
npm run dev    # restarts on changes
npm test
npm run lint
```

## Screenshots

These come from a real live. Every username and profile picture, the streamer's included, was replaced before the capture.

![Live session](docs/screenshots/live.png)

![Live chat](docs/screenshots/chat.png)

![Gift log](docs/screenshots/donations.png)

![Top donors](docs/screenshots/top-donors.png)

Mapping gifts to effects:

![Isaac gift effects](docs/screenshots/game-isaac.png)

Asking the AI what to stream, and having it build a preset. It runs on your PC through [Ollama](https://ollama.com):

![AI suggestions](docs/screenshots/ai-chat.png)

![AI preset](docs/screenshots/ai-preset.png)

## Settings

All of these go in `.env`, and none are needed just to try it on your own PC.

| Name | Used for |
|------|----------|
| `SESSION_SECRET` | keeping you logged in after a restart (required in production) |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS` | verification and password reset emails |
| `OLLAMA_URL`, `OLLAMA_MODEL` | the AI (run `ollama pull qwen2.5:7b` first) |
| `TWITCH_CLIENT_ID`, `TWITCH_CLIENT_SECRET` | trending games for the AI's stream suggestions |
| `PORT` | the app's port, 8081 by default |
| `HOST` | `127.0.0.1` keeps the app on this PC. `0.0.0.0` opens it to your network, and changes then need an admin login |
| `BRIDGE_HOST` | set to `0.0.0.0` only if a game mod runs on another PC |

## License

Copyright (c) 2026 Pencea Flavius. All rights reserved. The terms are in [LICENSE](LICENSE).

TrinyTok isn't affiliated with TikTok or with the makers of these games.
