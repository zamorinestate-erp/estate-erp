/* =====================================================================
   js/cafeOpsApp.js — ROUTER + STARTUP RESOLVER
   ---------------------------------------------------------------------
   Central navigation for every Cafe Operations screen, plus the
   Application Startup Resolver (login spec Section 30-31): on load,
   validate the device server-side (never trust cached local state
   alone — Section 28/109), then resolve to exactly one correct screen.
   Never briefly flashes authenticated content before validation
   completes — the DOM starts empty and only renders once resolution
   finishes.
   ===================================================================== */
(function (global) {
  'use strict';

  const IDENTITY_KEY = 'zamorin.cafeops.identity'; // sessionStorage — same lifetime tier as the session token

  let cafeOpsRoot = null;
  let contextBarRoot = null;

  function getIdentity() {
    try { const raw = sessionStorage.getItem(IDENTITY_KEY); return raw ? JSON.parse(raw) : null; } catch (_) { return null; }
  }
  function setIdentity(obj) {
    try { sessionStorage.setItem(IDENTITY_KEY, JSON.stringify(obj)); } catch (_) {}
  }
  function clearIdentity() {
    try { sessionStorage.removeItem(IDENTITY_KEY); } catch (_) {}
  }

  // Stop any screen-specific timers/watchers before swapping content, so a
  // background clock/QR-rotation/inactivity-watcher from the PREVIOUS
  // screen never keeps running (and never fires a stray navigation) once
  // its DOM is gone.
  function stopActiveScreenTimers() {
    if (global.CafeOpsScreens.kiosk) global.CafeOpsScreens.kiosk.stopTimers();
    if (global.CafeOpsScreens.shell) global.CafeOpsScreens.shell.stopWatcher();
  }

  function navigate(screenName, params) {
    stopActiveScreenTimers();
    if (global.CafeOpsUI.closeErrorPopup) global.CafeOpsUI.closeErrorPopup();

    const showContextBar = screenName === 'shell';
    if (contextBarRoot) contextBarRoot.style.display = showContextBar ? '' : 'none';

    if (screenName === 'status') {
      global.CafeOpsUI.renderStatusScreen(cafeOpsRoot, params || {});
      return;
    }

    const screen = global.CafeOpsScreens[screenName];
    if (!screen) { console.error('[cafe-ops] unknown screen:', screenName); return; }

    if (screenName === 'shell') screen.render(cafeOpsRoot, params, contextBarRoot);
    else screen.render(cafeOpsRoot, params);
  }

  // -------------------------------------------------------------------
  // Startup resolver — login spec Section 30 conceptual order:
  //   inspect enrollment -> validate device -> lifecycle -> cafe
  //   assignment -> connectivity -> Operator/Master session state ->
  //   render the correct screen.
  // -------------------------------------------------------------------
  async function resolveInitialScreen() {
    const deviceToken = global.CafeOpsTokens.getDeviceToken();
    if (!deviceToken) return navigate('registerDevice');

    let statusData;
    try {
      statusData = await global.CafeOpsApi.deviceStatus();
    } catch (err) {
      return handleDeviceResolutionError(err);
    }

    const diag = statusData.diagnostics;
    const device = { cafeId: diag.cafeId, cafeName: diag.cafeName, deviceName: diag.deviceDisplayName };
    // No "is diag.registrationStatus ACTIVE?" branch here: the backend's
    // deviceContext middleware rejects any non-ACTIVE device with a 403
    // before this call can even succeed, so a successful response can only
    // ever describe an ACTIVE device — see handleDeviceResolutionError()
    // for where REVOKED/LOST/RETIRED/REPLACED are actually detected.

    const sessionToken = global.CafeOpsTokens.getSessionToken();
    if (!sessionToken) return navigate('kiosk', { device });

    try {
      const sessionData = await global.CafeOpsApi.getSession();
      const identity = getIdentity() || {};
      identity.device = device;
      setIdentity(identity);
      if (sessionData.session.status === 'LOCKED') {
        return navigate('sessionLocked', { device, session: sessionData.session, operatorName: identity.name, employeeCode: identity.employeeCode });
      }
      return navigate('shell', { device });
    } catch (err) {
      // Session token present but no longer valid (expired / revoked /
      // device reassigned mid-session / remotely ended) — clear it and
      // fall back to the safe default screen rather than getting stuck.
      global.CafeOpsTokens.clearSessionToken();
      clearIdentity();
      return navigate('kiosk', { device });
    }
  }

  function deviceLifecycleStatusConfig(status, device) {
    const map = {
      PENDING: { tone: 'muted', title: 'Registration Pending', message: 'This device has not completed registration.' },
      REVOKED: { tone: 'danger', title: 'Device Deactivated', message: 'This Cafe Operations Device is no longer authorised.' },
      LOST: { tone: 'danger', title: 'Device Access Disabled', message: 'This device cannot access Cafe Operations.' },
      RETIRED: { tone: 'muted', title: 'Device No Longer Active', message: 'Cafe Operations has been disabled on this device.' },
      REPLACED: { tone: 'muted', title: 'Device No Longer Active', message: 'Cafe Operations has been disabled on this device.' },
    };
    const cfg = map[status] || { tone: 'danger', title: 'Cafe Operations Unavailable', message: 'This device cannot access Cafe Operations right now.' };
    return Object.assign({ device, actions: [{ label: 'Device Help', kind: 'secondary', onClick: () => navigate('deviceStatus', { device }) }] }, cfg);
  }

  function handleDeviceResolutionError(err) {
    if (navigator.onLine === false) {
      return navigate('status', {
        tone: 'muted', title: "You're Offline",
        message: 'This device is not connected. Cafe Operations requires a live connection to sign in.',
        actions: [{ label: 'Try Again', onClick: resolveInitialScreen }],
      });
    }
    // deviceContext middleware on the backend rejects any non-ACTIVE device
    // with 403 DEVICE_<STATUS> BEFORE the route handler runs — this is the
    // real place a revoked/lost/retired/replaced device is detected, not a
    // field on a successful response (a non-ACTIVE device can never produce
    // one). Caught here in a jsdom runtime test that a static syntax check
    // would have missed entirely — an earlier version of this function only
    // checked the success path, so this branch never actually fired.
    if (err.status === 403 && /^DEVICE_/.test(err.code || '')) {
      return navigate('status', deviceLifecycleStatusConfig(err.code.replace('DEVICE_', ''), {}));
    }
    if (err.status === 401 && err.code === 'DEVICE_NOT_RECOGNISED') {
      // The stored token doesn't match any known device (e.g. backend data
      // was reset in a dev/test environment) — the only safe recovery is
      // re-registration, so clear the stale token rather than loop forever.
      global.CafeOpsTokens.clearDeviceToken();
      return navigate('registerDevice');
    }
    return navigate('status', {
      tone: 'warning', title: 'Cafe Operations Temporarily Unavailable',
      message: 'This device is connected, but Zamorin cannot currently be reached.',
      actions: [
        { label: 'Try Again', onClick: resolveInitialScreen },
        { label: 'Device Status', kind: 'secondary', onClick: () => navigate('deviceStatus', {}) },
      ],
    });
  }

  global.CafeOpsApp = { navigate, getIdentity, setIdentity, clearIdentity, resolveInitialScreen };

  document.addEventListener('DOMContentLoaded', () => {
    cafeOpsRoot = document.getElementById('cafeOpsRoot');
    contextBarRoot = document.getElementById('cafeOpsContextBar');
    resolveInitialScreen();
  });
})(window);
