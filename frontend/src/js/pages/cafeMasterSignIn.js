// =============================================================================
// ZAMORIN CAFÉ ERP — CAFE OPERATIONS MASTER SIGN-IN TERMINAL SCREEN
//
// Stage 2: Additive frontend placement.
//
// PURPOSE:
//   Renders the Master Account sign-in interface for the Café Operations
//   terminal context. Two sub-screens:
//     1. Credentials step  (email/password + optional access reason)
//     2. MFA challenge step (6-digit TOTP, entered in the same card)
//
// SECURITY CONTRACT:
//   - NO demo/bcrypt accounts are consulted here. All authentication
//     is delegated to the caller via the onSignIn / onMfaVerify callbacks.
//   - Real binding to authService.authenticatePassword + mfaService occurs
//     in Stage 3. Until then, adapters return STAGE_3_AUTH_BINDING_REQUIRED.
//   - Demo mode: if onSignIn is not supplied, the submit shows a deliberate
//     "Not connected – Stage 3 required" message. No mock success path.
//   - Credentials and MFA codes are cleared on cancel, route change, and
//     every auth attempt (pass or fail).
//   - No credential is stored in localStorage / sessionStorage / DOM attrs.
//
// ROUTES:
//   #cafe-master-signin
//
// STAGE-3 SEAM:
//   onSignIn({ identifier, password, accessReason }) → Promise<{
//     requiresMfa: boolean,
//     mfaChallengeId?: string,
//   }>
//   onMfaVerify({ mfaChallengeId, code }) → Promise<void>  (navigate on success)
//   onBack() — return to cafe-operator-signin
//   onCancel() — return to cafe-operator-signin
// =============================================================================

'use strict';

// ─── Module-level mutable UI state ───────────────────────────────────────────
// Kept module-local; never reaches browser storage.

let _step = 'credentials';        // 'credentials' | 'mfa'
let _mfaChallengeId = '';
let _accessReason = '';
let _busy = false;
let _error = '';
let _pwVisible = false;

/**
 * Access reasons — governance metadata passed to the backend so that
 * high-privilege terminal sessions are auditable (why this Master accessed
 * a terminal). Optional unless backend policy says required (Stage 3).
 */
const ACCESS_REASONS = [
  ['ON_SITE_OPERATIONS', 'On-site Operations'],
  ['ISSUE_RESOLUTION', 'Issue Resolution'],
  ['CASH_SALES_REVIEW', 'Cash / Sales Review'],
  ['INVENTORY_PROCUREMENT', 'Inventory / Procurement'],
  ['ATTENDANCE_REVIEW', 'Attendance Review'],
  ['MAINTENANCE_QUALITY', 'Maintenance / Quality'],
  ['OTHER', 'Other'],
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function escHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

import { getCanonicalDeviceId } from '../apiClient.js';

function getDeviceContext() {
  try {
    const cafeName = localStorage.getItem('zamorin_bound_cafe_name') || 'Cafe Operations';
    const cafeId   = localStorage.getItem('zamorin_bound_cafe_id') || '';
    const deviceId = getCanonicalDeviceId() || '';
    return { cafeName, cafeId, deviceId };
  } catch {
    return { cafeName: 'Cafe Operations', cafeId: '', deviceId: '' };
  }
}

// ─── Render helpers ──────────────────────────────────────────────────────────

function renderBrandHeader(ctx) {
  return `
    <div class="login-brand">
      <img src="/src/assets/zamorin-estate-mark.png" alt="Zamorin Café ERP" class="login-mark" />
      <h1 class="login-wordmark">Zamorin</h1>
      <div class="login-sub" style="font-weight:700; font-size:11px; letter-spacing:0.08em; text-transform:uppercase; color:var(--bronze-500);">
        Cafe Operations · Master Access
      </div>
    </div>
    ${ctx.cafeName ? `
      <div class="cafeops-device-strip" style="margin-bottom:18px;">
        <div class="cafeops-cafe-name">${escHtml(ctx.cafeName)}</div>
        ${ctx.deviceId ? `<div class="cafeops-device-name">${escHtml(ctx.deviceId)}</div>` : ''}
      </div>
    ` : ''}
  `;
}

function renderErrorBanner(message) {
  if (!message) return '';
  return `
    <div class="auth-error-banner" role="alert" aria-live="assertive" style="margin-bottom:12px; display:block;">
      ${escHtml(message)}
    </div>
  `;
}

// ─── Screen 1: Credentials ───────────────────────────────────────────────────

function renderCredentials(ctx) {
  const pwType = _pwVisible ? 'text' : 'password';
  const toggleLabel = _pwVisible ? 'Hide password' : 'Show password';

  return `
    <div class="login-screen" data-cafe-ops-screen="cafe-master-signin">
      <div class="login-card" style="max-width:420px;">
        ${renderBrandHeader(ctx)}

        <div class="auth-form-header" style="margin-bottom:20px;">
          <h2 id="cms-heading" style="font-size:1.15rem; font-weight:700; margin:0 0 4px; color:var(--ink);">Master Access</h2>
          <p style="font-size:0.82rem; color:var(--muted); margin:0;">Sign in with your personal Master credentials to access this terminal.</p>
        </div>

        <form id="cms-credentials-form" class="auth-form" novalidate autocomplete="on">

          <!-- Identifier -->
          <div class="auth-field-group">
            <label for="cms-identifier">Email / User ID</label>
            <input
              id="cms-identifier"
              name="username"
              type="text"
              class="auth-input"
              autocomplete="username"
              placeholder="your@email.com"
              required
              aria-required="true"
              aria-describedby="cms-identifier-hint"
              ${_busy ? 'disabled' : ''}
            />
            <div id="cms-identifier-hint" style="font-size:0.74rem; color:var(--muted); margin-top:3px;">
              Your personal Zamorin account email or user ID.
            </div>
          </div>

          <!-- Password with show/hide -->
          <div class="auth-field-group">
            <label for="cms-password">Password</label>
            <div class="auth-password-wrap" style="position:relative; display:flex; gap:0;">
              <input
                id="cms-password"
                name="password"
                type="${pwType}"
                class="auth-input"
                autocomplete="current-password"
                placeholder="Password"
                required
                aria-required="true"
                style="flex:1; border-radius:var(--radius-control) 0 0 var(--radius-control); border-right:none;"
                ${_busy ? 'disabled' : ''}
              />
              <button
                type="button"
                id="cms-pw-toggle"
                aria-pressed="${_pwVisible}"
                aria-label="${toggleLabel}"
                style="
                  padding:0 14px; border:1.5px solid var(--line-strong); border-left:none;
                  background:var(--surface-sunken); color:var(--muted); font-size:0.78rem; font-weight:700;
                  border-radius:0 var(--radius-control) var(--radius-control) 0; cursor:pointer;
                  transition:background 0.12s; white-space:nowrap;
                "
                ${_busy ? 'disabled' : ''}
              >${_pwVisible ? 'Hide' : 'Show'}</button>
            </div>
          </div>

          <!-- Access reason (always visible; blocking enforcement is a Stage-3 backend policy) -->
          <div class="auth-field-group">
            <label for="cms-reason">Reason for terminal access <span style="font-size:0.74rem; color:var(--muted); font-weight:500;">(optional)</span></label>
            <select
              id="cms-reason"
              name="accessReason"
              class="auth-input"
              ${_busy ? 'disabled' : ''}
              style="appearance:auto;"
            >
              <option value="">Select a reason…</option>
              ${ACCESS_REASONS.map(([v, l]) => `<option value="${v}"${_accessReason === v ? ' selected' : ''}>${escHtml(l)}</option>`).join('')}
            </select>
          </div>

          ${renderErrorBanner(_error)}

          <!-- Submit -->
          <button
            type="submit"
            id="cms-submit-btn"
            class="btn btn-primary btn-block"
            style="height:46px; font-weight:700; font-size:15px; margin-top:4px;"
            ${_busy ? 'disabled' : ''}
            aria-busy="${_busy}"
          >
            ${_busy
              ? `<span class="login-spinner" aria-hidden="true"></span><span>Verifying…</span>`
              : 'Continue'}
          </button>

        </form>

        <!-- Secondary actions -->
        <div class="cafeops-textlinks" style="margin-top:16px;">
          <button type="button" id="cms-back-btn" class="cafeops-textlink cafeops-textlink--muted"
            ${_busy ? 'disabled' : ''}>
            ← Back to Operator Sign-In
          </button>
        </div>

        <!-- Connection state -->
        <div id="cms-connection" class="cafeops-connection" aria-live="polite">
          <span class="cafeops-connection-dot"></span><span>Online</span>
        </div>

      </div>
    </div>
  `;
}

// ─── Screen 2: MFA challenge ──────────────────────────────────────────────────

function renderMfaChallenge(ctx) {
  return `
    <div class="login-screen" data-cafe-ops-screen="cafe-master-signin-mfa">
      <div class="login-card" style="max-width:420px;">
        ${renderBrandHeader(ctx)}

        <div class="auth-form-header" style="margin-bottom:16px;">
          <h2 id="cms-mfa-heading" style="font-size:1.1rem; font-weight:700; margin:0 0 4px; color:var(--ink);">Verification Required</h2>
          <p class="cafeops-mfa-hint">Enter the 6-digit code from your authenticator app to confirm your identity.</p>
        </div>

        <!-- 6-digit code row -->
        <div
          id="cms-code-row"
          class="auth-code-row"
          role="group"
          aria-label="6-digit verification code"
          style="margin-bottom:16px;"
        >
          ${Array.from({ length: 6 }, (_, i) =>
            `<input
               class="auth-code-digit"
               type="text"
               inputmode="numeric"
               pattern="[0-9]*"
               maxlength="1"
               autocomplete="${i === 0 ? 'one-time-code' : 'off'}"
               data-code-index="${i}"
               aria-label="Digit ${i + 1} of 6"
             />`
          ).join('')}
        </div>

        ${renderErrorBanner(_error)}

        <button
          type="button"
          id="cms-mfa-verify-btn"
          class="btn btn-primary btn-block"
          style="height:46px; font-weight:700; font-size:15px;"
          disabled
          aria-disabled="true"
          aria-busy="${_busy}"
        >
          ${_busy
            ? `<span class="login-spinner" aria-hidden="true"></span><span>Verifying…</span>`
            : 'Verify'}
        </button>

        <div class="cafeops-textlinks" style="margin-top:14px;">
          <button type="button" id="cms-mfa-back-btn" class="cafeops-textlink cafeops-textlink--muted"
            ${_busy ? 'disabled' : ''}>
            ← Back to Operator Sign-In
          </button>
        </div>
      </div>
    </div>
  `;
}

// ─── Public render ────────────────────────────────────────────────────────────

export function renderCafeMasterSignIn() {
  const ctx = getDeviceContext();
  return _step === 'mfa' ? renderMfaChallenge(ctx) : renderCredentials(ctx);
}

// ─── Wire helpers ─────────────────────────────────────────────────────────────

function _resetSensitive() {
  _step = 'credentials';
  _mfaChallengeId = '';
  _accessReason = '';
  _busy = false;
  _error = '';
  _pwVisible = false;
  // Inputs are in the DOM — caller will have navigated away (root re-rendered)
}

function _updateConnectionBadge(root) {
  const badge = root.querySelector('#cms-connection');
  if (!badge) return;
  const online = navigator.onLine !== false;
  badge.innerHTML = online
    ? `<span class="cafeops-connection-dot"></span><span>Online</span>`
    : `<span class="cafeops-connection-dot" style="background:var(--danger);"></span><span style="color:var(--danger);">Offline</span>`;
  badge.className = `cafeops-connection${online ? '' : ' cafeops-connection--offline'}`;
}

// ─── Credential step wiring ───────────────────────────────────────────────────

function _wireCredentials(root, { onSignIn, onBack }, rerender) {
  const form    = root.querySelector('#cms-credentials-form');
  const toggle  = root.querySelector('#cms-pw-toggle');
  const backBtn = root.querySelector('#cms-back-btn');
  const connEl  = root.querySelector('#cms-connection');

  // Show/hide password toggle
  if (toggle) {
    toggle.addEventListener('click', () => {
      _pwVisible = !_pwVisible;
      rerender();
    });
  }

  // Connection badge live update
  const updateConn = () => _updateConnectionBadge(root);
  window.addEventListener('online', updateConn);
  window.addEventListener('offline', updateConn);
  updateConn();

  // Back navigation — clear state, never leak credentials
  if (backBtn) {
    backBtn.addEventListener('click', () => {
      _resetSensitive();
      if (typeof onBack === 'function') onBack();
    });
  }

  // Escape key cancel
  const escHandler = (e) => {
    if (e.key === 'Escape') {
      _resetSensitive();
      if (typeof onBack === 'function') onBack();
    }
  };
  document.addEventListener('keydown', escHandler);

  // Form submit
  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();

      const identifier = form.querySelector('#cms-identifier')?.value?.trim() || '';
      const password   = form.querySelector('#cms-password')?.value || '';
      _accessReason    = form.querySelector('#cms-reason')?.value || '';

      // Client-side validation
      if (!identifier) {
        _error = 'Please enter your email or User ID.';
        rerender();
        return;
      }
      if (!password) {
        _error = 'Please enter your password.';
        rerender();
        return;
      }

      _error = '';

      // ── STAGE-3 SEAM ─────────────────────────────────────────────────────
      // If no real auth callback is wired yet, show a deliberate integration
      // state — NOT a mock success. No credentials are trusted here.
      if (typeof onSignIn !== 'function') {
        _error = 'Master authentication is not yet connected. Stage 3 backend integration is required.';
        _busy = false;
        rerender();
        return;
      }

      _busy = true;
      rerender();

      try {
        const result = await onSignIn({ identifier, password, accessReason: _accessReason || undefined });

        // Clear password from module state immediately after submission
        // (credential object lives only inside this try block)
        _busy = false;

        if (result && result.requiresMfa) {
          // Transition to MFA step
          _step = 'mfa';
          _mfaChallengeId = result.mfaChallengeId || '';
          _error = '';
          rerender();
        }
        // On full success (no MFA required), caller handles navigation.
        // Reset sensitive state after caller takes over.
        if (result && !result.requiresMfa) {
          _resetSensitive();
        }
      } catch (err) {
        _busy = false;
        _error = err?.message || 'Master access could not be verified. Please check your details and try again.';
        rerender();
      }
    });
  }
}

// ─── MFA step wiring ─────────────────────────────────────────────────────────

function _wireMfa(root, { onMfaVerify, onBack }, rerender) {
  const digits    = Array.from(root.querySelectorAll('[data-code-index]'));
  const verifyBtn = root.querySelector('#cms-mfa-verify-btn');
  const backBtn   = root.querySelector('#cms-mfa-back-btn');

  function currentCode() { return digits.map(d => d.value).join(''); }
  function refreshBtn() {
    const complete = currentCode().length === 6;
    if (verifyBtn) {
      verifyBtn.disabled = !complete || _busy;
      verifyBtn.setAttribute('aria-disabled', String(!complete || _busy));
    }
  }

  digits.forEach((input, i) => {
    input.addEventListener('input', () => {
      input.value = input.value.replace(/[^0-9]/g, '').slice(0, 1);
      if (input.value && digits[i + 1]) digits[i + 1].focus();
      refreshBtn();
    });
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Backspace' && !input.value && digits[i - 1]) digits[i - 1].focus();
    });
    // Paste support — spread a pasted code across all digits
    input.addEventListener('paste', (e) => {
      const pasted = (e.clipboardData || window.clipboardData).getData('text').replace(/\D/g, '').slice(0, 6);
      if (pasted.length === 6) {
        e.preventDefault();
        digits.forEach((d, j) => { d.value = pasted[j] || ''; });
        digits[5].focus();
        refreshBtn();
      }
    });
  });

  // Auto-focus first digit
  if (digits[0]) digits[0].focus();

  if (backBtn) {
    backBtn.addEventListener('click', () => {
      // Clear MFA code from DOM before navigating
      digits.forEach(d => { d.value = ''; });
      _resetSensitive();
      if (typeof onBack === 'function') onBack();
    });
  }

  // Escape cancel
  const escHandler = (e) => {
    if (e.key === 'Escape') {
      digits.forEach(d => { d.value = ''; });
      _resetSensitive();
      if (typeof onBack === 'function') onBack();
    }
  };
  document.addEventListener('keydown', escHandler);

  // Enter submits when complete
  const enterHandler = (e) => {
    if (e.key === 'Enter' && currentCode().length === 6 && !_busy) {
      verifyBtn?.click();
    }
  };
  document.addEventListener('keydown', enterHandler);

  if (verifyBtn) {
    verifyBtn.addEventListener('click', async () => {
      const code = currentCode();
      if (code.length !== 6 || _busy) return;

      // Clear visual error
      _error = '';

      // ── STAGE-3 SEAM ─────────────────────────────────────────────────────
      if (typeof onMfaVerify !== 'function') {
        _error = 'MFA verification is not yet connected. Stage 3 backend integration is required.';
        rerender();
        return;
      }

      _busy = true;
      verifyBtn.disabled = true;
      verifyBtn.setAttribute('aria-busy', 'true');
      verifyBtn.innerHTML = `<span class="login-spinner" aria-hidden="true"></span><span>Verifying…</span>`;

      try {
        await onMfaVerify({ mfaChallengeId: _mfaChallengeId, code });
        // Clear sensitive code immediately after send, before caller navigates
        digits.forEach(d => { d.value = ''; });
        _resetSensitive();
        // Caller handles navigation on success
      } catch (err) {
        _busy = false;
        // Clear code on failure — prevent reuse
        digits.forEach(d => { d.value = ''; });
        if (digits[0]) digits[0].focus();
        _error = err?.message || 'That verification code was not accepted. Please try again.';
        rerender();
      }
    });
  }
}

// ─── Public wire ─────────────────────────────────────────────────────────────

/**
 * Wire all event handlers onto the rendered Master Sign-In screen.
 *
 * @param {HTMLElement} root     — The container that holds renderCafeMasterSignIn() output.
 * @param {Object}  opts
 * @param {Function} [opts.onSignIn]      — Stage-3 seam: submits credentials; returns { requiresMfa, mfaChallengeId }
 * @param {Function} [opts.onMfaVerify]   — Stage-3 seam: submits MFA code; navigates on success
 * @param {Function} [opts.onBack]        — Navigate back to cafe-operator-signin
 */
export function wireCafeMasterSignIn(root, { onSignIn, onMfaVerify, onBack } = {}) {
  // Reset step state on each fresh wire (new route render)
  _step = 'credentials';
  _busy = false;
  _error = '';
  _pwVisible = false;

  const rerender = () => {
    root.innerHTML = renderCafeMasterSignIn();
    wireCafeMasterSignIn(root, { onSignIn, onMfaVerify, onBack });
  };

  if (_step === 'mfa') {
    _wireMfa(root, { onMfaVerify, onBack }, rerender);
  } else {
    _wireCredentials(root, { onSignIn, onBack }, rerender);
  }
}

/**
 * Resets module-level UI state (call on route change, logout, cancel).
 * Clears all credential-related module state without touching browser storage.
 */
export function resetCafeMasterSignInUi() {
  _resetSensitive();
}
