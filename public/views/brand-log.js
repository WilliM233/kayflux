registerView('brand-log', async (container, params) => {
  const { brandId } = params;
  if (!brandId) return navigate('roster');

  const [brand, sessionLog] = await Promise.all([
    api(`/brands/${brandId}`),
    api(`/session-log?brand_id=${brandId}`),
  ]);

  const brandColor = brand.color || '#666';

  container.innerHTML = `
    <span class="back-link" onclick="navigate('brand-hub', {brandId:${brandId}})">&#8592; Back to ${esc(brand.name)} Hub</span>

    <div class="brand-hub-header" style="background:${brandColor}22; border-left:4px solid ${brandColor}; padding:16px; margin-bottom:20px; display:flex; align-items:center; justify-content:space-between">
      <h2 style="color:${brandColor}; font-size:1.2rem; margin:0">${esc(brand.name)} Activity Log</h2>
      <button class="btn-add" onclick="openSessionLogCreate(${brandId})">+ Add Entry</button>
    </div>

    <div class="filter-pills">
      <button class="filter-pill active" data-filter="all">All</button>
      <button class="filter-pill" data-filter="gm_notes">GM Notes</button>
      <button class="filter-pill" data-filter="results_summary">Results</button>
      <button class="filter-pill" data-filter="storyline_update">Storyline</button>
      <button class="filter-pill" data-filter="locker_room">Locker Room</button>
      <button class="filter-pill" data-filter="booking_decision">Booking</button>
      <button class="filter-pill" data-filter="callup_watch">Callup Watch</button>
      <button class="filter-pill" data-filter="cco_mandate">CCO Mandate</button>
    </div>

    <div class="activity-feed" id="activity-feed">
      ${sessionLog.length === 0
        ? '<div class="empty-state">No activity logged yet.</div>'
        : sessionLog.map(e => renderActivityCard(e, brandColor)).join('')}
    </div>
  `;

  // Filter pills — client-side filtering
  const pills = container.querySelectorAll('.filter-pill');
  pills.forEach(pill => {
    pill.addEventListener('click', () => {
      pills.forEach(p => p.classList.remove('active'));
      pill.classList.add('active');
      const filter = pill.dataset.filter;
      const filtered = filter === 'all'
        ? sessionLog
        : sessionLog.filter(e => e.entry_type === filter);
      const feedEl = document.getElementById('activity-feed');
      feedEl.innerHTML = filtered.length === 0
        ? '<div class="empty-state">No entries for this type.</div>'
        : filtered.map(e => renderActivityCard(e, brandColor)).join('');
    });
  });

  // Wire up activity card expand/collapse
  wireActivityToggles(container);

  // Click-to-edit on activity cards (delegate on container)
  container.querySelector('#activity-feed').addEventListener('click', (e) => {
    // Edit button
    const editBtn = e.target.closest('.activity-action-edit');
    if (editBtn) {
      e.stopPropagation();
      const entryId = editBtn.dataset.entryId;
      if (entryId) openSessionLogEdit(Number(entryId), brandId);
      return;
    }
    // Delete button
    const deleteBtn = e.target.closest('.activity-action-delete');
    if (deleteBtn) {
      e.stopPropagation();
      const entryId = deleteBtn.dataset.entryId;
      if (entryId) {
        confirmDialog('Delete this log entry? This cannot be undone.', async () => {
          try {
            await api(`/session-log/${entryId}`, { method: 'DELETE' });
            showToast('Entry deleted');
            navigate('brand-log', { brandId });
          } catch(err) { showToast(err.message, 'error'); }
        }, { danger: true, confirmText: 'Delete', title: 'Delete Entry' });
      }
      return;
    }
    // Click on card itself (not toggle button) opens edit
    const card = e.target.closest('.activity-card');
    if (card && !e.target.classList.contains('activity-toggle')) {
      const entryId = card.dataset.entryId;
      if (entryId) openSessionLogEdit(Number(entryId), brandId);
    }
  });
});

// ── Session Log Create ──
async function openSessionLogCreate(brandId) {
  const [seasons, events] = await Promise.all([
    api('/seasons'),
    api(`/events?brand=${encodeURIComponent((await api(`/brands/${brandId}`)).name)}`),
  ]);
  const currentSeason = seasons.find(s => s.is_current);
  const eventOptions = events.map(ev => ({ value: ev.id, label: `${ev.name}${ev.week_number ? ' (Wk ' + ev.week_number + ')' : ''}` }));

  const html = `<form id="session-log-form">
    ${formRow(
      formField('Entry Type', formSelect('entry_type', ENTRY_TYPE_OPTIONS, 'gm_notes', { required: true }), { required: true }),
      formField('Title', formText('title', '', { required: true, placeholder: 'Entry title' }), { required: true })
    )}
    ${formField('Tagline', formText('tagline', '', { placeholder: 'Short flash summary (optional)' }))}
    ${formRow(
      formField('Season', formSelect('season_id', seasons.map(s => ({ value: s.id, label: s.name })), currentSeason?.id || '')),
      formField('Week Number', formNumber('week_number', '', { min: 1, placeholder: 'Week #' }))
    )}
    ${formField('Event', formSelect('event_id', eventOptions, ''))}
    ${formField('Content', formTextarea('content', '', { rows: 6, placeholder: 'Markdown supported...' }))}
    ${formActions('Create Entry')}
  </form>`;

  openModal('Add Session Log Entry', html, { wide: true });

  document.getElementById('session-log-form').onsubmit = async (e) => {
    e.preventDefault();
    const data = collectFormData(e.target);
    data.brand_id = brandId;
    if (!data.title) return showToast('Title is required', 'error');
    try {
      await api('/session-log', { method: 'POST', body: data });
      closeModal();
      showToast('Entry created');
      navigate('brand-log', { brandId });
    } catch(err) { showToast(err.message, 'error'); }
  };
}

// ── Session Log Edit ──
async function openSessionLogEdit(entryId, brandId) {
  const [entry, seasons, events] = await Promise.all([
    api(`/session-log/${entryId}`),
    api('/seasons'),
    api(`/events?brand=${encodeURIComponent((await api(`/brands/${brandId}`)).name)}`),
  ]);
  const eventOptions = events.map(ev => ({ value: ev.id, label: `${ev.name}${ev.week_number ? ' (Wk ' + ev.week_number + ')' : ''}` }));

  const html = `<form id="session-log-form">
    ${formRow(
      formField('Entry Type', formSelect('entry_type', ENTRY_TYPE_OPTIONS, entry.entry_type, { required: true }), { required: true }),
      formField('Title', formText('title', entry.title, { required: true, placeholder: 'Entry title' }), { required: true })
    )}
    ${formField('Tagline', formText('tagline', entry.tagline || '', { placeholder: 'Short flash summary (optional)' }))}
    ${formRow(
      formField('Season', formSelect('season_id', seasons.map(s => ({ value: s.id, label: s.name })), entry.season_id || '')),
      formField('Week Number', formNumber('week_number', entry.week_number, { min: 1, placeholder: 'Week #' }))
    )}
    ${formField('Event', formSelect('event_id', eventOptions, entry.event_id || ''))}
    ${formField('Content', formTextarea('content', entry.content || '', { rows: 6, placeholder: 'Markdown supported...' }))}
    ${formActions('Save Changes', { deleteBtn: true })}
  </form>`;

  openModal('Edit Session Log Entry', html, { wide: true });

  document.getElementById('session-log-form').onsubmit = async (e) => {
    e.preventDefault();
    const data = collectFormData(e.target);
    if (!data.title) return showToast('Title is required', 'error');
    try {
      await api(`/session-log/${entryId}`, { method: 'PUT', body: data });
      closeModal();
      showToast('Entry updated');
      navigate('brand-log', { brandId });
    } catch(err) { showToast(err.message, 'error'); }
  };

  document.getElementById('form-delete-btn').onclick = () => {
    confirmDialog('Delete this log entry? This cannot be undone.', async () => {
      try {
        await api(`/session-log/${entryId}`, { method: 'DELETE' });
        closeModal();
        showToast('Entry deleted');
        navigate('brand-log', { brandId });
      } catch(err) { showToast(err.message, 'error'); }
    }, { danger: true, confirmText: 'Delete', title: 'Delete Entry' });
  };
}
