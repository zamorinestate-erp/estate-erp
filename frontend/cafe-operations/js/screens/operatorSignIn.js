/* =====================================================================
   js/screens/operatorSignIn.js
   ---------------------------------------------------------------------
   The sign-in hub. PIN entry is primary (CAFE_ADMIN Operators); "Sign in
   with Master Account" is present but visually secondary (master spec
   Section 10-11) — routine Operators should never have to look at it.
   No employee list, no auto-submit on the 6th digit (login spec
   Section 46-47).
   ===================================================================== */
(function (global) {
  'use strict';
  const UI = global.CafeOpsUI;
  let pinPad = null;

  function render(root, params) {
    if (pinPad) { pinPad.destroy(); pinPad = null; }
    const device = (params && params.device) || {};

    root.innerHTML = `
      <div class="auth-card">
        ${UI.brandHeader({
          device: { cafeName: device.cafeName || 'Cafe', deviceName: device.deviceName || 'Cafe Operations Device' },
          title: 'Operator Sign-In',
          subtitle: 'Enter your 6-digit Operator PIN to access Cafe Operations.',
        })}
        <div id="pinPadHost"></div>
        <div id="errorSlot"></div>
        <button type="button" class="auth-btn-primary" id="signInBtn" disabled>
          <span class="auth-btn-label">Sign In</span>
          <span class="auth-spinner" aria-hidden="true"></span>
        </button>

        <div class="cafeops-divider">or</div>
        <div class="cafeops-textlinks" style="margin-bottom:8px">
          <button type="button" class="cafeops-textlink" id="masterSignInLink">Sign in with Master Account</button>
        </div>

        <div class="cafeops-textlinks">
          <button type="button" class="cafeops-textlink cafeops-textlink--muted" id="forgotPinLink">Forgot Operator PIN?</button>
          <button type="button" class="cafeops-textlink cafeops-textlink--muted" id="deviceHelpLink">Help &amp; Device Status</button>
          <button type="button" class="cafeops-textlink cafeops-textlink--muted" id="backToKioskLink">Back to Attendance</button>
        </div>

        <div class="cafeops-connection" id="connectionIndicator">
          <span class="cafeops-connection-dot"></span><span>Online</span>
        </div>
      </div>`;

    const signInBtn = root.querySelector('#signInBtn');
    const errorSlot = root.querySelector('#errorSlot');

    pinPad = UI.mountPinPad(root.querySelector('#pinPadHost'), {
      onChange: (value, complete) => { signInBtn.disabled = !complete; },
    });

    function setLoading(isLoading) {
      signInBtn.disabled = isLoading || pinPad.getValue().length < UI.PIN_LENGTH;
      signInBtn.dataset.loading = String(isLoading);
      signInBtn.querySelector('.auth-btn-label').textContent = isLoading ? 'Verifying…' : 'Sign In';
      pinPad.setDisabled(isLoading);
    }

    async function submit() {
      const pin = pinPad.getValue();
      if (pin.length !== UI.PIN_LENGTH) return;
      errorSlot.innerHTML = '';
      setLoading(true);
      try {
        const data = await global.CafeOpsApi.operatorSignIn(pin);
        global.CafeOpsTokens.setSessionToken(data.sessionToken);
        global.CafeOpsApp.setIdentity({
          name: data.operator.name, employeeCode: data.operator.employeeCode,
          sessionType: 'OPERATOR_PIN', badge: null,
          device: { cafeId: data.operator.cafeId, cafeName: data.operator.cafeName || device.cafeName, deviceName: device.deviceName },
        });
        global.CafeOpsApp.navigate('welcome', {
          name: data.operator.name, employeeCode: data.operator.employeeCode,
          cafeName: data.operator.cafeName || device.cafeName, badge: null,
        });
      } catch (err) {
        setLoading(false);
        pinPad.shake();
        if (err.status === 429) {
          global.CafeOpsApp.navigate('status', {
            tone: 'warning', title: 'Sign-In Temporarily Unavailable',
            message: 'Too many unsuccessful attempts were detected. Please try again later or contact an authorised administrator.',
            supportReference: err.supportReference,
            actions: [
              { label: 'Back to Attendance', onClick: () => global.CafeOpsApp.navigate('kiosk', { device }) },
              { label: 'Device Help', kind: 'secondary', onClick: () => global.CafeOpsApp.navigate('deviceStatus', { device }) },
            ],
          });
          return;
        }
        UI.showErrorPopup({
          title: 'Unable to Sign In',
          message: err.message || 'This Operator cannot access Cafe Operations on this device. Check the Operator PIN or contact an authorised administrator.',
          supportReference: err.supportReference,
        });
      }
    }

    signInBtn.addEventListener('click', submit);

    root.querySelector('#masterSignInLink').addEventListener('click', () => global.CafeOpsApp.navigate('masterSignIn', { device }));
    root.querySelector('#deviceHelpLink').addEventListener('click', () => global.CafeOpsApp.navigate('deviceStatus', { device }));
    root.querySelector('#backToKioskLink').addEventListener('click', () => global.CafeOpsApp.navigate('kiosk', { device }));
    root.querySelector('#forgotPinLink').addEventListener('click', () => {
      UI.showErrorPopup({
        tone: 'info',
        title: 'Operator PIN Help',
        message: 'Operator PINs cannot be recovered from this shared device. Reset your Operator PIN through your authorised Zamorin account, or contact an authorised administrator.',
        buttonLabel: 'Back',
      });
    });

    global.CafeOpsApi.deviceStatus().catch(() => setConnection(root, false));
  }

  function setConnection(root, online) {
    const el = root.querySelector('#connectionIndicator');
    if (!el) return;
    el.classList.toggle('cafeops-connection--offline', !online);
    el.querySelector('span:last-child').textContent = online ? 'Online' : "You're Offline";
  }

  global.CafeOpsScreens = global.CafeOpsScreens || {};
  global.CafeOpsScreens.operatorSignIn = { render };
})(window);
