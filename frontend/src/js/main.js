// =============================================================================
// ZAMORIN CAFE ERP — ENTRY POINT
//
// AUTHENTICATED BOOT SEQUENCE (Stage 8 Prerequisite):
// On DOMContentLoaded, the frontend calls GET /api/v1/auth/me:
//   1. Resolves authenticated identity and role from backend session.
//   2. Sets state.role and state.auth from backend user object.
//   3. Renders the role-authorized navigation shell (Master, Owner, Cafe Admin, Staff).
//   4. If unauthenticated, displays a clean sign-in prompt (no fake MASTER fallback).
// =============================================================================

import { state, setState } from "./state.js";
import { NAVIGATION } from "./navigation.js";
import { renderShell } from "./router.js";
import { apiGet, apiPost, getOrCreateDeviceId, setStepUpAuthenticationHandler } from "./apiClient.js";
import { registerServiceWorker } from "./updateManager.js";
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

function prepareAuthScreen(appEl) {
  appEl.classList.add("auth-screen");
  appEl.classList.remove("shell-minimal");
  delete appEl.dataset.shellRole;
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

async function boot() {
  document.documentElement.setAttribute(
    "data-font-size",
    state.settings.fontSize
  );

  const appEl = document.getElementById("app");
  const alreadyHasLoginForm = Boolean(appEl && appEl.querySelector("#login-form"));

  if (!alreadyHasLoginForm) {
    renderLoadingScreen();
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

    const initialRoute = roleNavigation.items[0].route;

    setState({
      auth: {
        authenticated: true,
        loading: false,
        user,
        authentication: auth,
        error: null,
      },
      role: normalizedRole,
      route: initialRoute,
    });

    renderShell();
  } catch (error) {
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

    renderUnauthenticatedScreen();
  }

  registerServiceWorker().catch(() => {
    // PWA support must never prevent the app from loading.
  });
}

if (typeof document !== "undefined") {
  // Wire initial login form if already rendered in DOM
  const initialApp = document.getElementById("app");
  if (initialApp && initialApp.querySelector("#login-form")) {
    renderUnauthenticatedScreen();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot, { once: true });
  } else {
    boot();
  }
}

