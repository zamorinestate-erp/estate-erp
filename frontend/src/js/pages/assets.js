// =============================================================================
// PAGE: Assets & Maintenance — API-wired
// GET  /api/v1/assets              — list assets
// POST /api/v1/assets              — create asset (MASTER, CAFE_ADMIN)
// POST /api/v1/assets/:id/maintenance — log a maintenance job
// =============================================================================
import { apiGet, apiPost } from '../apiClient.js';
import { showToast, skeleton } from '../components.js';
import { state } from '../state.js';
import { ROLES } from '../navigation.js';

const canWrite = () => [ROLES.MASTER, ROLES.CAFE_ADMIN].includes(state.role);

function conditionPill(condition) {
  const map = { GOOD: 'pill-mint', FAIR: 'pill-amber', POOR: 'pill-coral', RETIRED: 'pill-dark' };
  return `<span class="pill ${map[condition] || 'pill-dark'}" style="font-size:10px;">${condition || 'GOOD'}</span>`;
}

function assetRow(a) {
  return `
    <tr>
      <td><strong>${a.name}</strong></td>
      <td class="muted-white">${a.category || '—'}</td>
      <td class="muted-white">${a.cafeId || '—'}</td>
      <td>${conditionPill(a.condition)}</td>
      <td class="muted-white" style="font-size:11px;">${a.lastMaintenanceDate ? new Date(a.lastMaintenanceDate).toLocaleDateString('en-IN') : '—'}</td>
      ${canWrite() ? `<td><button class="btn btn-ghost" style="padding:4px 8px;font-size:11px;" data-log-maintenance="${a.assetId}">Log Maintenance</button></td>` : '<td></td>'}
    </tr>`;
}

export function renderAssets() {
  return `
    <div class="page-enter">
      <div class="flex justify-between items-center" style="margin-bottom:18px;">
        <div>
          <div style="color:#fff;font-size:22px;font-weight:700;" class="font-display">Assets &amp; Maintenance</div>
          <div class="muted-white" id="assets-subtitle" style="font-size:13.5px;">Loading asset register…</div>
        </div>
        ${canWrite() ? `<button class="btn btn-primary" id="add-asset-btn" style="padding:10px 18px;">+ Add Asset</button>` : ''}
      </div>
      <div class="glass" style="padding:20px;">
        <div id="asset-table-wrap">${skeleton('220px')}</div>
      </div>
      <div id="asset-form-wrap" class="glass" style="padding:20px;margin-top:16px;display:none;">
        <div style="color:#fff;font-weight:600;font-size:15px;margin-bottom:14px;">Register New Asset</div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:14px;">
          <div><div class="muted-white" style="font-size:11px;margin-bottom:4px;">Asset Name *</div>
            <input id="ast-name" type="text" class="glass-input" placeholder="e.g. Espresso Machine" style="width:100%;"/></div>
          <div><div class="muted-white" style="font-size:11px;margin-bottom:4px;">Category</div>
            <input id="ast-cat" type="text" class="glass-input" placeholder="e.g. Kitchen Equipment" style="width:100%;"/></div>
          <div><div class="muted-white" style="font-size:11px;margin-bottom:4px;">Condition</div>
            <select id="ast-condition" class="glass-input" style="width:100%;">
              <option value="GOOD">Good</option>
              <option value="FAIR">Fair</option>
              <option value="POOR">Poor</option>
            </select></div>
          <div><div class="muted-white" style="font-size:11px;margin-bottom:4px;">Purchase Date</div>
            <input id="ast-date" type="date" class="glass-input" style="width:100%;"/></div>
        </div>
        <div class="flex gap-sm">
          <button class="btn btn-primary" id="save-asset-btn" style="padding:9px 16px;">Save Asset</button>
          <button class="btn btn-ghost" id="cancel-asset-btn" style="padding:9px 16px;">Cancel</button>
        </div>
      </div>
    </div>`;
}

export async function wireAssets(root) {
  await loadAssets(root);
  root.querySelector('#add-asset-btn')?.addEventListener('click', () => {
    const wrap = root.querySelector('#asset-form-wrap');
    if (wrap) wrap.style.display = wrap.style.display === 'none' ? 'block' : 'none';
  });
  root.querySelector('#cancel-asset-btn')?.addEventListener('click', () => {
    root.querySelector('#asset-form-wrap').style.display = 'none';
  });
  root.querySelector('#save-asset-btn')?.addEventListener('click', () => saveAsset(root));
}

async function loadAssets(root) {
  const wrap = root.querySelector('#asset-table-wrap');
  const subtitle = root.querySelector('#assets-subtitle');
  try {
    const res = await apiGet('/assets');
    const assets = res?.data?.assets || res?.data || [];
    if (subtitle) subtitle.textContent = `${assets.length} asset(s) registered`;
    if (!assets.length) {
      wrap.innerHTML = `<div class="empty-state"><div class="empty-state-title">No assets registered</div><div>Add equipment and assets to begin maintenance tracking.</div></div>`;
      return;
    }
    wrap.innerHTML = `<table class="glass-table">
      <thead><tr><th>Name</th><th>Category</th><th>Cafe</th><th>Condition</th><th>Last Maintenance</th><th></th></tr></thead>
      <tbody>${assets.map(assetRow).join('')}</tbody>
    </table>`;
    root.querySelectorAll('[data-log-maintenance]').forEach(btn => {
      btn.addEventListener('click', () => logMaintenance(root, btn.dataset.logMaintenance));
    });
  } catch (err) {
    wrap.innerHTML = `<div class="muted-white" style="padding:16px;">Failed to load assets — ${err.message || 'error'}.</div>`;
  }
}

async function saveAsset(root) {
  const name = root.querySelector('#ast-name')?.value?.trim();
  if (!name) { showToast('Asset name is required', 'coral'); return; }
  const cafeId = state.auth?.user?.primaryCafeId || state.auth?.user?.assignedCafeIds?.[0];
  try {
    await apiPost('/assets', { body: {
      name,
      category: root.querySelector('#ast-cat')?.value?.trim() || undefined,
      condition: root.querySelector('#ast-condition')?.value || 'GOOD',
      purchaseDate: root.querySelector('#ast-date')?.value || undefined,
      cafeId,
    }});
    showToast('Asset registered', 'mint');
    root.querySelector('#asset-form-wrap').style.display = 'none';
    await loadAssets(root);
  } catch (err) { showToast(err.message || 'Failed to save asset', 'coral'); }
}

async function logMaintenance(root, assetId) {
  const notes = prompt('Maintenance notes (optional):');
  try {
    await apiPost(`/assets/${assetId}/maintenance`, { body: {
      notes: notes || 'Routine maintenance',
      performedAt: new Date().toISOString(),
    }});
    showToast('Maintenance logged', 'mint');
    await loadAssets(root);
  } catch (err) { showToast(err.message || 'Failed to log maintenance', 'coral'); }
}
