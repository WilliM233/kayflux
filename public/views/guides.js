registerView('guides', async (container, params) => {
  const guides = await api('/guides');
  const selectedSlug = params.slug || 'cowork-protocol';

  const categoryOrder = ['protocol', 'gm-guide', 'cco'];
  const categoryLabels = { protocol: 'PROTOCOL', 'gm-guide': 'GM GUIDES', cco: 'CCO' };

  // Group by category
  const grouped = {};
  for (const g of guides) {
    if (!grouped[g.category]) grouped[g.category] = [];
    grouped[g.category].push(g);
  }

  container.innerHTML = `
    <div class="guides-layout">
      <aside class="guides-sidebar" id="guides-sidebar">
        <button class="btn-add" onclick="openGuideCreate()" style="width:100%; margin-bottom:12px">+ Add Guide</button>
        ${categoryOrder.map(cat => {
          const items = grouped[cat];
          if (!items || items.length === 0) return '';
          return `
            <div class="category-header">${categoryLabels[cat] || cat.toUpperCase()}</div>
            ${items.map(g => {
              const brandStyle = g.brand_color ? `border-left-color: ${g.brand_color}` : '';
              return `
                <div class="guide-entry ${g.slug === selectedSlug ? 'active' : ''}"
                     data-slug="${esc(g.slug)}"
                     style="${brandStyle}">
                  ${esc(g.title)}
                </div>
              `;
            }).join('')}
          `;
        }).join('')}
      </aside>
      <div class="guides-panel" id="guides-panel">
        <div class="loading">Loading...</div>
      </div>
    </div>
  `;

  function loadGuide(slug) {
    const guide = guides.find(g => g.slug === slug) || guides[0];
    if (!guide) return;

    // Update active state
    document.querySelectorAll('.guide-entry').forEach(el => {
      el.classList.toggle('active', el.dataset.slug === slug);
    });

    const content = guide.content
      ? marked.parse(guide.content)
      : '<div class="empty-state">No content yet.</div>';
    const updated = guide.updated_at
      ? new Date(guide.updated_at + 'Z').toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
      : 'Never';

    document.getElementById('guides-panel').innerHTML = `
      <div class="guide-header">
        <div style="display:flex; align-items:center; gap:8px">
          <h2 style="flex:1; margin:0">${esc(guide.title)}</h2>
          <button class="btn btn-ghost btn-sm" onclick="openGuideEdit('${esc(guide.slug)}')">Edit</button>
        </div>
        <div style="display:flex; gap:8px; align-items:center; margin-top:4px">
          <span class="badge" style="background:var(--surface-3); color:var(--text-muted); font-size:0.7rem">
            ${esc(categoryLabels[guide.category] || guide.category)}
          </span>
          ${guide.brand_name ? brandBadge(guide.brand_name) : ''}
        </div>
        <div class="guide-updated">Last updated: ${updated}</div>
      </div>
      <div class="notes-content">
        ${content}
      </div>
    `;
  }

  // Sidebar click handler
  document.getElementById('guides-sidebar').addEventListener('click', (e) => {
    const entry = e.target.closest('.guide-entry');
    if (!entry) return;
    loadGuide(entry.dataset.slug);
  });

  loadGuide(selectedSlug);
});

// ── Guide slug helper ──
function slugify(text) {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

// ── Guide Create Modal ──
async function openGuideCreate() {
  const brands = await api('/brands');
  const brandOptions = brands.map(b => ({ value: b.id, label: b.name }));

  openModal('Add Guide', `
    <form id="guide-create-form">
      ${formField('Title', formText('title', '', { required: true }), { required: true })}
      ${formField('Slug', formText('slug', '', { required: true, placeholder: 'auto-generated from title' }), { required: true })}
      ${formField('Category', formSelect('category', GUIDE_CATEGORY_OPTIONS, '', { required: true }), { required: true })}
      ${formField('Brand', formSelect('brand_id', brandOptions, ''))}
      ${formField('Content', formTextarea('content', '', { rows: 10, placeholder: 'Markdown content...' }))}
      ${formField('Sort Order', formNumber('sort_order', 10))}
      ${formActions('Create')}
    </form>
  `);

  // Auto-generate slug from title
  const titleInput = document.querySelector('#guide-create-form input[name="title"]');
  const slugInput = document.querySelector('#guide-create-form input[name="slug"]');
  titleInput.addEventListener('input', () => {
    slugInput.value = slugify(titleInput.value);
  });

  document.getElementById('guide-create-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const data = collectFormData(e.target);
    if (data.sort_order) data.sort_order = Number(data.sort_order);
    if (data.brand_id) data.brand_id = Number(data.brand_id);
    else delete data.brand_id;
    try {
      await api('/guides', { method: 'POST', body: data });
      closeModal();
      showToast('Guide created');
      navigate('guides', { slug: data.slug });
    } catch (err) {
      showToast(err.message || 'Failed to create guide', 'error');
    }
  });
}

// ── Guide Edit Modal ──
async function openGuideEdit(slug) {
  const [guide, brands] = await Promise.all([
    api(`/guides/${slug}`),
    api('/brands'),
  ]);
  const brandOptions = brands.map(b => ({ value: b.id, label: b.name }));

  openModal('Edit Guide', `
    <form id="guide-edit-form">
      ${formField('Title', formText('title', guide.title, { required: true }), { required: true })}
      ${formField('Category', formSelect('category', GUIDE_CATEGORY_OPTIONS, guide.category, { required: true }), { required: true })}
      ${formField('Brand', formSelect('brand_id', brandOptions, guide.brand_id || ''))}
      ${formField('Content', formTextarea('content', guide.content || '', { rows: 10, placeholder: 'Markdown content...' }))}
      ${formField('Sort Order', formNumber('sort_order', guide.sort_order != null ? guide.sort_order : 10))}
      ${formActions('Save', { deleteBtn: true, deleteLabel: 'Delete Guide' })}
    </form>
  `);

  document.getElementById('guide-edit-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const data = collectFormData(e.target);
    if (data.sort_order) data.sort_order = Number(data.sort_order);
    if (data.brand_id) data.brand_id = Number(data.brand_id);
    else delete data.brand_id;
    try {
      await api(`/guides/${slug}`, { method: 'PUT', body: data });
      closeModal();
      showToast('Guide updated');
      navigate('guides', { slug });
    } catch (err) {
      showToast(err.message || 'Failed to update guide', 'error');
    }
  });

  document.getElementById('form-delete-btn').addEventListener('click', async () => {
    if (!confirm('Delete this guide permanently?')) return;
    try {
      await api(`/guides/${slug}`, { method: 'DELETE' });
      closeModal();
      showToast('Guide deleted');
      navigate('guides');
    } catch (err) {
      showToast(err.message || 'Failed to delete guide', 'error');
    }
  });
}
