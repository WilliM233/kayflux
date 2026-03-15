# KayFlux

**Book the fiction. Run the universe.**

KayFlux is a local-first WWE 2K Universe Mode booking manager built with Node.js, SQLite, and vanilla JavaScript. It provides a full-featured dashboard for managing rosters, championships, events, rivalries, and storylines across multiple brands — all from a single-page web app with a dark, minimal UI.

---

## Features

- **CCO Command Hub** — Central dashboard with at-a-glance views of upcoming events, active rivalries, championship status, and brand health across the entire universe
- **Multi-Brand Roster Management** — 280+ superstars across Raw, SmackDown, and NXT with division assignments, contender rankings, alignment tracking, and detailed profiles
- **Championship Tracking** — 16 active titles (plus 27 legacy championships) with reign history, automatic champion transitions, and vacancy management
- **Event Booking** — Create weekly shows, PPVs, and special events; build match cards with drag-and-drop ordering; record results with win methods and star ratings
- **Rivalry System** — Track feuds through lifecycle stages (Pending → Building → Active → Climax → Resolved) with intensity levels, slot limits per brand, and eligibility checks
- **Tag Teams & Stables** — Manage tag teams, stables, and mixed tags with member roles, parent/child relationships (stable → sub-unit tag teams), and team records
- **Division Rankings** — Organize superstars into divisions (World, Midcard, Tag, Women's) with ranked contender positions and champion designation
- **Brand Hubs** — Per-brand dashboards showing roster, active rivalries, recent results, and championship landscape
- **Session Log** — GM notes, booking decisions, storyline updates, locker room reports, and CCO mandates as a running narrative journal
- **Guides System** — Markdown-powered guides for booking protocols, GM playbooks, and CCO reference docs
- **Season Support** — Track everything within seasons for long-term universe progression

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Backend | Node.js + Express |
| Database | SQLite via better-sqlite3 |
| Frontend | Vanilla JS SPA (no framework) |
| Styling | Custom CSS with design token system |
| Markdown | marked.js for guide rendering |

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) v18 or later

### Installation

```bash
# Clone the repository
git clone <repo-url>
cd wweuniversethingy

# Install dependencies
npm install

# Start the server
node server.js
```

The app will be available at **http://localhost:3000**.

The SQLite database (`universe.db`) is created automatically on first run with all tables, seed data (superstars, championships, show templates, brands), and migrations applied.

## Project Structure

```
wweuniversethingy/
├── server.js                  # Express server, API routes, DB migrations
├── universe.db                # SQLite database (auto-created)
├── package.json
├── CLAUDE.md                  # AI assistant reference (API docs, schema)
├── README.md
└── public/
    ├── index.html             # SPA shell with KayFlux nav bar
    ├── styles.css             # KayFlux Arena Dark theme + all components
    ├── app.js                 # Router, view registry, shared utilities
    └── views/
        ├── roster.js          # Roster browser with filters
        ├── divisions.js       # Division rankings manager
        ├── tag-teams.js       # Tag teams, stables, mixed tags
        ├── events.js          # Event list + booking
        ├── match-card.js      # Match card builder + result entry
        ├── championships.js   # Championship browser + reign history
        ├── rivalries.js       # Rivalry tracker
        ├── guides.js          # Markdown guide viewer
        ├── brand-hub.js       # Per-brand dashboard
        ├── brand-log.js       # Brand session log
        ├── cco-hub.js         # CCO Command Hub (home page)
        └── notes.js           # Notes/profile editor
```

## Theme: KayFlux Arena Dark

The UI uses a custom dark theme with a three-tier color hierarchy:

| Layer | Purpose | Colors |
|-------|---------|--------|
| **CCO Gold** | Authority elements — nav indicators, panel headers, mandate bars, vacant badges | `#c9a84c` (gold) |
| **Brand Identity** | Brand-specific elements — card accents, brand pills, roster headers | Raw `#c8102e`, SmackDown `#0066cc`, NXT `#e8c000`, Cross-Brand `#7b2d8b` |
| **System Content** | Body text, borders, surfaces, interactive states | `#f0ede8` (text), `#888` (muted), `#0d0d0d` (background) |

Design principles:
- 0.5px borders throughout (never 1px, except 2px brand card top accents)
- No drop shadows, no blur, no gradients (except PLE card treatment)
- Tinted pill-style badges with semi-transparent backgrounds
- Gold is reserved for CCO authority — never used on body text or brand elements
- NXT Yellow (`#e8c000`) ≠ CCO Gold (`#c9a84c`) — intentionally distinct

## API Overview

The app exposes a full REST API at `http://localhost:3000/api/`. All endpoints return JSON.

| Resource | Endpoints | Key Operations |
|----------|-----------|----------------|
| Brands | `/api/brands` | List, roster, divisions |
| Superstars | `/api/superstars` | CRUD, bulk rank, filtered search |
| Championships | `/api/championships` | CRUD, award title, vacate |
| Events | `/api/events` | CRUD, match card management |
| Matches | `/api/events/:id/matches` | Create, result entry, reorder |
| Tag Teams | `/api/tag-teams` | CRUD, member management |
| Rivalries | `/api/rivalries` | CRUD, active participants view |
| Divisions | `/api/divisions` | Rankings, reorder |
| Guides | `/api/guides` | Read, update (markdown) |
| Session Log | `/api/session-log` | Create, filtered list |
| Seasons | `/api/seasons` | List, current |

For full API documentation with request/response schemas, see [CLAUDE.md](./CLAUDE.md).

## Database

SQLite database with 16 tables and 2 derived views. Key relationships:

- **Superstars** belong to a **Brand** and are assigned to a **Division** with a rank
- **Championships** link to brands via a junction table (`championship_brands`) for cross-brand titles
- **Tag Teams** can have a `parent_team_id` linking sub-unit tag teams to their parent stable
- **Rivalries** have participants with roles (challenger/champion) and slot limits (4 per brand)
- **Events** contain **Matches** which have **Participants** with results (win/loss/draw)
- **Championship History** tracks reign transitions with event references

## Current Universe State

- **Season 1** — currently in progress
- **3 Brands** — Raw, SmackDown, NXT (plus Cross-Brand for shared titles)
- **162 active superstars** across all brands + 114 legends in the database
- **16 active championships** with 1 current title holder (Bronson Reed — IC Champion)
- **8 active rivalries** across all brands
- **14 events** scheduled for Season 1

## License

Private project — not distributed.
