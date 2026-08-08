'use strict';

function assertSafeNonNegativePaise(value, fieldName) {
  if (!Number.isSafeInteger(value) || value < 0) {
    const error = new TypeError(
      `${fieldName} must be a safe non-negative integer amount in paise.`
    );
    error.code = 'INVALID_LOAN_ADVANCE_AMOUNT';
    throw error;
  }

  return value;
}

function calculateLoanAdvanceInstalmentApplication({
  availablePaiseForDeduction,
  scheduledInstalmentPaise,
  outstandingPaise,
} = {}) {
  const available = assertSafeNonNegativePaise(
    availablePaiseForDeduction,
    'availablePaiseForDeduction'
  );
  const scheduled = assertSafeNonNegativePaise(
    scheduledInstalmentPaise,
    'scheduledInstalmentPaise'
  );
  const outstanding = assertSafeNonNegativePaise(
    outstandingPaise,
    'outstandingPaise'
  );

  const appliedPaise = Math.min(
    available,
    scheduled,
    outstanding
  );

  return {
    scheduledInstalmentPaise: scheduled,
    appliedPaise,
    shortfallPaise: scheduled - appliedPaise,
    newOutstandingPaise: outstanding - appliedPaise,
  };
}

module.exports = {
  calculateLoanAdvanceInstalmentApplication,
};
