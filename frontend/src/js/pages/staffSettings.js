// =============================================================================
// PAGE: Staff Settings — SCR-023
//
// STAFF previously had a separate Settings page with 3 languages and no
// self-service integration. Per SCR-023, Staff now uses the unified
// settingsShared hub, which includes:
//   - Profile & Identity
//   - My Payslips (moved from sidebar)
//   - My Loans & Advances (moved from sidebar)
//   - Access & Permissions
//   - Security & Sign-In
//   - Devices & Sessions
//   - Notifications
//   - Language & Region (23 languages)
//   - Appearance & Accessibility
//   - Privacy & Data
//   - Navigation & Workspace
//   - Help & Diagnostics
//
// This file is intentionally thin — it resets section state and delegates.
// =============================================================================

import { initSettingsForRole, setSettingsActiveSection, renderSettingsShared, wireSettingsShared } from "./settingsShared.js";

export function renderStaffSettings(subroute) {
  if (subroute) {
    setSettingsActiveSection(subroute);
  }
  return renderSettingsShared();
}

export function wireStaffSettings(root, subroute) {
  wireSettingsShared(root);
}
