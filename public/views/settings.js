// Settings View — Seasons & Show Templates management

registerView('settings', async (container) => {
  const [seasons, templates] = await Promise.all([
    api('/seasons'),
    api('/show-templates')
  ]);

  const showTypes = ['Weekly', 'PPV', 'Special', 'Draft'];

  function renderTemplatesTable(filterType) {
    const filtered = filterType
      ? templates.filter(t => t.show_type === filterType)
      : templates;

    return filtered.map(t => `<tr>
      <td>${esc(t.name)}</td>
      <td>${t.brand_name ? brandBadge(t.brand_name) : ''}</td>
      <td>${esc(t.show_type || '')}</td>
      <td>
        <button class="btn btn-ghost btn-sm" onclick="openTemplateEdit(${t.id})">Edit</button>
        <button class="btn btn-ghost btn-sm btn-danger" onclick="deleteTemplate(${t.id}, '${esc(t.name)}')">Delete</button>
      </td>
    </tr>`).join('');
  }

  container.innerHTML = `
    <div class="view-header">
      <h2>Settings</h2>
    </div>

    <!-- SEASONS SECTION -->
    <div style="margin-bottom:32px">
      <div style="display:flex;align-items:center;gap:12px;margin-bottom:12px">
        <h3 style="margin:0;color:var(--text-muted);font-size:0.95rem">Seasons</h3>
        <button class="btn-add" onclick="openSeasonCreate()">+ Add Season</button>
      </div>
      <table class="data-table">
        <thead><tr>
          <th>Name</th>
          <th>Status</th>
          <th>Actions</th>
        </tr></thead>
        <tbody>
          ${seasons.map(s => `<tr>
            <td>${esc(s.name)}</td>
            <td>${s.is_current ? '<span class="badge badge-active">Current</span>' : ''}</td>
            <td>
              <button class="btn btn-ghost btn-sm" onclick="openSeasonEdit(${s.id})">Edit</button>
            </td>
          </tr>`).join('')}
        </tbody>
      </table>
    </div>

    <!-- SHOW TEMPLATES SECTION -->
    <div>
      <div style="display:flex;align-items:center;gap:12px;margin-bottom:12px">
        <h3 style="margin:0;color:var(--text-muted);font-size:0.95rem">Show Templates (${templates.length})</h3>
        <button class="btn-add" onclick="openTemplateCreate()">+ Add Template</button>
      </div>
      <div class="filters" style="margin-bottom:12px">
        <select id="filter-template-type" onchange="filterTemplates()">
          <option value="">All Types</option>
          ${showTypes.map(t => `<option value="${t}">${t}</option>`).join('')}
        </select>
      </div>
      <table class="data-table" id="templates-table">
        <thead><tr>
          <th>Name</th>
          <th>Brand</th>
          <th>Show Type</th>
          <th>Actions</th>
        </tr></thead>
        <tbody id="templates-tbody">
          ${renderTemplatesTable('')}
        </tbody>
      </table>
    </div>
  `;

  // Expose filter function
  window.filterTemplates = () => {
    const type = document.getElementById('filter-template-type').value;
    document.getElementById('templates-tbody').innerHTML = renderTemplatesTable(type);
  };
});

// --- Season modals ---

window.openSeasonCreate = function () {
  const html = `
    <form id="season-form">
      ${formField('Name', formText('name', '', { required: true, placeholder: 'e.g. Season 2' }), { required: true })}
      ${formField('Current Season', formToggle('is_current', false))}
      ${formActions('Create Season')}
    </form>
  `;
  openModal('New Season', html);
  document.getElementById('season-form').onsubmit = async (e) => {
    e.preventDefault();
    const data = collectFormData(e.target);
    try {
      await api('/seasons', { method: 'POST', body: data });
      closeModal();
      showToast('Season created');
      navigate('settings');
    } catch (err) {
      showToast(err.message, 'error');
    }
  };
};

window.openSeasonEdit = async function (id) {
  try {
    const season = await api(`/seasons/${id}`);
    const html = `
      <form id="season-form">
        ${formField('Name', formText('name', season.name, { required: true }), { required: true })}
        ${formField('Current Season', formToggle('is_current', season.is_current))}
        ${formActions('Save Changes')}
      </form>
    `;
    openModal('Edit Season', html);
    document.getElementById('season-form').onsubmit = async (e) => {
      e.preventDefault();
      const data = collectFormData(e.target);
      try {
        await api(`/seasons/${id}`, { method: 'PUT', body: data });
        closeModal();
        showToast('Season updated');
        navigate('settings');
      } catch (err) {
        showToast(err.message, 'error');
      }
    };
  } catch (err) {
    showToast(err.message, 'error');
  }
};

// --- Show Template modals ---

window.openTemplateCreate = function () {
  const showTypeOptions = ['Weekly', 'PPV', 'Special', 'Draft'];
  const html = `
    <form id="template-form">
      ${formField('Name', formText('name', '', { required: true, placeholder: 'e.g. Monday Night Raw' }), { required: true })}
      ${formRow(
        formField('Brand', formSelect('brand_id', BRAND_OPTIONS, ''), { half: true }),
        formField('Show Type', formSelect('show_type', showTypeOptions, '', { required: true }), { half: true, required: true })
      )}
      ${formField('Description', formTextarea('description', '', { placeholder: 'Optional description', rows: 3 }))}
      ${formActions('Create Template')}
    </form>
  `;
  openModal('New Show Template', html);
  document.getElementById('template-form').onsubmit = async (e) => {
    e.preventDefault();
    const data = collectFormData(e.target);
    try {
      await api('/show-templates', { method: 'POST', body: data });
      closeModal();
      showToast('Template created');
      navigate('settings');
    } catch (err) {
      showToast(err.message, 'error');
    }
  };
};

window.openTemplateEdit = async function (id) {
  try {
    const template = await api(`/show-templates/${id}`);
    const showTypeOptions = ['Weekly', 'PPV', 'Special', 'Draft'];
    const html = `
      <form id="template-form">
        ${formField('Name', formText('name', template.name, { required: true }), { required: true })}
        ${formRow(
          formField('Brand', formSelect('brand_id', BRAND_OPTIONS, template.brand_id || ''), { half: true }),
          formField('Show Type', formSelect('show_type', showTypeOptions, template.show_type || '', { required: true }), { half: true, required: true })
        )}
        ${formField('Description', formTextarea('description', template.description || '', { placeholder: 'Optional description', rows: 3 }))}
        ${formActions('Save Changes', { deleteBtn: true, deleteLabel: 'Delete Template' })}
      </form>
    `;
    openModal('Edit Show Template', html);
    document.getElementById('template-form').onsubmit = async (e) => {
      e.preventDefault();
      const data = collectFormData(e.target);
      try {
        await api(`/show-templates/${id}`, { method: 'PUT', body: data });
        closeModal();
        showToast('Template updated');
        navigate('settings');
      } catch (err) {
        showToast(err.message, 'error');
      }
    };
    document.getElementById('form-delete-btn').onclick = () => {
      deleteTemplate(id, template.name);
    };
  } catch (err) {
    showToast(err.message, 'error');
  }
};

window.deleteTemplate = function (id, name) {
  confirmDialog(
    `Delete template "${name}"? Events that already use this template won't be affected.`,
    async () => {
      try {
        await api(`/show-templates/${id}`, { method: 'DELETE' });
        showToast('Template deleted');
        navigate('settings');
      } catch (err) {
        showToast(err.message, 'error');
      }
    },
    { danger: true, confirmText: 'Delete', title: 'Delete Template' }
  );
};
