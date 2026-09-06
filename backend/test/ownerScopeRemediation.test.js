'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const { resolveEffectiveCafeScope, assertResourceCafeOwnership, buildEffectiveCafeFilter } = require('../src/utils/cafeScope');
const { ApiError } = require('../src/utils/ApiError');

test('PHASE 2 — FOUNDATION REMEDIATION & SECURITY GATE SUITE', async (t) => {

  // ── TEST 1: Router & Org Identity Static & Contract Verification ──────────
  await t.test('1. Router Import Verification: renderOrgIdentity and wireOrgIdentity imported in router.js', () => {
    const routerPath = path.resolve(__dirname, '../../frontend/src/js/router.js');
    const routerSource = fs.readFileSync(routerPath, 'utf8');

    assert.ok(
      routerSource.includes('renderOrgIdentity') && routerSource.includes('wireOrgIdentity'),
      'router.js must reference renderOrgIdentity and wireOrgIdentity'
    );
    assert.ok(
      routerSource.includes('import { renderOrgIdentity, wireOrgIdentity } from "./pages/organisationIdentity.js";'),
      'router.js must explicitly import renderOrgIdentity and wireOrgIdentity from ./pages/organisationIdentity.js'
    );
  });

  await t.test('2. Org Identity Module Resolution: organisationIdentity.js exports renderOrgIdentity and wireOrgIdentity functions', async () => {
    const orgIdentityPath = path.resolve(__dirname, '../../frontend/src/js/pages/organisationIdentity.js');
    const orgIdentitySource = fs.readFileSync(orgIdentityPath, 'utf8');

    assert.ok(
      orgIdentitySource.includes('export function renderOrgIdentity('),
      'organisationIdentity.js must export renderOrgIdentity function'
    );
    assert.ok(
      orgIdentitySource.includes('export async function wireOrgIdentity('),
      'organisationIdentity.js must export wireOrgIdentity function'
    );
  });

  // ── TEST 2: Canonical Owner Scope Policy & cafeScope.js Matrix ─────────────
  await t.test('3. Case 1 — OWNER requests an authorized café: ALLOW', () => {
    const req = {
      auth: {
        userId: 'OW-0001',
        organisationId: 'ORG-ZAMORIN-01',
        role: 'OWNER',
        assignedCafeIds: ['ZC-0001', 'ZC-0002'],
      },
      query: { cafeId: 'ZC-0001' },
      body: {},
      params: {},
    };

    const effective = resolveEffectiveCafeScope(req);
    assert.equal(effective, 'ZC-0001', 'Authorized café must be allowed and returned');
  });

  await t.test('4. Case 1b — OWNER requests another authorized café in multi-café portfolio: ALLOW', () => {
    const req = {
      auth: {
        userId: 'OW-0001',
        organisationId: 'ORG-ZAMORIN-01',
        role: 'OWNER',
        assignedCafeIds: ['ZC-0001', 'ZC-0002'],
      },
      query: { cafeId: 'ZC-0002' },
      body: {},
      params: {},
    };

    const effective = resolveEffectiveCafeScope(req);
    assert.equal(effective, 'ZC-0002', 'Second authorized café must be allowed and returned');
  });

  await t.test('5. Case 2 — OWNER requests an unauthorized café in own organisation: DENY (403)', () => {
    const req = {
      auth: {
        userId: 'OW-0001',
        organisationId: 'ORG-ZAMORIN-01',
        role: 'OWNER',
        assignedCafeIds: ['ZC-0001'],
      },
      query: { cafeId: 'ZC-0002' },
      body: {},
      params: {},
    };

    assert.throws(
      () => resolveEffectiveCafeScope(req),
      (err) => {
        assert.ok(err instanceof ApiError);
        assert.equal(err.status, 403);
        assert.equal(err.code, 'CROSS_CAFE_RESOURCE_DENIED');
        return true;
      },
      'Unauthorized café access must throw 403 CROSS_CAFE_RESOURCE_DENIED'
    );
  });

  await t.test('6. Case 3 — OWNER requests an out-of-organisation café: DENY (403)', () => {
    const req = {
      auth: {
        userId: 'OW-0001',
        organisationId: 'ORG-ZAMORIN-01',
        role: 'OWNER',
        assignedCafeIds: ['ZC-0001', 'ZC-0002'],
      },
      query: { cafeId: 'CF-FOREIGN-999' },
      body: {},
      params: {},
    };

    assert.throws(
      () => resolveEffectiveCafeScope(req),
      (err) => {
        assert.ok(err instanceof ApiError);
        assert.equal(err.status, 403);
        assert.equal(err.code, 'CROSS_CAFE_RESOURCE_DENIED');
        return true;
      },
      'Foreign organisation café access must throw 403 CROSS_CAFE_RESOURCE_DENIED'
    );
  });

  await t.test('7. Case 4 — OWNER requests All Cafés (cafeId=ALL): Returns multi-café portfolio scope (null)', () => {
    const req = {
      auth: {
        userId: 'OW-0001',
        organisationId: 'ORG-ZAMORIN-01',
        role: 'OWNER',
        assignedCafeIds: ['ZC-0001', 'ZC-0002'],
      },
      query: { cafeId: 'ALL' },
      body: {},
      params: {},
    };

    const effective = resolveEffectiveCafeScope(req);
    assert.equal(effective, null, 'Multi-café Owner ALL view returns null for portfolio-wide governance');

    // Build filter must scope to assignedCafeIds
    const filter = buildEffectiveCafeFilter(req);
    assert.deepEqual(filter, { cafeId: { $in: ['ZC-0001', 'ZC-0002'] } });
  });

  await t.test('8. Case 4b — Single-café OWNER requests All Cafés: Returns their only assigned café', () => {
    const req = {
      auth: {
        userId: 'OW-0002',
        organisationId: 'ORG-ZAMORIN-01',
        role: 'OWNER',
        assignedCafeIds: ['ZC-0001'],
      },
      query: { cafeId: 'ALL' },
      body: {},
      params: {},
    };

    const effective = resolveEffectiveCafeScope(req);
    assert.equal(effective, 'ZC-0001', 'Single-café Owner defaults safely to their only authorized café');
  });

  await t.test('9. Case 6 — Unassigned OWNER (missing assignedCafeIds): Fail closed (403)', () => {
    const req = {
      auth: {
        userId: 'OW-UNASSIGNED',
        organisationId: 'ORG-ZAMORIN-01',
        role: 'OWNER',
        assignedCafeIds: [],
      },
      query: {},
      body: {},
      params: {},
    };

    assert.throws(
      () => resolveEffectiveCafeScope(req),
      (err) => {
        assert.ok(err instanceof ApiError);
        assert.equal(err.status, 403);
        assert.equal(err.code, 'CROSS_CAFE_RESOURCE_DENIED');
        return true;
      },
      'Unassigned Owner must fail closed with 403 CROSS_CAFE_RESOURCE_DENIED'
    );
  });

  await t.test('10. Case 6b — Unauthenticated context: Fail closed (401)', () => {
    assert.throws(
      () => resolveEffectiveCafeScope(null),
      (err) => {
        assert.ok(err instanceof ApiError);
        assert.equal(err.status, 401);
        assert.equal(err.code, 'UNAUTHENTICATED');
        return true;
      },
      'Missing request or auth must fail closed with 401 UNAUTHENTICATED'
    );
  });

  await t.test('11. IDOR/BOLA Tampering: Client cannot expand authority via query, body, params', () => {
    // Tamper via query
    const reqQuery = {
      auth: { userId: 'OW-0001', organisationId: 'ORG-A', role: 'OWNER', assignedCafeIds: ['CF-A1'] },
      query: { cafeId: 'CF-B1' },
      body: {},
      params: {},
    };
    assert.throws(() => resolveEffectiveCafeScope(reqQuery), { status: 403 });

    // Tamper via body
    const reqBody = {
      auth: { userId: 'OW-0001', organisationId: 'ORG-A', role: 'OWNER', assignedCafeIds: ['CF-A1'] },
      query: {},
      body: { cafeId: 'CF-B1' },
      params: {},
    };
    assert.throws(() => resolveEffectiveCafeScope(reqBody), { status: 403 });

    // Tamper via params
    const reqParams = {
      auth: { userId: 'OW-0001', organisationId: 'ORG-A', role: 'OWNER', assignedCafeIds: ['CF-A1'] },
      query: {},
      body: {},
      params: { cafeId: 'CF-B1' },
    };
    assert.throws(() => resolveEffectiveCafeScope(reqParams), { status: 403 });
  });

  // ── TEST 3: Cross-Organisation Tenant Isolation Verification ───────────────
  await t.test('12. Cross-Organisation Boundary: Owner in Org A has 0 access to Org B cafes', () => {
    const orgAOwner = {
      auth: {
        userId: 'OW-ORG-A',
        organisationId: 'ORG-A',
        role: 'OWNER',
        assignedCafeIds: ['CF-A1', 'CF-A2'],
      },
      query: { cafeId: 'CF-B1' },
      body: {},
      params: {},
    };

    assert.throws(
      () => resolveEffectiveCafeScope(orgAOwner),
      (err) => {
        assert.equal(err.status, 403);
        assert.equal(err.code, 'CROSS_CAFE_RESOURCE_DENIED');
        return true;
      },
      'Owner in Org A attempting to access Org B café CF-B1 must be denied 403'
    );
  });

  // ── TEST 4: Primary Master, Admin, Staff Authorization Preservation ─────────
  await t.test('13. Role Parity Preservation: PRIMARY MASTER legitimate access is preserved', () => {
    // Global view
    const masterReqAll = {
      auth: { userId: 'MU-0001', organisationId: 'ORG-ZAMORIN-01', role: 'MASTER', isPrimaryMaster: true },
      query: { cafeId: 'ALL' },
      body: {},
      params: {},
    };
    assert.equal(resolveEffectiveCafeScope(masterReqAll), null, 'Master ALL view returns null for portfolio view');

    // Specific valid cafe
    const masterReqSpecific = {
      auth: { userId: 'MU-0001', organisationId: 'ORG-ZAMORIN-01', role: 'MASTER', isPrimaryMaster: true },
      query: { cafeId: 'ZC-0001' },
      body: {},
      params: {},
    };
    assert.equal(resolveEffectiveCafeScope(masterReqSpecific), 'ZC-0001', 'Master can inspect specific cafe');
  });

  await t.test('14. Role Parity Preservation: CAFE_ADMIN is strictly bound to assigned cafe', () => {
    const adminReq = {
      auth: {
        userId: 'AD-0001',
        organisationId: 'ORG-ZAMORIN-01',
        role: 'CAFE_ADMIN',
        assignedCafeIds: ['ZC-0001'],
        workspaceMode: 'CAFE_OPERATIONS',
      },
      query: { cafeId: 'ZC-0001' },
      body: {},
      params: {},
    };
    assert.equal(resolveEffectiveCafeScope(adminReq), 'ZC-0001');

    const adminDeniedReq = {
      auth: {
        userId: 'AD-0001',
        organisationId: 'ORG-ZAMORIN-01',
        role: 'CAFE_ADMIN',
        assignedCafeIds: ['ZC-0001'],
        workspaceMode: 'CAFE_OPERATIONS',
      },
      query: { cafeId: 'ZC-0002' },
      body: {},
      params: {},
    };
    assert.throws(() => resolveEffectiveCafeScope(adminDeniedReq), { status: 403 });
  });

  await t.test('15. Role Parity Preservation: STAFF is bound to assigned cafe and cannot switch', () => {
    const staffReq = {
      auth: {
        userId: 'ST-0001',
        organisationId: 'ORG-ZAMORIN-01',
        role: 'STAFF',
        assignedCafeIds: ['ZC-0001'],
      },
      query: { cafeId: 'ZC-0001' },
      body: {},
      params: {},
    };
    assert.equal(resolveEffectiveCafeScope(staffReq), 'ZC-0001');

    const staffDeniedReq = {
      auth: {
        userId: 'ST-0001',
        organisationId: 'ORG-ZAMORIN-01',
        role: 'STAFF',
        assignedCafeIds: ['ZC-0001'],
      },
      query: { cafeId: 'ZC-0002' },
      body: {},
      params: {},
    };
    assert.throws(() => resolveEffectiveCafeScope(staffDeniedReq), { status: 403 });
  });

  // ── TEST 5: assertResourceCafeOwnership Verification ───────────────────────
  await t.test('16. assertResourceCafeOwnership: Owner cannot access resources from unauthorized cafes', () => {
    const resourceForeign = { taskId: 'TSK-999', cafeId: 'ZC-UNAUTHORIZED' };
    const ownerReq = {
      auth: {
        userId: 'OW-0001',
        role: 'OWNER',
        assignedCafeIds: ['ZC-0001'],
      },
      query: {},
      body: {},
      params: {},
    };

    assert.throws(
      () => assertResourceCafeOwnership(resourceForeign, ownerReq),
      (err) => {
        assert.ok(err instanceof ApiError);
        assert.equal(err.status, 404, 'Foreign resource lookup must fail with safe 404');
        return true;
      }
    );

    const resourceAuthorized = { taskId: 'TSK-001', cafeId: 'ZC-0001' };
    assert.doesNotThrow(() => assertResourceCafeOwnership(resourceAuthorized, ownerReq));
  });

  // ── TEST 6: OW-0001 Seed User Verification ────────────────────────────────
  await t.test('17. OW-0001 Seed User: seedInitialData.js seeds OW-0001 with assignedCafeIds and primaryCafeId', () => {
    const seedPath = path.resolve(__dirname, '../src/scripts/seedInitialData.js');
    const seedSource = fs.readFileSync(seedPath, 'utf8');

    assert.ok(
      seedSource.includes("userId: 'OW-0001'") &&
      seedSource.includes("assignedCafeIds: ['ZC-0001', 'ZC-0002']") &&
      seedSource.includes("primaryCafeId: 'ZC-0001'"),
      'OW-0001 must be seeded with primaryCafeId ZC-0001 and assignedCafeIds [ZC-0001, ZC-0002]'
    );
  });
});
