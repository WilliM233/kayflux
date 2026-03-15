registerView('events', async (container) => {
  const events = await api('/events');

  // Group by month from event name parsing
  const months = ['May', 'June', 'July', 'August', 'September', 'October',
    'November', 'December', 'January', 'February', 'March', 'April'];

  // Extract month from event name
  function getMonth(name) {
    for (const m of months) {
      if (name.includes(m)) return m;
    }
    // Special events / PLEs mapped to their month
    if (name.includes('Hard Reset') || name.includes('Draft') || name.includes('Night of Champions')) return 'May';
    if (name.includes('Money in the Bank')) return 'June';
    if (name.includes('SummerSlam') || name.includes('NXT Heatwave')) return 'August';
    if (name.includes('Bash in Berlin')) return 'September';
    if (name.includes('Bad Blood') || name.includes('NXT Halloween Havoc')) return 'October';
    if (name.includes('Crown Jewel') || name.includes('Survivor Series')) return 'November';
    if (name.includes('Saturday Night')) return 'December';
    if (name.includes('Royal Rumble') || name.includes('NXT Vengeance Day')) return 'January';
    if (name.includes('Elimination Chamber')) return 'February';
    if (name.includes('WrestleMania') || name.includes('Stand & Deliver') || name.includes('Stand and Deliver')) return 'April';
    return 'Other';
  }

  // Day-of-week sort value: Monday=1 through Sunday=7
  const dayOrder = { Monday: 1, Tuesday: 2, Wednesday: 3, Thursday: 4, Friday: 5, Saturday: 6, Sunday: 7 };

  function getDaySort(e) {
    // Weekly shows use their brand's day_of_week
    if (e.brand_day && dayOrder[e.brand_day]) return dayOrder[e.brand_day];
    // PLEs/PPVs default to Saturday (they air on weekends, after weekly shows)
    if (e.event_type === 'PPV' || e.event_type === 'Special Event') return 6;
    return 99;
  }

  const grouped = {};
  for (const e of events) {
    const month = getMonth(e.name);
    if (!grouped[month]) grouped[month] = [];
    grouped[month].push(e);
  }

  // Sort within each month: week_number → day of week → brand_rank
  for (const month of Object.keys(grouped)) {
    grouped[month].sort((a, b) => {
      const weekDiff = (a.week_number || 99) - (b.week_number || 99);
      if (weekDiff !== 0) return weekDiff;
      const dayDiff = getDaySort(a) - getDaySort(b);
      if (dayDiff !== 0) return dayDiff;
      return (a.brand_rank || 99) - (b.brand_rank || 99);
    });
  }

  container.innerHTML = `
    <div class="view-header">
      <div style="display:flex;align-items:center;gap:12px">
        <h2>Events <span class="count">(${events.length})</span></h2>
        <button class="btn-add" onclick="openEventCreate()">+ Add Event</button>
      </div>
      <div class="filters">
        <select id="filter-event-brand">
          <option value="">All Brands</option>
          <option value="Raw">Raw</option>
          <option value="SmackDown">SmackDown</option>
          <option value="NXT">NXT</option>
        </select>
        <select id="filter-event-status">
          <option value="">All Status</option>
          <option value="Completed">Completed</option>
          <option value="In Progress">In Progress</option>
          <option value="Upcoming">Upcoming</option>
        </select>
        <select id="filter-event-type">
          <option value="">All Types</option>
          <option value="Weekly Show">Weekly Show</option>
          <option value="PPV">PPV / PLE</option>
          <option value="Draft">Draft</option>
          <option value="Special Event">Special Event</option>
        </select>
      </div>
    </div>
    <div id="events-list"></div>
  `;

  function renderEvents() {
    const brandFilter = document.getElementById('filter-event-brand').value;
    const statusFilter = document.getElementById('filter-event-status').value;
    const typeFilter = document.getElementById('filter-event-type').value;

    let html = '';
    for (const month of [...months, 'Other']) {
      const monthEvents = (grouped[month] || []).filter(e => {
        if (brandFilter && e.brand_name !== brandFilter) return false;
        if (statusFilter && e.status !== statusFilter) return false;
        if (typeFilter && e.event_type !== typeFilter) return false;
        return true;
      });
      if (monthEvents.length === 0) continue;

      html += `
        <div class="month-group">
          <div class="month-header">${month}</div>
          <div class="event-list">
            ${monthEvents.map(e => `
              <div class="event-row" data-event-id="${e.id}">
                ${e.brand_name ? brandBadge(e.brand_name) : (e.event_type === 'PPV' || e.event_type === 'Special Event' ? '<span class="badge badge-ple">PLE</span>' : '')}
                <span class="event-name">${esc(e.name)}</span>
                ${e.arena ? `<span class="event-meta">${esc(e.arena)}</span>` : ''}
                ${e.city ? `<span class="event-meta">${esc(e.city)}</span>` : ''}
                <span class="event-meta">Wk ${e.week_number || '-'}</span>
                ${statusBadge(e.status)}
                ${e.notes ? `<button class="notes-btn" onclick="event.stopPropagation(); navigate('notes', {type:'events', id:${e.id}})" title="View notes">&#128196;</button>` : ''}
              </div>
            `).join('')}
          </div>
        </div>
      `;
    }

    document.getElementById('events-list').innerHTML = html || '<div class="empty-state">No events match filters.</div>';
  }

  // Click event to open match card
  container.addEventListener('click', (e) => {
    const row = e.target.closest('.event-row');
    if (row) navigate('match-card', { eventId: row.dataset.eventId });
  });

  ['filter-event-brand', 'filter-event-status', 'filter-event-type'].forEach(id => {
    document.getElementById(id).addEventListener('change', renderEvents);
  });

  renderEvents();
});

// Event Create
async function openEventCreate() {
  const [templates, seasons] = await Promise.all([api('/show-templates'), api('/seasons')]);
  const currentSeason = seasons.find(s => s.is_current);
  const html = `<form id="event-create-form">
    ${formField('Show Template', formSelect('show_template_id',
      [{value:'', label:'— Custom Event —'}, ...templates.map(t => ({value: t.id, label: `${t.name}${t.brand_name ? ' ('+t.brand_name+')' : ''}`}))], ''))}
    ${formRow(
      formField('Name', formText('name', '', {required: true, placeholder: 'Event name'}), {required: true}),
      formField('Brand', formSelect('brand_id', [{value:'', label:'Cross-Brand'}, ...BRAND_OPTIONS], ''))
    )}
    ${formRow(
      formField('Event Type', formSelect('event_type', EVENT_TYPE_OPTIONS, 'Weekly Show'), {required: true}),
      formField('Status', formSelect('status', EVENT_STATUS_OPTIONS, 'Upcoming'))
    )}
    ${formRow(
      formField('Season', formSelect('season_id', seasons.map(s => ({value: s.id, label: s.name})), currentSeason?.id || '')),
      formField('Week Number', formNumber('week_number', '', {min: 1}))
    )}
    ${formRow(
      formField('Arena', formText('arena', '', {placeholder: 'Arena name'})),
      formField('City', formText('city', '', {placeholder: 'City, State'}))
    )}
    ${formField('Event Date', formDate('event_date', ''))}
    ${formField('Notes', formTextarea('notes', '', {rows: 3}))}
    ${formActions('Create Event')}
  </form>`;
  openModal('Add Event', html, {wide: true});

  // Template auto-fill
  const templateSelect = document.querySelector('[name="show_template_id"]');
  templateSelect.addEventListener('change', () => {
    const t = templates.find(t => String(t.id) === templateSelect.value);
    if (t) {
      const nameInput = document.querySelector('[name="name"]');
      const brandInput = document.querySelector('[name="brand_id"]');
      const typeInput = document.querySelector('[name="event_type"]');
      if (t.name) nameInput.value = t.name;
      if (t.brand_id) brandInput.value = t.brand_id;
      if (t.show_type) {
        const typeMap = { Weekly: 'Weekly Show', PPV: 'PPV', Special: 'Special Event', Draft: 'Draft' };
        typeInput.value = typeMap[t.show_type] || t.show_type;
      }
    }
  });

  document.getElementById('event-create-form').onsubmit = async (e) => {
    e.preventDefault();
    const data = collectFormData(e.target);
    if (!data.name) return showToast('Name is required', 'error');
    try {
      const result = await api('/events', { method: 'POST', body: data });
      closeModal();
      showToast('Event created');
      navigate('match-card', { eventId: result.id });
    } catch(err) { showToast(err.message, 'error'); }
  };
}

// Event Edit
async function openEventEdit(id) {
  const [event, templates, seasons] = await Promise.all([api(`/events/${id}`), api('/show-templates'), api('/seasons')]);
  const html = `<form id="event-edit-form">
    ${formRow(
      formField('Name', formText('name', event.name, {required: true}), {required: true}),
      formField('Brand', formSelect('brand_id', [{value:'', label:'Cross-Brand'}, ...BRAND_OPTIONS], event.brand_id || ''))
    )}
    ${formRow(
      formField('Event Type', formSelect('event_type', EVENT_TYPE_OPTIONS, event.event_type)),
      formField('Status', formSelect('status', EVENT_STATUS_OPTIONS, event.status))
    )}
    ${formRow(
      formField('Season', formSelect('season_id', seasons.map(s => ({value: s.id, label: s.name})), event.season_id || '')),
      formField('Week Number', formNumber('week_number', event.week_number, {min: 1}))
    )}
    ${formRow(
      formField('Arena', formText('arena', event.arena)),
      formField('City', formText('city', event.city))
    )}
    ${formField('Event Date', formDate('event_date', event.event_date))}
    ${formField('Rivalry Payoffs', formTextarea('rivalry_payoffs', event.rivalry_payoffs, {rows: 2, placeholder: 'Which rivalries pay off here?'}))}
    ${formField('Notes', formTextarea('notes', event.notes, {rows: 3}))}
    ${formActions('Save Changes', {deleteBtn: true})}
  </form>`;
  openModal('Edit Event', html, {wide: true});
  document.getElementById('event-edit-form').onsubmit = async (e) => {
    e.preventDefault();
    try {
      await api(`/events/${id}`, { method: 'PUT', body: collectFormData(e.target) });
      closeModal();
      showToast('Event updated');
      navigate('notes', { type: 'events', id });
    } catch(err) { showToast(err.message, 'error'); }
  };
  document.getElementById('form-delete-btn').onclick = () => {
    confirmDialog(`Delete "${esc(event.name)}"? All associated matches will also be deleted.`, async () => {
      try {
        await api(`/events/${id}`, { method: 'DELETE' });
        showToast('Event deleted');
        navigate('events');
      } catch(err) { showToast(err.message, 'error'); }
    }, {danger: true, confirmText: 'Delete', title: 'Delete Event'});
  };
}
