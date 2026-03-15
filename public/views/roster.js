registerView('roster', async (container) => {
  const [superstars, brands] = await Promise.all([
    api('/superstars'),
    api('/brands'),
  ]);

  const divisions = [...new Set(superstars.map(s => s.division).filter(Boolean))].sort();

  container.innerHTML = `
    <div class="view-header">
      <div style="display:flex;align-items:center;gap:12px">
        <h2>Roster <span class="count">(${superstars.length})</span></h2>
        <button class="btn-add" onclick="openSuperstarCreate()">+ Add Superstar</button>
      </div>
      <div class="filters">
        <select id="filter-brand">
          <option value="">All Brands</option>
          ${brands.map(b => `<option value="${esc(b.name)}">${esc(b.name)}</option>`).join('')}
        </select>
        <select id="filter-division">
          <option value="">All Divisions</option>
          ${divisions.map(d => `<option value="${esc(d)}">${esc(d)}</option>`).join('')}
        </select>
        <select id="filter-alignment">
          <option value="">All Alignments</option>
          <option value="Face">Face</option>
          <option value="Heel">Heel</option>
          <option value="Tweener">Tweener</option>
        </select>
        <select id="filter-status">
          <option value="">All Status</option>
          <option value="Active" selected>Active</option>
          <option value="Legend">Legend</option>
        </select>
        <input type="search" id="filter-search" placeholder="Search superstars...">
      </div>
    </div>
    <table class="data-table" id="roster-table">
      <thead>
        <tr>
          <th data-sort="name">Name</th>
          <th data-sort="brand_name">Brand</th>
          <th data-sort="division">Division</th>
          <th data-sort="division_rank">Rank</th>
          <th data-sort="alignment">Alignment</th>
          <th data-sort="overall_rating">OVR</th>
          <th>Record</th>
          <th data-sort="status">Status</th>
        </tr>
      </thead>
      <tbody id="roster-body"></tbody>
    </table>
  `;

  let allData = superstars;
  let sortKey = 'name';
  let sortAsc = true;

  function renderTable() {
    const brandFilter = document.getElementById('filter-brand').value;
    const divFilter = document.getElementById('filter-division').value;
    const alignFilter = document.getElementById('filter-alignment').value;
    const statusFilter = document.getElementById('filter-status').value;
    const search = document.getElementById('filter-search').value.toLowerCase();

    let filtered = allData.filter(s => {
      if (brandFilter && s.brand_name !== brandFilter) return false;
      if (divFilter && s.division !== divFilter) return false;
      if (alignFilter && s.alignment !== alignFilter) return false;
      if (statusFilter && s.status !== statusFilter) return false;
      if (search && !s.name.toLowerCase().includes(search)) return false;
      return true;
    });

    // Sort
    filtered.sort((a, b) => {
      let va = a[sortKey], vb = b[sortKey];
      if (va == null) va = '';
      if (vb == null) vb = '';
      if (typeof va === 'number' && typeof vb === 'number') {
        return sortAsc ? va - vb : vb - va;
      }
      va = String(va).toLowerCase();
      vb = String(vb).toLowerCase();
      return sortAsc ? va.localeCompare(vb) : vb.localeCompare(va);
    });

    const tbody = document.getElementById('roster-body');
    const count = document.querySelector('.view-header .count');
    count.textContent = `(${filtered.length})`;

    tbody.innerHTML = filtered.map(s => `
      <tr data-brand="${esc(s.brand_name || '')}" data-id="${s.id}" class="roster-row ${s.division_rank === 0 ? 'champion' : ''}">
        <td><strong><a class="entity-link" onclick="event.stopPropagation(); navigate('notes', {type:'superstars', id:${s.id}})">${esc(s.name)}</a></strong></td>
        <td>${brandBadge(s.brand_name)}</td>
        <td>${esc(s.division || '-')}</td>
        <td>${s.division_rank === 0 ? '<span style="color:var(--gold)">C</span>' : (s.division_rank === 99 ? '-' : s.division_rank)}</td>
        <td>${alignmentBadge(s.alignment)}</td>
        <td>${s.overall_rating || '-'}</td>
        <td>${s.total_matches > 0 ? `${s.wins}-${s.losses}-${s.draws}` : '-'}</td>
        <td>${s.status === 'Legend' ? '<span class="badge badge-legend">Legend</span>' : ''}</td>
      </tr>
    `).join('');
  }

  // Filter handlers
  ['filter-brand', 'filter-division', 'filter-alignment', 'filter-status'].forEach(id => {
    document.getElementById(id).addEventListener('change', renderTable);
  });
  document.getElementById('filter-search').addEventListener('input', renderTable);

  // Sort handler
  document.querySelector('#roster-table thead').addEventListener('click', (e) => {
    const th = e.target.closest('th[data-sort]');
    if (!th) return;
    const key = th.dataset.sort;
    if (sortKey === key) { sortAsc = !sortAsc; } else { sortKey = key; sortAsc = true; }
    renderTable();
  });

  // Row click navigates to notes
  document.getElementById('roster-body').addEventListener('click', (e) => {
    const row = e.target.closest('tr.roster-row');
    if (!row) return;
    navigate('notes', { type: 'superstars', id: Number(row.dataset.id) });
  });

  renderTable();
});

// Superstar Create Form
function openSuperstarCreate() {
  const html = `<form id="superstar-form">
    ${formRow(
      formField('Name', formText('name', '', {required: true, placeholder: 'Superstar name'}), {required: true}),
      formField('Brand', formSelect('brand_id', BRAND_OPTIONS, ''), {required: true})
    )}
    ${formRow(
      formField('Division', formSelect('division', DIVISION_OPTIONS, '')),
      formField('Alignment', formSelect('alignment', ALIGNMENT_OPTIONS, ''))
    )}
    ${formRow(
      formField('Overall Rating', formNumber('overall_rating', '', {min: 0, max: 100, placeholder: '0-100'})),
      formField('Weight Class', formSelect('weight_class', WEIGHT_CLASS_OPTIONS, ''))
    )}
    ${formRow(
      formField('Finisher', formText('finisher', '', {placeholder: 'Finisher move'})),
      formField('Signature', formText('signature', '', {placeholder: 'Signature move'}))
    )}
    ${formField('Hometown', formText('hometown', '', {placeholder: 'Hometown'}))}
    ${formRow(
      formField('Status', formSelect('status', STATUS_OPTIONS, 'Active')),
      formField('Custom Character', formToggle('custom_character', false))
    )}
    ${formActions('Create Superstar')}
  </form>`;
  openModal('Add Superstar', html);
  document.getElementById('superstar-form').onsubmit = async (e) => {
    e.preventDefault();
    const data = collectFormData(e.target);
    if (!data.name) return showToast('Name is required', 'error');
    try {
      const result = await api('/superstars', { method: 'POST', body: data });
      closeModal();
      showToast('Superstar created');
      navigate('notes', { type: 'superstars', id: result.id });
    } catch(err) {
      showToast(err.message, 'error');
    }
  };
}

// Superstar Edit Form
async function openSuperstarEdit(id) {
  const s = await api(`/superstars/${id}`);
  const html = `<form id="superstar-edit-form">
    ${formRow(
      formField('Name', formText('name', s.name, {required: true}), {required: true}),
      formField('Brand', formSelect('brand_id', [{value:'', label:'Unassigned'}, ...BRAND_OPTIONS], s.brand_id || ''))
    )}
    ${formRow(
      formField('Division', formSelect('division', ['', ...DIVISION_OPTIONS], s.division || '')),
      formField('Division Rank', formNumber('division_rank', s.division_rank, {min: 0, max: 99}))
    )}
    ${formRow(
      formField('Alignment', formSelect('alignment', ['', ...ALIGNMENT_OPTIONS], s.alignment || '')),
      formField('Overall Rating', formNumber('overall_rating', s.overall_rating, {min: 0, max: 100}))
    )}
    ${formRow(
      formField('Weight Class', formSelect('weight_class', ['', ...WEIGHT_CLASS_OPTIONS], s.weight_class || '')),
      formField('Hometown', formText('hometown', s.hometown))
    )}
    ${formRow(
      formField('Finisher', formText('finisher', s.finisher)),
      formField('Signature', formText('signature', s.signature))
    )}
    ${formRow(
      formField('Status', formSelect('status', STATUS_OPTIONS, s.status || 'Active')),
      formField('Custom Character', formToggle('custom_character', s.custom_character))
    )}
    ${formField('Character Background', formTextarea('character_background', s.character_background, {rows: 3}))}
    ${formField('Notes', formTextarea('notes', s.notes, {rows: 4, placeholder: 'Markdown supported'}))}
    ${formActions('Save Changes', {deleteBtn: true, deleteLabel: 'Delete'})}
  </form>`;
  openModal('Edit Superstar', html, {wide: true});
  document.getElementById('superstar-edit-form').onsubmit = async (e) => {
    e.preventDefault();
    const data = collectFormData(e.target);
    try {
      await api(`/superstars/${id}`, { method: 'PUT', body: data });
      closeModal();
      showToast('Superstar updated');
      navigate('notes', { type: 'superstars', id });
    } catch(err) {
      showToast(err.message, 'error');
    }
  };
  document.getElementById('form-delete-btn').onclick = () => {
    confirmDialog(`Are you sure you want to deactivate "${esc(s.name)}"? This will set their status to Inactive.`, async () => {
      try {
        await api(`/superstars/${id}`, { method: 'DELETE' });
        showToast('Superstar deactivated');
        navigate('roster');
      } catch(err) { showToast(err.message, 'error'); }
    }, {danger: true, confirmText: 'Deactivate', title: 'Deactivate Superstar'});
  };
}
