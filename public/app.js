// WWE Universe Manager — SPA Router & Utilities

const views = {};
let currentView = null;

function registerView(name, renderFn) {
  views[name] = renderFn;
}

function navigate(viewName, params = {}) {
  const app = document.getElementById('app');
  app.innerHTML = '<div class="loading">Loading...</div>';
  currentView = viewName;

  // Update nav
  document.querySelectorAll('#main-nav button').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.view === viewName);
  });

  if (views[viewName]) {
    views[viewName](app, params);
  } else {
    app.innerHTML = `<div class="empty-state">View "${viewName}" not implemented yet.</div>`;
  }
}

// API helper
async function api(endpoint, options = {}) {
  const config = {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  };
  if (options.body && typeof options.body === 'object') {
    config.body = JSON.stringify(options.body);
  }
  const res = await fetch(`/api${endpoint}`, config);
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || `API error: ${res.status}`);
  }
  return res.json();
}

// Utility: brand badge (clickable — navigates to brand hub)
function brandBadge(brandName) {
  if (!brandName) return '';
  const cls = brandName.toLowerCase().replace(/[\s-]/g, '');
  const map = { raw: 'badge-raw', smackdown: 'badge-smackdown', nxt: 'badge-nxt', crossbrand: 'badge-crossbrand' };
  const idMap = { raw: 3, smackdown: 1, nxt: 2 };
  const brandId = idMap[cls];
  if (brandId) {
    return `<span class="badge ${map[cls] || ''} brand-link" onclick="event.stopPropagation(); navigate('brand-hub', {brandId:${brandId}})">${brandName}</span>`;
  }
  return `<span class="badge ${map[cls] || ''}">${brandName}</span>`;
}

// Utility: status badge
function statusBadge(status) {
  if (!status) return '';
  const cls = status.toLowerCase().replace(/\s+/g, '-');
  return `<span class="badge badge-${cls}">${status}</span>`;
}

// Utility: alignment badge
function alignmentBadge(alignment) {
  if (!alignment) return '';
  const cls = alignment.toLowerCase();
  return `<span class="badge badge-${cls}">${alignment}</span>`;
}

// Utility: star rating
function starRating(rating) {
  if (!rating) return '';
  return '<span class="stars">' + '\u2605'.repeat(rating) + '\u2606'.repeat(5 - rating) + '</span>';
}

// Utility: team type badge
function teamTypeBadge(type) {
  if (!type) return '';
  const map = { 'Tag Team': 'badge-tag', 'Stable': 'badge-stable', 'Mixed Tag': 'badge-mixed' };
  return `<span class="badge ${map[type] || ''}">${type}</span>`;
}

// Utility: escape HTML
function esc(str) {
  if (!str) return '';
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// ============================================================
// MODAL SYSTEM
// ============================================================
function openModal(title, contentHtml, options = {}) {
  closeModal(); // close any existing
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `
    <div class="modal ${options.wide ? 'modal-wide' : ''}">
      <div class="modal-header">
        <h3>${esc(title)}</h3>
        <button class="modal-close" onclick="closeModal()">&times;</button>
      </div>
      <div class="modal-body">${contentHtml}</div>
    </div>
  `;
  document.body.appendChild(overlay);
  requestAnimationFrame(() => overlay.classList.add('open'));
  overlay.addEventListener('click', (e) => { if (e.target === overlay) closeModal(); });
  document.addEventListener('keydown', _modalEscHandler);
  // Focus first input
  const firstInput = overlay.querySelector('input, select, textarea');
  if (firstInput) setTimeout(() => firstInput.focus(), 50);
  return overlay;
}

function closeModal() {
  document.removeEventListener('keydown', _modalEscHandler);
  const overlay = document.querySelector('.modal-overlay');
  if (overlay) {
    overlay.classList.remove('open');
    setTimeout(() => overlay.remove(), 150);
  }
}

function _modalEscHandler(e) { if (e.key === 'Escape') closeModal(); }

// ============================================================
// CONFIRMATION DIALOG
// ============================================================
function confirmDialog(message, onConfirm, options = {}) {
  const html = `
    <p style="margin-bottom:16px;color:var(--text-muted);font-size:0.9rem">${message}</p>
    <div class="form-actions">
      <button class="btn btn-ghost" onclick="closeModal()">Cancel</button>
      <button class="btn ${options.danger ? 'btn-danger' : ''}" id="confirm-action-btn">${options.confirmText || 'Confirm'}</button>
    </div>
  `;
  openModal(options.title || 'Confirm', html);
  document.getElementById('confirm-action-btn').onclick = () => { closeModal(); onConfirm(); };
}

// ============================================================
// TOAST NOTIFICATIONS
// ============================================================
function showToast(message, type = 'success') {
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.textContent = message;
  let container = document.querySelector('.toast-container');
  if (!container) {
    container = document.createElement('div');
    container.className = 'toast-container';
    document.body.appendChild(container);
  }
  container.appendChild(toast);
  requestAnimationFrame(() => toast.classList.add('show'));
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

// ============================================================
// FORM BUILDER HELPERS
// ============================================================
function formField(label, inputHtml, options = {}) {
  return `<div class="form-group ${options.half ? 'form-group-half' : ''} ${options.cls || ''}">
    <label class="form-label">${esc(label)}${options.required ? ' <span class="required">*</span>' : ''}</label>
    ${inputHtml}
  </div>`;
}

function formText(name, value, options = {}) {
  return `<input type="text" name="${name}" value="${esc(value || '')}" class="form-input"
    ${options.required ? 'required' : ''} ${options.placeholder ? `placeholder="${esc(options.placeholder)}"` : ''}>`;
}

function formNumber(name, value, options = {}) {
  return `<input type="number" name="${name}" value="${value != null ? value : ''}" class="form-input"
    ${options.min != null ? `min="${options.min}"` : ''} ${options.max != null ? `max="${options.max}"` : ''}
    ${options.placeholder ? `placeholder="${esc(options.placeholder)}"` : ''}>`;
}

function formSelect(name, options, selectedVal, opts = {}) {
  let html = `<select name="${name}" class="form-input" ${opts.required ? 'required' : ''}>`;
  if (!opts.noEmpty) html += `<option value="">${opts.emptyLabel || '— Select —'}</option>`;
  for (const opt of options) {
    const val = typeof opt === 'object' ? opt.value : opt;
    const label = typeof opt === 'object' ? opt.label : opt;
    html += `<option value="${esc(String(val))}" ${String(val) === String(selectedVal) ? 'selected' : ''}>${esc(label)}</option>`;
  }
  html += '</select>';
  return html;
}

function formTextarea(name, value, options = {}) {
  return `<textarea name="${name}" class="form-input form-textarea" rows="${options.rows || 4}"
    ${options.placeholder ? `placeholder="${esc(options.placeholder)}"` : ''}>${esc(value || '')}</textarea>`;
}

function formToggle(name, checked) {
  return `<label class="form-toggle">
    <input type="checkbox" name="${name}" ${checked ? 'checked' : ''}>
    <span class="form-toggle-slider"></span>
  </label>`;
}

function formDate(name, value) {
  return `<input type="date" name="${name}" value="${esc(value || '')}" class="form-input">`;
}

function formRow(...fields) {
  return `<div class="form-row">${fields.join('')}</div>`;
}

function formActions(saveLabel = 'Save', options = {}) {
  return `<div class="form-actions">
    <button type="button" class="btn btn-ghost" onclick="closeModal()">Cancel</button>
    ${options.deleteBtn ? `<button type="button" class="btn btn-danger btn-sm" id="form-delete-btn">${options.deleteLabel || 'Delete'}</button>` : ''}
    <button type="submit" class="btn">${esc(saveLabel)}</button>
  </div>`;
}

// Collect form data from a modal or container
function collectFormData(container) {
  const data = {};
  container.querySelectorAll('input, select, textarea').forEach(el => {
    if (!el.name) return;
    if (el.type === 'checkbox') {
      data[el.name] = el.checked ? 1 : 0;
    } else if (el.type === 'number') {
      data[el.name] = el.value !== '' ? Number(el.value) : null;
    } else {
      data[el.name] = el.value || null;
    }
  });
  return data;
}

// Searchable superstar dropdown
function superstarSearchDropdown(name, selectedId, options = {}) {
  const id = `ss-search-${name}-${Date.now()}`;
  return `<div class="ss-dropdown" id="${id}" data-name="${name}" data-selected="${selectedId || ''}">
    <input type="text" class="form-input ss-search-input" placeholder="${options.placeholder || 'Search superstars...'}"
      autocomplete="off" data-dropdown="${id}">
    <input type="hidden" name="${name}" value="${selectedId || ''}">
    <div class="ss-results"></div>
  </div>`;
}

// Wire up superstar search dropdown (call after DOM insert)
async function wireSuperstarDropdowns(container) {
  const dropdowns = container.querySelectorAll('.ss-dropdown');
  if (dropdowns.length === 0) return;

  // Fetch superstars once
  let superstars;
  try {
    superstars = await api('/superstars?status=Active&limit=300');
  } catch(e) {
    superstars = [];
  }

  for (const dropdown of dropdowns) {
    const input = dropdown.querySelector('.ss-search-input');
    const hidden = dropdown.querySelector('input[type="hidden"]');
    const results = dropdown.querySelector('.ss-results');

    // If pre-selected, show name
    if (hidden.value) {
      const selected = superstars.find(s => String(s.id) === String(hidden.value));
      if (selected) input.value = selected.name;
    }

    let debounce;
    input.addEventListener('input', () => {
      clearTimeout(debounce);
      debounce = setTimeout(() => {
        const q = input.value.toLowerCase().trim();
        if (!q) { results.innerHTML = ''; results.style.display = 'none'; return; }
        const filtered = superstars.filter(s => s.name.toLowerCase().includes(q)).slice(0, 15);
        if (filtered.length === 0) {
          results.innerHTML = '<div class="ss-no-results">No results</div>';
        } else {
          results.innerHTML = filtered.map(s => `
            <div class="ss-result-item" data-id="${s.id}" data-name="${esc(s.name)}">
              <span>${esc(s.name)}</span>
              ${s.brand_name ? `<span class="ss-result-brand">${esc(s.brand_name)}</span>` : ''}
            </div>
          `).join('');
        }
        results.style.display = 'block';
      }, 150);
    });

    results.addEventListener('click', (e) => {
      const item = e.target.closest('.ss-result-item');
      if (item) {
        hidden.value = item.dataset.id;
        input.value = item.dataset.name;
        results.style.display = 'none';
      }
    });

    input.addEventListener('focus', () => {
      if (input.value.trim()) input.dispatchEvent(new Event('input'));
    });

    document.addEventListener('click', (e) => {
      if (!dropdown.contains(e.target)) results.style.display = 'none';
    });
  }
}

// Multi-select superstar picker for participants
function superstarMultiPicker(name, selectedIds = [], options = {}) {
  const id = `ss-multi-${name}-${Date.now()}`;
  const chipHtml = selectedIds.map(s => `
    <div class="ss-chip" data-id="${s.id}">
      ${esc(s.name)} ${options.showTeam ? `<select class="ss-chip-team" data-id="${s.id}"><option value="1">Team 1</option><option value="2">Team 2</option></select>` : ''}
      ${options.showRole ? `<select class="ss-chip-role" data-id="${s.id}"><option value="member">Member</option><option value="manager">Manager</option><option value="leader">Leader</option><option value="champion">Champion</option><option value="challenger">Challenger</option></select>` : ''}
      <button class="ss-chip-remove" data-id="${s.id}">&times;</button>
    </div>
  `).join('');
  return `<div class="ss-multi" id="${id}" data-name="${name}">
    <div class="ss-chips">${chipHtml}</div>
    <input type="text" class="form-input ss-search-input" placeholder="${options.placeholder || 'Add superstar...'}" autocomplete="off">
    <div class="ss-results"></div>
  </div>`;
}

// Wire up multi-picker
async function wireMultiPickers(container, callback) {
  const pickers = container.querySelectorAll('.ss-multi');
  if (pickers.length === 0) return;
  let superstars;
  try { superstars = await api('/superstars?status=Active&limit=300'); } catch(e) { superstars = []; }

  for (const picker of pickers) {
    const input = picker.querySelector('.ss-search-input');
    const results = picker.querySelector('.ss-results');
    const chips = picker.querySelector('.ss-chips');

    const getSelectedIds = () => Array.from(chips.querySelectorAll('.ss-chip')).map(c => c.dataset.id);

    let debounce;
    input.addEventListener('input', () => {
      clearTimeout(debounce);
      debounce = setTimeout(() => {
        const q = input.value.toLowerCase().trim();
        if (!q) { results.innerHTML = ''; results.style.display = 'none'; return; }
        const selected = getSelectedIds();
        const filtered = superstars.filter(s => s.name.toLowerCase().includes(q) && !selected.includes(String(s.id))).slice(0, 10);
        results.innerHTML = filtered.length === 0 ? '<div class="ss-no-results">No results</div>' :
          filtered.map(s => `<div class="ss-result-item" data-id="${s.id}" data-name="${esc(s.name)}">
            <span>${esc(s.name)}</span>${s.brand_name ? `<span class="ss-result-brand">${esc(s.brand_name)}</span>` : ''}
          </div>`).join('');
        results.style.display = 'block';
      }, 150);
    });

    results.addEventListener('click', (e) => {
      const item = e.target.closest('.ss-result-item');
      if (item) {
        const chip = document.createElement('div');
        chip.className = 'ss-chip';
        chip.dataset.id = item.dataset.id;
        chip.innerHTML = `${esc(item.dataset.name)} <button class="ss-chip-remove" data-id="${item.dataset.id}">&times;</button>`;
        chips.appendChild(chip);
        input.value = '';
        results.style.display = 'none';
        if (callback) callback(picker);
      }
    });

    chips.addEventListener('click', (e) => {
      if (e.target.classList.contains('ss-chip-remove')) {
        e.target.closest('.ss-chip').remove();
        if (callback) callback(picker);
      }
    });

    document.addEventListener('click', (e) => {
      if (!picker.contains(e.target)) results.style.display = 'none';
    });
  }
}

// Get selected IDs from multi-picker
function getMultiPickerIds(picker) {
  return Array.from(picker.querySelectorAll('.ss-chip')).map(c => ({
    superstar_id: parseInt(c.dataset.id),
    team_number: c.querySelector('.ss-chip-team') ? parseInt(c.querySelector('.ss-chip-team').value) : undefined,
    role: c.querySelector('.ss-chip-role') ? c.querySelector('.ss-chip-role').value : undefined
  }));
}

// Common brand/division option arrays
const BRAND_OPTIONS = [
  { value: '3', label: 'Raw' },
  { value: '1', label: 'SmackDown' },
  { value: '2', label: 'NXT' },
  { value: '4', label: 'Cross-Brand' }
];

const DIVISION_OPTIONS = [
  "Men's World", "Men's Midcard", "Men's Tag",
  "Women's World", "Women's Midcard", "Women's Tag"
];

const ALIGNMENT_OPTIONS = ['Face', 'Heel', 'Tweener'];

const STATUS_OPTIONS = ['Active', 'Inactive', 'Injured', 'Legend'];

const EVENT_TYPE_OPTIONS = ['Weekly Show', 'PPV', 'Special Event', 'Draft'];

const EVENT_STATUS_OPTIONS = ['Upcoming', 'In Progress', 'Completed'];

const MATCH_TYPE_OPTIONS = ['Singles', 'Tag Team', 'Triple Threat', 'Fatal 4-Way', '6-Man Tag', '8-Man Tag',
  'Battle Royal', 'Royal Rumble', 'Ladder', 'TLC', 'Hell in a Cell', 'Cage', 'Iron Man', 'I Quit',
  'Last Man Standing', 'Elimination Chamber', 'Money in the Bank'];

const MATCH_POSITION_OPTIONS = ['Pre-Show', 'Opening', 'Midcard', 'Co-Main Event', 'Main Event'];

const WIN_METHOD_OPTIONS = ['Pinfall', 'Submission', 'DQ', 'Count-Out', 'KO', 'Forfeit', 'No Contest', 'Interference', 'Other'];

const RIVALRY_STATUS_OPTIONS = ['Pending', 'Building', 'Active', 'Climax', 'Resolved', 'Concluded'];

const INTENSITY_OPTIONS = ['Low', 'Medium', 'High', 'Very High'];

const RIVALRY_TYPE_OPTIONS = ['1v1', 'Tag', 'Faction', 'Championship'];

const WEIGHT_CLASS_OPTIONS = ['Cruiserweight', 'Light Heavyweight', 'Heavyweight', 'Super Heavyweight'];

const ENTRY_TYPE_OPTIONS = [
  { value: 'gm_notes', label: 'GM Notes' },
  { value: 'booking_decision', label: 'Booking Decision' },
  { value: 'storyline_update', label: 'Storyline Update' },
  { value: 'locker_room', label: 'Locker Room' },
  { value: 'cco_mandate', label: 'CCO Mandate' },
  { value: 'results_summary', label: 'Results Summary' },
  { value: 'callup_watch', label: 'Call-Up Watch' }
];

const GUIDE_CATEGORY_OPTIONS = [
  { value: 'protocol', label: 'Protocol' },
  { value: 'cco', label: 'CCO' },
  { value: 'gm-guide', label: 'GM Guide' },
  { value: 'reference', label: 'Reference' }
];

// Nav click handler
document.getElementById('main-nav').addEventListener('click', (e) => {
  if (e.target.dataset.view) {
    navigate(e.target.dataset.view);
  }
});

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  navigate('cco-hub');
});
