/* =====================================================================
   js/screens/sessionLocked.js
   ---------------------------------------------------------------------
   Shown for both manual Lock and automatic inactivity lock (login spec
   Section 58-62 / master spec Section 60-61). Reuses the same shared
   Zamorin auth shell as every other screen — replaces the sensitive
   content entirely rather than floating a PIN modal over a still-visible
   dashboard (Section 58: "Do not simply place a translucent PIN modal
   over the dashboard").

   Branches on sessionType: PIN pad for OPERATOR_PIN, password (+MFA if
   applicable) for MASTER_ACCOUNT — "there is no Master PIN" (master spec
   Section 61), so unlocking a Master session re-runs real credential
   verification, never a cached comparison.
   ===================================================================== */
(function (global) {
  'use strict';
  const UI = global.CafeOpsUI;
  let pinPad = null;

  function render(root, params) {
    if (pinPad) { pinPad.destroy(); pinPad = null; }
    const p = params || {};
    const isMaster = p.session && p.session.sessionType === 'MASTER_ACCOUNT';

    root.innerHTML = `
      <div class="auth-card">
        ${UI.brandHeader({
          device: p.device ? { cafeName: p.device.cafeName, deviceName: p.device.deviceName } : null,
          title: isMaster ? 'Master Session Locked' : 'Session Locked',
        })}
        <div style="text-align:center;margin-bottom:20px">
          <div style="font-family:var(--font-display);font-weight:650;color:var(--ink-900);font-size:1.02rem">${UI.escapeHtml(p.operatorName || 'Current Operator')}</div>
          ${p.employeeCode ? `<div style="font-family:var(--font-mono);font-size:.78rem;color:var(--muted);margin-top:2px">${UI.escapeHtml(p.employeeCode)}</div>` : ''}
        </div>
        <p class="cafeops-mfa-hint">${isMaster ? 'Enter your password to continue.' : 'Enter your Operator PIN to continue.'}</p>
        <div id="unlockFormHost"></div>
        <div id="errorSlot"></div>
        <button type="button" class="auth-btn-primary" id="unlockBtn" ${isMaster ? '' : 'disabled'}>
          <span class="auth-btn-label">Unlock</span>
          <span class="auth-spinner" aria-hidden="true"></span>
        </button>
        <div class="cafeops-textlinks" style="margin-top:14px">
          <button type="button" class="cafeops-textlink" id="switchLink">Switch Operator</button>
          <button type="button" class="cafeops-textlink cafeops-textlink--muted" id="backToKioskLink">Back to Attendance</button>
        </div>
      </div>`;

    const unlockBtn = root.querySelector('#unlockBtn');
    const errorSlot = root.querySelector('#errorSlot');
    const formHost = root.querySelector('#unlockFormHost');

    let getCredential;
    if (isMaster) {
      formHost.innerHTML = `
        <div class="auth-field">
          <div class="auth-password">
            <input id="unlockPassword" type="password" autocomplete="current-password" placeholder="Password" />
            <button type="button" class="auth-show-toggle" id="togglePw" aria-pressed="false">Show</button>
          </div>
        </div>
        <div class="auth-field">
          <input id="unlockMfa" class="auth-input" type="text" inputmode="numeric" placeholder="Verification code (if applicable)" />
        </div>`;
      const pwInput = formHost.querySelector('#unlockPassword');
      const mfaInput = formHost.querySelector('#unlockMfa');
      formHost.querySelector('#togglePw').addEventListener('click', () => {
        const showing = pwInput.type === 'text';
        pwInput.type = showing ? 'password' : 'text';
        formHost.querySelector('#togglePw').textContent = showing ? 'Show' : 'Hide';
      });
      pwInput.addEventListener('input', () => { unlockBtn.disabled = !pwInput.value; });
      getCredential = () => ({ password: pwInput.value, mfaCode: mfaInput.value || undefined });
    } else {
      pinPad = UI.mountPinPad(formHost, {
        onChange: (value, complete) => { unlockBtn.disabled = !complete; },
      });
      getCredential = () => ({ pin: pinPad.getValue() });
    }

    function setLoading(isLoading) {
      unlockBtn.disabled = isLoading;
      unlockBtn.querySelector('.auth-btn-label').textContent = isLoading ? 'Verifying…' : 'Unlock';
      if (pinPad) pinPad.setDisabled(isLoading);
    }

    unlockBtn.addEventListener('click', async () => {
      errorSlot.innerHTML = '';
      setLoading(true);
      try {
        const cred = getCredential();
        if (isMaster) await global.CafeOpsApi.unlockWithMaster(cred.password, cred.mfaCode);
        else await global.CafeOpsApi.unlockWithPin(cred.pin);
        global.CafeOpsApp.navigate('shell');
      } catch (err) {
        setLoading(false);
        if (pinPad) pinPad.shake();
        UI.showErrorPopup({
          title: isMaster ? 'Master Access Unavailable' : 'Unable to Sign In',
          message: err.message || 'That did not match. Please try again.',
        });
      }
    });

    root.querySelector('#switchLink').addEventListener('click', () => endAndGo('OPERATOR_SIGN_IN', p));
    root.querySelector('#backToKioskLink').addEventListener('click', () => endAndGo('ATTENDANCE_KIOSK', p));
  }

  async function endAndGo(target, p) {
    try { await global.CafeOpsApi.endSession(undefined, target === 'OPERATOR_SIGN_IN'); } catch (e) { /* proceed regardless — session likely already invalid */ }
    global.CafeOpsTokens.clearSessionToken();
    global.CafeOpsApp.clearIdentity();
    global.CafeOpsApp.navigate(target === 'OPERATOR_SIGN_IN' ? 'operatorSignIn' : 'kiosk', { device: p.device });
  }

  global.CafeOpsScreens = global.CafeOpsScreens || {};
  global.CafeOpsScreens.sessionLocked = { render };
})(window);
