// =============================================================================
// ZAMORIN CAFE ERP — LOGIN PAGE 2.0 (PRESENTATION MODULE)
// -----------------------------------------------------------------------------
// Ultra-modern glassmorphic login presentation integrated with Zamorin ERP.
// Preserves existing authoritative backend security contracts.
// =============================================================================

"use strict";

export const BACKGROUND_IMAGES = [
  "/src/assets/login-backgrounds/bg-1.webp",
  "/src/assets/login-backgrounds/bg-2.webp",
  "/src/assets/login-backgrounds/bg-3.webp",
  "/src/assets/login-backgrounds/bg-4.webp",
  "/src/assets/login-backgrounds/bg-5.webp",
  "/src/assets/login-backgrounds/bg-6.webp",
];

let selectedBackground = null;

export function getFixedPageBackground() {
  if (!selectedBackground) {
    try {
      const stored = sessionStorage.getItem("zamorin_login_bg");
      if (stored && BACKGROUND_IMAGES.includes(stored)) {
        selectedBackground = stored;
        return selectedBackground;
      }
    } catch {}

    const idx = Math.floor(Math.random() * BACKGROUND_IMAGES.length);
    selectedBackground = BACKGROUND_IMAGES[idx];
    try {
      sessionStorage.setItem("zamorin_login_bg", selectedBackground);
    } catch {}
  }
  return selectedBackground;
}

function renderBackgroundAndModalsHtml() {
  const bg = getFixedPageBackground();
  return `
    <div class="l2-bg-layer" style="background-image: url('${bg}');"></div>
    <div class="l2-bg-overlay"></div>

    <!-- Shield Overlay (Session Shielded on Blur if enabled) -->
    <div id="l2-shield-overlay" class="shield-overlay hidden">
      <div class="shield-content">
        <svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="1.5" aria-hidden="true">
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
        </svg>
        <p>Session Shielded</p>
        <span>Return to the window to continue</span>
      </div>
    </div>

    <!-- Global Glass Alert Modal -->
    <div id="l2-glass-alert-modal" class="modal-overlay hidden">
      <div class="light-modal-content glass-alert-content">
        <p id="l2-glass-alert-msg" class="glass-alert-text"></p>
        <button id="l2-glass-alert-ok" type="button" class="light-btn glass-alert-ok">OK</button>
      </div>
    </div>

    <!-- Terms & Conditions Modal -->
    <div id="l2-terms-modal" class="modal-overlay hidden">
      <div class="tc-modal-content">
        <h3>Terms &amp; Conditions</h3>
        <div id="l2-tc-scroll-body" class="tc-scroll-body">
          <h4>1. Authorised Enterprise Access Only</h4>
          <p>Access to Zamorin Café ERP is strictly restricted to authorised personnel. All interactions are cryptographically signed, timestamped, and audited in the immutable Audit Ledger.</p>
          <h4>2. Multi-Location Tenancy & Scope Enforcement</h4>
          <p>Operators, Administrators, and Staff may only interact with data and resources assigned to their specific location. Cross-café manipulation or privilege escalation is strictly prohibited.</p>
          <h4>3. Hardware & Device Trust</h4>
          <p>Terminal sessions established on registered devices must adhere to organizational security policies. Sharing PINs or credentials is a direct violation of enterprise policy.</p>
          <h4>4. Data Governance & Financial Records</h4>
          <p>All transactions, inventory logs, and cash declarations submitted through this portal constitute legal enterprise records.</p>
        </div>
        <div class="tc-footer">
          <p id="l2-tc-scroll-hint" class="tc-scroll-hint">↓ Scroll to the bottom to accept</p>
          <button id="l2-tc-agree-btn" type="button" class="light-btn" disabled>I Agree</button>
          <button id="l2-tc-close-btn" type="button" class="btn-pill-white">Close</button>
        </div>
      </div>
    </div>

    <!-- Biometrics Chooser Modal -->
    <div id="l2-biometrics-modal" class="modal-overlay hidden">
      <div class="light-modal-content">
        <button id="l2-close-bio-modal" type="button" class="light-close-btn" aria-label="Close">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
        <h3 style="font-size: 18px; font-weight: 700; margin-bottom: 4px;">Choose Biometric Method</h3>
        <p style="font-size: 13px; color: var(--l2-text-muted); margin-bottom: 12px;">Authenticate securely using your device hardware sensor.</p>
        <div class="biometric-options">
          <button type="button" class="light-bio-option" data-bio-type="faceId">
            <svg class="bio-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
              <path d="M5 3H3v2"/>
              <path d="M19 3h2v2"/>
              <path d="M5 21H3v-2"/>
              <path d="M19 21h2v-2"/>
              <path d="M9 9h.01"/>
              <path d="M15 9h.01"/>
              <path d="M10 13c.5.5 1.5.5 2 0"/>
              <path d="M8 17c1.5 1 4.5 1 6 0"/>
            </svg>
            <span style="font-size: 13px; font-weight: 600;">Face ID</span>
          </button>
          <button type="button" class="light-bio-option" data-bio-type="fingerprint">
            <svg class="bio-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
              <path d="M2 12C2 6.5 6.5 2 12 2a10 10 0 0 1 8 4"/>
              <path d="M5 19.5C5.5 18 6 15 6 12c0-.7.12-1.37.34-2"/>
              <path d="M17.29 21.02c.12-.6.43-2.3.5-3.02 0-3.3-2.7-6-6-6s-6 2.7-6 6c0 1.02-.1 2.51-.26 4"/>
              <path d="M12 10a2 2 0 0 0-2 2c0 1.02-.1 2.51-.26 4"/>
              <path d="M8.65 22c.21-.66.45-1.32.57-2"/>
              <path d="M14 13.12c0 2.38 0 6.38-1 8.88"/>
              <path d="M21.8 16c.2-2 .13-4-.03-5A10 10 0 0 0 12 2"/>
              <path d="M9 6.8a6 6 0 0 1 9 5.2v2"/>
            </svg>
            <span style="font-size: 13px; font-weight: 600;">Fingerprint</span>
          </button>
        </div>
      </div>
    </div>
  `;
}

export function showGlassAlert(message, callback) {
  const modal = document.getElementById("l2-glass-alert-modal");
  const msgEl = document.getElementById("l2-glass-alert-msg");
  const okBtn = document.getElementById("l2-glass-alert-ok");
  if (!modal || !msgEl) {
    window.alert(message);
    if (typeof callback === "function") callback();
    return;
  }
  msgEl.textContent = message;
  modal.classList.remove("hidden");

  const closeHandler = () => {
    modal.classList.add("hidden");
    okBtn?.removeEventListener("click", closeHandler);
    if (typeof callback === "function") callback();
  };
  okBtn?.addEventListener("click", closeHandler);
}

// -----------------------------------------------------------------------------
// 1. MAIN LOGIN SCREEN (LOGIN-PAGE-2.0)
// -----------------------------------------------------------------------------
export function renderLoginPage2({ organisationId = "ZAMORIN", email = "", notice = "", error = "" } = {}) {
  // Check remembered device state
  let rememberedEmail = email;
  let rememberedOrg = organisationId;
  let isRemembered = false;
  try {
    const raw = localStorage.getItem("zamorin_remembered_device");
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed.email) {
        rememberedEmail = parsed.email;
        rememberedOrg = parsed.organisationId || organisationId;
        isRemembered = true;
      }
    }
  } catch {}

  return `
    ${renderBackgroundAndModalsHtml()}
    <div class="l2-glass-wrapper">
      <div class="light-glass-container" id="login-view">
        <div class="l2-brand-header">
          <img src="/src/assets/zamorin-logo-stacked.svg" alt="Zamorin Café" class="l2-brand-logo" />
        </div>

        <div class="login-header">
          <h2>Welcome Back</h2>
          <p class="login-subtitle">Please enter your enterprise credentials to sign in.</p>
        </div>

        ${notice ? `<div class="l2-notice-banner">${notice}</div>` : ""}
        <div id="l2-login-error" class="l2-error-banner" style="${error ? "" : "display:none;"}">${error}</div>

        <form id="l2-login-form">
          <!-- Organisation ID -->
          <div class="light-input-group">
            <div class="light-input-icon left">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <rect x="2" y="7" width="20" height="14" rx="2" ry="2"></rect>
                <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"></path>
              </svg>
            </div>
            <input type="text" id="l2-org-id" placeholder="Organisation ID" value="${rememberedOrg}" required autocomplete="organization" />
          </div>

          <!-- Email -->
          <div class="light-input-group">
            <div class="light-input-icon left">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <rect x="2" y="4" width="20" height="16" rx="2"></rect>
                <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"></path>
              </svg>
            </div>
            <input type="email" id="l2-email" placeholder="Corporate Email ID" value="${rememberedEmail}" required autocomplete="username" />
          </div>

          <!-- Password -->
          <div class="light-input-group">
            <div class="light-input-icon left">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
              </svg>
            </div>
            <input type="password" id="l2-password" placeholder="Password" required autocomplete="current-password" />
            <button type="button" class="light-input-icon right" id="l2-toggle-pwd" aria-label="Toggle password">
              <svg id="l2-eye-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                <circle cx="12" cy="12" r="3"></circle>
              </svg>
            </button>
          </div>

          <!-- Options Row -->
          <div class="options-row">
            <label class="toggle-switch-group">
              <div class="toggle-switch">
                <input type="checkbox" id="l2-remember-device" ${isRemembered ? "checked" : ""} />
                <span class="light-slider"></span>
              </div>
              <span class="light-toggle-label">Remember this device</span>
            </label>
            <button type="button" id="l2-forgot-pwd-btn" class="btn-pill-white">Forgot Password?</button>
          </div>

          <!-- Terms & Conditions Trigger -->
          <div class="tc-trigger-row">
            <input type="checkbox" id="l2-terms-checkbox" class="hidden" />
            <button type="button" id="l2-open-terms-btn" class="tc-trigger-btn">📜 View Terms &amp; Conditions</button>
            <span id="l2-tc-agreed-badge" class="tc-agreed-badge hidden">✓ Agreed</span>
          </div>

          <!-- Sign In Submit Button -->
          <button type="submit" id="l2-submit-btn" class="light-btn">Sign In</button>
        </form>

        <!-- Social / Alternative Authenticator Row -->
        <div class="light-divider"><span>Or continue with</span></div>
        <div class="social-login-row">
          <button type="button" class="light-social-btn" id="l2-social-google" aria-label="Google sign-in">
            <svg viewBox="0 0 24 24" fill="currentColor"><path d="M12.48 10.92v3.28h7.84c-.24 1.84-.853 3.187-1.787 4.133-1.147 1.147-2.933 2.4-6.053 2.4-4.827 0-8.6-3.893-8.6-8.72s3.773-8.72 8.6-8.72c2.6 0 4.507 1.027 5.907 2.347l2.307-2.307C18.747 1.44 16.133 0 12.48 0 5.867 0 .307 5.387.307 12s5.56 12 12.173 12c3.573 0 6.267-1.173 8.373-3.36 2.16-2.16 2.84-5.213 2.84-7.667 0-.76-.053-1.467-.173-2.053H12.48z"/></svg>
          </button>
          <button type="button" class="light-social-btn" id="l2-social-apple" aria-label="Apple sign-in">
            <svg viewBox="0 0 24 24" fill="currentColor"><path d="M12.152 6.896c-.948 0-2.415-1.078-3.96-1.04-2.04.027-3.91 1.183-4.961 3.014-2.117 3.675-.546 9.103 1.519 12.09 1.013 1.454 2.208 3.126 3.822 3.08 1.535-.046 2.11-.969 3.97-.969 1.848 0 2.378.969 3.972.936 1.62-.046 2.65-1.554 3.66-3.003 1.159-1.687 1.636-3.325 1.662-3.415-.039-.013-3.182-1.221-3.22-4.857-.026-3.04 2.48-4.494 2.597-4.559-1.429-2.09-3.623-2.324-4.39-2.376-2-.156-3.675 1.09-4.671 1.09zM15.53 3.83c.843-1.012 1.4-2.427 1.245-3.83-1.207.052-2.662.805-3.532 1.818-.78.896-1.454 2.338-1.273 3.714 1.338.104 2.715-.688 3.56-1.702z"/></svg>
          </button>
          <button type="button" class="light-social-btn" id="l2-social-github" aria-label="GitHub sign-in">
            <svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12"/></svg>
          </button>
          <button type="button" class="light-social-btn" id="l2-social-biometrics" aria-label="Biometrics & passkeys" title="Face ID / Fingerprint / Passkeys">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
              <path d="M2 12C2 6.5 6.5 2 12 2a10 10 0 0 1 8 4"/>
              <path d="M5 19.5C5.5 18 6 15 6 12c0-.7.12-1.37.34-2"/>
              <path d="M17.29 21.02c.12-.6.43-2.3.5-3.02 0-3.3-2.7-6-6-6s-6 2.7-6 6c0 1.02-.1 2.51-.26 4"/>
              <path d="M12 10a2 2 0 0 0-2 2c0 1.02-.1 2.51-.26 4"/>
              <path d="M8.65 22c.21-.66.45-1.32.57-2"/>
              <path d="M14 13.12c0 2.38 0 6.38-1 8.88"/>
              <path d="M21.8 16c.2-2 .13-4-.03-5A10 10 0 0 0 12 2"/>
              <path d="M9 6.8a6 6 0 0 1 9 5.2v2"/>
            </svg>
          </button>
        </div>
      </div>
    </div>
  `;
}

export function wireLoginPage2(container, { onSubmit, onForgotPassword, onCafeOps } = {}) {
  const form = container.querySelector("#l2-login-form");
  const errorEl = container.querySelector("#l2-login-error");
  const togglePwdBtn = container.querySelector("#l2-toggle-pwd");
  const pwdInput = container.querySelector("#l2-password");
  const forgotBtn = container.querySelector("#l2-forgot-pwd-btn");

  // Modals
  const termsModal = container.querySelector("#l2-terms-modal");
  const openTermsBtn = container.querySelector("#l2-open-terms-btn");
  const closeTermsBtn = container.querySelector("#l2-tc-close-btn");
  const agreeTermsBtn = container.querySelector("#l2-tc-agree-btn");
  const tcScrollBody = container.querySelector("#l2-tc-scroll-body");
  const tcCheckbox = container.querySelector("#l2-terms-checkbox");
  const tcBadge = container.querySelector("#l2-tc-agreed-badge");

  const bioModal = container.querySelector("#l2-biometrics-modal");
  const openBioBtn = container.querySelector("#l2-social-biometrics");
  const closeBioBtn = container.querySelector("#l2-close-bio-modal");

  // Password toggle
  if (togglePwdBtn && pwdInput) {
    togglePwdBtn.addEventListener("click", () => {
      const isPwd = pwdInput.type === "password";
      pwdInput.type = isPwd ? "text" : "password";
      togglePwdBtn.style.color = isPwd ? "#d4a359" : "rgba(255, 255, 255, 0.75)";
    });
  }

  // Terms & Conditions Modal
  if (openTermsBtn && termsModal) {
    openTermsBtn.addEventListener("click", () => {
      termsModal.classList.remove("hidden");
    });
  }
  if (closeTermsBtn && termsModal) {
    closeTermsBtn.addEventListener("click", () => {
      termsModal.classList.add("hidden");
    });
  }
  if (tcScrollBody && agreeTermsBtn) {
    tcScrollBody.addEventListener("scroll", () => {
      const atBottom = tcScrollBody.scrollHeight - tcScrollBody.scrollTop <= tcScrollBody.clientHeight + 20;
      if (atBottom) {
        agreeTermsBtn.disabled = false;
        container.querySelector("#l2-tc-scroll-hint")?.remove();
      }
    });
  }
  if (agreeTermsBtn && tcCheckbox && tcBadge) {
    agreeTermsBtn.addEventListener("click", () => {
      tcCheckbox.checked = true;
      tcBadge.classList.remove("hidden");
      termsModal?.classList.add("hidden");
    });
  }

  // Biometrics Modal & WebAuthn Ceremony
  if (openBioBtn && bioModal) {
    openBioBtn.addEventListener("click", () => {
      bioModal.classList.remove("hidden");
    });
  }
  if (closeBioBtn && bioModal) {
    closeBioBtn.addEventListener("click", () => {
      bioModal.classList.add("hidden");
    });
  }
  container.querySelectorAll(".light-bio-option").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const bioType = btn.getAttribute("data-bio-type");
      bioModal?.classList.add("hidden");

      if (!window.PublicKeyCredential) {
        showGlassAlert(`Hardware ${bioType === "faceId" ? "Face ID" : "Fingerprint"} is not supported on this browser. Please use standard password authentication.`);
        return;
      }

      const orgId = container.querySelector("#l2-org-id")?.value?.trim() || "ZAMORIN";
      const email = container.querySelector("#l2-email")?.value?.trim() || "";

      try {
        const { apiPost, setAccessToken } = await import("../apiClient.js");

        // 1. Fetch authentication options from backend
        const optRes = await apiPost("/auth/passkeys/authenticate/options", {
          organisationId: orgId,
          email: email || undefined,
        });

        const options = optRes?.data?.options;
        const challengeId = optRes?.data?.challengeId;

        if (!options || !challengeId) {
          throw new Error("Unable to retrieve passkey challenge from authentication server.");
        }

        // Helper conversions for WebAuthn binary buffers
        const base64urlToBuffer = (str) => {
          const padding = "=".repeat((4 - (str.length % 4)) % 4);
          const base64 = (str + padding).replace(/-/g, "+").replace(/_/g, "/");
          const raw = window.atob(base64);
          const arr = new Uint8Array(raw.length);
          for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
          return arr.buffer;
        };

        const bufferToBase64url = (buf) => {
          const bytes = new Uint8Array(buf);
          let str = "";
          for (let i = 0; i < bytes.byteLength; i++) str += String.fromCharCode(bytes[i]);
          return window.btoa(str).replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
        };

        const publicKeyOptions = {
          ...options,
          challenge: base64urlToBuffer(options.challenge),
          allowCredentials: options.allowCredentials?.map((cred) => ({
            ...cred,
            id: base64urlToBuffer(cred.id),
          })),
        };

        // 2. Request assertion from device platform authenticator (Face ID / Touch ID / Windows Hello)
        const credential = await navigator.credentials.get({
          publicKey: publicKeyOptions,
        });

        if (!credential) {
          throw new Error("Biometric verification cancelled or unavailable.");
        }

        const verifyPayload = {
          id: credential.id,
          rawId: bufferToBase64url(credential.rawId),
          type: credential.type,
          response: {
            clientDataJSON: bufferToBase64url(credential.response.clientDataJSON),
            authenticatorData: bufferToBase64url(credential.response.authenticatorData),
            signature: bufferToBase64url(credential.response.signature),
            userHandle: credential.response.userHandle ? bufferToBase64url(credential.response.userHandle) : null,
          },
        };

        // 3. Verify assertion with backend and establish authoritative ERP session
        const verifyRes = await apiPost("/auth/passkeys/authenticate/verify", {
          organisationId: orgId,
          response: verifyPayload,
          challengeId,
        });

        const accessToken = verifyRes?.data?.accessToken;
        const user = verifyRes?.data?.user;

        if (accessToken) {
          setAccessToken(accessToken);
        }

        if (user) {
          showGlassAlert(`Welcome back, ${user.name || user.email}!`, () => {
            if (typeof onPasskeySuccess === "function") {
              onPasskeySuccess(user);
            } else {
              window.location.hash = user.role === "STAFF" ? "#staff-home" : "#dashboard";
              window.location.reload();
            }
          });
        }
      } catch (err) {
        showGlassAlert(
          err.message || `Hardware ${bioType === "faceId" ? "Face ID" : "Fingerprint"} verification failed or no passkey is registered for this account. Please sign in with your enterprise password.`
        );
      }
    });
  });

  // Social Informational buttons
  container.querySelector("#l2-social-google")?.addEventListener("click", () => {
    showGlassAlert("Single Sign-On (Google Workspace) is restricted to corporate domain accounts. Please sign in with your enterprise credentials.");
  });
  container.querySelector("#l2-social-apple")?.addEventListener("click", () => {
    showGlassAlert("Single Sign-On (Apple ID) is managed via Enterprise MDM profile. Please sign in with your enterprise credentials.");
  });
  container.querySelector("#l2-social-github")?.addEventListener("click", () => {
    showGlassAlert("GitHub Developer SSO is reserved for DevOps and system engineering personnel.");
  });

  // Forgot Password
  if (forgotBtn && typeof onForgotPassword === "function") {
    forgotBtn.addEventListener("click", () => {
      const org = container.querySelector("#l2-org-id")?.value?.trim() || "ZAMORIN";
      const email = container.querySelector("#l2-email")?.value?.trim() || "";
      onForgotPassword({ organisationId: org, email });
    });
  }

  // Form Submit
  if (form && typeof onSubmit === "function") {
    let isSubmitting = false;

    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      if (isSubmitting) return;

      if (errorEl) errorEl.style.display = "none";

      const organisationId = container.querySelector("#l2-org-id")?.value?.trim() || "";
      const email = container.querySelector("#l2-email")?.value?.trim() || "";
      const password = container.querySelector("#l2-password")?.value || "";
      const rememberDevice = Boolean(container.querySelector("#l2-remember-device")?.checked);

      if (!organisationId || !email || !password) {
        if (errorEl) {
          errorEl.textContent = "Please fill in all required credentials.";
          errorEl.style.display = "block";
        }
        return;
      }

      // Safe Remember Device persistence (Email & Org only — ZERO passwords/PINs stored)
      try {
        if (rememberDevice) {
          localStorage.setItem("zamorin_remembered_device", JSON.stringify({ email, organisationId }));
        } else {
          localStorage.removeItem("zamorin_remembered_device");
        }
      } catch {}

      const submitBtn = container.querySelector("#l2-submit-btn");
      isSubmitting = true;
      let progressTimer = null;

      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = "Connecting securely...";
        progressTimer = setTimeout(() => {
          if (isSubmitting && submitBtn) {
            submitBtn.textContent = "Authenticating...";
          }
        }, 2200);
      }

      try {
        await onSubmit({ organisationId, email, password, rememberDevice });
      } catch (err) {
        if (progressTimer) clearTimeout(progressTimer);
        isSubmitting = false;
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.textContent = "Sign In";
        }
        if (errorEl) {
          const rawMsg = err.userMessage || err.message || "";
          if (err.isTimeoutError || err.code === "REQUEST_TIMEOUT" || rawMsg.includes("took too long")) {
            errorEl.textContent = "The server is taking longer than expected to respond. Please check your connection and try again.";
          } else if (err.isNetworkError || err.code === "NETWORK_UNAVAILABLE" || rawMsg.includes("could not be reached")) {
            errorEl.textContent = "The server could not be reached. Please check your network connection.";
          } else if (err.isServerError || (err.status >= 500 && err.status <= 599)) {
            errorEl.textContent = "The server encountered a temporary error. Please try again in a moment.";
          } else {
            errorEl.textContent = rawMsg || "Invalid credentials. Please check your Organisation ID, email, and password.";
          }
          errorEl.style.display = "block";
        }
      } finally {
        if (!errorEl || errorEl.style.display === "none") {
          if (progressTimer) clearTimeout(progressTimer);
          isSubmitting = false;
        }
      }
    });
  }
}

// -----------------------------------------------------------------------------
// 2. PASSWORD RECOVERY — STEP 1: REQUEST VERIFICATION CODE
// -----------------------------------------------------------------------------
export function renderPasswordResetRequest2({ organisationId = "ZAMORIN", email = "" } = {}) {
  return `
    ${renderBackgroundAndModalsHtml()}
    <div class="l2-glass-wrapper">
      <div class="light-glass-container">
        <div class="l2-brand-header">
          <img src="/src/assets/zamorin-logo-stacked.svg" alt="Zamorin Café" class="l2-brand-logo" />
        </div>

        <div class="login-header">
          <h2>Password Recovery</h2>
          <p class="login-subtitle">Enter your registered email to receive a 6-digit Verification Code.</p>
        </div>

        <div id="l2-reset-req-error" class="l2-error-banner" style="display:none;"></div>

        <form id="l2-reset-req-form">
          <div class="light-input-group">
            <div class="light-input-icon left">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></svg>
            </div>
            <input type="text" id="l2-reset-org" placeholder="Organisation ID" value="${organisationId}" required />
          </div>

          <div class="light-input-group">
            <div class="light-input-icon left">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M20 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z"/></svg>
            </div>
            <input type="email" id="l2-reset-email" placeholder="Corporate Email Address" value="${email}" required autocomplete="email" />
          </div>

          <button type="submit" id="l2-reset-req-submit" class="light-btn">Send Verification Code</button>
          <div style="margin-top: 12px; text-align: center;">
            <button type="button" id="l2-reset-req-back" class="btn-pill-white">Back to Sign In</button>
          </div>
        </form>
      </div>
    </div>
  `;
}

export function wirePasswordResetRequest2(container, { onSubmit, onBack } = {}) {
  const form = container.querySelector("#l2-reset-req-form");
  const backBtn = container.querySelector("#l2-reset-req-back");
  const errorEl = container.querySelector("#l2-reset-req-error");

  if (backBtn && typeof onBack === "function") {
    backBtn.addEventListener("click", () => onBack());
  }

  if (form && typeof onSubmit === "function") {
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      if (errorEl) errorEl.style.display = "none";

      const organisationId = container.querySelector("#l2-reset-org")?.value?.trim() || "";
      const email = container.querySelector("#l2-reset-email")?.value?.trim() || "";

      if (!organisationId || !email) {
        if (errorEl) {
          errorEl.textContent = "Please fill in your Organisation ID and Email.";
          errorEl.style.display = "block";
        }
        return;
      }

      const submitBtn = container.querySelector("#l2-reset-req-submit");
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = "Sending Verification Code...";
      }

      try {
        await onSubmit({ organisationId, email });
      } catch (err) {
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.textContent = "Send Verification Code";
        }
        if (errorEl) {
          errorEl.textContent = err.message || "Failed to process recovery request.";
          errorEl.style.display = "block";
        }
      }
    });
  }
}

// -----------------------------------------------------------------------------
// 3. PASSWORD RECOVERY — STEP 2: VERIFY CODE
// -----------------------------------------------------------------------------
export function renderPasswordResetVerify2({ email = "", challengeId = "" } = {}) {
  return `
    ${renderBackgroundAndModalsHtml()}
    <div class="l2-glass-wrapper">
      <div class="light-glass-container">
        <div class="l2-brand-header">
          <img src="/src/assets/zamorin-logo-stacked.svg" alt="Zamorin Café" class="l2-brand-logo" />
        </div>

        <div class="login-header">
          <h2>Verification Code</h2>
          <p class="login-subtitle">Enter the 6-digit Verification Code sent to <strong>${email || "your email"}</strong>.</p>
        </div>

        <div id="l2-reset-verify-error" class="l2-error-banner" style="display:none;"></div>

        <form id="l2-reset-verify-form">
          <div class="light-input-group">
            <div class="light-input-icon left">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
            </div>
            <input type="text" id="l2-verify-code" placeholder="6-digit Verification Code" maxlength="6" pattern="[0-9]{6}" required inputmode="numeric" style="letter-spacing: 4px; text-align: center; font-size: 18px; font-weight: 700;" />
          </div>

          <div style="font-size: 12px; color: var(--l2-text-muted); text-align: center; margin-bottom: 12px;">
            <span id="l2-cooldown-timer">Verification Code valid for 15 minutes.</span>
          </div>

          <button type="submit" id="l2-reset-verify-submit" class="light-btn">Verify Code</button>
          <div style="margin-top: 12px; text-align: center;">
            <button type="button" id="l2-reset-verify-back" class="btn-pill-white">Back</button>
          </div>
        </form>
      </div>
    </div>
  `;
}

export function wirePasswordResetVerify2(container, { onSubmit, onBack } = {}) {
  const form = container.querySelector("#l2-reset-verify-form");
  const backBtn = container.querySelector("#l2-reset-verify-back");
  const errorEl = container.querySelector("#l2-reset-verify-error");

  if (backBtn && typeof onBack === "function") {
    backBtn.addEventListener("click", () => onBack());
  }

  if (form && typeof onSubmit === "function") {
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      if (errorEl) errorEl.style.display = "none";

      const code = container.querySelector("#l2-verify-code")?.value?.trim() || "";
      if (!code || code.length !== 6) {
        if (errorEl) {
          errorEl.textContent = "Please enter the complete 6-digit Verification Code.";
          errorEl.style.display = "block";
        }
        return;
      }

      const submitBtn = container.querySelector("#l2-reset-verify-submit");
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = "Verifying...";
      }

      try {
        await onSubmit({ code });
      } catch (err) {
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.textContent = "Verify Code";
        }
        if (errorEl) {
          errorEl.textContent = err.message || "Invalid or expired Verification Code.";
          errorEl.style.display = "block";
        }
      }
    });
  }
}

// -----------------------------------------------------------------------------
// 4. PASSWORD RECOVERY — STEP 3: SET NEW PASSWORD
// -----------------------------------------------------------------------------
export function renderPasswordResetFinal2({ challengeId = "", resetToken = "" } = {}) {
  return `
    ${renderBackgroundAndModalsHtml()}
    <div class="l2-glass-wrapper">
      <div class="light-glass-container">
        <div class="l2-brand-header">
          <img src="/src/assets/zamorin-logo-stacked.svg" alt="Zamorin Café" class="l2-brand-logo" />
        </div>

        <div class="login-header">
          <h2>Set New Password</h2>
          <p class="login-subtitle">Create a strong, secure enterprise password for your account.</p>
        </div>

        <div id="l2-reset-final-error" class="l2-error-banner" style="display:none;"></div>

        <form id="l2-reset-final-form">
          <div class="light-input-group">
            <div class="light-input-icon left">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3.1-9H8.9V6c0-1.71 1.39-3.1 3.1-3.1s3.1 1.39 3.1 3.1v2z"/></svg>
            </div>
            <input type="password" id="l2-new-password" placeholder="New Password" required autocomplete="new-password" />
          </div>

          <div class="light-input-group">
            <div class="light-input-icon left">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3.1-9H8.9V6c0-1.71 1.39-3.1 3.1-3.1s3.1 1.39 3.1 3.1v2z"/></svg>
            </div>
            <input type="password" id="l2-confirm-password" placeholder="Confirm New Password" required autocomplete="new-password" />
          </div>

          <div style="font-size: 11.5px; color: var(--l2-text-muted); line-height: 1.4; margin-bottom: 12px;">
            Password must be at least 8 characters and contain uppercase, lowercase, numbers, and special characters.
          </div>

          <button type="submit" id="l2-reset-final-submit" class="light-btn">Update Password</button>
          <div style="margin-top: 12px; text-align: center;">
            <button type="button" id="l2-reset-final-cancel" class="btn-pill-white">Cancel</button>
          </div>
        </form>
      </div>
    </div>
  `;
}

export function wirePasswordResetFinal2(container, { onSubmit, onCancel } = {}) {
  const form = container.querySelector("#l2-reset-final-form");
  const cancelBtn = container.querySelector("#l2-reset-final-cancel");
  const errorEl = container.querySelector("#l2-reset-final-error");

  if (cancelBtn && typeof onCancel === "function") {
    cancelBtn.addEventListener("click", () => onCancel());
  }

  if (form && typeof onSubmit === "function") {
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      if (errorEl) errorEl.style.display = "none";

      const newPassword = container.querySelector("#l2-new-password")?.value || "";
      const confirmPassword = container.querySelector("#l2-confirm-password")?.value || "";

      if (!newPassword || !confirmPassword) {
        if (errorEl) {
          errorEl.textContent = "Please fill in both password fields.";
          errorEl.style.display = "block";
        }
        return;
      }

      if (newPassword !== confirmPassword) {
        if (errorEl) {
          errorEl.textContent = "Passwords do not match. Please verify.";
          errorEl.style.display = "block";
        }
        return;
      }

      if (newPassword.length < 8) {
        if (errorEl) {
          errorEl.textContent = "Password must be at least 8 characters long.";
          errorEl.style.display = "block";
        }
        return;
      }

      const submitBtn = container.querySelector("#l2-reset-final-submit");
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = "Updating Password...";
      }

      try {
        await onSubmit({ newPassword });
      } catch (err) {
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.textContent = "Update Password";
        }
        if (errorEl) {
          errorEl.textContent = err.message || "Failed to reset password.";
          errorEl.style.display = "block";
        }
      }
    });
  }
}

// -----------------------------------------------------------------------------
// 5. MFA / TOTP CHALLENGE SCREEN
// -----------------------------------------------------------------------------
export function renderMfaChallenge2({ email = "", challengeId = "", tempToken = "" } = {}) {
  return `
    ${renderBackgroundAndModalsHtml()}
    <div class="l2-glass-wrapper">
      <div class="light-glass-container">
        <div class="l2-brand-header">
          <img src="/src/assets/zamorin-logo-stacked.svg" alt="Zamorin Café" class="l2-brand-logo" />
        </div>

        <div class="login-header">
          <h2>Two-Factor Authentication</h2>
          <p class="login-subtitle">Enter the 6-digit TOTP Verification Code from your Authenticator app.</p>
        </div>

        <div id="l2-mfa-error" class="l2-error-banner" style="display:none;"></div>

        <form id="l2-mfa-form">
          <div class="light-input-group">
            <div class="light-input-icon left">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
            </div>
            <input type="text" id="l2-mfa-code" placeholder="6-digit TOTP Code" maxlength="8" required inputmode="numeric" style="letter-spacing: 4px; text-align: center; font-size: 18px; font-weight: 700;" />
          </div>

          <button type="submit" id="l2-mfa-submit" class="light-btn">Verify &amp; Sign In</button>
          <div style="margin-top: 12px; text-align: center;">
            <button type="button" id="l2-mfa-back" class="btn-pill-white">Back to Sign In</button>
          </div>
        </form>
      </div>
    </div>
  `;
}

export function wireMfaChallenge2(container, { onSubmit, onBack } = {}) {
  const form = container.querySelector("#l2-mfa-form");
  const backBtn = container.querySelector("#l2-mfa-back");
  const errorEl = container.querySelector("#l2-mfa-error");

  if (backBtn && typeof onBack === "function") {
    backBtn.addEventListener("click", () => onBack());
  }

  if (form && typeof onSubmit === "function") {
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      if (errorEl) errorEl.style.display = "none";

      const code = container.querySelector("#l2-mfa-code")?.value?.trim() || "";
      if (!code) {
        if (errorEl) {
          errorEl.textContent = "Please enter your TOTP Verification Code.";
          errorEl.style.display = "block";
        }
        return;
      }

      const submitBtn = container.querySelector("#l2-mfa-submit");
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = "Verifying...";
      }

      try {
        await onSubmit({ code });
      } catch (err) {
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.textContent = "Verify & Sign In";
        }
        if (errorEl) {
          errorEl.textContent = err.message || "Invalid TOTP code. Please try again.";
          errorEl.style.display = "block";
        }
      }
    });
  }
}
