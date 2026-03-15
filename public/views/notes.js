registerView('notes', async (container, params) => {
  const { type, id, backView } = params || {};
  const defaults = {
    superstars: { back: 'roster', label: 'Roster', endpoint: 'superstars' },
    'tag-teams': { back: 'tag-teams', label: 'Tag Teams', endpoint: 'tag-teams' },
    events: { back: 'events', label: 'Events', endpoint: 'events' },
    championships: { back: 'championships', label: 'Championships', endpoint: 'championships' },
    rivalries: { back: 'rivalries', label: 'Rivalries', endpoint: 'rivalries' },
  };

  const config = defaults[type];
  if (!config || !id) return navigate('roster');

  const entity = await api(`/${config.endpoint}/${id}`);
  const back = backView || config.back;
  const backLabel = defaults[type]?.label || 'Back';
  const typeLabels = { superstars: 'Superstar', 'tag-teams': 'Team', events: 'Event', championships: 'Championship', rivalries: 'Rivalry' };
  const typeLabel = typeLabels[type] || type;

  // Edit function names per type
  const editFns = {
    superstars: `openSuperstarEdit(${id})`,
    events: `openEventEdit(${id})`,
    championships: `openChampionshipEdit(${id})`,
    rivalries: `openRivalryEdit(${id})`,
    'tag-teams': `openTagTeamEdit(${id})`,
  };

  const notesHtml = entity.notes
    ? marked.parse(entity.notes)
    : '<div class="empty-state">No notes yet.</div>';

  // Build detail section based on entity type
  let detailHtml = '';
  if (type === 'superstars') {
    detailHtml = `<div class="detail-grid" style="margin-bottom:20px">
      ${entity.alignment ? `<div><div class="detail-label">Alignment</div><div class="detail-value">${alignmentBadge(entity.alignment)}</div></div>` : ''}
      ${entity.division ? `<div><div class="detail-label">Division</div><div class="detail-value">${esc(entity.division)}</div></div>` : ''}
      ${entity.division_rank != null ? `<div><div class="detail-label">Rank</div><div class="detail-value">${entity.division_rank === 0 ? '<span style="color:var(--gold)">Champion</span>' : entity.division_rank === 99 ? 'Unranked' : '#'+entity.division_rank}</div></div>` : ''}
      ${entity.overall_rating ? `<div><div class="detail-label">Overall</div><div class="detail-value">${entity.overall_rating}</div></div>` : ''}
      ${entity.finisher ? `<div><div class="detail-label">Finisher</div><div class="detail-value">${esc(entity.finisher)}</div></div>` : ''}
      ${entity.signature ? `<div><div class="detail-label">Signature</div><div class="detail-value">${esc(entity.signature)}</div></div>` : ''}
      ${entity.hometown ? `<div><div class="detail-label">Hometown</div><div class="detail-value">${esc(entity.hometown)}</div></div>` : ''}
      ${entity.weight_class ? `<div><div class="detail-label">Weight Class</div><div class="detail-value">${esc(entity.weight_class)}</div></div>` : ''}
      ${entity.status ? `<div><div class="detail-label">Status</div><div class="detail-value">${statusBadge(entity.status)}</div></div>` : ''}
      ${entity.custom_character ? `<div><div class="detail-label">Type</div><div class="detail-value">Custom Character</div></div>` : ''}
    </div>`;
    if (entity.character_background) {
      detailHtml += `<div style="margin-bottom:16px"><div class="detail-label" style="margin-bottom:6px">Character Background</div><div style="color:var(--text-muted);font-size:0.85rem;line-height:1.6">${esc(entity.character_background)}</div></div>`;
    }
    if (entity.tag_teams && entity.tag_teams.length > 0) {
      detailHtml += `<div style="margin-bottom:16px"><div class="detail-label" style="margin-bottom:6px">Teams & Stables</div><div class="card-members">${entity.tag_teams.map(t => `<span class="member-chip ${t.role === 'manager' ? 'manager' : ''}" style="cursor:pointer" onclick="navigate('notes',{type:'tag-teams',id:${t.id}})">${esc(t.name)} ${teamTypeBadge(t.team_type)}</span>`).join('')}</div></div>`;
    }
    if (entity.matches && entity.matches.length > 0) {
      detailHtml += `<div><div class="detail-label" style="margin-bottom:6px">Recent Matches (${entity.matches.length})</div>
        <div style="font-size:0.82rem;color:var(--text-muted)">${entity.matches.slice(0, 5).map(m => `<div style="padding:4px 0;border-bottom:0.5px solid var(--border)">${esc(m.event_name)} — ${esc(m.match_type)} — <span style="color:${m.result === 'win' ? 'var(--success)' : m.result === 'loss' ? 'var(--brand-raw-text)' : 'var(--text-muted)'}">${m.result || 'TBD'}</span></div>`).join('')}</div>
      </div>`;
    }
  } else if (type === 'championships') {
    detailHtml = `<div class="detail-grid" style="margin-bottom:20px">
      <div><div class="detail-label">Division</div><div class="detail-value">${esc(entity.division || '-')}</div></div>
      <div><div class="detail-label">Category</div><div class="detail-value">${esc(entity.category || '-')}</div></div>
      <div><div class="detail-label">Status</div><div class="detail-value">${entity.active ? '<span class="badge badge-active">Active</span>' : '<span class="badge badge-disbanded">Legacy</span>'}</div></div>
      <div><div class="detail-label">Champion</div><div class="detail-value">${entity.holder_name ? esc(entity.holder_name) : '<span style="color:var(--gold)">Vacant</span>'}</div></div>
      <div><div class="detail-label">Defenses</div><div class="detail-value">${entity.defenses || 0}</div></div>
    </div>`;
    if (entity.history && entity.history.length > 0) {
      detailHtml += `<div style="margin-bottom:16px"><div class="detail-label" style="margin-bottom:6px;display:flex;align-items:center;justify-content:space-between">Reign History <button class="btn-add" onclick="openReignCreate(${id})" style="font-size:0.7rem;padding:2px 8px">+ Add Reign</button></div>
        ${entity.history.map(h => `<div style="padding:6px 0;border-bottom:0.5px solid var(--border);font-size:0.82rem;display:flex;justify-content:space-between;align-items:center">
          <span style="cursor:pointer;color:var(--brand-raw-text)" onclick="navigate('notes',{type:'superstars',id:${h.superstar_id}})">${esc(h.superstar_name)}</span>
          <span style="display:flex;align-items:center;gap:8px">
            <span style="color:var(--text-dim)">${h.won_at_event ? esc(h.won_at_event) : ''} → ${h.lost_at_event ? esc(h.lost_at_event) : '<span style="color:var(--gold)">Current</span>'} ${h.defenses ? `(${h.defenses} def.)` : ''}</span>
            <span class="action-icons" style="display:inline-flex;gap:4px">
              <span class="action-icon" title="Edit" onclick="event.stopPropagation(); openReignEdit(${h.id}, ${id})">&#9998;</span>
              <span class="action-icon delete" title="Delete" onclick="event.stopPropagation(); deleteReign(${h.id}, ${id})">&#128465;</span>
            </span>
          </span>
        </div>`).join('')}
      </div>`;
    } else {
      detailHtml += `<div style="margin-bottom:16px"><div class="detail-label" style="margin-bottom:6px;display:flex;align-items:center;justify-content:space-between">Reign History <button class="btn-add" onclick="openReignCreate(${id})" style="font-size:0.7rem;padding:2px 8px">+ Add Reign</button></div>
        <div class="empty-state" style="font-size:0.82rem">No reign history yet.</div>
      </div>`;
    }
  } else if (type === 'rivalries') {
    detailHtml = `<div class="detail-grid" style="margin-bottom:20px">
      <div><div class="detail-label">Status</div><div class="detail-value">${statusBadge(entity.status)}</div></div>
      <div><div class="detail-label">Intensity</div><div class="detail-value">${esc(entity.intensity || 'Low')}</div></div>
      <div><div class="detail-label">Type</div><div class="detail-value">${esc(entity.rivalry_type || '1v1')}</div></div>
      ${entity.slot_number ? `<div><div class="detail-label">Slot</div><div class="detail-value">#${entity.slot_number}</div></div>` : ''}
    </div>`;
    if (entity.participants && entity.participants.length > 0) {
      detailHtml += `<div style="margin-bottom:16px"><div class="detail-label" style="margin-bottom:6px">Participants</div><div class="card-members">${entity.participants.map(p => `<span class="member-chip">${esc(p.name)} ${p.role ? `<span style="color:var(--text-dim);font-size:0.65rem">(${esc(p.role)})</span>` : ''}</span>`).join('')}</div></div>`;
    }
  } else if (type === 'tag-teams') {
    detailHtml = `<div class="detail-grid" style="margin-bottom:20px">
      <div><div class="detail-label">Type</div><div class="detail-value">${teamTypeBadge(entity.team_type)}</div></div>
      <div><div class="detail-label">Status</div><div class="detail-value">${statusBadge(entity.status)}</div></div>
      ${entity.parent_team_name ? `<div><div class="detail-label">Parent Stable</div><div class="detail-value">${esc(entity.parent_team_name)}</div></div>` : ''}
      <div><div class="detail-label">Record</div><div class="detail-value">${entity.team_wins || 0}W-${entity.team_losses || 0}L-${entity.team_draws || 0}D</div></div>
    </div>`;
    if (entity.members && entity.members.length > 0) {
      detailHtml += `<div style="margin-bottom:16px"><div class="detail-label" style="margin-bottom:6px">Members</div><div class="card-members">${entity.members.map(m => `<span class="member-chip ${m.role === 'manager' ? 'manager' : ''}" style="cursor:pointer" onclick="navigate('notes',{type:'superstars',id:${m.id}})">${esc(m.name)} <span style="color:var(--text-dim);font-size:0.65rem">(${esc(m.role)})</span></span>`).join('')}</div></div>`;
    }
    if (entity.sub_units && entity.sub_units.length > 0) {
      detailHtml += `<div style="margin-bottom:16px"><div class="detail-label" style="margin-bottom:6px">Sub-Units</div><div class="card-members">${entity.sub_units.map(su => `<span class="member-chip" style="cursor:pointer" onclick="navigate('notes',{type:'tag-teams',id:${su.id}})">${esc(su.name)} ${teamTypeBadge(su.team_type)}</span>`).join('')}</div></div>`;
    }
  } else if (type === 'events') {
    detailHtml = `<div class="detail-grid" style="margin-bottom:20px">
      <div><div class="detail-label">Type</div><div class="detail-value">${esc(entity.event_type || '-')}</div></div>
      <div><div class="detail-label">Status</div><div class="detail-value">${statusBadge(entity.status)}</div></div>
      <div><div class="detail-label">Week</div><div class="detail-value">${entity.week_number || '-'}</div></div>
      ${entity.arena ? `<div><div class="detail-label">Arena</div><div class="detail-value">${esc(entity.arena)}</div></div>` : ''}
      ${entity.city ? `<div><div class="detail-label">City</div><div class="detail-value">${esc(entity.city)}</div></div>` : ''}
    </div>`;
  }

  container.innerHTML = `
    <span class="back-link" onclick="navigate('${esc(back)}')">&#8592; Back to ${esc(backLabel)}</span>
    <div class="view-header">
      <div>
        <h2>${esc(entity.name)}</h2>
        <div style="margin-top:4px">
          ${entity.brands && entity.brands.length > 0
            ? entity.brands.map(b => brandBadge(b.name)).join('')
            : (entity.brand_name ? brandBadge(entity.brand_name) : '')}
          <span class="badge" style="background:var(--surface-3); color:var(--text-muted); font-size:0.7rem">${esc(typeLabel)}</span>
        </div>
      </div>
      <div style="display:flex;gap:8px">
        ${editFns[type] ? `<button class="btn btn-ghost btn-sm" onclick="${editFns[type]}">Edit</button>` : ''}
        ${type === 'events' ? `<button class="btn btn-sm" onclick="navigate('match-card',{eventId:${id}})">Match Card</button>` : ''}
      </div>
    </div>
    ${detailHtml}
    <div class="notes-content">
      ${notesHtml}
    </div>
  `;
});

// --- Championship History CRUD ---

async function openReignCreate(championshipId) {
  const events = await api('/events');
  const eventOpts = events.map(e => ({ value: e.id, label: e.name }));
  const html = `<form id="reign-form">
    ${formField('Superstar', superstarSearchDropdown('superstar_id', ''), {required: true})}
    ${formRow(
      formField('Won At Event', formSelect('won_at_event_id', eventOpts, '')),
      formField('Won Date', formDate('won_date', ''))
    )}
    ${formRow(
      formField('Lost At Event', formSelect('lost_at_event_id', eventOpts, '')),
      formField('Lost Date', formDate('lost_date', ''))
    )}
    ${formField('Defenses', formNumber('defenses', 0, {min: 0}))}
    ${formField('Notes', formTextarea('notes', '', {rows: 2}))}
    ${formActions('Add Reign')}
  </form>`;
  openModal('Add Reign', html, {wide: true});
  wireSuperstarDropdowns(document.getElementById('reign-form'));

  document.getElementById('reign-form').onsubmit = async (e) => {
    e.preventDefault();
    const data = collectFormData(e.target);
    data.championship_id = championshipId;
    try {
      await api('/championship-history', { method: 'POST', body: data });
      closeModal();
      showToast('Reign added');
      navigate('notes', { type: 'championships', id: championshipId });
    } catch(err) { showToast(err.message, 'error'); }
  };
}

async function openReignEdit(reignId, championshipId) {
  const [champ, events] = await Promise.all([
    api(`/championships/${championshipId}`),
    api('/events')
  ]);
  const reign = champ.history.find(h => h.id === reignId);
  if (!reign) return showToast('Reign not found', 'error');

  const eventOpts = events.map(e => ({ value: e.id, label: e.name }));
  const html = `<form id="reign-form">
    ${formField('Superstar', superstarSearchDropdown('superstar_id', reign.superstar_id), {required: true})}
    ${formRow(
      formField('Won At Event', formSelect('won_at_event_id', eventOpts, reign.won_at_event_id || '')),
      formField('Won Date', formDate('won_date', reign.won_date || ''))
    )}
    ${formRow(
      formField('Lost At Event', formSelect('lost_at_event_id', eventOpts, reign.lost_at_event_id || '')),
      formField('Lost Date', formDate('lost_date', reign.lost_date || ''))
    )}
    ${formField('Defenses', formNumber('defenses', reign.defenses || 0, {min: 0}))}
    ${formField('Notes', formTextarea('notes', reign.notes || '', {rows: 2}))}
    ${formActions('Save Changes', {deleteBtn: true})}
  </form>`;
  openModal('Edit Reign', html, {wide: true});
  wireSuperstarDropdowns(document.getElementById('reign-form'));

  document.getElementById('reign-form').onsubmit = async (e) => {
    e.preventDefault();
    const data = collectFormData(e.target);
    try {
      await api(`/championship-history/${reignId}`, { method: 'PUT', body: data });
      closeModal();
      showToast('Reign updated');
      navigate('notes', { type: 'championships', id: championshipId });
    } catch(err) { showToast(err.message, 'error'); }
  };

  const delBtn = document.getElementById('form-delete-btn');
  if (delBtn) {
    delBtn.onclick = () => {
      confirmDialog('Delete this reign? This cannot be undone.', async () => {
        try {
          await api(`/championship-history/${reignId}`, { method: 'DELETE' });
          closeModal();
          showToast('Reign deleted');
          navigate('notes', { type: 'championships', id: championshipId });
        } catch(err) { showToast(err.message, 'error'); }
      }, {danger: true, confirmText: 'Delete', title: 'Delete Reign'});
    };
  }
}

async function deleteReign(reignId, championshipId) {
  confirmDialog('Delete this reign? This cannot be undone.', async () => {
    try {
      await api(`/championship-history/${reignId}`, { method: 'DELETE' });
      showToast('Reign deleted');
      navigate('notes', { type: 'championships', id: championshipId });
    } catch(err) { showToast(err.message, 'error'); }
  }, {danger: true, confirmText: 'Delete', title: 'Delete Reign'});
}
