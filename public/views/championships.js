registerView('championships', async (container) => {
  const championships = await api('/championships');

  const activeChamps = championships.filter(c => c.active);
  const legacyChamps = championships.filter(c => !c.active);

  container.innerHTML = `
    <div class="view-header">
      <div style="display:flex;align-items:center;gap:12px">
        <h2>Championships <span class="count">(${championships.length})</span></h2>
        <button class="btn-add" onclick="openChampionshipCreate()">+ Add Championship</button>
      </div>
      <div class="filters">
        <select id="filter-champ-category">
          <option value="">All Categories</option>
          <option value="Current WWE">Current WWE</option>
          <option value="Classic WWE">Classic WWE</option>
          <option value="ECW & WCW">ECW & WCW</option>
          <option value="AAA">AAA</option>
        </select>
        <select id="filter-champ-division">
          <option value="">All Divisions</option>
          <option value="Men's Singles">Men's Singles</option>
          <option value="Women's Singles">Women's Singles</option>
          <option value="Tag Team">Tag Team</option>
        </select>
      </div>
    </div>
    <div id="champ-content"></div>
  `;

  function renderChamps() {
    const catFilter = document.getElementById('filter-champ-category').value;
    const divFilter = document.getElementById('filter-champ-division').value;

    const filter = (list) => list.filter(c => {
      if (catFilter && c.category !== catFilter) return false;
      if (divFilter && c.division !== divFilter) return false;
      return true;
    });

    const filteredActive = filter(activeChamps);
    const filteredLegacy = filter(legacyChamps);

    document.getElementById('champ-content').innerHTML = `
      ${filteredActive.length > 0 ? `
        <h3 style="margin-bottom:12px; font-size:0.9rem; color:var(--text-muted)">Active Titles (${filteredActive.length})</h3>
        <div class="card-grid" style="margin-bottom:32px">
          ${filteredActive.map(renderChampCard).join('')}
        </div>
      ` : ''}
      ${filteredLegacy.length > 0 ? `
        <h3 style="margin-bottom:12px; font-size:0.9rem; color:var(--text-muted)">Legacy Titles (${filteredLegacy.length})</h3>
        <div class="card-grid">
          ${filteredLegacy.map(renderChampCard).join('')}
        </div>
      ` : ''}
    `;
  }

  ['filter-champ-category', 'filter-champ-division'].forEach(id => {
    document.getElementById(id).addEventListener('change', renderChamps);
  });

  renderChamps();
});

// Championship Create
async function openChampionshipCreate() {
  const html = `<form id="champ-create-form">
    ${formField('Name', formText('name', '', {required: true, placeholder: 'Championship name'}), {required: true})}
    ${formRow(
      formField('Brand', formSelect('brand_id', BRAND_OPTIONS, '')),
      formField('Division', formSelect('division', ['Men\'s Singles', 'Women\'s Singles', 'Tag Team'], ''), {required: true})
    )}
    ${formRow(
      formField('Category', formSelect('category', ['Current WWE', 'Classic WWE', 'ECW & WCW', 'AAA'], 'Current WWE')),
      formField('Active', formToggle('active', true))
    )}
    ${formField('Lineage Notes', formTextarea('lineage_notes', '', {rows: 2, placeholder: 'Historical context'}))}
    ${formField('Notes', formTextarea('notes', '', {rows: 3}))}
    ${formActions('Create Championship')}
  </form>`;
  openModal('Add Championship', html);
  document.getElementById('champ-create-form').onsubmit = async (e) => {
    e.preventDefault();
    const data = collectFormData(e.target);
    if (!data.name) return showToast('Name is required', 'error');
    try {
      const result = await api('/championships', { method: 'POST', body: data });
      closeModal();
      showToast('Championship created');
      navigate('notes', { type: 'championships', id: result.id });
    } catch(err) { showToast(err.message, 'error'); }
  };
}

// Championship Edit
async function openChampionshipEdit(id) {
  const [champ, brands] = await Promise.all([api(`/championships/${id}`), api('/brands')]);
  const html = `<form id="champ-edit-form">
    ${formField('Name', formText('name', champ.name, {required: true}), {required: true})}
    ${formRow(
      formField('Division', formSelect('division', ['Men\'s Singles', 'Women\'s Singles', 'Tag Team'], champ.division || '')),
      formField('Category', formSelect('category', ['Current WWE', 'Classic WWE', 'ECW & WCW', 'AAA'], champ.category || 'Current WWE'))
    )}
    <div class="form-group">
      <label class="form-label">Brands</label>
      <div style="display:flex;gap:12px;flex-wrap:wrap">
        ${brands.map(b => `<label style="display:flex;align-items:center;gap:4px;font-size:0.82rem;color:var(--text-muted)">
          <input type="checkbox" name="brand_${b.id}" ${champ.brands && champ.brands.some(cb => cb.id === b.id) ? 'checked' : ''}> ${esc(b.name)}
        </label>`).join('')}
      </div>
    </div>
    ${formRow(
      formField('Active', formToggle('active', champ.active)),
      formField('Defenses', formNumber('defenses', champ.defenses, {min: 0}))
    )}
    ${formField('Lineage Notes', formTextarea('lineage_notes', champ.lineage_notes, {rows: 2}))}
    ${formField('Notes', formTextarea('notes', champ.notes, {rows: 3}))}
    <div style="margin-top:12px;padding-top:12px;border-top:0.5px solid var(--border)">
      <div class="form-label">Championship Actions</div>
      <div style="display:flex;gap:8px;margin-top:8px">
        ${champ.is_vacant ? '' : '<button type="button" class="btn btn-ghost btn-sm" id="vacate-btn">Vacate Title</button>'}
        <button type="button" class="btn btn-ghost btn-sm" id="award-btn">Award Title</button>
      </div>
    </div>
    ${formActions('Save Changes', {deleteBtn: true, deleteLabel: 'Deactivate'})}
  </form>`;
  openModal('Edit Championship', html, {wide: true});

  document.getElementById('champ-edit-form').onsubmit = async (e) => {
    e.preventDefault();
    const data = collectFormData(e.target);
    // Collect brand_ids from checkboxes
    const brand_ids = [];
    e.target.querySelectorAll('input[type="checkbox"]').forEach(cb => {
      if (cb.name.startsWith('brand_') && cb.checked) {
        brand_ids.push(parseInt(cb.name.replace('brand_', '')));
      }
    });
    // Remove brand_ keys and add brand_ids array
    Object.keys(data).forEach(k => { if (k.startsWith('brand_')) delete data[k]; });
    data.brand_ids = brand_ids;
    try {
      await api(`/championships/${id}`, { method: 'PUT', body: data });
      closeModal();
      showToast('Championship updated');
      navigate('notes', { type: 'championships', id });
    } catch(err) { showToast(err.message, 'error'); }
  };

  // Vacate button
  const vacateBtn = document.getElementById('vacate-btn');
  if (vacateBtn) {
    vacateBtn.onclick = () => {
      confirmDialog('Vacate this title? The current champion will lose the belt.', async () => {
        try {
          await api(`/championships/${id}/vacate`, { method: 'POST' });
          closeModal();
          showToast('Title vacated');
          navigate('notes', { type: 'championships', id });
        } catch(err) { showToast(err.message, 'error'); }
      }, {title: 'Vacate Title', confirmText: 'Vacate'});
    };
  }

  // Award button
  document.getElementById('award-btn').onclick = () => {
    closeModal();
    openAwardTitle(id);
  };

  // Delete (deactivate)
  document.getElementById('form-delete-btn').onclick = () => {
    confirmDialog('Deactivate this championship? It will be moved to legacy status.', async () => {
      try {
        await api(`/championships/${id}`, { method: 'DELETE' });
        showToast('Championship deactivated');
        navigate('championships');
      } catch(err) { showToast(err.message, 'error'); }
    }, {danger: true, confirmText: 'Deactivate', title: 'Deactivate Championship'});
  };
}

// Award Title
async function openAwardTitle(champId) {
  const events = await api('/events');
  const html = `<form id="award-form">
    ${formField('New Champion', superstarSearchDropdown('superstar_id', ''), {required: true})}
    ${formField('Won At Event', formSelect('event_id', events.map(e => ({value: e.id, label: e.name})), ''))}
    ${formActions('Award Title')}
  </form>`;
  openModal('Award Title', html);
  wireSuperstarDropdowns(document.querySelector('.modal'));
  document.getElementById('award-form').onsubmit = async (e) => {
    e.preventDefault();
    const data = collectFormData(e.target);
    if (!data.superstar_id) return showToast('Select a superstar', 'error');
    try {
      await api(`/championships/${champId}/award`, { method: 'POST', body: data });
      closeModal();
      showToast('Title awarded');
      navigate('notes', { type: 'championships', id: champId });
    } catch(err) { showToast(err.message, 'error'); }
  };
}

function renderChampCard(c) {
  const badges = (c.brands && c.brands.length > 0)
    ? c.brands.map(b => brandBadge(b.name)).join('')
    : brandBadge(c.brand_name);
  return `
    <div class="card clickable-row" onclick="navigate('notes', {type:'championships', id:${c.id}})">
      <div class="card-header">
        <span class="card-title">${esc(c.name)}</span>
        ${badges}
      </div>
      <div style="font-size:0.75rem; color:var(--text-muted); margin-bottom:4px">
        ${esc(c.division || '')} ${c.category ? '&middot; ' + esc(c.category) : ''}
      </div>
      <div class="champ-holder ${c.is_vacant ? 'vacant' : ''}">
        ${c.is_vacant ? 'VACANT' : esc(c.holder_name || 'Unknown')}
      </div>
      ${c.defenses > 0 ? `<div style="font-size:0.75rem; color:var(--text-muted); margin-top:4px">${c.defenses} defense${c.defenses !== 1 ? 's' : ''}</div>` : ''}
      ${c.lineage_notes ? `<div class="card-body" style="margin-top:8px; font-size:0.75rem">${esc(c.lineage_notes)}</div>` : ''}
    </div>
  `;
}
