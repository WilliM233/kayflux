const express = require('express');
const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const app = express();
const DB_PATH = process.env.DB_PATH || path.join(__dirname, 'app.db');

// Create DB and schema if not exists
if (!fs.existsSync(DB_PATH)) {
  const db = new Database(DB_PATH);
  db.exec(fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8'));
  db.close();
}

const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ============================================================
// MIGRATIONS (safe to re-run on every startup)
// ============================================================
try { db.exec("ALTER TABLE brands ADD COLUMN gm_name TEXT"); } catch(e) { /* column already exists */ }
db.exec(`CREATE TABLE IF NOT EXISTS guides (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  slug       TEXT UNIQUE NOT NULL,
  title      TEXT NOT NULL,
  category   TEXT NOT NULL,
  brand_id   INTEGER REFERENCES brands(id),
  content    TEXT,
  sort_order INTEGER DEFAULT 99,
  updated_at TEXT DEFAULT (datetime('now'))
)`);
db.exec(`INSERT OR IGNORE INTO guides (slug,title,category,brand_id,sort_order,content) VALUES
  ('cowork-protocol','Cowork Protocol','protocol',NULL,1,''),
  ('cco-hq-guide','CCO HQ Guide','cco',NULL,2,''),
  ('raw-gm-guide','Raw GM Guide — Nick Aldis','gm-guide',3,1,''),
  ('smackdown-gm-guide','SmackDown GM Guide — Adam Pearce','gm-guide',1,2,''),
  ('nxt-gm-guide','NXT GM Guide — Ava','gm-guide',2,3,'')`);
db.exec("UPDATE brands SET gm_name='Nick Aldis' WHERE id=3 AND gm_name IS NULL");
db.exec("UPDATE brands SET gm_name='Adam Pearce' WHERE id=1 AND gm_name IS NULL");
db.exec("UPDATE brands SET gm_name='Ava' WHERE id=2 AND gm_name IS NULL");
db.exec(`CREATE TABLE IF NOT EXISTS session_log (
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
)`);
db.exec(`CREATE TABLE IF NOT EXISTS championship_brands (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  championship_id  INTEGER NOT NULL REFERENCES championships(id),
  brand_id         INTEGER NOT NULL REFERENCES brands(id),
  UNIQUE(championship_id, brand_id)
)`);
db.exec('CREATE INDEX IF NOT EXISTS idx_cb_champ ON championship_brands(championship_id)');
db.exec('CREATE INDEX IF NOT EXISTS idx_cb_brand ON championship_brands(brand_id)');
// Seed junction table from existing brand_id column (idempotent)
db.exec(`INSERT OR IGNORE INTO championship_brands (championship_id, brand_id)
  SELECT id, brand_id FROM championships WHERE brand_id IS NOT NULL`);
// Brand rank — controls sort priority (lower = higher priority)
try { db.exec("ALTER TABLE brands ADD COLUMN brand_rank INTEGER DEFAULT 99"); } catch(e) { /* column already exists */ }
db.exec("UPDATE brands SET brand_rank=1 WHERE id=3 AND brand_rank=99"); // Raw
db.exec("UPDATE brands SET brand_rank=2 WHERE id=1 AND brand_rank=99"); // SmackDown
db.exec("UPDATE brands SET brand_rank=3 WHERE id=2 AND brand_rank=99"); // NXT
db.exec("UPDATE brands SET brand_rank=4 WHERE id=4 AND brand_rank=99"); // Cross-Brand
// Rivalry schema additions — intensity, type, slot
try { db.exec("ALTER TABLE rivalries ADD COLUMN intensity TEXT DEFAULT 'Low'"); } catch(e) {}
try { db.exec("ALTER TABLE rivalries ADD COLUMN rivalry_type TEXT DEFAULT '1v1'"); } catch(e) {}
try { db.exec("ALTER TABLE rivalries ADD COLUMN slot_number INTEGER"); } catch(e) {}
db.exec(`CREATE VIEW IF NOT EXISTS active_rivalry_participants AS
SELECT
  r.id AS rivalry_id, r.name AS rivalry_name, r.brand_id,
  r.intensity, r.slot_number,
  rp.superstar_id, s.name AS superstar_name, rp.role
FROM rivalries r
JOIN rivalry_participants rp ON rp.rivalry_id = r.id
JOIN superstars s ON s.id = rp.superstar_id
WHERE r.status IN ('Active', 'Building', 'Climax')`);
// KayFlux theme — migrate brand colors to hex
db.exec("UPDATE brands SET color='#c8102e' WHERE id=3 AND color='Red'");
db.exec("UPDATE brands SET color='#0066cc' WHERE id=1 AND color='Blue'");
db.exec("UPDATE brands SET color='#e8c000' WHERE id=2 AND color='Yellow'");
db.exec("UPDATE brands SET color='#7b2d8b' WHERE id=4 AND color='Purple'");

// ============================================================
// BRANDS
// ============================================================
app.get('/api/brands', (req, res) => {
  const rows = db.prepare('SELECT * FROM brands ORDER BY brand_rank, id').all();
  res.json(rows);
});

app.get('/api/brands/:id', (req, res) => {
  const brand = db.prepare('SELECT * FROM brands WHERE id = ?').get(req.params.id);
  if (!brand) return res.status(404).json({ error: 'Brand not found' });
  res.json(brand);
});

app.get('/api/brands/:id/roster', (req, res) => {
  const rows = db.prepare(`
    SELECT s.*, sr.wins, sr.losses, sr.draws, sr.total_matches
    FROM superstars s
    LEFT JOIN superstar_record sr ON sr.id = s.id
    WHERE s.brand_id = ?
    ORDER BY s.division, s.division_rank
  `).all(req.params.id);
  res.json(rows);
});

app.get('/api/brands/:id/divisions', (req, res) => {
  const rows = db.prepare(`
    SELECT s.*, sr.wins, sr.losses, sr.draws, sr.total_matches
    FROM superstars s
    LEFT JOIN superstar_record sr ON sr.id = s.id
    WHERE s.brand_id = ? AND s.division IS NOT NULL
    ORDER BY s.division, s.division_rank
  `).all(req.params.id);

  // Group by division
  const divisions = {};
  for (const row of rows) {
    if (!divisions[row.division]) divisions[row.division] = [];
    divisions[row.division].push(row);
  }
  res.json(divisions);
});

app.post('/api/brands', (req, res) => {
  const { name, color, day_of_week, flagship_show, brand_type, gm_name, active, brand_rank, notes } = req.body;
  if (!name || !color) return res.status(400).json({ error: 'Name and color are required' });
  try {
    const result = db.prepare(`
      INSERT INTO brands (name, color, day_of_week, flagship_show, brand_type, gm_name, active, brand_rank, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(name, color, day_of_week, flagship_show, brand_type, gm_name, active !== undefined ? active : 1, brand_rank || 99, notes);
    res.json({ id: result.lastInsertRowid });
  } catch(e) {
    res.status(400).json({ error: e.message });
  }
});

app.put('/api/brands/:id', (req, res) => {
  const fields = req.body;
  const sets = [];
  const params = [];
  for (const [key, val] of Object.entries(fields)) {
    if (key === 'id') continue;
    sets.push(`${key} = ?`);
    params.push(val);
  }
  if (sets.length === 0) return res.json({ changes: 0 });
  params.push(req.params.id);
  const result = db.prepare(`UPDATE brands SET ${sets.join(', ')} WHERE id = ?`).run(...params);
  res.json({ changes: result.changes });
});

// ============================================================
// SEASONS
// ============================================================
app.get('/api/seasons', (req, res) => {
  res.json(db.prepare('SELECT * FROM seasons ORDER BY id').all());
});

app.get('/api/seasons/current', (req, res) => {
  const season = db.prepare('SELECT * FROM seasons WHERE is_current = 1').get();
  res.json(season || null);
});

app.get('/api/seasons/:id', (req, res) => {
  const season = db.prepare('SELECT * FROM seasons WHERE id = ?').get(req.params.id);
  if (!season) return res.status(404).json({ error: 'Season not found' });
  res.json(season);
});

app.post('/api/seasons', (req, res) => {
  const { name, start_date, end_date, is_current } = req.body;
  if (!name) return res.status(400).json({ error: 'Name is required' });
  const tx = db.transaction(() => {
    if (is_current) {
      db.prepare('UPDATE seasons SET is_current = 0 WHERE is_current = 1').run();
    }
    const result = db.prepare(`
      INSERT INTO seasons (name, start_date, end_date, is_current) VALUES (?, ?, ?, ?)
    `).run(name, start_date || null, end_date || null, is_current ? 1 : 0);
    return result.lastInsertRowid;
  });
  res.json({ id: tx() });
});

app.put('/api/seasons/:id', (req, res) => {
  const fields = req.body;
  const tx = db.transaction(() => {
    if (fields.is_current) {
      db.prepare('UPDATE seasons SET is_current = 0 WHERE is_current = 1').run();
    }
    const sets = [];
    const params = [];
    for (const [key, val] of Object.entries(fields)) {
      if (key === 'id') continue;
      sets.push(`${key} = ?`);
      params.push(val);
    }
    if (sets.length === 0) return 0;
    params.push(req.params.id);
    return db.prepare(`UPDATE seasons SET ${sets.join(', ')} WHERE id = ?`).run(...params).changes;
  });
  res.json({ changes: tx() });
});

// ============================================================
// SUPERSTARS
// ============================================================
app.get('/api/superstars', (req, res) => {
  const { brand, division, alignment, status, search, limit } = req.query;
  let sql = `
    SELECT s.*, b.name AS brand_name, b.color AS brand_color,
           sr.wins, sr.losses, sr.draws, sr.total_matches
    FROM superstars s
    LEFT JOIN brands b ON b.id = s.brand_id
    LEFT JOIN superstar_record sr ON sr.id = s.id
    WHERE 1=1
  `;
  const params = [];
  if (brand) { sql += ' AND b.name = ?'; params.push(brand); }
  if (division) { sql += ' AND s.division = ?'; params.push(division); }
  if (alignment) { sql += ' AND s.alignment = ?'; params.push(alignment); }
  if (status) { sql += ' AND s.status = ?'; params.push(status); }
  if (search) { sql += ' AND s.name LIKE ?'; params.push(`%${search}%`); }
  sql += ' ORDER BY s.division, s.division_rank, s.name';
  if (limit) { sql += ' LIMIT ?'; params.push(parseInt(limit)); }
  res.json(db.prepare(sql).all(...params));
});

app.get('/api/superstars/:id', (req, res) => {
  const s = db.prepare(`
    SELECT s.*, b.name AS brand_name, b.color AS brand_color,
           sr.wins, sr.losses, sr.draws, sr.total_matches
    FROM superstars s
    LEFT JOIN brands b ON b.id = s.brand_id
    LEFT JOIN superstar_record sr ON sr.id = s.id
    WHERE s.id = ?
  `).get(req.params.id);
  if (!s) return res.status(404).json({ error: 'Superstar not found' });

  // Include tag teams
  s.tag_teams = db.prepare(`
    SELECT tt.id, tt.name, tt.team_type, tt.status, ttm.role
    FROM tag_team_members ttm
    JOIN tag_teams tt ON tt.id = ttm.tag_team_id
    WHERE ttm.superstar_id = ?
  `).all(req.params.id);

  // Include match history
  s.matches = db.prepare(`
    SELECT m.*, e.name AS event_name, mp.result, mp.team_number
    FROM match_participants mp
    JOIN matches m ON m.id = mp.match_id
    JOIN events e ON e.id = m.event_id
    WHERE mp.superstar_id = ?
    ORDER BY e.id DESC
  `).all(req.params.id);

  res.json(s);
});

app.post('/api/superstars', (req, res) => {
  const { name, alignment, brand_id, overall_rating, status, division,
    division_rank, finisher, signature, hometown, weight_class,
    character_background, custom_character, notes } = req.body;
  const result = db.prepare(`
    INSERT INTO superstars (name, alignment, brand_id, overall_rating, status, division,
      division_rank, finisher, signature, hometown, weight_class, character_background,
      custom_character, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(name, alignment, brand_id, overall_rating, status || 'Active', division,
    division_rank || 99, finisher, signature, hometown, weight_class,
    character_background, custom_character || 0, notes);
  res.json({ id: result.lastInsertRowid });
});

app.put('/api/superstars/:id', (req, res) => {
  const fields = req.body;
  const sets = [];
  const params = [];
  for (const [key, val] of Object.entries(fields)) {
    if (key === 'id') continue;
    sets.push(`${key} = ?`);
    params.push(val);
  }
  if (sets.length === 0) return res.json({ changes: 0 });
  sets.push("updated_at = datetime('now')");
  params.push(req.params.id);
  const result = db.prepare(`UPDATE superstars SET ${sets.join(', ')} WHERE id = ?`).run(...params);
  res.json({ changes: result.changes });
});

app.patch('/api/superstars/bulk-rank', (req, res) => {
  const { updates } = req.body; // [{id, division_rank}]
  const stmt = db.prepare("UPDATE superstars SET division_rank = ?, updated_at = datetime('now') WHERE id = ?");
  const tx = db.transaction((updates) => {
    for (const { id, division_rank } of updates) {
      stmt.run(division_rank, id);
    }
  });
  tx(updates);
  res.json({ updated: updates.length });
});

app.get('/api/superstars/:id/record', (req, res) => {
  const record = db.prepare('SELECT * FROM superstar_record WHERE id = ?').get(req.params.id);
  res.json(record || { wins: 0, losses: 0, draws: 0, total_matches: 0 });
});

app.delete('/api/superstars/:id', (req, res) => {
  const { hard } = req.query;
  if (hard === '1') {
    db.prepare('DELETE FROM match_participants WHERE superstar_id = ?').run(req.params.id);
    db.prepare('DELETE FROM tag_team_members WHERE superstar_id = ?').run(req.params.id);
    db.prepare('DELETE FROM rivalry_participants WHERE superstar_id = ?').run(req.params.id);
    db.prepare('DELETE FROM superstars WHERE id = ?').run(req.params.id);
  } else {
    db.prepare("UPDATE superstars SET status = 'Inactive', updated_at = datetime('now') WHERE id = ?").run(req.params.id);
  }
  res.json({ success: true });
});

// ============================================================
// DIVISIONS
// ============================================================
app.get('/api/divisions', (req, res) => {
  const rows = db.prepare(`
    SELECT s.id, s.name, s.alignment, s.division, s.division_rank,
           s.overall_rating, s.status,
           b.id AS brand_id, b.name AS brand_name, b.color AS brand_color,
           sr.wins, sr.losses, sr.draws, sr.total_matches
    FROM superstars s
    JOIN brands b ON b.id = s.brand_id
    LEFT JOIN superstar_record sr ON sr.id = s.id
    WHERE s.division IS NOT NULL AND s.division != ''
    ORDER BY b.name, s.division, s.division_rank
  `).all();

  // Group by brand then division
  const result = {};
  for (const row of rows) {
    if (!result[row.brand_name]) result[row.brand_name] = {};
    if (!result[row.brand_name][row.division]) result[row.brand_name][row.division] = [];
    result[row.brand_name][row.division].push(row);
  }
  res.json(result);
});

app.patch('/api/divisions/reorder', (req, res) => {
  const { rankings } = req.body; // [{superstar_id, division_rank}]
  const stmt = db.prepare("UPDATE superstars SET division_rank = ?, updated_at = datetime('now') WHERE id = ?");
  const tx = db.transaction((rankings) => {
    for (const { superstar_id, division_rank } of rankings) {
      stmt.run(division_rank, superstar_id);
    }
  });
  tx(rankings);
  res.json({ updated: rankings.length });
});

// ============================================================
// EVENTS
// ============================================================
app.get('/api/events', (req, res) => {
  const { season, brand, status, event_type } = req.query;
  let sql = `
    SELECT e.*, b.name AS brand_name, b.color AS brand_color,
           b.day_of_week AS brand_day, b.brand_rank,
           s.name AS season_name, st.name AS show_template_name
    FROM events e
    LEFT JOIN brands b ON b.id = e.brand_id
    LEFT JOIN seasons s ON s.id = e.season_id
    LEFT JOIN show_templates st ON st.id = e.show_template_id
    WHERE 1=1
  `;
  const params = [];
  if (season) { sql += ' AND s.name = ?'; params.push(season); }
  if (brand) { sql += ' AND b.name = ?'; params.push(brand); }
  if (status) { sql += ' AND e.status = ?'; params.push(status); }
  if (event_type) { sql += ' AND e.event_type = ?'; params.push(event_type); }
  sql += ' ORDER BY e.week_number, e.name';
  res.json(db.prepare(sql).all(...params));
});

app.get('/api/events/:id', (req, res) => {
  const event = db.prepare(`
    SELECT e.*, b.name AS brand_name, b.color AS brand_color,
           s.name AS season_name
    FROM events e
    LEFT JOIN brands b ON b.id = e.brand_id
    LEFT JOIN seasons s ON s.id = e.season_id
    WHERE e.id = ?
  `).get(req.params.id);
  if (!event) return res.status(404).json({ error: 'Event not found' });

  // Include match card
  event.matches = db.prepare(`
    SELECT m.*, c.name AS championship_name
    FROM matches m
    LEFT JOIN championships c ON c.id = m.championship_id
    WHERE m.event_id = ?
    ORDER BY m.match_order, m.id
  `).all(req.params.id);

  // Include participants for each match
  for (const match of event.matches) {
    match.participants = db.prepare(`
      SELECT mp.*, s.name AS superstar_name, s.alignment, s.overall_rating
      FROM match_participants mp
      JOIN superstars s ON s.id = mp.superstar_id
      WHERE mp.match_id = ?
      ORDER BY mp.team_number, mp.id
    `).all(match.id);
  }

  res.json(event);
});

app.post('/api/events', (req, res) => {
  const { name, brand_id, show_template_id, season_id, event_type,
    event_date, arena, city, week_number, status, notes } = req.body;
  const result = db.prepare(`
    INSERT INTO events (name, brand_id, show_template_id, season_id, event_type,
      event_date, arena, city, week_number, status, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(name, brand_id, show_template_id, season_id, event_type,
    event_date, arena, city, week_number, status || 'Upcoming', notes);
  res.json({ id: result.lastInsertRowid });
});

app.put('/api/events/:id', (req, res) => {
  const fields = req.body;
  const sets = [];
  const params = [];
  for (const [key, val] of Object.entries(fields)) {
    if (key === 'id') continue;
    sets.push(`${key} = ?`);
    params.push(val);
  }
  if (sets.length === 0) return res.json({ changes: 0 });
  params.push(req.params.id);
  const result = db.prepare(`UPDATE events SET ${sets.join(', ')} WHERE id = ?`).run(...params);
  res.json({ changes: result.changes });
});

app.delete('/api/events/:id', (req, res) => {
  const matches = db.prepare('SELECT COUNT(*) as count FROM matches WHERE event_id = ?').get(req.params.id);
  if (matches.count > 0) {
    db.prepare('DELETE FROM match_participants WHERE match_id IN (SELECT id FROM matches WHERE event_id = ?)').run(req.params.id);
    db.prepare('DELETE FROM matches WHERE event_id = ?').run(req.params.id);
  }
  db.prepare('DELETE FROM events WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

// ============================================================
// MATCHES
// ============================================================
app.get('/api/events/:eventId/matches', (req, res) => {
  const matches = db.prepare(`
    SELECT m.*, c.name AS championship_name
    FROM matches m
    LEFT JOIN championships c ON c.id = m.championship_id
    WHERE m.event_id = ?
    ORDER BY m.match_order, m.id
  `).all(req.params.eventId);

  for (const match of matches) {
    match.participants = db.prepare(`
      SELECT mp.*, s.name AS superstar_name, s.alignment, s.overall_rating
      FROM match_participants mp
      JOIN superstars s ON s.id = mp.superstar_id
      WHERE mp.match_id = ?
      ORDER BY mp.team_number, mp.id
    `).all(match.id);
  }
  res.json(matches);
});

app.post('/api/events/:eventId/matches', (req, res) => {
  const { match_type, match_position, match_order, championship_id,
    notes, participant_ids, season_id, brand_id } = req.body;
  const result = db.prepare(`
    INSERT INTO matches (event_id, match_type, match_position, match_order,
      championship_id, notes, season_id, brand_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(req.params.eventId, match_type || 'Singles', match_position,
    match_order, championship_id, notes, season_id, brand_id);
  const matchId = result.lastInsertRowid;

  // Add participants
  if (participant_ids && participant_ids.length > 0) {
    const stmt = db.prepare(`
      INSERT INTO match_participants (match_id, superstar_id, team_number)
      VALUES (?, ?, ?)
    `);
    for (const p of participant_ids) {
      stmt.run(matchId, p.superstar_id, p.team_number || null);
    }
  }

  res.json({ id: matchId });
});

app.put('/api/matches/:id', (req, res) => {
  const fields = req.body;
  const sets = [];
  const params = [];
  for (const [key, val] of Object.entries(fields)) {
    if (key === 'id' || key === 'participants') continue;
    sets.push(`${key} = ?`);
    params.push(val);
  }
  if (sets.length > 0) {
    params.push(req.params.id);
    db.prepare(`UPDATE matches SET ${sets.join(', ')} WHERE id = ?`).run(...params);
  }
  res.json({ success: true });
});

app.post('/api/matches/:id/result', (req, res) => {
  const { winner_ids, loser_ids, draw_ids, win_method, rating, notes } = req.body;
  const matchId = req.params.id;

  const tx = db.transaction(() => {
    // Update match
    db.prepare(`
      UPDATE matches SET win_method = ?, match_rating = ?, notes = ?
      WHERE id = ?
    `).run(win_method, rating, notes, matchId);

    // Update participant results
    if (winner_ids) {
      const stmt = db.prepare('UPDATE match_participants SET result = ? WHERE match_id = ? AND superstar_id = ?');
      for (const id of winner_ids) stmt.run('win', matchId, id);
    }
    if (loser_ids) {
      const stmt = db.prepare('UPDATE match_participants SET result = ? WHERE match_id = ? AND superstar_id = ?');
      for (const id of loser_ids) stmt.run('loss', matchId, id);
    }
    if (draw_ids) {
      const stmt = db.prepare('UPDATE match_participants SET result = ? WHERE match_id = ? AND superstar_id = ?');
      for (const id of draw_ids) stmt.run('draw', matchId, id);
    }
  });
  tx();
  res.json({ success: true });
});

app.delete('/api/matches/:id', (req, res) => {
  db.prepare('DELETE FROM match_participants WHERE match_id = ?').run(req.params.id);
  db.prepare('DELETE FROM matches WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

app.patch('/api/events/:eventId/matches/reorder', (req, res) => {
  const { order } = req.body; // [matchId1, matchId2, ...]
  const stmt = db.prepare('UPDATE matches SET match_order = ? WHERE id = ? AND event_id = ?');
  const tx = db.transaction(() => {
    order.forEach((matchId, idx) => {
      stmt.run(idx + 1, matchId, req.params.eventId);
    });
  });
  tx();
  res.json({ success: true });
});

app.post('/api/matches/:id/participants', (req, res) => {
  const { superstar_id, team_number } = req.body;
  db.prepare('INSERT INTO match_participants (match_id, superstar_id, team_number) VALUES (?, ?, ?)')
    .run(req.params.id, superstar_id, team_number || null);
  res.json({ success: true });
});

app.delete('/api/matches/:id/participants/:superstarId', (req, res) => {
  db.prepare('DELETE FROM match_participants WHERE match_id = ? AND superstar_id = ?')
    .run(req.params.id, req.params.superstarId);
  res.json({ success: true });
});

// ============================================================
// CHAMPIONSHIPS
// ============================================================
app.get('/api/championships', (req, res) => {
  const { active, brand, category, division } = req.query;
  let sql = `
    SELECT c.*, b.name AS brand_name, b.color AS brand_color,
           s.name AS holder_name
    FROM championships c
    LEFT JOIN brands b ON b.id = c.brand_id
    LEFT JOIN superstars s ON s.id = c.current_holder_id
    WHERE 1=1
  `;
  const params = [];
  if (active !== undefined) { sql += ' AND c.active = ?'; params.push(parseInt(active)); }
  if (brand) {
    sql += ' AND c.id IN (SELECT cb.championship_id FROM championship_brands cb JOIN brands b2 ON b2.id = cb.brand_id WHERE b2.name = ?)';
    params.push(brand);
  }
  if (category) { sql += ' AND c.category = ?'; params.push(category); }
  if (division) { sql += ' AND c.division = ?'; params.push(division); }
  sql += ' ORDER BY c.active DESC, c.category, c.name';
  const rows = db.prepare(sql).all(...params);
  const brandStmt = db.prepare(`
    SELECT b.id, b.name, b.color
    FROM championship_brands cb JOIN brands b ON b.id = cb.brand_id
    WHERE cb.championship_id = ? ORDER BY b.id
  `);
  for (const row of rows) { row.brands = brandStmt.all(row.id); }
  res.json(rows);
});

app.get('/api/championships/:id', (req, res) => {
  const champ = db.prepare(`
    SELECT c.*, b.name AS brand_name, b.color AS brand_color,
           s.name AS holder_name
    FROM championships c
    LEFT JOIN brands b ON b.id = c.brand_id
    LEFT JOIN superstars s ON s.id = c.current_holder_id
    WHERE c.id = ?
  `).get(req.params.id);
  if (!champ) return res.status(404).json({ error: 'Championship not found' });

  champ.brands = db.prepare(`
    SELECT b.id, b.name, b.color
    FROM championship_brands cb JOIN brands b ON b.id = cb.brand_id
    WHERE cb.championship_id = ? ORDER BY b.id
  `).all(req.params.id);

  champ.history = db.prepare(`
    SELECT ch.*, s.name AS superstar_name,
           e1.name AS won_at_event, e2.name AS lost_at_event
    FROM championship_history ch
    JOIN superstars s ON s.id = ch.superstar_id
    LEFT JOIN events e1 ON e1.id = ch.won_at_event_id
    LEFT JOIN events e2 ON e2.id = ch.lost_at_event_id
    WHERE ch.championship_id = ?
    ORDER BY ch.reign_order DESC
  `).all(req.params.id);

  res.json(champ);
});

app.put('/api/championships/:id', (req, res) => {
  const fields = req.body;
  const sets = [];
  const params = [];
  for (const [key, val] of Object.entries(fields)) {
    if (key === 'id' || key === 'brand_ids') continue;
    sets.push(`${key} = ?`);
    params.push(val);
  }
  if (sets.length > 0) {
    params.push(req.params.id);
    db.prepare(`UPDATE championships SET ${sets.join(', ')} WHERE id = ?`).run(...params);
  }
  // Sync junction table if brand_ids provided
  if (fields.brand_ids && Array.isArray(fields.brand_ids)) {
    db.prepare('DELETE FROM championship_brands WHERE championship_id = ?').run(req.params.id);
    const insertBrand = db.prepare('INSERT INTO championship_brands (championship_id, brand_id) VALUES (?, ?)');
    for (const bid of fields.brand_ids) {
      insertBrand.run(req.params.id, bid);
    }
    if (fields.brand_ids.length > 0) {
      db.prepare('UPDATE championships SET brand_id = ? WHERE id = ?').run(fields.brand_ids[0], req.params.id);
    }
  }
  res.json({ success: true });
});

app.post('/api/championships/:id/vacate', (req, res) => {
  const tx = db.transaction(() => {
    const champ = db.prepare('SELECT * FROM championships WHERE id = ?').get(req.params.id);
    if (champ && champ.current_holder_id) {
      // Close current reign
      db.prepare(`
        UPDATE championship_history SET lost_date = datetime('now')
        WHERE championship_id = ? AND superstar_id = ? AND lost_date IS NULL
      `).run(req.params.id, champ.current_holder_id);
    }
    db.prepare('UPDATE championships SET current_holder_id = NULL, is_vacant = 1 WHERE id = ?')
      .run(req.params.id);
  });
  tx();
  res.json({ success: true });
});

app.post('/api/championships/:id/award', (req, res) => {
  const { superstar_id, event_id } = req.body;
  const tx = db.transaction(() => {
    const champ = db.prepare('SELECT * FROM championships WHERE id = ?').get(req.params.id);
    // Close previous reign if any
    if (champ && champ.current_holder_id) {
      db.prepare(`
        UPDATE championship_history SET lost_date = datetime('now'), lost_at_event_id = ?
        WHERE championship_id = ? AND superstar_id = ? AND lost_date IS NULL
      `).run(event_id, req.params.id, champ.current_holder_id);
    }
    // Count existing reigns for this championship
    const { count } = db.prepare(
      'SELECT COUNT(*) as count FROM championship_history WHERE championship_id = ?'
    ).get(req.params.id);
    // Create new reign
    db.prepare(`
      INSERT INTO championship_history (championship_id, superstar_id, won_at_event_id, won_date, reign_order)
      VALUES (?, ?, ?, datetime('now'), ?)
    `).run(req.params.id, superstar_id, event_id, count + 1);
    // Update championship
    db.prepare('UPDATE championships SET current_holder_id = ?, is_vacant = 0 WHERE id = ?')
      .run(superstar_id, req.params.id);
    // Set superstar's division_rank to 0 (champion)
    if (champ && champ.division) {
      db.prepare("UPDATE superstars SET division_rank = 0, updated_at = datetime('now') WHERE id = ?")
        .run(superstar_id);
    }
  });
  tx();
  res.json({ success: true });
});

app.post('/api/championships', (req, res) => {
  const { name, brand_id, division, category, active, lineage_notes, notes } = req.body;
  if (!name) return res.status(400).json({ error: 'Name is required' });
  const result = db.prepare(`
    INSERT INTO championships (name, brand_id, division, category, active, is_vacant, lineage_notes, notes)
    VALUES (?, ?, ?, ?, ?, 1, ?, ?)
  `).run(name, brand_id, division, category || 'Current WWE', active !== undefined ? active : 1, lineage_notes, notes);
  const champId = result.lastInsertRowid;
  if (brand_id) {
    db.prepare('INSERT OR IGNORE INTO championship_brands (championship_id, brand_id) VALUES (?, ?)').run(champId, brand_id);
  }
  res.json({ id: champId });
});

app.delete('/api/championships/:id', (req, res) => {
  db.prepare('UPDATE championships SET active = 0 WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

app.post('/api/championship-history', (req, res) => {
  const { championship_id, superstar_id, won_at_event_id, won_date, lost_at_event_id, lost_date, defenses, reign_order, notes } = req.body;
  if (!championship_id || !superstar_id) return res.status(400).json({ error: 'championship_id and superstar_id are required' });
  const maxOrder = db.prepare('SELECT COALESCE(MAX(reign_order), 0) as max FROM championship_history WHERE championship_id = ?').get(championship_id);
  const result = db.prepare(`
    INSERT INTO championship_history (championship_id, superstar_id, won_at_event_id, won_date, lost_at_event_id, lost_date, defenses, reign_order, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(championship_id, superstar_id, won_at_event_id || null, won_date || null, lost_at_event_id || null, lost_date || null, defenses || 0, reign_order || (maxOrder.max + 1), notes || null);
  res.json({ id: result.lastInsertRowid });
});

app.put('/api/championship-history/:id', (req, res) => {
  const fields = req.body;
  const sets = [];
  const params = [];
  for (const [key, val] of Object.entries(fields)) {
    if (key === 'id') continue;
    sets.push(`${key} = ?`);
    params.push(val);
  }
  if (sets.length === 0) return res.json({ changes: 0 });
  params.push(req.params.id);
  const result = db.prepare(`UPDATE championship_history SET ${sets.join(', ')} WHERE id = ?`).run(...params);
  res.json({ changes: result.changes });
});

app.delete('/api/championship-history/:id', (req, res) => {
  db.prepare('DELETE FROM championship_history WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

// ============================================================
// TAG TEAMS
// ============================================================
app.get('/api/tag-teams', (req, res) => {
  const { team_type, status, brand } = req.query;
  let sql = `
    SELECT tt.*, b.name AS brand_name, b.color AS brand_color,
           pt.name AS parent_team_name
    FROM tag_teams tt
    LEFT JOIN brands b ON b.id = tt.brand_id
    LEFT JOIN tag_teams pt ON pt.id = tt.parent_team_id
    WHERE 1=1
  `;
  const params = [];
  if (team_type) { sql += ' AND tt.team_type = ?'; params.push(team_type); }
  if (status) { sql += ' AND tt.status = ?'; params.push(status); }
  if (brand) { sql += ' AND b.name = ?'; params.push(brand); }
  sql += ' ORDER BY tt.team_type, tt.name';
  const teams = db.prepare(sql).all(...params);

  // Include members for each team
  for (const team of teams) {
    team.members = db.prepare(`
      SELECT s.id, s.name, s.alignment, s.overall_rating, s.brand_id, ttm.role
      FROM tag_team_members ttm
      JOIN superstars s ON s.id = ttm.superstar_id
      WHERE ttm.tag_team_id = ?
      ORDER BY ttm.role, s.name
    `).all(team.id);

    // Include sub-units
    team.sub_units = db.prepare(`
      SELECT id, name, team_type, status FROM tag_teams WHERE parent_team_id = ?
    `).all(team.id);
  }
  res.json(teams);
});

app.get('/api/tag-teams/:id', (req, res) => {
  const team = db.prepare(`
    SELECT tt.*, b.name AS brand_name, pt.name AS parent_team_name
    FROM tag_teams tt
    LEFT JOIN brands b ON b.id = tt.brand_id
    LEFT JOIN tag_teams pt ON pt.id = tt.parent_team_id
    WHERE tt.id = ?
  `).get(req.params.id);
  if (!team) return res.status(404).json({ error: 'Team not found' });

  team.members = db.prepare(`
    SELECT s.id, s.name, s.alignment, s.overall_rating, ttm.role
    FROM tag_team_members ttm
    JOIN superstars s ON s.id = ttm.superstar_id
    WHERE ttm.tag_team_id = ?
  `).all(req.params.id);

  team.sub_units = db.prepare(`
    SELECT id, name, team_type, status FROM tag_teams WHERE parent_team_id = ?
  `).all(req.params.id);

  res.json(team);
});

app.post('/api/tag-teams', (req, res) => {
  const { name, brand_id, team_type, status, parent_team_id, notes, member_ids } = req.body;
  const result = db.prepare(`
    INSERT INTO tag_teams (name, brand_id, team_type, status, parent_team_id, notes)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(name, brand_id, team_type || 'Tag Team', status || 'Active', parent_team_id, notes);
  const teamId = result.lastInsertRowid;
  if (member_ids) {
    const stmt = db.prepare('INSERT INTO tag_team_members (tag_team_id, superstar_id, role) VALUES (?, ?, ?)');
    for (const m of member_ids) stmt.run(teamId, m.superstar_id, m.role || 'member');
  }
  res.json({ id: teamId });
});

app.put('/api/tag-teams/:id', (req, res) => {
  const fields = req.body;
  const sets = [];
  const params = [];
  for (const [key, val] of Object.entries(fields)) {
    if (['id', 'members', 'sub_units'].includes(key)) continue;
    sets.push(`${key} = ?`);
    params.push(val);
  }
  if (sets.length > 0) {
    params.push(req.params.id);
    db.prepare(`UPDATE tag_teams SET ${sets.join(', ')} WHERE id = ?`).run(...params);
  }
  res.json({ success: true });
});

app.post('/api/tag-teams/:id/members', (req, res) => {
  const { superstar_id, role } = req.body;
  db.prepare('INSERT OR IGNORE INTO tag_team_members (tag_team_id, superstar_id, role) VALUES (?, ?, ?)')
    .run(req.params.id, superstar_id, role || 'member');
  res.json({ success: true });
});

app.delete('/api/tag-teams/:id/members/:superstarId', (req, res) => {
  db.prepare('DELETE FROM tag_team_members WHERE tag_team_id = ? AND superstar_id = ?')
    .run(req.params.id, req.params.superstarId);
  res.json({ success: true });
});

app.delete('/api/tag-teams/:id', (req, res) => {
  db.prepare("UPDATE tag_teams SET status = 'Disbanded' WHERE id = ?").run(req.params.id);
  res.json({ success: true });
});

app.put('/api/tag-teams/:id/members/:superstarId', (req, res) => {
  const { role } = req.body;
  db.prepare('UPDATE tag_team_members SET role = ? WHERE tag_team_id = ? AND superstar_id = ?')
    .run(role, req.params.id, req.params.superstarId);
  res.json({ success: true });
});

// ============================================================
// RIVALRIES
// ============================================================
app.get('/api/rivalries', (req, res) => {
  const { status, brand, season } = req.query;
  let sql = `
    SELECT r.*, b.name AS brand_name, b.color AS brand_color, s.name AS season_name
    FROM rivalries r
    LEFT JOIN brands b ON b.id = r.brand_id
    LEFT JOIN seasons s ON s.id = r.season_id
    WHERE 1=1
  `;
  const params = [];
  if (status) { sql += ' AND r.status = ?'; params.push(status); }
  if (brand) { sql += ' AND b.name = ?'; params.push(brand); }
  if (season) { sql += ' AND s.name = ?'; params.push(season); }
  sql += ' ORDER BY r.status, r.name';
  const rivalries = db.prepare(sql).all(...params);

  for (const r of rivalries) {
    r.participants = db.prepare(`
      SELECT rp.role, s.id, s.name, s.alignment, s.overall_rating
      FROM rivalry_participants rp
      JOIN superstars s ON s.id = rp.superstar_id
      WHERE rp.rivalry_id = ?
    `).all(r.id);
  }
  res.json(rivalries);
});

app.get('/api/rivalries/active-participants', (req, res) => {
  const { brand_id } = req.query;
  let sql = 'SELECT * FROM active_rivalry_participants';
  const params = [];
  if (brand_id) { sql += ' WHERE brand_id = ?'; params.push(brand_id); }
  sql += ' ORDER BY brand_id, slot_number, rivalry_id';
  res.json(db.prepare(sql).all(...params));
});

app.get('/api/rivalries/:id', (req, res) => {
  const rivalry = db.prepare(`
    SELECT r.*, b.name AS brand_name, s.name AS season_name
    FROM rivalries r
    LEFT JOIN brands b ON b.id = r.brand_id
    LEFT JOIN seasons s ON s.id = r.season_id
    WHERE r.id = ?
  `).get(req.params.id);
  if (!rivalry) return res.status(404).json({ error: 'Rivalry not found' });

  rivalry.participants = db.prepare(`
    SELECT rp.role, s.id, s.name, s.alignment
    FROM rivalry_participants rp
    JOIN superstars s ON s.id = rp.superstar_id
    WHERE rp.rivalry_id = ?
  `).all(req.params.id);

  res.json(rivalry);
});

app.post('/api/rivalries', (req, res) => {
  const { name, brand_id, season_id, status, notes, intensity, rivalry_type, slot_number, participant_ids } = req.body;
  const result = db.prepare(`
    INSERT INTO rivalries (name, brand_id, season_id, status, notes, intensity, rivalry_type, slot_number)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(name, brand_id, season_id, status || 'Active', notes, intensity || 'Low', rivalry_type || '1v1', slot_number || null);
  const rivalryId = result.lastInsertRowid;
  if (participant_ids) {
    const stmt = db.prepare('INSERT INTO rivalry_participants (rivalry_id, superstar_id, role) VALUES (?, ?, ?)');
    for (const p of participant_ids) stmt.run(rivalryId, p.superstar_id, p.role || null);
  }
  res.json({ id: rivalryId });
});

app.put('/api/rivalries/:id', (req, res) => {
  const fields = req.body;
  const sets = [];
  const params = [];
  for (const [key, val] of Object.entries(fields)) {
    if (['id', 'participants'].includes(key)) continue;
    sets.push(`${key} = ?`);
    params.push(val);
  }
  if (sets.length > 0) {
    params.push(req.params.id);
    db.prepare(`UPDATE rivalries SET ${sets.join(', ')} WHERE id = ?`).run(...params);
  }
  res.json({ success: true });
});

app.delete('/api/rivalries/:id', (req, res) => {
  db.prepare("UPDATE rivalries SET status = 'Concluded' WHERE id = ?").run(req.params.id);
  res.json({ success: true });
});

app.post('/api/rivalries/:id/participants', (req, res) => {
  const { superstar_id, role } = req.body;
  db.prepare('INSERT INTO rivalry_participants (rivalry_id, superstar_id, role) VALUES (?, ?, ?)')
    .run(req.params.id, superstar_id, role || null);
  res.json({ success: true });
});

app.delete('/api/rivalries/:id/participants/:superstarId', (req, res) => {
  db.prepare('DELETE FROM rivalry_participants WHERE rivalry_id = ? AND superstar_id = ?')
    .run(req.params.id, req.params.superstarId);
  res.json({ success: true });
});

// ============================================================
// GUIDES
// ============================================================
app.get('/api/guides', (req, res) => {
  const rows = db.prepare(`
    SELECT g.*, b.name AS brand_name, b.color AS brand_color
    FROM guides g
    LEFT JOIN brands b ON b.id = g.brand_id
    ORDER BY g.category, g.sort_order
  `).all();
  res.json(rows);
});

app.get('/api/guides/:slug', (req, res) => {
  const guide = db.prepare(`
    SELECT g.*, b.name AS brand_name, b.color AS brand_color
    FROM guides g
    LEFT JOIN brands b ON b.id = g.brand_id
    WHERE g.slug = ?
  `).get(req.params.slug);
  if (!guide) return res.status(404).json({ error: 'Guide not found' });
  res.json(guide);
});

app.put('/api/guides/:slug', (req, res) => {
  const fields = req.body;
  const sets = [];
  const params = [];
  for (const [key, val] of Object.entries(fields)) {
    if (key === 'id' || key === 'slug') continue;
    sets.push(`${key} = ?`);
    params.push(val);
  }
  if (sets.length === 0) return res.json({ changes: 0 });
  sets.push("updated_at = datetime('now')");
  params.push(req.params.slug);
  const result = db.prepare(`UPDATE guides SET ${sets.join(', ')} WHERE slug = ?`).run(...params);
  res.json({ changes: result.changes });
});

app.post('/api/guides', (req, res) => {
  const { slug, title, category, brand_id, content, sort_order } = req.body;
  if (!slug || !title || !category) return res.status(400).json({ error: 'slug, title, and category are required' });
  try {
    const result = db.prepare(`
      INSERT INTO guides (slug, title, category, brand_id, content, sort_order)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(slug, title, category, brand_id || null, content || '', sort_order || 99);
    res.json({ id: result.lastInsertRowid });
  } catch(e) {
    res.status(400).json({ error: e.message });
  }
});

app.delete('/api/guides/:slug', (req, res) => {
  db.prepare('DELETE FROM guides WHERE slug = ?').run(req.params.slug);
  res.json({ success: true });
});

// ============================================================
// SESSION LOG
// ============================================================
app.get('/api/session-log', (req, res) => {
  const { brand_id, entry_type, limit } = req.query;
  let sql = `
    SELECT sl.*, b.name AS brand_name, b.color AS brand_color, e.name AS event_name
    FROM session_log sl
    LEFT JOIN brands b ON b.id = sl.brand_id
    LEFT JOIN events e ON e.id = sl.event_id
  `;
  const conditions = [];
  const params = [];
  if (brand_id) { conditions.push('sl.brand_id = ?'); params.push(brand_id); }
  if (entry_type) { conditions.push('sl.entry_type = ?'); params.push(entry_type); }
  if (conditions.length) sql += ' WHERE ' + conditions.join(' AND ');
  sql += ' ORDER BY sl.created_at DESC';
  if (limit) { sql += ' LIMIT ?'; params.push(parseInt(limit)); }
  res.json(db.prepare(sql).all(...params));
});

app.get('/api/session-log/:id', (req, res) => {
  const entry = db.prepare(`
    SELECT sl.*, b.name AS brand_name, b.color AS brand_color, e.name AS event_name
    FROM session_log sl
    LEFT JOIN brands b ON b.id = sl.brand_id
    LEFT JOIN events e ON e.id = sl.event_id
    WHERE sl.id = ?
  `).get(req.params.id);
  if (!entry) return res.status(404).json({ error: 'Entry not found' });
  res.json(entry);
});

app.post('/api/session-log', (req, res) => {
  const { brand_id, season_id, week_number, event_id, entry_type, title, tagline, content } = req.body;
  const result = db.prepare(`
    INSERT INTO session_log (brand_id, season_id, week_number, event_id, entry_type, title, tagline, content)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(brand_id || null, season_id || null, week_number || null, event_id || null, entry_type, title, tagline || null, content || null);
  res.json({ id: result.lastInsertRowid });
});

app.put('/api/session-log/:id', (req, res) => {
  const fields = req.body;
  const sets = [];
  const params = [];
  for (const [key, val] of Object.entries(fields)) {
    if (key === 'id') continue;
    sets.push(`${key} = ?`);
    params.push(val);
  }
  if (sets.length === 0) return res.json({ changes: 0 });
  params.push(req.params.id);
  const result = db.prepare(`UPDATE session_log SET ${sets.join(', ')} WHERE id = ?`).run(...params);
  res.json({ changes: result.changes });
});

app.delete('/api/session-log/:id', (req, res) => {
  db.prepare('DELETE FROM session_log WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

// ============================================================
// SHOW TEMPLATES
// ============================================================
app.get('/api/show-templates', (req, res) => {
  res.json(db.prepare(`
    SELECT st.*, b.name AS brand_name
    FROM show_templates st
    LEFT JOIN brands b ON b.id = st.brand_id
    ORDER BY st.show_type, st.name
  `).all());
});

app.get('/api/show-templates/:id', (req, res) => {
  const template = db.prepare(`
    SELECT st.*, b.name AS brand_name
    FROM show_templates st
    LEFT JOIN brands b ON b.id = st.brand_id
    WHERE st.id = ?
  `).get(req.params.id);
  if (!template) return res.status(404).json({ error: 'Template not found' });
  res.json(template);
});

app.post('/api/show-templates', (req, res) => {
  const { name, brand_id, show_type, day_of_week, multi_day, notes } = req.body;
  if (!name || !show_type) return res.status(400).json({ error: 'Name and show_type are required' });
  const result = db.prepare(`
    INSERT INTO show_templates (name, brand_id, show_type, day_of_week, multi_day, notes)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(name, brand_id || null, show_type, day_of_week || null, multi_day || 0, notes || null);
  res.json({ id: result.lastInsertRowid });
});

app.put('/api/show-templates/:id', (req, res) => {
  const fields = req.body;
  const sets = [];
  const params = [];
  for (const [key, val] of Object.entries(fields)) {
    if (key === 'id') continue;
    sets.push(`${key} = ?`);
    params.push(val);
  }
  if (sets.length === 0) return res.json({ changes: 0 });
  params.push(req.params.id);
  const result = db.prepare(`UPDATE show_templates SET ${sets.join(', ')} WHERE id = ?`).run(...params);
  res.json({ changes: result.changes });
});

app.delete('/api/show-templates/:id', (req, res) => {
  const events = db.prepare('SELECT COUNT(*) as count FROM events WHERE show_template_id = ?').get(req.params.id);
  if (events.count > 0) return res.status(400).json({ error: `Cannot delete: ${events.count} events reference this template` });
  db.prepare('DELETE FROM show_templates WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

// ============================================================
// SPA fallback
// ============================================================
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`WWE Universe Manager running on http://localhost:${PORT}`);
});
