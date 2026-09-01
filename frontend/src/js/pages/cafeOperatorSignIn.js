// =============================================================================
// ZAMORIN CAFE ERP — CAFE OPERATIONS OPERATOR SIGN-IN PAGE
//
// DESIGN RULE: Uses identical visual shell as login.js
// (login-screen, login-card, login-brand, login-field, text-input, btn btn-primary)
// This is the dedicated shared-device PIN entry page for authorised Cafe Operators.
//
// SECURITY INVARIANTS:
//  - Does NOT accept personal account password — PIN only
//  - Does NOT show employee list / dropdown (privacy requirement §27)
//  - Forgot PIN → safe guidance message only, no reset on shared device (§21)
//  - Return to Attendance Kiosk link present (§39)
//  - Connection/trust status shown (§61)
//  - PIN never logged, never stored in plaintext (§77)
// =============================================================================

'use strict';

let signInError = '';
let signInBusy = false;
let signInForgotVisible = false;
let pinDigits = []; // array of 0–6 digits collected from keypad

function getDeviceContext() {
  try {
    const id = localStorage.getItem('zamorin_device_id') || 'ZC-DEV-0001';
    const cafe = localStorage.getItem('zamorin_bound_cafe_name') || 'Main Outlet';
    const cafeId = localStorage.getItem('zamorin_bound_cafe_id') || 'ZC-0001';
    return { id, cafe, cafeId };
  } catch {
    return { id: 'ZC-DEV-0001', cafe: 'Main Outlet', cafeId: 'ZC-0001' };
  }
}

function getOnlineStatus() {
  if (!navigator.onLine) return { label: '🔴 Offline', cls: 'status error' };
  return { label: '🟢 Online', cls: 'status success' };
}

function escapeHtml(v) {
  return String(v ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('"', '&quot;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');
}

function renderPinDots(count) {
  return Array.from({ length: 6 }, (_, i) =>
    `<span style="
      display:inline-block; width:14px; height:14px; border-radius:50%;
      background:${i < count ? 'var(--ink)' : 'transparent'};
      border:2px solid ${i < count ? 'var(--ink)' : 'var(--border-default, #ccc)'};
      margin:0 5px; transition:background 0.12s ease;
    "></span>`
  ).join('');
}

/**
 * Renders the full Operator Sign-In page using the same Zamorin login visual shell.
 *
 * @param {Object} opts
 * @param {string} [opts.notice]
 * @returns {string} HTML string
 */
export function renderCafeOperatorSignIn({ notice = '' } = {}) {
  const { id: deviceId, cafe: cafeName, cafeId } = getDeviceContext();
  const online = getOnlineStatus();
  const pinCount = pinDigits.length;

  return `
    <div class="login-screen" data-page="cafe-operator-signin">
      <div class="login-card" style="max-width:420px;">

        <!-- Brand / Logo — identical structure to login.js -->
        <div class="login-brand">
          <img src="/src/assets/zamorin-estate-mark.png" alt="Zamorin" class="login-mark" />
          <h1 class="login-wordmark">Zamorin</h1>
          <div class="login-sub" style="font-weight:700; font-size:12px; letter-spacing:0.08em; text-transform:uppercase; color:var(--color-accent-amber, #b17d38);">
            Cafe Operations
          </div>
        </div>

        <!-- Device / Cafe Context -->
        <div style="
          background:var(--bg-surface-2, #f5f3ee);
          border:1px solid var(--border-subtle, #e5e1d8);
          border-radius:var(--radius-md, 10px);
          padding:10px 14px; margin-bottom:18px;
          display:flex; align-items:center; justify-content:space-between;
          font-size:12px; flex-wrap:wrap; gap:6px;
        ">
          <div>
            <div style="font-weight:700; color:var(--ink); font-size:13px;">
              📍 ${escapeHtml(cafeName)}
              <span style="font-size:10.5px; color:var(--muted); font-family:var(--font-mono);">(${escapeHtml(cafeId)})</span>
            </div>
            <div style="color:var(--muted); font-size:10.5px; font-family:var(--font-mono);">
              Device: ${escapeHtml(deviceId)}
            </div>
          </div>
          <span class="${online.cls}" style="font-size:10px; font-weight:700; padding:2px 8px;">${online.label}</span>
        </div>

        <!-- Section Label -->
        <div style="font-size:13px; font-weight:700; color:var(--ink); margin-bottom:14px; text-align:center; letter-spacing:0.02em;">
          Operator Sign-In
        </div>

        ${notice ? `<div class="login-notice" role="status">${escapeHtml(notice)}</div>` : ''}
        ${signInError ? `<div class="login-error" role="alert">${escapeHtml(signInError)}</div>` : ''}

        <form id="cafe-ops-signin-form" autocomplete="off">

          <!-- Employee ID field -->
          <div class="login-field">
            <label class="login-label" for="ops-employee-id">Your Employee ID</label>
            <input
              id="ops-employee-id"
              class="text-input"
              type="text"
              autocomplete="off"
              placeholder="e.g. AD-0001"
              inputmode="text"
              spellcheck="false"
              style="font-family:var(--font-mono, monospace); letter-spacing:0.05em;"
              ${signInBusy ? 'disabled' : ''}
            />
          </div>

          <!-- 6-Digit PIN display -->
          <div class="login-field">
            <label class="login-label">Operator PIN</label>
            <div id="ops-pin-dots" style="text-align:center; padding:14px 0 10px; user-select:none;" aria-label="PIN digits entered: ${pinCount} of 6">
              ${renderPinDots(pinCount)}
            </div>
            <!-- Hidden input for accessibility / paste handling -->
            <input
              id="ops-pin-hidden"
              type="password"
              inputmode="numeric"
              maxlength="6"
              autocomplete="off"
              style="position:absolute; opacity:0; pointer-events:none; width:1px; height:1px;"
              aria-hidden="true"
            />
          </div>

          <!-- Numeric Keypad -->
          <div id="ops-keypad" style="
            display:grid; grid-template-columns:repeat(3, 1fr);
            gap:10px; margin:0 auto 18px; max-width:280px;
            ${signInBusy ? 'opacity:0.5; pointer-events:none;' : ''}
          " role="group" aria-label="PIN keypad">
            ${[1,2,3,4,5,6,7,8,9,'','0','⌫'].map((k) => {
              if (k === '') return `<div></div>`;
              const isBackspace = k === '⌫';
              return `<button
                type="button"
                class="ops-key-btn"
                data-key="${isBackspace ? 'back' : k}"
                style="
                  height:54px; border-radius:var(--radius-md, 10px);
                  background:var(--bg-surface-2, #f5f3ee);
                  border:1px solid var(--border-subtle, #e5e1d8);
                  font-size:${isBackspace ? '18px' : '20px'}; font-weight:700;
                  color:${isBackspace ? 'var(--muted)' : 'var(--ink)'};
                  cursor:pointer; transition:background 0.1s;
                  touch-action:manipulation;
                "
                aria-label="${isBackspace ? 'Backspace' : k}"
              >${k}</button>`;
            }).join('')}
          </div>

          <!-- Submit Button -->
          <button
            id="ops-signin-btn"
            type="submit"
            class="btn btn-primary login-submit"
            ${signInBusy ? 'disabled' : ''}
            style="height:46px; font-size:15px; font-weight:700;"
          >
            ${signInBusy
              ? `<span class="login-spinner"></span><span>Signing in…</span>`
              : 'Sign In to Cafe Operations'
            }
          </button>
        </form>

        <!-- Forgot PIN / Recovery Guidance -->
        <div style="margin-top:14px; text-align:center;">
          <button
            type="button"
            id="ops-forgot-pin-btn"
            class="login-forgot-link"
            ${signInBusy ? 'disabled' : ''}
          >Forgot Operator PIN?</button>

          ${signInForgotVisible ? `
            <div style="
              margin-top:10px; background:var(--bg-surface-2, #f5f3ee);
              border:1px solid var(--border-subtle); border-radius:var(--radius-md);
              padding:10px 14px; font-size:12px; color:var(--muted); text-align:left;
            " role="note" aria-live="polite">
              <strong style="color:var(--ink);">Forgot your Operator PIN?</strong><br/>
              Reset it through your authorised personal account or contact an authorised administrator.<br/>
              <em>Do not share your PIN with others.</em>
            </div>
          ` : ''}
        </div>

        <!-- Separator -->
        <div style="margin:18px 0; border-top:1px solid var(--border-subtle);"></div>

        <!-- Return to Attendance Kiosk -->
        <div style="text-align:center;">
          <button
            type="button"
            id="ops-return-kiosk-btn"
            class="login-forgot-link"
            style="font-size:12px; color:var(--muted);"
          >
            ← Return to Attendance Kiosk
          </button>
        </div>

      </div>
    </div>
  `;
}

/**
 * Wires event listeners onto the rendered Operator Sign-In page.
 *
 * @param {HTMLElement} root
 * @param {Object} opts
 * @param {Function} [opts.onSignIn] Called with { employeeId, pin } on success
 * @param {Function} [opts.onReturnKiosk] Called when operator returns to kiosk
 */
export function wireCafeOperatorSignIn(root, { onSignIn, onReturnKiosk } = {}) {
  // Reset module-level state on each wire
  pinDigits = [];
  signInError = '';
  signInBusy = false;
  signInForgotVisible = false;

  const rerender = () => {
    root.innerHTML = renderCafeOperatorSignIn();
    wireCafeOperatorSignIn(root, { onSignIn, onReturnKiosk });
  };

  // Keypad button click handler
  const keypad = root.querySelector('#ops-keypad');
  if (keypad) {
    keypad.addEventListener('click', (e) => {
      const btn = e.target.closest('.ops-key-btn');
      if (!btn || signInBusy) return;
      const key = btn.dataset.key;
      if (key === 'back') {
        pinDigits.pop();
      } else if (pinDigits.length < 6 && /^\d$/.test(key)) {
        pinDigits.push(key);
      }
      // Update pin dots only (no full rerender for performance)
      const dots = root.querySelector('#ops-pin-dots');
      if (dots) {
        dots.innerHTML = renderPinDots(pinDigits.length);
        dots.setAttribute('aria-label', `PIN digits entered: ${pinDigits.length} of 6`);
      }
    });
  }

  // Online/offline badge live update
  const updateBadge = () => {
    const badge = root.querySelector('.cafe-ops-online-badge');
    if (!badge) return;
    const online = getOnlineStatus();
    badge.textContent = online.label;
    badge.className = `${online.cls} cafe-ops-online-badge`;
  };
  window.addEventListener('online', updateBadge);
  window.addEventListener('offline', updateBadge);

  // Form submit
  const form = root.querySelector('#cafe-ops-signin-form');
  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const employeeId = root.querySelector('#ops-employee-id')?.value?.trim() || '';
      const pin = pinDigits.join('');

      if (!employeeId) {
        signInError = 'Please enter your Employee ID.';
        rerender();
        return;
      }
      if (pin.length !== 6) {
        signInError = 'Please enter your full 6-digit Operator PIN.';
        rerender();
        return;
      }

      if (typeof onSignIn !== 'function') {
        signInError = 'Authentication service is unavailable.';
        rerender();
        return;
      }

      signInBusy = true;
      signInError = '';
      rerender();

      try {
        await onSignIn({ employeeId, pin });
        // On success, caller handles navigation — reset local state for next use
        pinDigits = [];
        signInBusy = false;
        signInError = '';
      } catch (err) {
        signInBusy = false;
        // Generic message — do NOT reveal employee existence or cafe mismatch details (§53, §71)
        signInError = err?.message || 'Operator code not recognised. Please try again.';
        pinDigits = [];
        rerender();
      }
    });
  }

  // Forgot PIN toggle
  const forgotBtn = root.querySelector('#ops-forgot-pin-btn');
  if (forgotBtn) {
    forgotBtn.addEventListener('click', () => {
      signInForgotVisible = !signInForgotVisible;
      rerender();
    });
  }

  // Return to Kiosk
  const kioskBtn = root.querySelector('#ops-return-kiosk-btn');
  if (kioskBtn) {
    kioskBtn.addEventListener('click', () => {
      pinDigits = [];
      signInError = '';
      if (typeof onReturnKiosk === 'function') {
        onReturnKiosk();
      } else {
        window.location.hash = 'kiosk-attendance';
      }
    });
  }

  // Sign In button (also submits form)
  const signinBtn = root.querySelector('#ops-signin-btn');
  if (signinBtn) {
    signinBtn.addEventListener('click', () => {
      form?.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    });
  }
}

/** Resets module-level UI state (call on route change or logout). */
export function resetCafeOperatorSignInUi() {
  pinDigits = [];
  signInError = '';
  signInBusy = false;
  signInForgotVisible = false;
}
