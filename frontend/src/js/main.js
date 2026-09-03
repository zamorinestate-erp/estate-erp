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
//
// PRODUCTION SECURITY:
//   1. DEV PREVIEW personas are NEVER used on public/production origins.
//   2. Production requires a valid authenticated /api/v1/auth/me session.
//   3. Unauthenticated production users are sent to the real login screen.
//   4. Development step-up auto-approval is restricted to localhost only.
// =============================================================================

import { state, setState } from "./state.js";
import { NAVIGATION, ROLES, isRouteAllowed } from "./navigation.js";
import { renderShell, navigate } from "./router.js";
import {
  apiGet,
  apiPost,
  getAccessToken,
  getOrCreateDeviceId,
  setStepUpAuthenticationHandler,
  setAccessToken,
  clearAllAuthTokens,
} from "./apiClient.js";
import { registerServiceWorker } from "./updateManager.js";
import { initLanguage } from "./i18n.js";
import {
  renderLogin,
  wireLogin,
  renderPasswordResetRequest,
  wirePasswordResetRequest,
  renderPasswordResetVerify,
  wirePasswordResetVerify,
  renderPasswordResetFinal,
  wirePasswordResetFinal,
} from "./pages/login.js";
import {
  renderLoginPage2,
  wireLoginPage2,
  renderPasswordResetRequest2,
  wirePasswordResetRequest2,
  renderPasswordResetVerify2,
  wirePasswordResetVerify2,
  renderPasswordResetFinal2,
  wirePasswordResetFinal2,
  renderMfaChallenge2,
  wireMfaChallenge2,
  showGlassAlert,
} from "./pages/login2.js?v=3.3.4";
import "./responsiveAuditor.js";

// =============================================================================
// DEVELOPMENT PREVIEW USERS
// =============================================================================
//
// These fixtures are strictly development/local-preview identities.
//
// IMPORTANT:
// They must NEVER be used as an authentication fallback on public,
// staging, preview-deployment, or production origins.
// =============================================================================

export const DEV_PREVIEW_USERS = Object.freeze({
  master: Object.freeze({
    _id: "MU-0001",
    id: "MU-0001",
    name: "Zamorin Primary Master",
    email: "pradeeshk331@gmail.com",
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
    primaryCafeName: "Main Outlet",
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

// =============================================================================
// DEVELOPMENT ROLE RESOLUTION
// =============================================================================

export function getRequestedDevRole() {
  if (typeof window === "undefined") {
    return "master";
  }

  const params = new URLSearchParams(window.location.search);

  const requested = (
    params.get("role") ||
    params.get("devRole") ||
    localStorage.getItem("zamorin-dev-role") ||
    "master"
  ).toLowerCase();

  const authority = (params.get("authority") || "").toLowerCase();

  if (
    requested === "staff" ||
    requested === "employee" ||
    requested === "normal-employee"
  ) {
    return "staff";
  }

  if (requested === "owner") {
    return "owner";
  }

  if (
    requested === "admin" ||
    requested === "cafe_admin" ||
    requested === "cafe-admin"
  ) {
    return "cafe_admin";
  }

  if (
    requested === "master_normal" ||
    (requested === "master" && authority === "normal")
  ) {
    return "master_normal";
  }

  return "master";
}

// =============================================================================
// ENVIRONMENT SECURITY
// =============================================================================

export function isLocalDevelopmentOrigin() {
  if (typeof window === "undefined") {
    return true;
  }

  const hostname = window.location.hostname;

  return (
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname === "0.0.0.0"
  );
}

export function isDirectDashboardAllowed() {
  if (typeof window === "undefined") {
    return true;
  }

  return isLocalDevelopmentOrigin();
}

export function renderProductionFailClosedScreen() {
  if (typeof document === "undefined") {
    return;
  }

  const appEl = document.getElementById("app");

  if (!appEl) {
    return;
  }

  appEl.innerHTML = `
    <div
      style="
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        min-height: 100vh;
        font-family: sans-serif;
        background: #0b0f19;
        color: #f8fafc;
        text-align: center;
        padding: 24px;
      "
    >
      <h1 style="color: #ef4444; margin-bottom: 12px;">
        Production Security Guard
      </h1>

      <p
        style="
          color: #94a3b8;
          max-width: 480px;
          line-height: 1.5;
        "
      >
        Fail-closed: Direct dashboard bypass is strictly forbidden in
        production environments. Please authenticate with valid credentials.
      </p>
    </div>
  `;
}

// =============================================================================
// AUTHENTICATION HELPERS
// =============================================================================

export async function handleLoginSubmit({
  organisationId,
  email,
  password,
}) {
  const result = await apiPost("/auth/login", {
    organisationId,
    email,
    password,
    identifier: email,
  });

  if (result?.data?.accessToken) {
    setAccessToken(result.data.accessToken);
  }

  return result;
}

export async function handlePasswordResetRequest({
  organisationId,
  email,
}) {
  const result = await apiPost("/auth/password/forgot", {
    organisationId,
    email,
  });

  return result;
}

export async function handlePasswordResetVerify({
  organisationId,
  email,
  code,
}) {
  const result = await apiPost("/auth/password/reset/verify", {
    organisationId,
    email,
    code,
  });

  const challengeId = result?.data?.challengeId;
  const resetToken = result?.data?.resetToken;

  if (!challengeId || !resetToken) {
    throw new Error(
      "Password reset credentials missing in response."
    );
  }

  return {
    challengeId,
    resetToken,
  };
}

export async function handlePasswordResetFinal({
  organisationId,
  challengeId,
  resetToken,
  newPassword,
}) {
  const result = await apiPost("/auth/password/reset", {
    organisationId,
    challengeId,
    resetToken,
    newPassword,
  });

  return result;
}

export function isLegacyLoginRequested() {
  if (typeof window === "undefined") return false;
  return new URLSearchParams(window.location.search).get("legacyLogin") === "true";
}

function resolveAuthenticatedRole(user) {
  const rawRole = String(user?.role || "").toUpperCase();

  if (rawRole === "MASTER") {
    return {
      role: "master",
      isPrimaryMaster: Boolean(user?.isPrimaryMaster),
    };
  }

  if (rawRole === "OWNER") {
    return {
      role: "owner",
      isPrimaryMaster: false,
    };
  }

  if (rawRole === "CAFE_ADMIN" || rawRole === "ADMIN") {
    return {
      role: "cafe_admin",
      isPrimaryMaster: false,
    };
  }

  if (rawRole === "STAFF" || rawRole === "EMPLOYEE") {
    return {
      role: "staff",
      isPrimaryMaster: false,
    };
  }

  // Fail closed to the least-privileged application navigation context.
  return {
    role: "staff",
    isPrimaryMaster: false,
  };
}

// =============================================================================
// AUTHENTICATION SCREEN
// =============================================================================

export function mountAuthScreen(screen = "login", params = {}) {
  if (typeof document === "undefined") return;

  const appEl = document.getElementById("app");
  if (!appEl) return;

  // Authentication screens must never display the development banner.
  document.getElementById("zamorin-dev-preview-banner")?.remove();

  appEl.className = "auth-screen";
  delete appEl.dataset.shellRole;

  const useLegacy = isLegacyLoginRequested();

  if (screen === "login") {
    if (useLegacy) {
      appEl.innerHTML = renderLogin(params);
      wireLogin(appEl, {
        onSubmit: async ({ organisationId, email, password }) => {
          await handleCompleteLoginFlow({ organisationId, email, password });
        },
        onForgotPassword: ({ organisationId, email }) => {
          mountAuthScreen("forgot", { organisationId, email });
        }
      });
    } else {
      appEl.innerHTML = renderLoginPage2(params);
      wireLoginPage2(appEl, {
        onSubmit: async ({ organisationId, email, password }) => {
          await handleCompleteLoginFlow({ organisationId, email, password });
        },
        onForgotPassword: ({ organisationId, email }) => {
          mountAuthScreen("forgot", { organisationId, email });
        },
        onCafeOps: () => {
          window.location.href = "/cafe-operations/cafe-operations.html";
        }
      });
    }
  } else if (screen === "mfa") {
    appEl.innerHTML = renderMfaChallenge2(params);
    wireMfaChallenge2(appEl, {
      onSubmit: async ({ code }) => {
        try {
          const res = await apiPost("/auth/mfa/verify", {
            code,
            tempToken: params.tempToken,
            challengeId: params.challengeId
          });

          const accessToken = res?.data?.accessToken || res?.data?.token;
          if (accessToken) {
            setAccessToken(accessToken);
          }
          const user = res?.data?.user;
          if (user) {
            handleAuthenticatedUserSession(user);
            return;
          }
          window.location.hash = "#dashboard";
          await boot();
        } catch (err) {
          throw new Error(err.userMessage || err.message || "Invalid MFA code. Please try again.");
        }
      },
      onBack: () => mountAuthScreen("login")
    });
  } else if (screen === "forgot") {
    if (useLegacy) {
      appEl.innerHTML = renderPasswordResetRequest(params);
      wirePasswordResetRequest(appEl, {
        onSubmit: async ({ organisationId, email }) => {
          const res = await handlePasswordResetRequest({ organisationId, email });
          mountAuthScreen("verify", { email, challengeId: res?.data?.challengeId });
        },
        onBack: () => mountAuthScreen("login")
      });
    } else {
      appEl.innerHTML = renderPasswordResetRequest2(params);
      wirePasswordResetRequest2(appEl, {
        onSubmit: async ({ organisationId, email }) => {
          const res = await handlePasswordResetRequest({ organisationId, email });
          mountAuthScreen("verify", { email, challengeId: res?.data?.challengeId });
        },
        onBack: () => mountAuthScreen("login")
      });
    }
  } else if (screen === "verify") {
    if (useLegacy) {
      appEl.innerHTML = renderPasswordResetVerify(params);
      wirePasswordResetVerify(appEl, {
        onSubmit: async ({ code }) => {
          const res = await handlePasswordResetVerify({
            challengeId: params.challengeId,
            code
          });
          mountAuthScreen("reset", {
            resetToken: res.resetToken,
            challengeId: res.challengeId
          });
        },
        onBack: () => mountAuthScreen("forgot")
      });
    } else {
      appEl.innerHTML = renderPasswordResetVerify2(params);
      wirePasswordResetVerify2(appEl, {
        onSubmit: async ({ code }) => {
          const res = await handlePasswordResetVerify({
            challengeId: params.challengeId,
            code
          });
          mountAuthScreen("reset", {
            resetToken: res.resetToken,
            challengeId: res.challengeId
          });
        },
        onBack: () => mountAuthScreen("forgot")
      });
    }
  } else if (screen === "reset") {
    if (useLegacy) {
      appEl.innerHTML = renderPasswordResetFinal(params);
      wirePasswordResetFinal(appEl, {
        onSubmit: async ({ newPassword }) => {
          await handlePasswordResetFinal({
            challengeId: params.challengeId,
            resetToken: params.resetToken,
            newPassword
          });
          mountAuthScreen("login", { notice: "Password updated successfully. Please sign in with your new password." });
        },
        onCancel: () => mountAuthScreen("login")
      });
    } else {
      appEl.innerHTML = renderPasswordResetFinal2(params);
      wirePasswordResetFinal2(appEl, {
        onSubmit: async ({ newPassword }) => {
          await handlePasswordResetFinal({
            challengeId: params.challengeId,
            resetToken: params.resetToken,
            newPassword
          });
          mountAuthScreen("login", { notice: "Password updated successfully. Please sign in with your new password." });
        },
        onCancel: () => mountAuthScreen("login")
      });
    }
  }
}

async function handleCompleteLoginFlow({ organisationId, email, password }) {
  try {
    const res = await apiPost("/auth/login", {
      organisationId,
      email,
      password,
      identifier: email,
      device: {
        deviceId: getOrCreateDeviceId(),
        deviceName: "Browser Client",
        deviceType: "DESKTOP"
      }
    });

    // Check if MFA is required
    if (res?.data?.mfaRequired || res?.status === 202 || (res?.data?.challengeId && !res?.data?.accessToken)) {
      mountAuthScreen("mfa", {
        email,
        challengeId: res?.data?.challengeId,
        tempToken: res?.data?.tempToken || res?.data?.token
      });
      return;
    }

    const accessToken = res?.data?.accessToken || res?.data?.token;
    if (accessToken) {
      setAccessToken(accessToken);
    }
    const user = res?.data?.user;
    if (user) {
      handleAuthenticatedUserSession(user);
      return;
    }
    window.location.hash = "#dashboard";
    boot();
  } catch (err) {
    const userMsg = err.userMessage || err.message || "Invalid credentials. Please check your Organisation ID, email, and password.";
    throw new Error(userMsg);
  }
}

function handleAuthenticatedUserSession(user) {
  const { role, isPrimaryMaster } = resolveAuthenticatedRole(user);
  const landingRoute = (role === "staff") ? "staff-home" : "dashboard";

  setState({
    auth: { authenticated: true, user, loading: false },
    user,
    role,
    isPrimaryMaster,
    route: landingRoute,
  });

  window.location.hash = `#${landingRoute}`;
  boot();
}

function renderDevPreviewBanner() {
  document.getElementById("zamorin-dev-preview-banner")?.remove();
}

// =============================================================================
// LOADING SCREEN
// =============================================================================

function renderLoadingScreen() {
  const appEl =
    document.getElementById("app");

  if (!appEl) {
    return;
  }

  appEl.innerHTML = `
    <div
      style="
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        min-height: 100vh;
        font-family: sans-serif;
        background: #0b0f19;
        color: #f8fafc;
      "
    >
      <div
        style="
          width: 44px;
          height: 44px;
          border: 3px solid rgba(255,255,255,0.1);
          border-top-color: #d4a359;
          border-radius: 50%;
          animation: spin 0.8s linear infinite;
        "
      ></div>

      <p
        style="
          margin-top: 16px;
          color: #94a3b8;
          font-size: 14px;
          font-weight: 500;
        "
      >
        Loading Zamorin Café ERP...
      </p>

      <style>
        @keyframes spin {
          to {
            transform: rotate(360deg);
          }
        }
      </style>
    </div>
  `;
}

// =============================================================================
// STEP-UP AUTHENTICATION
// =============================================================================
//
// The historical development environment automatically approved step-up
// authentication.
//
// SECURITY REQUIREMENT:
// Never install that auto-approver on Vercel, staging, production,
// or another remote/public host.
//
// Production therefore retains apiClient.js's normal step-up behaviour.
// =============================================================================

if (isDirectDashboardAllowed()) {
  setStepUpAuthenticationHandler(
    async () => Promise.resolve()
  );
}

// =============================================================================
// AUTHENTICATED SESSION BOOT
// =============================================================================

function applyAuthenticatedUser(
  user,
  requestedRoute = ""
) {
  const {
    role,
    isPrimaryMaster,
  } = resolveAuthenticatedRole(user);

  const roleNavigation =
    NAVIGATION[role] ||
    NAVIGATION.staff;

  const defaultRoute =
    roleNavigation?.items?.[0]?.route ||
    (
      role === "staff"
        ? "staff-home"
        : "dashboard"
    );

  const initialRoute =
    requestedRoute &&
    isRouteAllowed(
      role,
      requestedRoute,
      isPrimaryMaster
    )
      ? requestedRoute
      : defaultRoute;

  setState({
    auth: {
      authenticated: true,
      loading: false,
      user,
      authentication: null,
      error: null,
    },

    user,
    isPrimaryMaster,
    role,
    route: initialRoute,
  });

  return {
    role,
    isPrimaryMaster,
    initialRoute,
  };
}

// =============================================================================
// APPLICATION BOOT (FAST-PATH ZERO-LATENCY)
// =============================================================================

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

  // Permanently ensure no dev preview banner exists
  document.getElementById("zamorin-dev-preview-banner")?.remove();

  const urlHash =
    typeof window !== "undefined" && window.location.hash
      ? window.location.hash.replace(/^#/, "")
      : "";

  const params =
    typeof window !== "undefined"
      ? new URLSearchParams(window.location.search)
      : null;

  // Direct Auth Screen Routing (0ms instant mount)
  if (urlHash === "login" || params?.get("auth") === "login") {
    mountAuthScreen("login");
    return;
  }
  if (urlHash === "forgot") {
    mountAuthScreen("forgot");
    return;
  }
  if (urlHash === "mfa") {
    mountAuthScreen("mfa");
    return;
  }

  // Active Authenticated Session Check
  const token = getAccessToken();

  if (token) {
    try {
      const payload = await apiGet("/auth/me");
      if (payload?.data?.user) {
        applyAuthenticatedUser(payload.data.user, urlHash);
        renderShell();
        registerServiceWorker().catch(() => {});
        return;
      }
    } catch (err) {
      clearAllAuthTokens();
    }
  }

  // Unauthenticated: Mount login screen immediately with ZERO latency!
  clearAllAuthTokens();
  setState({
    auth: {
      authenticated: false,
      loading: false,
      user: null,
      authentication: null,
      error: null,
    },
    user: null,
    isPrimaryMaster: false,
  });

  mountAuthScreen("login");
  registerServiceWorker().catch(() => {});
}

// =============================================================================
// HASH ROUTING
// =============================================================================

if (typeof window !== "undefined") {
  window.addEventListener("hashchange", () => {
    const rawHash = window.location.hash.replace(/^#/, "");
    if (rawHash === "login") {
      mountAuthScreen("login");
    } else if (rawHash === "forgot") {
      mountAuthScreen("forgot");
    } else if (rawHash === "mfa") {
      mountAuthScreen("mfa");
    } else if (rawHash && state.route !== rawHash) {
      navigate(rawHash);
    }
  });
}

// =============================================================================
// APPLICATION START
// =============================================================================

if (typeof document !== "undefined") {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot, { once: true });
  } else {
    boot();
  }
}
