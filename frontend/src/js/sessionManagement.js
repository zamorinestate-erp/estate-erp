// Canonical authenticated session-management UI shared by all roles.
import { apiDelete, apiGet, apiPost } from "./apiClient.js";
import { showToast } from "./components.js";
import { clearPublicAppCaches } from "./updateManager.js";

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

export function renderSessionManagement({
  sessions = [],
  currentSessionId = null,
  loading = false,
  error = "",
} = {}) {
  const active = sessions.filter((session) => session?.status === "ACTIVE");

  return `
    <div class="glass" style="padding:20px; margin-top:16px;">
      <div class="flex justify-between items-center" style="margin-bottom:12px;">
        <div>
          <div style="color:#fff; font-weight:600; font-size:13.5px;">Active Sessions &amp; Devices</div>
          <div class="muted-white" style="font-size:11.5px; margin-top:3px;">Review authenticated devices and revoke access you no longer use.</div>
        </div>
        <button class="btn btn-ghost" data-session-refresh ${loading ? "disabled" : ""}>Refresh</button>
      </div>
      ${error ? `<div class="login-error">${escapeHtml(error)}</div>` : ""}
      ${loading ? `<div class="muted-white">Loading active sessions...</div>` :
        active.length ? active.map((session) => {
          const current = session.sessionId === currentSessionId;
          const device = session.device || {};
          const details = [device.deviceType, device.operatingSystem, device.browser].filter(Boolean).join(" · ");
          return `
            <div style="padding:12px 0; border-bottom:1px solid rgba(255,255,255,0.08);">
              <div class="flex justify-between items-center" style="gap:12px;">
                <div>
                  <div style="color:#fff; font-size:12.5px; font-weight:600;">
                    ${escapeHtml(device.deviceName || "Unknown device")}
                    ${current ? `<span class="pill pill-mint" style="margin-left:6px;">Current session</span>` : ""}
                  </div>
                  <div class="muted-white" style="font-size:11px; margin-top:3px;">${escapeHtml(details || "Device details unavailable")}</div>
                  <div class="muted-white" style="font-size:10.5px; margin-top:3px;">Last activity: ${escapeHtml(formatDateTime(session.lastActivityAt))}</div>
                </div>
                <button class="btn btn-ghost" data-session-id="${escapeHtml(session.sessionId)}" data-session-current="${current ? "true" : "false"}">${current ? "Sign out" : "Revoke"}</button>
              </div>
            </div>`;
        }).join("") : `<div class="muted-white">No active sessions were returned by the server.</div>`}
      <div class="flex justify-end" style="margin-top:14px;">
        <button class="btn btn-ghost" data-session-logout-all ${loading ? "disabled" : ""}>Sign out all devices</button>
      </div>
    </div>`;
}

export async function loadSessionManagement(root) {
  if (!root) return;
  root.innerHTML = renderSessionManagement({ loading: true });

  try {
    const payload = await apiGet("/auth/sessions");
    root.innerHTML = renderSessionManagement({
      sessions: Array.isArray(payload?.data?.sessions) ? payload.data.sessions : [],
      currentSessionId: payload?.data?.currentSessionId || null,
    });
  } catch (error) {
    root.innerHTML = renderSessionManagement({
      error: error?.message || "Could not load active sessions.",
    });
  }

  wireSessionManagement(root);
}

export function wireSessionManagement(root) {
  root?.querySelector("[data-session-refresh]")?.addEventListener("click", () => {
    loadSessionManagement(root);
  });

  root?.querySelectorAll("[data-session-id]").forEach((button) => {
    button.addEventListener("click", async () => {
      const sessionId = button.dataset.sessionId;
      const isCurrent = button.dataset.sessionCurrent === "true";
      if (!sessionId) return;

      button.disabled = true;
      try {
        if (isCurrent) {
          await apiPost("/auth/logout");
          await clearPublicAppCaches();
          window.location.reload();
          return;
        }

        await apiDelete(`/auth/sessions/${encodeURIComponent(sessionId)}`);
        showToast("Session revoked successfully", "mint");
        await loadSessionManagement(root);
      } catch (error) {
        button.disabled = false;
        showToast(error?.message || "Could not revoke session", "coral");
      }
    });
  });

  root?.querySelector("[data-session-logout-all]")?.addEventListener("click", async (event) => {
    const button = event.currentTarget;
    button.disabled = true;

    try {
      await apiPost("/auth/logout-all");
      await clearPublicAppCaches();
      window.location.reload();
    } catch (error) {
      button.disabled = false;
      showToast(error?.message || "Could not sign out all devices", "coral");
    }
  });
}
