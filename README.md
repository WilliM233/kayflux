# KayFlux

**Book the fiction. Run the universe.**

[![License: MIT](https://img.shields.io/badge/License-MIT-c9a84c.svg)](LICENSE)
[![GitHub Release](https://img.shields.io/github/v/release/WilliM233/kayflux?color=c9a84c)](https://github.com/WilliM233/kayflux/releases)
[![Platform](https://img.shields.io/badge/platform-Windows%20%7C%20macOS%20%7C%20Linux%20%7C%20Docker-333)](https://github.com/WilliM233/kayflux/releases)

KayFlux is a WWE 2K Universe Mode booking manager — a full-featured dashboard for managing rosters, championships, events, rivalries, and storylines across multiple brands. Dark, minimal UI. Runs entirely on your machine.

<!-- Screenshot placeholder: add a GIF or screenshot of the CCO Hub here -->

---

## Download KayFlux

No technical knowledge needed — just download, install, and run.

### Step 1: Download the installer

Go to the **[Releases page](https://github.com/WilliM233/kayflux/releases/latest)** and scroll down to **Assets**. Download the file for your platform:

| Platform | File to download |
|----------|-----------------|
| **Windows** | `KayFlux-Setup-x.x.x.exe` |
| **macOS** | `KayFlux-x.x.x.dmg` |
| **Linux** | `KayFlux-x.x.x.AppImage` |

### Step 2: Install

**Windows:**
1. Run the `.exe` file you downloaded
2. Windows SmartScreen may pop up — click **"More info"** then **"Run anyway"** (the app isn't code-signed yet, this is normal)
3. Follow the installer prompts — default settings are fine

**macOS:**
1. Open the `.dmg` file and drag KayFlux to your Applications folder
2. The first time you open it, right-click the app → click **"Open"** → click **"Open"** again to bypass Gatekeeper

**Linux:**
1. Make the file executable: `chmod +x KayFlux-*.AppImage`
2. Double-click the file or run it from a terminal

### Step 3: Launch

1. Open KayFlux — a small launcher window appears while the server starts up
2. Once it says **"Running"**, click **"Open KayFlux →"** to open the dashboard in your browser
3. You can close the launcher window — KayFlux keeps running in your **system tray** (look for the gold icon near your clock)
4. Right-click the tray icon to reopen the launcher, restart, or quit

KayFlux auto-updates — you'll get a notification when a new version is available.

---

## Features

- **CCO Command Hub** — Central dashboard with at-a-glance views of upcoming events, active rivalries, championship status, and brand health
- **Multi-Brand Rosters** — 280+ superstars across Raw, SmackDown, and NXT with division assignments, contender rankings, and alignment tracking
- **Championship Tracking** — 16 active titles (plus 27 legacy championships) with reign history and automatic transitions
- **Event Booking** — Weekly shows, PPVs, and special events with drag-and-drop match card ordering and star ratings
- **Rivalry System** — Track feuds through lifecycle stages (Building → Active → Climax → Resolved) with intensity levels and slot limits
- **Tag Teams & Stables** — Manage teams with member roles, parent/child relationships, and combined records
- **Division Rankings** — Ranked contender positions with champion designation across World, Midcard, Tag, and Women's divisions
- **Brand Hubs** — Per-brand dashboards showing roster, rivalries, results, and championship landscape
- **Session Log** — GM notes, booking decisions, storyline updates, and CCO mandates as a running narrative journal
- **Guides** — Markdown-powered booking protocols, GM playbooks, and reference docs
- **Season Support** — Track everything within seasons for long-term universe progression

---

## For Self-Hosters (Docker)

If you run a home server (TrueNAS, Unraid, Synology, etc.), KayFlux is available as a Docker image. No build step — just pull and run.

### First-time setup

1. **SSH into your server** (or open a terminal/shell on it)

2. **Create a folder** for KayFlux and download the compose file:
   ```bash
   mkdir -p /path/to/kayflux
   cd /path/to/kayflux
   curl -O https://raw.githubusercontent.com/WilliM233/kayflux/main/docker-compose.yml
   ```

3. **(Optional) Change the port** — the default is 3030. To use a different port:
   ```bash
   echo "KAYFLUX_PORT=8080" > .env
   ```

4. **Start KayFlux:**
   ```bash
   docker compose up -d
   ```

5. **Open your browser** and go to `http://<your-server-ip>:3030` — you should see the KayFlux dashboard.

Your database is stored in a Docker volume and **persists across updates and restarts** — your data is safe.

### Updating to a new version

When a new version is released, updating is two commands:

```bash
cd /path/to/kayflux
docker compose pull
docker compose up -d
```

Your database is untouched — only the app code updates.

### Backup

Your database lives inside a Docker volume. To back it up:

```bash
# Find where the volume is stored
docker volume inspect kayflux_kayflux-data | grep Mountpoint

# Copy the database files to a safe location
cp <mountpoint>/app.db /path/to/your/backups/app.db
```

---

## AI GM Setup

KayFlux works with [kayflux-mcp](https://github.com/WilliM233/kayflux-mcp) — an MCP server that gives Claude full read/write access to your universe. Think of it as hiring an AI General Manager: Claude can book shows, manage rivalries, track championships, and run your universe alongside you.

Set it up in a [Claude Project](https://claude.ai) with the MCP server connected, and Claude becomes a collaborative booking partner with access to your full roster and storyline history.

---

## Screenshots

<!-- Add screenshots here -->
<img width="304" height="208" alt="image" src="https://github.com/user-attachments/assets/f136e796-7136-4c22-bce4-c50bcf9e9518" />
<img width="1568" height="659" alt="image" src="https://github.com/user-attachments/assets/6c82efbf-26cb-431c-9a67-730f978b6300" />
<img width="277" height="171" alt="image" src="https://github.com/user-attachments/assets/807729ee-2739-45ca-a42c-5d7732a8ca13" />

---

## Development

```bash
git clone https://github.com/WilliM233/kayflux.git
cd kayflux
npm install
node server.js
```

The app runs at **http://localhost:3000**. The SQLite database is created automatically on first run with default seed data.

---

## License

[MIT](LICENSE) — William Melton
