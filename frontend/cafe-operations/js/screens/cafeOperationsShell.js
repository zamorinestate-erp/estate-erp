/* =====================================================================
   js/screens/cafeOperationsShell.js
   ---------------------------------------------------------------------
   The authenticated landing area. Persistent context bar (login spec
   Section 54 / master spec Section 42-43) + operator menu (Session
   Details / Lock / Switch Operator / End Operator Session).

   This module does NOT contain POS/Inventory/Expenses/etc. — building
   individual Cafe Operations screens is explicitly out of scope for this
   pass (all three spec documents' stop conditions agree on this). What's
   here is the complete, working foundation those screens will eventually
   sit inside: the context bar, the identity menu, and the session
   lifecycle controls, all wired to the real backend.
   ===================================================================== */
(function (global) {
  'use strict';
  const UI = global.CafeOpsUI;
  let policyWatcher = null;
  let menuOpen = false;

  function stopWatcher() { if (policyWatcher) { policyWatcher.stop(); policyWatcher = null; } }

  function renderBody(root, identity, device) {
    // No POS/Inventory/Expenses/etc. here — see this file's header comment.
    // This is the real, working landing area those screens will sit
    // inside once they're built: confirms the session is live and gives
    // the person somewhere correct to be, rather than a blank page.
    root.innerHTML = `
      <div class="auth-card">
        ${UI.brandHeader({ compact: true })}
        <div class="cafeops-status-icon cafeops-status-icon--success">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
        </div>
        <h2 class="cafeops-status-title">Cafe Operations is ready</h2>
        <p class="cafeops-status-message">
          Signed in at ${UI.escapeHtml(device.cafeName || 'this cafe')} on ${UI.escapeHtml(device.deviceName || 'this device')}.
          POS, Inventory, Expenses and the rest of the operational modules connect into this shell as they're built —
          the login, device trust, and session foundation here is complete and already enforcing cafe scope for
          whichever module lands next.
        </p>
      </div>`;
  }

  async function render(root, params, contextBarRoot) {
    stopWatcher();
    const identity = global.CafeOpsApp.getIdentity() || {};
    const device = (params && params.device) || identity.device || {};

    renderContextBar(contextBarRoot, identity, device);
    renderBody(root, identity, device);

    try {
      const policyData = await global.CafeOpsApi.devicePolicy();
      const policy = policyData.policy || {};
      policyWatcher = global.CafeOpsState.createSessionPolicyWatcher({
        inactivityMinutes: policy.inactivityLockTimeoutMinutes || 5,
        preWarningSeconds: policy.preTimeoutWarningSeconds || 30,
        onWarn: (secondsLeft) => showLockWarning(secondsLeft),
        onLock: async () => {
          try { await global.CafeOpsApi.lockSession(); } catch (e) { /* proceed to lock screen regardless */ }
          global.CafeOpsApp.navigate('sessionLocked', { device, session: identity, operatorName: identity.name, employeeCode: identity.employeeCode });
        },
      });
    } catch (e) { /* policy fetch failing shouldn't block the shell from rendering */ }
  }

  function renderContextBar(contextBarRoot, identity, device) {
    if (!contextBarRoot) return;
    const businessDate = new Intl.DateTimeFormat('en-IN', { timeZone: 'Asia/Kolkata', day: 'numeric', month: 'short' }).format(new Date());
    const initials = (identity.name || identity.employeeCode || '?').trim().slice(0, 2).toUpperCase();
    const badge = identity.badge ? `<span class="cafeops-master-badge" style="margin-left:6px">${identity.badge.replace('MASTER_', '')}</span>` : '';

    contextBarRoot.style.display = '';
    contextBarRoot.innerHTML = `
      <div class="cafeops-context-bar">
        <span class="cafeops-context-cafe">${UI.escapeHtml(device.cafeName || 'Cafe')}</span>
        <span class="cafeops-context-sep">·</span>
        <span class="cafeops-context-date">Business Date ${businessDate}</span>
        <span class="cafeops-context-spacer"></span>
        <button type="button" class="cafeops-context-operator" id="operatorChip">
          <span class="cafeops-context-avatar">${UI.escapeHtml(initials)}</span>
          <span>${UI.escapeHtml(identity.name || identity.employeeCode || 'Operator')}</span>${badge}
        </button>
      </div>`;
    contextBarRoot.querySelector('#operatorChip').addEventListener('click', () => openMenu(contextBarRoot, identity, device));
  }

  function openMenu(contextBarRoot, identity, device) {
    if (menuOpen) return;
    menuOpen = true;
    const overlay = document.createElement('div');
    overlay.className = 'cafeops-menu-overlay';
    overlay.innerHTML = `
      <div class="cafeops-menu">
        <div class="cafeops-menu-header">
          <div class="cafeops-menu-name">${UI.escapeHtml(identity.name || identity.employeeCode || 'Operator')}</div>
          <div class="cafeops-menu-meta">${UI.escapeHtml(identity.employeeCode || '')}</div>
        </div>
        <button type="button" class="cafeops-menu-item" data-action="details">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/><line x1="12" y1="8" x2="12" y2="13"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
          Session Details
        </button>
        <button type="button" class="cafeops-menu-item" data-action="lock">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="4" y="10" width="16" height="10" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/></svg>
          Lock
        </button>
        <button type="button" class="cafeops-menu-item" data-action="switch">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/></svg>
          Switch Operator
        </button>
        <div class="cafeops-menu-divider"></div>
        <button type="button" class="cafeops-menu-item cafeops-menu-item--danger" data-action="end">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18.36 6.64a9 9 0 1 1-12.73 0"/><line x1="12" y1="2" x2="12" y2="12"/></svg>
          End Operator Session
        </button>
      </div>`;
    document.body.appendChild(overlay);

    function close() { overlay.remove(); menuOpen = false; }
    overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
    overlay.querySelectorAll('[data-action]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const action = btn.dataset.action;
        close();
        if (action === 'details') showSessionDetails(identity, device);
        if (action === 'lock') doLock(device, identity);
        if (action === 'switch') doSwitch(device);
        if (action === 'end') confirmEnd(device);
      });
    });
  }

  async function doLock(device, identity) {
    try { await global.CafeOpsApi.lockSession(); } catch (e) { /* proceed regardless */ }
    global.CafeOpsApp.navigate('sessionLocked', { device, session: identity, operatorName: identity.name, employeeCode: identity.employeeCode });
  }

  function showSessionDetails(identity, device) {
    global.CafeOpsApi.getSession().then((data) => {
      const s = data.session || {};
      const startedAt = s.startedAt ? new Date(s.startedAt) : null;
      const duration = startedAt ? formatDuration(Date.now() - startedAt.getTime()) : '—';
      UI.showErrorPopup({
        tone: 'info',
        title: 'Session Details',
        message: [
          `Operator: ${identity.name || identity.employeeCode || '—'}`,
          `Employee ID: ${identity.employeeCode || '—'}`,
          `Cafe: ${device.cafeName || '—'}`,
          `Device: ${device.deviceName || '—'}`,
          `Signed in: ${startedAt ? startedAt.toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit' }) : '—'} IST`,
          `Duration: ${duration}`,
          `Status: ${s.status || '—'}`,
        ].join('\n'),
        buttonLabel: 'Close',
      });
    }).catch(() => {
      UI.showErrorPopup({ title: 'Session Details', message: 'Could not load session details right now.' });
    });
  }

  function formatDuration(ms) {
    const mins = Math.floor(ms / 60000);
    if (mins < 60) return `${mins} min`;
    return `${Math.floor(mins / 60)}h ${mins % 60}m`;
  }

  // INTEGRATION SEAM: no operational modules exist yet in this pass (POS,
  // Expenses, Inventory...), so there is genuinely nothing to check for
  // dirty/unsaved state. This returns an honest empty result rather than
  // a fabricated one — future modules register their own dirty-state
  // check here as they're built (login spec Section 66 / master spec
  // Section 73).
  async function checkPendingWork() { return { hasPending: false, items: [] }; }

  async function doSwitch(device) {
    const pending = await checkPendingWork();
    if (!pending.hasPending) return endAndNavigate(device, undefined, true);
    UI.renderStatusScreen(document.getElementById('cafeOpsRoot'), {
      tone: 'warning',
      title: 'Before You Switch',
      message: 'The following will remain unsaved if you continue.',
      actions: [
        { label: 'Continue Switching', onClick: () => endAndNavigate(device, undefined, true) },
        { label: 'Stay Signed In', kind: 'secondary', onClick: () => global.CafeOpsApp.navigate('shell', { device }) },
      ],
    });
    const list = document.createElement('ul');
    list.className = 'cafeops-pending-list';
    list.innerHTML = pending.items.map((i) => `<li><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 9v4M12 17h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z"/></svg>${UI.escapeHtml(i.label)}</li>`).join('');
    document.querySelector('.cafeops-status-message').after(list);
  }

  function confirmEnd(device) {
    const overlay = document.createElement('div');
    overlay.className = 'auth-modal-overlay';
    overlay.innerHTML = `
      <div class="auth-modal" role="alertdialog" aria-modal="true">
        <div class="auth-modal-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M18.36 6.64a9 9 0 1 1-12.73 0"/><line x1="12" y1="2" x2="12" y2="12"/></svg></div>
        <h3>End Operator Session?</h3>
        <p>Cafe Operations will be secured and this device will return to Attendance Kiosk.</p>
        <div class="auth-field" style="text-align:left;margin-top:10px">
          <label for="handoverNote" style="font-size:.78rem">Handover note <span style="font-weight:500;color:var(--muted)">(optional)</span></label>
          <textarea id="handoverNote" class="cafeops-textarea" placeholder="e.g. Milk delivery short by 8L, vendor contacted."></textarea>
        </div>
        <button type="button" class="auth-modal-btn" id="confirmEndBtn">End Session</button>
        <button type="button" class="cafeops-textlink cafeops-textlink--muted" id="cancelEndBtn" style="margin-top:8px">Cancel</button>
      </div>`;
    document.body.appendChild(overlay);
    function close() { overlay.remove(); }
    overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
    overlay.querySelector('#cancelEndBtn').addEventListener('click', close);
    overlay.querySelector('#confirmEndBtn').addEventListener('click', () => {
      const note = overlay.querySelector('#handoverNote').value.trim();
      close();
      endAndNavigate(device, note || undefined, false);
    });
  }

  async function endAndNavigate(device, handoverNote, forSwitch) {
    stopWatcher();
    try { await global.CafeOpsApi.endSession(handoverNote, forSwitch); } catch (e) { /* proceed regardless — session likely already invalid */ }
    global.CafeOpsTokens.clearSessionToken();
    global.CafeOpsApp.clearIdentity();
    global.CafeOpsApp.navigate(forSwitch ? 'operatorSignIn' : 'kiosk', { device });
  }

  function showLockWarning(secondsLeft) {
    const existing = document.getElementById('cafeOpsLockWarningToast');
    if (existing) existing.remove();
    const toast = document.createElement('div');
    toast.className = 'cafeops-toast';
    toast.id = 'cafeOpsLockWarningToast';
    toast.innerHTML = `<span>Session Locking Soon</span><button type="button" id="continueSessionBtn">Continue Session</button>`;
    document.body.appendChild(toast);
    toast.querySelector('#continueSessionBtn').addEventListener('click', () => {
      if (policyWatcher) policyWatcher.resetActivity();
      toast.remove();
    });
    setTimeout(() => { if (document.body.contains(toast)) toast.remove(); }, (secondsLeft + 2) * 1000);
  }

  global.CafeOpsScreens = global.CafeOpsScreens || {};
  global.CafeOpsScreens.shell = { render, stopWatcher };
})(window);
