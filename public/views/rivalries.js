registerView('rivalries', async (container) => {
  const rivalries = await api('/rivalries');

  const statusSteps = ['Building', 'Active', 'Climax', 'Resolved'];

  container.innerHTML = `
    <div class="view-header">
      <div style="display:flex;align-items:center;gap:12px">
        <h2>Rivalries <span class="count">(${rivalries.length})</span></h2>
        <button class="btn-add" onclick="openRivalryCreate()">+ Add Rivalry</button>
      </div>
      <div class="filters">
        <select id="filter-rivalry-status">
          <option value="">All Status</option>
          <option value="Active">Active</option>
          <option value="Building">Building</option>
          <option value="Climax">Climax</option>
          <option value="Resolved">Resolved</option>
          <option value="On Hold">On Hold</option>
        </select>
      </div>
    </div>
    <div class="card-grid" id="rivalries-grid"></div>
  `;

  function renderRivalries() {
    const statusFilter = document.getElementById('filter-rivalry-status').value;
    const filtered = rivalries.filter(r => !statusFilter || r.status === statusFilter);

    document.getElementById('rivalries-grid').innerHTML = filtered.map(r => {
      const currentIdx = statusSteps.indexOf(r.status);
      return `
        <div class="card clickable-row" onclick="navigate('notes', {type:'rivalries', id:${r.id}})">
          <div class="card-header">
            <span class="card-title">${esc(r.name)}</span>
            ${brandBadge(r.brand_name)}
          </div>
          <div style="margin:8px 0">
            ${(r.participants || []).map(p => `
              <span style="margin-right:8px">
                ${esc(p.name)} ${p.role ? alignmentBadge(p.role) : ''}
              </span>
            `).join(' vs. ')}
          </div>
          <div class="rivalry-status">
            ${statusSteps.map((step, idx) => `
              <div class="status-step ${idx <= currentIdx ? 'filled' : ''}" title="${step}"></div>
            `).join('')}
          </div>
          <div style="display:flex; justify-content:space-between; margin-top:4px; font-size:0.65rem; color:var(--text-dim)">
            ${statusSteps.map(s => `<span>${s}</span>`).join('')}
          </div>
        </div>
      `;
    }).join('') || '<div class="empty-state">No rivalries match filters.</div>';
  }

  document.getElementById('filter-rivalry-status').addEventListener('change', renderRivalries);
  renderRivalries();
});

// Rivalry Create
async function openRivalryCreate() {
  const seasons = await api('/seasons');
  const currentSeason = seasons.find(s => s.is_current);
  const html = `<form id="rivalry-create-form">
    ${formField('Name', formText('name', '', {required: true, placeholder: 'e.g. Seth Rollins vs. Bron Breakker'}), {required: true})}
    ${formRow(
      formField('Brand', formSelect('brand_id', BRAND_OPTIONS, ''), {required: true}),
      formField('Season', formSelect('season_id', seasons.map(s => ({value: s.id, label: s.name})), currentSeason?.id || ''))
    )}
    ${formRow(
      formField('Status', formSelect('status', RIVALRY_STATUS_OPTIONS, 'Pending')),
      formField('Intensity', formSelect('intensity', INTENSITY_OPTIONS, 'Low'))
    )}
    ${formRow(
      formField('Rivalry Type', formSelect('rivalry_type', RIVALRY_TYPE_OPTIONS, '1v1')),
      formField('Slot Number', formNumber('slot_number', '', {min: 1, max: 4, placeholder: '1-4'}))
    )}
    <div class="form-group">
      <label class="form-label">Participants <span class="required">*</span></label>
      ${superstarMultiPicker('participants', [])}
    </div>
    ${formField('Notes', formTextarea('notes', '', {rows: 3}))}
    ${formActions('Create Rivalry')}
  </form>`;
  openModal('Add Rivalry', html, {wide: true});
  wireMultiPickers(document.querySelector('.modal'));
  document.getElementById('rivalry-create-form').onsubmit = async (e) => {
    e.preventDefault();
    const data = collectFormData(e.target);
    delete data.participants;
    const picker = document.querySelector('.ss-multi');
    const participantIds = getMultiPickerIds(picker);
    if (!data.name) return showToast('Name is required', 'error');
    if (participantIds.length < 2) return showToast('At least 2 participants required', 'error');
    data.participant_ids = participantIds.map(p => ({superstar_id: p.superstar_id, role: 'participant'}));
    try {
      const result = await api('/rivalries', { method: 'POST', body: data });
      closeModal();
      showToast('Rivalry created');
      navigate('notes', { type: 'rivalries', id: result.id });
    } catch(err) { showToast(err.message, 'error'); }
  };
}

// Rivalry Edit
async function openRivalryEdit(id) {
  const [rivalry, seasons] = await Promise.all([api(`/rivalries/${id}`), api('/seasons')]);
  const html = `<form id="rivalry-edit-form">
    ${formField('Name', formText('name', rivalry.name, {required: true}), {required: true})}
    ${formRow(
      formField('Brand', formSelect('brand_id', BRAND_OPTIONS, rivalry.brand_id || '')),
      formField('Season', formSelect('season_id', seasons.map(s => ({value: s.id, label: s.name})), rivalry.season_id || ''))
    )}
    ${formRow(
      formField('Status', formSelect('status', RIVALRY_STATUS_OPTIONS, rivalry.status || 'Active')),
      formField('Intensity', formSelect('intensity', INTENSITY_OPTIONS, rivalry.intensity || 'Low'))
    )}
    ${formRow(
      formField('Rivalry Type', formSelect('rivalry_type', RIVALRY_TYPE_OPTIONS, rivalry.rivalry_type || '1v1')),
      formField('Slot Number', formNumber('slot_number', rivalry.slot_number, {min: 1, max: 4}))
    )}
    <div class="form-group">
      <label class="form-label">Participants</label>
      <div id="participant-list">
        ${(rivalry.participants || []).map(p => `<div class="ss-chip" data-id="${p.id}">
          ${esc(p.name)}
          <select class="ss-chip-role" data-participant-id="${p.id}">
            <option value="participant" ${p.role==='participant'||!p.role?'selected':''}>Participant</option>
            <option value="champion" ${p.role==='champion'?'selected':''}>Champion</option>
            <option value="challenger" ${p.role==='challenger'?'selected':''}>Challenger</option>
          </select>
          <button type="button" class="ss-chip-remove" data-remove-id="${p.id}">&times;</button>
        </div>`).join('')}
      </div>
      <div style="margin-top:8px">
        ${superstarSearchDropdown('add_participant', '')}
        <button type="button" class="btn btn-ghost btn-sm" style="margin-top:6px" id="add-participant-btn">+ Add Participant</button>
      </div>
    </div>
    ${formField('Notes', formTextarea('notes', rivalry.notes, {rows: 3}))}
    ${formActions('Save Changes', {deleteBtn: true, deleteLabel: 'Conclude'})}
  </form>`;
  openModal('Edit Rivalry', html, {wide: true});
  wireSuperstarDropdowns(document.querySelector('.modal'));

  // Participant removal
  document.getElementById('participant-list').addEventListener('click', async (e) => {
    if (e.target.classList.contains('ss-chip-remove')) {
      const sid = e.target.dataset.removeId;
      try {
        await api(`/rivalries/${id}/participants/${sid}`, { method: 'DELETE' });
        e.target.closest('.ss-chip').remove();
        showToast('Participant removed');
      } catch(err) { showToast(err.message, 'error'); }
    }
  });

  // Add participant
  document.getElementById('add-participant-btn').onclick = async () => {
    const hidden = document.querySelector('[name="add_participant"]');
    if (!hidden.value) return showToast('Select a superstar first', 'error');
    try {
      await api(`/rivalries/${id}/participants`, { method: 'POST', body: { superstar_id: parseInt(hidden.value), role: 'participant' } });
      closeModal();
      showToast('Participant added');
      navigate('notes', { type: 'rivalries', id });
    } catch(err) { showToast(err.message, 'error'); }
  };

  // Main save
  document.getElementById('rivalry-edit-form').onsubmit = async (e) => {
    e.preventDefault();
    const data = collectFormData(e.target);
    delete data.add_participant;
    delete data.participants;
    try {
      await api(`/rivalries/${id}`, { method: 'PUT', body: data });
      closeModal();
      showToast('Rivalry updated');
      navigate('notes', { type: 'rivalries', id });
    } catch(err) { showToast(err.message, 'error'); }
  };

  // Conclude
  document.getElementById('form-delete-btn').onclick = () => {
    confirmDialog(`Conclude "${esc(rivalry.name)}"? Status will be set to Concluded.`, async () => {
      try {
        await api(`/rivalries/${id}`, { method: 'DELETE' });
        showToast('Rivalry concluded');
        navigate('rivalries');
      } catch(err) { showToast(err.message, 'error'); }
    }, {danger: true, confirmText: 'Conclude', title: 'Conclude Rivalry'});
  };
}
