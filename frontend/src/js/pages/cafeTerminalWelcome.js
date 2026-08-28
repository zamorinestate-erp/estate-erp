// =============================================================================
// ZAMORIN CAFÉ ERP — CAFE TERMINAL WELCOME / LOCKED SELECTION SCREEN
//
// Stage 2: Additive frontend placement.
//
// PURPOSE:
//   The "welcome hub" screen for the terminal-auth flow:
//   - Shown when the device is enrolled and known, but no session is active.
//   - Presents primary terminal actions: Operator Sign-In, Master Access,
//     Device Help, Attendance Kiosk.
//   - Also used as the LOCKED state hub (session locked, switch operator).
//
// NOTE ON LOCKING:
//   The actual locked overlay for an active session is handled by
//   cafeOpsInactivity.js (which opens the existing `openOperatorLockModal`).
//   This page is the ROUTE-LEVEL welcome/selection hub, not the inactivity
//   overlay. They are complementary, not overlapping.
//
// ROUTES:
//   #cafe-terminal-welcome
//
// ENTRY POINTS:
//   - From `cafeOperatorSignIn` success → dashboard
//   - From `cafe-device-state` with SESSION_EXPIRED / SESSION_LOCKED
//   - Direct navigation by authenticated CAFE_ADMIN role
//
// SECURITY:
//   - No management content is shown pre-auth.
//   - No role-specific navigation is rendered.
//   - No café financial data is displayed.
//   - Sensitive data from prior session is NOT shown.
// =============================================================================

'use strict';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function escHtml(str) {
  if (!str) return '';
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function getDeviceContext() {
  try {
    const cafeName = localStorage.getItem('zamorin_bound_cafe_name') || '';
    const cafeId   = localStorage.getItem('zamorin_bound_cafe_id') || '';
    const deviceId = localStorage.getItem('zamorin_device_id') || '';
    return { cafeName, cafeId, deviceId };
  } catch {
    return { cafeName: '', cafeId: '', deviceId: '' };
  }
}

function formatDate() {
  try {
    return new Date().toLocaleDateString('en-IN', {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
    });
  } catch {
    return new Date().toDateString();
  }
}

function getOnlineStatus() {
  const online = navigator.onLine !== false;
  return { online, label: online ? 'Online' : 'Offline', cls: online ? '' : ' cafeops-connection--offline' };
}

// ─── Render ──────────────────────────────────────────────────────────────────

/**
 * Render the terminal welcome / locked selection screen.
 *
 * @param {Object} [opts]
 * @param {string} [opts.mode]  'welcome' | 'session_expired'
 *                              Defaults to 'welcome'
 */
export function renderCafeTerminalWelcome({ mode = 'welcome' } = {}) {
  const ctx = getDeviceContext();
  const conn = getOnlineStatus();
  const isExpired = mode === 'session_expired';

  return `
    <div class="login-screen" data-cafe-ops-screen="cafe-terminal-welcome" data-mode="${mode}">
      <div class="login-card" style="max-width:440px;">

        <!-- Brand -->
        <div class="login-brand">
          <img src="/src/assets/zamorin-estate-mark.png" alt="Zamorin Café ERP" class="login-mark" />
          <h1 class="login-wordmark">Zamorin</h1>
          <div class="login-sub" style="font-weight:700; font-size:11px; letter-spacing:0.08em; text-transform:uppercase; color:var(--bronze-500);">
            Café Operations Terminal
          </div>
        </div>

        <!-- Device identity strip -->
        ${ctx.cafeName ? `
          <div class="cafeops-device-strip" style="margin-bottom:22px;">
            <div class="cafeops-cafe-name">${escHtml(ctx.cafeName)}</div>
            ${ctx.deviceId ? `<div class="cafeops-device-name">${escHtml(ctx.deviceId)}</div>` : ''}
          </div>
        ` : ''}

        <!-- Date / session state -->
        <div style="text-align:center; margin-bottom:22px;">
          ${isExpired ? `
            <div style="
              display:inline-flex; align-items:center; gap:6px;
              padding:4px 14px; border-radius:999px;
              background:var(--warning-soft); border:1px solid var(--warning-border);
              font-size:11px; font-weight:700; color:var(--warning);
              text-transform:uppercase; letter-spacing:0.05em; margin-bottom:10px;
            " aria-label="Session status: Expired">
              ⏱️ Session Expired
            </div>
            <p style="font-size:0.82rem; color:var(--muted); margin:0; line-height:1.5;">
              Your Operator session has expired. Please sign in again to continue.
            </p>
          ` : `
            <div style="font-size:0.78rem; color:var(--muted);" aria-label="Current date">${formatDate()}</div>
          `}
        </div>

        <!-- Primary action: Operator PIN Sign-In -->
        <button
          type="button"
          id="ctw-operator-signin-btn"
          class="btn btn-primary btn-block"
          style="height:50px; font-size:15px; font-weight:700; margin-bottom:12px;"
          aria-label="Operator Sign-In — enter your 6-digit PIN"
        >
          <span style="margin-right:8px;" aria-hidden="true">🔑</span>
          Operator Sign-In
        </button>

        <!-- Divider -->
        <div class="cafeops-divider">or</div>

        <!-- Secondary: Master Access -->
        <button
          type="button"
          id="ctw-master-signin-btn"
          class="cafeops-textlink"
          style="width:100%; padding:10px; margin-bottom:4px;"
          aria-label="Sign in with Master Account — for authorised management personnel"
        >
          Sign in with Master Account
        </button>

        <!-- Tertiary actions -->
        <div class="cafeops-textlinks">
          <button type="button" id="ctw-enroll-btn" class="cafeops-textlink cafeops-textlink--muted"
            aria-label="Device not enrolled — register this device">
            Register This Device
          </button>
          <button type="button" id="ctw-kiosk-btn" class="cafeops-textlink cafeops-textlink--muted"
            aria-label="Return to Attendance Kiosk">
            ← Attendance Kiosk
          </button>
        </div>

        <!-- Connection status -->
        <div id="ctw-connection" class="cafeops-connection${conn.cls}" aria-live="polite" style="margin-top:20px;">
          <span class="cafeops-connection-dot"${conn.online ? '' : ' style="background:var(--danger);"'}></span>
          <span${conn.online ? '' : ' style="color:var(--danger);"'}>${escHtml(conn.label)}</span>
        </div>

        <!-- Terminal info footer -->
        <div style="
          margin-top:18px; padding-top:14px; border-top:1px solid var(--line);
          font-size:0.72rem; color:var(--muted); text-align:center;
          display:flex; justify-content:center; gap:12px; flex-wrap:wrap;
        ">
          ${ctx.cafeName ? `<span>📍 ${escHtml(ctx.cafeName)}</span>` : ''}
          ${ctx.deviceId ? `<span style="font-family:var(--font-mono);">${escHtml(ctx.deviceId)}</span>` : ''}
          <span>Zamorin Café ERP</span>
        </div>

      </div>
    </div>
  `;
}

// ─── Wire ────────────────────────────────────────────────────────────────────

/**
 * Wire event handlers onto the rendered Terminal Welcome screen.
 *
 * @param {HTMLElement} root
 * @param {Object} opts
 * @param {Function} [opts.onOperatorSignIn]  Navigate to cafe-operator-signin
 * @param {Function} [opts.onMasterSignIn]    Navigate to cafe-master-signin
 * @param {Function} [opts.onEnroll]          Navigate to cafe-device-enroll
 * @param {Function} [opts.onKiosk]           Navigate to kiosk-attendance
 */
export function wireCafeTerminalWelcome(root, {
  onOperatorSignIn,
  onMasterSignIn,
  onEnroll,
  onKiosk,
} = {}) {
  const operatorBtn = root.querySelector('#ctw-operator-signin-btn');
  const masterBtn   = root.querySelector('#ctw-master-signin-btn');
  const enrollBtn   = root.querySelector('#ctw-enroll-btn');
  const kioskBtn    = root.querySelector('#ctw-kiosk-btn');
  const connEl      = root.querySelector('#ctw-connection');

  // Connection badge live update
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

  if (operatorBtn) {
    operatorBtn.addEventListener('click', () => {
      if (typeof onOperatorSignIn === 'function') onOperatorSignIn();
    });
  }

  if (masterBtn) {
    masterBtn.addEventListener('click', () => {
      if (typeof onMasterSignIn === 'function') onMasterSignIn();
    });
  }

  if (enrollBtn) {
    enrollBtn.addEventListener('click', () => {
      if (typeof onEnroll === 'function') onEnroll();
    });
  }

  if (kioskBtn) {
    kioskBtn.addEventListener('click', () => {
      if (typeof onKiosk === 'function') onKiosk();
    });
  }
}
