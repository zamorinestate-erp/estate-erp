// =============================================================================
// ZAMORIN CAFE ERP — ENTRY POINT
//
// SECURITY NOTE (Stage 8, Batch 1):
// The development-only "ACT AS" role switcher has been removed.
// It allowed any user to impersonate any role without authentication,
// which is production-incompatible and a security violation.
//
// TODO (Stage 2 / Batch frontend-auth): Replace this boot sequence with a
// real authentication shell that:
//   1. Calls GET /auth/me to resolve identity from the backend session.
//   2. Derives the user's role, assignedCafeIds, and organisationId from
//      the authenticated response — never from localStorage or local state.
//   3. Redirects unauthenticated users to the login page.
//   4. Bootstraps the role-specific navigation from backend identity only.
//
// Until then, the app renders in a demo-safe read-only shell using the
// MASTER role default (no real data, no identity claims, no switching).
// =============================================================================

import { state } from "./state.js";
import { renderShell } from "./router.js";
import {
  registerServiceWorker,
} from "./updateManager.js";

function boot() {
  // Apply persisted font-size preference before first render.
  document.documentElement.setAttribute(
    "data-font-size",
    state.settings.fontSize
  );

  // Render the initial shell.
  // The role currently defaults to MASTER in state.js because no
  // /auth/me bootstrap exists yet. This is a known gap (Stage 2 / Batch
  // frontend-auth). Do not add role-switching logic here.
  renderShell();

  registerServiceWorker().catch(() => {
    // PWA support must never prevent the app from loading.
  });
}

document.addEventListener("DOMContentLoaded", boot);
