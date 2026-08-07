// =============================================================================
// PAGE: Personal Ledger
//
// ABSOLUTE RESTRICTION: MASTER ONLY
// (backend/src/middleware/authorize.js → ABSOLUTE_ROLE_RESTRICTIONS.PERSONAL_LEDGER)
//
// This module is completely undiscoverable to Owner, Cafe Admin and Staff:
//   - Not listed in their navigation.
//   - Not reachable through Global Search.
//   - Not referenced in notification text.
//   - API routes return 403/404 to non-Master roles (enforced by backend).
//
// CURRENT STATE (Stage 8, Batch 1):
// The demo sample entries and demo add-entry action have been removed.
// The backend model and API (POST /personal-ledger, GET /personal-ledger,
// correction/reversal endpoints) will be built in Batch 2.
// Until then this page renders an honest empty state.
//
// Do NOT re-add local sample entries or a fake add-entry button.
// =============================================================================

export function renderLedger() {
  return `
    <div class="page-enter">
      <div class="flex justify-between items-center" style="margin-bottom:18px;">
        <div>
          <div style="color:#fff; font-size:22px; font-weight:700;" class="font-display">Personal Ledger</div>
          <div class="muted-white" style="font-size:13.5px;">Visible only to you. Never shared with Owner, Cafe Admin, or Staff.</div>
        </div>
        <button class="btn btn-primary" id="add-entry-btn" disabled title="Backend integration in progress">+ New entry</button>
      </div>

      <div class="glass" style="padding:32px; text-align:center; color:var(--color-text-muted);">
        <div style="font-size:36px; margin-bottom:12px;">🔐</div>
        <div style="font-size:16px; font-weight:600; color:#fff; margin-bottom:8px;">Personal Ledger</div>
        <div style="font-size:13.5px; max-width:400px; margin:0 auto; line-height:1.6;">
          Backend integration is in progress (Stage 8, Batch 2).<br>
          Your private ledger entries will appear here once the
          authenticated API is connected.
        </div>
      </div>
    </div>
  `;
}

export function wireLedger(root) {
  // Add-entry button is disabled until Batch 2 (backend API) is complete.
  // Do not add any local/demo entry logic here.
  const btn = root.querySelector("#add-entry-btn");
  if (btn) {
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      // No-op: button is disabled. This listener is a safety guard only.
    });
  }
}
