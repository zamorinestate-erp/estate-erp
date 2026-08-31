/* =====================================================================
   js/components/brandHeader.js
   ---------------------------------------------------------------------
   Shared brand block for every Cafe Operations screen. Logo only (no
   separate "Zamorin" text heading — the logo bakes the wordmark in),
   optionally followed by the cafe/device identity strip, then a screen
   title + subtitle. Reused by the Kiosk, Sign-In, Master Sign-In, Locked,
   Register Device, and every generic status screen.
   ===================================================================== */
(function (global) {
  'use strict';

  function escapeHtml(str) {
    const d = document.createElement('div');
    d.textContent = str == null ? '' : String(str);
    return d.innerHTML;
  }

  /**
   * @param {Object} opts
   * @param {string} [opts.title] - e.g. "Cafe Operations", "Operator Sign-In"
   * @param {string} [opts.subtitle]
   * @param {{cafeName:string, deviceName:string}} [opts.device] - identity strip; omitted on Register Device (device has no identity yet)
   * @param {boolean} [opts.compact] - smaller logo, tighter spacing (used inside already-authenticated shell screens)
   */
  function brandHeader(opts) {
    opts = opts || {};
    const logoSize = opts.compact ? 'style="width:88px"' : '';
    return `
      <div class="auth-brand">
        <img class="cafeops-logo" ${logoSize} src="assets/zamorin-logo-stacked.svg" alt="Zamorin" />
        ${opts.device ? `
          <div class="cafeops-device-strip">
            <span class="cafeops-cafe-name">${escapeHtml(opts.device.cafeName)}</span>
            <span class="cafeops-device-name">${escapeHtml(opts.device.deviceName)}</span>
          </div>` : ''}
        ${opts.title ? `<h2 class="auth-title">${escapeHtml(opts.title)}</h2>` : ''}
        ${opts.subtitle ? `<p class="auth-subtitle">${escapeHtml(opts.subtitle)}</p>` : ''}
      </div>`;
  }

  global.CafeOpsUI = global.CafeOpsUI || {};
  global.CafeOpsUI.brandHeader = brandHeader;
  global.CafeOpsUI.escapeHtml = escapeHtml;
})(window);
