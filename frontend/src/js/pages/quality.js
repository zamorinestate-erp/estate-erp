// =============================================================================
// PAGE: Quality & Compliance — API-wired
// GET  /api/v1/quality/checklists   — list submitted checklists
// POST /api/v1/quality/checklists   — submit a new checklist
// =============================================================================
import { apiGet, apiPost } from '../apiClient.js';
import { showToast, skeleton } from '../components.js';
import { state } from '../state.js';

const CHECKLIST_TYPES = [
  'OPENING_CHECK', 'CLOSING_CHECK', 'FOOD_SAFETY', 'HYGIENE_AUDIT',
  'EQUIPMENT_CHECK', 'DAILY_CLEANING', 'PEST_CONTROL_LOG',
];

function statusPill(status) {
  const colors = { PASSED: 'pill-mint', FAILED: 'pill-coral', FLAGGED: 'pill-amber', PENDING: 'pill-dark' };
  return `<span class="pill ${colors[status] || 'pill-dark'}" style="font-size:10px;">${status}</span>`;
}

function checklistRow(c) {
  const date = c.submittedAt ? new Date(c.submittedAt).toLocaleDateString('en-IN') : '—';
  return `
    <tr>
      <td style="font-size:11px;">${date}</td>
      <td><strong>${(c.checklistType || '').replace(/_/g, ' ')}</strong></td>
      <td class="muted-white">${c.cafeId || '—'}</td>
      <td>${statusPill(c.result || 'PENDING')}</td>
      <td class="muted-white" style="font-size:11px;">${c.submittedByName || c.submittedBy || '—'}</td>
      <td class="muted-white" style="font-size:11px;">${c.notes ? c.notes.slice(0, 40) + (c.notes.length > 40 ? '…' : '') : '—'}</td>
    </tr>`;
}

export function renderQuality() {
  const cafeId = state.auth?.user?.primaryCafeId || state.auth?.user?.assignedCafeIds?.[0] || '';
  return `
    <div class="page-enter">
      <div class="flex justify-between items-center" style="margin-bottom:18px;">
        <div>
          <div style="color:#fff;font-size:22px;font-weight:700;" class="font-display">Quality &amp; Compliance</div>
          <div class="muted-white" id="quality-subtitle" style="font-size:13.5px;">Loading checklists…</div>
        </div>
        <button class="btn btn-primary" id="submit-checklist-btn" style="padding:10px 18px;">+ Submit Checklist</button>
      </div>
      <div class="glass" style="padding:20px;">
        <div id="quality-table-wrap">${skeleton('220px')}</div>
      </div>
      <div id="quality-form-wrap" class="glass" style="padding:20px;margin-top:16px;display:none;">
        <div style="color:#fff;font-weight:600;font-size:15px;margin-bottom:14px;">Submit Quality Checklist</div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:14px;">
          <div><div class="muted-white" style="font-size:11px;margin-bottom:4px;">Checklist Type *</div>
            <select id="ql-type" class="glass-input" style="width:100%;">
              ${CHECKLIST_TYPES.map(t => `<option value="${t}">${t.replace(/_/g, ' ')}</option>`).join('')}
            </select></div>
          <div><div class="muted-white" style="font-size:11px;margin-bottom:4px;">Result *</div>
            <select id="ql-result" class="glass-input" style="width:100%;">
              <option value="PASSED">PASSED</option>
              <option value="FAILED">FAILED</option>
              <option value="FLAGGED">FLAGGED</option>
            </select></div>
          <div style="grid-column:1/-1;"><div class="muted-white" style="font-size:11px;margin-bottom:4px;">Notes</div>
            <textarea id="ql-notes" class="glass-input" rows="3" placeholder="Observations, issues found…" style="width:100%;resize:vertical;"></textarea></div>
        </div>
        <div class="flex gap-sm">
          <button class="btn btn-primary" id="save-checklist-btn" style="padding:9px 16px;">Submit</button>
          <button class="btn btn-ghost" id="cancel-checklist-btn" style="padding:9px 16px;">Cancel</button>
        </div>
      </div>
    </div>`;
}

export async function wireQuality(root) {
  await loadChecklists(root);
  root.querySelector('#submit-checklist-btn')?.addEventListener('click', () => {
    const wrap = root.querySelector('#quality-form-wrap');
    if (wrap) wrap.style.display = wrap.style.display === 'none' ? 'block' : 'none';
  });
  root.querySelector('#cancel-checklist-btn')?.addEventListener('click', () => {
    root.querySelector('#quality-form-wrap').style.display = 'none';
  });
  root.querySelector('#save-checklist-btn')?.addEventListener('click', () => saveChecklist(root));
}

async function loadChecklists(root) {
  const wrap = root.querySelector('#quality-table-wrap');
  const subtitle = root.querySelector('#quality-subtitle');
  try {
    const res = await apiGet('/quality/checklists');
    const checklists = res?.data?.checklists || res?.data || [];
    if (subtitle) subtitle.textContent = `${checklists.length} checklist(s) on record`;
    if (!checklists.length) {
      wrap.innerHTML = `<div class="empty-state"><div class="empty-state-title">No checklists yet</div><div>Submit your first quality checklist to begin compliance tracking.</div></div>`;
      return;
    }
    wrap.innerHTML = `<table class="glass-table">
      <thead><tr><th>Date</th><th>Type</th><th>Cafe</th><th>Result</th><th>Submitted By</th><th>Notes</th></tr></thead>
      <tbody>${checklists.map(checklistRow).join('')}</tbody>
    </table>`;
  } catch (err) {
    wrap.innerHTML = `<div class="muted-white" style="padding:16px;">Failed to load checklists — ${err.message || 'error'}.</div>`;
  }
}

async function saveChecklist(root) {
  const cafeId = state.auth?.user?.primaryCafeId || state.auth?.user?.assignedCafeIds?.[0];
  try {
    await apiPost('/quality/checklists', { body: {
      checklistType: root.querySelector('#ql-type')?.value,
      result: root.querySelector('#ql-result')?.value,
      notes: root.querySelector('#ql-notes')?.value?.trim() || undefined,
      cafeId,
    }});
    showToast('Checklist submitted', 'mint');
    root.querySelector('#quality-form-wrap').style.display = 'none';
    await loadChecklists(root);
  } catch (err) { showToast(err.message || 'Failed to submit checklist', 'coral'); }
}
