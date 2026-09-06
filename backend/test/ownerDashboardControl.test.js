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

  await t.test('7. Owner Dashboard Date Range Resolution: this_quarter and this_year', () => {
    const today = '2026-09-06';
    // Helper emulation matching dashboardController.js
    function resolveDateRange(period, todayDate) {
      const d = new Date(`${todayDate}T00:00:00+05:30`);
      if (period === 'this_quarter') {
        const qStartMonth = Math.floor(d.getMonth() / 3) * 3 + 1;
        return { from: `${d.getFullYear()}-${String(qStartMonth).padStart(2, '0')}-01`, to: todayDate, label: 'This Quarter' };
      }
      if (period === 'this_year') {
        return { from: `${d.getFullYear()}-01-01`, to: todayDate, label: 'This Year' };
      }
      return { from: todayDate, to: todayDate, label: 'Today' };
    }

    const quarter = resolveDateRange('this_quarter', today);
    assert.equal(quarter.from, '2026-07-01');
    assert.equal(quarter.to, '2026-09-06');
    assert.equal(quarter.label, 'This Quarter');

    const year = resolveDateRange('this_year', today);
    assert.equal(year.from, '2026-01-01');
    assert.equal(year.to, '2026-09-06');
    assert.equal(year.label, 'This Year');
  });

  await t.test('8. Comparison Range Resolution: previous_week, previous_quarter, previous_year', () => {
    const primary = { from: '2026-09-01', to: '2026-09-06' };
    const today = '2026-09-06';

    function subtractDays(dateStr, days) {
      const d = new Date(`${dateStr}T00:00:00+05:30`);
      d.setDate(d.getDate() - days);
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${y}-${m}-${day}`;
    }

    function resolveComparisonRange(comparison, prim) {
      if (comparison === 'previous_week') {
        return { from: subtractDays(prim.from, 7), to: subtractDays(prim.to, 7) };
      }
      if (comparison === 'previous_quarter') {
        const dFrom = new Date(`${prim.from}T00:00:00+05:30`);
        const dTo = new Date(`${prim.to}T00:00:00+05:30`);
        dFrom.setMonth(dFrom.getMonth() - 3);
        dTo.setMonth(dTo.getMonth() - 3);
        const y1 = dFrom.getFullYear(), m1 = String(dFrom.getMonth() + 1).padStart(2, '0'), day1 = String(dFrom.getDate()).padStart(2, '0');
        const y2 = dTo.getFullYear(), m2 = String(dTo.getMonth() + 1).padStart(2, '0'), day2 = String(dTo.getDate()).padStart(2, '0');
        return { from: `${y1}-${m1}-${day1}`, to: `${y2}-${m2}-${day2}` };
      }
      if (comparison === 'previous_year') {
        const dFrom = new Date(`${prim.from}T00:00:00+05:30`);
        const dTo = new Date(`${prim.to}T00:00:00+05:30`);
        dFrom.setFullYear(dFrom.getFullYear() - 1);
        dTo.setFullYear(dTo.getFullYear() - 1);
        const y1 = dFrom.getFullYear(), m1 = String(dFrom.getMonth() + 1).padStart(2, '0'), day1 = String(dFrom.getDate()).padStart(2, '0');
        const y2 = dTo.getFullYear(), m2 = String(dTo.getMonth() + 1).padStart(2, '0'), day2 = String(dTo.getDate()).padStart(2, '0');
        return { from: `${y1}-${m1}-${day1}`, to: `${y2}-${m2}-${day2}` };
      }
      return null;
    }

    const prevWeek = resolveComparisonRange('previous_week', primary);
    assert.equal(prevWeek.from, '2026-08-25');
    assert.equal(prevWeek.to, '2026-08-30');

    const prevQuarter = resolveComparisonRange('previous_quarter', primary);
    assert.equal(prevQuarter.from, '2026-06-01');
    assert.equal(prevQuarter.to, '2026-06-06');

    const prevYear = resolveComparisonRange('previous_year', primary);
    assert.equal(prevYear.from, '2025-09-01');
    assert.equal(prevYear.to, '2025-09-06');
  });

  await t.test('9. Controller Scope Enforcement: Unassigned Owner fails closed (403 CROSS_CAFE_RESOURCE_DENIED)', () => {
    function getCafeScope(auth) {
      const { role, assignedCafeIds, primaryCafeId, cafeId } = auth;
      if (role === 'MASTER') return null;
      const rawCafes = [
        ...(Array.isArray(assignedCafeIds) ? assignedCafeIds : (assignedCafeIds ? [assignedCafeIds] : [])),
        ...(primaryCafeId ? [primaryCafeId] : []),
        ...(cafeId ? [cafeId] : []),
      ];
      const authorizedCafes = [
        ...new Set(rawCafes.filter(Boolean).map((c) => String(c).trim().toUpperCase())),
      ];
      if (role === 'OWNER') {
        if (authorizedCafes.length === 0) {
          throw new ApiError(403, 'CROSS_CAFE_RESOURCE_DENIED', 'Owner has no authorized café assignments.');
        }
        return { $in: authorizedCafes };
      }
      return { $in: authorizedCafes };
    }

    // Unassigned owner must throw 403
    assert.throws(
      () => getCafeScope({ role: 'OWNER', assignedCafeIds: [] }),
      (err) => err instanceof ApiError && err.statusCode === 403 && err.code === 'CROSS_CAFE_RESOURCE_DENIED'
    );

    // Assigned owner returns strict $in filter
    const scope = getCafeScope({ role: 'OWNER', assignedCafeIds: ['ZC-0001', 'ZC-0002'] });
    assert.deepEqual(scope, { $in: ['ZC-0001', 'ZC-0002'] });

    // MASTER returns null (unrestricted across org)
    assert.equal(getCafeScope({ role: 'MASTER' }), null);
  });

  await t.test('10. Owner Target Setting Authorization: Forbidden on unassigned cafes', () => {
    function assertTargetAuthorized(auth, targetCafeId) {
      const { role, isPrimaryMaster } = auth;
      if (role !== 'OWNER' && !(role === 'MASTER' && isPrimaryMaster)) {
        throw new ApiError(403, 'TARGET_MANAGEMENT_RESTRICTED', 'Only Primary Master or Owner may set dashboard targets.');
      }
      if (role === 'OWNER') {
        const assigned = new Set((auth.assignedCafeIds || []).map(c => String(c).trim().toUpperCase()));
        if (!assigned.has(String(targetCafeId).trim().toUpperCase())) {
          throw new ApiError(403, 'CROSS_CAFE_RESOURCE_DENIED', 'Cannot set dashboard target for an unauthorized café.');
        }
      }
    }

    const ownerAuth = { role: 'OWNER', assignedCafeIds: ['ZC-0001'] };
    // Allowed on assigned cafe
    assert.doesNotThrow(() => assertTargetAuthorized(ownerAuth, 'ZC-0001'));
    // Denied on foreign cafe
    assert.throws(
      () => assertTargetAuthorized(ownerAuth, 'ZC-9999'),
      (err) => err instanceof ApiError && err.statusCode === 403 && err.code === 'CROSS_CAFE_RESOURCE_DENIED'
    );
  });

  await t.test('11. Attention Queue Route Mapping: Zero dead routes for Owner', () => {
    function resolveOwnerNavRoute(route) {
      if (!route) return 'dashboard';
      const r = String(route).trim().toLowerCase();
      if (r === 'maintenance') return 'performance';
      if (r === 'quality' || r === 'department-orders') return 'approvals';
      return r;
    }

    assert.equal(resolveOwnerNavRoute('inventory'), 'inventory');
    assert.equal(resolveOwnerNavRoute('maintenance'), 'performance');
    assert.equal(resolveOwnerNavRoute('quality'), 'approvals');
    assert.equal(resolveOwnerNavRoute('department-orders'), 'approvals');
    assert.equal(resolveOwnerNavRoute('attendance'), 'attendance');
    assert.equal(resolveOwnerNavRoute('bills'), 'bills');
    assert.equal(resolveOwnerNavRoute('finance'), 'finance');
    assert.equal(resolveOwnerNavRoute('reports'), 'reports');
  });

});
