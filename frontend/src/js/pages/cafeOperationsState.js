// =============================================================================
// ZAMORIN CAFE ERP — CAFE OPERATIONS DEVICE / SESSION STATE SCREENS
//
// Renders all 13 blocked/error/auth states required by §70 of the specification.
// Uses the same Zamorin login-screen visual shell as login.js.
//
// STATES:
//   SESSION_LOCKED        — current operator must reauthenticate
//   SESSION_EXPIRED       — fresh operator authentication required
//   DEVICE_NOT_REGISTERED — authorised device provisioning required
//   DEVICE_NOT_TRUSTED    — Cafe Operations denied (device not verified)
//   WRONG_CAFE            — operator not permitted for this device's cafe
//   DEVICE_REVOKED        — operational access permanently blocked
//   DEVICE_LOST           — device reported lost; access blocked
//   DEVICE_RETIRED        — device retired from service; access blocked
//   DEVICE_REPLACED       — this device has been replaced; use new device
//   OFFLINE               — no network connectivity
//   SYNC_PENDING          — reconnected but sync not complete
//   SYNC_FAILED           — sync failed after reconnection
//   NO_ACCESS             — generic safe authorization denied state
// =============================================================================

'use strict';

const STATE_CONFIG = {
  SESSION_LOCKED: {
    icon: '🔒',
    iconBg: 'var(--bg-surface-2)',
    title: 'Terminal Locked',
    body: 'This Cafe Operations terminal is locked. The assigned operator must enter their Operator PIN to continue.',
    primaryLabel: 'Enter PIN to Unlock',
    primaryAction: 'unlock',
    secondaryLabel: 'Switch Operator',
    secondaryAction: 'switch',
    badge: { text: 'LOCKED', cls: 'status warning' },
  },
  SESSION_EXPIRED: {
    icon: '⏱️',
    iconBg: 'var(--bg-surface-2)',
    title: 'Session Expired',
    body: 'Your Operator Session has expired. Please sign in again to continue Cafe Operations.',
    primaryLabel: 'Sign In Again',
    primaryAction: 'signin',
    secondaryLabel: 'Return to Attendance Kiosk',
    secondaryAction: 'kiosk',
    badge: { text: 'SESSION EXPIRED', cls: 'status error' },
  },
  DEVICE_NOT_REGISTERED: {
    icon: '📱',
    iconBg: 'var(--bg-surface-2)',
    title: 'Device Not Registered',
    body: 'This device has not been registered as a Cafe Operations Device. An authorised administrator must enroll this device before it can be used for Cafe Operations.',
    primaryLabel: null,
    secondaryLabel: 'Return to Attendance Kiosk',
    secondaryAction: 'kiosk',
    badge: { text: 'NOT REGISTERED', cls: 'status neutral' },
    footnote: 'Contact your system administrator to enroll this device.',
  },
  DEVICE_NOT_TRUSTED: {
    icon: '🛡️',
    iconBg: 'var(--bg-surface-2)',
    title: 'Device Not Trusted',
    body: 'Cafe Operations access is not available on this device. Only registered, trusted Cafe Operations Devices may access operational modules.',
    primaryLabel: null,
    secondaryLabel: 'Return to Attendance Kiosk',
    secondaryAction: 'kiosk',
    badge: { text: 'UNTRUSTED', cls: 'status error' },
    footnote: 'If you believe this is an error, contact your administrator.',
  },
  WRONG_CAFE: {
    icon: '🏬',
    iconBg: 'var(--bg-surface-2)',
    title: 'Wrong Cafe Assignment',
    body: 'Cafe Operations access is not available for this operator on this device. Your account is assigned to a different cafe than this device.',
    primaryLabel: null,
    secondaryLabel: 'Return to Attendance Kiosk',
    secondaryAction: 'kiosk',
    badge: { text: 'CAFE MISMATCH', cls: 'status error' },
    footnote: 'Contact your administrator if you believe you should have access to this cafe.',
  },
  DEVICE_REVOKED: {
    icon: '❌',
    iconBg: 'var(--bg-surface-2)',
    title: 'Device Revoked',
    body: 'This Cafe Operations Device has been revoked. Operational access is permanently blocked on this device.',
    primaryLabel: null,
    secondaryLabel: null,
    badge: { text: 'REVOKED', cls: 'status error' },
    footnote: 'Contact your system administrator for a replacement device.',
  },
  DEVICE_LOST: {
    icon: '🚨',
    iconBg: 'var(--bg-surface-2)',
    title: 'Device Reported Lost',
    body: 'This device has been reported as lost. Cafe Operations access is blocked for security. If you have found this device, please contact your administrator immediately.',
    primaryLabel: null,
    secondaryLabel: null,
    badge: { text: 'REPORTED LOST', cls: 'status error' },
    footnote: 'Secure this device and report its location to your system administrator.',
  },
  DEVICE_RETIRED: {
    icon: '🗄️',
    iconBg: 'var(--bg-surface-2)',
    title: 'Device Retired',
    body: 'This Cafe Operations Device has been retired from service. Please use the replacement device assigned for this cafe.',
    primaryLabel: null,
    secondaryLabel: null,
    badge: { text: 'RETIRED', cls: 'status neutral' },
    footnote: 'Contact your administrator to obtain the active replacement device.',
  },
  DEVICE_REPLACED: {
    icon: '🔄',
    iconBg: 'var(--bg-surface-2)',
    title: 'Device Replaced',
    body: 'This device has been replaced. The old device is no longer authorised for Cafe Operations. Please use the new registered device.',
    primaryLabel: null,
    secondaryLabel: null,
    badge: { text: 'REPLACED', cls: 'status neutral' },
    footnote: 'Contact your administrator for the new device details.',
  },
  OFFLINE: {
    icon: '📡',
    iconBg: 'var(--bg-surface-2)',
    title: 'No Network Connection',
    body: 'Cafe Operations requires an active connection. Please check your Wi-Fi or mobile data and try again.',
    primaryLabel: 'Retry Connection',
    primaryAction: 'retry',
    secondaryLabel: 'Return to Attendance Kiosk',
    secondaryAction: 'kiosk',
    badge: { text: 'OFFLINE', cls: 'status error' },
    footnote: 'Data from your last session may be available in offline mode. Authorization requires connectivity.',
  },
  SYNC_PENDING: {
    icon: '🔄',
    iconBg: 'var(--bg-surface-2)',
    title: 'Sync Pending',
    body: 'Your device is connected but data is still synchronising. Some information shown may not reflect the latest server state.',
    primaryLabel: 'Retry Sync',
    primaryAction: 'retry',
    secondaryLabel: null,
    badge: { text: 'SYNC PENDING', cls: 'status warning' },
    footnote: 'Wait for synchronisation to complete before performing financial operations.',
  },
  SYNC_FAILED: {
    icon: '⚠️',
    iconBg: 'var(--bg-surface-2)',
    title: 'Synchronisation Failed',
    body: 'Cafe Operations reconnected but data synchronisation failed. Please retry. If the problem persists, contact your system administrator.',
    primaryLabel: 'Retry Sync',
    primaryAction: 'retry',
    secondaryLabel: 'Return to Attendance Kiosk',
    secondaryAction: 'kiosk',
    badge: { text: 'SYNC FAILED', cls: 'status error' },
    footnote: 'Do not perform financial operations until sync is confirmed.',
  },
  NO_ACCESS: {
    icon: '🚫',
    iconBg: 'var(--bg-surface-2)',
    title: 'Cafe Operations Access Unavailable',
    body: 'Cafe Operations access is not available for this operator on this device.',
    primaryLabel: 'Sign In',
    primaryAction: 'signin',
    secondaryLabel: 'Return to Attendance Kiosk',
    secondaryAction: 'kiosk',
    badge: { text: 'ACCESS DENIED', cls: 'status error' },
    footnote: 'If you believe this is incorrect, contact your system administrator.',
  },
};

function getDeviceContext() {
  try {
    const cafe = localStorage.getItem('zamorin_bound_cafe_name') || '';
    const cafeId = localStorage.getItem('zamorin_bound_cafe_id') || '';
    return { cafe, cafeId };
  } catch {
    return { cafe: '', cafeId: '' };
  }
}

/**
 * Renders a Cafe Operations device/session state screen using the login visual shell.
 *
 * @param {string} stateKey  One of the STATE_CONFIG keys above.
 * @param {Object} [extra]   Extra context: { cafeName, deviceId }
 * @returns {string} HTML string
 */
export function renderCafeOperationsState(stateKey = 'NO_ACCESS', extra = {}) {
  const cfg = STATE_CONFIG[stateKey] || STATE_CONFIG.NO_ACCESS;
  const { cafe: cafeName, cafeId } = extra.cafeName
    ? { cafe: extra.cafeName, cafeId: extra.cafeId || '' }
    : getDeviceContext();

  return `
    <div class="login-screen" data-state="${stateKey}">
      <div class="login-card" style="max-width:440px; text-align:center;">

        <!-- Brand — same as login.js -->
        <div class="login-brand">
          <img src="/src/assets/zamorin-estate-mark.png" alt="Zamorin" class="login-mark" />
          <h1 class="login-wordmark">Zamorin</h1>
          <div class="login-sub" style="font-weight:700; font-size:11px; letter-spacing:0.08em; text-transform:uppercase; color:var(--color-accent-amber, #b17d38);">
            Cafe Operations
          </div>
        </div>

        <!-- State Icon -->
        <div style="
          width:64px; height:64px; border-radius:50%;
          background:${cfg.iconBg};
          border:1px solid var(--border-subtle);
          display:flex; align-items:center; justify-content:center;
          margin:0 auto 14px; font-size:28px;
        " aria-hidden="true">${cfg.icon}</div>

        <!-- Status Badge -->
        ${cfg.badge ? `<span class="${cfg.badge.cls}" style="font-size:10px; font-weight:700; padding:2px 10px; display:inline-block; margin-bottom:10px;">${cfg.badge.text}</span>` : ''}

        <!-- Title -->
        <h2 style="font-size:20px; font-weight:800; color:var(--ink); margin:0 0 10px;">${cfg.title}</h2>

        <!-- Body message (user-safe, no internal details — §71) -->
        <p style="font-size:13px; color:var(--muted); line-height:1.55; margin:0 0 18px;">
          ${cfg.body}
        </p>

        <!-- Cafe Context (if available) -->
        ${cafeName ? `
          <div style="
            background:var(--bg-surface-2);
            border:1px solid var(--border-subtle);
            border-radius:var(--radius-md);
            padding:8px 14px; margin-bottom:18px;
            font-size:12px; color:var(--muted);
          ">
            📍 ${cafeName}${cafeId ? ` <span style="font-family:var(--font-mono); font-size:10.5px;">(${cafeId})</span>` : ''}
          </div>
        ` : ''}

        <!-- Action Buttons -->
        <div style="display:flex; flex-direction:column; gap:10px;">
          ${cfg.primaryLabel ? `
            <button
              class="btn btn-primary"
              id="ops-state-primary-btn"
              type="button"
              data-action="${cfg.primaryAction || ''}"
              style="height:44px; font-weight:700;"
            >
              ${cfg.primaryLabel}
            </button>
          ` : ''}

          ${cfg.secondaryLabel ? `
            <button
              class="btn btn-ghost"
              id="ops-state-secondary-btn"
              type="button"
              data-action="${cfg.secondaryAction || ''}"
              style="font-size:12.5px; color:var(--muted);"
            >
              ${cfg.secondaryLabel}
            </button>
          ` : ''}
        </div>

        <!-- Footnote -->
        ${cfg.footnote ? `
          <p style="margin-top:18px; font-size:11.5px; color:var(--muted); border-top:1px solid var(--border-subtle); padding-top:12px;">
            ${cfg.footnote}
          </p>
        ` : ''}

      </div>
    </div>
  `;
}

/**
 * Wires action handlers onto a rendered state screen.
 *
 * @param {HTMLElement} root
 * @param {Object} opts
 * @param {Function} [opts.onSignIn]   Navigate to Operator Sign-In
 * @param {Function} [opts.onUnlock]   Open Lock modal
 * @param {Function} [opts.onSwitch]   Open Switch Operator modal
 * @param {Function} [opts.onKiosk]    Return to Attendance Kiosk
 * @param {Function} [opts.onRetry]    Retry connection/sync
 */
export function wireCafeOperationsState(root, {
  onSignIn,
  onUnlock,
  onSwitch,
  onKiosk,
  onRetry,
} = {}) {
  const handleAction = (action) => {
    switch (action) {
      case 'signin':
        if (typeof onSignIn === 'function') onSignIn();
        else window.location.hash = 'cafe-operator-signin';
        break;
      case 'unlock':
        if (typeof onUnlock === 'function') onUnlock();
        else {
          // Dynamic import to avoid circular deps
          import('../components.js').then(({ openOperatorLockModal }) => openOperatorLockModal()).catch(() => {});
        }
        break;
      case 'switch':
        if (typeof onSwitch === 'function') onSwitch();
        else {
          import('../components.js').then(({ openSwitchOperatorModal }) => openSwitchOperatorModal()).catch(() => {});
        }
        break;
      case 'kiosk':
        if (typeof onKiosk === 'function') onKiosk();
        else window.location.hash = 'kiosk-attendance';
        break;
      case 'retry':
        if (typeof onRetry === 'function') onRetry();
        else {
          // Re-render this page without full browser reload (preserves session/device/shell).
          import('../router.js').then(({ renderShell }) => renderShell()).catch(() => {});
        }
        break;
    }
  };

  const primaryBtn = root.querySelector('#ops-state-primary-btn');
  if (primaryBtn) {
    primaryBtn.addEventListener('click', () => handleAction(primaryBtn.dataset.action));
  }

  const secondaryBtn = root.querySelector('#ops-state-secondary-btn');
  if (secondaryBtn) {
    secondaryBtn.addEventListener('click', () => handleAction(secondaryBtn.dataset.action));
  }
}

/** All valid state keys — for external validation. */
export const CAFE_OPS_STATES = Object.keys(STATE_CONFIG);
