registerView('match-card', async (container, params) => {
  const eventId = params.eventId;
  if (!eventId) return navigate('events');

  const event = await api(`/events/${eventId}`);
  const matches = event.matches || [];

  // Support custom back navigation (e.g. from brand hub)
  const backView = params.backView || 'events';
  const backLabel = params.backLabel || 'Events';
  let backOnclick;
  if (params.backBrandId) {
    backOnclick = `navigate('brand-hub', {brandId:${parseInt(params.backBrandId)}})`;
  } else {
    backOnclick = `navigate('${esc(backView)}')`;
  }

  // Status action buttons
  let statusBtn = '';
  if (event.status === 'Upcoming') {
    statusBtn = `<button class="btn btn-sm" id="start-event-btn">Start Event</button>`;
  } else if (event.status === 'In Progress') {
    statusBtn = `<button class="btn btn-sm" id="complete-event-btn">Complete Event</button>`;
  }

  container.innerHTML = `
    <span class="back-link" onclick="${backOnclick}">&#8592; Back to ${esc(backLabel)}</span>
    <div class="view-header">
      <div>
        <h2>${esc(event.name)}</h2>
        <div style="margin-top:4px">
          ${brandBadge(event.brand_name)}
          ${statusBadge(event.status)}
          ${event.arena ? `<span style="color:var(--text-muted); font-size:0.82rem; margin-left:8px">${esc(event.arena)}${event.city ? ', ' + esc(event.city) : ''}</span>` : ''}
        </div>
      </div>
      <div style="display:flex;align-items:center;gap:8px">
        <button class="btn-add" onclick="openMatchCreate(${eventId})">+ Add Match</button>
        <button class="btn btn-ghost btn-sm" onclick="openEventEdit(${eventId})">Edit Event</button>
        ${statusBtn}
      </div>
    </div>
    ${event.notes ? `<div style="color:var(--text-muted); font-size:0.85rem; margin-bottom:20px; font-style:italic">${esc(event.notes)}</div>` : ''}
    <div class="match-card-list" id="match-list">
      ${matches.length === 0 ? '<div class="empty-state">No matches booked for this event yet.</div>' : ''}
      ${matches.map(m => renderMatch(m, eventId)).join('')}
    </div>
  `;

  // Wire status buttons
  const startBtn = document.getElementById('start-event-btn');
  if (startBtn) {
    startBtn.onclick = async () => {
      try {
        await api(`/events/${eventId}`, { method: 'PUT', body: { status: 'In Progress' } });
        showToast('Event started');
        navigate('match-card', { eventId });
      } catch(err) { showToast(err.message, 'error'); }
    };
  }
  const completeBtn = document.getElementById('complete-event-btn');
  if (completeBtn) {
    completeBtn.onclick = async () => {
      try {
        await api(`/events/${eventId}`, { method: 'PUT', body: { status: 'Completed' } });
        showToast('Event completed');
        navigate('match-card', { eventId });
      } catch(err) { showToast(err.message, 'error'); }
    };
  }
});

function renderMatch(m, eventId) {
  const winners = (m.participants || []).filter(p => p.result === 'win');
  const losers = (m.participants || []).filter(p => p.result === 'loss');
  const draws = (m.participants || []).filter(p => p.result === 'draw');
  const allP = m.participants || [];
  const isComplete = winners.length > 0 || draws.length > 0;

  // Build participant display
  let participantHtml;
  if (isComplete) {
    if (draws.length > 0) {
      participantHtml = draws.map(p => `<span>${esc(p.superstar_name)}</span>`).join(' vs. ') + ' (Draw)';
    } else {
      const winNames = winners.map(p => `<span class="winner">${esc(p.superstar_name)}</span>`).join(' & ');
      const loseNames = losers.map(p => `<span class="loser">${esc(p.superstar_name)}</span>`).join(' & ');
      participantHtml = `${winNames} def. ${loseNames}`;
    }
  } else {
    // Group by team_number
    const teams = {};
    for (const p of allP) {
      const t = p.team_number || 1;
      if (!teams[t]) teams[t] = [];
      teams[t].push(p);
    }
    const sides = Object.values(teams);
    participantHtml = sides.map(side =>
      side.map(p => esc(p.superstar_name)).join(' & ')
    ).join(' vs. ');
  }

  return `
    <div class="match-card ${isComplete ? 'completed' : ''}" data-match-id="${m.id}">
      <div class="match-card-header">
        ${m.match_position ? `<span class="match-position-label">${esc(m.match_position)}</span>` : ''}
        <span class="badge" style="font-size:0.65rem">${esc(m.match_type)}</span>
        ${m.championship_name ? `<span class="badge badge-nxt" style="font-size:0.65rem">${esc(m.championship_name)}</span>` : ''}
        <span class="action-icons">
          <button class="icon-btn" onclick="event.stopPropagation(); openMatchEdit(${m.id}, ${eventId})" title="Edit match">&#9998;</button>
          ${!isComplete ? `<button class="icon-btn" onclick="event.stopPropagation(); openMatchResult(${m.id}, ${eventId})" title="Record result">&#9733;</button>` : ''}
          <button class="icon-btn icon-btn-danger" onclick="event.stopPropagation(); deleteMatch(${m.id}, ${eventId})" title="Delete match">&#128465;</button>
        </span>
      </div>
      <div class="match-participants">${participantHtml || 'TBD'}</div>
      ${isComplete ? `
        <div class="match-result-line">
          ${m.win_method ? `<span>via ${esc(m.win_method)}</span>` : ''}
          ${starRating(m.match_rating)}
          ${m.title_change ? '<span class="badge badge-vacant">Title Change</span>' : ''}
        </div>
      ` : ''}
      ${m.notes ? `<div class="match-notes">${esc(m.notes)}</div>` : ''}
    </div>
  `;
}

// Delete match with confirmation
function deleteMatch(matchId, eventId) {
  confirmDialog('Delete this match? This cannot be undone.', async () => {
    try {
      await api(`/matches/${matchId}`, { method: 'DELETE' });
      showToast('Match deleted');
      navigate('match-card', { eventId });
    } catch(err) { showToast(err.message, 'error'); }
  }, { danger: true, confirmText: 'Delete', title: 'Delete Match' });
}

// Create match modal
async function openMatchCreate(eventId) {
  const [event, championships] = await Promise.all([
    api(`/events/${eventId}`),
    api('/championships?active=1')
  ]);
  const matchOrder = (event.matches || []).length + 1;

  const champOptions = [
    { value: '', label: '— None —' },
    ...championships.map(c => ({ value: c.id, label: `${c.name}${c.brand_name ? ' (' + c.brand_name + ')' : ''}` }))
  ];

  const html = `<form id="match-create-form">
    ${formRow(
      formField('Match Type', formSelect('match_type', MATCH_TYPE_OPTIONS, 'Singles'), { required: true }),
      formField('Card Position', formSelect('match_position', ['', ...MATCH_POSITION_OPTIONS], ''))
    )}
    ${formField('Championship', formSelect('championship_id', champOptions, ''))}
    <div class="form-group">
      <label class="form-label">Participants</label>
      ${superstarMultiPicker('participants', [], { showTeam: true })}
    </div>
    ${formField('Notes', formTextarea('notes', '', { rows: 3 }))}
    ${formActions('Create Match')}
  </form>`;

  openModal('Add Match', html, { wide: true });
  wireMultiPickers(document.querySelector('.modal'));

  document.getElementById('match-create-form').onsubmit = async (e) => {
    e.preventDefault();
    const data = collectFormData(e.target);
    delete data.participants;

    const picker = document.querySelector('.modal .ss-multi');
    const participantIds = getMultiPickerIds(picker);

    if (participantIds.length < 2) return showToast('At least 2 participants required', 'error');

    data.participant_ids = participantIds;
    data.match_order = matchOrder;
    data.brand_id = event.brand_id || null;
    data.season_id = event.season_id || null;

    // Clear empty optional fields
    if (!data.championship_id) delete data.championship_id;
    if (!data.match_position) delete data.match_position;

    try {
      await api(`/events/${eventId}/matches`, { method: 'POST', body: data });
      closeModal();
      showToast('Match created');
      navigate('match-card', { eventId });
    } catch(err) { showToast(err.message, 'error'); }
  };
}

// Edit match modal
async function openMatchEdit(matchId, eventId) {
  const [event, championships] = await Promise.all([
    api(`/events/${eventId}`),
    api('/championships?active=1')
  ]);
  const match = (event.matches || []).find(m => m.id === matchId);
  if (!match) return showToast('Match not found', 'error');

  const champOptions = [
    { value: '', label: '— None —' },
    ...championships.map(c => ({ value: c.id, label: `${c.name}${c.brand_name ? ' (' + c.brand_name + ')' : ''}` }))
  ];

  const participants = match.participants || [];

  const html = `<form id="match-edit-form">
    ${formRow(
      formField('Match Type', formSelect('match_type', MATCH_TYPE_OPTIONS, match.match_type || 'Singles'), { required: true }),
      formField('Card Position', formSelect('match_position', ['', ...MATCH_POSITION_OPTIONS], match.match_position || ''))
    )}
    ${formField('Championship', formSelect('championship_id', champOptions, match.championship_id || ''))}
    <div class="form-group">
      <label class="form-label">Participants</label>
      <div id="participant-list">
        ${participants.map(p => `<div class="ss-chip" data-id="${p.superstar_id}">
          ${esc(p.superstar_name)}
          <select class="ss-chip-team" data-id="${p.superstar_id}">
            <option value="1" ${(p.team_number || 1) === 1 ? 'selected' : ''}>Team 1</option>
            <option value="2" ${p.team_number === 2 ? 'selected' : ''}>Team 2</option>
          </select>
          <button type="button" class="ss-chip-remove" data-remove-id="${p.superstar_id}">&times;</button>
        </div>`).join('')}
      </div>
      <div style="margin-top:8px">
        ${superstarSearchDropdown('add_participant', '')}
        <div style="display:flex;gap:8px;margin-top:6px;align-items:center">
          <label style="font-size:0.75rem;color:var(--text-muted)">Team:</label>
          <select id="add-team-number" class="form-input" style="width:80px">
            <option value="1">Team 1</option>
            <option value="2">Team 2</option>
          </select>
          <button type="button" class="btn btn-ghost btn-sm" id="add-participant-btn">+ Add</button>
        </div>
      </div>
    </div>
    ${formField('Notes', formTextarea('notes', match.notes || '', { rows: 3 }))}
    ${formActions('Save Changes', { deleteBtn: true })}
  </form>`;

  openModal('Edit Match', html, { wide: true });
  wireSuperstarDropdowns(document.querySelector('.modal'));

  // Remove participant
  document.getElementById('participant-list').addEventListener('click', async (e) => {
    if (e.target.classList.contains('ss-chip-remove')) {
      const sid = e.target.dataset.removeId;
      try {
        await api(`/matches/${matchId}/participants/${sid}`, { method: 'DELETE' });
        e.target.closest('.ss-chip').remove();
        showToast('Participant removed');
      } catch(err) { showToast(err.message, 'error'); }
    }
  });

  // Add participant
  document.getElementById('add-participant-btn').onclick = async () => {
    const hidden = document.querySelector('[name="add_participant"]');
    if (!hidden.value) return showToast('Select a superstar first', 'error');
    const teamNum = parseInt(document.getElementById('add-team-number').value) || 1;
    try {
      await api(`/matches/${matchId}/participants`, { method: 'POST', body: { superstar_id: parseInt(hidden.value), team_number: teamNum } });
      closeModal();
      showToast('Participant added');
      navigate('match-card', { eventId });
    } catch(err) { showToast(err.message, 'error'); }
  };

  // Save match details
  document.getElementById('match-edit-form').onsubmit = async (e) => {
    e.preventDefault();
    const data = collectFormData(e.target);
    delete data.add_participant;
    if (!data.championship_id) data.championship_id = null;
    if (!data.match_position) data.match_position = null;
    try {
      await api(`/matches/${matchId}`, { method: 'PUT', body: data });
      closeModal();
      showToast('Match updated');
      navigate('match-card', { eventId });
    } catch(err) { showToast(err.message, 'error'); }
  };

  // Delete button
  document.getElementById('form-delete-btn').onclick = () => {
    deleteMatch(matchId, eventId);
    closeModal();
  };
}

// Record match result modal
async function openMatchResult(matchId, eventId) {
  const event = await api(`/events/${eventId}`);
  const match = (event.matches || []).find(m => m.id === matchId);
  if (!match) return showToast('Match not found', 'error');

  const participants = match.participants || [];
  if (participants.length === 0) return showToast('Add participants before recording a result', 'error');

  const participantRows = participants.map(p => `
    <div class="result-row" style="display:flex;align-items:center;gap:12px;padding:8px 0;border-bottom:1px solid var(--border)">
      <span style="min-width:140px;font-weight:500">${esc(p.superstar_name)}</span>
      <label style="font-size:0.8rem"><input type="radio" name="result_${p.superstar_id}" value="win"> Win</label>
      <label style="font-size:0.8rem"><input type="radio" name="result_${p.superstar_id}" value="loss"> Loss</label>
      <label style="font-size:0.8rem"><input type="radio" name="result_${p.superstar_id}" value="draw"> Draw</label>
    </div>
  `).join('');

  const html = `<form id="match-result-form">
    <div class="form-group">
      <label class="form-label">Results</label>
      <div id="result-participants">${participantRows}</div>
    </div>
    ${formRow(
      formField('Win Method', formSelect('win_method', ['', ...WIN_METHOD_OPTIONS], '')),
      formField('Match Rating', formNumber('rating', '', { min: 1, max: 5, placeholder: '1-5' }))
    )}
    ${formField('Notes', formTextarea('notes', match.notes || '', { rows: 2 }))}
    ${formActions('Record Result')}
  </form>`;

  openModal('Record Result', html);

  document.getElementById('match-result-form').onsubmit = async (e) => {
    e.preventDefault();
    const data = collectFormData(e.target);

    const winnerIds = [];
    const loserIds = [];
    const drawIds = [];

    for (const p of participants) {
      const radios = document.querySelectorAll(`[name="result_${p.superstar_id}"]`);
      let selected = null;
      for (const r of radios) {
        if (r.checked) selected = r.value;
      }
      if (!selected) return showToast(`Select a result for ${p.superstar_name}`, 'error');
      if (selected === 'win') winnerIds.push(p.superstar_id);
      else if (selected === 'loss') loserIds.push(p.superstar_id);
      else if (selected === 'draw') drawIds.push(p.superstar_id);
    }

    if (winnerIds.length === 0 && drawIds.length === 0) {
      return showToast('Select at least one winner or mark as draw', 'error');
    }

    const body = {
      winner_ids: winnerIds,
      loser_ids: loserIds,
      draw_ids: drawIds,
      win_method: data.win_method || null,
      rating: data.rating ? parseInt(data.rating) : null,
      notes: data.notes || null
    };

    try {
      await api(`/matches/${matchId}/result`, { method: 'POST', body });
      closeModal();
      showToast('Result recorded');
      navigate('match-card', { eventId });
    } catch(err) { showToast(err.message, 'error'); }
  };
}
