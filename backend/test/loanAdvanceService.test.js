'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

const {
  calculateLoanAdvanceInstalmentApplication,
} = require('../src/services/loanAdvanceService');

test('loan instalment application is capped by scheduled amount', () => {
  const result = calculateLoanAdvanceInstalmentApplication({
    availablePaiseForDeduction: 10000,
    scheduledInstalmentPaise: 3000,
    outstandingPaise: 8000,
  });

  assert.deepEqual(result, {
    scheduledInstalmentPaise: 3000,
    appliedPaise: 3000,
    shortfallPaise: 0,
    newOutstandingPaise: 5000,
  });
});

test('loan instalment application is capped by outstanding balance', () => {
  const result = calculateLoanAdvanceInstalmentApplication({
    availablePaiseForDeduction: 10000,
    scheduledInstalmentPaise: 3000,
    outstandingPaise: 1200,
  });

  assert.equal(result.appliedPaise, 1200);
  assert.equal(result.shortfallPaise, 1800);
  assert.equal(result.newOutstandingPaise, 0);
});

test('loan instalment application protects salary and reports shortfall', () => {
  const result = calculateLoanAdvanceInstalmentApplication({
    availablePaiseForDeduction: 700,
    scheduledInstalmentPaise: 3000,
    outstandingPaise: 8000,
  });

  assert.equal(result.appliedPaise, 700);
  assert.equal(result.shortfallPaise, 2300);
  assert.equal(result.newOutstandingPaise, 7300);
});

test('loan instalment application accepts zero available salary without negative pay', () => {
  const result = calculateLoanAdvanceInstalmentApplication({
    availablePaiseForDeduction: 0,
    scheduledInstalmentPaise: 3000,
    outstandingPaise: 8000,
  });

  assert.equal(result.appliedPaise, 0);
  assert.equal(result.shortfallPaise, 3000);
  assert.equal(result.newOutstandingPaise, 8000);
});

test('loan instalment application rejects unsafe or negative paise values', () => {
  for (const input of [
    {
      availablePaiseForDeduction: -1,
      scheduledInstalmentPaise: 3000,
      outstandingPaise: 8000,
    },
    {
      availablePaiseForDeduction: 10000,
      scheduledInstalmentPaise: 1.5,
      outstandingPaise: 8000,
    },
    {
      availablePaiseForDeduction: 10000,
      scheduledInstalmentPaise: 3000,
      outstandingPaise: Number.MAX_SAFE_INTEGER + 1,
    },
  ]) {
    assert.throws(
      () => calculateLoanAdvanceInstalmentApplication(input),
      (error) =>
        error instanceof TypeError &&
        error.code === 'INVALID_LOAN_ADVANCE_AMOUNT'
    );
  }
});
