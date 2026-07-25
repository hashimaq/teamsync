# TeamSync Desktop (Tauri 2)

Native desktop shell for TeamSync. It does **not** reimplement the product — it embeds the existing Next.js web application in a Tauri 2 window and talks to the **same Supabase backend**.

| Mode | What loads |
|------|------------|
| Development (`tauri:dev`) | Local Next.js at `http://localhost:3000` |
| Production build | Live app at `https://teamsync-chi.vercel.app` (override with `TEAMSYNC_DESKTOP_PROD_URL`) |

No duplicate React UI, no duplicate business logic, no database changes.

---

## Project structure

```
desktop/
├── package.json              # @tauri-apps/cli + JS plugin bindings
├── app-icon.png              # Source icon for `npm run icon`
├── README.md
└── src-tauri/
    ├── Cargo.toml            # Rust crate + plugins
    ├── tauri.conf.json       # Tauri 2 config
    ├── capabilities/         # Security allowlist
    ├── scripts/
    │   └── desktop-bridge.js # Injected offline + shortcut UX
    ├── icons/                # Generated platform icons
    └── src/
        ├── main.rs
        └── lib.rs            # Window, shortcuts, plugins
```

---

## Prerequisites

1. **Node.js 20+** (monorepo root)
2. **Rust** (stable) — https://rustup.rs  
   ```powershell
   winget install Rustlang.Rustup
   ```
3. **Windows linker (pick one)**  
   - **Recommended — MSVC:** Visual Studio Build Tools with C++ tools  
     ```powershell
     winget install -e --id Microsoft.VisualStudio.2022.BuildTools --override "--wait --passive --add Microsoft.VisualStudio.Workload.VCTools --includeRecommended"
     rustup default stable-x86_64-pc-windows-msvc
     ```
   - **Fallback — MinGW:** WinLibs (used automatically if `link.exe` is missing)  
     ```powershell
     winget install -e --id BrechtSanders.WinLibs.POSIX.UCRT
     rustup toolchain install stable-x86_64-pc-windows-gnu
     ```
4. **WebView2** on Windows (usually preinstalled on Win 10/11)
5. Linux: see [Tauri prerequisites](https://v2.tauri.app/start/prerequisites/)


---

## Development

From the **monorepo root**:

```bash
npm install
npm run tauri:dev
```

Or from `desktop/`:

```bash
cd desktop
npm install
npm run tauri:dev
```

This will:

1. Start `@teamsync/web` (`next dev`) via Tauri `beforeDevCommand`
2. Open a native window pointed at `http://localhost:3000`

Override the web URL if needed:

```bash
# Windows PowerShell
$env:TEAMSYNC_DESKTOP_DEV_URL="http://127.0.0.1:3000"
npm run tauri:dev
```

---

## Production build / packaging

```bash
# from monorepo root
npm run tauri:build
```

Artifacts land under:

```
desktop/src-tauri/target/release/bundle/
```

| OS | Typical outputs |
|----|-----------------|
| Windows | `.msi` / `.exe` (NSIS) |
| macOS | `.dmg` / `.app` |
| Linux | `.deb` / `.AppImage` |

The packaged app loads **`https://teamsync-chi.vercel.app`** by default so it always uses the production Next.js + Supabase stack. Override:

```bash
$env:TEAMSYNC_DESKTOP_PROD_URL="https://your-deploy.example"
npm run tauri:build
```

---

## Desktop enhancements

| Feature | Implementation |
|---------|----------------|
| Native window | Tauri WebviewWindow, title **TeamSync** |
| Resizable + min size | 1280×800 default, min 960×640 |
| Remember size/position | `tauri-plugin-window-state` |
| Custom icon | `npm run icon` from `app-icon.png` |
| Native notifications | `tauri-plugin-notification` (available to the shell) |
| Clipboard | `tauri-plugin-clipboard-manager` |
| Ctrl/Cmd + K | Shortcut → in-app banner (search placeholder) |
| Ctrl/Cmd + N | Shortcut → in-app banner (new task placeholder) |
| Loading title | “TeamSync — Loading…” then “TeamSync” |
| Offline detection | Injected bridge listens to `offline` / `online` |
| Auto reconnect UX | Banner when connection returns (Supabase clients already reconnect) |

---

## Security

- Capability allowlist in `src-tauri/capabilities/default.json`
- Only the permissions required for clipboard, notifications, window-state, shortcuts, and opening external links
- Supabase keys stay in the **web** app env (`NEXT_PUBLIC_*` / server env) — not hardcoded in Rust
- No broad filesystem or arbitrary shell execution APIs enabled

---

## Icons

Generate platform icons after changing `app-icon.png`:

```bash
cd desktop
npm run icon
```

---

## Supported operating systems

- Windows 10/11 (x64)
- macOS 11+ (Apple Silicon & Intel)
- Linux (Debian/Ubuntu-based targets with WebKitGTK)

---

## Troubleshooting

**`cargo` / `program not found`**  
Close the terminal and open a **new** one (so PATH picks up `%USERPROFILE%\.cargo\bin`), then:

```bash
npm run tauri:dev
```

Scripts now also prepend Cargo to PATH automatically.

**`export ordinal too large` (MinGW)**  
Caused by building a `cdylib` with the GNU linker. This project uses `crate-type = ["rlib"]` so desktop builds avoid that. If you still see it, clean and rebuild:

```powershell
Remove-Item -Recurse -Force D:\TeamSync\desktop\src-tauri\target -ErrorAction SilentlyContinue
npm run tauri:dev
```

**`linker link.exe not found`**  
MSVC Build Tools incomplete or not on PATH. `run-tauri.mjs` auto-falls back to **windows-gnu** when `link.exe` is missing. Wait for Build Tools install to finish (`isComplete: true`), open a **new** terminal, then prefer:

```powershell
rustup default stable-x86_64-pc-windows-msvc
npm run tauri:dev
```

**`dlltool.exe: program not found`**  
GNU fallback needs MinGW. Install WinLibs:

```powershell
winget install -e --id BrechtSanders.WinLibs.POSIX.UCRT
```

**`An Application Control policy has blocked this file` (os error 4551)**  
Windows is blocking Cargo’s freshly built `build-script-build.exe` files under `desktop/src-tauri/target`. This is an OS policy (Smart App Control / WDAC / Defender), not a TeamSync bug.

1. **Windows Security → App & browser control → Smart App Control** — if it is On or in Evaluation mode, set it to **Off** (requires reboot on some builds).
2. **Windows Security → Virus & threat protection → Exclusions** — add folder:
   `D:\TeamSync\desktop\src-tauri\target`
3. Delete the blocked build cache and retry:

```powershell
Remove-Item -Recurse -Force D:\TeamSync\desktop\src-tauri\target -ErrorAction SilentlyContinue
npm run tauri:dev
```

If your PC is managed by school/work WDAC, only an admin can allowlist the path — local exclusions may not apply.

**Port 3000 already in use**  
Tauri’s `devUrl` is `http://localhost:3000`. Stop the other Next process (or free the port), then re-run `tauri:dev` so the shell and web share the same port.

**WebView2 missing (Windows)**  
Install the [Evergreen WebView2 Runtime](https://developer.microsoft.com/microsoft-edge/webview2/).

**Shortcuts don’t fire**  
Some apps steal global hotkeys; try focusing the TeamSync window first.
