// =============================================================================
// ZAMORIN CAFE ERP — CAFE OPERATIONS INACTIVITY AUTO-LOCK SERVICE
//
// Per §33: Implements server-aware inactivity handling for CAFE_ADMIN role.
// When the inactivity threshold is reached, the terminal is locked and the
// operator must re-enter their PIN.
//
// RULES:
//  - Only active when role === CAFE_ADMIN
//  - Default 30-minute timeout (configurable)
//  - Activity events: click, keydown, touchstart, mousemove, scroll
//  - Calls openOperatorLockModal() on expiry
//  - Retains device registration on lock (does NOT log out)
//  - Clears on manual lock, switch, or signout
//  - Configurable threshold — not hardcoded across multiple components (§33)
// =============================================================================

'use strict';

/** Default inactivity threshold in milliseconds (30 minutes) */
const DEFAULT_INACTIVITY_MS = 30 * 60 * 1000;

/** Warning threshold — show a warning 2 minutes before lock */
const WARNING_BEFORE_LOCK_MS = 2 * 60 * 1000;

const ACTIVITY_EVENTS = ['click', 'keydown', 'touchstart', 'mousemove', 'scroll', 'pointerdown'];

let _inactivityTimer = null;
let _warningTimer = null;
let _active = false;
let _warningVisible = false;
let _onLockCallback = null;
let _inactivityMs = DEFAULT_INACTIVITY_MS;

function clearTimers() {
  if (_inactivityTimer) { clearTimeout(_inactivityTimer); _inactivityTimer = null; }
  if (_warningTimer) { clearTimeout(_warningTimer); _warningTimer = null; }
}

function dismissWarning() {
  _warningVisible = false;
  const el = document.getElementById('zamorin-inactivity-warning');
  if (el) el.remove();
}

function showWarning() {
  if (_warningVisible) return;
  _warningVisible = true;
  const el = document.createElement('div');
  el.id = 'zamorin-inactivity-warning';
  el.style.cssText = `
    position:fixed; bottom:24px; right:24px; z-index:99999;
    background:var(--color-accent-amber, #b17d38); color:#fff;
    border-radius:12px; padding:12px 20px; font-size:13px; font-weight:700;
    box-shadow:0 4px 24px rgba(0,0,0,0.25); max-width:320px;
    display:flex; align-items:center; gap:10px;
  `;
  el.innerHTML = `
    <span style="font-size:18px;">⏱️</span>
    <div>
      <div>Terminal will lock in 2 minutes</div>
      <div style="font-size:11.5px; font-weight:400; opacity:0.85;">Move or tap to stay active.</div>
    </div>
    <button id="zamorin-inactivity-dismiss" type="button" style="
      background:rgba(255,255,255,0.2); border:none; color:#fff;
      border-radius:8px; padding:4px 10px; font-size:11px; cursor:pointer; margin-left:auto;
    ">Stay Active</button>
  `;
  document.body.appendChild(el);

  el.querySelector('#zamorin-inactivity-dismiss')?.addEventListener('click', () => {
    resetActivityTimer();
    dismissWarning();
  });
}

function triggerLock() {
  dismissWarning();
  if (typeof _onLockCallback === 'function') {
    _onLockCallback();
  } else {
    // Dynamic import to avoid circular dep with components.js
    import('./components.js')
      .then(({ openOperatorLockModal }) => openOperatorLockModal())
      .catch(() => {});
  }
}

function resetActivityTimer() {
  if (!_active) return;
  clearTimers();
  dismissWarning();

  // Warning fires WARNING_BEFORE_LOCK_MS before lock
  if (_inactivityMs > WARNING_BEFORE_LOCK_MS) {
    _warningTimer = setTimeout(showWarning, _inactivityMs - WARNING_BEFORE_LOCK_MS);
  }
  _inactivityTimer = setTimeout(triggerLock, _inactivityMs);
}

const _activityHandler = () => resetActivityTimer();

/**
 * Start the inactivity auto-lock service.
 * Call this after a successful Cafe Operator Sign-In.
 *
 * @param {Object} [opts]
 * @param {number} [opts.inactivityMs] Threshold in ms. Default 30 minutes.
 * @param {Function} [opts.onLock] Called when inactivity lock triggers.
 */
export function startCafeOpsInactivityTimer({ inactivityMs = DEFAULT_INACTIVITY_MS, onLock } = {}) {
  // Stop any existing timer first
  stopCafeOpsInactivityTimer();

  _active = true;
  _inactivityMs = inactivityMs;
  _onLockCallback = onLock || null;

  ACTIVITY_EVENTS.forEach((ev) => {
    window.addEventListener(ev, _activityHandler, { passive: true });
  });

  resetActivityTimer();
}

/**
 * Stop the inactivity auto-lock service.
 * Call on manual lock, switch operator, end session, or signout.
 */
export function stopCafeOpsInactivityTimer() {
  _active = false;
  clearTimers();
  dismissWarning();

  ACTIVITY_EVENTS.forEach((ev) => {
    window.removeEventListener(ev, _activityHandler);
  });

  _onLockCallback = null;
}

/**
 * Reset the inactivity timer without stopping it.
 * Call after successful reauthentication / unlock.
 */
export function resetCafeOpsInactivityTimer() {
  resetActivityTimer();
}

/** Returns true if the inactivity service is currently running. */
export function isCafeOpsInactivityActive() {
  return _active;
}
