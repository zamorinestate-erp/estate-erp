// =============================================================================
// PAGE: Not Available / Not Yet Built
// Part K.2: a route outside a role's scope must show a calm "not available"
// state, never a blank page or a raw error. Part N.1 reuses the same idea
// for "not yet built" placeholders in this demo — different message, same
// never-a-blank-box principle.
// =============================================================================

export function renderNotAvailable() {
  return `
    <div class="glass not-available">
      <div style="font-size:34px;">🔒</div>
      <div style="font-weight:700; font-size:17px;">This isn't available for your account</div>
      <div class="muted-white" style="font-size:13px; max-width:360px;">
        Your role doesn't include this screen. If you think this is wrong, ask Master to review your role assignment.
      </div>
    </div>
  `;
}

export function renderNotBuiltYet(moduleName = "This module") {
  return `
    <div class="glass not-available">
      <div style="font-size:34px;">🧱</div>
      <div style="font-weight:700; font-size:17px;">${moduleName} — coming in the next build pass</div>
      <div class="muted-white" style="font-size:13px; max-width:420px;">
        This demo covers the Command Centre, POS &amp; Billing, and the Staff views end-to-end. Every other
        sidebar item is wired into the navigation and role config already — its screen just hasn't been
        built yet in this pass.
      </div>
    </div>
  `;
}
