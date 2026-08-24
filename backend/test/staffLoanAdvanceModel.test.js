'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

const {
  StaffLoanAdvance,
  LOAN_ADVANCE_TYPES,
  LOAN_ADVANCE_STATUSES,
} = require('../src/models/StaffLoanAdvance');

function createValidLoan(overrides = {}) {
  return new StaffLoanAdvance({
    loanAdvanceId: 'LN-0001',
    organisationId: 'ORG-001',
    cafeId: 'CF-0001',
    employeeUserId: 'ST-0001',
    requestType: 'LOAN',
    requestedAmountPaise: 500000,
    requestReason: 'Test request',
    createdByUserId: 'ST-0001',
    ...overrides,
  });
}

test('StaffLoanAdvance exposes the neutral request contract', async () => {
  assert.deepEqual(LOAN_ADVANCE_TYPES, ['LOAN', 'SALARY_ADVANCE']);
  assert.ok(LOAN_ADVANCE_STATUSES.includes('SUBMITTED'));
  assert.ok(LOAN_ADVANCE_STATUSES.includes('APPROVED'));
  assert.ok(LOAN_ADVANCE_STATUSES.includes('REJECTED'));

  const loan = createValidLoan();
  await loan.validate();

  assert.equal(loan.status, 'SUBMITTED');
  assert.equal(loan.currency, 'INR');
  assert.equal(loan.requestedAmountPaise, 500000);
});

test('StaffLoanAdvance accepts salary advance as a request type', async () => {
  const advance = createValidLoan({
    loanAdvanceId: 'LN-0002',
    requestType: 'SALARY_ADVANCE',
  });

  await advance.validate();
  assert.equal(advance.requestType, 'SALARY_ADVANCE');
});

test('StaffLoanAdvance rejects invalid IDs and request types', async () => {
  await assert.rejects(
    createValidLoan({ loanAdvanceId: 'BAD-0001' }).validate(),
    /loanAdvanceId/
  );

  await assert.rejects(
    createValidLoan({ requestType: 'CASH_LOAN' }).validate(),
    /requestType/
  );
});

test('StaffLoanAdvance requires a positive safe integer requested amount', async () => {
  for (const requestedAmountPaise of [
    0,
    -1,
    1.5,
    Number.MAX_SAFE_INTEGER + 1,
  ]) {
    await assert.rejects(
      createValidLoan({ requestedAmountPaise }).validate(),
      /requestedAmountPaise/
    );
  }
});

test('StaffLoanAdvance keeps organisation employee request identity immutable', () => {
  for (const field of [
    'loanAdvanceId',
    'organisationId',
    'cafeId',
    'employeeUserId',
    'requestType',
    'requestedAt',
    'createdByUserId',
    'currency',
  ]) {
    assert.equal(
      StaffLoanAdvance.schema.path(field).options.immutable,
      true,
      `${field} must be immutable`
    );
  }
});
