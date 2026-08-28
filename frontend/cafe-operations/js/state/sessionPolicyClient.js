/* =====================================================================
   js/state/sessionPolicyClient.js
   ---------------------------------------------------------------------
   Inactivity tracking driven by real human interaction (login spec
   Section 61 / master spec Section 58: "background polling... must not
   indefinitely keep the privileged session alive"). Listens for
   pointerdown/keydown/touchstart, and only sends a heartbeat to the
   server when genuine activity has actually happened — never on a blind
   interval regardless of activity. Shows the pre-timeout warning toast
   locally, then locks proactively (both client-side navigation AND an
   explicit server lock call) rather than waiting for the user to hit a
   401/423 on their next action.
   ===================================================================== */
(function (global) {
  'use strict';

  function createSessionPolicyWatcher({ inactivityMinutes, preWarningSeconds, onWarn, onLock }) {
    let lastActivityAt = Date.now();
    let lastHeartbeatAt = 0;
    let warned = false;
    let stopped = false;
    let checkTimer = null;

    const inactivityMs = inactivityMinutes * 60 * 1000;
    const warnAtMs = inactivityMs - preWarningSeconds * 1000;
    const HEARTBEAT_MIN_INTERVAL_MS = 20 * 1000; // don't hammer the server on every keystroke

    function markActivity() {
      lastActivityAt = Date.now();
      if (warned) { warned = false; } // real activity cancels an in-flight warning
      const sinceHeartbeat = Date.now() - lastHeartbeatAt;
      if (sinceHeartbeat > HEARTBEAT_MIN_INTERVAL_MS) {
        lastHeartbeatAt = Date.now();
        global.CafeOpsApi.heartbeat().catch(() => {}); // best-effort; a failed heartbeat isn't itself a lock trigger
      }
    }

    function check() {
      if (stopped) return;
      const idleFor = Date.now() - lastActivityAt;
      if (idleFor >= inactivityMs) {
        stop();
        if (typeof onLock === 'function') onLock();
        return;
      }
      if (idleFor >= warnAtMs && !warned) {
        warned = true;
        if (typeof onWarn === 'function') onWarn(Math.round((inactivityMs - idleFor) / 1000));
      }
    }

    const events = ['pointerdown', 'keydown', 'touchstart'];
    events.forEach((evt) => document.addEventListener(evt, markActivity, { passive: true }));
    checkTimer = setInterval(check, 5000);

    function stop() {
      stopped = true;
      if (checkTimer) clearInterval(checkTimer);
      events.forEach((evt) => document.removeEventListener(evt, markActivity));
    }

    return { stop, resetActivity: markActivity };
  }

  global.CafeOpsState = global.CafeOpsState || {};
  global.CafeOpsState.createSessionPolicyWatcher = createSessionPolicyWatcher;
})(window);
