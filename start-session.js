const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const http = require('http');

const BASE = 'http://localhost:3000';
const PROJECT = __dirname;
const CACHE_FILE = path.join(PROJECT, 'session-cache.json');

// ── Helpers ──────────────────────────────────────────────────

function fetchJSON(urlPath) {
  return new Promise((resolve, reject) => {
    http.get(`${BASE}${urlPath}`, (res) => {
      let data = '';
      res.on('data', chunk => (data += chunk));
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch { reject(new Error(`Bad JSON from ${urlPath}`)); }
      });
    }).on('error', reject);
  });
}

function waitForServer(maxAttempts = 30, interval = 500) {
  return new Promise((resolve, reject) => {
    let attempts = 0;
    const check = () => {
      attempts++;
      fetchJSON('/api/brands')
        .then(() => resolve())
        .catch(() => {
          if (attempts >= maxAttempts) reject(new Error('Server did not start after 15 seconds'));
          else setTimeout(check, interval);
        });
    };
    check();
  });
}

function serverAlreadyRunning() {
  return fetchJSON('/api/brands').then(() => true).catch(() => false);
}

// ── Fetch full state ─────────────────────────────────────────

async function fetchState() {
  // Parallel fetches for independent data
  const [superstars, championships, rivalries, upcomingEvents, completedEvents, season, divisions, tagTeams, guides, sessionLog] =
    await Promise.all([
      fetchJSON('/api/superstars?status=Active'),
      fetchJSON('/api/championships?active=1'),
      fetchJSON('/api/rivalries'),
      fetchJSON('/api/events?status=Upcoming'),
      fetchJSON('/api/events?status=Completed'),
      fetchJSON('/api/seasons/current'),
      fetchJSON('/api/divisions'),
      fetchJSON('/api/tag-teams'),
      fetchJSON('/api/guides'),
      fetchJSON('/api/session-log?limit=10'),
    ]);

  // Get last 5 completed events by highest week_number
  const recentCompleted = completedEvents
    .sort((a, b) => (b.week_number || 0) - (a.week_number || 0))
    .slice(0, 5);

  // Fetch full match cards for each recent event
  const recentEvents = await Promise.all(
    recentCompleted.map(e => fetchJSON(`/api/events/${e.id}`))
  );

  return {
    cached_at: new Date().toISOString(),
    season,
    superstars,
    championships,
    rivalries,
    upcoming_events: upcomingEvents,
    recent_completed_events: recentEvents,
    divisions,
    tag_teams: tagTeams,
    guides,
    session_log: sessionLog,
  };
}

// ── Terminal summary ─────────────────────────────────────────

function printSummary(state) {
  const line = '─'.repeat(60);
  console.log(`\n${line}`);
  console.log('  WWE UNIVERSE MODE — SESSION STATE');
  console.log(`${line}`);
  console.log(`  Season: ${state.season?.name || 'Unknown'}`);
  console.log(`  Cached: ${state.cached_at}`);
  console.log(line);

  // Roster by brand
  const byBrand = {};
  for (const s of state.superstars) {
    const b = s.brand_name || 'Unassigned';
    byBrand[b] = (byBrand[b] || 0) + 1;
  }
  console.log('\n  ACTIVE ROSTER');
  for (const [brand, count] of Object.entries(byBrand).sort()) {
    console.log(`    ${brand.padEnd(14)} ${count} superstars`);
  }
  console.log(`    ${'Total'.padEnd(14)} ${state.superstars.length}`);

  // Championships
  console.log('\n  ACTIVE CHAMPIONSHIPS');
  for (const c of state.championships) {
    const holder = c.is_vacant ? 'VACANT' : (c.holder_name || 'Unknown');
    const defenses = c.defenses ? ` (${c.defenses} def.)` : '';
    console.log(`    ${c.name}`);
    console.log(`      ${holder}${defenses} — ${c.brand_name || 'Cross-Brand'}`);
  }

  // Teams by brand
  const activeTeams = (state.tag_teams || []).filter(t => t.status === 'Active' && t.brand_name);
  if (activeTeams.length > 0) {
    console.log('\n  TEAMS & STABLES');
    const teamsByBrand = {};
    for (const t of activeTeams) {
      const b = t.brand_name || 'Cross-Brand';
      if (!teamsByBrand[b]) teamsByBrand[b] = [];
      teamsByBrand[b].push(t);
    }
    for (const [brand, teams] of Object.entries(teamsByBrand).sort()) {
      console.log(`\n    ${brand.toUpperCase()}`);
      for (const t of teams) {
        const members = (t.members || []).map(m => {
          const tag = m.role === 'manager' ? ' (mgr)' : '';
          return m.name + tag;
        }).join(', ');
        const type = t.team_type !== 'Tag Team' ? ` [${t.team_type}]` : '';
        console.log(`      ${t.name}${type}: ${members}`);
      }
    }
  }

  // Rivalries
  const activeRivalries = state.rivalries.filter(r => r.status !== 'Resolved');
  if (activeRivalries.length > 0) {
    console.log('\n  ACTIVE RIVALRIES');
    for (const r of activeRivalries) {
      const names = (r.participants || []).map(p => p.name).join(' vs. ');
      console.log(`    [${r.status.toUpperCase()}] ${r.name}`);
      if (names) console.log(`      ${names} — ${r.brand_name || ''}`);
      if (r.notes) console.log(`      ${r.notes}`);
    }
  }

  // Division rankings (top 3 per division per brand)
  console.log('\n  DIVISION RANKINGS (Top 3)');
  for (const [brand, divs] of Object.entries(state.divisions)) {
    console.log(`\n    ${brand.toUpperCase()}`);
    for (const [division, roster] of Object.entries(divs)) {
      const top = roster.slice(0, 4); // rank 0 (champ) + top 3
      const champLine = top[0]?.division_rank === 0
        ? `★ ${top[0].name}`
        : null;
      console.log(`      ${division}:`);
      if (champLine) {
        console.log(`        C  ${top[0].name} (${top[0].overall_rating || '?'})`);
        top.slice(1).forEach((s, i) => {
          console.log(`        #${i + 1} ${s.name} (${s.overall_rating || '?'})`);
        });
      } else {
        top.forEach((s, i) => {
          console.log(`        #${i + 1} ${s.name} (${s.overall_rating || '?'})`);
        });
      }
    }
  }

  // Recent completed events
  if (state.recent_completed_events.length > 0) {
    console.log('\n  LAST COMPLETED EVENTS');
    for (const e of state.recent_completed_events) {
      console.log(`\n    ${e.name} (Week ${e.week_number || '?'}) — ${e.brand_name || 'Cross-Brand'}`);
      if (e.arena) console.log(`      ${e.arena}, ${e.city || ''}`);
      if (e.matches && e.matches.length > 0) {
        for (const m of e.matches) {
          const winners = (m.participants || []).filter(p => p.result === 'win');
          const losers = (m.participants || []).filter(p => p.result === 'loss');
          const draws = (m.participants || []).filter(p => p.result === 'draw');

          let result = '';
          if (draws.length > 0) {
            result = draws.map(p => p.superstar_name).join(' & ') + ' — DRAW';
          } else if (winners.length > 0) {
            result = winners.map(p => p.superstar_name).join(' & ')
              + ' def. '
              + losers.map(p => p.superstar_name).join(' & ');
          } else {
            result = (m.participants || []).map(p => p.superstar_name).join(' vs. ') + ' (no result)';
          }

          const stars = m.match_rating ? ' ★'.repeat(m.match_rating) : '';
          const title = m.championship_name ? ` [${m.championship_name}]` : '';
          const method = m.win_method ? ` via ${m.win_method}` : '';
          const pos = m.match_position ? `[${m.match_position}]` : '';

          console.log(`      ${pos} ${result}${method}${title}${stars}`);
        }
      } else {
        console.log('      No matches recorded');
      }
    }
  }

  // Guides
  if (state.guides && state.guides.length > 0) {
    console.log('\n  GUIDES');
    for (const g of state.guides) {
      const brand = g.brand_name ? ` (${g.brand_name})` : '';
      const hasContent = g.content && g.content.length > 0 ? '✓' : '○';
      console.log(`    ${hasContent} ${g.title}${brand} [${g.category}]`);
    }
  }

  // Session Log
  if (state.session_log && state.session_log.length > 0) {
    console.log('\n  SESSION LOG (recent)');
    for (const e of state.session_log) {
      const brand = e.brand_name || 'Cross-Brand';
      const type = e.entry_type.replace(/_/g, ' ').toUpperCase();
      console.log(`    [${type}] ${e.title} — ${brand} Wk${e.week_number || '?'}`);
    }
  }

  // Upcoming events (next 5)
  const nextUp = state.upcoming_events.slice(0, 5);
  if (nextUp.length > 0) {
    console.log('\n  NEXT UPCOMING EVENTS');
    for (const e of nextUp) {
      const type = e.event_type !== 'Weekly Show' ? ` (${e.event_type})` : '';
      console.log(`    Week ${String(e.week_number || '?').padEnd(3)} ${e.name}${type} — ${e.brand_name || 'Cross-Brand'}`);
    }
    const remaining = state.upcoming_events.length - 5;
    if (remaining > 0) console.log(`    ... and ${remaining} more`);
  }

  console.log(`\n${line}`);
  console.log(`  Cache written to: session-cache.json`);
  console.log(`  Server running at: ${BASE}`);
  console.log(`${line}\n`);
}

// ── Main ─────────────────────────────────────────────────────

async function main() {
  let serverProcess = null;
  const alreadyUp = await serverAlreadyRunning();

  if (alreadyUp) {
    console.log('Server already running on port 3000.');
  } else {
    console.log('Starting server...');
    serverProcess = spawn('node', ['server.js'], {
      cwd: PROJECT,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    serverProcess.stdout.on('data', (d) => {
      const msg = d.toString().trim();
      if (msg) console.log(`  [server] ${msg}`);
    });
    serverProcess.stderr.on('data', (d) => {
      const msg = d.toString().trim();
      if (msg) console.error(`  [server] ${msg}`);
    });
    serverProcess.on('exit', (code) => {
      if (code !== null && code !== 0) {
        console.error(`Server exited with code ${code}`);
        process.exit(1);
      }
    });

    await waitForServer();
    console.log('Server ready.');
  }

  console.log('Fetching current state...');
  const state = await fetchState();

  fs.writeFileSync(CACHE_FILE, JSON.stringify(state, null, 2));
  printSummary(state);

  // Keep process alive while server runs
  if (serverProcess) {
    process.on('SIGINT', () => {
      console.log('\nShutting down server...');
      serverProcess.kill();
      process.exit(0);
    });
    process.on('SIGTERM', () => {
      serverProcess.kill();
      process.exit(0);
    });
  } else {
    // Server was already running, we're just caching — exit cleanly
    process.exit(0);
  }
}

main().catch((err) => {
  console.error('Error:', err.message);
  process.exit(1);
});
