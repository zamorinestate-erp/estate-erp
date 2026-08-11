// =============================================================================
// PAGE: Customers & Loyalty — API-wired
// GET  /api/v1/customers         — list customers (all roles)
// POST /api/v1/customers         — create customer
// POST /api/v1/customers/:id/points/earn
// POST /api/v1/customers/:id/points/redeem
// =============================================================================
import { apiGet, apiPost } from '../apiClient.js';
import { showToast, skeleton } from '../components.js';
import { state } from '../state.js';
import { ROLES } from '../navigation.js';

function customerRow(c) {
  return `
    <tr>
      <td><strong>${c.name || '—'}</strong></td>
      <td class="muted-white">${c.phone || '—'}</td>
      <td class="muted-white">${c.email || '—'}</td>
      <td style="color:var(--color-accent-mint-bright);font-weight:600;">${(c.loyaltyPoints || 0).toLocaleString('en-IN')} pts</td>
      <td style="font-size:11px;color:rgba(255,255,255,0.45);">${c.customerId}</td>
    </tr>`;
}

export function renderCustomers() {
  return `
    <div class="page-enter">
      <div class="flex justify-between items-center" style="margin-bottom:18px;">
        <div>
          <div style="color:#fff;font-size:22px;font-weight:700;" class="font-display">Customers &amp; Loyalty</div>
          <div class="muted-white" id="customer-subtitle" style="font-size:13.5px;">Loading customer registry…</div>
        </div>
        <button class="btn btn-primary" id="add-customer-btn" style="padding:10px 18px;">+ Register Customer</button>
      </div>
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:16px;margin-bottom:18px;" id="customer-kpi-grid">
        ${skeleton('80px')}${skeleton('80px')}${skeleton('80px')}
      </div>
      <div class="glass" style="padding:20px;">
        <div id="customer-table-wrap">${skeleton('220px')}</div>
      </div>
      <div id="customer-form-wrap" class="glass" style="padding:20px;margin-top:16px;display:none;">
        <div style="color:#fff;font-weight:600;font-size:15px;margin-bottom:14px;">Register New Customer</div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:14px;">
          <div><div class="muted-white" style="font-size:11px;margin-bottom:4px;">Full Name *</div>
            <input id="cust-name" type="text" class="glass-input" style="width:100%;"/></div>
          <div><div class="muted-white" style="font-size:11px;margin-bottom:4px;">Phone</div>
            <input id="cust-phone" type="text" class="glass-input" style="width:100%;"/></div>
          <div><div class="muted-white" style="font-size:11px;margin-bottom:4px;">Email</div>
            <input id="cust-email" type="email" class="glass-input" style="width:100%;"/></div>
        </div>
        <div class="flex gap-sm">
          <button class="btn btn-primary" id="save-customer-btn" style="padding:9px 16px;">Register</button>
          <button class="btn btn-ghost" id="cancel-customer-btn" style="padding:9px 16px;">Cancel</button>
        </div>
      </div>
    </div>`;
}

export async function wireCustomers(root) {
  await loadCustomers(root);
  root.querySelector('#add-customer-btn')?.addEventListener('click', () => {
    const wrap = root.querySelector('#customer-form-wrap');
    if (wrap) wrap.style.display = wrap.style.display === 'none' ? 'block' : 'none';
  });
  root.querySelector('#cancel-customer-btn')?.addEventListener('click', () => {
    root.querySelector('#customer-form-wrap').style.display = 'none';
  });
  root.querySelector('#save-customer-btn')?.addEventListener('click', () => saveCustomer(root));
}

async function loadCustomers(root) {
  const wrap = root.querySelector('#customer-table-wrap');
  const subtitle = root.querySelector('#customer-subtitle');
  const kpiGrid = root.querySelector('#customer-kpi-grid');
  try {
    const res = await apiGet('/customers');
    const customers = res?.data?.customers || res?.data || [];
    const totalPoints = customers.reduce((s, c) => s + (c.loyaltyPoints || 0), 0);

    if (subtitle) subtitle.textContent = `${customers.length} registered customers`;
    if (kpiGrid) {
      kpiGrid.innerHTML = `
        <div class="glass kpi-card"><div class="kpi-label">Total Customers</div><div class="kpi-value">${customers.length}</div></div>
        <div class="glass kpi-card"><div class="kpi-label">Total Points Active</div><div class="kpi-value">${totalPoints.toLocaleString('en-IN')}</div></div>
        <div class="glass kpi-card"><div class="kpi-label">Avg Points</div><div class="kpi-value">${customers.length ? Math.round(totalPoints / customers.length).toLocaleString('en-IN') : '0'}</div></div>`;
    }
    if (!customers.length) {
      wrap.innerHTML = `<div class="empty-state"><div class="empty-state-title">No customers yet</div><div>Register your first customer to start tracking loyalty points.</div></div>`;
      return;
    }
    wrap.innerHTML = `<table class="glass-table">
      <thead><tr><th>Name</th><th>Phone</th><th>Email</th><th>Loyalty Points</th><th>ID</th></tr></thead>
      <tbody>${customers.map(customerRow).join('')}</tbody>
    </table>`;
  } catch (err) {
    if (subtitle) subtitle.textContent = 'Failed to load customers';
    wrap.innerHTML = `<div class="muted-white" style="padding:16px;">Failed to load customers — ${err.message || 'error'}.</div>`;
  }
}

async function saveCustomer(root) {
  const name = root.querySelector('#cust-name')?.value?.trim();
  if (!name) { showToast('Customer name is required', 'coral'); return; }
  try {
    await apiPost('/customers', { body: {
      name,
      phone: root.querySelector('#cust-phone')?.value?.trim() || undefined,
      email: root.querySelector('#cust-email')?.value?.trim() || undefined,
    }});
    showToast('Customer registered', 'mint');
    root.querySelector('#customer-form-wrap').style.display = 'none';
    await loadCustomers(root);
  } catch (err) { showToast(err.message || 'Failed to register customer', 'coral'); }
}
