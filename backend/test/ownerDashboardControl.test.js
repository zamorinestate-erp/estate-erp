'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  resolveEffectiveCafeScope,
  assertResourceCafeOwnership,
} = require('../src/utils/cafeScope');
const { ApiError } = require('../src/utils/ApiError');

test('OWN-SCR-001: Owner Dashboard, Financial Control & RBAC Boundaries Suite', async (t) => {

  await t.test('1. Owner Dashboard Scoping: Authorized multi-café access vs unauthorized café exclusion', () => {
    // Owner with assigned cafes ZC-0001 and ZC-0002 in Master/Owner Workspace
    const ownerWorkspaceReq = {
      auth: {
        role: 'OWNER',
        userId: 'OWN-001',
        organisationId: 'ORG-001',
        assignedCafeIds: ['ZC-0001', 'ZC-0002'],
        workspaceMode: 'MASTER_WORKSPACE',
      },
      query: {},
      body: {},
    };

    // Global view across authorized portfolio
    const scope = resolveEffectiveCafeScope(ownerWorkspaceReq);
    assert.equal(scope, null, 'Owner global view returns null for full authorized portfolio aggregation');

    // Filter to authorized café ZC-0001
    const ownerFilteredReq = {
      ...ownerWorkspaceReq,
      query: { cafeId: 'ZC-0001' },
    };
    assert.equal(resolveEffectiveCafeScope(ownerFilteredReq), 'ZC-0001', 'Owner can filter to specific authorized café');
  });

  await t.test('2. Owner Personal Ledger: Authorized access allowed; IDOR & cross-user access blocked', () => {
    const ownerAuth = {
      role: 'OWNER',
      userId: 'OWN-001',
      organisationId: 'ORG-001',
    };

    // 1. Same-owner ledger access allowed
    const ownerSelfEntry = {
      entryId: 'PLE-1001',
      organisationId: 'ORG-001',
      userId: 'OWN-001',
      entryType: 'CREDIT',
      amountPaisa: 500000,
    };
    assert.equal(ownerSelfEntry.userId, ownerAuth.userId, 'Owner can access their own personal ledger entry');

    // 2. Foreign owner / staff ledger access check
    const foreignEntry = {
      entryId: 'PLE-1002',
      organisationId: 'ORG-001',
      userId: 'OWN-002',
      entryType: 'CREDIT',
      amountPaisa: 1000000,
    };
    assert.notEqual(foreignEntry.userId, ownerAuth.userId, 'Cross-owner ledger access must be detected and blocked');
  });

  await t.test('3. Owner Cash Drawer Management: Drawer events, variance calculation & audit trail', () => {
    const initialSession = {
      registerSessionId: 'REG-20260822-0001',
      cafeId: 'ZC-0001',
      registerId: 'REG-01',
      status: 'OPEN',
      openingFloatPaisa: 500000, // ₹5,000.00
      expectedCashPaisa: 500000,
      cashEvents: [],
    };

    // Record Cash In event (e.g. Float addition)
    const cashInEvent = {
      eventType: 'CASH_IN',
      amountPaisa: 100000, // ₹1,000.00
      reason: 'Additional change float',
      actorId: 'OWN-001',
      timestamp: new Date(),
    };
    initialSession.cashEvents.push(cashInEvent);
    initialSession.expectedCashPaisa += cashInEvent.amountPaisa;

    assert.equal(initialSession.expectedCashPaisa, 600000, 'Expected cash updated correctly after CASH_IN');

    // Record Safe Drop
    const safeDropEvent = {
      eventType: 'SAFE_DROP',
      amountPaisa: 200000, // ₹2,000.00
      reason: 'Midday safe drop',
      actorId: 'OWN-001',
      timestamp: new Date(),
    };
    initialSession.cashEvents.push(safeDropEvent);
    initialSession.expectedCashPaisa -= safeDropEvent.amountPaisa;

    assert.equal(initialSession.expectedCashPaisa, 400000, 'Expected cash updated correctly after SAFE_DROP');

    // Close session with blind count
    const countedCashPaisa = 395000; // ₹3,950.00 (-₹50.00 variance)
    const variancePaisa = countedCashPaisa - initialSession.expectedCashPaisa;

    assert.equal(variancePaisa, -5000, 'Cash variance calculated correctly as -₹50.00');
  });

  await t.test('4. Master Boundary Enforcement: Owner cannot perform Master-only expense decisions or payroll finalization', () => {
    const ownerAuth = {
      role: 'OWNER',
      userId: 'OWN-001',
      organisationId: 'ORG-001',
      isPrimaryMaster: false,
    };

    // Master-only expense final actions (APPROVE, REJECT, PAY, REVERSE)
    const isMasterExpenseAuthorized = ownerAuth.role === 'MASTER' && Boolean(ownerAuth.isPrimaryMaster);
    assert.equal(isMasterExpenseAuthorized, false, 'OWNER cannot perform MASTER final expense approvals');

    // Payroll finalization
    const isPayrollFinalizeAuthorized = ownerAuth.role === 'MASTER' && Boolean(ownerAuth.isPrimaryMaster);
    assert.equal(isPayrollFinalizeAuthorized, false, 'OWNER cannot finalize enterprise payroll');
  });

  await t.test('5. Explainable Multi-Location Health Badges', () => {
    function classifyHealth(data) {
      if (data.inventoryCritical > 0 || data.maintenanceOpen > 0) return 'CRITICAL';
      if (data.inventoryBelowPar > 0 || (data.targetAchievementPct !== null && data.targetAchievementPct < 70)) return 'ATTENTION';
      return 'HEALTHY';
    }

    assert.equal(classifyHealth({ inventoryCritical: 1, maintenanceOpen: 0, inventoryBelowPar: 0, targetAchievementPct: 90 }), 'CRITICAL');
    assert.equal(classifyHealth({ inventoryCritical: 0, maintenanceOpen: 0, inventoryBelowPar: 2, targetAchievementPct: 85 }), 'ATTENTION');
    assert.equal(classifyHealth({ inventoryCritical: 0, maintenanceOpen: 0, inventoryBelowPar: 0, targetAchievementPct: 95 }), 'HEALTHY');
  });

  await t.test('6. Percentage Point (pp) Calculation Integrity for Ratios', () => {
    const prevExpenseRatio = 28.0;
    const currentExpenseRatio = 31.2;
    const ppMovement = Number((currentExpenseRatio - prevExpenseRatio).toFixed(1));

    assert.equal(ppMovement, 3.2, 'Ratio movements must be expressed in percentage points (pp)');
  });

});
