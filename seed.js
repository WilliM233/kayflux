const Database = require('better-sqlite3');
const { parse } = require('csv-parse/sync');
const fs = require('fs');
const path = require('path');

const DB_PATH = process.env.DB_PATH || path.join(__dirname, 'app.db');
const EXTRACTED_DIR = path.join(__dirname, '_extracted');

// ============================================================
// CSV Discovery
// ============================================================
function findCsv(namePrefix, preferAll = false) {
  for (const subdir of fs.readdirSync(EXTRACTED_DIR)) {
    const fullSubdir = path.join(EXTRACTED_DIR, subdir);
    if (!fs.statSync(fullSubdir).isDirectory()) continue;
    for (const file of fs.readdirSync(fullSubdir)) {
      if (!file.endsWith('.csv')) continue;
      if (!file.startsWith(namePrefix)) continue;
      const isAll = file.includes('_all');
      if (preferAll === isAll) return path.join(fullSubdir, file);
    }
  }
  // Fallback: any match
  for (const subdir of fs.readdirSync(EXTRACTED_DIR)) {
    const fullSubdir = path.join(EXTRACTED_DIR, subdir);
    if (!fs.statSync(fullSubdir).isDirectory()) continue;
    for (const file of fs.readdirSync(fullSubdir)) {
      if (file.endsWith('.csv') && file.startsWith(namePrefix)) {
        return path.join(fullSubdir, file);
      }
    }
  }
  throw new Error(`CSV not found for prefix: ${namePrefix}`);
}

function readCsv(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  // Strip BOM
  if (content.charCodeAt(0) === 0xFEFF) content = content.slice(1);
  return parse(content, {
    columns: true,
    skip_empty_lines: true,
    relax_column_count: true,
    trim: true,
  });
}

// ============================================================
// Notion Link Parser
// ============================================================
function parseNotionLink(value) {
  if (!value || !value.trim()) return null;
  const match = value.match(/^(.+?)\s*\(https:\/\/www\.notion\.so\/.+?\)$/);
  return match ? match[1].trim() : value.trim();
}

function parseNotionLinks(value) {
  if (!value || !value.trim()) return [];
  if (!value.includes('notion.so')) {
    return value.split(',').map(s => s.trim()).filter(Boolean);
  }
  // Split respecting parentheses depth
  const parts = [];
  let current = '';
  let parenDepth = 0;
  for (let i = 0; i < value.length; i++) {
    const ch = value[i];
    if (ch === '(') parenDepth++;
    else if (ch === ')') parenDepth--;
    if (ch === ',' && parenDepth === 0) {
      parts.push(current.trim());
      current = '';
    } else {
      current += ch;
    }
  }
  if (current.trim()) parts.push(current.trim());
  return parts.map(part => {
    const match = part.match(/^(.+?)\s*\(https:\/\/www\.notion\.so\/.+?\)$/);
    return match ? match[1].trim() : part.trim();
  }).filter(Boolean);
}

// ============================================================
// Main Seed
// ============================================================
function seed() {
  const db = new Database(DB_PATH);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  // Create schema
  db.exec(fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8'));

  // Clear all data (reverse FK order)
  db.exec(`
    DELETE FROM rivalry_participants;
    DELETE FROM rivalries;
    DELETE FROM match_participants;
    DELETE FROM matches;
    DELETE FROM tag_team_members;
    DELETE FROM tag_teams;
    DELETE FROM championship_history;
    DELETE FROM championships;
    DELETE FROM events;
    DELETE FROM show_templates;
    DELETE FROM superstars;
    DELETE FROM seasons;
    DELETE FROM brands;
  `);

  const transaction = db.transaction(() => {
    // ----------------------------------------------------------
    // 1. BRANDS
    // ----------------------------------------------------------
    console.log('Seeding brands...');
    const brandsRows = readCsv(findCsv('Brands'));
    const insertBrand = db.prepare(`
      INSERT INTO brands (name, color, day_of_week, flagship_show, brand_type, notes, active)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    const brandMap = {}; // name -> id
    for (const row of brandsRows) {
      const name = row['Brand'] || row['Name'] || '';
      if (!name) continue;
      const result = insertBrand.run(
        name,
        row['Color'] || null,
        row['Day of Week'] || null,
        row['Flagship Show'] || null,
        row['Type'] || 'Main Roster',
        row['Notes'] || null,
        row['Active'] === 'Yes' ? 1 : 0
      );
      brandMap[name] = result.lastInsertRowid;
    }
    console.log(`  -> ${Object.keys(brandMap).length} brands`);

    // ----------------------------------------------------------
    // 2. SEASONS
    // ----------------------------------------------------------
    console.log('Seeding seasons...');
    const insertSeason = db.prepare(`
      INSERT INTO seasons (name, is_current) VALUES (?, ?)
    `);
    const seasonResult = insertSeason.run('Season 1', 1);
    const seasonMap = { 'Season 1': seasonResult.lastInsertRowid };
    console.log(`  -> 1 season`);

    // ----------------------------------------------------------
    // 3. SUPERSTARS
    // ----------------------------------------------------------
    console.log('Seeding superstars...');
    const superstarRows = readCsv(findCsv('Superstars', true));
    const insertSuperstar = db.prepare(`
      INSERT INTO superstars (name, alignment, brand_id, overall_rating, status, division,
        division_rank, finisher, signature, hometown, weight_class, character_background,
        custom_character, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const superstarMap = {}; // name -> id
    let superstarCount = 0;
    for (const row of superstarRows) {
      const name = (row['Superstar'] || '').trim();
      if (!name) continue;

      // Parse brand
      let brandName = parseNotionLink(row['Brand (Linked)']);
      if (!brandName) {
        // Fall back to Roster Status text
        const rs = (row['Roster Status'] || '').trim();
        if (rs && brandMap[rs]) brandName = rs;
      }
      const brandId = brandName ? (brandMap[brandName] || null) : null;

      // Parse rating
      const rating = parseInt(row['Overall Rating']) || null;

      // Parse status
      let status = (row['Status'] || 'Active').trim();
      if (!['Active', 'Legend'].includes(status)) status = 'Active';

      // Parse division rank
      const divRank = parseInt(row['Division Rank']);
      const divisionRank = isNaN(divRank) ? 99 : divRank;

      const result = insertSuperstar.run(
        name,
        row['Alignment'] || null,
        brandId,
        rating,
        status,
        row['Division'] || null,
        divisionRank,
        row['Finisher'] || null,
        row['Signature'] || null,
        row['Hometown'] || null,
        row['Weight Class'] || null,
        row['Character Background'] || null,
        row['Custom Character'] === 'Yes' ? 1 : 0,
        row['Notes'] || null
      );
      superstarMap[name] = result.lastInsertRowid;
      superstarCount++;
    }
    console.log(`  -> ${superstarCount} superstars`);

    // ----------------------------------------------------------
    // 4. SHOW TEMPLATES
    // ----------------------------------------------------------
    console.log('Seeding show templates...');
    const showRows = readCsv(findCsv('Shows'));
    const insertShow = db.prepare(`
      INSERT INTO show_templates (name, brand_id, day_of_week, multi_day, show_type, notes)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    const showMap = {}; // name -> id
    for (const row of showRows) {
      const name = (row['Show Name'] || '').trim();
      if (!name) continue;
      const brandName = parseNotionLink(row['Brand (Linked)']);
      const brandId = brandName ? (brandMap[brandName] || null) : null;
      const result = insertShow.run(
        name,
        brandId,
        row['Day of Week'] || null,
        row['Multi-Day'] === 'Yes' ? 1 : 0,
        row['Type'] || 'Weekly Show',
        row['Notes'] || null
      );
      showMap[name] = result.lastInsertRowid;
    }
    console.log(`  -> ${Object.keys(showMap).length} show templates`);

    // ----------------------------------------------------------
    // 5. EVENTS
    // ----------------------------------------------------------
    console.log('Seeding events...');
    const eventRows = readCsv(findCsv('Events'));
    const insertEvent = db.prepare(`
      INSERT INTO events (name, brand_id, show_template_id, season_id, event_type,
        event_date, arena, city, week_number, status, notes, rivalry_payoffs)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const eventMap = {}; // name -> id
    let eventCount = 0;
    for (const row of eventRows) {
      const name = (row['Event Name'] || '').trim();
      if (!name) continue;

      const brandName = parseNotionLink(row['Brand (Linked)']);
      const brandId = brandName ? (brandMap[brandName] || null) : null;

      // Auto-link to show template by name prefix
      let showTemplateId = null;
      if (name.startsWith('Raw ')) showTemplateId = showMap['Raw'] || null;
      else if (name.startsWith('SmackDown ')) showTemplateId = showMap['SmackDown'] || null;
      else if (name.startsWith('NXT ') && !name.includes('Stand & Deliver')) showTemplateId = showMap['NXT'] || null;
      else if (name === 'WrestleMania') showTemplateId = showMap['WrestleMania'] || null;
      else if (name === 'NXT Stand & Deliver') showTemplateId = showMap['NXT Stand & Deliver'] || null;
      // Check for Hard Reset / special events
      else if (name.startsWith('Hard Reset')) {
        if (name.includes('Monday Night Raw') || name.includes('Raw')) showTemplateId = showMap['Raw'] || null;
        else if (name.includes('SmackDown')) showTemplateId = showMap['SmackDown'] || null;
        else if (name.includes('NXT')) showTemplateId = showMap['NXT'] || null;
      }

      const seasonName = (row['Season'] || '').trim();
      const seasonId = seasonMap[seasonName] || null;

      const weekNum = parseInt(row['Week Number']);

      const result = insertEvent.run(
        name,
        brandId,
        showTemplateId,
        seasonId,
        row['Event Type'] || null,
        row['Event Date'] || null,
        row['Arena'] || null,
        row['City'] || null,
        isNaN(weekNum) ? null : weekNum,
        row['Status'] || 'Upcoming',
        row['Notes'] || null,
        row['Rivalry Payoffs'] || null
      );
      eventMap[name] = result.lastInsertRowid;
      eventCount++;
    }
    console.log(`  -> ${eventCount} events`);

    // ----------------------------------------------------------
    // 6. CHAMPIONSHIPS
    // ----------------------------------------------------------
    console.log('Seeding championships...');
    const champRows = readCsv(findCsv('Championships'));
    const insertChamp = db.prepare(`
      INSERT INTO championships (name, brand_id, active, category, division,
        current_holder_id, is_vacant, defenses, lineage_notes, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const insertHistory = db.prepare(`
      INSERT INTO championship_history (championship_id, superstar_id, won_date, reign_order, notes)
      VALUES (?, ?, ?, ?, ?)
    `);
    const champMap = {}; // name -> id
    for (const row of champRows) {
      const name = (row['Championship'] || '').trim();
      if (!name) continue;

      const brandName = parseNotionLink(row['Brand (Linked)']);
      const brandId = brandName ? (brandMap[brandName] || null) : null;

      const holderText = (row['Current Holder'] || '').trim();
      let holderId = null;
      let isVacant = 1;
      if (holderText && holderText !== 'VACANT' && holderText !== '') {
        const holderName = parseNotionLink(holderText) || holderText;
        holderId = superstarMap[holderName] || null;
        if (holderId) isVacant = 0;
      }

      const result = insertChamp.run(
        name,
        brandId,
        row['Active'] === 'Yes' ? 1 : 0,
        row['Category'] || null,
        row['Division'] || null,
        holderId,
        isVacant,
        parseInt(row['Defenses']) || 0,
        row['Lineage Notes'] || null,
        row['Notes'] || null
      );
      champMap[name] = result.lastInsertRowid;

      // Insert championship_history for current holders
      if (holderId) {
        insertHistory.run(
          result.lastInsertRowid,
          holderId,
          '2026-03-09', // Hard Reset date
          1,
          'Inaugural holder at Hard Reset'
        );
      }
    }
    console.log(`  -> ${Object.keys(champMap).length} championships`);

    // ----------------------------------------------------------
    // 7. TAG TEAMS (two passes)
    // ----------------------------------------------------------
    console.log('Seeding tag teams...');
    const teamRows = readCsv(findCsv('Teams & Stables', false));
    const insertTeam = db.prepare(`
      INSERT OR IGNORE INTO tag_teams (name, brand_id, team_type, status, notes)
      VALUES (?, ?, ?, ?, ?)
    `);
    const teamMap = {}; // "name|type" -> id
    const teamNotes = {}; // "name|type" -> notes
    const teamMembersRaw = {}; // "name|type" -> members string

    // Pass 1: insert all teams
    for (const row of teamRows) {
      const name = (row['Team Name'] || '').trim();
      if (!name) continue;

      const brandName = parseNotionLink(row['Brand (Linked)']);
      const brandId = brandName ? (brandMap[brandName] || null) : null;
      const teamType = row['Team Type'] || 'Tag Team';
      const status = row['Status'] || 'Active';
      const notes = row['Notes'] || null;

      const result = insertTeam.run(name, brandId, teamType, status, notes);
      const key = `${name}|${teamType}`;
      if (result.changes > 0) {
        teamMap[key] = result.lastInsertRowid;
      } else {
        // Already exists, fetch ID
        const existing = db.prepare('SELECT id FROM tag_teams WHERE name = ? AND team_type = ?').get(name, teamType);
        if (existing) teamMap[key] = existing.id;
      }
      teamNotes[key] = notes;
      teamMembersRaw[key] = row['Members'] || '';
    }
    console.log(`  -> ${Object.keys(teamMap).length} tag teams/stables`);

    // Pass 2: link parent_team_id by scanning notes
    const updateParent = db.prepare('UPDATE tag_teams SET parent_team_id = ? WHERE id = ?');
    const subUnitPatterns = [
      /[Tt]ag unit of (.+?)\.?\s*$/,
      /[Ss]ub-?unit of (.+?)\.?\s*$/,
      /unit of (.+?) stable/i,
    ];
    for (const [key, notes] of Object.entries(teamNotes)) {
      if (!notes) continue;
      for (const pattern of subUnitPatterns) {
        const match = notes.match(pattern);
        if (match) {
          const parentName = match[1].trim();
          // Find parent as a Stable
          const parentKey = `${parentName}|Stable`;
          let parentId = teamMap[parentKey];
          if (!parentId) {
            // Try any type
            for (const [k, id] of Object.entries(teamMap)) {
              if (k.startsWith(parentName + '|')) { parentId = id; break; }
            }
          }
          if (parentId) {
            updateParent.run(parentId, teamMap[key]);
          }
          break;
        }
      }
    }

    // ----------------------------------------------------------
    // 8. TAG TEAM MEMBERS
    // ----------------------------------------------------------
    console.log('Seeding tag team members...');
    const insertMember = db.prepare(`
      INSERT OR IGNORE INTO tag_team_members (tag_team_id, superstar_id, role)
      VALUES (?, ?, ?)
    `);
    let memberCount = 0;
    for (const [key, membersStr] of Object.entries(teamMembersRaw)) {
      const teamId = teamMap[key];
      if (!teamId || !membersStr) continue;

      const memberNames = parseNotionLinks(membersStr);
      const notes = (teamNotes[key] || '').toLowerCase();

      for (const memberName of memberNames) {
        const superstarId = superstarMap[memberName];
        if (!superstarId) {
          // Try fuzzy match for names with special chars
          const cleaned = memberName.replace(/[""]/g, '"');
          const fuzzId = superstarMap[cleaned];
          if (!fuzzId) continue;
        }
        const sid = superstarMap[memberName] || superstarMap[memberName.replace(/[""]/g, '"')];
        if (!sid) continue;

        // Detect managers from notes
        let role = 'member';
        if (notes.includes(memberName.toLowerCase() + ' manages') ||
            notes.includes(memberName.toLowerCase() + ' manage')) {
          role = 'manager';
        }

        insertMember.run(teamId, sid, role);
        memberCount++;
      }
    }
    console.log(`  -> ${memberCount} team memberships`);

    // ----------------------------------------------------------
    // 9. MATCHES
    // ----------------------------------------------------------
    console.log('Seeding matches...');
    const matchRows = readCsv(findCsv('Match History'));
    const insertMatch = db.prepare(`
      INSERT INTO matches (event_id, match_type, match_position, match_order,
        championship_id, title_change, match_rating, win_method, notes, season_id, brand_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const insertParticipant = db.prepare(`
      INSERT OR IGNORE INTO match_participants (match_id, superstar_id, result, team_number)
      VALUES (?, ?, ?, ?)
    `);

    const positionOrder = { 'Opener': 1, 'Midcard': 2, 'Co-Main': 3, 'Main Event': 4 };
    let matchCount = 0;

    for (const row of matchRows) {
      const matchName = (row['Match'] || '').trim();
      if (!matchName) continue;

      // Find event
      const eventName = parseNotionLink(row['Event']);
      const eventId = eventName ? (eventMap[eventName] || null) : null;
      if (!eventId) {
        console.warn(`  ! Match "${matchName}" - event not found: ${eventName}`);
        continue;
      }

      // Parse brand
      const brandName = parseNotionLink(row['Brand (Linked)']);
      const brandId = brandName ? (brandMap[brandName] || null) : null;

      // Parse rating: "4 Stars" -> 4
      const ratingMatch = (row['Match Rating'] || '').match(/(\d+)/);
      const rating = ratingMatch ? parseInt(ratingMatch[1]) : null;

      // Parse championship
      const champName = parseNotionLink(row['Championship']);
      const champId = champName ? (champMap[champName] || null) : null;

      // Match position -> order
      const position = (row['Match Position'] || '').trim();
      const order = positionOrder[position] || null;

      // Season
      const seasonName = (row['Season'] || '').trim();
      const seasonId = seasonMap[seasonName] || null;

      const result = insertMatch.run(
        eventId,
        row['Match Type'] || 'Singles',
        position || null,
        order,
        champId,
        row['Title Change'] === 'Yes' ? 1 : 0,
        rating,
        row['Win Method'] || null,
        row['Notes'] || null,
        seasonId,
        brandId
      );
      const matchId = result.lastInsertRowid;
      matchCount++;

      // 10. MATCH PARTICIPANTS
      // Winners
      const winnerNames = parseNotionLinks(row['Winner'] || '');
      for (const name of winnerNames) {
        const sid = superstarMap[name];
        if (sid) insertParticipant.run(matchId, sid, 'win', 1);
      }

      // Losers
      const loserNames = parseNotionLinks(row['Loser'] || '');
      for (const name of loserNames) {
        const sid = superstarMap[name];
        if (sid) insertParticipant.run(matchId, sid, 'loss', 2);
      }

      // Draw participants
      const drawNames = parseNotionLinks(row['Draw Participants'] || '');
      for (const name of drawNames) {
        const sid = superstarMap[name];
        if (sid) insertParticipant.run(matchId, sid, 'draw', null);
      }
    }
    console.log(`  -> ${matchCount} matches`);

    // ----------------------------------------------------------
    // 11. RIVALRIES (manual seed from match notes)
    // ----------------------------------------------------------
    console.log('Seeding rivalries...');
    const insertRivalry = db.prepare(`
      INSERT INTO rivalries (name, brand_id, season_id, status, notes)
      VALUES (?, ?, ?, ?, ?)
    `);
    const insertRivalryParticipant = db.prepare(`
      INSERT OR IGNORE INTO rivalry_participants (rivalry_id, superstar_id, role)
      VALUES (?, ?, ?)
    `);
    const s1 = seasonMap['Season 1'];

    const rivalries = [
      { name: 'Seth Rollins vs. Bron Breakker', brand: 'Raw', status: 'Active',
        participants: [['Seth Rollins', 'Face'], ['Bron Breakker', 'Heel']],
        notes: 'Bron wins by count-out at Hard Reset. Seth never pinned. Rematch brewing.' },
      { name: 'Becky Lynch vs. Rhea Ripley', brand: 'Raw', status: 'Active',
        participants: [['Becky Lynch', 'Face'], ['Rhea Ripley', 'Heel']],
        notes: 'Rhea wins with Riptide at Hard Reset. Becky wants revenge.' },
      { name: 'Roman Reigns vs. Sami Zayn', brand: 'SmackDown', status: 'Active',
        participants: [['Roman Reigns', 'Heel'], ['Sami Zayn', 'Face']],
        notes: 'Roman wins by count-out at Hard Reset SmackDown. Power struggle with CCO.' },
      { name: 'Trick Williams vs. Will Flux', brand: 'NXT', status: 'Active',
        participants: [['Trick Williams', 'Face'], ['Will Flux', 'Heel']],
        notes: 'Will Flux debuts as The Professor. Beats Trick at Hard Reset NXT. Trick rattled.' },
      { name: 'Tony D\'Angelo vs. Shawn Spears', brand: 'NXT', status: 'Active',
        participants: [['Tony D\'Angelo', 'Face'], ['Shawn Spears', 'Heel']],
        notes: 'Double count-out at Hard Reset NXT. Unfinished business.' },
      { name: 'Carmelo Hayes vs. Joe Hendry', brand: 'NXT', status: 'Building',
        participants: [['Carmelo Hayes', 'Heel'], ['Joe Hendry', 'Face']],
        notes: 'Great match at Hard Reset. Hendry nearly pulled it off. Rematch brewing.' },
    ];

    for (const r of rivalries) {
      const brandId = brandMap[r.brand] || null;
      const result = insertRivalry.run(r.name, brandId, s1, r.status, r.notes);
      const rivalryId = result.lastInsertRowid;
      for (const [name, role] of r.participants) {
        const sid = superstarMap[name];
        if (sid) insertRivalryParticipant.run(rivalryId, sid, role);
      }
    }
    console.log(`  -> ${rivalries.length} rivalries`);
  });

  // Execute transaction
  transaction();

  // Verify
  console.log('\n=== Verification ===');
  const counts = [
    'brands', 'seasons', 'superstars', 'show_templates', 'events',
    'championships', 'tag_teams', 'tag_team_members', 'matches',
    'match_participants', 'rivalries', 'rivalry_participants', 'championship_history'
  ];
  for (const table of counts) {
    const { count } = db.prepare(`SELECT COUNT(*) as count FROM ${table}`).get();
    console.log(`  ${table}: ${count}`);
  }

  // Check superstar_record view
  const topWinners = db.prepare(`
    SELECT name, wins, losses, draws, total_matches
    FROM superstar_record
    WHERE total_matches > 0
    ORDER BY wins DESC
    LIMIT 5
  `).all();
  console.log('\nTop records:');
  for (const r of topWinners) {
    console.log(`  ${r.name}: ${r.wins}W-${r.losses}L-${r.draws}D (${r.total_matches} matches)`);
  }

  db.close();
  console.log('\nSeed complete!');
}

seed();
