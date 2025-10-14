# Vtuber Discord Bot + Mini Dashboard (Starter Kit)

**What you get**
- Go‑Live announcements (Twitch + YouTube polling, generic webhook endpoint for anything else)
- Reaction roles (button menu)
- Ticket system (open/close)
- Music player (YouTube URLs/search via play-dl)
- Web dashboard with Discord OAuth login (choose a server you manage and configure)

## Quickstart
1. Rename `.env.example` to `.env` and fill in the required values (Discord token/IDs; Twitch & YouTube keys if you want polling).
2. In this folder, run:
   ```bash
   npm i
   npm run start
   ```
3. Open http://localhost:3000 and click **Login**.
4. Pick a server you manage (where the bot is present) and set things up.

> Tip: If you only want announcements via external tools (Streamer.bot, etc.), POST to `/webhooks/generic-live` with `{ "url": "...", "title": "...", "display_name": "..." }`.

## Commands
- `/live add|remove|list`
- `/roles setup`
- `/ticket panel|close`
- `/music play|skip|stop|queue`
