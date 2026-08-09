// Production login UI for Zamorin Cafe ERP.
// Authentication decisions and roles are always resolved by the backend.

const REMEMBERED_EMAIL_KEY = "zamorin-remembered-email";
const REMEMBERED_ORGANISATION_KEY = "zamorin-remembered-organisation";

let loginError = "";
let loginBusy = false;

function readRememberedValue(key) {
  try {
    return localStorage.getItem(key) || "";
  } catch {
    return "";
  }
}

function escapeAttribute(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

export function renderLogin({ notice = "" } = {}) {
  const savedEmail = readRememberedValue(REMEMBERED_EMAIL_KEY);
  const savedOrganisation = readRememberedValue(
    REMEMBERED_ORGANISATION_KEY
  );
  const remembered = Boolean(savedEmail || savedOrganisation);

  return `
    <div class="login-screen" style="--auth-background:url(https://picsum.photos/seed/zamorin-fallback-01/3840/2160)">
      <div class="login-card glass-dark">
        <div class="login-brand">
          <img src="src/assets/zamorin-logo-horizontal.svg" alt="Zamorin Estate Pvt. Ltd." class="login-brand-logo" />
          <div class="login-sub">Cafe ERP — sign in to continue</div>
        </div>
        <h1 class="auth-login-title">Login</h1>

        ${notice ? `<div class="login-notice" role="status">${escapeAttribute(notice)}</div>` : ""}

        <form id="login-form">
          <label class="login-label" for="login-organisation">Organisation ID</label>
          <input
            id="login-organisation"
            class="text-input"
            type="text"
            autocomplete="organization"
            placeholder="Organisation ID"
            value="${escapeAttribute(savedOrganisation)}"
            ${loginBusy ? "disabled" : ""}
          />

          <label class="login-label" for="login-email" style="margin-top:12px;">Email</label>
          <input
            id="login-email"
            class="text-input"
            type="email"
            autocomplete="username"
            placeholder="Email ID"
            value="${escapeAttribute(savedEmail)}"
            ${loginBusy ? "disabled" : ""}
          />

          <label class="login-label" for="login-password" style="margin-top:12px;">Password</label>
          <div style="position:relative;">
            <input
              id="login-password"
              class="text-input"
              type="password"
              autocomplete="current-password"
              placeholder="••••••••"
              ${loginBusy ? "disabled" : ""}
            />
            <button
              type="button"
              id="toggle-password-btn"
              class="login-eye"
              tabindex="-1"
              ${loginBusy ? "disabled" : ""}
            >Show</button>
          </div>

          ${loginError ? `<div class="login-error">${escapeAttribute(loginError)}</div>` : ""}

          <div class="flex justify-between items-center" style="margin:14px 0 18px;">
            <label class="login-remember">
              <input
                type="checkbox"
                id="login-remember"
                ${remembered ? "checked" : ""}
                ${loginBusy ? "disabled" : ""}
              />
              Remember me
            </label>
            <button
              type="button"
              id="login-forgot-password"
              class="login-forgot-link"
              ${loginBusy ? "disabled" : ""}
            >Forgot password?</button>
          </div>

          <button
            id="login-submit-btn"
            type="submit"
            class="btn btn-primary"
            style="width:100%; justify-content:center;"
            ${loginBusy ? "disabled" : ""}
          >${loginBusy ? "Signing in..." : "Login"}</button>
        </form>
      </div>
    </div>
  `;
}

export function wireLogin(root, { onSubmit, onForgotPassword } = {}) {
  const rerender = () => {
    root.innerHTML = renderLogin();
    wireLogin(root, { onSubmit, onForgotPassword });
  };

  const form = root.querySelector("#login-form");
  if (form) {
    form.addEventListener("submit", async (event) => {
      event.preventDefault();

      const organisationId =
        root.querySelector("#login-organisation")?.value.trim() || "";
      const email =
        root.querySelector("#login-email")?.value.trim().toLowerCase() || "";
      const password =
        root.querySelector("#login-password")?.value || "";

      if (!organisationId || !email || !password) {
        loginError =
          "Enter your organisation ID, email and password.";
        rerender();
        return;
      }

      try {
        const remember =
          root.querySelector("#login-remember")?.checked;

        if (remember) {
          localStorage.setItem(
            REMEMBERED_ORGANISATION_KEY,
            organisationId
          );
          localStorage.setItem(REMEMBERED_EMAIL_KEY, email);
        } else {
          localStorage.removeItem(
            REMEMBERED_ORGANISATION_KEY
          );
          localStorage.removeItem(REMEMBERED_EMAIL_KEY);
        }
      } catch {
        // Remember-me storage is optional and must not block login.
      }

      if (typeof onSubmit !== "function") {
        loginError = "Authentication service is unavailable.";
        rerender();
        return;
      }

      loginBusy = true;
      loginError = "";
      rerender();

      try {
        await onSubmit({
          organisationId,
          email,
          password,
        });
      } catch (error) {
        loginBusy = false;
        loginError =
          error?.message ||
          "Sign in failed. Please check your credentials.";
        rerender();
      }
    });
  }

  root.querySelector("#login-forgot-password")?.addEventListener("click", () => {
    if (typeof onForgotPassword === "function") onForgotPassword({ organisationId: root.querySelector("#login-organisation")?.value.trim() || "", email: root.querySelector("#login-email")?.value.trim().toLowerCase() || "" });
  });

  const toggleButton =
    root.querySelector("#toggle-password-btn");

  if (toggleButton) {
    toggleButton.addEventListener("click", () => {
      const passwordInput =
        root.querySelector("#login-password");

      if (!passwordInput) return;

      const show =
        passwordInput.type === "password";

      passwordInput.type =
        show ? "text" : "password";
      toggleButton.textContent =
        show ? "Hide" : "Show";
    });
  }
}

export function resetLoginUi() {
  loginError = "";
  loginBusy = false;
}

let mfaError = "";
let mfaBusy = false;
let mfaUseRecoveryCode = false;

export function renderMfaChallenge({
  subtitle = "Cafe ERP — secure authentication",
  title = "Multi-factor authentication",
  description = "Verify your identity to continue.",
  submitLabel = "Verify",
  busyLabel = "Verifying...",
  backLabel = "Back to sign in",
} = {}) {
  const inputLabel = mfaUseRecoveryCode
    ? "Recovery code"
    : "Authenticator code";

  const safeSubtitle = escapeAttribute(subtitle);
  const safeTitle = escapeAttribute(title);
  const safeDescription = escapeAttribute(description);
  const safeSubmitLabel = escapeAttribute(submitLabel);
  const safeBusyLabel = escapeAttribute(busyLabel);
  const safeBackLabel = escapeAttribute(backLabel);

  return `
    <div class="login-screen" style="--auth-background:url(https://picsum.photos/seed/zamorin-fallback-01/3840/2160)">
      <div class="login-card glass-dark">
        <div class="login-brand">
          <img src="src/assets/zamorin-logo-horizontal.svg" alt="Zamorin Estate Pvt. Ltd." class="login-brand-logo" />
          <div class="login-sub">${safeSubtitle}</div>
        </div>
        <form id="mfa-challenge-form">
          <div style="color:var(--text-on-glass); font-weight:600; font-size:16px; margin-bottom:6px;">${safeTitle}</div>
          <div class="muted-white" style="font-size:12.5px; line-height:1.5; margin-bottom:18px;">${safeDescription}</div>
          <label class="login-label" for="mfa-challenge-input">${inputLabel}</label>
          <input id="mfa-challenge-input" class="text-input" type="text" inputmode="${mfaUseRecoveryCode ? "text" : "numeric"}" autocomplete="one-time-code" placeholder="${mfaUseRecoveryCode ? "Enter one recovery code" : "Enter 6-digit code"}" ${mfaBusy ? "disabled" : ""} />
          ${mfaError ? `<div class="login-error">${escapeAttribute(mfaError)}</div>` : ""}
          <button type="submit" class="btn btn-primary" style="width:100%; justify-content:center; margin-top:16px;" ${mfaBusy ? "disabled" : ""}>${mfaBusy ? safeBusyLabel : safeSubmitLabel}</button>
          <button id="mfa-challenge-mode" type="button" class="btn btn-ghost" style="width:100%; justify-content:center; margin-top:8px;" ${mfaBusy ? "disabled" : ""}>${mfaUseRecoveryCode ? "Use authenticator code" : "Use a recovery code"}</button>
          <button id="mfa-back-login" type="button" class="btn btn-ghost" style="width:100%; justify-content:center; margin-top:8px;" ${mfaBusy ? "disabled" : ""}>${safeBackLabel}</button>
        </form>
      </div>
    </div>
  `;
}

export function wireMfaChallenge(
  root,
  { onSubmit, onBack, renderOptions = {} } = {}
) {
  const rerender = () => {
    root.innerHTML = renderMfaChallenge(renderOptions);
    wireMfaChallenge(root, { onSubmit, onBack, renderOptions });
  };

  root.querySelector("#mfa-challenge-mode")?.addEventListener("click", () => {
    mfaUseRecoveryCode = !mfaUseRecoveryCode;
    mfaError = "";
    rerender();
  });

  root.querySelector("#mfa-back-login")?.addEventListener("click", () => {
    resetMfaUi();
    if (typeof onBack === "function") onBack();
  });

  root.querySelector("#mfa-challenge-form")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const value = root.querySelector("#mfa-challenge-input")?.value.trim() || "";

    if (!value) {
      mfaError = mfaUseRecoveryCode
        ? "Enter a recovery code."
        : "Enter the current authenticator code.";
      rerender();
      return;
    }

    if (typeof onSubmit !== "function") {
      mfaError = "Authentication service is unavailable.";
      rerender();
      return;
    }

    mfaBusy = true;
    mfaError = "";
    rerender();

    try {
      await onSubmit(
        mfaUseRecoveryCode
          ? { recoveryCode: value }
          : { code: value }
      );
    } catch (error) {
      mfaBusy = false;
      mfaError = error?.message || "MFA verification failed. Please try again.";
      rerender();
    }
  });
}

export function resetMfaUi() {
  mfaError = "";
  mfaBusy = false;
  mfaUseRecoveryCode = false;
}

let mfaSetupError = "";
let mfaSetupBusy = false;

export function renderMfaSetup({
  manualEntrySecret = "",
} = {}) {
  const safeSecret = escapeAttribute(manualEntrySecret);

  return `
    <div class="login-screen" style="--auth-background:url(https://picsum.photos/seed/zamorin-fallback-01/3840/2160)">
      <div class="login-card glass-dark">
        <div class="login-brand">
          <img src="src/assets/zamorin-logo-horizontal.svg" alt="Zamorin Estate Pvt. Ltd." class="login-brand-logo" />
          <div class="login-sub">Cafe ERP — secure authentication setup</div>
        </div>

        <form id="mfa-setup-form">
          <div style="color:var(--text-on-glass); font-weight:600; font-size:16px; margin-bottom:6px;">Set up multi-factor authentication</div>
          <div class="muted-white" style="font-size:12.5px; line-height:1.5; margin-bottom:18px;">
            Add this account to your authenticator app using the setup key below, then enter the current 6-digit code.
          </div>

          <label class="login-label" for="mfa-setup-secret">Authenticator setup key</label>
          <div style="display:flex; gap:8px;">
            <input id="mfa-setup-secret" class="text-input" type="text" value="${safeSecret}" readonly />
            <button id="mfa-copy-secret" type="button" class="btn btn-ghost" ${mfaSetupBusy ? "disabled" : ""}>Copy</button>
          </div>

          <label class="login-label" for="mfa-setup-code" style="margin-top:14px;">Authenticator code</label>
          <input
            id="mfa-setup-code"
            class="text-input"
            type="text"
            inputmode="numeric"
            autocomplete="one-time-code"
            placeholder="Enter 6-digit code"
            ${mfaSetupBusy ? "disabled" : ""}
          />

          ${mfaSetupError ? `<div class="login-error">${escapeAttribute(mfaSetupError)}</div>` : ""}

          <button
            type="submit"
            class="btn btn-primary"
            style="width:100%; justify-content:center; margin-top:16px;"
            ${mfaSetupBusy ? "disabled" : ""}
          >${mfaSetupBusy ? "Confirming..." : "Confirm MFA setup"}</button>

          <button
            id="mfa-setup-back-login"
            type="button"
            class="btn btn-ghost"
            style="width:100%; justify-content:center; margin-top:8px;"
            ${mfaSetupBusy ? "disabled" : ""}
          >${escapeAttribute(backLabel)}</button>
        </form>
      </div>
    </div>
  `;
}

export function wireMfaSetup(
  root,
  {
    manualEntrySecret = "",
    onSubmit,
    onBack,
  } = {}
) {
  const rerender = () => {
    root.innerHTML = renderMfaSetup({ manualEntrySecret });
    wireMfaSetup(root, {
      manualEntrySecret,
      onSubmit,
      onBack,
    });
  };

  root.querySelector("#mfa-copy-secret")?.addEventListener("click", async () => {
    if (!manualEntrySecret) return;

    try {
      await navigator.clipboard.writeText(manualEntrySecret);
    } catch {
      const secretInput = root.querySelector("#mfa-setup-secret");
      secretInput?.select();
      document.execCommand?.("copy");
    }
  });

  root.querySelector("#mfa-setup-back-login")?.addEventListener("click", () => {
    resetMfaSetupUi();
    if (typeof onBack === "function") onBack();
  });

  root.querySelector("#mfa-setup-form")?.addEventListener("submit", async (event) => {
    event.preventDefault();

    const code =
      root.querySelector("#mfa-setup-code")?.value.trim() || "";

    if (!code) {
      mfaSetupError =
        "Enter the current 6-digit authenticator code.";
      rerender();
      return;
    }

    if (typeof onSubmit !== "function") {
      mfaSetupError =
        "Authentication service is unavailable.";
      rerender();
      return;
    }

    mfaSetupBusy = true;
    mfaSetupError = "";
    rerender();

    try {
      await onSubmit({ code });
    } catch (error) {
      mfaSetupBusy = false;
      mfaSetupError =
        error?.message ||
        "MFA setup confirmation failed. Please try again.";
      rerender();
    }
  });
}

export function resetMfaSetupUi() {
  mfaSetupError = "";
  mfaSetupBusy = false;
}

let recoveryBusy = false;

export function renderRecoveryCodes(recoveryCodes = []) {
  const codes = Array.isArray(recoveryCodes)
    ? recoveryCodes.filter((code) => typeof code === "string" && code.trim())
    : [];

  const codeList = codes
    .map(
      (code) =>
        `<div class="text-input" style="font-family:monospace; user-select:all;">${escapeAttribute(code)}</div>`
    )
    .join("");

  return `
    <div class="login-screen" style="--auth-background:url(https://picsum.photos/seed/zamorin-fallback-01/3840/2160)">
      <div class="login-card glass-dark">
        <div class="login-brand">
          <img src="src/assets/zamorin-logo-horizontal.svg" alt="Zamorin Estate Pvt. Ltd." class="login-brand-logo" />
          <div class="login-sub">Cafe ERP — MFA recovery</div>
        </div>

        <div style="color:var(--text-on-glass); font-weight:600; font-size:16px; margin-bottom:6px;">
          Save your recovery codes
        </div>
        <div class="muted-white" style="font-size:12.5px; line-height:1.5; margin-bottom:16px;">
          Store these one-time codes in a secure place. They will not be shown again after you continue.
        </div>

        <div id="mfa-recovery-codes" style="display:grid; gap:8px;">
          ${codeList}
        </div>

        <button
          id="mfa-copy-recovery-codes"
          type="button"
          class="btn btn-ghost"
          style="width:100%; justify-content:center; margin-top:14px;"
          ${recoveryBusy ? "disabled" : ""}
        >Copy all codes</button>

        <button
          id="mfa-recovery-continue"
          type="button"
          class="btn btn-primary"
          style="width:100%; justify-content:center; margin-top:8px;"
          ${recoveryBusy ? "disabled" : ""}
        >I have saved these codes</button>
      </div>
    </div>
  `;
}

export function wireRecoveryCodes(root, { recoveryCodes = [], onContinue } = {}) {
  root.querySelector("#mfa-copy-recovery-codes")?.addEventListener("click", async () => {
    const text = recoveryCodes.join("\n");
    if (!text) return;

    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const temporary = document.createElement("textarea");
      temporary.value = text;
      temporary.setAttribute("readonly", "");
      temporary.style.position = "fixed";
      temporary.style.opacity = "0";
      document.body.appendChild(temporary);
      temporary.select();
      document.execCommand?.("copy");
      temporary.remove();
    }
  });

  root.querySelector("#mfa-recovery-continue")?.addEventListener("click", async () => {
    if (typeof onContinue !== "function" || recoveryBusy) return;
    recoveryBusy = true;
    root.innerHTML = renderRecoveryCodes(recoveryCodes);
    wireRecoveryCodes(root, { recoveryCodes, onContinue });

    try {
      await onContinue();
    } catch {
      recoveryBusy = false;
      root.innerHTML = renderRecoveryCodes(recoveryCodes);
      wireRecoveryCodes(root, { recoveryCodes, onContinue });
    }
  });
}

export function resetRecoveryCodesUi() {
  recoveryBusy = false;
}

let passwordChangeError = "";
let passwordChangeBusy = false;

export function renderPasswordChange({
  title = "Change your temporary password",
  description = "Your account requires a new password before you can continue.",
  submitLabel = "Change password",
  busyLabel = "Changing password...",
  backLabel = "Back to sign in",
} = {}) {
  return `
    <div class="login-screen" style="--auth-background:url(https://picsum.photos/seed/zamorin-fallback-01/3840/2160)">
      <div class="login-card glass-dark">
        <div class="login-brand">
          <img src="src/assets/zamorin-logo-horizontal.svg" alt="Zamorin Estate Pvt. Ltd." class="login-brand-logo" />
          <div class="login-sub">Cafe ERP — account security</div>
        </div>

        <form id="password-change-form">
          <div style="color:var(--text-on-glass); font-weight:600; font-size:16px; margin-bottom:6px;">${escapeAttribute(title)}</div>
          <div class="muted-white" style="font-size:12.5px; line-height:1.5; margin-bottom:18px;">
            ${escapeAttribute(description)}
          </div>

          <label class="login-label" for="password-change-current">Current password</label>
          <input
            id="password-change-current"
            class="text-input"
            type="password"
            autocomplete="current-password"
            ${passwordChangeBusy ? "disabled" : ""}
          />

          <label class="login-label" for="password-change-new" style="margin-top:14px;">New password</label>
          <input
            id="password-change-new"
            class="text-input"
            type="password"
            autocomplete="new-password"
            ${passwordChangeBusy ? "disabled" : ""}
          />

          <label class="login-label" for="password-change-confirm" style="margin-top:14px;">Confirm new password</label>
          <input
            id="password-change-confirm"
            class="text-input"
            type="password"
            autocomplete="new-password"
            ${passwordChangeBusy ? "disabled" : ""}
          />

          ${passwordChangeError ? `<div class="login-error">${escapeAttribute(passwordChangeError)}</div>` : ""}

          <button
            type="submit"
            class="btn btn-primary"
            style="width:100%; justify-content:center; margin-top:16px;"
            ${passwordChangeBusy ? "disabled" : ""}
          >${passwordChangeBusy ? escapeAttribute(busyLabel) : escapeAttribute(submitLabel)}</button>

          <button
            id="password-change-back-login"
            type="button"
            class="btn btn-ghost"
            style="width:100%; justify-content:center; margin-top:8px;"
            ${passwordChangeBusy ? "disabled" : ""}
          >Back to sign in</button>
        </form>
      </div>
    </div>
  `;
}

export function wirePasswordChange(root, { onSubmit, onBack, renderOptions = {} } = {}) {
  const rerender = () => {
    root.innerHTML = renderPasswordChange(renderOptions);
    wirePasswordChange(root, { onSubmit, onBack, renderOptions });
  };

  root.querySelector("#password-change-back-login")?.addEventListener("click", () => {
    resetPasswordChangeUi();
    if (typeof onBack === "function") onBack();
  });

  root.querySelector("#password-change-form")?.addEventListener("submit", async (event) => {
    event.preventDefault();

    const currentPassword =
      root.querySelector("#password-change-current")?.value || "";
    const newPassword =
      root.querySelector("#password-change-new")?.value || "";
    const confirmPassword =
      root.querySelector("#password-change-confirm")?.value || "";

    if (!currentPassword || !newPassword || !confirmPassword) {
      passwordChangeError = "Enter your current password and the new password twice.";
      rerender();
      return;
    }

    if (newPassword !== confirmPassword) {
      passwordChangeError = "The new password entries do not match.";
      rerender();
      return;
    }

    if (typeof onSubmit !== "function") {
      passwordChangeError = "Authentication service is unavailable.";
      rerender();
      return;
    }

    passwordChangeBusy = true;
    passwordChangeError = "";
    rerender();

    try {
      await onSubmit({ currentPassword, newPassword });
    } catch (error) {
      passwordChangeBusy = false;
      passwordChangeError =
        error?.message ||
        "Password change failed. Please try again.";
      rerender();
    }
  });
}

export function resetPasswordChangeUi() {
  passwordChangeError = "";
  passwordChangeBusy = false;
}

let passwordResetRequestError = "";
let passwordResetRequestBusy = false;

export function renderPasswordResetRequest({ organisationId = "", email = "" } = {}) {
  return `
    <div class="login-screen" style="--auth-background:url(https://picsum.photos/seed/zamorin-fallback-01/3840/2160)">
      <div class="login-card glass-dark">
        <div class="login-brand">
          <img src="src/assets/zamorin-logo-horizontal.svg" alt="Zamorin Estate Pvt. Ltd." class="login-brand-logo" />
          <div class="login-sub">Cafe ERP - account recovery</div>
        </div>
        <h1 class="auth-login-title">Forgot password</h1>
        <div class="muted-white" style="font-size:12.5px;line-height:1.5;margin-bottom:18px;">Enter your organisation ID and account email. If the account is eligible, a 6-digit verification code will be sent.</div>
        <form id="password-reset-request-form">
          <label class="login-label" for="password-reset-organisation">Organisation ID</label>
          <input id="password-reset-organisation" class="text-input" type="text" autocomplete="organization" placeholder="Organisation ID" value="${escapeAttribute(organisationId)}" style="margin-bottom:14px;" ${passwordResetRequestBusy ? "disabled" : ""} />
          <label class="login-label" for="password-reset-email">Email</label>
          <input id="password-reset-email" class="text-input" type="email" autocomplete="username" placeholder="Email ID" value="${escapeAttribute(email)}" ${passwordResetRequestBusy ? "disabled" : ""} />
          ${passwordResetRequestError ? `<div class="login-error">${escapeAttribute(passwordResetRequestError)}</div>` : ""}
          <button type="submit" class="btn btn-primary" style="width:100%;justify-content:center;margin-top:18px;" ${passwordResetRequestBusy ? "disabled" : ""}>${passwordResetRequestBusy ? "Requesting code..." : "Send verification code"}</button>
          <button id="password-reset-request-back" type="button" class="btn btn-ghost" style="width:100%;justify-content:center;margin-top:10px;" ${passwordResetRequestBusy ? "disabled" : ""}>Back to sign in</button>
        </form>
      </div>
    </div>
  `;
}

export function wirePasswordResetRequest(root, { organisationId = "", email = "", onSubmit, onBack } = {}) {
  const rerender = () => {
    root.innerHTML = renderPasswordResetRequest({ organisationId, email });
    wirePasswordResetRequest(root, { organisationId, email, onSubmit, onBack });
  };

  root.querySelector("#password-reset-request-back")?.addEventListener("click", () => {
    resetPasswordResetRequestUi();
    if (typeof onBack === "function") onBack();
  });

  root.querySelector("#password-reset-request-form")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    organisationId = root.querySelector("#password-reset-organisation")?.value.trim() || "";
    email = root.querySelector("#password-reset-email")?.value.trim().toLowerCase() || "";

    if (!organisationId || !email) {
      passwordResetRequestError = "Enter your organisation ID and email.";
      rerender();
      return;
    }

    if (typeof onSubmit !== "function") {
      passwordResetRequestError = "Password recovery service is unavailable.";
      rerender();
      return;
    }

    passwordResetRequestBusy = true;
    passwordResetRequestError = "";
    rerender();

    try {
      await onSubmit({ organisationId, email });
    } catch (error) {
      passwordResetRequestBusy = false;
      passwordResetRequestError = error?.message || "Password recovery could not be started. Please try again.";
      rerender();
    }
  });
}

export function resetPasswordResetRequestUi() {
  passwordResetRequestError = "";
  passwordResetRequestBusy = false;
}

let passwordResetVerifyError = "";
let passwordResetVerifyBusy = false;

export function renderPasswordResetVerify({ email = "" } = {}) {
  return `
    <div class="login-screen" style="--auth-background:url(https://picsum.photos/seed/zamorin-fallback-01/3840/2160)">
      <div class="login-card glass-dark">
        <div class="login-brand">
          <img src="src/assets/zamorin-logo-horizontal.svg" alt="Zamorin Estate Pvt. Ltd." class="login-brand-logo" />
          <div class="login-sub">Cafe ERP - account recovery</div>
        </div>
        <h1 class="auth-login-title">Verify code</h1>
        <div class="muted-white" style="font-size:12.5px;line-height:1.5;margin-bottom:18px;">Enter the 6-digit verification code for ${escapeAttribute(email)}. The code is time limited and can be used only for this recovery attempt.</div>
        <form id="password-reset-verify-form">
          <label class="login-label" for="password-reset-code">Verification code</label>
          <input id="password-reset-code" class="text-input" type="text" inputmode="numeric" autocomplete="one-time-code" maxlength="6" pattern="[0-9]{6}" placeholder="6-digit code" ${passwordResetVerifyBusy ? "disabled" : ""} />
          ${passwordResetVerifyError ? `<div class="login-error">${escapeAttribute(passwordResetVerifyError)}</div>` : ""}
          <button type="submit" class="btn btn-primary" style="width:100%;justify-content:center;margin-top:18px;" ${passwordResetVerifyBusy ? "disabled" : ""}>${passwordResetVerifyBusy ? "Verifying..." : "Verify code"}</button>
          <button id="password-reset-verify-back" type="button" class="btn btn-ghost" style="width:100%;justify-content:center;margin-top:10px;" ${passwordResetVerifyBusy ? "disabled" : ""}>Back</button>
        </form>
      </div>
    </div>
  `;
}

export function wirePasswordResetVerify(root, { email = "", onSubmit, onBack } = {}) {
  const rerender = () => {
    root.innerHTML = renderPasswordResetVerify({ email });
    wirePasswordResetVerify(root, { email, onSubmit, onBack });
  };

  root.querySelector("#password-reset-verify-back")?.addEventListener("click", () => {
    resetPasswordResetVerifyUi();
    if (typeof onBack === "function") onBack();
  });

  root.querySelector("#password-reset-verify-form")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const code = root.querySelector("#password-reset-code")?.value.trim() || "";

    if (!/^[0-9]{6}$/.test(code)) {
      passwordResetVerifyError = "Enter the 6-digit verification code.";
      rerender();
      return;
    }

    if (typeof onSubmit !== "function") {
      passwordResetVerifyError = "Password recovery verification is unavailable.";
      rerender();
      return;
    }

    passwordResetVerifyBusy = true;
    passwordResetVerifyError = "";
    rerender();

    try {
      await onSubmit({ code });
    } catch (error) {
      passwordResetVerifyBusy = false;
      passwordResetVerifyError = error?.message || "The verification code could not be verified. Please try again.";
      rerender();
    }
  });
}

export function resetPasswordResetVerifyUi() {
  passwordResetVerifyError = "";
  passwordResetVerifyBusy = false;
}

let passwordResetFinalError = "";
let passwordResetFinalBusy = false;

export function renderPasswordResetFinal() {
  const disabled = passwordResetFinalBusy ? " disabled" : "";
  const errorMarkup = passwordResetFinalError
    ? `<div class="login-error">${escapeAttribute(passwordResetFinalError)}</div>`
    : "";

  return `
    <div class="login-screen" style="--auth-background:url(https://picsum.photos/seed/zamorin-fallback-01/3840/2160)">
      <div class="login-card glass-dark">
        <div class="login-brand">
          <img src="src/assets/zamorin-logo-horizontal.svg" alt="Zamorin Estate Pvt. Ltd." class="login-brand-logo" />
          <div class="login-sub">Cafe ERP - account recovery</div>
        </div>
        <h1 class="auth-login-title">Create new password</h1>
        <div class="muted-white" style="font-size:12.5px;line-height:1.5;margin-bottom:18px;">Use at least 12 characters with uppercase, lowercase, number and special character.</div>
        <form id="password-reset-final-form">
          <label class="login-label" for="password-reset-new-password">New password</label>
          <input id="password-reset-new-password" class="text-input" type="password" autocomplete="new-password" minlength="12" maxlength="128" placeholder="New password"${disabled} />
          <label class="login-label" for="password-reset-confirm-password" style="display:block;margin-top:14px;">Confirm new password</label>
          <input id="password-reset-confirm-password" class="text-input" type="password" autocomplete="new-password" minlength="12" maxlength="128" placeholder="Confirm new password"${disabled} />
          ${errorMarkup}
          <button type="submit" class="btn btn-primary" style="width:100%;justify-content:center;margin-top:18px;"${disabled}>${passwordResetFinalBusy ? "Resetting password..." : "Reset password"}</button>
          <button id="password-reset-final-cancel" type="button" class="btn btn-ghost" style="width:100%;justify-content:center;margin-top:10px;"${disabled}>Cancel recovery</button>
        </form>
      </div>
    </div>
  `;
}

export function wirePasswordResetFinal(root, { onSubmit, onCancel } = {}) {
  const rerender = () => {
    root.innerHTML = renderPasswordResetFinal();
    wirePasswordResetFinal(root, { onSubmit, onCancel });
  };

  root.querySelector("#password-reset-final-cancel")?.addEventListener("click", () => {
    resetPasswordResetFinalUi();
    if (typeof onCancel === "function") onCancel();
  });

  root.querySelector("#password-reset-final-form")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const newPassword = root.querySelector("#password-reset-new-password")?.value || "";
    const confirmPassword = root.querySelector("#password-reset-confirm-password")?.value || "";

    if (newPassword.length < 12 || newPassword.length > 128 || !/[a-z]/.test(newPassword) || !/[A-Z]/.test(newPassword) || !/[0-9]/.test(newPassword) || !/[^A-Za-z0-9]/.test(newPassword)) {
      passwordResetFinalError = "Password must be 12-128 characters and include uppercase, lowercase, number and special character.";
      rerender();
      return;
    }

    if (newPassword !== confirmPassword) {
      passwordResetFinalError = "New password and confirmation do not match.";
      rerender();
      return;
    }

    if (typeof onSubmit !== "function") {
      passwordResetFinalError = "Password reset service is unavailable.";
      rerender();
      return;
    }

    passwordResetFinalBusy = true;
    passwordResetFinalError = "";
    rerender();

    try {
      await onSubmit({ newPassword });
    } catch (error) {
      passwordResetFinalBusy = false;
      passwordResetFinalError = error?.message || "Password could not be reset. Please try again.";
      rerender();
    }
  });
}

export function resetPasswordResetFinalUi() {
  passwordResetFinalError = "";
  passwordResetFinalBusy = false;
}
