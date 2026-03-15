registerView('tag-teams', async (container) => {
  const teams = await api('/tag-teams');

  // Separate stables (with sub-units) from standalone tag teams
  const stables = teams.filter(t => t.team_type === 'Stable');
  const tagTeams = teams.filter(t => t.team_type === 'Tag Team' && !t.parent_team_id);
  const mixedTags = teams.filter(t => t.team_type === 'Mixed Tag' && !t.parent_team_id);

  container.innerHTML = `
    <div class="view-header">
      <div style="display:flex;align-items:center;gap:12px">
        <h2>Teams & Stables <span class="count">(${teams.length})</span></h2>
        <button class="btn-add" onclick="openTagTeamCreate()">+ Add Team</button>
      </div>
      <div class="filters">
        <select id="filter-team-type">
          <option value="">All Types</option>
          <option value="Stable">Stables</option>
          <option value="Tag Team">Tag Teams</option>
          <option value="Mixed Tag">Mixed Tag</option>
        </select>
        <select id="filter-team-status">
          <option value="">All Status</option>
          <option value="Active">Active</option>
          <option value="On Hiatus">On Hiatus</option>
          <option value="Disbanded">Disbanded</option>
        </select>
      </div>
    </div>
    <div class="card-grid" id="teams-grid"></div>
  `;

  function renderTeams() {
    const typeFilter = document.getElementById('filter-team-type').value;
    const statusFilter = document.getElementById('filter-team-status').value;

    let filtered = teams.filter(t => {
      // Hide sub-units (shown nested under parent)
      if (t.parent_team_id) return false;
      if (typeFilter && t.team_type !== typeFilter) return false;
      if (statusFilter && t.status !== statusFilter) return false;
      return true;
    });

    document.getElementById('teams-grid').innerHTML = filtered.map(t => {
      const subUnits = teams.filter(sub => sub.parent_team_id === t.id);
      return `
        <div class="card clickable-row" onclick="navigate('notes', {type:'tag-teams', id:${t.id}})">
          <div class="card-header">
            <span class="card-title">${esc(t.name)}</span>
            <span>${teamTypeBadge(t.team_type)} ${t.status !== 'Active' ? statusBadge(t.status) : ''}</span>
          </div>
          ${t.brand_name ? `<div style="margin-bottom:6px">${brandBadge(t.brand_name)}</div>` : ''}
          <div class="card-members">
            ${(t.members || []).map(m =>
              `<span class="member-chip ${m.role === 'manager' ? 'manager' : ''}">${esc(m.name)}${m.role === 'manager' ? ' (mgr)' : ''}</span>`
            ).join('')}
          </div>
          ${subUnits.length > 0 ? `
            <div style="margin-top:10px; padding-top:8px; border-top:1px solid var(--border)">
              <div style="font-size:0.7rem; text-transform:uppercase; color:var(--text-dim); margin-bottom:4px">Sub-units</div>
              ${subUnits.map(sub => `
                <div style="font-size:0.82rem; margin:4px 0">
                  ${teamTypeBadge(sub.team_type)} ${esc(sub.name)}
                  <span style="color:var(--text-muted); font-size:0.75rem">
                    (${(sub.members || []).map(m => m.name).join(' & ')})
                  </span>
                </div>
              `).join('')}
            </div>
          ` : ''}
        </div>
      `;
    }).join('');
  }

  ['filter-team-type', 'filter-team-status'].forEach(id => {
    document.getElementById(id).addEventListener('change', renderTeams);
  });

  renderTeams();
});

// Tag Team Create
async function openTagTeamCreate() {
  const stables = await api('/tag-teams?team_type=Stable&status=Active');
  const html = `<form id="team-create-form">
    ${formRow(
      formField('Name', formText('name', '', {required: true, placeholder: 'Team name'}), {required: true}),
      formField('Team Type', formSelect('team_type', ['Tag Team', 'Stable', 'Mixed Tag'], 'Tag Team'), {required: true})
    )}
    ${formRow(
      formField('Brand', formSelect('brand_id', [{value:'', label:'Unassigned'}, ...BRAND_OPTIONS], ''), {required: true}),
      formField('Parent Stable', formSelect('parent_team_id', [{value:'', label:'None'}, ...stables.map(s => ({value: s.id, label: s.name}))], ''))
    )}
    <div class="form-group">
      <label class="form-label">Members <span class="required">*</span></label>
      ${superstarMultiPicker('members', [])}
    </div>
    ${formField('Notes', formTextarea('notes', '', {rows: 3}))}
    ${formActions('Create Team')}
  </form>`;
  openModal('Add Tag Team / Stable', html, {wide: true});
  wireMultiPickers(document.querySelector('.modal'));
  document.getElementById('team-create-form').onsubmit = async (e) => {
    e.preventDefault();
    const data = collectFormData(e.target);
    delete data.members;
    const picker = document.querySelector('.ss-multi');
    const memberIds = getMultiPickerIds(picker);
    if (!data.name) return showToast('Name is required', 'error');
    if (memberIds.length < 2) return showToast('At least 2 members required', 'error');
    data.member_ids = memberIds.map(m => ({superstar_id: m.superstar_id, role: 'member'}));
    try {
      const result = await api('/tag-teams', { method: 'POST', body: data });
      closeModal();
      showToast('Team created');
      navigate('notes', { type: 'tag-teams', id: result.id });
    } catch(err) { showToast(err.message, 'error'); }
  };
}

// Tag Team Edit
async function openTagTeamEdit(id) {
  const [team, stables] = await Promise.all([
    api(`/tag-teams/${id}`),
    api('/tag-teams?team_type=Stable&status=Active')
  ]);
  const html = `<form id="team-edit-form">
    ${formRow(
      formField('Name', formText('name', team.name, {required: true}), {required: true}),
      formField('Team Type', formSelect('team_type', ['Tag Team', 'Stable', 'Mixed Tag'], team.team_type))
    )}
    ${formRow(
      formField('Brand', formSelect('brand_id', [{value:'', label:'Unassigned'}, ...BRAND_OPTIONS], team.brand_id || '')),
      formField('Status', formSelect('status', ['Active', 'Inactive', 'Disbanded'], team.status || 'Active'))
    )}
    ${formField('Parent Stable', formSelect('parent_team_id', [{value:'', label:'None'}, ...stables.filter(s => s.id !== id).map(s => ({value: s.id, label: s.name}))], team.parent_team_id || ''))}
    ${formRow(
      formField('Wins', formNumber('team_wins', team.team_wins, {min: 0})),
      formField('Losses', formNumber('team_losses', team.team_losses, {min: 0})),
      formField('Draws', formNumber('team_draws', team.team_draws, {min: 0}))
    )}
    <div class="form-group">
      <label class="form-label">Members</label>
      <div id="member-list">
        ${(team.members || []).map(m => `<div class="ss-chip" style="margin-bottom:4px" data-superstar-id="${m.id}">
          ${esc(m.name)}
          <select class="ss-chip-role" style="margin-left:4px" data-superstar-id="${m.id}">
            <option value="member" ${m.role==='member'?'selected':''}>Member</option>
            <option value="leader" ${m.role==='leader'?'selected':''}>Leader</option>
            <option value="manager" ${m.role==='manager'?'selected':''}>Manager</option>
          </select>
          <button type="button" class="ss-chip-remove" data-remove-id="${m.id}">&times;</button>
        </div>`).join('')}
      </div>
      <div style="margin-top:8px">
        ${superstarSearchDropdown('add_member', '')}
        <button type="button" class="btn btn-ghost btn-sm" style="margin-top:6px" id="add-member-btn">+ Add Member</button>
      </div>
    </div>
    ${formField('Notes', formTextarea('notes', team.notes, {rows: 3}))}
    ${formActions('Save Changes', {deleteBtn: true, deleteLabel: 'Disband'})}
  </form>`;
  openModal('Edit Team', html, {wide: true});
  wireSuperstarDropdowns(document.querySelector('.modal'));

  // Member removal
  document.getElementById('member-list').addEventListener('click', async (e) => {
    if (e.target.classList.contains('ss-chip-remove')) {
      const sid = e.target.dataset.removeId;
      try {
        await api(`/tag-teams/${id}/members/${sid}`, { method: 'DELETE' });
        e.target.closest('.ss-chip').remove();
        showToast('Member removed');
      } catch(err) { showToast(err.message, 'error'); }
    }
  });

  // Role change
  document.getElementById('member-list').addEventListener('change', async (e) => {
    if (e.target.classList.contains('ss-chip-role')) {
      const sid = e.target.dataset.superstarId;
      try {
        await api(`/tag-teams/${id}/members/${sid}`, { method: 'PUT', body: { role: e.target.value } });
        showToast('Role updated');
      } catch(err) { showToast(err.message, 'error'); }
    }
  });

  // Add member
  document.getElementById('add-member-btn').onclick = async () => {
    const hidden = document.querySelector('[name="add_member"]');
    if (!hidden.value) return showToast('Select a superstar first', 'error');
    try {
      await api(`/tag-teams/${id}/members`, { method: 'POST', body: { superstar_id: parseInt(hidden.value), role: 'member' } });
      closeModal();
      showToast('Member added');
      navigate('notes', { type: 'tag-teams', id });
    } catch(err) { showToast(err.message, 'error'); }
  };

  // Main save
  document.getElementById('team-edit-form').onsubmit = async (e) => {
    e.preventDefault();
    const data = collectFormData(e.target);
    delete data.add_member;
    delete data.members;
    try {
      await api(`/tag-teams/${id}`, { method: 'PUT', body: data });
      closeModal();
      showToast('Team updated');
      navigate('notes', { type: 'tag-teams', id });
    } catch(err) { showToast(err.message, 'error'); }
  };

  // Disband
  document.getElementById('form-delete-btn').onclick = () => {
    confirmDialog(`Disband "${esc(team.name)}"? Status will be set to Disbanded.`, async () => {
      try {
        await api(`/tag-teams/${id}`, { method: 'DELETE' });
        showToast('Team disbanded');
        navigate('tag-teams');
      } catch(err) { showToast(err.message, 'error'); }
    }, {danger: true, confirmText: 'Disband', title: 'Disband Team'});
  };
}
