/* =====================================================================
   js/components/pinPad.js
   ---------------------------------------------------------------------
   Reusable 6-digit masked PIN entry: dot indicators + a touch keypad
   (1-9, Clear, 0, Backspace). Deliberately does NOT auto-submit on the
   sixth digit (login spec Section 46) — it only tracks the buffer and
   reports state changes; the screen that mounts this decides what
   "Sign In" / "Unlock" does with a complete PIN.

   Used by: operatorSignIn.js, sessionLocked.js (PIN variant), and any
   future "Confirm Operator" step.
   ===================================================================== */
(function (global) {
  'use strict';

  const PIN_LENGTH = 6;

  function dotsHtml(length) {
    let html = '';
    for (let i = 0; i < length; i++) html += '<span class="cafeops-pin-dot" data-dot-index="' + i + '"></span>';
    return html;
  }

  const KEYS = [
    ['1', '2', '3'],
    ['4', '5', '6'],
    ['7', '8', '9'],
    ['clear', '0', 'back'],
  ];

  function backspaceIcon() {
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 4H8l-7 8 7 8h13a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2z"/><line x1="18" y1="9" x2="12" y2="15"/><line x1="12" y1="9" x2="18" y2="15"/></svg>';
  }

  function keypadHtml() {
    return `
      <div class="cafeops-keypad" role="group" aria-label="PIN keypad">
        ${KEYS.map((row) => row.map((key) => {
          if (key === 'clear') return `<button type="button" class="cafeops-key cafeops-key--sub" data-key="clear" aria-label="Clear">Clear</button>`;
          if (key === 'back') return `<button type="button" class="cafeops-key cafeops-key--sub cafeops-key--backspace" data-key="back" aria-label="Backspace">${backspaceIcon()}</button>`;
          return `<button type="button" class="cafeops-key" data-key="${key}" aria-label="${key}">${key}</button>`;
        }).join('')).join('')}
      </div>`;
  }

  /**
   * @param {HTMLElement} container - where to render dots + keypad (two children appended)
   * @param {Object} opts
   * @param {(value:string, complete:boolean)=>void} [opts.onChange]
   * @param {()=>void} [opts.onCompleteKeypress] - fired the instant the 6th digit is entered (for UI hints only, NOT for auto-submit)
   * @returns {{getValue():string, reset():void, shake():void, setDisabled(b:boolean):void, destroy():void}}
   */
  function mountPinPad(container, opts) {
    opts = opts || {};
    let value = '';
    let disabled = false;

    const dotsEl = document.createElement('div');
    dotsEl.className = 'cafeops-pin-dots';
    dotsEl.innerHTML = dotsHtml(PIN_LENGTH);

    const keypadEl = document.createElement('div');
    keypadEl.innerHTML = keypadHtml();
    const keypadRoot = keypadEl.firstElementChild;

    container.appendChild(dotsEl);
    container.appendChild(keypadRoot);

    function render() {
      const dots = dotsEl.querySelectorAll('.cafeops-pin-dot');
      dots.forEach((dot, i) => dot.classList.toggle('cafeops-pin-dot--filled', i < value.length));
    }

    function setValue(next) {
      value = next.slice(0, PIN_LENGTH);
      render();
      if (typeof opts.onChange === 'function') opts.onChange(value, value.length === PIN_LENGTH);
      if (value.length === PIN_LENGTH && typeof opts.onCompleteKeypress === 'function') opts.onCompleteKeypress();
    }

    function press(key) {
      if (disabled) return;
      if (key === 'clear') return setValue('');
      if (key === 'back') return setValue(value.slice(0, -1));
      if (value.length < PIN_LENGTH) setValue(value + key);
    }

    // Guard against double-tap/double-submit firing two presses for one
    // touch (login spec Section 43: "no accidental double submission").
    let lastPressAt = 0;
    function onKeyClick(e) {
      const btn = e.target.closest('[data-key]');
      if (!btn) return;
      const now = Date.now();
      if (now - lastPressAt < 60) return;
      lastPressAt = now;
      press(btn.dataset.key);
    }
    keypadRoot.addEventListener('click', onKeyClick);

    // Physical keyboard support (desktop preview / accessibility).
    function onKeydown(e) {
      if (disabled) return;
      if (/^[0-9]$/.test(e.key)) press(e.key);
      else if (e.key === 'Backspace') press('back');
      else if (e.key === 'Escape') press('clear');
    }
    document.addEventListener('keydown', onKeydown);

    return {
      getValue: () => value,
      reset: () => setValue(''),
      shake: () => {
        dotsEl.classList.add('cafeops-pin-dots--invalid');
        dotsEl.addEventListener('animationend', () => dotsEl.classList.remove('cafeops-pin-dots--invalid'), { once: true });
        setValue('');
      },
      setDisabled: (b) => {
        disabled = b;
        keypadRoot.querySelectorAll('.cafeops-key').forEach((k) => { k.disabled = b; });
      },
      destroy: () => document.removeEventListener('keydown', onKeydown),
    };
  }

  global.CafeOpsUI = global.CafeOpsUI || {};
  global.CafeOpsUI.mountPinPad = mountPinPad;
  global.CafeOpsUI.PIN_LENGTH = PIN_LENGTH;
})(window);
