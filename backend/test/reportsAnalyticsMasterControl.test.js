'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');

const { createApp } = require('../src/server');
const { User } = require('../src/models/User');
const { AuditEvent } = require('../src/models/AuditEvent');
const { RolePermission } = require('../src/models/RolePermission');
const { SequenceCounter } = require('../src/models/SequenceCounter');
const authService = require('../src/services/authService');
const auditService = require('../src/services/auditService');

function makeRequest({ port, method, path, headers = {}, body = null }) {
  return new Promise((resolve, reject) => {
    const serializedBody = body ? JSON.stringify(body) : null;
    const reqHeaders = { ...headers };
    if (serializedBody) {
      reqHeaders['Content-Type'] = 'application/json';
      reqHeaders['Content-Length'] = Buffer.byteLength(serializedBody);
    }

    const req = http.request(
      {
        hostname: '127.0.0.1',
        port,
        method,
        path,
        headers: reqHeaders,
      },
      (res) => {
        let responseData = '';
        res.on('data', (chunk) => {
          responseData += chunk;
        });
        res.on('end', () => {
          let json = null;
          try {
            json = JSON.parse(responseData);
          } catch (e) {
            json = { raw: responseData };
          }
          resolve({ status: res.statusCode, data: json });
        });
      }
    );

    req.on('error', reject);
    if (serializedBody) req.write(serializedBody);
    req.end();
  });
}

test('SCR-022: Reports & Analytics Master Control & ZURF Integration Suite', async (t) => {
  const app = createApp({ allowedOrigins: ['*'], production: false });
  const server = http.createServer(app);

  await new Promise((resolve) => {
    server.listen(0, '127.0.0.1', resolve);
  });

  const port = server.address().port;

  t.after(async () => {
    await new Promise((resolve) => server.close(resolve));
  });

  const primaryMasterUser = {
    userId: 'MU-PRIMARY-01',
    role: 'MASTER',
    isPrimaryMaster: true,
    organisationId: 'ORG-ZAMORIN',
    email: 'primary@zamorincafe.com',
    fullName: 'Primary Master',
    sessionVersion: 1,
    permissionsVersion: 1,
    assignedCafeIds: ['ZC-0001', 'ZC-0002'],
    accountStatus: 'ACTIVE',
  };

  const ownerUser = {
    userId: 'OU-OWNER-01',
    role: 'OWNER',
    organisationId: 'ORG-ZAMORIN',
    email: 'owner@zamorincafe.com',
    fullName: 'Owner User',
    sessionVersion: 1,
    permissionsVersion: 1,
    assignedCafeIds: ['ZC-0001', 'ZC-0002'],
    accountStatus: 'ACTIVE',
  };

  const staffUser = {
    userId: 'SU-STAFF-01',
    role: 'STAFF',
    organisationId: 'ORG-ZAMORIN',
    email: 'staff@zamorincafe.com',
    fullName: 'Staff User',
    sessionVersion: 1,
    permissionsVersion: 1,
    assignedCafeIds: ['ZC-0001'],
    accountStatus: 'ACTIVE',
  };

  t.mock.method(authService, 'verifyAccessToken', async (token) => {
    if (token === 'token_owner') {
      return {
        payload: {
          sub: ownerUser.userId,
          org: ownerUser.organisationId,
          role: ownerUser.role,
          email: ownerUser.email,
          name: ownerUser.fullName,
          assignedCafeIds: ownerUser.assignedCafeIds,
          sv: 0,
          usv: 1,
          pv: 1,
          sid: 'SS-OWNER-01',
        },
        session: {
          sessionId: 'SS-OWNER-01',
          roleSnapshot: ownerUser.role,
          sessionVersion: 0,
          mfaVerified: true,
          stepUpVerifiedAt: new Date().toISOString(),
        },
      };
    }
    if (token === 'token_staff') {
      return {
        payload: {
          sub: staffUser.userId,
          org: staffUser.organisationId,
          role: staffUser.role,
          email: staffUser.email,
          name: staffUser.fullName,
          assignedCafeIds: staffUser.assignedCafeIds,
          sv: 0,
          usv: 1,
          pv: 1,
          sid: 'SS-STAFF-01',
        },
        session: {
          sessionId: 'SS-STAFF-01',
          roleSnapshot: staffUser.role,
          sessionVersion: 0,
          mfaVerified: true,
          stepUpVerifiedAt: new Date().toISOString(),
        },
      };
    }
    return {
      payload: {
        sub: primaryMasterUser.userId,
        org: primaryMasterUser.organisationId,
        role: primaryMasterUser.role,
        email: primaryMasterUser.email,
        name: primaryMasterUser.fullName,
        isPrimaryMaster: true,
        assignedCafeIds: primaryMasterUser.assignedCafeIds,
        sv: 0,
        usv: 1,
        pv: 1,
        sid: 'SS-MASTER-01',
      },
      session: {
        sessionId: 'SS-MASTER-01',
        roleSnapshot: primaryMasterUser.role,
        sessionVersion: 0,
        mfaVerified: true,
        stepUpVerifiedAt: new Date().toISOString(),
      },
    };
  });

  t.mock.method(User, 'findOne', async (query) => {
    if (query?.userId === 'OU-OWNER-01') return ownerUser;
    if (query?.userId === 'SU-STAFF-01') return staffUser;
    return primaryMasterUser;
  });

  t.mock.method(RolePermission, 'findEffectiveRules', async ({ role, permissionCode }) => [
    {
      role,
      permissionCode,
      effect: 'ALLOW',
      scope: 'ORGANISATION',
      isCurrentlyEffective: () => true,
    },
  ]);

  t.mock.method(auditService, 'recordRequestAudit', async () => ({}));
  t.mock.method(auditService, 'recordAuditEvent', async () => ({}));
  t.mock.method(AuditEvent, 'create', async (data) => data);
  AuditEvent.prototype.save = async function () { return this; };

  SequenceCounter.generateId = async function (opts) {
    if (typeof opts === 'string') return `${opts}-2026-0001`;
    const pfx = opts?.prefix || 'RPT';
    return `${pfx}-2026-0001`;
  };
  t.mock.method(SequenceCounter, 'generateId', SequenceCounter.generateId);
  t.mock.method(SequenceCounter, 'getNextNumber', async () => 1);

  const masterHeaders = {
    Authorization: 'Bearer token_master',
    'x-device-id': 'DEV-MASTER-01',
  };

  const ownerHeaders = {
    Authorization: 'Bearer token_owner',
    'x-device-id': 'DEV-OWNER-01',
  };

  const staffHeaders = {
    Authorization: 'Bearer token_staff',
    'x-device-id': 'DEV-STAFF-01',
  };

  await t.test('1. GET /api/v1/reports/overview returns headline KPIs for Master', async () => {
    const res = await makeRequest({
      port,
      method: 'GET',
      path: '/api/v1/reports/overview',
      headers: masterHeaders,
    });

    assert.equal(res.status, 200);
    assert.equal(res.data.success, true);
    assert.ok(res.data.data.kpis.netSalesMdt);
    assert.equal(res.data.data.kpis.totalOrders, 1420);
    assert.ok(Array.isArray(res.data.data.actionCentreItems));
  });

  await t.test('2. GET /api/v1/reports/overview is accessible to OWNER', async () => {
    const res = await makeRequest({
      port,
      method: 'GET',
      path: '/api/v1/reports/overview',
      headers: ownerHeaders,
    });

    assert.equal(res.status, 200);
    assert.equal(res.data.success, true);
  });

  await t.test('3. STAFF is strictly forbidden (403) from Reports endpoints', async () => {
    const res = await makeRequest({
      port,
      method: 'GET',
      path: '/api/v1/reports/overview',
      headers: staffHeaders,
    });

    assert.equal(res.status, 403);
    assert.equal(res.data.error.code, 'ROLE_NOT_ALLOWED');
  });

  await t.test('4. GET /api/v1/reports/library returns full multi-domain catalogue', async () => {
    const res = await makeRequest({
      port,
      method: 'GET',
      path: '/api/v1/reports/library',
      headers: masterHeaders,
    });

    assert.equal(res.status, 200);
    assert.equal(res.data.success, true);
    assert.ok(res.data.data.reports.length >= 8);
    assert.ok(res.data.data.reports.some((r) => r.reportId === 'daily-sales'));
  });

  await t.test('5. GET /api/v1/reports/sales returns sales trends, hourly velocity, and payment mix', async () => {
    const res = await makeRequest({
      port,
      method: 'GET',
      path: '/api/v1/reports/sales',
      headers: masterHeaders,
    });

    assert.equal(res.status, 200);
    assert.equal(res.data.success, true);
    assert.ok(res.data.data.summary.netSalesPaise > 0);
    assert.ok(Array.isArray(res.data.data.hourlyTrends));
    assert.ok(Array.isArray(res.data.data.paymentMix));
  });

  await t.test('6. GET /api/v1/reports/finance returns P&L statement, waterfall, and operating margins', async () => {
    const res = await makeRequest({
      port,
      method: 'GET',
      path: '/api/v1/reports/finance',
      headers: masterHeaders,
    });

    assert.equal(res.status, 200);
    assert.equal(res.data.success, true);
    assert.equal(res.data.data.plStatement.grossMarginPct, 70.0);
    assert.ok(Array.isArray(res.data.data.waterfall));
  });

  await t.test('7. GET /api/v1/reports/workforce returns attendance exceptions and labour %', async () => {
    const res = await makeRequest({
      port,
      method: 'GET',
      path: '/api/v1/reports/workforce',
      headers: masterHeaders,
    });

    assert.equal(res.status, 200);
    assert.equal(res.data.success, true);
    assert.equal(res.data.data.workforceMetrics.labourCostPctOfSales, 20.0);
    assert.ok(Array.isArray(res.data.data.exceptions));
  });

  await t.test('8. GET /api/v1/reports/customers returns guest retention and RFM segments', async () => {
    const res = await makeRequest({
      port,
      method: 'GET',
      path: '/api/v1/reports/customers',
      headers: masterHeaders,
    });

    assert.equal(res.status, 200);
    assert.equal(res.data.success, true);
    assert.equal(res.data.data.customerSummary.repeatPurchaseRatePct, 70.4);
    assert.ok(Array.isArray(res.data.data.rfmSegments));
  });

  await t.test('9. GET /api/v1/reports/inventory returns stock valuation and movement waterfall', async () => {
    const res = await makeRequest({
      port,
      method: 'GET',
      path: '/api/v1/reports/inventory',
      headers: masterHeaders,
    });

    assert.equal(res.status, 200);
    assert.equal(res.data.success, true);
    assert.ok(res.data.data.stockValuation.totalValuation > 0);
    assert.ok(res.data.data.movementWaterfall.closingBalance > 0);
  });

  await t.test('10. GET /api/v1/reports/procurement returns spend and 3-way match indicators', async () => {
    const res = await makeRequest({
      port,
      method: 'GET',
      path: '/api/v1/reports/procurement',
      headers: masterHeaders,
    });

    assert.equal(res.status, 200);
    assert.equal(res.data.success, true);
    assert.ok(res.data.data.spendSummary.totalPoCommitments > 0);
    assert.ok(Array.isArray(res.data.data.supplierSpend));
  });

  await t.test('11. GET /api/v1/reports/menu returns item margins and engineering matrix', async () => {
    const res = await makeRequest({
      port,
      method: 'GET',
      path: '/api/v1/reports/menu',
      headers: masterHeaders,
    });

    assert.equal(res.status, 200);
    assert.equal(res.data.success, true);
    assert.ok(Array.isArray(res.data.data.menuPerformance));
    assert.ok(res.data.data.menuPerformance.length > 0);
  });

  await t.test('12. GET /api/v1/reports/quality returns checklists, excursions, and CAPA status', async () => {
    const res = await makeRequest({
      port,
      method: 'GET',
      path: '/api/v1/reports/quality',
      headers: masterHeaders,
    });

    assert.equal(res.status, 200);
    assert.equal(res.data.success, true);
    assert.equal(res.data.data.qualityMetrics.checklistCompletionRatePct, 98.6);
  });

  await t.test('13. GET /api/v1/reports/assets returns equipment availability and PM compliance', async () => {
    const res = await makeRequest({
      port,
      method: 'GET',
      path: '/api/v1/reports/assets',
      headers: masterHeaders,
    });

    assert.equal(res.status, 200);
    assert.equal(res.data.success, true);
    assert.equal(res.data.data.assetMetrics.availabilityRatePct, 99.4);
  });

  await t.test('14. GET /api/v1/reports/portfolio returns like-for-like sales growth', async () => {
    const res = await makeRequest({
      port,
      method: 'GET',
      path: '/api/v1/reports/portfolio',
      headers: masterHeaders,
    });

    assert.equal(res.status, 200);
    assert.equal(res.data.success, true);
    assert.ok(res.data.data.overallLikeForLikeGrowthPct > 0);
    assert.ok(res.data.data.portfolio.some((p) => p.category === 'MATURE'));
  });

  await t.test('15. GET /api/v1/reports/goals returns scorecards linked to governed metrics', async () => {
    const res = await makeRequest({
      port,
      method: 'GET',
      path: '/api/v1/reports/goals',
      headers: masterHeaders,
    });

    assert.equal(res.status, 200);
    assert.equal(res.data.success, true);
    assert.ok(Array.isArray(res.data.data.scorecards));
  });

  await t.test('16. GET /api/v1/reports/scheduled-alerts returns subscriptions and alerts', async () => {
    const res = await makeRequest({
      port,
      method: 'GET',
      path: '/api/v1/reports/scheduled-alerts',
      headers: masterHeaders,
    });

    assert.equal(res.status, 200);
    assert.equal(res.data.success, true);
    assert.ok(Array.isArray(res.data.data.subscriptions));
    assert.ok(Array.isArray(res.data.data.alerts));
  });

  await t.test('17. GET /api/v1/reports/reconciliations returns cross-module reconciliation checks', async () => {
    const res = await makeRequest({
      port,
      method: 'GET',
      path: '/api/v1/reports/reconciliations',
      headers: masterHeaders,
    });

    assert.equal(res.status, 200);
    assert.equal(res.data.success, true);
    assert.equal(res.data.data.allMatched, true);
    assert.ok(res.data.data.reconciliations.length >= 4);
  });

  await t.test('18. GET /api/v1/reports/data-quality returns lineage nodes and pipeline health', async () => {
    const res = await makeRequest({
      port,
      method: 'GET',
      path: '/api/v1/reports/data-quality',
      headers: masterHeaders,
    });

    assert.equal(res.status, 200);
    assert.equal(res.data.success, true);
    assert.equal(res.data.data.qualityStatus.overallDataHealth, 'OPTIMAL');
    assert.ok(Array.isArray(res.data.data.lineageNodes));
  });

  await t.test('19. GET /api/v1/reports/metrics returns governed metric dictionary', async () => {
    const res = await makeRequest({
      port,
      method: 'GET',
      path: '/api/v1/reports/metrics',
      headers: masterHeaders,
    });

    assert.equal(res.status, 200);
    assert.equal(res.data.success, true);
    assert.ok(res.data.data.metrics.length >= 10);
    assert.ok(res.data.data.metrics.some((m) => m.metricId === 'NET_SALES'));
  });

  await t.test('20. POST /api/v1/reports/export generates ZURF v1 PDF with logo, watermark, and GSTIN', async () => {
    const res = await makeRequest({
      port,
      method: 'POST',
      path: '/api/v1/reports/export',
      headers: masterHeaders,
      body: {
        reportId: 'daily-sales',
        format: 'PDF',
        classification: 'INTERNAL',
      },
    });

    assert.equal(res.status, 200);
    assert.equal(res.data.success, true);
    assert.ok(res.data.data.runId.startsWith('RPT-RUN-'));
    assert.equal(res.data.data.hasWatermark, true);
    assert.ok(res.data.data.html.includes('zurf-page-watermark'));
    assert.ok(res.data.data.html.includes('29AABCT1332L1ZV'));
    assert.ok(res.data.data.html.includes('Zamorin Speciality Coffee & Kitchens Pvt. Ltd.'));
  });

  await t.test('21. POST /api/v1/reports/export generates clean CSV with manifest', async () => {
    const res = await makeRequest({
      port,
      method: 'POST',
      path: '/api/v1/reports/export',
      headers: masterHeaders,
      body: {
        reportId: 'daily-sales',
        format: 'CSV',
      },
    });

    assert.equal(res.status, 200);
    assert.equal(res.data.success, true);
    assert.ok(res.data.data.csv.includes('Gross Sales Revenue'));
    assert.ok(res.data.data.manifest.company.includes('Zamorin'));
  });

  await t.test('22. GET /api/v1/reports/integrity performs 16-point invariant audit verification', async () => {
    const res = await makeRequest({
      port,
      method: 'GET',
      path: '/api/v1/reports/integrity',
      headers: masterHeaders,
    });

    assert.equal(res.status, 200);
    assert.equal(res.data.success, true);
    assert.equal(res.data.data.integrityScore, 100);
    assert.equal(res.data.data.totalChecks, 16);
    assert.equal(res.data.data.allPassed, true);
  });
});
