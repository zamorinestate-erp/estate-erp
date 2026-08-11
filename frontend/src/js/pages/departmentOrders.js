// =============================================================================
// PAGE: Department Orders (Internal Kitchen/Bar Orders) — API-wired
// GET   /api/v1/department-orders
// POST  /api/v1/department-orders
// PATCH /api/v1/department-orders/:id/status
// =============================================================================
import { apiGet, apiPost, apiPatch } from '../apiClient.js';
import { showToast, skeleton } from '../components.js';
import { state } from '../state.js';

const STATUS_COLORS = {
  PENDING: 'pill-amber', IN_PROGRESS: 'pill-dark', FULFILLED: 'pill-mint', CANCELLED: 'pill-coral',
};

function orderRow(o) {
  const date = o.createdAt ? new Date(o.createdAt).toLocaleDateString('en-IN') : '—';
  const canFulfil = o.status === 'IN_PROGRESS' || o.status === 'PENDING';
  return `
    <tr data-order-id="${o.orderId || o._id}">
      <td style="font-size:11px;">${date}</td>
      <td><strong>${o.fromDepartment || '—'}</strong> → ${o.toDepartment || '—'}</td>
      <td class="muted-white">${o.items?.map(i => `${i.quantity}× ${i.name}`).join(', ') || o.description || '—'}</td>
      <td><span class="pill ${STATUS_COLORS[o.status] || 'pill-dark'}" style="font-size:10px;">${o.status}</span></td>
      ${canFulfil ? `<td><button class="btn btn-ghost" style="padding:4px 8px;font-size:11px;" data-fulfil="${o.orderId || o._id}">Mark Fulfilled</button></td>` : '<td></td>'}
    </tr>`;
}

export function renderDepartmentOrders() {
  return `
    <div class="page-enter">
      <div class="flex justify-between items-center" style="margin-bottom:18px;">
        <div>
          <div style="color:#fff;font-size:22px;font-weight:700;" class="font-display">Department Orders</div>
          <div class="muted-white" id="dept-subtitle" style="font-size:13.5px;">Internal kitchen &amp; bar transfer requests</div>
        </div>
        <button class="btn btn-primary" id="new-dept-order-btn" style="padding:10px 18px;">+ New Order</button>
      </div>
      <div class="glass" style="padding:20px;">
        <div id="dept-table-wrap">${skeleton('220px')}</div>
      </div>
      <div id="dept-form-wrap" class="glass" style="padding:20px;margin-top:16px;display:none;">
        <div style="color:#fff;font-weight:600;font-size:15px;margin-bottom:14px;">New Department Order</div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:14px;">
          <div><div class="muted-white" style="font-size:11px;margin-bottom:4px;">From Department *</div>
            <input id="dept-from" type="text" class="glass-input" placeholder="e.g. Kitchen" style="width:100%;"/></div>
          <div><div class="muted-white" style="font-size:11px;margin-bottom:4px;">To Department *</div>
            <input id="dept-to" type="text" class="glass-input" placeholder="e.g. Bar" style="width:100%;"/></div>
          <div style="grid-column:1/-1;"><div class="muted-white" style="font-size:11px;margin-bottom:4px;">Items / Description *</div>
            <textarea id="dept-desc" class="glass-input" rows="3" placeholder="e.g. 5kg coffee beans, 2 litres milk" style="width:100%;resize:vertical;"></textarea></div>
        </div>
        <div class="flex gap-sm">
          <button class="btn btn-primary" id="save-dept-order-btn" style="padding:9px 16px;">Submit Order</button>
          <button class="btn btn-ghost" id="cancel-dept-order-btn" style="padding:9px 16px;">Cancel</button>
        </div>
      </div>
    </div>`;
}

export async function wireDepartmentOrders(root) {
  await loadDeptOrders(root);
  root.querySelector('#new-dept-order-btn')?.addEventListener('click', () => {
    const wrap = root.querySelector('#dept-form-wrap');
    if (wrap) wrap.style.display = wrap.style.display === 'none' ? 'block' : 'none';
  });
  root.querySelector('#cancel-dept-order-btn')?.addEventListener('click', () => {
    root.querySelector('#dept-form-wrap').style.display = 'none';
  });
  root.querySelector('#save-dept-order-btn')?.addEventListener('click', () => saveDeptOrder(root));
}

async function loadDeptOrders(root) {
  const wrap = root.querySelector('#dept-table-wrap');
  const subtitle = root.querySelector('#dept-subtitle');
  try {
    const res = await apiGet('/department-orders');
    const orders = res?.data?.orders || res?.data || [];
    if (subtitle) subtitle.textContent = `${orders.length} order(s) — internal transfers`;
    if (!orders.length) {
      wrap.innerHTML = `<div class="empty-state"><div class="empty-state-title">No department orders</div><div>Submit an internal transfer request to start tracking department orders.</div></div>`;
      return;
    }
    wrap.innerHTML = `<table class="glass-table">
      <thead><tr><th>Date</th><th>Route</th><th>Items</th><th>Status</th><th></th></tr></thead>
      <tbody>${orders.map(orderRow).join('')}</tbody>
    </table>`;
    root.querySelectorAll('[data-fulfil]').forEach(btn => {
      btn.addEventListener('click', () => fulfilOrder(root, btn.dataset.fulfil));
    });
  } catch (err) {
    wrap.innerHTML = `<div class="muted-white" style="padding:16px;">Failed to load orders — ${err.message || 'error'}.</div>`;
  }
}

async function saveDeptOrder(root) {
  const from = root.querySelector('#dept-from')?.value?.trim();
  const to = root.querySelector('#dept-to')?.value?.trim();
  const desc = root.querySelector('#dept-desc')?.value?.trim();
  if (!from || !to || !desc) { showToast('From, To and Description are required', 'coral'); return; }
  const cafeId = state.auth?.user?.primaryCafeId || state.auth?.user?.assignedCafeIds?.[0];
  try {
    await apiPost('/department-orders', { body: { fromDepartment: from, toDepartment: to, description: desc, cafeId } });
    showToast('Department order submitted', 'mint');
    root.querySelector('#dept-form-wrap').style.display = 'none';
    await loadDeptOrders(root);
  } catch (err) { showToast(err.message || 'Failed to submit order', 'coral'); }
}

async function fulfilOrder(root, orderId) {
  try {
    await apiPatch(`/department-orders/${orderId}/status`, { body: { status: 'FULFILLED' } });
    showToast('Order marked fulfilled', 'mint');
    await loadDeptOrders(root);
  } catch (err) { showToast(err.message || 'Failed to update order', 'coral'); }
}
