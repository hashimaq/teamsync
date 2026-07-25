# TeamSync Chrome Extension

Manifest V3 extension for TeamSync.

## Setup

1. Copy `.env.example` → `.env` and fill Supabase + web URL.
2. From repo root: `npm install` then `npm run build:extension`
3. Load `extension/dist` as an unpacked extension in Chrome.

## Structure

```
src/
  background/   Service worker (realtime, badge, notifications)
  popup/        React popup UI
  components/   Popup UI pieces
  hooks/        Session + dashboard data
  lib/          Supabase client, storage, helpers
  styles/       Tailwind entry
```
