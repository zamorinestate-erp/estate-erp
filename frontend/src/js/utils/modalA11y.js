// =============================================================================
// ZAMORIN CAFE ERP — ACCESSIBLE MODAL FOCUS & KEYBOARD TRAPPING HELPER
//
// Ensures WAI-ARIA compliance across all self-service modal dialogs:
// - role="dialog" & aria-modal="true"
// - Escape key dismissal
// - Tab & Shift+Tab focus trap
// - Restores focus to trigger button upon close
// =============================================================================

export function setupModalA11y(modalEl, options = {}) {
  if (!modalEl || typeof document === 'undefined') return () => {};

  const {
    onClose,
    titleId = null,
    initialFocusEl = null,
    triggerEl = null,
  } = options;

  const previouslyFocused = triggerEl || document.activeElement;

  modalEl.setAttribute('role', 'dialog');
  modalEl.setAttribute('aria-modal', 'true');
  if (titleId) {
    modalEl.setAttribute('aria-labelledby', titleId);
  }

  const focusableSelector =
    'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

  const getFocusableElements = () => {
    return Array.from(modalEl.querySelectorAll(focusableSelector)).filter(
      (el) => el.offsetParent !== null || el.offsetWidth > 0 || el.offsetHeight > 0
    );
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Escape' || e.key === 'Esc') {
      e.preventDefault();
      e.stopPropagation();
      cleanup();
      if (onClose) onClose();
      return;
    }

    if (e.key === 'Tab') {
      const focusables = getFocusableElements();
      if (focusables.length === 0) {
        e.preventDefault();
        return;
      }
      const first = focusables[0];
      const last = focusables[focusables.length - 1];

      if (e.shiftKey) {
        if (document.activeElement === first || !modalEl.contains(document.activeElement)) {
          e.preventDefault();
          last.focus();
        }
      } else {
        if (document.activeElement === last || !modalEl.contains(document.activeElement)) {
          e.preventDefault();
          first.focus();
        }
      }
    }
  };

  document.addEventListener('keydown', handleKeyDown);

  // Set initial focus
  setTimeout(() => {
    if (initialFocusEl && typeof initialFocusEl.focus === 'function') {
      initialFocusEl.focus();
    } else {
      const focusables = getFocusableElements();
      if (focusables.length > 0) {
        focusables[0].focus();
      } else {
        modalEl.setAttribute('tabindex', '-1');
        modalEl.focus();
      }
    }
  }, 40);

  let cleanedUp = false;
  const cleanup = () => {
    if (cleanedUp) return;
    cleanedUp = true;
    document.removeEventListener('keydown', handleKeyDown);
    if (previouslyFocused && typeof previouslyFocused.focus === 'function') {
      try {
        previouslyFocused.focus();
      } catch {}
    }
  };

  return cleanup;
}
