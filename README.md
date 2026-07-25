# TeamSync

**Collaborate. Chat. Stay in Sync.**

Cross-platform monorepo for TeamSync — web, Chrome Extension, mobile, and desktop — all powered by one Supabase backend.

## Cross Platform

- 🌐 **Web:** Next.js
- 📱 **Android:** Expo React Native
- 🖥️ **Desktop:** Tauri
- 🧩 **Chrome Extension:** Manifest V3

### Run Web

```bash
npm install
npm run dev:web
```

Open [http://localhost:3000](http://localhost:3000).

### Run Mobile

```bash
cd mobile
npm install
npx expo start
```

Scan the QR code with Expo Go (SDK 54), or press `a` / `i` for emulator.

Copy `mobile/.env.example` → `mobile/.env` and set your Supabase keys first.

### Run Desktop

```bash
cd desktop
npm install
npm run tauri:dev
```

Dev mode loads local Next.js at `http://localhost:3000`. For an installable app (no daily `tauri:dev`):

```bash
npm run tauri:build
```

Then install from `desktop/src-tauri/target/release/bundle/` (NSIS `.exe` / MSI). The packaged app opens the live site at `https://teamsync-chi.vercel.app`.

### Run Chrome Extension

```bash
npm run build:extension
```

1. Chrome → `chrome://extensions`
2. Enable **Developer mode**
3. **Load unpacked** → select `extension/dist`
4. Sign in with the same TeamSync account

---

## Packages

| Path | Description |
|------|-------------|
| [`web/`](./web) | Full Next.js product (auth, workspaces, chat, tasks, whiteboard, notifications, realtime) |
| [`extension/`](./extension) | **Production Chrome Extension (MV3)** — popup dashboard, tasks, badges, Chrome notifications |
| [`shared/`](./shared) | Shared TypeScript types, constants, and utils |
| [`mobile/`](./mobile) | Expo React Native app (auth, workspaces, chat, tasks, alerts) |
| [`desktop/`](./desktop) | Tauri 2 shell around the web app (same Supabase backend) |
| [`supabase/`](./supabase) | SQL schema & migrations |
| [`docs/`](./docs) | Architecture notes |

## Quick start

### 1. Install

```bash
npm install
```

### 2. Environment

```bash
# Web (required)
copy .env web\.env
# or create web/.env from web/.env.local.example

# Extension (required for build/runtime)
copy extension\.env.example extension\.env
# set VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY, VITE_WEB_URL

# Mobile
copy mobile\.env.example mobile\.env
```

### 3. Run a client

See [Cross Platform](#cross-platform) above for web / mobile / desktop / extension commands.

## Chrome Extension features

- Supabase auth (session persisted in `chrome.storage`)
- Popup: avatar, name, workspace selector, online status
- Cards: unread messages, pending tasks, notifications
- Quick actions: Web / Chat / Whiteboard / Tasks
- Create task, complete task, live refresh
- Background service worker: Realtime subscriptions
- Chrome Notifications (even when popup is closed)
- Extension badge for unread counts

## Architecture

See [`docs/architecture.md`](./docs/architecture.md).

```
teamsync/
├── web/          Next.js App Router
├── extension/    Chrome MV3 (Vite + React + Tailwind)
├── shared/       @teamsync/shared
├── mobile/       Expo (React Native)
├── desktop/      Tauri 2
├── supabase/     SQL
└── docs/
```

## Scripts

| Command | Action |
|---------|--------|
| `npm run dev:web` | Next.js dev server |
| `npm run build:web` | Production web build |
| `npm run build:extension` | Build extension → `extension/dist` |
| `npm run dev:extension` | Watch-build extension |
| `npm run start:mobile` / `dev:mobile` | Expo start |
| `npm run tauri:dev` / `dev:desktop` | Tauri desktop (dev) |
| `npm run tauri:build` | Packaged desktop installer |

## Notes

- Do **not** commit `.env` files.
- All clients share the same Supabase project and realtime channels.
- Desktop production builds load the deployed web app; they do not ship a second UI.
#teamsync
