/* =====================================================================
   js/screens/welcome.js
   ---------------------------------------------------------------------
   Brief identity confirmation after successful authentication (login
   spec Section 53) — prevents continuing under the wrong Operator by
   showing exactly who just signed in before entering Cafe Operations.
   Auto-advances after a short pause; no action required.
   ===================================================================== */
(function (global) {
  'use strict';
  const UI = global.CafeOpsUI;

  function render(root, params) {
    const p = params || {};
    UI.renderStatusScreen(root, {
      tone: 'success',
      title: p.name ? `Welcome, ${p.name}` : 'Master Access Confirmed',
      message: [
        p.employeeCode ? p.employeeCode : null,
        p.cafeName || null,
      ].filter(Boolean).join(' · ') || 'Opening Cafe Operations…',
      actions: [],
    });
    if (p.badge) {
      const card = root.querySelector('.auth-card');
      const badge = document.createElement('div');
      badge.style.textAlign = 'center';
      badge.style.marginTop = '-10px';
      badge.style.marginBottom = '18px';
      badge.innerHTML = `<span class="cafeops-master-badge"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2 4 6v6c0 5 3.4 9.4 8 10 4.6-.6 8-5 8-10V6l-8-4Z"/></svg>${p.badge.replace('MASTER_', '')}</span>`;
      card.insertBefore(badge, card.querySelector('.cafeops-status-actions'));
    }
    const msgEl = root.querySelector('.cafeops-status-message');
    if (msgEl) { msgEl.textContent = ''; msgEl.innerHTML = 'Opening Cafe Operations…'; }

    setTimeout(() => global.CafeOpsApp.navigate('shell'), 900);
  }

  global.CafeOpsScreens = global.CafeOpsScreens || {};
  global.CafeOpsScreens.welcome = { render };
})(window);
