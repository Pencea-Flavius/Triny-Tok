# AI Tools Usage Report — Triny-Tok

## 1. Tools Used

| Tool | Purpose |
|------|---------|
| **Claude Code (CLI)** | Code refactoring, splitting large files, architecture review |
| **Ollama + qwen2.5:7b** | AI agents integrated into the app (game suggestions, preset generation) |
| **Twitch Helix API** | Live data source for the game suggestion agent |

---

## 2. Claude Code — Assistance During Development

### 2.1 Refactoring and File Splitting

During development, several files grew too large to manage effectively. Claude Code was used to plan and execute their splitting into smaller modules.

**`server.js` → route modules** (branch `refactor/route-split`, PR #13 and #14):
- The original `server.js` contained all route logic inline.
- Claude Code identified logical groupings and generated the separate files: `routes/auth.js`, `routes/admin.js`, `routes/live.js`, `routes/gifts.js`, `routes/commands.js`, `routes/presets.js`, `routes/isaac.js`, `routes/repo.js`, `routes/goi.js`, `routes/ai.js`.
- Each route was extracted with the correct `require` imports and mounted in `server.js` via `app.use()`.

**`app.ejs` → partials** (branch `refactor/app-ejs`, PR #1):
- The main EJS template had become very large.
- Claude Code proposed the partials structure and generated each file under `views/partials/app/` and `views/partials/admin/`.

**Database consolidation** (branch `refactor/single-db`, PR #6):
- The app initially used separate per-user databases.
- Claude Code assisted in migrating to a single `global.db` with a complete relational schema.

### 2.2 What Was Accepted vs. Adjusted

Claude Code's suggestions were generally accepted structurally, with manual adjustments for:
- File names and URL routes (project-specific design decisions)
- Game-specific logic in handlers (the game bridge files)
- The `ctx` singleton — Claude Code suggested the pattern; the final implementation stayed simple: a plain object exported from `context.js`, cached by Node.js's module system

---

## 3. AI Agents Integrated in the Application

The app contains two AI agents implemented in `src/ai/ollamaClient.js`, both running locally through **Ollama** with the **qwen2.5:7b** model.

### Agent 1 — Game Suggestion (`suggestGame`)

**Purpose:** Recommends what game to stream, or gives advice on how to make a stream more engaging.

**How it works:**
- Receives a prompt from the user (e.g., "what should I stream today?")
- Decides whether to call tools or answer directly
- Has access to two tools:
  - `get_trending_games` — calls the Twitch Helix API and returns the top 10 games by viewer count, annotated with a `supported_in_app` field
  - `get_user_preferences` — reads the user's saved preferences from the DB (favorite games, streaming style, audience type, schedule)
- Responds in plain natural text, no markdown

**How the prompt was built:**
- The system prompt clearly distinguishes two scenarios: the user doesn't know which game to pick (→ call tools) vs. the user already knows the game and wants streaming tips (→ answer directly without tool calls)
- Multiple prompt iterations were needed before the agent stopped calling `get_trending_games` unnecessarily when the question was about stream tactics rather than game selection

### Agent 2 — Preset Generation (`suggestPreset`)

**Purpose:** Automatically generates a gift-command preset for a game (Minecraft, Isaac, R.E.P.O., Getting Over It), mapped to the streamer's TikTok gifts.

**How it works:**
- Before calling the model, the server collects all relevant data:
  - Donation history from the current stream session
  - Preferred gifts saved in the DB
  - The user's existing presets
  - Item/enemy/boss catalogs (from the DB)
- All this data is injected into the system prompt — the model does not query the DB; the server does it upfront
- The model has access to:
  - `search_item`, `search_boss` (for Isaac)
  - `search_enemy`, `search_item`, `search_valuable` (for R.E.P.O.)
  - `create_preset` — the only write tool, validated server-side
- If `create_preset` fails validation, the detailed error is sent back to the model with correction instructions
- If the model produces a response without calling any tool, a "nudge" message directs it explicitly to use tools

**Validations implemented in `create_preset`:**
- Minimum 7 gifts must be mapped (rejected otherwise)
- All gift keys must exist in the gift catalog in the DB (no invented names)
- No gift can have an empty command
- For R.E.P.O.: timed effects must include a `duration` field, instant ones must not
- For Getting Over It: counted effects must have `count`, timed effects `duration`, instant effects neither
- For Isaac: `use_item` is automatically corrected to `spawn_item` if the item is not of type Active

**How the tools and prompts were built:**
- The first version of the agent used tool calls to fetch data (items, bosses, etc.) — the 7B model called them chaotically or ignored them
- The architecture was changed to the current approach: the server gathers all data and injects it into the system prompt; the model only does targeted searches and the final `create_preset` call
- Tool descriptions include concrete `RIGHT` vs. `WRONG` examples to prevent key/value confusion (a frequent issue: the model would put the effect ID as the key and the gift name as the value)
- A retry loop of up to 12 iterations allows the model to correct validation errors

---

## 4. Conclusion

Claude Code primarily accelerated structural refactoring tasks — splitting large files and reorganizing the project into modules. The AI agents integrated into the application required a longer iterative process: small local models (7B) need very precise prompts, explicit examples, and robust server-side validation to produce consistent output. The final architecture — where the server prepares all data and the model has one clearly defined task — proved more reliable than an approach where the model managed all data fetching on its own.
