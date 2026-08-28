'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

const { PassbookAccount } = require('../src/models/PassbookAccount');
const { PassbookTransaction } = require('../src/models/PassbookTransaction');
const { PassbookTransfer } = require('../src/models/PassbookTransfer');
const { PassbookReconciliation } = require('../src/models/PassbookReconciliation');
const { PassbookService } = require('../src/services/passbookService');

test('Passbook & Treasury Service Contract Suite', async (t) => {
  await t.test('1. PassbookService exposes core treasury management methods', () => {
    assert.strictEqual(typeof PassbookService.getAccountsSummary, 'function');
    assert.strictEqual(typeof PassbookService.getAnalytics, 'function');
    assert.strictEqual(typeof PassbookService.runIntegrityAudit, 'function');
    assert.strictEqual(typeof PassbookService.createAccount, 'function');
    assert.strictEqual(typeof PassbookService.createTransfer, 'function');
    assert.strictEqual(typeof PassbookService.postTransaction, 'function');
    assert.strictEqual(typeof PassbookService.confirmBalance, 'function');
  });

  await t.test('2. Passbook Account Model schema validation enforces required fields', () => {
    const acc = new PassbookAccount({
      accountId: 'ACC-202608-0001',
      organisationId: 'ZAMORIN',
      accountCode: 'MAIN-VAULT-01',
      accountName: 'Main Operating Vault',
      accountType: 'BANK_OPERATING',
      scopeType: 'ORGANISATION_GLOBAL',
      status: 'ACTIVE',
      createdBy: 'MU-0001',
    });

    assert.strictEqual(acc.accountId, 'ACC-202608-0001');
    assert.strictEqual(acc.organisationId, 'ZAMORIN');
    assert.strictEqual(acc.accountName, 'Main Operating Vault');
    assert.strictEqual(acc.status, 'ACTIVE');
  });

  await t.test('3. Passbook Transaction Model enforces atomic integer paise and transaction keys', () => {
    const tx = new PassbookTransaction({
      transactionId: 'TX-20260828-0001',
      organisationId: 'ZAMORIN',
      accountId: 'ACC-202608-0001',
      postingSequence: 1,
      businessDate: '2026-08-28',
      postingDate: '2026-08-28',
      valueDate: '2026-08-28',
      type: 'EXTERNAL_INCOME',
      direction: 'CREDIT',
      amountPaisa: 1500000, // 15,000.00 INR in paise
      runningBalancePaisa: 6500000,
      description: 'POS daily batch settlement',
      status: 'POSTED',
      performedBy: 'MU-0001',
    });

    assert.strictEqual(tx.transactionId, 'TX-20260828-0001');
    assert.strictEqual(tx.amountPaisa, 1500000);
    assert.strictEqual(tx.runningBalancePaisa, 6500000);
    assert.strictEqual(Number.isInteger(tx.amountPaisa), true);
  });

  await t.test('4. Passbook Transfer Model links source and destination accounts', () => {
    const transfer = new PassbookTransfer({
      transferId: 'TRF-20260828-0001',
      organisationId: 'ZAMORIN',
      sourceAccountId: 'ACC-202608-0001',
      destAccountId: 'ACC-202608-0002',
      sourceCafeId: 'ZC-0001',
      sourceTransactionId: 'TX-20260828-0001',
      amountPaisa: 500000,
      status: 'COMPLETED',
      description: 'Inter-vault replenishment',
      initiatedBy: 'MU-0001',
    });

    assert.strictEqual(transfer.sourceAccountId, 'ACC-202608-0001');
    assert.strictEqual(transfer.destAccountId, 'ACC-202608-0002');
    assert.strictEqual(transfer.amountPaisa, 500000);
  });

  await t.test('5. Passbook Reconciliation Model records balance confirmation snapshots', () => {
    const rec = new PassbookReconciliation({
      reconciliationId: 'REC-20260828-0001',
      organisationId: 'ZAMORIN',
      accountId: 'ACC-202608-0001',
      periodId: 'FP-202608',
      fiscalYear: 'FY2026-27',
      statementPeriodStart: '2026-08-01',
      statementPeriodEnd: '2026-08-31',
      openingBookBalancePaisa: 5000000,
      closingBookBalancePaisa: 5000000,
      openingStatementBalancePaisa: 5000000,
      closingStatementBalancePaisa: 5000000,
      differencePaisa: 0,
      unexplainedDifferencePaisa: 0,
      status: 'CONFIRMED',
      confirmedBy: 'OU-0001',
    });

    assert.strictEqual(rec.differencePaisa, 0);
    assert.strictEqual(rec.status, 'CONFIRMED');
    assert.strictEqual(rec.confirmedBy, 'OU-0001');
  });
});
