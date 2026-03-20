# KayFlux

**Book the fiction. Run the universe.**

[![License: MIT](https://img.shields.io/badge/License-MIT-c9a84c.svg)](LICENSE)
[![GitHub Release](https://img.shields.io/github/v/release/WilliM233/kayflux?color=c9a84c)](https://github.com/WilliM233/kayflux/releases)
[![Platform](https://img.shields.io/badge/platform-Windows%20%7C%20macOS%20%7C%20Linux%20%7C%20Docker-333)](https://github.com/WilliM233/kayflux/releases)

KayFlux is a WWE 2K Universe Mode booking manager — a full-featured dashboard for managing rosters, championships, events, rivalries, and storylines across multiple brands. Dark, minimal UI. Runs entirely on your machine.

<!-- Screenshot placeholder: add a GIF or screenshot of the CCO Hub here -->

---

## Download KayFlux

Grab the latest installer for your platform — no technical setup required.

| Platform | Download |
|----------|----------|
| **Windows** | [KayFlux-Setup.exe](https://github.com/WilliM233/kayflux/releases/latest) |
| **macOS** | [KayFlux.dmg](https://github.com/WilliM233/kayflux/releases/latest) |
| **Linux** | [KayFlux.AppImage](https://github.com/WilliM233/kayflux/releases/latest) |

> **Note:** Windows may show a SmartScreen warning and macOS may show an unidentified developer warning — the app is not code-signed yet. Click "More info" → "Run anyway" (Windows) or right-click → "Open" (macOS).

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

If you run a home server (TrueNAS, Unraid, etc.), KayFlux is available as a Docker image on GitHub Container Registry.

### Quick start

```bash
# Download the compose file
curl -O https://raw.githubusercontent.com/WilliM233/kayflux/main/docker-compose.yml

# Start KayFlux
docker compose up -d
```

Open **http://your-server:3030** and you're live. The database persists in a Docker volume.

### Update

```bash
docker compose pull
docker compose up -d
```

### Configuration

Copy `.env.example` to `.env` to customize:

```bash
# Change the host port (default: 3030)
KAYFLUX_PORT=3030
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
