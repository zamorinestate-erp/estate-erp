// =============================================================================
// PAGE: Trash Bin — API-wired (MASTER ONLY)
// GET  /api/v1/trash          — list soft-deleted records
// POST /api/v1/trash/restore  — restore a record
// =============================================================================
import { apiGet, apiPost } from '../apiClient.js';
import { showToast, skeleton, confirmAction } from '../components.js';

function entityRow(item) {
  const deletedAt = item.deletedAt || item.archivedAt
    ? new Date(item.deletedAt || item.archivedAt).toLocaleDateString('en-IN')
    : '—';
  return `
    <tr>
      <td><span class="pill pill-dark" style="font-size:10px;">${item.entityType || item.type}</span></td>
      <td><strong>${item.name || item.id || item.entityId}</strong></td>
      <td class="muted-white" style="font-size:11px;">${item.entityId || '—'}</td>
      <td class="muted-white" style="font-size:11px;">${deletedAt}</td>
      <td class="muted-white" style="font-size:11px;">${item.deletedBy || item.archivedBy || '—'}</td>
      <td>
        <button class="btn btn-ghost" style="padding:5px 10px;font-size:11px;"
          data-restore-id="${item.entityId || item.id}"
          data-restore-type="${item.entityType || item.type}">
          Restore
        </button>
      </td>
    </tr>`;
}

export function renderTrashBin() {
  return `
    <div class="page-enter">
      <div style="margin-bottom:18px;">
        <div style="color:#fff;font-size:22px;font-weight:700;" class="font-display">Trash Bin</div>
        <div class="muted-white" id="trash-subtitle" style="font-size:13.5px;">Soft-deleted records — restore or let expire</div>
      </div>
      <div style="background:rgba(255,100,80,0.08);border:1px solid rgba(255,100,80,0.25);border-radius:12px;padding:14px 18px;margin-bottom:18px;color:#FF9E8F;font-size:13px;">
        ⚠ Restored records re-enter their original state. Permanently deleted records cannot be recovered from this screen.
      </div>
      <div class="glass" style="padding:20px;">
        <div id="trash-table-wrap">${skeleton('220px')}</div>
      </div>
    </div>`;
}

export async function wireTrashBin(root) {
  await loadTrash(root);
}

async function loadTrash(root) {
  const wrap = root.querySelector('#trash-table-wrap');
  const subtitle = root.querySelector('#trash-subtitle');
  try {
    const res = await apiGet('/trash');
    const items = res?.data?.items || res?.data || [];
    if (subtitle) subtitle.textContent = `${items.length} item(s) in trash`;
    if (!items.length) {
      wrap.innerHTML = `<div class="empty-state"><div class="empty-state-title">Trash is empty</div><div>Archived or soft-deleted records appear here.</div></div>`;
      return;
    }
    wrap.innerHTML = `<table class="glass-table">
      <thead><tr><th>Type</th><th>Name / ID</th><th>Entity ID</th><th>Deleted At</th><th>Deleted By</th><th>Action</th></tr></thead>
      <tbody>${items.map(entityRow).join('')}</tbody>
    </table>`;
    root.querySelectorAll('[data-restore-id]').forEach(btn => {
      btn.addEventListener('click', () => {
        confirmAction({
          title: `Restore ${btn.dataset.restoreType}?`,
          description: `This will restore "${btn.dataset.restoreId}" back to its active state. Proceed?`,
          confirmLabel: 'Restore',
          onConfirm: () => restore(root, btn.dataset.restoreId, btn.dataset.restoreType),
        });
      });
    });
  } catch (err) {
    wrap.innerHTML = `<div class="muted-white" style="padding:16px;">Failed to load trash — ${err.message || 'error'}.</div>`;
  }
}

async function restore(root, entityId, entityType) {
  try {
    await apiPost('/trash/restore', { body: { entityId, entityType } });
    showToast(`${entityType} restored`, 'mint');
    await loadTrash(root);
  } catch (err) { showToast(err.message || 'Failed to restore item', 'coral'); }
}
