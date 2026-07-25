# TeamSync

**Collaborate. Chat. Stay in Sync.**

Cross-platform monorepo for TeamSync — web app, Chrome Extension, and starters for mobile & desktop — all powered by one Supabase backend.

## Packages

| Path | Description |
|------|-------------|
| [`web/`](./web) | Full Next.js product (auth, workspaces, chat, tasks, whiteboard, notifications, realtime) |
| [`extension/`](./extension) | **Production Chrome Extension (MV3)** — popup dashboard, tasks, badges, Chrome notifications |
| [`shared/`](./shared) | Shared TypeScript types, constants, and utils |
| [`mobile/`](./mobile) | Expo **starter only** (no UI yet) |
| [`desktop/`](./desktop) | Tauri **starter only** (no UI yet) |
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
```

### 3. Run web

```bash
npm run dev:web
```

Open [http://localhost:3000](http://localhost:3000).

### 4. Build & load Chrome Extension

```bash
npm run build:extension
```

1. Chrome → `chrome://extensions`
2. Enable **Developer mode**
3. **Load unpacked** → select `extension/dist`
4. Sign in with the same TeamSync account

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
├── mobile/       Expo starter
├── desktop/      Tauri starter
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

## Notes

- Do **not** commit `.env` files.
- Mobile and desktop are intentional stubs for a later phase.
- Existing web features were moved under `web/` without intentional feature removals.
#teamsync
