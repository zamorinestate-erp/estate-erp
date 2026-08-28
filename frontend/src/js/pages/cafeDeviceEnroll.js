// =============================================================================
// ZAMORIN CAFÉ ERP — CAFE DEVICE ENROLLMENT TERMINAL SCREEN
//
// Stage 2: Additive frontend placement.
//
// PURPOSE:
//   Renders the one-time device enrollment flow for a Café Operations terminal.
//   An administrator provides a short registration code (out-of-band); the
//   operator enters it here to bind this browser/device to a specific café.
//
// FLOW STATES (frontend only, Stage 2):
//   ENROLLMENT_IDLE       — code entry form
//   ENROLLMENT_SUBMITTING — loading state
//   ENROLLMENT_SUCCESS    — success screen with device context
//   ENROLLMENT_EXPIRED    — code has expired
//   ENROLLMENT_INVALID    — code not recognised
//   ENROLLMENT_ERROR      — generic error
//
// SECURITY CONTRACT:
//   - Enrollment code is NEVER stored in localStorage / sessionStorage / DOM attrs.
//   - The code is cleared from the input immediately on submission (pass or fail).
//   - Real device token assignment happens Stage 3 via the designated adapter.
//   - No fake trust state is ever synthesised.
//   - Until Stage-3 binding exists, the submit shows STAGE_3_AUTH_BINDING_REQUIRED.
//
// ROUTES:
//   #cafe-device-enroll
//
// STAGE-3 SEAM:
//   onEnroll({ enrollmentCode, deviceDisplayName }) → Promise<{ device }>
//   onBack() — return to cafe-device-state or cafe-operator-signin
// =============================================================================

'use strict';

// ─── Module UI state ─────────────────────────────────────────────────────────

let _enrollState = 'ENROLLMENT_IDLE';  // one of the states above
let _enrolledDevice = null;            // populated on success: { cafeName, deviceId }
let _busy = false;
let _error = '';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function escHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function getDeviceContext() {
  try {
    const cafeName = localStorage.getItem('zamorin_bound_cafe_name') || '';
    const deviceId = localStorage.getItem('zamorin_device_id') || '';
    return { cafeName, deviceId };
  } catch {
    return { cafeName: '', deviceId: '' };
  }
}

function renderBrandHeader() {
  return `
    <div class="login-brand">
      <img src="/src/assets/zamorin-estate-mark.png" alt="Zamorin Café ERP" class="login-mark" />
      <h1 class="login-wordmark">Zamorin</h1>
      <div class="login-sub" style="font-weight:700; font-size:11px; letter-spacing:0.08em; text-transform:uppercase; color:var(--bronze-500);">
        Cafe Operations · Device Enrollment
      </div>
    </div>
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

// ─── Screens ──────────────────────────────────────────────────────────────────

function renderIdle() {
  return `
    <div class="login-screen" data-cafe-ops-screen="cafe-device-enroll">
      <div class="login-card" style="max-width:420px;">
        ${renderBrandHeader()}

        <div class="auth-form-header" style="margin-bottom:18px; text-align:center;">
          <div style="
            width:56px; height:56px; border-radius:50%;
            background:var(--surface-sunken); border:1px solid var(--line);
            display:flex; align-items:center; justify-content:center;
            margin:0 auto 12px; font-size:24px;" aria-hidden="true">📱</div>
          <h2 id="cde-heading" style="font-size:1.1rem; font-weight:700; margin:0 0 4px; color:var(--ink);">Register This Device</h2>
          <p style="font-size:0.82rem; color:var(--muted); margin:0; line-height:1.5;">
            Enter the one-time registration code provided by your authorised administrator.
            The code expires after 15 minutes.
          </p>
        </div>

        <form id="cde-enroll-form" class="auth-form" novalidate autocomplete="off">

          <!-- Enrollment code -->
          <div class="auth-field-group">
            <label for="cde-code">Registration code</label>
            <input
              id="cde-code"
              name="enrollmentCode"
              type="text"
              class="auth-input"
              autocomplete="off"
              autocapitalize="characters"
              spellcheck="false"
              placeholder="e.g. K7M2-QRT9"
              required
              aria-required="true"
              aria-describedby="cde-code-hint"
              maxlength="20"
              style="font-family:var(--font-mono); letter-spacing:0.06em; text-transform:uppercase;"
              ${_busy ? 'disabled' : ''}
            />
            <div id="cde-code-hint" style="font-size:0.74rem; color:var(--muted); margin-top:3px;">
              Code is not case-sensitive. Hyphens are optional.
            </div>
          </div>

          <!-- Optional device display name -->
          <div class="auth-field-group">
            <label for="cde-device-name">Device name <span style="font-size:0.74rem; color:var(--muted); font-weight:500;">(optional)</span></label>
            <input
              id="cde-device-name"
              name="deviceDisplayName"
              type="text"
              class="auth-input"
              autocomplete="off"
              placeholder="e.g. Main Counter Terminal"
              maxlength="60"
              ${_busy ? 'disabled' : ''}
            />
            <div style="font-size:0.74rem; color:var(--muted); margin-top:3px;">
              A friendly name helps identify this device in the Devices &amp; Sessions panel.
            </div>
          </div>

          ${renderErrorBanner(_error)}

          <!-- Submit -->
          <button
            type="submit"
            id="cde-submit-btn"
            class="btn btn-primary btn-block"
            style="height:46px; font-weight:700; font-size:15px; margin-top:4px;"
            ${_busy ? 'disabled' : ''}
            aria-busy="${_busy}"
          >
            ${_busy
              ? `<span class="login-spinner" aria-hidden="true"></span><span>Registering…</span>`
              : 'Register Device'}
          </button>

        </form>

        <!-- Help & back -->
        <div class="cafeops-textlinks" style="margin-top:16px;">
          <button type="button" id="cde-help-btn" class="cafeops-textlink cafeops-textlink--muted">
            Need a registration code?
          </button>
          <button type="button" id="cde-back-btn" class="cafeops-textlink cafeops-textlink--muted">
            ← Back to Operator Sign-In
          </button>
        </div>

        <!-- Connection indicator -->
        <div id="cde-connection" class="cafeops-connection" aria-live="polite">
          <span class="cafeops-connection-dot"></span><span>Online</span>
        </div>

      </div>
    </div>
  `;
}

function renderSuccess(device) {
  return `
    <div class="login-screen" data-cafe-ops-screen="cafe-device-enroll-success">
      <div class="login-card" style="max-width:420px; text-align:center;">
        ${renderBrandHeader()}

        <!-- Success icon -->
        <div style="
          width:64px; height:64px; border-radius:50%;
          background:var(--success-soft); border:1px solid var(--success-border);
          display:flex; align-items:center; justify-content:center;
          margin:0 auto 14px; font-size:28px;" aria-hidden="true">✓</div>

        <h2 style="font-size:1.2rem; font-weight:700; margin:0 0 6px; color:var(--ink);">Device Registered</h2>
        <p style="font-size:0.84rem; color:var(--muted); margin:0 0 18px; line-height:1.55;">
          This device is now an active Cafe Operations terminal.
        </p>

        ${device && device.cafeName ? `
          <div class="cafeops-device-strip" style="
            background:var(--surface-sunken); border:1px solid var(--line);
            border-radius:var(--radius-md); padding:10px 14px; margin-bottom:20px;">
            <div class="cafeops-cafe-name">${escHtml(device.cafeName)}</div>
            ${device.deviceId ? `<div class="cafeops-device-name">${escHtml(device.deviceId)}</div>` : ''}
          </div>
        ` : ''}

        <!-- Diagnostic rows -->
        <div class="cafeops-diag-list" style="margin-bottom:20px; text-align:left;">
          <div class="cafeops-diag-row">
            <span class="cafeops-diag-label">Status</span>
            <span class="cafeops-diag-value">
              <span class="cafeops-pill">Active</span>
            </span>
          </div>
          <div class="cafeops-diag-row">
            <span class="cafeops-diag-label">Enrollment</span>
            <span class="cafeops-diag-value">Complete</span>
          </div>
          ${device && device.cafeName ? `
            <div class="cafeops-diag-row">
              <span class="cafeops-diag-label">Café</span>
              <span class="cafeops-diag-value">${escHtml(device.cafeName)}</span>
            </div>
          ` : ''}
        </div>

        <!-- Next action -->
        <button
          type="button"
          id="cde-continue-btn"
          class="btn btn-primary btn-block"
          style="height:46px; font-weight:700; font-size:15px;"
        >Continue to Sign-In</button>

      </div>
    </div>
  `;
}

function renderExpiredOrInvalid(tone) {
  const isExpired = tone === 'expired';
  return `
    <div class="login-screen" data-cafe-ops-screen="cafe-device-enroll-${tone}">
      <div class="login-card" style="max-width:420px; text-align:center;">
        ${renderBrandHeader()}

        <div style="
          width:60px; height:60px; border-radius:50%;
          background:var(--danger-soft); border:1px solid var(--danger-border);
          display:flex; align-items:center; justify-content:center;
          margin:0 auto 14px; font-size:24px;" aria-hidden="true">⏱️</div>

        <h2 style="font-size:1.1rem; font-weight:700; margin:0 0 6px; color:var(--ink);">
          ${isExpired ? 'Code Expired' : 'Code Not Recognised'}
        </h2>
        <p style="font-size:0.84rem; color:var(--muted); margin:0 0 20px; line-height:1.55;">
          ${isExpired
            ? 'This registration code has expired. Codes are valid for 15 minutes. Please ask your administrator for a new code.'
            : 'This registration code is invalid or has already been used. Please check the code or ask your administrator for a new one.'}
        </p>

        <button type="button" id="cde-retry-btn" class="btn btn-primary btn-block"
          style="height:44px; font-weight:700; margin-bottom:10px;">
          Try a Different Code
        </button>
        <button type="button" id="cde-back-btn2" class="btn btn-secondary btn-block"
          style="height:40px; font-size:13px;">
          ← Back to Operator Sign-In
        </button>
      </div>
    </div>
  `;
}

// ─── Public render ────────────────────────────────────────────────────────────

export function renderCafeDeviceEnroll() {
  if (_enrollState === 'ENROLLMENT_SUCCESS') return renderSuccess(_enrolledDevice);
  if (_enrollState === 'ENROLLMENT_EXPIRED') return renderExpiredOrInvalid('expired');
  if (_enrollState === 'ENROLLMENT_INVALID') return renderExpiredOrInvalid('invalid');
  return renderIdle();
}

// ─── Public wire ─────────────────────────────────────────────────────────────

/**
 * Wire event handlers onto the rendered Device Enrollment screen.
 *
 * @param {HTMLElement} root
 * @param {Object} opts
 * @param {Function} [opts.onEnroll]  — Stage-3 seam: { enrollmentCode, deviceDisplayName } → Promise<{ device }>
 * @param {Function} [opts.onBack]    — Navigate back (cafe-operator-signin or cafe-device-state)
 * @param {Function} [opts.onSuccess] — Called after successful enrollment (navigate to sign-in)
 */
export function wireCafeDeviceEnroll(root, { onEnroll, onBack, onSuccess } = {}) {
  // Reset on fresh wire
  _enrollState = 'ENROLLMENT_IDLE';
  _enrolledDevice = null;
  _busy = false;
  _error = '';

  const rerender = () => {
    root.innerHTML = renderCafeDeviceEnroll();
    wireCafeDeviceEnroll(root, { onEnroll, onBack, onSuccess });
  };

  // ── Success screen buttons ─────────────────────────────────────────────────
  const continueBtn = root.querySelector('#cde-continue-btn');
  if (continueBtn) {
    continueBtn.addEventListener('click', () => {
      _resetEnrollState();
      if (typeof onSuccess === 'function') onSuccess();
      else if (typeof onBack === 'function') onBack();
    });
    return; // success screen is wired, done
  }

  // ── Expired/invalid retry buttons ─────────────────────────────────────────
  const retryBtn = root.querySelector('#cde-retry-btn');
  if (retryBtn) {
    retryBtn.addEventListener('click', () => {
      _resetEnrollState();
      rerender();
    });
  }
  const back2Btn = root.querySelector('#cde-back-btn2');
  if (back2Btn) {
    back2Btn.addEventListener('click', () => {
      _resetEnrollState();
      if (typeof onBack === 'function') onBack();
    });
    return;
  }

  // ── Idle form ─────────────────────────────────────────────────────────────
  const form    = root.querySelector('#cde-enroll-form');
  const backBtn = root.querySelector('#cde-back-btn');
  const helpBtn = root.querySelector('#cde-help-btn');
  const connEl  = root.querySelector('#cde-connection');

  // Connection badge
  const updateConn = () => {
    if (!connEl) return;
    const online = navigator.onLine !== false;
    connEl.innerHTML = online
      ? `<span class="cafeops-connection-dot"></span><span>Online</span>`
      : `<span class="cafeops-connection-dot" style="background:var(--danger);"></span><span style="color:var(--danger);">Offline</span>`;
    connEl.className = `cafeops-connection${online ? '' : ' cafeops-connection--offline'}`;
  };
  window.addEventListener('online', updateConn);
  window.addEventListener('offline', updateConn);
  updateConn();

  if (backBtn) {
    backBtn.addEventListener('click', () => {
      _resetEnrollState();
      if (typeof onBack === 'function') onBack();
    });
  }

  if (helpBtn) {
    helpBtn.addEventListener('click', () => {
      // Safe guidance — no internal secrets revealed
      _showHelpPopup(root);
    });
  }

  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();

      const codeInput = form.querySelector('#cde-code');
      const nameInput = form.querySelector('#cde-device-name');

      // Normalise code: strip spaces/hyphens, uppercase
      const rawCode = codeInput?.value?.trim() || '';
      const enrollmentCode = rawCode.replace(/[\s\-]/g, '').toUpperCase();
      const deviceDisplayName = nameInput?.value?.trim() || undefined;

      // Clear raw value from input immediately regardless of outcome
      if (codeInput) codeInput.value = '';

      if (!enrollmentCode) {
        _error = 'Please enter the registration code.';
        rerender();
        return;
      }

      // ── STAGE-3 SEAM ──────────────────────────────────────────────────────
      if (typeof onEnroll !== 'function') {
        _error = 'Device enrollment is not yet connected. Stage 3 backend integration is required.';
        rerender();
        return;
      }

      _busy = true;
      _error = '';
      rerender();

      try {
        const result = await onEnroll({ enrollmentCode, deviceDisplayName });
        _busy = false;
        _enrollState = 'ENROLLMENT_SUCCESS';
        _enrolledDevice = result?.device || null;
        rerender();
      } catch (err) {
        _busy = false;
        const code = err?.code || '';
        if (code === 'ENROLLMENT_EXPIRED' || /expired/i.test(err?.message || '')) {
          _enrollState = 'ENROLLMENT_EXPIRED';
        } else if (code === 'ENROLLMENT_UNAVAILABLE' || code === 'INVALID_CODE' || /invalid|not found|unknown/i.test(err?.message || '')) {
          _enrollState = 'ENROLLMENT_INVALID';
        } else {
          _enrollState = 'ENROLLMENT_IDLE';
          _error = err?.message || 'Unable to register this device right now. Please try again.';
        }
        rerender();
      }
    });
  }
}

function _showHelpPopup(root) {
  // Non-intrusive info panel rendered inline below the form
  const existing = root.querySelector('#cde-help-panel');
  if (existing) { existing.remove(); return; }
  const panel = document.createElement('div');
  panel.id = 'cde-help-panel';
  panel.setAttribute('role', 'note');
  panel.style.cssText = `
    margin-top:14px; padding:12px 14px; border-radius:var(--radius-md);
    background:var(--surface-sunken); border:1px solid var(--line);
    font-size:12px; color:var(--muted); line-height:1.55;
  `;
  panel.innerHTML = `
    <strong style="color:var(--ink); display:block; margin-bottom:5px;">How to get a registration code</strong>
    Registration codes are issued by an authorised Zamorin administrator through the
    <strong>Devices &amp; Sessions</strong> panel in the management interface.
    Each code is valid for 15 minutes and can only be used once.<br/><br/>
    If you do not have an administrator contact, ask your café manager.
  `;
  const textlinks = root.querySelector('.cafeops-textlinks');
  if (textlinks) textlinks.insertAdjacentElement('beforebegin', panel);
  else root.querySelector('.login-card')?.appendChild(panel);
}

function _resetEnrollState() {
  _enrollState = 'ENROLLMENT_IDLE';
  _enrolledDevice = null;
  _busy = false;
  _error = '';
}

/**
 * Resets module-level UI state (call on route change or logout).
 */
export function resetCafeDeviceEnrollUi() {
  _resetEnrollState();
}
