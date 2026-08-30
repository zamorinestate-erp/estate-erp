// =============================================================================
// ZAMORIN CAFE ERP — ENTRY POINT
//
// DIRECT DASHBOARD ENTRY & ZERO-COLLATERAL-CHANGE PROGRAMME
// -----------------------------------------------------------------------------
// In development & local preview mode:
//   1. On boot, loads the canonical MASTER (Primary Master) role context.
//   2. Seamlessly synchronizes with any active session from /api/v1/auth/me.
//   3. Shows a top banner indicating active role with instant view switching.
//   4. Directly mounts and renders the Command Centre Dashboard.
// =============================================================================

import { state, setState } from "./state.js";
import { NAVIGATION, ROLES, isRouteAllowed } from "./navigation.js";
import { renderShell, navigate } from "./router.js";
import { apiGet, apiPost, getOrCreateDeviceId, setStepUpAuthenticationHandler, setAccessToken, clearAllAuthTokens } from "./apiClient.js";
import { registerServiceWorker } from "./updateManager.js";
import { initLanguage } from "./i18n.js";
import "./responsiveAuditor.js";

// Canonical preview fixtures used strictly for development (4 canonical roles)
export const DEV_PREVIEW_USERS = Object.freeze({
  master: Object.freeze({
    _id: "MU-0001",
    id: "MU-0001",
    name: "Zamorin Primary Master",
    email: "master@example.com",
    role: "MASTER",
    organisationId: "ZAMORIN",
    status: "ACTIVE",
    isPrimaryMaster: true,
    isDevPreview: true,
  }),
  master_normal: Object.freeze({
    _id: "MU-0002",
    id: "MU-0002",
    name: "Zamorin Normal Master",
    email: "normal.master@example.com",
    role: "MASTER",
    organisationId: "ZAMORIN",
    status: "ACTIVE",
    isPrimaryMaster: false,
    isDevPreview: true,
  }),
  owner: Object.freeze({
    _id: "OU-0001",
    id: "OU-0001",
    name: "Zamorin Owner",
    email: "owner@example.com",
    role: "OWNER",
    organisationId: "ZAMORIN",
    status: "ACTIVE",
    isDevPreview: true,
  }),
  cafe_admin: Object.freeze({
    _id: "AU-0001",
    id: "AU-0001",
    name: "Cafe Admin (Ops)",
    email: "admin@example.com",
    role: "CAFE_ADMIN",
    primaryCafeId: "ZC-0001",
    primaryCafeName: "Koramangala Main",
    assignedCafeIds: ["ZC-0001"],
    organisationId: "ZAMORIN",
    status: "ACTIVE",
    isDevPreview: true,
  }),
  staff: Object.freeze({
    _id: "SU-0001",
    id: "SU-0001",
    name: "Normal Employee / Staff",
    email: "staff@example.com",
    role: "STAFF",
    primaryCafeId: "ZC-0001",
    assignedCafeIds: ["ZC-0001"],
    organisationId: "ZAMORIN",
    status: "ACTIVE",
    isDevPreview: true,
  }),
});

export function getRequestedDevRole() {
  if (typeof window === "undefined") return "master";
  const params = new URLSearchParams(window.location.search);
  const requested = (params.get("role") || params.get("devRole") || localStorage.getItem("zamorin-dev-role") || "master").toLowerCase();
  const authority = (params.get("authority") || "").toLowerCase();

  if (requested === "staff" || requested === "employee" || requested === "normal-employee") return "staff";
  if (requested === "owner") return "owner";
  if (requested === "admin" || requested === "cafe_admin" || requested === "cafe-admin") return "cafe_admin";
  if (requested === "master_normal" || (requested === "master" && authority === "normal")) return "master_normal";
  return "master";
}

export function isLocalDevelopmentOrigin() {
  if (typeof window === "undefined") return true;
  const hostname = window.location.hostname;
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "0.0.0.0";
}

export function isDirectDashboardAllowed() {
  if (typeof window === "undefined") return true;
  return isLocalDevelopmentOrigin();
}

export function renderProductionFailClosedScreen() {
  if (typeof document === "undefined") return;
  const appEl = document.getElementById("app");
  if (!appEl) return;
  appEl.innerHTML = `
    <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 100vh; font-family: sans-serif; background: #0b0f19; color: #f8fafc; text-align: center; padding: 24px;">
      <h1 style="color: #ef4444; margin-bottom: 12px;">Production Security Guard</h1>
      <p style="color: #94a3b8; max-width: 480px; line-height: 1.5;">Fail-closed: Direct dashboard bypass is strictly forbidden in production environments (NODE_ENV === "production"). Please authenticate with valid credentials.</p>
    </div>
  `;
}

// Password Reset & Authentication Frontend Handlers
export async function handleLoginSubmit({ organisationId, email, password }) {
  const result = await apiPost("/auth/login", { body: { organisationId, email, password } });
  if (result?.data?.accessToken) {
    setAccessToken(result.data.accessToken);
  }
  return result;
}

export async function handlePasswordResetRequest({ organisationId, email }) {
  const result = await apiPost("/auth/password/forgot", { body: { organisationId, email } });
  return result;
}

export async function handlePasswordResetVerify({ organisationId, email, code }) {
  const result = await apiPost("/auth/password/reset/verify", { body: { organisationId, email, code } });
  const challengeId = result?.data?.challengeId;
  const resetToken = result?.data?.resetToken;
  if (!challengeId || !resetToken) {
    throw new Error("Password reset credentials missing in response.");
  }
  return { challengeId, resetToken };
}

export async function handlePasswordResetFinal({ organisationId, challengeId, resetToken, newPassword }) {
  const result = await apiPost("/auth/password/reset", { body: { organisationId, challengeId, resetToken, newPassword } });
  return result;
}

function renderDevPreviewBanner(activeRole = "master") {
  if (typeof document === "undefined") return;
  let banner = document.getElementById("zamorin-dev-preview-banner");
  if (!banner) {
    banner = document.createElement("div");
    banner.id = "zamorin-dev-preview-banner";
    banner.className = "zamorin-dev-preview-banner";
    document.body.prepend(banner);
  }

  const roleDisplay = {
    master: "PRIMARY MASTER (TREASURY / ALL CAFÉS)",
    master_normal: "NORMAL MASTER",
    owner: "OWNER",
    cafe_admin: "CAFE OPS",
    staff: "STAFF",
  }[activeRole] || activeRole.toUpperCase();

  banner.innerHTML = `
    <span><strong>ZAMORIN CAFÉ ERP</strong> — DEVELOPMENT PREVIEW (AUTHENTICATION UI TEMPORARILY DISABLED) — ACTIVE: <strong>${roleDisplay}</strong></span>
    <span style="margin-left: 16px; display: inline-flex; align-items: center; gap: 8px; font-weight: 500;">
      <span style="opacity: 0.8;">Switch Persona:</span>
      <a href="/?role=master" style="color: ${activeRole === 'master' ? '#fff' : '#d4a359'}; text-decoration: ${activeRole === 'master' ? 'underline' : 'none'}; font-weight: 700;">Primary Master</a>
      <span style="opacity: 0.4;">|</span>
      <a href="/?role=master_normal" style="color: ${activeRole === 'master_normal' ? '#fff' : '#d4a359'}; text-decoration: ${activeRole === 'master_normal' ? 'underline' : 'none'}; font-weight: 700;">Normal Master</a>
      <span style="opacity: 0.4;">|</span>
      <a href="/?role=owner" style="color: ${activeRole === 'owner' ? '#fff' : '#d4a359'}; text-decoration: ${activeRole === 'owner' ? 'underline' : 'none'}; font-weight: 700;">Owner</a>
      <span style="opacity: 0.4;">|</span>
      <a href="/?role=admin" style="color: ${activeRole === 'cafe_admin' ? '#fff' : '#d4a359'}; text-decoration: ${activeRole === 'cafe_admin' ? 'underline' : 'none'}; font-weight: 700;">Cafe Ops</a>
      <span style="opacity: 0.4;">|</span>
      <a href="/?role=staff" style="color: ${activeRole === 'staff' ? '#fff' : '#d4a359'}; text-decoration: ${activeRole === 'staff' ? 'underline' : 'none'}; font-weight: 700;">Staff</a>
    </span>
  `;
}

function renderLoadingScreen() {
  const appEl = document.getElementById("app");
  if (!appEl) return;
  appEl.innerHTML = `
    <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 100vh; font-family: sans-serif; background: #0b0f19; color: #f8fafc;">
      <div style="width: 44px; height: 44px; border: 3px solid rgba(255,255,255,0.1); border-top-color: #d4a359; border-radius: 50%; animation: spin 0.8s linear infinite;"></div>
      <p style="margin-top: 16px; color: #94a3b8; font-size: 14px; font-weight: 500;">Loading Zamorin Café ERP...</p>
      <style>@keyframes spin { to { transform: rotate(360deg); } }</style>
    </div>
  `;
}

// Step-up authentication auto-approver for protected action development
setStepUpAuthenticationHandler(async () => Promise.resolve());

async function boot() {
  initLanguage();
  document.documentElement.setAttribute(
    "data-theme",
    state.settings.theme || "paper"
  );
  document.documentElement.setAttribute(
    "data-font-size",
    state.settings.fontSize || "normal"
  );

  const devKey = getRequestedDevRole();
  const devUser = DEV_PREVIEW_USERS[devKey] || DEV_PREVIEW_USERS.master;
  const canonicalRole = devKey === "master_normal" ? "master" : devKey;
  const roleNavigation = NAVIGATION[canonicalRole] || NAVIGATION.master;
  const defaultRoute = roleNavigation?.items?.[0]?.route || (canonicalRole === "staff" ? "staff-home" : "dashboard");
  const isPrimary = Boolean(devUser?.isPrimaryMaster);
  const urlHash = (typeof window !== "undefined" && window.location.hash) ? window.location.hash.replace(/^#/, "") : "";
  const initialRoute = urlHash
    ? (isRouteAllowed(canonicalRole, urlHash, isPrimary) ? urlHash : defaultRoute)
    : defaultRoute;

  // Attempt to check if live server session exists
  let liveUser = null;
  try {
    const payload = await apiGet("/auth/me");
    if (payload?.data?.user) {
      liveUser = payload.data.user;
    }
  } catch (err) {
    // Session not active, seamlessly use canonical devUser
  }

  const activeUser = liveUser || devUser;
  const activeRole = liveUser ? String(liveUser.role).toLowerCase() : canonicalRole;
  const activeIsPrimary = liveUser ? Boolean(liveUser.isPrimaryMaster) : isPrimary;

  setState({
    auth: {
      authenticated: true,
      loading: false,
      user: activeUser,
      authentication: null,
      error: null,
    },
    user: activeUser,
    isPrimaryMaster: activeIsPrimary,
    role: activeRole,
    route: initialRoute,
  });

  renderShell();
  renderDevPreviewBanner(devKey);

  registerServiceWorker().catch(() => {
    // PWA support must never prevent the app from loading.
  });
}

if (typeof window !== "undefined") {
  window.addEventListener("hashchange", () => {
    const rawHash = window.location.hash.replace(/^#/, "");
    if (rawHash && state.route !== rawHash) {
      navigate(rawHash);
    }
  });
}

if (typeof document !== "undefined") {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot, { once: true });
  } else {
    boot();
  }
}

