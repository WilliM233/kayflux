registerView('brand-hub', async (container, params) => {
  const { brandId } = params;
  if (!brandId) return navigate('roster');

  // Fetch brand first (need name for filter queries)
  const brand = await api(`/brands/${brandId}`);
  const brandName = brand.name;

  // Parallel fetch all sections
  const [championships, rivalries, divisions, tagTeams, events, sessionLog] = await Promise.all([
    api(`/championships?brand=${encodeURIComponent(brandName)}&active=1`),
    api(`/rivalries?brand=${encodeURIComponent(brandName)}`),
    api(`/brands/${brandId}/divisions`),
    api(`/tag-teams?brand=${encodeURIComponent(brandName)}&status=Active`),
    api(`/events?brand=${encodeURIComponent(brandName)}&status=Completed`),
    api(`/session-log?brand_id=${brandId}&limit=3`),
  ]);

  const activeRivalries = rivalries.filter(r => ['Active', 'Climax'].includes(r.status));
  const recentEvents = events
    .sort((a, b) => (b.week_number || 0) - (a.week_number || 0))
    .slice(0, 3);

  const brandColor = brand.color || '#666';
  const statusSteps = ['Building', 'Active', 'Climax', 'Resolved'];
  const divOrder = ["Men's World", "Women's World", "Men's Midcard", "Women's Midcard", "Men's Tag", "Women's Tag"];

  container.innerHTML = `
    <span class="back-link" onclick="navigate('divisions')">&#8592; Back to Divisions</span>

    <!-- BRAND HEADER -->
    <div class="brand-hub-header" style="background: ${brandColor}22; border-left: 4px solid ${brandColor}; display:flex; align-items:center">
      <div style="flex:1">
        <h2 style="color: ${brandColor}; font-size: 1.6rem; margin: 0">${esc(brand.name)}</h2>
        <div class="brand-hub-meta">
          ${brand.gm_name ? `<span>GM: <strong>${esc(brand.gm_name)}</strong></span>` : ''}
          ${brand.day_of_week ? `<span>${esc(brand.day_of_week)}</span>` : ''}
          ${brand.brand_type ? statusBadge(brand.brand_type) : ''}
        </div>
      </div>
      <button class="btn btn-ghost btn-sm" onclick="openBrandEdit(${brandId})" style="margin-left:auto">Edit Brand</button>
    </div>

    <!-- GM NOTES -->
    ${renderGmNotes(brand)}

    <!-- ACTIVITY FEED -->
    <div class="brand-hub-section">
      <h3>Recent Activity</h3>
      ${sessionLog.length === 0
        ? '<div style="color:var(--text-dim); font-size:0.85rem">No activity logged yet.</div>'
        : `<div class="activity-feed">
            ${sessionLog.map(e => renderActivityCard(e, brandColor)).join('')}
          </div>
          <span class="back-link" onclick="navigate('brand-log', {brandId:${brandId}})" style="margin-top:12px; display:inline-block">View all activity &rarr;</span>`
      }
    </div>

    <!-- ACTIVE CHAMPIONSHIPS -->
    ${championships.length > 0 ? `
      <div class="brand-hub-section">
        <h3>Active Championships</h3>
        <div class="brand-hub-scroll-row">
          ${championships.map(c => renderChampCard(c)).join('')}
        </div>
      </div>
    ` : ''}

    <!-- ACTIVE RIVALRIES -->
    ${activeRivalries.length > 0 ? `
      <div class="brand-hub-section">
        <h3>Active Rivalries</h3>
        <div class="brand-hub-grid-2col">
          ${activeRivalries.map(r => renderHubRivalryCard(r, statusSteps)).join('')}
        </div>
      </div>
    ` : ''}

    <!-- ROSTER + TAG TEAMS (two-column layout) -->
    <div class="brand-hub-two-col">
      <!-- ROSTER SNAPSHOT -->
      ${Object.keys(divisions).length > 0 ? `
        <div class="brand-hub-section">
          <h3>Roster</h3>
          ${divOrder.map(div => {
            const superstars = divisions[div];
            if (!superstars || superstars.length === 0) return '';
            return `
              <div class="division-section">
                <div class="division-title">${esc(div)} (${superstars.length})</div>
                <ul class="ranked-list">
                  ${superstars.map(s => `
                    <li class="ranked-item clickable-row ${s.division_rank === 0 ? 'champion' : ''}" onclick="navigate('notes', {type:'superstars', id:${s.id}})">
                      <span class="rank-number ${s.division_rank === 0 ? 'champion-rank' : ''}">${s.division_rank === 0 ? 'C' : s.division_rank}</span>
                      <span class="superstar-name">${esc(s.name)}</span>
                      ${s.alignment ? alignmentBadge(s.alignment) : ''}
                      <span class="rating">${s.overall_rating || ''}</span>
                      ${s.total_matches > 0 ? `<span class="rating">${s.wins}-${s.losses}-${s.draws}</span>` : ''}
                    </li>
                  `).join('')}
                </ul>
              </div>
            `;
          }).join('')}
        </div>
      ` : ''}

      <!-- FACTIONS & TAG TEAMS -->
      ${tagTeams.length > 0 ? `
        <div class="brand-hub-section">
          <h3>Factions & Tag Teams</h3>
          ${[{type: 'Stable', label: 'Stables'}, {type: 'Tag Team', label: 'Tag Teams'}, {type: 'Mixed Tag', label: 'Mixed Tag'}].map(({type, label}) => {
            const filtered = tagTeams.filter(t => !t.parent_team_id && t.team_type === type).sort((a, b) => a.name.localeCompare(b.name));
            if (filtered.length === 0) return '';
            return `
              <div class="division-title">${label} (${filtered.length})</div>
              <div class="brand-hub-teams-list">
                ${filtered.map(t => `
                  <div class="card clickable-row" onclick="navigate('notes', {type:'tag-teams', id:${t.id}})">
                    <div class="card-header">
                      <span class="card-title">${esc(t.name)}</span>
                      ${teamTypeBadge(t.team_type)}
                    </div>
                    <div class="card-members">
                      ${(t.members || []).map(m =>
                        '<span class="member-chip ' + (m.role === 'manager' ? 'manager' : '') + '">' + esc(m.name) + (m.role === 'manager' ? ' (mgr)' : '') + '</span>'
                      ).join('')}
                    </div>
                  </div>
                `).join('')}
              </div>
            `;
          }).join('')}
        </div>
      ` : ''}
    </div>

    <!-- RECENT EVENTS -->
    ${recentEvents.length > 0 ? `
      <div class="brand-hub-section">
        <h3>Recent Events</h3>
        ${recentEvents.map(e => `
          <div class="event-row" onclick="navigate('match-card', {eventId:${e.id}, backBrandId:${brandId}, backLabel:'${esc(brand.name)}'})">
            <span class="event-name">${esc(e.name)}</span>
            ${e.arena ? `<span class="event-meta">${esc(e.arena)}</span>` : ''}
            ${e.city ? `<span class="event-meta">${esc(e.city)}</span>` : ''}
            <span class="event-meta">Wk ${e.week_number || '-'}</span>
            ${statusBadge(e.status)}
          </div>
        `).join('')}
      </div>
    ` : ''}
  `;

  // Wire up collapsible GM notes toggle
  const toggle = document.getElementById('gm-notes-toggle');
  if (toggle) {
    toggle.addEventListener('click', () => {
      const content = document.getElementById('gm-notes-content');
      content.classList.toggle('collapsed');
      toggle.textContent = content.classList.contains('collapsed') ? 'Show more' : 'Show less';
    });
  }

  // Wire up activity card expand/collapse
  wireActivityToggles(container);
});

function renderGmNotes(brand) {
  if (!brand.notes) {
    return `
      <div class="brand-hub-section">
        <h3>GM Notes</h3>
        <div class="notes-content"><div class="empty-state">No GM notes yet.</div></div>
      </div>
    `;
  }
  const html = marked.parse(brand.notes);
  const isLong = brand.notes.length > 800;
  return `
    <div class="brand-hub-section">
      <h3>GM Notes</h3>
      <div class="notes-content ${isLong ? 'collapsible collapsed' : ''}" id="gm-notes-content">
        ${html}
      </div>
      ${isLong ? '<button class="btn-ghost" id="gm-notes-toggle">Show more</button>' : ''}
    </div>
  `;
}

function renderHubRivalryCard(r, statusSteps) {
  const currentIdx = statusSteps.indexOf(r.status);
  return `
    <div class="card clickable-row" onclick="navigate('notes', {type:'rivalries', id:${r.id}})">
      <div class="card-header">
        <span class="card-title">${esc(r.name)}</span>
      </div>
      <div style="margin:8px 0">
        ${(r.participants || []).map(p =>
          '<span style="margin-right:8px">' + esc(p.name) + ' ' + (p.role ? alignmentBadge(p.role) : '') + '</span>'
        ).join(' vs. ')}
      </div>
      <div class="rivalry-status">
        ${statusSteps.map((step, idx) =>
          '<div class="status-step ' + (idx <= currentIdx ? 'filled' : '') + '" title="' + step + '"></div>'
        ).join('')}
      </div>
      <div style="display:flex; justify-content:space-between; margin-top:4px; font-size:0.65rem; color:var(--text-dim)">
        ${statusSteps.map(s => '<span>' + s + '</span>').join('')}
      </div>
      ${r.notes ? '<div style="margin-top:8px; font-size:0.8rem; color:var(--text-muted); overflow:hidden; display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical">' + esc(r.notes) + '</div>' : ''}
    </div>
  `;
}

// ── Shared Activity Card globals (used by brand-hub + brand-log) ──

const ENTRY_TYPE_LABELS = {
  gm_notes: 'GM NOTES', results_summary: 'RESULTS', storyline_update: 'STORYLINE',
  locker_room: 'LOCKER ROOM', booking_decision: 'BOOKING',
  callup_watch: 'CALLUP WATCH', cco_mandate: 'CCO MANDATE'
};

function formatEntryType(type) {
  return ENTRY_TYPE_LABELS[type] || type.replace(/_/g, ' ').toUpperCase();
}

function formatActivityDate(iso) {
  if (!iso) return '';
  const d = new Date(iso + 'Z');
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function renderActivityCard(entry, brandColor) {
  const isCCO = entry.entry_type === 'cco_mandate';
  const accent = isCCO ? '#c9a84c' : (brandColor || '#555');
  const badgeBg = accent;
  const badgeColor = '#0d0d0d';
  const context = entry.event_name ? esc(entry.event_name) : (entry.week_number ? `Week ${entry.week_number}` : '');

  return `
    <div class="activity-card" style="border-left-color:${accent}" data-entry-id="${entry.id}">
      <div class="activity-card-header">
        <span class="badge" style="background:${badgeBg}; color:${badgeColor}; font-size:0.65rem">${formatEntryType(entry.entry_type)}</span>
        <span class="activity-card-meta">${context}${context ? ' &middot; ' : ''}${formatActivityDate(entry.created_at)}</span>
        <span class="activity-card-actions">
          <button class="activity-action-edit" data-entry-id="${entry.id}" title="Edit">&#9998;</button>
          <button class="activity-action-delete" data-entry-id="${entry.id}" title="Delete">&times;</button>
        </span>
      </div>
      <div class="activity-card-title">${esc(entry.title)}</div>
      ${entry.tagline ? `<div class="activity-card-tagline">${esc(entry.tagline)}</div>` : ''}
      ${entry.content ? `
        <div class="activity-card-content" id="activity-content-${entry.id}" style="display:none">
          ${marked.parse(entry.content)}
        </div>
        <button class="activity-toggle" data-target="activity-content-${entry.id}">Show details &rsaquo;</button>
      ` : ''}
    </div>
  `;
}

function wireActivityToggles(container) {
  container.addEventListener('click', (e) => {
    if (e.target.classList.contains('activity-toggle')) {
      const targetId = e.target.dataset.target;
      const content = document.getElementById(targetId);
      if (content) {
        const showing = content.style.display !== 'none';
        content.style.display = showing ? 'none' : 'block';
        e.target.innerHTML = showing ? 'Show details &rsaquo;' : 'Hide details &lsaquo;';
      }
    }
  });
}

// ── Edit Brand Modal ──
async function openBrandEdit(brandId) {
  const brand = await api(`/brands/${brandId}`);
  const dayOptions = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

  openModal('Edit Brand', `
    <form id="brand-edit-form">
      ${formField('Name', formText('name', brand.name, { required: true }), { required: true })}
      ${formField('GM Name', formText('gm_name', brand.gm_name))}
      ${formField('Day of Week', formSelect('day_of_week', dayOptions, brand.day_of_week))}
      ${formField('Color', formText('color', brand.color, { placeholder: '#hex color' }))}
      ${formField('Brand Type', formText('brand_type', brand.brand_type))}
      ${formField('Notes', formTextarea('notes', brand.notes, { rows: 5 }))}
      ${formActions('Save')}
    </form>
  `);

  document.getElementById('brand-edit-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const data = collectFormData(e.target);
    try {
      await api(`/brands/${brandId}`, { method: 'PUT', body: data });
      closeModal();
      showToast('Brand updated');
      navigate('brand-hub', { brandId });
    } catch (err) {
      showToast(err.message || 'Failed to update brand', 'error');
    }
  });
}
