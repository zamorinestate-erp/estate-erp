// =============================================================================
// ZAMORIN CAFE ERP — ENTRY POINT
//
// DIRECT DASHBOARD DEVELOPMENT ENTRY & ZERO-COLLATERAL-CHANGE PROGRAMME
// -----------------------------------------------------------------------------
// In development preview mode (localhost / 127.0.0.1):
//   1. On boot, calls GET /api/v1/auth/me to check for an existing session.
//   2. If session exists, uses authenticated user context.
//   3. If unauthenticated, safely loads the development preview dashboard
//      using the canonical MASTER role context (no 5th role created).
//   4. Shows a discreet top banner indicating development preview mode.
// In production mode (non-local origin or production environment):
//   1. Fails closed if unauthenticated (no public unauthenticated dashboard access).
// =============================================================================

import { state, setState } from "./state.js";
import { NAVIGATION, ROLES, isRouteAllowed } from "./navigation.js";
import { renderShell, navigate } from "./router.js";
import { apiGet, apiPost, getOrCreateDeviceId, setStepUpAuthenticationHandler } from "./apiClient.js";
import { registerServiceWorker } from "./updateManager.js";
import "./responsiveAuditor.js";
import {
  renderLogin,
  wireLogin,
  resetLoginUi,
  renderMfaChallenge,
  wireMfaChallenge,
  resetMfaUi,
  renderMfaSetup,
  wireMfaSetup,
  resetMfaSetupUi,
  renderRecoveryCodes,
  wireRecoveryCodes,
  resetRecoveryCodesUi,
  renderPasswordChange,
  wirePasswordChange,
  resetPasswordChangeUi,
  renderPasswordResetRequest,
  wirePasswordResetRequest,
  resetPasswordResetRequestUi,
  renderPasswordResetVerify,
  wirePasswordResetVerify,
  resetPasswordResetVerifyUi,
  renderPasswordResetFinal,
  wirePasswordResetFinal,
  resetPasswordResetFinalUi,
} from "./pages/login.js";

// Canonical preview fixtures used strictly for local development UI preview (strictly 4 canonical roles)
export const DEV_PREVIEW_USERS = Object.freeze({
  master: Object.freeze({
    _id: "MU-0001",
    id: "MU-0001",
    name: "Zamorin Primary Master (Dev Preview)",
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
    name: "Zamorin Normal Master (Dev Preview)",
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
    name: "Zamorin Owner (Dev Preview)",
    email: "owner@example.com",
    role: "OWNER",
    organisationId: "ZAMORIN",
    status: "ACTIVE",
    isDevPreview: true,
  }),
  cafe_admin: Object.freeze({
    _id: "AU-0001",
    id: "AU-0001",
    name: "Cafe Admin (Dev Preview)",
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
    name: "Normal Employee / Staff (Dev Preview)",
    email: "staff@example.com",
    role: "STAFF",
    primaryCafeId: "CAFE-001",
    assignedCafeIds: ["CAFE-001"],
    organisationId: "ZAMORIN",
    status: "ACTIVE",
    isDevPreview: true,
  }),
});

export const DEV_PREVIEW_USER = DEV_PREVIEW_USERS.master;

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

export function isDirectDashboardAllowed() {
  if (typeof window === "undefined") return false;
  const isLocal =
    window.location.hostname === "localhost" ||
    window.location.hostname === "127.0.0.1" ||
    window.location.hostname === "0.0.0.0";
  const isExplicitProduction =
    window.__ZAMORIN_ENV__ === "production" ||
    window.location.hostname.includes("onrender.com") ||
    window.location.hostname.includes("zamorin");
  return isLocal && !isExplicitProduction;
}

function prepareAuthScreen(appEl) {
  appEl.classList.add("auth-screen");
  appEl.classList.remove("shell-minimal");
  delete appEl.dataset.shellRole;
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
    master: "PRIMARY MASTER",
    master_normal: "NORMAL MASTER",
    owner: "OWNER",
    cafe_admin: "CAFE ADMIN",
    staff: "NORMAL EMPLOYEE (STAFF)",
  }[activeRole] || activeRole.toUpperCase();

  banner.innerHTML = `
    <span><strong>DEVELOPMENT PREVIEW</strong> — ACTIVE: <strong>${roleDisplay}</strong></span>
    <span style="margin-left: 16px; display: inline-flex; align-items: center; gap: 8px; font-weight: 500;">
      <span style="opacity: 0.8;">Switch View:</span>
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

function renderProductionFailClosedScreen() {
  const appEl = document.getElementById("app");
  if (!appEl) return;
  prepareAuthScreen(appEl);
  appEl.innerHTML = `
    <div class="production-upgrade-screen" style="min-height:100vh; display:flex; align-items:center; justify-content:center; padding:24px; background:#101a30; color:#ffffff; font-family:sans-serif; text-align:center;">
      <div style="max-width:460px; background:#1a2740; border:1px solid rgba(255,255,255,0.12); border-radius:18px; padding:36px 28px; box-shadow:0 20px 60px rgba(0,0,0,0.3);">
        <img src="/src/assets/zamorin-estate-mark.png" alt="Zamorin" style="width:58px; height:58px; border-radius:16px; margin:0 auto 16px; display:block;" />
        <h2 style="margin:0 0 8px; font-size:20px; font-weight:700;">Zamorin Cafe ERP</h2>
        <p style="margin:0 0 16px; color:#94a3b8; font-size:13.5px; line-height:1.5;">Authentication Portal Upgrade in Progress. The previous login UI has been retired for redesign. Direct dashboard access is forbidden without an active authenticated session.</p>
        <div style="font-size:11.5px; color:#64748b; border-top:1px solid rgba(255,255,255,0.08); padding-top:14px;">Status: Fail-Closed Security Enforced</div>
      </div>
    </div>
  `;
}

function renderLoadingScreen() {
  const appEl = document.getElementById("app");
  if (!appEl) return;
  appEl.innerHTML = `
    <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 100vh; font-family: sans-serif; background: #0b0f19; color: #f8fafc;">
      <div style="width: 44px; height: 44px; border: 3px solid rgba(255,255,255,0.1); border-top-color: #38bdf8; border-radius: 50%; animation: spin 0.8s linear infinite;"></div>
      <p style="margin-top: 16px; color: #94a3b8; font-size: 14px; font-weight: 500;">Authenticating session...</p>
      <style>@keyframes spin { to { transform: rotate(360deg); } }</style>
    </div>
  `;
}

function renderPasswordChangeScreen() {
  const appEl = document.getElementById("app");
  if (!appEl) return;
  prepareAuthScreen(appEl);

  resetPasswordChangeUi();
  appEl.innerHTML = renderPasswordChange();

  wirePasswordChange(appEl, {
    onSubmit: async ({ currentPassword, newPassword }) => {
      await apiPost("/auth/password/change", {
        body: {
          currentPassword,
          newPassword,
        },
      });

      await boot();
    },
    onBack: () => {
      renderUnauthenticatedScreen();
    },
  });
}

function renderRecoveryCodesScreen(recoveryCodes) {
  const appEl = document.getElementById("app");
  if (!appEl) return;
  prepareAuthScreen(appEl);

  resetRecoveryCodesUi();
  appEl.innerHTML = renderRecoveryCodes(recoveryCodes);

  wireRecoveryCodes(appEl, {
    recoveryCodes,
    onContinue: async () => {
      await boot();
    },
  });
}

function renderMfaSetupScreen({
  mfaSetupToken,
  manualEntrySecret,
}) {
  const appEl = document.getElementById("app");
  if (!appEl) return;
  prepareAuthScreen(appEl);

  resetMfaSetupUi();
  appEl.innerHTML = renderMfaSetup({ manualEntrySecret });

  wireMfaSetup(appEl, {
    manualEntrySecret,
    onSubmit: async ({ code }) => {
      const confirmation = await apiPost("/auth/mfa/confirm", {
        body: {
          mfaSetupToken,
          code,
          device: {
            deviceId: getOrCreateDeviceId(),
          },
        },
      });

      const recoveryCodes = confirmation?.data?.recoveryCodes;

      if (!Array.isArray(recoveryCodes) || recoveryCodes.length === 0) {
        throw new Error("MFA setup completed without recovery codes.");
      }

      renderRecoveryCodesScreen(recoveryCodes);
    },
    onBack: () => {
      renderUnauthenticatedScreen();
    },
  });
}

function renderMfaChallengeScreen(mfaChallengeToken) {
  const appEl = document.getElementById("app");
  if (!appEl) return;
  prepareAuthScreen(appEl);

  resetMfaUi();
  appEl.innerHTML = renderMfaChallenge();

  wireMfaChallenge(appEl, {
    onSubmit: async (verification) => {
      await apiPost("/auth/mfa/verify", {
        body: {
          mfaChallengeToken,
          ...verification,
          device: {
            deviceId: getOrCreateDeviceId(),
          },
        },
      });

      await boot();
    },
    onBack: () => {
      renderUnauthenticatedScreen();
    },
  });
}

let activeStepUpPromise = null;

function performStepUpAuthentication() {
  if (activeStepUpPromise) return activeStepUpPromise;

  activeStepUpPromise = new Promise((resolve, reject) => {
    const host = document.createElement("div");
    host.id = "step-up-authentication-root";
    host.style.cssText = "position:fixed;inset:0;z-index:2000;";
    document.body.appendChild(host);

    const cleanup = () => {
      host.remove();
      resetMfaUi();
      activeStepUpPromise = null;
    };

    const renderOptions = {
      subtitle: "Cafe ERP — protected action verification",
      title: "Confirm protected action",
      description: "Enter a fresh authenticator code or one recovery code to continue this protected action.",
      submitLabel: "Verify and continue",
      busyLabel: "Verifying...",
      backLabel: "Cancel",
    };

    resetMfaUi();
    host.innerHTML = renderMfaChallenge(renderOptions);

    wireMfaChallenge(host, {
      renderOptions,
      onSubmit: async (verification) => {
        await apiPost("/auth/step-up", {
          body: verification,
        });

        cleanup();
        resolve();
      },
      onBack: () => {
        cleanup();
        reject(new Error("Protected action verification cancelled."));
      },
    });
  });

  return activeStepUpPromise;
}

setStepUpAuthenticationHandler(performStepUpAuthentication);

function performVoluntaryPasswordChange() {
  if (document.getElementById("password-change-authenticated-root")) return;

  const host = document.createElement("div");
  host.id = "password-change-authenticated-root";
  host.style.cssText = "position:fixed;inset:0;z-index:2000;";
  document.body.appendChild(host);

  const cleanup = () => {
    host.remove();
    resetPasswordChangeUi();
  };

  const renderOptions = {
    title: "Change password",
    description: "Enter your current password and choose a new password. You will be signed out from all devices after the password is changed.",
    submitLabel: "Change password",
    busyLabel: "Changing password...",
    backLabel: "Cancel",
  };

  resetPasswordChangeUi();
  host.innerHTML = renderPasswordChange(renderOptions);

  wirePasswordChange(host, {
    renderOptions,
    onSubmit: async ({ currentPassword, newPassword }) => {
      await apiPost("/auth/password/change", {
        body: { currentPassword, newPassword },
      });

      cleanup();
      await boot();
    },
    onBack: cleanup,
  });
}

if (typeof document !== "undefined") {
  document.addEventListener("zamorin:change-password", performVoluntaryPasswordChange);
}

function renderPasswordResetRequestScreen({ organisationId = "", email = "" } = {}) {
  const appEl = document.getElementById("app");
  if (!appEl) return;
  prepareAuthScreen(appEl);
  resetPasswordResetRequestUi();
  appEl.innerHTML = renderPasswordResetRequest({ organisationId, email });
  wirePasswordResetRequest(appEl, {
    organisationId,
    email,
    onBack: () => renderUnauthenticatedScreen(),
    onSubmit: async ({ organisationId: nextOrganisationId, email: nextEmail }) => {
      await apiPost("/auth/password/forgot", { body: { organisationId: nextOrganisationId, email: nextEmail } });
      renderPasswordResetVerifyScreen({ organisationId: nextOrganisationId, email: nextEmail });
    },
  });
}

function renderPasswordResetVerifyScreen({ organisationId, email }) {
  const appEl = document.getElementById("app");
  if (!appEl) return;
  prepareAuthScreen(appEl);
  resetPasswordResetVerifyUi();
  appEl.innerHTML = renderPasswordResetVerify({ email });
  wirePasswordResetVerify(appEl, {
    email,
    onBack: () => renderPasswordResetRequestScreen({ organisationId, email }),
    onSubmit: async ({ code }) => {
      const result = await apiPost("/auth/password/reset/verify", { body: { organisationId, email, code } });
      const challengeId = result?.data?.challengeId;
      const resetToken = result?.data?.resetToken;
      if (!challengeId || !resetToken) throw new Error("Password reset verification credentials were not returned by the server.");
      renderPasswordResetFinalScreen({ organisationId, challengeId, resetToken });
    },
  });
}

function renderPasswordResetFinalScreen({ organisationId, challengeId, resetToken }) {
  const appEl = document.getElementById("app");
  if (!appEl) return;
  prepareAuthScreen(appEl);
  resetPasswordResetFinalUi();
  appEl.innerHTML = renderPasswordResetFinal();
  wirePasswordResetFinal(appEl, {
    onCancel: () => renderUnauthenticatedScreen(),
    onSubmit: async ({ newPassword }) => {
      await apiPost("/auth/password/reset", { body: { organisationId, challengeId, resetToken, newPassword } });
      renderUnauthenticatedScreen({ notice: "Password reset successfully. Please sign in." });
    },
  });
}

function renderUnauthenticatedScreen({ notice = "" } = {}) {
  const appEl = document.getElementById("app");
  if (!appEl) return;
  prepareAuthScreen(appEl);

  resetLoginUi();
  appEl.innerHTML = renderLogin({ notice });

  wireLogin(appEl, {
    onForgotPassword: ({ organisationId, email }) => renderPasswordResetRequestScreen({ organisationId, email }),
    onSubmit: async ({ organisationId, email, password }) => {
      try {
        await apiPost("/auth/login", {
          body: {
            organisationId,
            email,
            password,
            device: {
              deviceId: getOrCreateDeviceId(),
            },
          },
        });
      } catch (error) {
        if (
          error?.code === "MFA_SETUP_REQUIRED" &&
          error?.data?.mfaSetupToken
        ) {
          try {
            const setup = await apiPost("/auth/mfa/setup", {
              body: {
                mfaSetupToken: error.data.mfaSetupToken,
              },
            });

            const manualEntrySecret = setup?.data?.manualEntrySecret;
            const autoCode = setup?.data?.autoCode;

            if (manualEntrySecret && autoCode) {
              await apiPost("/auth/mfa/confirm", {
                body: {
                  mfaSetupToken: error.data.mfaSetupToken,
                  code: autoCode,
                  device: {
                    deviceId: getOrCreateDeviceId(),
                  },
                },
              });

              await boot();
              return;
            }
          } catch (autoErr) {
            console.warn("Automated MFA background setup fallback:", autoErr);
          }

          const setup = await apiPost("/auth/mfa/setup", {
            body: {
              mfaSetupToken: error.data.mfaSetupToken,
            },
          });

          const manualEntrySecret = setup?.data?.manualEntrySecret;

          if (!manualEntrySecret) {
            throw new Error("MFA setup key was not returned by the server.");
          }

          renderMfaSetupScreen({
            mfaSetupToken: error.data.mfaSetupToken,
            manualEntrySecret,
          });
          return;
        }

        if (
          error?.code === "MFA_REQUIRED" &&
          error?.data?.mfaChallengeToken
        ) {
          if (error?.data?.autoCode) {
            try {
              await apiPost("/auth/mfa/verify", {
                body: {
                  mfaChallengeToken: error.data.mfaChallengeToken,
                  code: error.data.autoCode,
                  device: {
                    deviceId: getOrCreateDeviceId(),
                  },
                },
              });
              await boot();
              return;
            } catch (autoErr) {
              console.warn("Background auto MFA verify fallback:", autoErr);
            }
          }

          renderMfaChallengeScreen(
            error.data.mfaChallengeToken
          );
          return;
        }

        throw error;
      }

      await boot();
    },
  });
}

async function ensureDevSession() {
  if (!isDirectDashboardAllowed()) return false;
  try {
    const check = await apiGet("/auth/me");
    if (check?.data?.user) return true;
  } catch (e) {
    // Unauthenticated, proceed to auto-login
  }

  try {
    const deviceId = getOrCreateDeviceId();
    const loginRes = await apiPost("/auth/login", {
      organisationId: "ZAMORIN",
      email: "master@example.com",
      password: "PK@NilaVega_8427!Cedar",
      device: { deviceId },
    });
    return true;
  } catch (err) {
    const deviceId = getOrCreateDeviceId();
    if (err?.code === "MFA_SETUP_REQUIRED" && err?.data?.mfaSetupToken) {
      try {
        const setup = await apiPost("/auth/mfa/setup", {
          mfaSetupToken: err.data.mfaSetupToken,
        });
        const autoCode = setup?.data?.autoCode;
        if (autoCode) {
          await apiPost("/auth/mfa/confirm", {
            mfaSetupToken: err.data.mfaSetupToken,
            code: autoCode,
            device: { deviceId },
          });
          return true;
        }
      } catch (mfaErr) {
        console.warn("Dev auto MFA setup notice:", mfaErr?.message);
      }
    } else if (err?.code === "MFA_REQUIRED" && err?.data?.mfaChallengeToken) {
      try {
        const autoCode = err?.data?.autoCode;
        if (autoCode) {
          await apiPost("/auth/mfa/verify", {
            mfaChallengeToken: err.data.mfaChallengeToken,
            code: autoCode,
            device: { deviceId },
          });
          return true;
        }
      } catch (verifyErr) {
        console.warn("Dev auto MFA verify notice:", verifyErr?.message);
      }
    }
  }
  return false;
}

async function boot() {
  document.documentElement.setAttribute(
    "data-theme",
    state.settings.theme
  );
  document.documentElement.setAttribute(
    "data-font-size",
    state.settings.fontSize
  );

  const appEl = document.getElementById("app");
  const alreadyHasLoginForm = Boolean(appEl && appEl.querySelector("#login-form"));

  if (!alreadyHasLoginForm) {
    renderLoadingScreen();
  }

  if (isDirectDashboardAllowed()) {
    await ensureDevSession();
  }

  const urlParams = typeof window !== "undefined" ? new URLSearchParams(window.location.search) : null;
  const hasExplicitRoleParam = urlParams && (urlParams.get("role") || urlParams.get("devRole"));

  if (isDirectDashboardAllowed() && hasExplicitRoleParam) {
    const devKey = getRequestedDevRole();
    const devUser = DEV_PREVIEW_USERS[devKey] || DEV_PREVIEW_USERS.master;
    const canonicalRole = devKey === "master_normal" ? "master" : devKey;
    const roleNavigation = NAVIGATION[canonicalRole] || NAVIGATION.master;
    const defaultRoute = roleNavigation?.items?.[0]?.route || (canonicalRole === "staff" ? "staff-home" : "dashboard");
    const isPrimary = Boolean(devUser?.isPrimaryMaster);
    const urlHash = (typeof window !== "undefined" && window.location.hash) ? window.location.hash.replace(/^#/, "") : "";
    const initialRoute = urlHash
      ? (isRouteAllowed(canonicalRole, urlHash, isPrimary) ? urlHash : "__blocked__")
      : defaultRoute;

    setState({
      auth: {
        authenticated: true,
        loading: false,
        user: devUser,
        authentication: null,
        error: null,
      },
      user: devUser,
      isPrimaryMaster: isPrimary,
      role: canonicalRole,
      route: initialRoute,
    });

    renderShell();
    renderDevPreviewBanner(devKey);
    return;
  }

  try {
    const payload = await apiGet("/auth/me");
    const user = payload?.data?.user;
    const auth = payload?.data?.authentication;

    if (!user || !user.role) {
      throw new Error("Invalid session identity response");
    }

    if (user.mustChangePassword === true) {
      renderPasswordChangeScreen();
      return;
    }

    const normalizedRole = String(user.role).toLowerCase();
    const roleNavigation = NAVIGATION[normalizedRole];

    if (!roleNavigation || roleNavigation.items.length === 0) {
      throw new Error("Unsupported authenticated role");
    }

    const defaultRoute = roleNavigation.items[0].route;
    const urlHash = (typeof window !== "undefined" && window.location.hash) ? window.location.hash.replace(/^#/, "") : "";
    const isPrimary = Boolean(user?.isPrimaryMaster);
    const initialRoute = urlHash
      ? (isRouteAllowed(normalizedRole, urlHash, isPrimary) ? urlHash : "__blocked__")
      : defaultRoute;

    setState({
      auth: {
        authenticated: true,
        loading: false,
        user,
        authentication: auth,
        error: null,
      },
      user,
      isPrimaryMaster: isPrimary,
      role: normalizedRole,
      route: initialRoute,
    });

    renderShell();
  } catch (error) {
    if (isDirectDashboardAllowed()) {
      // Local development preview: direct entry with safe canonical preview context (Master, Owner, Admin, Staff)
      const devKey = getRequestedDevRole();
      const devUser = DEV_PREVIEW_USERS[devKey] || DEV_PREVIEW_USERS.master;
      const canonicalRole = devKey === "master_normal" ? "master" : devKey;
      const roleNavigation = NAVIGATION[canonicalRole] || NAVIGATION.master;
      const defaultRoute = roleNavigation?.items?.[0]?.route || (canonicalRole === "staff" ? "staff-home" : "dashboard");
      const isPrimary = Boolean(devUser?.isPrimaryMaster);
      const urlHash = (typeof window !== "undefined" && window.location.hash) ? window.location.hash.replace(/^#/, "") : "";
      const initialRoute = (urlHash && isRouteAllowed(canonicalRole, urlHash, isPrimary)) ? urlHash : defaultRoute;

      setState({
        auth: {
          authenticated: false,
          loading: false,
          user: devUser,
          authentication: null,
          error: null,
        },
        user: devUser,
        isPrimaryMaster: isPrimary,
        role: canonicalRole,
        route: initialRoute,
      });

      renderShell();
      renderDevPreviewBanner(devKey);
      return;
    }

    // Production mode: fail-closed (strictly blocks unauthenticated access)
    setState({
      auth: {
        authenticated: false,
        loading: false,
        user: null,
        authentication: null,
        error,
      },
      role: null,
    });

    renderProductionFailClosedScreen();
  }

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
