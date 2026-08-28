/* =====================================================================
   js/screens/deviceStatusHelp.js
   ---------------------------------------------------------------------
   Safe pre-login diagnostics (login spec Section 86-90). Never requires
   an active session, never shows secrets/tokens/stack traces — only
   what's explicitly listed in Section 87.
   ===================================================================== */
(function (global) {
  'use strict';
  const UI = global.CafeOpsUI;

  function render(root, params) {
    const device = (params && params.device) || {};
    root.innerHTML = `
      <div class="auth-card">
        ${UI.brandHeader({
          device: device.cafeName ? { cafeName: device.cafeName, deviceName: device.deviceName } : null,
          title: 'Help & Device Status',
        })}
        <div class="cafeops-diag-list" id="diagList">
          ${row('Connection', '<span class="cafeops-pill" id="pillConnection">Checking…</span>')}
          ${row('Zamorin Server', '<span class="cafeops-pill" id="pillServer">Checking…</span>')}
          ${row('Time Sync', '<span class="cafeops-pill" id="pillTime">Checking…</span>')}
          ${row('Registration', '<span class="cafeops-pill" id="pillRegistration">Checking…</span>')}
          ${row('Last Successful Sync', '<span id="valLastSync">—</span>')}
          ${row('Application Version', `<span class="cafeops-diag-value--mono">${UI.escapeHtml(global.CAFE_OPS_APP_VERSION || '1.0.0')}</span>`)}
        </div>
        <div id="supportRefSlot"></div>
        <button type="button" class="auth-btn-primary" id="recheckBtn">
          <span class="auth-btn-label">Run Check Again</span>
          <span class="auth-spinner" aria-hidden="true"></span>
        </button>
        <div class="cafeops-textlinks">
          <button type="button" class="cafeops-textlink cafeops-textlink--muted" id="backLink">Back</button>
        </div>
      </div>`;

    function row(label, valueHtml) {
      return `<div class="cafeops-diag-row"><span class="cafeops-diag-label">${label}</span><span class="cafeops-diag-value">${valueHtml}</span></div>`;
    }

    root.querySelector('#backLink').addEventListener('click', () => history.length > 1 ? history.back() : global.CafeOpsApp.navigate('kiosk', { device }));
    root.querySelector('#recheckBtn').addEventListener('click', () => runCheck(root));
    runCheck(root);
  }

  async function runCheck(root) {
    const btn = root.querySelector('#recheckBtn');
    btn.disabled = true;
    btn.dataset.loading = 'true';
    setPill(root, '#pillConnection', navigator.onLine !== false, navigator.onLine !== false ? 'Online' : 'Offline');

    const deviceToken = global.CafeOpsTokens.getDeviceToken();
    if (!deviceToken) {
      setPill(root, '#pillServer', null, 'N/A');
      setPill(root, '#pillRegistration', false, 'Not registered');
      setPill(root, '#pillTime', null, 'N/A');
      btn.disabled = false; btn.dataset.loading = 'false';
      return;
    }

    try {
      const data = await global.CafeOpsApi.deviceStatus();
      setPill(root, '#pillServer', true, 'Reachable');
      setPill(root, '#pillRegistration', data.diagnostics.registrationStatus === 'ACTIVE', data.diagnostics.registrationStatus);
      const drift = data.serverTime ? Math.abs(new Date(data.serverTime).getTime() - Date.now()) / 1000 : null;
      setPill(root, '#pillTime', drift === null || drift < 120, drift === null ? 'Unknown' : (drift < 120 ? 'Ready' : 'Out of sync'));
      root.querySelector('#valLastSync').textContent = data.diagnostics.lastSyncAt ? new Date(data.diagnostics.lastSyncAt).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }) : 'Never';
    } catch (err) {
      setPill(root, '#pillServer', false, 'Unreachable');
      setPill(root, '#pillRegistration', null, 'Unknown');
      setPill(root, '#pillTime', null, 'Unknown');
      const ref = err.supportReference;
      if (ref) root.querySelector('#supportRefSlot').innerHTML = `<p class="cafeops-support-ref">Reference: <code>${UI.escapeHtml(ref)}</code></p>`;
    }
    btn.disabled = false;
    btn.dataset.loading = 'false';
  }

  function setPill(root, selector, ok, label) {
    const el = root.querySelector(selector);
    if (!el) return;
    el.className = 'cafeops-pill' + (ok === true ? '' : ok === false ? ' cafeops-pill--danger' : ' cafeops-pill--muted');
    el.textContent = label;
  }

  global.CafeOpsScreens = global.CafeOpsScreens || {};
  global.CafeOpsScreens.deviceStatus = { render };
})(window);
