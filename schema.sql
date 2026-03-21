-- WWE Universe Mode Manager — Database Schema
-- SQLite with better-sqlite3

PRAGMA foreign_keys = ON;

-- ============================================================
-- BRANDS
-- ============================================================
CREATE TABLE IF NOT EXISTS brands (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  name        TEXT NOT NULL UNIQUE,
  color       TEXT,
  day_of_week TEXT,
  flagship_show TEXT,
  brand_type  TEXT DEFAULT 'Main Roster',
  notes       TEXT,
  gm_name     TEXT,
  active      INTEGER DEFAULT 1
);

-- ============================================================
-- SEASONS
-- ============================================================
CREATE TABLE IF NOT EXISTS seasons (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  name       TEXT NOT NULL UNIQUE,
  start_date TEXT,
  end_date   TEXT,
  is_current INTEGER DEFAULT 0
);

-- ============================================================
-- SUPERSTARS
-- ============================================================
CREATE TABLE IF NOT EXISTS superstars (
  id                   INTEGER PRIMARY KEY AUTOINCREMENT,
  name                 TEXT NOT NULL UNIQUE,
  alignment            TEXT,
  brand_id             INTEGER REFERENCES brands(id),
  overall_rating       INTEGER,
  status               TEXT DEFAULT 'Active',
  division             TEXT,
  division_rank        INTEGER DEFAULT 99,
  finisher             TEXT,
  signature            TEXT,
  hometown             TEXT,
  weight_class         TEXT,
  character_background TEXT,
  custom_character     INTEGER DEFAULT 0,
  notes                TEXT,
  created_at           TEXT DEFAULT (datetime('now')),
  updated_at           TEXT DEFAULT (datetime('now'))
);

-- ============================================================
-- SHOW TEMPLATES
-- ============================================================
CREATE TABLE IF NOT EXISTS show_templates (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  name        TEXT NOT NULL UNIQUE,
  brand_id    INTEGER REFERENCES brands(id),
  day_of_week TEXT,
  multi_day   INTEGER DEFAULT 0,
  show_type   TEXT NOT NULL,
  notes       TEXT
);

-- ============================================================
-- EVENTS
-- ============================================================
CREATE TABLE IF NOT EXISTS events (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  name             TEXT NOT NULL,
  brand_id         INTEGER REFERENCES brands(id),
  show_template_id INTEGER REFERENCES show_templates(id),
  season_id        INTEGER REFERENCES seasons(id),
  event_type       TEXT,
  event_date       TEXT,
  arena            TEXT,
  city             TEXT,
  week_number      INTEGER,
  status           TEXT DEFAULT 'Upcoming',
  notes            TEXT,
  rivalry_payoffs  TEXT
);

-- ============================================================
-- CHAMPIONSHIPS
-- ============================================================
CREATE TABLE IF NOT EXISTS championships (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  name              TEXT NOT NULL UNIQUE,
  brand_id          INTEGER REFERENCES brands(id),
  active            INTEGER DEFAULT 1,
  category          TEXT,
  division          TEXT,
  current_holder_id INTEGER REFERENCES superstars(id),
  is_vacant         INTEGER DEFAULT 0,
  defenses          INTEGER DEFAULT 0,
  lineage_notes     TEXT,
  notes             TEXT
);

-- ============================================================
-- CHAMPIONSHIP HISTORY
-- ============================================================
CREATE TABLE IF NOT EXISTS championship_history (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  championship_id  INTEGER NOT NULL REFERENCES championships(id),
  superstar_id     INTEGER NOT NULL REFERENCES superstars(id),
  won_at_event_id  INTEGER REFERENCES events(id),
  lost_at_event_id INTEGER REFERENCES events(id),
  won_date         TEXT,
  lost_date        TEXT,
  defenses         INTEGER DEFAULT 0,
  reign_order      INTEGER,
  notes            TEXT
);

-- ============================================================
-- TAG TEAMS / STABLES
-- ============================================================
CREATE TABLE IF NOT EXISTS tag_teams (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  name            TEXT NOT NULL,
  brand_id        INTEGER REFERENCES brands(id),
  team_type       TEXT NOT NULL,
  status          TEXT DEFAULT 'Active',
  parent_team_id  INTEGER REFERENCES tag_teams(id),
  formed_date     TEXT,
  disbanded_date  TEXT,
  team_wins       INTEGER DEFAULT 0,
  team_losses     INTEGER DEFAULT 0,
  team_draws      INTEGER DEFAULT 0,
  notes           TEXT,
  UNIQUE(name, team_type)
);

-- ============================================================
-- TAG TEAM MEMBERS
-- ============================================================
CREATE TABLE IF NOT EXISTS tag_team_members (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  tag_team_id   INTEGER NOT NULL REFERENCES tag_teams(id),
  superstar_id  INTEGER NOT NULL REFERENCES superstars(id),
  is_active     INTEGER DEFAULT 1,
  role          TEXT DEFAULT 'member',
  UNIQUE(tag_team_id, superstar_id)
);

-- ============================================================
-- MATCHES
-- ============================================================
CREATE TABLE IF NOT EXISTS matches (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  event_id         INTEGER NOT NULL REFERENCES events(id),
  match_type       TEXT DEFAULT 'Singles',
  match_position   TEXT,
  match_order      INTEGER,
  championship_id  INTEGER REFERENCES championships(id),
  title_change     INTEGER DEFAULT 0,
  match_rating     INTEGER,
  win_method       TEXT,
  notes            TEXT,
  season_id        INTEGER REFERENCES seasons(id),
  brand_id         INTEGER REFERENCES brands(id)
);

-- ============================================================
-- MATCH PARTICIPANTS
-- ============================================================
CREATE TABLE IF NOT EXISTS match_participants (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  match_id      INTEGER NOT NULL REFERENCES matches(id),
  superstar_id  INTEGER NOT NULL REFERENCES superstars(id),
  result        TEXT,
  team_number   INTEGER,
  UNIQUE(match_id, superstar_id)
);

-- ============================================================
-- RIVALRIES
-- ============================================================
CREATE TABLE IF NOT EXISTS rivalries (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  name        TEXT NOT NULL,
  brand_id    INTEGER REFERENCES brands(id),
  season_id   INTEGER REFERENCES seasons(id),
  status        TEXT DEFAULT 'Active',
  intensity     TEXT DEFAULT 'Low',
  rivalry_type  TEXT DEFAULT '1v1',
  slot_number   INTEGER,
  start_date    TEXT,
  end_date      TEXT,
  notes         TEXT
);

-- ============================================================
-- RIVALRY PARTICIPANTS
-- ============================================================
CREATE TABLE IF NOT EXISTS rivalry_participants (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  rivalry_id   INTEGER NOT NULL REFERENCES rivalries(id),
  superstar_id INTEGER NOT NULL REFERENCES superstars(id),
  role         TEXT,
  UNIQUE(rivalry_id, superstar_id)
);

-- ============================================================
-- VIEW: Superstar Win/Loss Record
-- ============================================================
CREATE VIEW IF NOT EXISTS superstar_record AS
SELECT
  s.id,
  s.name,
  s.brand_id,
  s.division,
  COALESCE(SUM(CASE WHEN mp.result = 'win' AND COALESCE(m.win_method, '') != 'Brawl' THEN 1 ELSE 0 END), 0) AS wins,
  COALESCE(SUM(CASE WHEN mp.result = 'loss' AND COALESCE(m.win_method, '') != 'Brawl' THEN 1 ELSE 0 END), 0) AS losses,
  COALESCE(SUM(CASE WHEN mp.result = 'draw' AND COALESCE(m.win_method, '') != 'Brawl' THEN 1 ELSE 0 END), 0) AS draws,
  COUNT(mp.id) AS total_matches
FROM superstars s
LEFT JOIN match_participants mp ON mp.superstar_id = s.id
LEFT JOIN matches m ON m.id = mp.match_id
GROUP BY s.id;

-- ============================================================
-- VIEW: Active Rivalry Participants (for slot/eligibility checks)
-- ============================================================
CREATE VIEW IF NOT EXISTS active_rivalry_participants AS
SELECT
  r.id AS rivalry_id,
  r.name AS rivalry_name,
  r.brand_id,
  r.intensity,
  r.slot_number,
  rp.superstar_id,
  s.name AS superstar_name,
  rp.role
FROM rivalries r
JOIN rivalry_participants rp ON rp.rivalry_id = r.id
JOIN superstars s ON s.id = rp.superstar_id
WHERE r.status IN ('Active', 'Building', 'Climax');

-- ============================================================
-- INDEXES
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_superstars_brand ON superstars(brand_id);
CREATE INDEX IF NOT EXISTS idx_superstars_division ON superstars(division);
CREATE INDEX IF NOT EXISTS idx_superstars_status ON superstars(status);
CREATE INDEX IF NOT EXISTS idx_events_season ON events(season_id);
CREATE INDEX IF NOT EXISTS idx_events_brand ON events(brand_id);
CREATE INDEX IF NOT EXISTS idx_events_status ON events(status);
CREATE INDEX IF NOT EXISTS idx_matches_event ON matches(event_id);
CREATE INDEX IF NOT EXISTS idx_match_participants_match ON match_participants(match_id);
CREATE INDEX IF NOT EXISTS idx_match_participants_superstar ON match_participants(superstar_id);
CREATE INDEX IF NOT EXISTS idx_tag_team_members_team ON tag_team_members(tag_team_id);
CREATE INDEX IF NOT EXISTS idx_tag_team_members_superstar ON tag_team_members(superstar_id);
CREATE INDEX IF NOT EXISTS idx_championships_brand ON championships(brand_id);
CREATE INDEX IF NOT EXISTS idx_championship_history_champ ON championship_history(championship_id);
CREATE INDEX IF NOT EXISTS idx_rivalry_participants_rivalry ON rivalry_participants(rivalry_id);

-- Championship-brand many-to-many (cross-brand titles)
CREATE TABLE IF NOT EXISTS championship_brands (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  championship_id  INTEGER NOT NULL REFERENCES championships(id),
  brand_id         INTEGER NOT NULL REFERENCES brands(id),
  UNIQUE(championship_id, brand_id)
);
CREATE INDEX IF NOT EXISTS idx_cb_champ ON championship_brands(championship_id);
CREATE INDEX IF NOT EXISTS idx_cb_brand ON championship_brands(brand_id);

-- ============================================================
-- GUIDES
-- ============================================================
CREATE TABLE IF NOT EXISTS guides (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  slug       TEXT UNIQUE NOT NULL,
  title      TEXT NOT NULL,
  category   TEXT NOT NULL,
  brand_id   INTEGER REFERENCES brands(id),
  content    TEXT,
  sort_order INTEGER DEFAULT 99,
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_guides_slug ON guides(slug);
CREATE INDEX IF NOT EXISTS idx_guides_category ON guides(category);

-- ============================================================
-- SESSION LOG
-- ============================================================
CREATE TABLE IF NOT EXISTS session_log (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  brand_id    INTEGER REFERENCES brands(id),
  season_id   INTEGER REFERENCES seasons(id),
  week_number INTEGER,
  event_id    INTEGER REFERENCES events(id),
  entry_type  TEXT NOT NULL,
  title       TEXT NOT NULL,
  tagline     TEXT,
  content     TEXT,
  created_at  TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_session_log_brand ON session_log(brand_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_session_log_type ON session_log(entry_type);
