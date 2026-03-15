registerView('cco-hub', async (container) => {
  // Parallel data fetch
  const [brands, season, superstars, championships, rivalries, events, recentLog, mandateLog] = await Promise.all([
    api('/brands'),
    api('/seasons/current'),
    api('/superstars?status=Active'),
    api('/championships?active=1'),
    api('/rivalries'),
    api('/events'),
    api('/session-log?limit=5'),
    api('/session-log?entry_type=cco_mandate&limit=1'),
  ]);

  // --- Derived data ---
  // Brands sorted by brand_rank from API (excludes Cross-Brand id=4)
  const mainBrands = brands.filter(b => b.id !== 4);
  const brandOrder = mainBrands.map(b => b.id);

  // Roster counts per brand
  const rosterCounts = {};
  for (const s of superstars) {
    rosterCounts[s.brand_id] = (rosterCounts[s.brand_id] || 0) + 1;
  }

  // Title counts per brand (using junction table brands array)
  const titleCounts = {};
  for (const c of championships) {
    for (const b of (c.brands || [])) {
      titleCounts[b.id] = (titleCounts[b.id] || 0) + 1;
    }
  }

  // Season / week display
  const seasonName = season ? season.name : 'Season 1';
  const completedEvents = events.filter(e => e.status === 'Completed');
  const maxWeek = completedEvents.reduce((max, e) => Math.max(max, e.week_number || 0), 0);
  const weekDisplay = maxWeek > 0 ? `Week ${maxWeek}` : '';

  // On the Horizon — same sort as Events page: week → day of week → brand_rank, In Progress first
  const dayOrder = { Monday: 1, Tuesday: 2, Wednesday: 3, Thursday: 4, Friday: 5, Saturday: 6, Sunday: 7 };
  function getDaySort(e) {
    if (e.brand_day && dayOrder[e.brand_day]) return dayOrder[e.brand_day];
    if (e.event_type === 'PPV' || e.event_type === 'Special Event') return 6;
    return 99;
  }
  const horizonEvents = events
    .filter(e => e.status === 'In Progress' || e.status === 'Upcoming')
    .sort((a, b) => {
      const sPri = { 'In Progress': 0, 'Upcoming': 1 };
      if ((sPri[a.status] || 1) !== (sPri[b.status] || 1)) return (sPri[a.status] || 1) - (sPri[b.status] || 1);
      const weekDiff = (a.week_number || 99) - (b.week_number || 99);
      if (weekDiff !== 0) return weekDiff;
      const dayDiff = getDaySort(a) - getDaySort(b);
      if (dayDiff !== 0) return dayDiff;
      return (a.brand_rank || 99) - (b.brand_rank || 99);
    })
    .slice(0, 3);

  // Mandate check
  const hasMandate = mandateLog && mandateLog.length > 0;
  const latestMandate = hasMandate ? mandateLog[0] : null;

  // Championship division mapping: championship name -> superstar division
  function champToDivision(c) {
    const n = c.name.toLowerCase();
    const d = (c.division || '').toLowerCase();
    if (d.includes('tag')) return n.includes('women') ? "Women's Tag" : "Men's Tag";
    if (d.includes('women') || n.includes('women')) {
      if (n.includes('united states') || n.includes('midcard')) return "Women's Midcard";
      return "Women's World";
    }
    // Men's Singles
    if (n.includes('intercontinental') || n.includes('united states') || n.includes('north american')) return "Men's Midcard";
    return "Men's World";
  }

  // Championships grouped by brand, ordered Raw -> SmackDown -> NXT
  const brandMap = {};
  for (const b of brands) brandMap[b.id] = b;

  const champsByBrand = {};
  for (const bid of brandOrder) {
    const b = brandMap[bid];
    if (!b) continue;
    const brandChamps = championships.filter(c => (c.brands || []).some(cb => cb.id === bid));
    if (brandChamps.length === 0) continue;
    champsByBrand[bid] = brandChamps.map(c => {
      const div = champToDivision(c);
      const contenders = superstars
        .filter(s => s.brand_id === bid && s.division === div && s.division_rank > 0 && s.division_rank <= 2)
        .sort((a, b) => a.division_rank - b.division_rank);
      return { ...c, contenders };
    });
  }

  // Active rivalries (only Active/Building/Climax), limit 8
  const activeRivalries = rivalries
    .filter(r => ['Active', 'Building', 'Climax'].includes(r.status))
    .slice(0, 8);

  // Vacancy count
  const vacantCount = championships.filter(c => c.is_vacant).length;

  // --- Render ---
  container.innerHTML = `
    <div class="cco-hub">
      <!-- HEADER -->
      <div class="cco-header">
        <div class="cco-logo">&#9783;</div>
        <div>
          <h2>CCO Command Hub</h2>
          <div class="cco-subtitle">WWE Universe &middot; Cross-Brand Operations</div>
        </div>
        <span class="cco-season-pill">${esc(seasonName)}${weekDisplay ? ' &middot; ' + weekDisplay : ''}</span>
      </div>

      <!-- MANDATE ALERT -->
      ${hasMandate ? `
        <div class="cco-mandate-bar">
          <span class="cco-mandate-dot"></span>
          <div>
            <strong>Active CCO Mandate:</strong>
            ${esc(latestMandate.title)}${latestMandate.tagline ? ' &mdash; ' + esc(latestMandate.tagline) : ''}
          </div>
        </div>
      ` : ''}

      <!-- BRANDS STRIP -->
      <div class="cco-section">
        <div class="cco-section-label">Brands</div>
        <div class="cco-brands-strip">
          ${mainBrands.map(b => `
            <div class="cco-brand-card" style="border-top-color: ${b.color || '#666'}" onclick="navigate('brand-hub', {brandId:${b.id}})">
              <div class="cco-brand-name" style="color:${b.color || 'var(--text)'}">${esc(b.name)}</div>
              <div class="cco-brand-stats">
                <div>
                  <div class="cco-stat-value">${rosterCounts[b.id] || 0}</div>
                  <div class="cco-stat-label">Roster</div>
                </div>
                <div>
                  <div class="cco-stat-value">${titleCounts[b.id] || 0}</div>
                  <div class="cco-stat-label">Titles</div>
                </div>
              </div>
              <hr class="cco-brand-divider">
              ${b.gm_name ? `<div class="cco-brand-gm">GM: <strong>${esc(b.gm_name)}</strong></div>` : ''}
            </div>
          `).join('')}
        </div>
      </div>

      <!-- ON THE HORIZON -->
      ${horizonEvents.length > 0 ? `
        <div class="cco-section">
          <div class="cco-section-label">On the Horizon</div>
          <div class="cco-horizon">
            ${horizonEvents.map(e => {
              const isLive = e.status === 'In Progress';
              return `
                <div class="cco-event-card ${isLive ? 'in-progress' : ''}" onclick="navigate('match-card', {eventId:${e.id}})">
                  <div class="cco-event-meta">
                    ${isLive ? '<span class="cco-live-dot"></span>' : ''}
                    ${statusBadge(e.status)}
                    <span>${esc(e.brand_name || '')}</span>
                  </div>
                  <div class="cco-event-name">${esc(e.name)}</div>
                  ${e.city ? `<div class="cco-event-city">${esc(e.city)}</div>` : ''}
                </div>
              `;
            }).join('')}
          </div>
        </div>
      ` : ''}

      <!-- TWO-PANEL: CHAMPIONSHIPS + RIVALRIES -->
      <div class="cco-two-panel">
        <!-- Championships -->
        <div class="cco-panel">
          <div class="cco-panel-header">
            <span class="cco-panel-title">Championships</span>
            <span class="cco-panel-count">${championships.length} titles${vacantCount > 0 ? ' &middot; ' + vacantCount + ' vacant' : ''}</span>
          </div>
          ${brandOrder.filter(bid => champsByBrand[bid]).map(bid => {
            const champs = champsByBrand[bid];
            const b = brandMap[bid];
            return `
              <div class="cco-brand-group-label">
                <span class="cco-brand-dot" style="background:${b.color}"></span>
                ${esc(b.name)}
              </div>
              ${champs.map(c => `
                <div class="cco-champ-row" onclick="navigate('notes', {type:'championships', id:${c.id}})">
                  <span class="cco-champ-name">${esc(c.name)}</span>
                  <span class="cco-champ-holder ${c.is_vacant ? 'vacant' : ''}">${c.is_vacant ? 'Vacant' : esc(c.holder_name || '?')}</span>
                </div>
                ${c.contenders.length > 0 ? `
                  <div class="cco-contender-line">
                    <span class="c1">#1 ${esc(c.contenders[0].name)}</span>${c.contenders[1] ? ` &middot; #2 ${esc(c.contenders[1].name)}` : ''}
                  </div>
                ` : ''}
              `).join('')}
            `;
          }).join('')}
        </div>

        <!-- Rivalries -->
        <div class="cco-panel">
          <div class="cco-panel-header">
            <span class="cco-panel-title">Hot Rivalries</span>
            <span class="cco-panel-count">${activeRivalries.length} active</span>
          </div>
          ${activeRivalries.length > 0 ? activeRivalries.map(r => `
            <div class="cco-rivalry-row" onclick="navigate('notes', {type:'rivalries', id:${r.id}})">
              <div class="cco-rivalry-header">
                <span class="cco-rivalry-name">${esc(r.name)}</span>
                ${brandBadge(r.brand_name)}
              </div>
              ${r.notes ? `<div class="cco-rivalry-notes">${esc(r.notes)}</div>` : ''}
            </div>
          `).join('') : '<div style="color:var(--text-dim); font-size:0.85rem">No active rivalries.</div>'}
        </div>
      </div>

      <!-- RECENT ACTIVITY -->
      <div class="cco-section">
        <div class="cco-section-label" style="display:flex; align-items:center; justify-content:space-between">
          Recent Activity
          <button class="btn-add" onclick="openSessionLogCreate(4)" style="font-size:0.75rem">+ Add Entry</button>
        </div>
        ${recentLog && recentLog.length > 0
          ? `<div class="activity-feed">${recentLog.map(e => renderActivityCard(e, e.brand_color || '#666')).join('')}</div>`
          : '<div style="color:var(--text-dim); font-size:0.85rem">No activity logged yet.</div>'
        }
      </div>

      <!-- QUICK ACCESS -->
      <div class="cco-quick-access">
        <button class="cco-quick-btn" onclick="navigate('roster')">
          <span class="icon">&#9823;</span><span class="label">Roster</span>
        </button>
        <button class="cco-quick-btn" onclick="navigate('divisions')">
          <span class="icon">&#9776;</span><span class="label">Divisions</span>
        </button>
        <button class="cco-quick-btn" onclick="navigate('tag-teams')">
          <span class="icon">&#9830;&#9830;</span><span class="label">Tag Teams</span>
        </button>
        <button class="cco-quick-btn" onclick="navigate('events')">
          <span class="icon">&#9733;</span><span class="label">Events</span>
        </button>
        <button class="cco-quick-btn" onclick="navigate('championships')">
          <span class="icon">&#9813;</span><span class="label">Titles</span>
        </button>
        <button class="cco-quick-btn" onclick="navigate('rivalries')">
          <span class="icon">&#9876;</span><span class="label">Rivalries</span>
        </button>
        <button class="cco-quick-btn" onclick="navigate('guides')">
          <span class="icon">&#9782;</span><span class="label">Guides</span>
        </button>
        <button class="cco-quick-btn" onclick="navigate('settings')">
          <span class="icon">&#9881;</span><span class="label">Settings</span>
        </button>
      </div>
    </div>
  `;

  // Wire activity card expand/collapse toggles
  if (typeof wireActivityToggles === 'function') wireActivityToggles(container);
});
