<!-- This file is for AI assistant context. Not user documentation. -->

# KayFlux — WWE Universe Mode Manager

WWE 2K26 Universe Mode booking manager. Local Node.js app with SQLite database and REST API.
**Theme:** KayFlux Arena Dark — three-tier color hierarchy: CCO Gold (#c9a84c), Brand Identity (red/blue/yellow), System Content (white/gray). 0.5px borders throughout.

## How to Interface

**Base URL:** `http://localhost:3000`
**Start the server:** `node server.js` from `D:\_DEVELOPMENT\wweuniversethingy`
**All endpoints return JSON.** Write operations accept JSON bodies (`Content-Type: application/json`).

Use the REST API for all reads and writes. The API handles business logic (championship transitions, reign tracking, rank updates) so you don't have to manage multi-step SQL transactions manually.

---

## API Reference

### Brands

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/brands` | All brands |
| GET | `/api/brands/:id` | Single brand |
| GET | `/api/brands/:id/roster` | All superstars for a brand (includes W/L/D) |
| GET | `/api/brands/:id/divisions` | Superstars grouped by division |
| POST | `/api/brands` | Create brand |
| PUT | `/api/brands/:id` | Update brand (partial) |

**Brand IDs:** SmackDown=1, NXT=2, Raw=3, Cross-Brand=4
**Brand Colors (hex):** Raw=#c8102e, SmackDown=#0066cc, NXT=#e8c000, Cross-Brand=#7b2d8b

---

### Seasons

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/seasons` | All seasons |
| GET | `/api/seasons/:id` | Single season |
| GET | `/api/seasons/current` | Current active season |
| POST | `/api/seasons` | Create season (auto-clears is_current on others if set) |
| PUT | `/api/seasons/:id` | Update season |

**Current:** Season 1 (id=1)

---

### Superstars

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/superstars` | List superstars (filterable) |
| GET | `/api/superstars/:id` | Full profile (includes tag teams + match history) |
| GET | `/api/superstars/:id/record` | W/L/D record only |
| POST | `/api/superstars` | Create superstar |
| PUT | `/api/superstars/:id` | Update superstar (partial — only send fields to change) |
| DELETE | `/api/superstars/:id` | Soft delete (status → Inactive). Use `?hard=1` for hard delete |
| PATCH | `/api/superstars/bulk-rank` | Bulk update division ranks |

**GET filters** (query params):
- `brand` — Brand name: `Raw`, `SmackDown`, `NXT`
- `division` — `Men's World`, `Women's World`, `Men's Midcard`, `Women's Midcard`, `Men's Tag`, `Women's Tag`
- `alignment` — `Face`, `Heel`, `Tweener`
- `status` — `Active`, `Legend`
- `search` — Partial name match
- `limit` — Max results

**POST/PUT body fields:**
```json
{
  "name": "string (unique)",
  "alignment": "Face|Heel|Tweener",
  "brand_id": 1,
  "overall_rating": 88,
  "status": "Active|Legend",
  "division": "Men's World",
  "division_rank": 1,
  "finisher": "Curb Stomp",
  "signature": "Superplex into Falcon Arrow",
  "hometown": "Davenport, Iowa",
  "weight_class": "Heavyweight",
  "character_background": "text",
  "custom_character": 0,
  "notes": "text"
}
```

**Bulk rank:** `PATCH /api/superstars/bulk-rank`
```json
{ "updates": [{"id": 5, "division_rank": 1}, {"id": 12, "division_rank": 2}] }
```

**Key conventions:**
- `division_rank = 0` means **champion** of that division
- `division_rank = 99` means **unranked** (default)
- Ranks 1-N are contender positions (#1 contender, #2, etc.)

---

### Divisions

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/divisions` | All ranked superstars grouped by brand then division |
| PATCH | `/api/divisions/reorder` | Bulk reorder rankings |

**Reorder body:**
```json
{ "rankings": [{"superstar_id": 5, "division_rank": 0}, {"superstar_id": 12, "division_rank": 1}] }
```

---

### Events

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/events` | List events (filterable) |
| GET | `/api/events/:id` | Single event with full match card and participants |
| POST | `/api/events` | Create event |
| PUT | `/api/events/:id` | Update event |
| DELETE | `/api/events/:id` | Hard delete with cascade (deletes matches + participants) |

**GET filters:**
- `season` — Season name
- `brand` — Brand name
- `status` — `Upcoming`, `In Progress`, `Completed`
- `event_type` — `Weekly Show`, `PPV`, `Special Event`, `Draft`

**POST/PUT body:**
```json
{
  "name": "Raw",
  "brand_id": 3,
  "show_template_id": 1,
  "season_id": 1,
  "event_type": "Weekly Show",
  "event_date": "2025-06-15",
  "arena": "Madison Square Garden",
  "city": "New York, NY",
  "week_number": 10,
  "status": "Upcoming",
  "notes": "text"
}
```

---

### Matches

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/events/:eventId/matches` | All matches for an event (with participants) |
| POST | `/api/events/:eventId/matches` | Add match to event |
| PUT | `/api/matches/:id` | Update match details |
| POST | `/api/matches/:id/result` | Record match result |
| DELETE | `/api/matches/:id` | Delete match (and its participants) |
| POST | `/api/matches/:id/participants` | Add participant to match |
| DELETE | `/api/matches/:id/participants/:superstarId` | Remove participant from match |
| PATCH | `/api/events/:eventId/matches/reorder` | Reorder match card |

**Create match:**
```json
{
  "match_type": "Singles|Tag Team",
  "match_position": "Opener|Midcard|Co-Main|Main Event",
  "match_order": 1,
  "championship_id": null,
  "notes": "Story notes",
  "season_id": 1,
  "brand_id": 3,
  "participant_ids": [
    {"superstar_id": 5, "team_number": 1},
    {"superstar_id": 12, "team_number": 2}
  ]
}
```

**Record result** — this is how you enter who won/lost:
```json
{
  "winner_ids": [5],
  "loser_ids": [12],
  "draw_ids": [],
  "win_method": "Pinfall|Submission|Count Out|DQ|KO|TKO|Forfeit|No Contest|Brawl|Interference|Other",
  "rating": 4,
  "notes": "Clean finish after Curb Stomp"
}
```

> **Brawl** is an unsanctioned segment — it records a winner/aggressor for display but does **not** count toward W/L/D records.

**Reorder:**
```json
{ "order": [3, 1, 5, 2] }
```
Array of match IDs in desired card order.

---

### Championships

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/championships` | List championships (filterable) |
| GET | `/api/championships/:id` | Single championship with reign history |
| POST | `/api/championships` | Create championship (starts vacant) |
| PUT | `/api/championships/:id` | Update championship details |
| DELETE | `/api/championships/:id` | Soft delete (active → 0) |
| POST | `/api/championships/:id/award` | Award title to a superstar |
| POST | `/api/championships/:id/vacate` | Vacate the title |
| POST | `/api/championship-history` | Create reign manually |
| PUT | `/api/championship-history/:id` | Update reign |
| DELETE | `/api/championship-history/:id` | Delete reign |

**GET filters:**
- `active` — `1` (current titles) or `0` (legacy)
- `brand` — Brand name (uses junction table — cross-brand titles appear on all assigned brands)
- `category` — `Current WWE`, `Classic WWE`, `ECW & WCW`, `AAA`
- `division` — `Men's Singles`, `Women's Singles`, `Tag Team`

**Response includes:** `brands` array on each championship (`[{id, name, color}]`) for multi-brand display.

**PUT body** — standard fields plus optional `brand_ids` array:
```json
{
  "name": "string",
  "brand_ids": [1, 3],
  "category": "Current WWE",
  "division": "Men's Singles"
}
```
`brand_ids` syncs the `championship_brands` junction table and updates the primary `brand_id` to the first entry.

**Award title** — handles everything automatically (closes old reign, creates new reign, sets division_rank=0):
```json
{
  "superstar_id": 5,
  "event_id": 42
}
```

**Vacate** — no body needed, just POST to the endpoint.

**12 active titles** (Current WWE). 31 legacy titles across other categories.

---

### Tag Teams

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/tag-teams` | List teams (filterable, includes members and sub-units) |
| GET | `/api/tag-teams/:id` | Single team with members and sub-units |
| POST | `/api/tag-teams` | Create team |
| PUT | `/api/tag-teams/:id` | Update team |
| POST | `/api/tag-teams/:id/members` | Add member |
| PUT | `/api/tag-teams/:id/members/:superstarId` | Update member role |
| DELETE | `/api/tag-teams/:id/members/:superstarId` | Remove member |
| DELETE | `/api/tag-teams/:id` | Soft delete (status → Disbanded) |

**GET filters:**
- `team_type` — `Tag Team`, `Stable`, `Mixed Tag`
- `status` — `Active`
- `brand` — Brand name

**Create team:**
```json
{
  "name": "Team Name",
  "brand_id": 3,
  "team_type": "Tag Team|Stable|Mixed Tag",
  "status": "Active",
  "parent_team_id": null,
  "notes": "text",
  "member_ids": [
    {"superstar_id": 5, "role": "member"},
    {"superstar_id": 12, "role": "member"},
    {"superstar_id": 20, "role": "manager"}
  ]
}
```

**Add member:**
```json
{ "superstar_id": 15, "role": "member|manager" }
```

**Note:** Same name can exist as both Tag Team and Stable (e.g. #DIY, Alpha Academy). Some teams have `parent_team_id` pointing to their parent stable.

---

### Rivalries

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/rivalries` | List rivalries (filterable, includes participants) |
| GET | `/api/rivalries/active-participants` | View: active rivalry participants for slot/eligibility checks |
| GET | `/api/rivalries/:id` | Single rivalry with participants |
| POST | `/api/rivalries` | Create rivalry |
| PUT | `/api/rivalries/:id` | Update rivalry |
| DELETE | `/api/rivalries/:id` | Soft delete (status → Concluded) |
| POST | `/api/rivalries/:id/participants` | Add participant |
| DELETE | `/api/rivalries/:id/participants/:superstarId` | Remove participant |

**GET filters:**
- `status` — `Building`, `Active`, `Climax`, `Resolved`
- `brand` — Brand name
- `season` — Season name

**Active participants** (`GET /api/rivalries/active-participants`):
- Optional `brand_id` query param to filter by brand
- Returns rows from `active_rivalry_participants` view: `rivalry_id`, `rivalry_name`, `brand_id`, `intensity`, `slot_number`, `superstar_id`, `superstar_name`, `role`
- Use to check slot availability (4 slots per brand) and superstar eligibility (no superstar in multiple active rivalries)

**Create rivalry:**
```json
{
  "name": "Seth Rollins vs. Bron Breakker",
  "brand_id": 3,
  "season_id": 1,
  "status": "Building|Active|Climax|Resolved",
  "intensity": "Low|Medium|High|Very High",
  "rivalry_type": "1v1|2v2",
  "slot_number": 1,
  "notes": "Story notes",
  "participant_ids": [
    {"superstar_id": 5, "role": "challenger"},
    {"superstar_id": 12, "role": "champion"}
  ]
}
```

---

### Show Templates

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/show-templates` | All show templates with brand names |
| GET | `/api/show-templates/:id` | Single template |
| POST | `/api/show-templates` | Create template |
| PUT | `/api/show-templates/:id` | Update template |
| DELETE | `/api/show-templates/:id` | Delete template (fails if events reference it) |

33 seeded templates (Raw, SmackDown, WrestleMania, Royal Rumble, etc.)

---

### Guides

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/guides` | All guides (with brand name/color) |
| GET | `/api/guides/:slug` | Single guide by slug |
| POST | `/api/guides` | Create guide |
| PUT | `/api/guides/:slug` | Update guide (partial — only send fields to change) |
| DELETE | `/api/guides/:slug` | Delete guide |

**PUT body fields:**
```json
{
  "title": "string",
  "category": "protocol|gm-guide|cco",
  "brand_id": 3,
  "content": "markdown text",
  "sort_order": 1
}
```

**5 seeded guides:** `cowork-protocol`, `cco-hq-guide`, `raw-gm-guide`, `smackdown-gm-guide`, `nxt-gm-guide`

**Categories:** `protocol`, `gm-guide`, `cco`

---

### Session Log

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/session-log` | List entries (filterable) |
| GET | `/api/session-log/:id` | Single entry by ID |
| POST | `/api/session-log` | Create entry |
| PUT | `/api/session-log/:id` | Update entry (partial) |
| DELETE | `/api/session-log/:id` | Delete entry |

**GET filters** (query params):
- `brand_id` — Brand ID (1-4)
- `entry_type` — Filter by type
- `limit` — Max results

**POST body fields:**
```json
{
  "brand_id": 3,
  "season_id": 1,
  "week_number": 2,
  "event_id": null,
  "entry_type": "gm_notes|results_summary|storyline_update|locker_room|booking_decision|callup_watch|cco_mandate",
  "title": "Entry title",
  "tagline": "Short flash summary",
  "content": "Full markdown content"
}
```

**Entry types:** `gm_notes`, `results_summary`, `storyline_update`, `locker_room`, `booking_decision`, `callup_watch`, `cco_mandate`

**Note:** `brand_id=4` (Cross-Brand) is used for `cco_mandate` entries.

---

## Booking Workflows

### Book a weekly show
1. `GET /api/events?status=Upcoming&brand=Raw` — find the next Raw event
2. `POST /api/events/:eventId/matches` — add matches to the card
3. `PUT /api/events/:id` with `{"status": "In Progress"}` — mark show as started

### Run a match and record results
1. `POST /api/matches/:id/result` — enter winner/loser, method, rating
2. `PUT /api/events/:id` with `{"status": "Completed"}` — mark event done when all matches complete

### Title change
1. `POST /api/matches/:id/result` — record the match result first
2. `POST /api/championships/:id/award` with `{"superstar_id": winnerId, "event_id": eventId}` — this automatically:
   - Closes the previous champion's reign
   - Creates a new reign in championship_history
   - Updates the championship's current_holder_id
   - Sets the new champion's division_rank to 0

### Promote a contender
`PUT /api/superstars/:id` with `{"division_rank": 1}` — makes them #1 contender

### Start a rivalry
`POST /api/rivalries` with participants and status `"Building"`

### Progress a rivalry
`PUT /api/rivalries/:id` with `{"status": "Active"}` then `"Climax"` then `"Resolved"`

---

## Schema Quick Reference

For context on the data model — these are the database tables behind the API:

| Table | Rows | Key Fields |
|-------|------|------------|
| brands | 4 | name, color, day_of_week, gm_name, brand_rank |
| seasons | 1 | name, is_current |
| superstars | 281 | name, brand_id, division, division_rank, alignment, overall_rating, status |
| show_templates | 33 | name, brand_id, show_type |
| events | 158 | name, brand_id, event_type, week_number, status |
| championships | 43 | name, brand_id, active, category, division, current_holder_id, is_vacant |
| championship_history | 3 | championship_id, superstar_id, won/lost dates and events, reign_order |
| championship_brands | — | championship_id, brand_id (many-to-many for cross-brand titles) |
| tag_teams | 48 | name, team_type, brand_id, parent_team_id |
| tag_team_members | 123 | tag_team_id, superstar_id, role (member/manager) |
| matches | 14 | event_id, match_type, match_position, championship_id, match_rating, win_method |
| match_participants | 30 | match_id, superstar_id, result (win/loss/draw), team_number |
| rivalries | 6 | name, brand_id, status, intensity (Low/Medium/High/Very High), rivalry_type (1v1/2v2), slot_number (1-4) |
| rivalry_participants | 12 | rivalry_id, superstar_id, role |
| guides | 5 | slug, title, category, brand_id, content, sort_order |
| session_log | 0 | brand_id, season_id, week_number, event_id, entry_type, title, tagline, content |

**Derived views (read-only):**
- `superstar_record` — W/L/D calculated from match_participants. Accessed via `GET /api/superstars` (included automatically) or `GET /api/superstars/:id/record`.
- `active_rivalry_participants` — Joins rivalries + rivalry_participants + superstars where status IN (Active, Building, Climax). Accessed via `GET /api/rivalries/active-participants`.
