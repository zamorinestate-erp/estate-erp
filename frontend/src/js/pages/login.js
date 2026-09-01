// =============================================================================
// ZAMORIN CAFE ERP — AUTHENTICATION & PASSWORD RECOVERY MODULE
//
// NEW LOGIN MODULE: PENDING REDESIGN
// Canonical three-screen password reset flow & authentication UI contract.
// =============================================================================

import { icons } from "../icons.js";

/**
 * 1. Password Reset Request (Screen 1)
 */
export function renderPasswordResetRequest({ organisationId = "ZAMORIN", email = "" } = {}) {
  return `
    <div class="auth-card-container">
      <div class="auth-card">
        <div class="auth-brand-header">
          <img src="/src/assets/zamorin-logo-stacked.svg" alt="Zamorin Café" style="width: 140px; height: auto; margin: 0 auto 10px; display: block;" />
          <p class="auth-brand-subtitle">Enterprise Resource Planning</p>
        </div>

        <div class="auth-form-header">
          <h2>Password Recovery</h2>
          <p>Enter your Organisation ID and corporate email to receive a recovery code.</p>
        </div>

        <form id="password-reset-request-form" class="auth-form">
          <div class="auth-field-group">
            <label for="reset-req-org">Organisation ID</label>
            <input
              type="text"
              id="reset-req-org"
              name="organisationId"
              class="auth-input"
              value="${organisationId}"
              placeholder="e.g. ZAMORIN"
              required
            />
          </div>

          <div class="auth-field-group">
            <label for="reset-req-email">Corporate Email Address</label>
            <input
              type="email"
              id="reset-req-email"
              name="email"
              class="auth-input"
              value="${email}"
              placeholder="user@example.com"
              required
              autocomplete="email"
            />
          </div>

          <div id="reset-req-error" class="auth-error-banner" style="display:none;"></div>

          <div class="auth-action-group">
            <button type="submit" id="reset-req-submit" class="btn btn-primary btn-block">
              Request Recovery Code
            </button>
            <button type="button" id="reset-req-back" class="btn btn-secondary btn-block">
              Back to Sign In
            </button>
          </div>
        </form>
      </div>
    </div>
  `;
}

export function wirePasswordResetRequest(container, { onSubmit, onBack } = {}) {
  const form = container.querySelector("#password-reset-request-form");
  const backBtn = container.querySelector("#reset-req-back");
  const errorEl = container.querySelector("#reset-req-error");

  if (backBtn && typeof onBack === "function") {
    backBtn.addEventListener("click", () => onBack());
  }

  if (form && typeof onSubmit === "function") {
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      if (errorEl) errorEl.style.display = "none";

      const organisationId = form.querySelector("#reset-req-org")?.value?.trim() || "";
      const email = form.querySelector("#reset-req-email")?.value?.trim() || "";

      if (!organisationId || !email) {
        if (errorEl) {
          errorEl.textContent = "Please fill in all required fields.";
          errorEl.style.display = "block";
        }
        return;
      }

      try {
        await onSubmit({ organisationId, email });
      } catch (err) {
        if (errorEl) {
          errorEl.textContent = err.message || "Failed to process recovery request.";
          errorEl.style.display = "block";
        }
      }
    });
  }
}

/**
 * 2. Password Reset Verify 6-Digit Code (Screen 2)
 */
export function renderPasswordResetVerify({ email = "", challengeId = "" } = {}) {
  return `
    <div class="auth-card-container">
      <div class="auth-card">
        <div class="auth-brand-header">
          <img src="/src/assets/zamorin-logo-stacked.svg" alt="Zamorin Café" style="width: 140px; height: auto; margin: 0 auto 10px; display: block;" />
          <p class="auth-brand-subtitle">Security Verification</p>
        </div>

        <div class="auth-form-header">
          <h2>Enter Verification Code</h2>
          <p>If the account is eligible, a 6-digit recovery code has been dispatched to <strong>${email || "your corporate email"}</strong>.</p>
        </div>

        <form id="password-reset-verify-form" class="auth-form">
          <input type="hidden" id="reset-verify-challenge-id" value="${challengeId}" />

          <div class="auth-field-group">
            <label for="reset-verify-code">6-Digit Verification Code</label>
            <input
              type="text"
              id="reset-verify-code"
              name="code"
              class="auth-input auth-code-input"
              pattern="[0-9]{6}"
              maxlength="6"
              placeholder="123456"
              required
              autocomplete="one-time-code"
            />
          </div>

          <div id="reset-verify-error" class="auth-error-banner" style="display:none;"></div>

          <div class="auth-action-group">
            <button type="submit" id="reset-verify-submit" class="btn btn-primary btn-block">
              Verify Code
            </button>
            <button type="button" id="reset-verify-back" class="btn btn-secondary btn-block">
              Back
            </button>
          </div>
        </form>
      </div>
    </div>
  `;
}

export function wirePasswordResetVerify(container, { onSubmit, onResend, onBack } = {}) {
  const form = container.querySelector("#password-reset-verify-form");
  const backBtn = container.querySelector("#reset-verify-back");
  const errorEl = container.querySelector("#reset-verify-error");

  if (backBtn && typeof onBack === "function") {
    backBtn.addEventListener("click", () => onBack());
  }

  if (form && typeof onSubmit === "function") {
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      if (errorEl) errorEl.style.display = "none";

      const code = form.querySelector("#reset-verify-code")?.value?.trim() || "";

      if (!/^[0-9]{6}$/.test(code)) {
        if (errorEl) {
          errorEl.textContent = "Please enter a valid 6-digit verification code.";
          errorEl.style.display = "block";
        }
        return;
      }

      try {
        await onSubmit({ code });
      } catch (err) {
        if (errorEl) {
          errorEl.textContent = err.message || "Invalid or expired verification code.";
          errorEl.style.display = "block";
        }
      }
    });
  }
}

/**
 * 3. Password Reset Final Set New Password (Screen 3)
 */
export function renderPasswordResetFinal({ organisationId = "", email = "", resetToken = "" } = {}) {
  return `
    <div class="auth-card-container">
      <div class="auth-card">
        <div class="auth-brand-header">
          <img src="/src/assets/zamorin-logo-stacked.svg" alt="Zamorin Café" style="width: 140px; height: auto; margin: 0 auto 10px; display: block;" />
          <p class="auth-brand-subtitle">Set New Password</p>
        </div>

        <div class="auth-form-header">
          <h2>Create New Password</h2>
          <p>Must be at least 12 characters with uppercase, lowercase, number, and special symbol.</p>
        </div>

        <form id="password-reset-final-form" class="auth-form">
          <input type="hidden" id="reset-final-token" value="${resetToken}" />

          <div class="auth-field-group">
            <label for="reset-final-new-pwd">New Password</label>
            <input
              type="password"
              id="reset-final-new-pwd"
              name="newPassword"
              class="auth-input"
              minlength="12"
              maxlength="128"
              required
              autocomplete="new-password"
            />
          </div>

          <div class="auth-field-group">
            <label for="reset-final-confirm-pwd">Confirm New Password</label>
            <input
              type="password"
              id="reset-final-confirm-pwd"
              name="confirmPassword"
              class="auth-input"
              minlength="12"
              maxlength="128"
              required
              autocomplete="new-password"
            />
          </div>

          <div id="reset-final-error" class="auth-error-banner" style="display:none;"></div>

          <div class="auth-action-group">
            <button type="submit" id="reset-final-submit" class="btn btn-primary btn-block">
              Update Password & Sign In
            </button>
            <button type="button" id="reset-final-cancel" class="btn btn-secondary btn-block">
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  `;
}

export function wirePasswordResetFinal(container, { onSubmit, onCancel, onBack } = {}) {
  const form = container.querySelector("#password-reset-final-form");
  const cancelBtn = container.querySelector("#reset-final-cancel");
  const errorEl = container.querySelector("#reset-final-error");

  const handleBack = onCancel || onBack;
  if (cancelBtn && typeof handleBack === "function") {
    cancelBtn.addEventListener("click", () => handleBack());
  }

  if (form && typeof onSubmit === "function") {
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      if (errorEl) errorEl.style.display = "none";

      const newPassword = form.querySelector("#reset-final-new-pwd")?.value || "";
      const confirmPassword = form.querySelector("#reset-final-confirm-pwd")?.value || "";

      if (newPassword.length < 12 || newPassword.length > 128) {
        if (errorEl) {
          errorEl.textContent = "Password must be between 12 and 128 characters in length.";
          errorEl.style.display = "block";
        }
        return;
      }

      if (!/[a-z]/.test(newPassword)) {
        if (errorEl) {
          errorEl.textContent = "Password must include at least one lowercase letter.";
          errorEl.style.display = "block";
        }
        return;
      }

      if (!/[A-Z]/.test(newPassword)) {
        if (errorEl) {
          errorEl.textContent = "Password must include at least one uppercase letter.";
          errorEl.style.display = "block";
        }
        return;
      }

      if (!/[0-9]/.test(newPassword)) {
        if (errorEl) {
          errorEl.textContent = "Password must include at least one numeric digit.";
          errorEl.style.display = "block";
        }
        return;
      }

      if (!/[^A-Za-z0-9]/.test(newPassword)) {
        if (errorEl) {
          errorEl.textContent = "Password must include at least one special character.";
          errorEl.style.display = "block";
        }
        return;
      }

      if (newPassword !== confirmPassword) {
        if (errorEl) {
          errorEl.textContent = "Passwords do not match.";
          errorEl.style.display = "block";
        }
        return;
      }

      try {
        await onSubmit({ newPassword });
      } catch (err) {
        if (errorEl) {
          errorEl.textContent = err.message || "Failed to update password.";
          errorEl.style.display = "block";
        }
      }
    });
  }
}

/**
 * 4. Sign In Screen (Screen 0)
 */
export function renderLogin({ notice = "", error = "" } = {}) {
  return `
    <div class="auth-card-container">
      <div class="auth-card">
        <div class="auth-brand-header">
          <img src="/src/assets/zamorin-logo-stacked.svg" alt="Zamorin Café" style="width: 140px; height: auto; margin: 0 auto 10px; display: block;" />
          <p class="auth-brand-subtitle">Enterprise Resource Planning</p>
        </div>

        ${notice ? `<div class="auth-notice-banner">${notice}</div>` : ""}
        ${error ? `<div class="auth-error-banner">${error}</div>` : ""}

        <form id="zamorin-login-form" class="auth-form">
          <div class="auth-field-group">
            <label for="login-org">Organisation ID</label>
            <input
              type="text"
              id="login-org"
              name="organisationId"
              class="auth-input"
              value="ZAMORIN"
              placeholder="e.g. ZAMORIN"
              required
            />
          </div>

          <div class="auth-field-group">
            <label for="login-email">Corporate Email</label>
            <input
              type="email"
              id="login-email"
              name="email"
              class="auth-input"
              placeholder="Email ID"
              required
              autocomplete="email"
            />
          </div>

          <div class="auth-field-group">
            <div class="auth-label-row">
              <label for="login-password">Password</label>
              <a href="#forgot" id="login-forgot-password" class="auth-link">Forgot Password?</a>
            </div>
            <input
              type="password"
              id="login-password"
              name="password"
              class="auth-input"
              placeholder="Password"
              required
              autocomplete="current-password"
            />
          </div>

          <div id="login-error" class="auth-error-banner" style="display:none;"></div>

          <div class="auth-action-group">
            <button type="submit" id="login-submit" class="btn btn-primary btn-block">
              Sign In to Command Centre
            </button>
          </div>
        </form>
      </div>
    </div>
  `;
}

export function wireLogin(container, { onSubmit, onForgotPassword } = {}) {
  const form = container.querySelector("#zamorin-login-form");
  const forgotLink = container.querySelector("#login-forgot-password");
  const errorEl = container.querySelector("#login-error");
  const submitBtn = container.querySelector("#login-submit");

  if (forgotLink && typeof onForgotPassword === "function") {
    forgotLink.addEventListener("click", (e) => {
      e.preventDefault();
      const organisationId = form?.querySelector("#login-org")?.value?.trim() || "ZAMORIN";
      const email = form?.querySelector("#login-email")?.value?.trim() || "";
      onForgotPassword({ organisationId, email });
    });
  }

  if (form && typeof onSubmit === "function") {
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      if (errorEl) errorEl.style.display = "none";

      const organisationId = form.querySelector("#login-org")?.value?.trim() || "ZAMORIN";
      const email = form.querySelector("#login-email")?.value?.trim() || "";
      const password = form.querySelector("#login-password")?.value || "";

      if (!organisationId || !email || !password) {
        if (errorEl) {
          errorEl.textContent = "Please fill in all credentials.";
          errorEl.style.display = "block";
        }
        return;
      }

      const originalBtnText = submitBtn ? submitBtn.textContent : "Sign In to Command Centre";
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = "Authenticating...";
      }

      try {
        await onSubmit({ organisationId, email, password });
      } catch (err) {
        if (errorEl) {
          errorEl.textContent = err.userMessage || err.message || "Invalid credentials.";
          errorEl.style.display = "block";
        }
      } finally {
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.textContent = originalBtnText;
        }
      }
    });
  }
}
