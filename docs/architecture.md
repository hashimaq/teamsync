# TeamSync Architecture

## Monorepo layout

| Package | Role |
|---------|------|
| `web/` | Next.js App Router product (auth, workspaces, chat, tasks, whiteboard, notifications) |
| `extension/` | Manifest V3 Chrome Extension (popup + background realtime) |
| `shared/` | Shared TypeScript types, constants, utils |
| `mobile/` | Expo starter (not implemented) |
| `desktop/` | Tauri starter (not implemented) |
| `supabase/` | SQL migrations / schema scripts |

## Data plane

All clients talk to the **same Supabase project** (Auth + Postgres + Realtime).

```
Web / Extension / (future Mobile & Desktop)
        │
        ▼
   Supabase Auth
   Postgres + RLS
   Realtime (postgres_changes / broadcast / presence)
```

## Chrome Extension realtime

- Service worker restores the Supabase session from `chrome.storage.local`
- Subscribes to `notifications` (recipient filter) and `messages` inserts
- Updates badge counts and fires `chrome.notifications`
- Popup refreshes via `EXT_REFRESH` runtime messages

## Local development

1. Copy env files (never commit secrets):
   - `web/.env` from root `.env` or `web/.env.local.example`
   - `extension/.env` from `extension/.env.example`
2. From repo root: `npm install`
3. Web: `npm run dev:web`
4. Extension: `npm run build:extension` then Load Unpacked → `extension/dist`
