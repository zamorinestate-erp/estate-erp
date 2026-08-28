/* =====================================================================
   js/components/statusShell.js
   ---------------------------------------------------------------------
   Two things:

   1. renderStatusScreen() — ONE shared shell for every full-screen
      terminal state (login spec Section 35's ZamorinAuthShell concept):
      Registration Unavailable, Device Deactivated/Lost/Retired/Replaced,
      Session Expired, Backend Unavailable, Maintenance, Update Required,
      Offline. Driven entirely by a config object + a tone, rather than
      one file per state — the spec explicitly asks for a shared shell
      here, and a dozen near-identical files would be worse, not more
      thorough.

   2. showErrorPopup()/closeErrorPopup()/inlineError() — copies the real
      login page's exact modal + inline-banner pattern (same classes,
      same behaviour: Escape closes it, click-outside closes it, focus
      moves to the close button) so a wrong PIN or wrong Master password
      feels identical to a wrong personal-login password, not like a
      different product bolted on.
   ===================================================================== */
(function (global) {
  'use strict';

  const escapeHtml = global.CafeOpsUI && global.CafeOpsUI.escapeHtml
    ? global.CafeOpsUI.escapeHtml
    : function (str) { const d = document.createElement('div'); d.textContent = str == null ? '' : String(str); return d.innerHTML; };

  const ICONS = {
    info: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><line x1="12" y1="8" x2="12" y2="13"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>',
    danger: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><line x1="12" y1="8" x2="12" y2="13"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>',
    warning: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M12 9v4M12 17h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z"/></svg>',
    success: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>',
    muted: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 1l22 22M16.7 16.7A10 10 0 0 1 3.3 7.3M9 9a3 3 0 0 1 4.2 4.2"/><path d="M8.5 3.5A10 10 0 0 1 20.5 15.5"/></svg>',
  };

  /**
   * @param {HTMLElement} root
   * @param {Object} cfg
   * @param {'info'|'danger'|'warning'|'success'|'muted'} [cfg.tone='info']
   * @param {string} cfg.title
   * @param {string} cfg.message
   * @param {{cafeName:string, deviceName:string}} [cfg.device]
   * @param {Array<{label:string, onClick:Function, kind?:'primary'|'secondary'|'text'}>} cfg.actions
   * @param {string} [cfg.supportReference]
   */
  function renderStatusScreen(root, cfg) {
    const tone = cfg.tone || 'info';
    const brandHeader = global.CafeOpsUI.brandHeader({ device: cfg.device });

    root.innerHTML = `
      <div class="auth-card">
        ${brandHeader}
        <div class="cafeops-status-icon cafeops-status-icon--${tone}">${ICONS[tone] || ICONS.info}</div>
        <h2 class="cafeops-status-title">${escapeHtml(cfg.title)}</h2>
        <p class="cafeops-status-message">${escapeHtml(cfg.message)}</p>
        <div class="cafeops-status-actions" id="statusActions"></div>
        ${cfg.supportReference ? `<p class="cafeops-support-ref">Reference: <code>${escapeHtml(cfg.supportReference)}</code></p>` : ''}
      </div>`;

    const actionsEl = root.querySelector('#statusActions');
    (cfg.actions || []).forEach((action) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = action.kind === 'secondary' ? 'auth-btn-secondary'
        : action.kind === 'text' ? 'cafeops-textlink cafeops-textlink--muted'
        : 'auth-btn-primary';
      btn.innerHTML = `<span class="auth-btn-label">${escapeHtml(action.label)}</span>`;
      btn.addEventListener('click', action.onClick);
      actionsEl.appendChild(btn);
    });
  }

  // -------------------------------------------------------------------
  // Modal popup — identical markup/behaviour to the real login page's
  // showAuthPopup(), just exported so every Cafe Operations screen can
  // share one implementation instead of six copies of it.
  // -------------------------------------------------------------------
  function closeErrorPopup() {
    const existing = document.getElementById('cafeOpsPopupOverlay');
    if (existing) {
      if (existing._onKeydown) document.removeEventListener('keydown', existing._onKeydown);
      existing.remove();
    }
  }

  function showErrorPopup(opts) {
    closeErrorPopup();
    const overlay = document.createElement('div');
    overlay.className = 'auth-modal-overlay';
    overlay.id = 'cafeOpsPopupOverlay';
    overlay.innerHTML = `
      <div class="auth-modal" role="alertdialog" aria-modal="true" aria-labelledby="cafeOpsPopupTitle">
        <div class="auth-modal-icon">${ICONS[opts.tone || 'danger']}</div>
        <h3 id="cafeOpsPopupTitle">${escapeHtml(opts.title)}</h3>
        <p>${escapeHtml(opts.message)}</p>
        ${opts.supportReference ? `<p class="cafeops-support-ref" style="margin-top:14px">Reference: <code>${escapeHtml(opts.supportReference)}</code></p>` : ''}
        <button type="button" class="auth-modal-btn" id="cafeOpsPopupClose">${escapeHtml(opts.buttonLabel || 'Got it')}</button>
      </div>`;
    document.body.appendChild(overlay);
    overlay.querySelector('#cafeOpsPopupClose').focus();
    overlay.addEventListener('click', (e) => { if (e.target === overlay) closeErrorPopup(); });
    overlay.querySelector('#cafeOpsPopupClose').addEventListener('click', () => {
      closeErrorPopup();
      if (typeof opts.onClose === 'function') opts.onClose();
    });
    function onKeydown(e) { if (e.key === 'Escape') closeErrorPopup(); }
    document.addEventListener('keydown', onKeydown);
    overlay._onKeydown = onKeydown;
  }

  function inlineError(message) {
    return message ? `<p class="auth-error" role="alert">${escapeHtml(message)}</p>` : '';
  }

  global.CafeOpsUI = global.CafeOpsUI || {};
  global.CafeOpsUI.renderStatusScreen = renderStatusScreen;
  global.CafeOpsUI.showErrorPopup = showErrorPopup;
  global.CafeOpsUI.closeErrorPopup = closeErrorPopup;
  global.CafeOpsUI.inlineError = inlineError;
})(window);
