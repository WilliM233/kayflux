# KayFlux — Deployment Infrastructure Requirements
**Document Type:** Product Requirements (Architect/Designer layer → Claude Code execution)  
**Scope:** Docker production workflow + Electron Desktop launcher  
**Repo:** https://github.com/WilliM233/kayflux  
**Branch strategy:** `develop` → `main` (production)

---

## Context & Decisions Made

KayFlux is a local-first WWE Universe Mode booking manager (Node.js + Express + SQLite). It is being prepared for public GitHub release. Two distinct deployment artifacts are required targeting two distinct user personas:

| Artifact | Target User | Prereqs |
|---|---|---|
| **Docker deployment** | Self-hosters (TrueNAS, Unraid, home server) | Docker + Docker Compose |
| **KayFlux Desktop (Electron)** | Average WWE fan, non-technical | None — zero prereqs |

These are not alternatives — both ship. The core application code is shared.

**Technology decisions are final:**
- Docker image published to **GitHub Container Registry (GHCR)** via GitHub Actions
- Desktop launcher: **Electron + electron-builder** (not pkg, not Tauri, not systray-only)
- Auto-update: **electron-updater** pointed at GitHub Releases
- Versioning: **semver** (v1.0.0, v1.1.0, etc.) with git tags driving releases
- Electron app lives in **`/desktop`** subdirectory of the existing kayflux repo

---

## Work Item 1 — Dockerfile Upgrade

**Current state:** Dockerfile exists and is functional (`node:20-alpine`, builds sqlite3 native module, `DB_PATH=/data/app.db`, exposes 3000). Docker run instructions in README are manual stop/rm/build/run cycle.

**Required changes:**

### 1a. Dockerfile — Production hardening
- Switch base image to `node:20-alpine` with explicit digest pinning for reproducibility
- Add `NODE_ENV=production` ENV
- Add non-root user (`addgroup kayflux && adduser -S kayflux -G kayflux`) and run as that user — security baseline for public image
- Add `HEALTHCHECK` instruction: `CMD wget -qO- http://localhost:3000/api/brands || exit 1` with `--interval=30s --timeout=5s --start-period=10s --retries=3`
- Add `PORT` ENV with default `3000` so port is configurable without rebuilding
- Ensure `server.js` reads `process.env.PORT` (verify/patch if needed)
- Label the image: `LABEL org.opencontainers.image.source="https://github.com/WilliM233/kayflux"`

### 1b. docker-compose.yml — New file, root of repo
Create a production-ready `docker-compose.yml` that a user can download and run without any build step (pulls from GHCR):

```yaml
# Target structure (Claude Code implements):
services:
  kayflux:
    image: ghcr.io/willim233/kayflux:latest
    container_name: kayflux
    restart: unless-stopped
    ports:
      - "${KAYFLUX_PORT:-3030}:3000"
    volumes:
      - kayflux-data:/data
    environment:
      - NODE_ENV=production
    healthcheck: (mirror Dockerfile healthcheck)

volumes:
  kayflux-data:
```

- Port externally maps to `3030` by default (matching current TrueNAS deployment) via env var override
- Named volume for database persistence
- `.env.example` file alongside it documenting `KAYFLUX_PORT`

---

## Work Item 2 — GitHub Actions: GHCR Publishing

Create `.github/workflows/docker-publish.yml`:

**Trigger:** Push to `main` branch only (not develop)

**Steps:**
1. Checkout
2. Log in to GHCR using `GITHUB_TOKEN` (no secrets needed — built-in)
3. Extract metadata (tags + labels) using `docker/metadata-action`
4. Tag strategy:
   - `latest` on every main push
   - Semver tags (`v1.0.0` → `1.0.0`, `1.0`, `1`) when a git tag is pushed
5. Build and push using `docker/build-push-action` with cache (`type=gha`)
6. Multi-platform build: `linux/amd64,linux/arm64` (covers TrueNAS on x86 and potential ARM NAS devices)

**Outcome:** After merge to main, `docker compose pull` works from any machine with no local build required.

---

## Work Item 3 — GitHub Actions: Release Workflow

Create `.github/workflows/release.yml`:

**Trigger:** Push of a tag matching `v*.*.*`

**Purpose:** Drives both the Docker semver tag (handled by docker-publish via tag trigger) and triggers the Electron build.

This workflow is the "release gate" — tagging `v1.0.0` starts the entire release pipeline.

---

## Work Item 4 — Electron Desktop App (`/desktop`)

### 4a. Directory structure

```
/desktop
  package.json          # Electron app manifest
  electron-builder.yml  # Build/packaging config
  main.js               # Main process
  preload.js            # Preload script (contextBridge)
  src/
    index.html          # Launcher UI
    renderer.js         # Renderer process logic
    styles.css          # Launcher UI styles
  assets/
    icon.png            # 512x512 app icon (KayFlux logo/wordmark)
    icon.icns           # macOS
    icon.ico            # Windows
    tray-idle.png       # 16x16 tray icon (light + dark variants)
    tray-error.png      # 16x16 tray icon error state
```

### 4b. Bundled server strategy

The Electron app bundles the KayFlux server. Claude Code should:
- Copy/reference the parent repo's `server.js`, `public/`, `schema.sql`, `seed-default.js` into a `server/` subdirectory within `/desktop` at build time (or use relative path references)
- Bundle Node.js runtime via electron's own Node — **no external Node install required**
- Database (`app.db`) lives in `app.getPath('userData')` — platform-appropriate user data directory, never inside the app bundle

### 4c. Main process behavior (`main.js`)

**Server lifecycle:**
- On app ready: spawn `server.js` as a child process using Electron's bundled Node
- Pass `DB_PATH` env pointing to `app.getPath('userData')/app.db`
- Pass `PORT=3030` (or read from persisted settings)
- Poll `http://localhost:3030/api/brands` every 500ms until healthy (max 15s timeout)
- On healthy: open browser to `http://localhost:3030`, transition UI to running state
- On timeout: show error state in launcher window
- On app quit: kill child process gracefully (`SIGTERM`, then `SIGKILL` after 3s)

**Window behavior:**
- Launcher window: 420x280px, not resizable, no menu bar, centered on screen
- Window can be closed without quitting — server keeps running, tray icon remains
- `app.dock.hide()` on macOS after server starts (tray-only mode)
- Prevent multiple instances: `app.requestSingleInstanceLock()`

**Tray:**
- Icon: idle state when running, error state when unhealthy
- Tooltip: "KayFlux — Running" / "KayFlux — Error"
- Context menu:
  - "Open KayFlux" → opens browser
  - "Restart Server" → kills and restarts child process
  - separator
  - "Settings..." → opens settings window
  - separator  
  - "Quit KayFlux" → graceful shutdown + exit

### 4d. Launcher UI (`src/index.html` + `renderer.js`)

**Design brief — KayFlux Arena Dark aesthetic:**  
Match the existing KayFlux visual identity. Dark background (`#0d0d0d`), CCO Gold accent (`#c9a84c`), brand-weight typography. This is not a generic Electron loader — it should feel like a deliberate piece of the KayFlux product.

**States (renderer switches between these):**

1. **Starting** — Logo/wordmark centered. Animated status indicator (subtle pulse, gold). Text: "Starting KayFlux..." No user actions.

2. **Running** — Logo. Gold "● Running" status pill. "Open KayFlux →" primary button (gold, full-width). Port display: "localhost:3030" in muted text. User can close this window — tray takes over.

3. **Error** — Logo. Red "● Error" status pill. Error message (truncated, max 2 lines). "Retry" button. "View Logs" link (opens log file).

**Settings window** (separate small window, ~380x240px):
- Port field (default 3030, numeric, validated)
- "Launch at login" toggle
- "Save" button
- Changes take effect on next server restart

### 4e. electron-builder configuration (`electron-builder.yml`)

```yaml
# Target output (Claude Code implements full config):
appId: com.kayflux.app
productName: KayFlux
copyright: MIT

# Windows
win:
  target: nsis        # Installer wizard
  icon: assets/icon.ico

nsis:
  oneClick: false
  allowToChangeInstallationDirectory: true

# macOS  
mac:
  target: dmg
  icon: assets/icon.icns
  category: public.app-category.sports-games

dmg:
  background: (dark gradient matching KayFlux theme)

# Linux
linux:
  target: AppImage
  icon: assets/icon.png
  category: Game

# Auto-update
publish:
  provider: github
  owner: WilliM233
  repo: kayflux
```

### 4f. Auto-update (`electron-updater`)

- On app start (after server healthy): check for updates silently in background
- If update available: show non-intrusive notification in launcher window or tray menu item "Update available — restart to install"
- Download in background
- On next quit/relaunch: install update
- Do NOT force-interrupt the user while they're using the app

---

## Work Item 5 — GitHub Actions: Electron Build & Release

Create `.github/workflows/electron-build.yml`:

**Trigger:** Workflow call from `release.yml` (tag push)

**Matrix:** `[windows-latest, macos-latest, ubuntu-latest]`

**Steps per platform:**
1. Checkout
2. Setup Node 20
3. `npm ci` in `/desktop`
4. `npm run build` (electron-builder)
5. Upload artifacts to GitHub Release (created by release.yml)

**Release assets produced:**
- `KayFlux-Setup-{version}.exe` (Windows NSIS installer)
- `KayFlux-{version}.dmg` (macOS)
- `KayFlux-{version}.AppImage` (Linux)
- `latest.yml` / `latest-mac.yml` / `latest-linux.yml` (electron-updater manifests)

---

## Work Item 6 — Repo Hygiene for Public Release

### 6a. README.md — Full rewrite

The current README is functional but developer-facing. Replace with a public-quality document:

**Structure:**
1. Hero section — tagline, screenshot/GIF (placeholder acceptable), badges (version, license, platform)
2. "Download KayFlux" — primary CTA, links to GitHub Releases, platform badges (Windows / macOS / Linux)
3. Features — current feature list, presented for a WWE fan audience (not developer audience)
4. "For Self-Hosters (Docker)" — compose file instructions, two-command update workflow
5. "AI GM Setup" — brief section linking to kayflux-mcp, explaining the Claude Projects concept in plain language
6. Screenshots section (placeholder)
7. License

**Tone:** Enthusiast product, not dev tool. Someone who runs a fantasy booking league should feel at home.

### 6b. License update
Current README says "Private project — not distributed." Update to **MIT License** — add `LICENSE` file, update README badge and footer.

### 6c. .gitignore additions
Ensure the following are ignored:
- `desktop/dist/`
- `desktop/node_modules/`
- `*.db` (already likely ignored — verify)
- `.env`

### 6d. CLAUDE.md
This file contains internal AI assistant reference docs. Add a note at the top: `<!-- This file is for AI assistant context. Not user documentation. -->` — no other changes needed.

---

## Sequencing Recommendation for Claude Code

Execute in this order to avoid blocked work:

1. **Dockerfile + docker-compose.yml** (Work Items 1a, 1b) — self-contained, no dependencies
2. **GHCR GitHub Action** (Work Item 2) — depends on Dockerfile
3. **Release workflow skeleton** (Work Item 3) — sets up the tag-based trigger chain
4. **Electron `/desktop` scaffold** (Work Item 4a, 4b, 4c) — main process + server spawn
5. **Launcher UI** (Work Item 4d) — renderer layer, depends on main process IPC being defined
6. **electron-builder config + auto-update** (Work Items 4e, 4f)
7. **Electron build GitHub Action** (Work Item 5)
8. **README rewrite + repo hygiene** (Work Item 6) — last, so it reflects the final state

---

## IPC Contract (Main ↔ Renderer)

Claude Code must define and implement these IPC channels consistently:

| Channel | Direction | Payload |
|---|---|---|
| `server:status` | main → renderer | `{ state: 'starting' \| 'running' \| 'error', port: number, error?: string }` |
| `server:restart` | renderer → main | none |
| `app:open-browser` | renderer → main | none |
| `settings:get` | renderer → main | none |
| `settings:get:reply` | main → renderer | `{ port: number, launchAtLogin: boolean }` |
| `settings:save` | renderer → main | `{ port: number, launchAtLogin: boolean }` |
| `logs:open` | renderer → main | none |

All renderer→main calls go through `contextBridge` in `preload.js`. No `nodeIntegration: true`. Security baseline is non-negotiable.

---

## Out of Scope (v1)

- Code signing (Windows SmartScreen / macOS notarization) — documented as known limitation
- Auto-launch of KayFlux browser tab on system startup (tray-only on relaunch)
- Multiple universe support from the launcher
- kayflux-mcp installer integration

---

*Document version: 1.0 — Architecture & Design layer. Implementation by Claude Code.*
