// =============================================================================
// PAGE: Menu Management — API-wired
// GET  /api/v1/menu/items   — list all menu items (all roles)
// POST /api/v1/menu/items   — create item (MASTER only)
// =============================================================================
import { apiGet, apiPost } from '../apiClient.js';
import { showToast, skeleton } from '../components.js';
import { state } from '../state.js';
import { ROLES } from '../navigation.js';

const isMaster = () => state.role === ROLES.MASTER;

function availabilityPill(avail) {
  return avail
    ? `<span class="pill pill-mint" style="font-size:10px;">Available</span>`
    : `<span class="pill pill-dark" style="font-size:10px;">Unavailable</span>`;
}

function menuRow(item) {
  return `
    <tr>
      <td><strong>${item.name}</strong></td>
      <td class="muted-white">${item.category || '—'}</td>
      <td>₹${((item.priceInPaisa || item.price || 0) / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
      <td>${availabilityPill(item.isAvailable !== false)}</td>
      <td class="muted-white" style="font-size:11px;">${item.tags?.join(', ') || '—'}</td>
    </tr>`;
}

export function renderMenuManagement() {
  return `
    <div class="page-enter">
      <div class="flex justify-between items-center" style="margin-bottom:18px;">
        <div>
          <div style="color:#fff;font-size:22px;font-weight:700;" class="font-display">Menu Management</div>
          <div class="muted-white" style="font-size:13.5px;">All items served across cafes</div>
        </div>
        ${isMaster() ? `<button class="btn btn-primary" id="add-item-btn" style="padding:10px 18px;">+ Add Item</button>` : ''}
      </div>
      <div class="glass" style="padding:20px;">
        <div id="menu-table-wrap">${skeleton('220px')}</div>
      </div>
      <div id="menu-form-wrap" class="glass" style="padding:20px;margin-top:16px;display:none;">
        <div style="color:#fff;font-weight:600;font-size:15px;margin-bottom:14px;">New Menu Item</div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:14px;">
          <div><div class="muted-white" style="font-size:11px;margin-bottom:4px;">Item Name *</div>
            <input id="mn-name" type="text" class="glass-input" placeholder="e.g. Masala Chai" style="width:100%;"/></div>
          <div><div class="muted-white" style="font-size:11px;margin-bottom:4px;">Category</div>
            <input id="mn-cat" type="text" class="glass-input" placeholder="e.g. Beverages" style="width:100%;"/></div>
          <div><div class="muted-white" style="font-size:11px;margin-bottom:4px;">Price (₹)</div>
            <input id="mn-price" type="number" min="0" step="0.50" class="glass-input" placeholder="e.g. 60" style="width:100%;"/></div>
          <div><div class="muted-white" style="font-size:11px;margin-bottom:4px;">Tags (comma-separated)</div>
            <input id="mn-tags" type="text" class="glass-input" placeholder="hot, veg, bestseller" style="width:100%;"/></div>
        </div>
        <div class="flex gap-sm">
          <button class="btn btn-primary" id="save-item-btn" style="padding:9px 16px;">Save Item</button>
          <button class="btn btn-ghost" id="cancel-item-btn" style="padding:9px 16px;">Cancel</button>
        </div>
      </div>
    </div>`;
}

export async function wireMenuManagement(root) {
  await loadMenu(root);
  root.querySelector('#add-item-btn')?.addEventListener('click', () => {
    const wrap = root.querySelector('#menu-form-wrap');
    if (wrap) wrap.style.display = wrap.style.display === 'none' ? 'block' : 'none';
  });
  root.querySelector('#cancel-item-btn')?.addEventListener('click', () => {
    root.querySelector('#menu-form-wrap').style.display = 'none';
  });
  root.querySelector('#save-item-btn')?.addEventListener('click', () => saveItem(root));
}

async function loadMenu(root) {
  const wrap = root.querySelector('#menu-table-wrap');
  try {
    const res = await apiGet('/menu/items');
    const items = res?.data?.items || res?.data || [];
    if (!items.length) {
      wrap.innerHTML = `<div class="empty-state"><div class="empty-state-title">No menu items yet</div><div>Add items to build your cafe menu.</div></div>`;
      return;
    }
    wrap.innerHTML = `<table class="glass-table">
      <thead><tr><th>Name</th><th>Category</th><th>Price</th><th>Status</th><th>Tags</th></tr></thead>
      <tbody>${items.map(menuRow).join('')}</tbody>
    </table>`;
  } catch (err) {
    wrap.innerHTML = `<div class="muted-white" style="padding:16px;">Failed to load menu — ${err.message || 'error'}.</div>`;
  }
}

async function saveItem(root) {
  const name = root.querySelector('#mn-name')?.value?.trim();
  if (!name) { showToast('Item name is required', 'coral'); return; }
  const priceRupees = parseFloat(root.querySelector('#mn-price')?.value || '0');
  const tags = root.querySelector('#mn-tags')?.value?.split(',').map(t => t.trim()).filter(Boolean);
  try {
    await apiPost('/menu/items', { body: {
      name,
      category: root.querySelector('#mn-cat')?.value?.trim() || undefined,
      priceInPaisa: Math.round(priceRupees * 100),
      tags: tags?.length ? tags : undefined,
    }});
    showToast('Menu item created', 'mint');
    root.querySelector('#menu-form-wrap').style.display = 'none';
    await loadMenu(root);
  } catch (err) { showToast(err.message || 'Failed to create menu item', 'coral'); }
}
