# KayFlux

**Book the fiction. Run the universe.**

KayFlux is a local-first WWE 2K Universe Mode booking manager built with Node.js, SQLite, and vanilla JavaScript. It provides a full-featured dashboard for managing rosters, championships, events, rivalries, and storylines across multiple brands — all from a single-page web app with a dark, minimal UI.

---

## Features

- **CCO Command Hub** — Central dashboard with at-a-glance views of upcoming events, active rivalries, championship status, and brand health across the entire universe
- **Multi-Brand Roster Management** — 280+ superstars across Raw, SmackDown, and NXT with division assignments, contender rankings, alignment tracking, and detailed profiles
- **Championship Tracking** — 16 active titles (plus 27 legacy championships) with reign history, automatic champion transitions, and vacancy management
- **Event Booking** — Create weekly shows, PPVs, and special events; build match cards with drag-and-drop ordering; record results with win methods and star ratings
- **Rivalry System** — Track feuds through lifecycle stages (Pending > Building > Active > Climax > Resolved) with intensity levels, slot limits per brand, and eligibility checks
- **Tag Teams & Stables** — Manage tag teams, stables, and mixed tags with member roles, parent/child relationships (stable > sub-unit tag teams), and team records
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
git clone https://github.com/WilliM233/kayflux.git
cd kayflux

# Install dependencies
npm install

# Start the server
node server.js
```

The app will be available at **http://localhost:3000**.

The SQLite database (`app.db`) is created automatically on first run with all tables, default seed data (279 superstars, 43 championships, 33 show templates, 4 brands, 5 guides), and migrations applied.

### Seeding from CSV

To import roster data from CSV files (Notion exports, etc.):

```bash
# Place CSV files in _extracted/ directory, then:
npm run seed
```

## Docker Deployment

KayFlux includes a Dockerfile for containerized deployment (e.g., TrueNAS, Unraid, or any Docker host).

```bash
# Build the image
docker build -t kayflux .

# Run the container
docker run -d \
  --name kayflux \
  -p 3000:3000 \
  -v kayflux-data:/data \
  kayflux
```

- The database is stored in a Docker volume at `/data/app.db` so it persists across container restarts
- Port 3000 is exposed by default
- On first run, the database is auto-created and seeded with the full WWE roster

To update a running container:

```bash
docker stop kayflux && docker rm kayflux
docker build -t kayflux .
docker run -d --name kayflux -p 3000:3000 -v kayflux-data:/data kayflux
```

## Project Structure

```
kayflux/
├── server.js                  # Express server, API routes, DB migrations
├── schema.sql                 # SQLite database schema
├── seed.js                    # CSV-based data seeding script
├── seed-default.js            # Default roster/championship seed (first run)
├── start-session.js           # Session management utility
├── Dockerfile                 # Docker containerization config
├── package.json
├── CLAUDE.md                  # AI assistant reference (API docs, schema)
├── README.md
└── public/
    ├── index.html             # SPA shell with KayFlux nav bar
    ├── styles.css             # KayFlux Arena Dark theme + all components
    ├── app.js                 # Router, view registry, shared utilities
    └── views/
        ├── cco-hub.js         # CCO Command Hub (home page)
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
        ├── notes.js           # Notes/profile editor
        └── settings.js        # Settings panel
```

## Theme: KayFlux Arena Dark

The UI uses a custom dark theme with a three-tier color hierarchy:

| Layer | Purpose | Colors |
|-------|---------|--------|
| **CCO Gold** | Authority elements — nav indicators, panel headers, mandate bars, vacant badges | `#c9a84c` (gold) |
| **Brand Identity** | Brand-specific elements — card accents, brand pills, roster headers | Raw `#c8102e`, SmackDown `#0066cc`, NXT `#e8c000`, Cross-Brand `#7b2d8b` |
| **System Content** | Body text, borders, surfaces, interactive states | `#f0ede8` (text), `#888` (muted), `#0d0d0d` (background) |

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
| Guides | `/api/guides` | CRUD (markdown content) |
| Session Log | `/api/session-log` | CRUD, filtered list |
| Seasons | `/api/seasons` | List, current |
| Show Templates | `/api/show-templates` | CRUD |
| Schema | `/api/schema` | Database schema introspection |
| Query | `/api/query` | Read-only SQL (SELECT only) |

For full API documentation with request/response schemas, see [CLAUDE.md](./CLAUDE.md).

## MCP Integration

KayFlux works with [kayflux-mcp](https://github.com/WilliM233/kayflux-mcp) — an MCP server that gives Claude (Desktop or Code) full read/write access to your universe via 54 tools. See that repo for setup instructions.
