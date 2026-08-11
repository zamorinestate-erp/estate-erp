// =============================================================================
// PAGE: Vendors — API-wired
// GET /api/v1/vendors        — list all vendors
// POST /api/v1/vendors       — create vendor (MASTER only)
// POST /api/v1/vendors/:id/status — activate / deactivate
// =============================================================================
import { apiGet, apiPost, apiPatch } from '../apiClient.js';
import { showToast, skeleton, confirmAction } from '../components.js';
import { state } from '../state.js';
import { ROLES } from '../navigation.js';

const isMaster = () => state.role === ROLES.MASTER;

function statusPill(status) {
  const active = status === 'ACTIVE';
  return `<span class="pill ${active ? 'pill-mint' : 'pill-dark'}" style="font-size:10px;">${status || 'ACTIVE'}</span>`;
}

function vendorRow(v) {
  return `
    <tr data-vendor-id="${v.vendorId}">
      <td><strong>${v.name}</strong></td>
      <td class="muted-white">${v.contactName || '—'}</td>
      <td class="muted-white">${v.phone || '—'}</td>
      <td>${statusPill(v.status)}</td>
      ${isMaster() ? `<td>
        <button class="btn btn-ghost" style="padding:5px 10px;font-size:11px;" data-toggle-status="${v.vendorId}" data-current-status="${v.status}">
          ${v.status === 'ACTIVE' ? 'Deactivate' : 'Activate'}
        </button>
      </td>` : '<td></td>'}
    </tr>`;
}

export function renderVendors() {
  return `
    <div class="page-enter">
      <div class="flex justify-between items-center" style="margin-bottom:18px;">
        <div>
          <div style="color:#fff;font-size:22px;font-weight:700;" class="font-display">Vendors</div>
          <div class="muted-white" style="font-size:13.5px;">Supplier directory</div>
        </div>
        ${isMaster() ? `<button class="btn btn-primary" id="add-vendor-btn" style="padding:10px 18px;">+ Add Vendor</button>` : ''}
      </div>
      <div class="glass" style="padding:20px;">
        <div id="vendor-table-wrap">${skeleton('220px')}</div>
      </div>
      <!-- Add Vendor Form (hidden) -->
      <div id="vendor-form-wrap" style="display:none;" class="glass" style="padding:20px;margin-top:16px;">
        <div style="color:#fff;font-weight:600;font-size:15px;margin-bottom:14px;">New Vendor</div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:14px;">
          <div><div class="muted-white" style="font-size:11px;margin-bottom:4px;">Vendor Name *</div>
            <input id="vnd-name" type="text" class="glass-input" placeholder="e.g. Fresh Farm Supplies" style="width:100%;"/></div>
          <div><div class="muted-white" style="font-size:11px;margin-bottom:4px;">Contact Name</div>
            <input id="vnd-contact" type="text" class="glass-input" placeholder="Primary contact" style="width:100%;"/></div>
          <div><div class="muted-white" style="font-size:11px;margin-bottom:4px;">Phone</div>
            <input id="vnd-phone" type="text" class="glass-input" placeholder="+91..." style="width:100%;"/></div>
          <div><div class="muted-white" style="font-size:11px;margin-bottom:4px;">Category</div>
            <input id="vnd-category" type="text" class="glass-input" placeholder="e.g. Dairy, Produce" style="width:100%;"/></div>
        </div>
        <div class="flex gap-sm">
          <button class="btn btn-primary" id="save-vendor-btn" style="padding:9px 16px;">Save Vendor</button>
          <button class="btn btn-ghost" id="cancel-vendor-btn" style="padding:9px 16px;">Cancel</button>
        </div>
      </div>
    </div>`;
}

export async function wireVendors(root) {
  await loadVendors(root);

  root.querySelector('#add-vendor-btn')?.addEventListener('click', () => {
    const wrap = root.querySelector('#vendor-form-wrap');
    if (wrap) { wrap.style.display = wrap.style.display === 'none' ? 'block' : 'none'; }
  });

  root.querySelector('#cancel-vendor-btn')?.addEventListener('click', () => {
    const wrap = root.querySelector('#vendor-form-wrap');
    if (wrap) wrap.style.display = 'none';
  });

  root.querySelector('#save-vendor-btn')?.addEventListener('click', () => saveVendor(root));
}

async function loadVendors(root) {
  const wrap = root.querySelector('#vendor-table-wrap');
  try {
    const res = await apiGet('/vendors');
    const vendors = res?.data?.vendors || res?.data || [];
    if (!vendors.length) {
      wrap.innerHTML = `<div class="empty-state"><div class="empty-state-title">No vendors yet</div><div>Add your first vendor to begin tracking suppliers.</div></div>`;
      return;
    }
    wrap.innerHTML = `<table class="glass-table">
      <thead><tr><th>Name</th><th>Contact</th><th>Phone</th><th>Status</th><th></th></tr></thead>
      <tbody>${vendors.map(vendorRow).join('')}</tbody>
    </table>`;
    root.querySelectorAll('[data-toggle-status]').forEach(btn => {
      btn.addEventListener('click', () => toggleStatus(root, btn.dataset.toggleStatus, btn.dataset.currentStatus));
    });
  } catch (err) {
    wrap.innerHTML = `<div class="muted-white" style="padding:16px;">Failed to load vendors — ${err.message || 'error'}.</div>`;
  }
}

async function saveVendor(root) {
  const name = root.querySelector('#vnd-name')?.value?.trim();
  if (!name) { showToast('Vendor name is required', 'coral'); return; }
  try {
    await apiPost('/vendors', { body: {
      name,
      contactName: root.querySelector('#vnd-contact')?.value?.trim() || undefined,
      phone: root.querySelector('#vnd-phone')?.value?.trim() || undefined,
      category: root.querySelector('#vnd-category')?.value?.trim() || undefined,
    }});
    showToast('Vendor created', 'mint');
    root.querySelector('#vendor-form-wrap').style.display = 'none';
    await loadVendors(root);
  } catch (err) { showToast(err.message || 'Failed to create vendor', 'coral'); }
}

async function toggleStatus(root, vendorId, currentStatus) {
  const newStatus = currentStatus === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
  try {
    await apiPost(`/vendors/${vendorId}/status`, { body: { status: newStatus } });
    showToast(`Vendor ${newStatus.toLowerCase()}`, 'mint');
    await loadVendors(root);
  } catch (err) { showToast(err.message || 'Failed to update status', 'coral'); }
}
