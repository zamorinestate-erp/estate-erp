// =============================================================================
// SESSION MANAGEMENT — SCR-023 Canonical implementation
//
// STATE MACHINE RULES (critical — never break these):
//   LOADING              → API call in flight; show spinner, no content
//   LOADED_WITH_SESSIONS → API succeeded, sessions.length > 0; show sessions
//   LOADED_EMPTY         → API succeeded, sessions.length === 0; show empty state
//   AUTH_ERROR           → API failed with auth/network error; show error ONLY
//   NETWORK_ERROR        → Network unreachable; show error ONLY
//
// BUG THAT WAS FIXED:
//   Before this revision the error path called renderSessionManagement({ error })
//   which also had sessions = [] — rendering BOTH the error banner AND the
//   "No active sessions" message simultaneously. Fixed by explicit state strings.
//
// ENDPOINT: /settings/sessions (SCR-023)  — NOT /auth/sessions
// =============================================================================

import { apiDelete, apiGet, apiPost } from "./apiClient.js";
import { showToast } from "./components.js";
import { clearPublicAppCaches } from "./updateManager.js";

// Session state discriminants — checked by renderSessionManagement, never inferred
const SESSION_STATES = {
  LOADING: "LOADING",
  LOADED_WITH_SESSIONS: "LOADED_WITH_SESSIONS",
  LOADED_EMPTY: "LOADED_EMPTY",
  AUTH_ERROR: "AUTH_ERROR",
  NETWORK_ERROR: "NETWORK_ERROR",
};

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function formatDateTime(value) {
  if (!value) return "Not available";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Not available";
  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Kolkata",
  }).format(date);
}

/**
 * Render the session management card.
 * The 'sessionState' discriminant exclusively controls which body is shown.
 * Never derive display state from both error and sessions simultaneously.
 *
 * @param {object} opts
 * @param {string} opts.sessionState  – One of SESSION_STATES
 * @param {Array}  opts.sessions      – Session records (used only in LOADED_WITH_SESSIONS)
 * @param {string} opts.currentSessionId
 * @param {string} opts.errorMessage  – Human-readable error (used only in AUTH_ERROR/NETWORK_ERROR)
 * @param {number} opts.totalActive
 */
export function renderSessionManagement({
  sessionState = SESSION_STATES.LOADING,
  sessions = [],
  currentSessionId = null,
  errorMessage = "",
  totalActive = 0,
} = {}) {
  const isLoading = sessionState === SESSION_STATES.LOADING;

  function bodyHtml() {
    switch (sessionState) {
      case SESSION_STATES.LOADING:
        return `
          <div class="session-skeleton-wrap" style="margin-top:8px;">
            <div class="muted-white" style="font-size:12px;">Loading sessions…</div>
            <div style="height:4px; background:var(--color-accent-mint-bright); border-radius:2px; width:40%; margin-top:8px; animation:pulse 1.4s ease-in-out infinite;"></div>
          </div>`;

      case SESSION_STATES.AUTH_ERROR:
        // NEVER show session list in this state — error is the only body
        return `
          <div class="login-error" style="margin-top:8px;">
            <strong>Could not load sessions.</strong>
            ${escapeHtml(errorMessage) ? `<br><span style="font-size:11px;">${escapeHtml(errorMessage)}</span>` : ""}
          </div>
          <div class="muted-white" style="font-size:11.5px; margin-top:10px;">
            If this persists, check your connection or sign out and sign back in.
          </div>`;

      case SESSION_STATES.NETWORK_ERROR:
        // NEVER show session list or empty-state in this state
        return `
          <div class="login-error" style="margin-top:8px;">
            <strong>Connection error.</strong>
            ${escapeHtml(errorMessage) ? `<br><span style="font-size:11px;">${escapeHtml(errorMessage)}</span>` : ""}
          </div>
          <div class="muted-white" style="font-size:11.5px; margin-top:10px;">
            Please check your network connection and try again.
          </div>`;

      case SESSION_STATES.LOADED_EMPTY:
        // API succeeded → show explicit empty state — NEVER show error in this state
        return `
          <div class="muted-white" style="margin-top:8px; font-size:12px;">
            No other active sessions found. You are signed in on this device only.
          </div>`;

      case SESSION_STATES.LOADED_WITH_SESSIONS:
        // Render session list — NEVER show error or empty-state in this state
        return sessions.map((session) => {
          const current = session.sessionId === currentSessionId;
          const device = session.device || {};
          const parts = [device.deviceType, device.operatingSystem, device.browser].filter(Boolean);
          const details = parts.join(" · ");
          return `
            <div class="session-row" style="padding:12px 0; border-bottom:1px solid rgba(255,255,255,0.08);">
              <div class="flex justify-between items-center" style="gap:12px;">
                <div style="flex:1; min-width:0;">
                  <div style="color:#fff; font-size:12.5px; font-weight:600; display:flex; align-items:center; gap:6px; flex-wrap:wrap;">
                    ${escapeHtml(device.deviceName || "Unknown device")}
                    ${current ? `<span class="pill pill-mint">This device</span>` : ""}
                  </div>
                  ${details ? `<div class="muted-white" style="font-size:11px; margin-top:3px;">${escapeHtml(details)}</div>` : ""}
                  <div class="muted-white" style="font-size:10.5px; margin-top:3px;">
                    Last active: ${escapeHtml(formatDateTime(session.lastActivityAt))}
                  </div>
                  ${session.approximateLocation
                    ? `<div class="muted-white" style="font-size:10px; margin-top:2px;">📍 ${escapeHtml(session.approximateLocation)}</div>`
                    : ""}
                </div>
                <button
                  class="btn btn-ghost btn-sm"
                  data-session-id="${escapeHtml(session.sessionId)}"
                  data-session-current="${current ? "true" : "false"}"
                  title="${current ? "Sign out from this device" : "Revoke access for this device"}"
                  type="button"
                >
                  ${current ? "Sign out" : "Revoke"}
                </button>
              </div>
            </div>`;
        }).join("");

      default:
        return `<div class="muted-white" style="margin-top:8px; font-size:12px;">Unexpected state: ${escapeHtml(sessionState)}</div>`;
    }
  }

  const showSignOutAll = sessionState === SESSION_STATES.LOADED_WITH_SESSIONS
    || sessionState === SESSION_STATES.LOADED_EMPTY;

  return `
    <div class="glass" style="padding:20px; margin-top:16px;" id="session-management-card">
      <div class="flex justify-between items-center" style="margin-bottom:4px;">
        <div>
          <div style="color:#fff; font-weight:600; font-size:13.5px;">Active Sessions &amp; Devices</div>
          <div class="muted-white" style="font-size:11.5px; margin-top:3px;">
            Review devices currently signed in to your account.
            ${sessionState === SESSION_STATES.LOADED_WITH_SESSIONS
              ? `<span style="color:var(--color-accent-mint-bright);">${totalActive} active</span>`
              : ""}
          </div>
        </div>
        <button
          class="btn btn-ghost btn-sm"
          data-session-refresh
          ${isLoading ? "disabled" : ""}
          type="button"
        >
          Refresh
        </button>
      </div>

      ${bodyHtml()}

      ${showSignOutAll ? `
        <div class="flex justify-end" style="margin-top:14px; gap:8px; flex-wrap:wrap;">
          ${sessionState === SESSION_STATES.LOADED_WITH_SESSIONS ? `
            <button class="btn btn-ghost btn-sm" data-session-revoke-others type="button">
              Sign out other devices
            </button>` : ""}
          <button class="btn btn-ghost btn-sm" data-session-logout-all type="button">
            Sign out all devices
          </button>
        </div>` : ""}
    </div>`;
}

/**
 * Load session management — uses the SCR-023 /settings/sessions endpoint.
 * Applies correct state machine — never conflates error + empty states.
 */
export async function loadSessionManagement(root) {
  if (!root) return;

  root.innerHTML = renderSessionManagement({
    sessionState: SESSION_STATES.LOADING,
  });

  try {
    const payload = await apiGet("/settings/sessions");
    const serverState = payload?.data?.sessionState;
    const sessions = Array.isArray(payload?.data?.sessions) ? payload.data.sessions : [];
    const currentSessionId = payload?.data?.currentSessionId || null;
    const totalActive = payload?.data?.totalActive || sessions.length;

    // Use the server's explicit state discriminant — never guess from array length + error combo
    let sessionState;
    if (serverState === "LOADED_WITH_SESSIONS" && sessions.length > 0) {
      sessionState = SESSION_STATES.LOADED_WITH_SESSIONS;
    } else if (serverState === "LOADED_EMPTY" || sessions.length === 0) {
      sessionState = SESSION_STATES.LOADED_EMPTY;
    } else {
      sessionState = SESSION_STATES.LOADED_WITH_SESSIONS;
    }

    root.innerHTML = renderSessionManagement({
      sessionState,
      sessions,
      currentSessionId,
      totalActive,
    });
  } catch (err) {
    // Differentiate auth errors from network errors
    const isAuthError = err?.status === 401 || err?.status === 403;
    root.innerHTML = renderSessionManagement({
      sessionState: isAuthError ? SESSION_STATES.AUTH_ERROR : SESSION_STATES.NETWORK_ERROR,
      errorMessage: err?.message || "Could not load active sessions.",
    });
  }

  wireSessionManagement(root);
}

export function wireSessionManagement(root) {
  if (!root) return;

  // Refresh button
  root.querySelector("[data-session-refresh]")?.addEventListener("click", () => {
    loadSessionManagement(root);
  });

  // Per-session revoke/sign-out buttons
  root.querySelectorAll("[data-session-id]").forEach((button) => {
    button.addEventListener("click", async () => {
      const sessionId = button.dataset.sessionId;
      const isCurrent = button.dataset.sessionCurrent === "true";
      if (!sessionId) return;

      button.disabled = true;
      try {
        if (isCurrent) {
          // Current session → sign out via auth endpoint, then reload
          await apiPost("/auth/logout");
          await clearPublicAppCaches();
          window.location.reload();
          return;
        }

        await apiDelete(`/settings/sessions/${encodeURIComponent(sessionId)}`);
        showToast("Session revoked successfully.", "mint");
        await loadSessionManagement(root);
      } catch (err) {
        button.disabled = false;
        showToast(err?.message || "Could not revoke session.", "coral");
      }
    });
  });

  // Revoke others (keep current session)
  root.querySelector("[data-session-revoke-others]")?.addEventListener("click", async (evt) => {
    const btn = evt.currentTarget;
    btn.disabled = true;
    try {
      const result = await apiPost("/settings/sessions/revoke-others");
      showToast(result?.message || "Other sessions revoked.", "mint");
      await loadSessionManagement(root);
    } catch (err) {
      btn.disabled = false;
      showToast(err?.message || "Could not revoke other sessions.", "coral");
    }
  });

  // Sign out all devices
  root.querySelector("[data-session-logout-all]")?.addEventListener("click", async (evt) => {
    const btn = evt.currentTarget;
    btn.disabled = true;
    try {
      await apiPost("/auth/logout-all");
      await clearPublicAppCaches();
      window.location.reload();
    } catch (err) {
      btn.disabled = false;
      showToast(err?.message || "Could not sign out all devices.", "coral");
    }
  });
}
