// =============================================================================
// PAGE: Procurement (Purchase Orders) — API-wired
// GET  /api/v1/procurement/orders
// POST /api/v1/procurement/orders
// POST /api/v1/procurement/orders/:id/submit | /approve | /receive | /cancel
// =============================================================================
import { apiGet, apiPost } from '../apiClient.js';
import { showToast, skeleton, confirmAction } from '../components.js';
import { state } from '../state.js';
import { ROLES } from '../navigation.js';

const STATUS_COLORS = {
  DRAFT: 'pill-dark', SUBMITTED: 'pill-dark', APPROVED: 'pill-mint',
  ORDERED: 'pill-amber', RECEIVED: 'pill-mint', CANCELLED: 'pill-coral',
};

function statusPill(status) {
  return `<span class="pill ${STATUS_COLORS[status] || 'pill-dark'}" style="font-size:10px;">${status}</span>`;
}

function orderRow(o) {
  const canApprove = o.status === 'SUBMITTED' && [ROLES.MASTER, ROLES.OWNER, ROLES.CAFE_ADMIN].includes(state.role);
  const canReceive = o.status === 'ORDERED' && [ROLES.MASTER, ROLES.CAFE_ADMIN].includes(state.role);
  return `
    <tr data-po-id="${o.purchaseOrderId}">
      <td style="font-size:11px;color:rgba(255,255,255,0.5);">${o.purchaseOrderId}</td>
      <td><strong>${o.vendorName || o.vendorId}</strong></td>
      <td class="muted-white">${o.cafeId || '—'}</td>
      <td>${statusPill(o.status)}</td>
      <td style="text-align:right;">₹${((o.totalAmountPaisa || 0) / 100).toLocaleString('en-IN')}</td>
      <td>
        ${canApprove ? `<button class="btn btn-primary" style="padding:5px 10px;font-size:11px;" data-approve="${o.purchaseOrderId}">Approve</button>` : ''}
        ${canReceive ? `<button class="btn btn-ghost" style="padding:5px 10px;font-size:11px;" data-receive="${o.purchaseOrderId}">Mark Received</button>` : ''}
      </td>
    </tr>`;
}

export function renderProcurement() {
  const canCreate = [ROLES.MASTER, ROLES.CAFE_ADMIN].includes(state.role);
  return `
    <div class="page-enter">
      <div class="flex justify-between items-center" style="margin-bottom:18px;">
        <div>
          <div style="color:#fff;font-size:22px;font-weight:700;" class="font-display">Procurement</div>
          <div class="muted-white" style="font-size:13.5px;">Purchase orders &amp; supplier deliveries</div>
        </div>
        ${canCreate ? `<button class="btn btn-primary" id="new-po-btn" style="padding:10px 18px;">+ New PO</button>` : ''}
      </div>
      <div class="glass" style="padding:20px;">
        <div id="po-table-wrap">${skeleton('220px')}</div>
      </div>
    </div>`;
}

export async function wireProcurement(root) {
  await loadOrders(root);
  root.querySelector('#new-po-btn')?.addEventListener('click', () => showToast('PO creation form coming — use the API directly for now', 'amber'));
}

async function loadOrders(root) {
  const wrap = root.querySelector('#po-table-wrap');
  try {
    const res = await apiGet('/procurement/orders');
    const orders = res?.data?.orders || res?.data || [];
    if (!orders.length) {
      wrap.innerHTML = `<div class="empty-state"><div class="empty-state-title">No purchase orders</div><div>Create your first PO to begin tracking procurement.</div></div>`;
      return;
    }
    wrap.innerHTML = `<table class="glass-table">
      <thead><tr><th>PO ID</th><th>Vendor</th><th>Cafe</th><th>Status</th><th style="text-align:right;">Total</th><th>Action</th></tr></thead>
      <tbody>${orders.map(orderRow).join('')}</tbody>
    </table>`;
    root.querySelectorAll('[data-approve]').forEach(btn => {
      btn.addEventListener('click', () => actionOnOrder(root, btn.dataset.approve, 'approve'));
    });
    root.querySelectorAll('[data-receive]').forEach(btn => {
      btn.addEventListener('click', () => actionOnOrder(root, btn.dataset.receive, 'receive'));
    });
  } catch (err) {
    wrap.innerHTML = `<div class="muted-white" style="padding:16px;">Failed to load orders — ${err.message || 'error'}.</div>`;
  }
}

async function actionOnOrder(root, poId, action) {
  try {
    await apiPost(`/procurement/orders/${poId}/${action}`, { body: {} });
    showToast(`Order ${action}d`, 'mint');
    await loadOrders(root);
  } catch (err) { showToast(err.message || `Failed to ${action} order`, 'coral'); }
}
