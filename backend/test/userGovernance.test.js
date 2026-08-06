'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

const { User } = require('../src/models/User');
const { Cafe } = require('../src/models/Cafe');
const { Session } = require('../src/models/Session');

const {
  loadActor,
  loadTarget,
  assertNotPrimaryMasterTarget,
  assertPrimaryMasterAuthority,
  assertMayActOnMasterTarget,
  rejectProtectedFields,
  validateProposedRole,
  assertRoleIsNotNoOp,
  assertStatusIsNotNoOp,
  validateCafeIds,
  assertCafeChangeIsNotNoOp,
  assertExpectedState,
  calculateRoleImpactPreview,
  buildRoleHistoryEntry,
  buildCafeAssignmentHistoryEntry,
  buildUserSnapshot,
} = require('../src/services/userGovernanceService');

const {
  previewRoleChange,
  executeRoleChange,
} = require('../src/controllers/roleGovernanceController');

const {
  createUser,
  updateUser,
  changeUserStatus,
  archiveUser,
} = require('../src/controllers/userController');

function createMockUser(overrides = {}) {
  const user = new User({
    userId: 'MU-0001',
    organisationId: 'ORG-TEST',
    name: 'Primary Master',
    email: 'primary@example.com',
    role: 'MASTER',
    accountStatus: 'ACTIVE',
    primaryCafeId: null,
    assignedCafeIds: [],
    isPrimaryMaster: true,
    primaryMasterDesignatedAt: new Date(),
    primaryMasterDesignatedBy: 'MU-0001',
    primaryMasterDesignationReason: 'Initial setup',
    roleHistory: [],
    cafeAssignmentHistory: [],
    sessionVersion: 1,
    permissionsVersion: 1,
    passwordHash: 'hash',
    createdBy: 'SYSTEM',
    ...overrides,
  });
  return user;
}

function createMockRequest(overrides = {}) {
  return {
    auth: {
      userId: 'MU-0001',
      organisationId: 'ORG-TEST',
      role: 'MASTER',
      assignedCafeIds: [],
      primaryCafeId: null,
      sessionId: 'SS-20260806-0001',
      mfaVerified: true,
      stepUpVerifiedAt: new Date().toISOString(),
    },
    correlationId: 'test-correlation-id',
    params: {},
    body: {},
    query: {},
    headers: {},
    get: () => null,
    ...overrides,
  };
}

function createMockResponse() {
  const res = {
    statusCode: 200,
    jsonPayload: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.jsonPayload = payload;
      return this;
    },
  };
  return res;
}

// ─── Primary Master Protection Tests ─────────────────────────────────────────

test('Primary Master protection prevents demotion', () => {
  const pm = createMockUser({ isPrimaryMaster: true });
  assert.throws(
    () => assertNotPrimaryMasterTarget(pm, 'role demotion'),
    (err) => err.code === 'PRIMARY_MASTER_PROTECTED' && err.statusCode === 403
  );
});

test('Primary Master protection prevents status change away from ACTIVE', () => {
  const pm = createMockUser({ isPrimaryMaster: true });
  assert.throws(
    () => assertNotPrimaryMasterTarget(pm, 'deactivation'),
    (err) => err.code === 'PRIMARY_MASTER_PROTECTED' && err.statusCode === 403
  );
});

test('Primary Master protection prevents archiving', () => {
  const pm = createMockUser({ isPrimaryMaster: true });
  assert.throws(
    () => assertNotPrimaryMasterTarget(pm, 'archival'),
    (err) => err.code === 'PRIMARY_MASTER_PROTECTED' && err.statusCode === 403
  );
});

test('Secondary Master cannot modify Primary Master', () => {
  const secondaryMaster = createMockUser({
    userId: 'MU-0002',
    isPrimaryMaster: false,
  });
  const pm = createMockUser({ isPrimaryMaster: true });

  assert.throws(
    () => assertPrimaryMasterAuthority(secondaryMaster, 'modify Primary Master'),
    (err) => err.code === 'PRIMARY_MASTER_AUTHORITY_REQUIRED' && err.statusCode === 403
  );
});

test('Secondary Master cannot administer another MASTER account', () => {
  const secondaryMaster = createMockUser({
    userId: 'MU-0002',
    isPrimaryMaster: false,
  });
  const targetMaster = createMockUser({
    userId: 'MU-0003',
    isPrimaryMaster: false,
  });

  assert.throws(
    () => assertMayActOnMasterTarget(secondaryMaster, targetMaster),
    (err) => err.code === 'MASTER_ROLE_GOVERNANCE_FORBIDDEN' && err.statusCode === 403
  );
});

test('Primary Master can administer another non-primary MASTER account', () => {
  const pm = createMockUser({ userId: 'MU-0001', isPrimaryMaster: true });
  const targetMaster = createMockUser({
    userId: 'MU-0002',
    isPrimaryMaster: false,
  });

  assert.doesNotThrow(() => assertMayActOnMasterTarget(pm, targetMaster));
});

// ─── Protected User Fields Tests ─────────────────────────────────────────────

test('rejectProtectedFields throws PROTECTED_USER_FIELD for role', () => {
  assert.throws(
    () => rejectProtectedFields({ role: 'OWNER' }),
    (err) => err.code === 'PROTECTED_USER_FIELD' && err.statusCode === 400
  );
});

test('rejectProtectedFields throws PROTECTED_USER_FIELD for isPrimaryMaster', () => {
  assert.throws(
    () => rejectProtectedFields({ isPrimaryMaster: true }),
    (err) => err.code === 'PROTECTED_USER_FIELD' && err.statusCode === 400
  );
});

test('rejectProtectedFields throws PROTECTED_USER_FIELD for passwordHash/password', () => {
  assert.throws(
    () => rejectProtectedFields({ passwordHash: 'newhash' }),
    (err) => err.code === 'PROTECTED_USER_FIELD' && err.statusCode === 400
  );
});

test('rejectProtectedFields throws PROTECTED_USER_FIELD for sessionVersion and permissionsVersion', () => {
  assert.throws(
    () => rejectProtectedFields({ sessionVersion: 5 }),
    (err) => err.code === 'PROTECTED_USER_FIELD' && err.statusCode === 400
  );
  assert.throws(
    () => rejectProtectedFields({ permissionsVersion: 5 }),
    (err) => err.code === 'PROTECTED_USER_FIELD' && err.statusCode === 400
  );
});

test('rejectProtectedFields allows non-protected fields like name, phone, preferredName', () => {
  assert.doesNotThrow(() =>
    rejectProtectedFields({ name: 'John', phone: '1234567890', preferredName: 'Johnny' })
  );
});

// ─── Role Governance Validation & Stale State Tests ──────────────────────────

test('validateProposedRole rejects invalid role', () => {
  assert.throws(
    () => validateProposedRole('SUPER_ADMIN'),
    (err) => err.code === 'INVALID_USER_ROLE' && err.statusCode === 422
  );
});

test('assertRoleIsNotNoOp rejects identical current and proposed role', () => {
  assert.throws(
    () => assertRoleIsNotNoOp('STAFF', 'STAFF'),
    (err) => err.code === 'ROLE_CHANGE_NO_OP' && err.statusCode === 422
  );
});

test('assertExpectedState throws 409 USER_GOVERNANCE_PREVIEW_STALE when role or versions do not match', () => {
  const target = createMockUser({
    role: 'STAFF',
    sessionVersion: 2,
    permissionsVersion: 3,
  });

  assert.throws(
    () =>
      assertExpectedState(target, {
        expectedCurrentRole: 'CAFE_ADMIN',
        expectedSessionVersion: 2,
        expectedPermissionsVersion: 3,
      }),
    (err) => err.code === 'USER_GOVERNANCE_PREVIEW_STALE' && err.statusCode === 409
  );

  assert.throws(
    () =>
      assertExpectedState(target, {
        expectedCurrentRole: 'STAFF',
        expectedSessionVersion: 1,
        expectedPermissionsVersion: 3,
      }),
    (err) => err.code === 'USER_GOVERNANCE_PREVIEW_STALE' && err.statusCode === 409
  );
});

// ─── Status & Cafe Governance Tests ─────────────────────────────────────────

test('assertStatusIsNotNoOp rejects identical status', () => {
  assert.throws(
    () => assertStatusIsNotNoOp('ACTIVE', 'ACTIVE'),
    (err) => err.code === 'USER_STATUS_NO_OP' && err.statusCode === 422
  );
});

test('assertCafeChangeIsNotNoOp rejects identical cafe assignment', () => {
  assert.throws(
    () =>
      assertCafeChangeIsNotNoOp(
        'CAFE-01',
        ['CAFE-01', 'CAFE-02'],
        'CAFE-01',
        ['CAFE-02', 'CAFE-01']
      ),
    (err) => err.code === 'CAFE_ASSIGNMENT_NO_OP' && err.statusCode === 422
  );
});

// ─── Role History & Cafe Assignment History Generation Tests ─────────────────

test('buildRoleHistoryEntry generates history entry correctly', () => {
  const req = createMockRequest();
  const entry = buildRoleHistoryEntry({
    fromRole: 'STAFF',
    toRole: 'CAFE_ADMIN',
    request: req,
    reason: 'Promoted to admin',
  });

  assert.equal(entry.fromRole, 'STAFF');
  assert.equal(entry.toRole, 'CAFE_ADMIN');
  assert.equal(entry.changedBy, 'MU-0001');
  assert.equal(entry.reason, 'Promoted to admin');
  assert.equal(entry.correlationId, 'test-correlation-id');
  assert.equal(entry.sessionId, 'SS-20260806-0001');
  assert.ok(entry.changedAt instanceof Date);
});

test('buildCafeAssignmentHistoryEntry generates cafe history entry correctly', () => {
  const req = createMockRequest();
  const entry = buildCafeAssignmentHistoryEntry({
    previousPrimaryCafeId: null,
    previousAssignedCafeIds: ['CAFE-01'],
    currentPrimaryCafeId: 'CAFE-01',
    currentAssignedCafeIds: ['CAFE-01', 'CAFE-02'],
    request: req,
    reason: 'Assigned additional cafe',
  });

  assert.equal(entry.previousPrimaryCafeId, null);
  assert.deepEqual(entry.previousAssignedCafeIds, ['CAFE-01']);
  assert.equal(entry.primaryCafeId, 'CAFE-01');
  assert.deepEqual(entry.assignedCafeIds, ['CAFE-01', 'CAFE-02']);
  assert.equal(entry.changedBy, 'MU-0001');
  assert.equal(entry.reason, 'Assigned additional cafe');
});

// ─── Controller Test Helper ───────────────────────────────────────────────────

function runController(controllerFn, req, res) {
  return new Promise((resolve, reject) => {
    const origJson = res.json;
    res.json = function (payload) {
      const result = origJson.call(this, payload);
      resolve(result);
      return result;
    };
    const next = (err) => {
      if (err) reject(err);
      else resolve();
    };
    try {
      controllerFn(req, res, next);
    } catch (err) {
      reject(err);
    }
  });
}

const auditService = require('../src/services/auditService');

// ─── Preview Role Change Controller Test ─────────────────────────────────────

test('previewRoleChange returns confirmationRequired true and preview details', async () => {
  const req = createMockRequest({
    params: { userId: 'ST-0001' },
    body: { proposedRole: 'CAFE_ADMIN' },
  });
  const res = createMockResponse();

  const pm = createMockUser({ isPrimaryMaster: true });
  const staffTarget = createMockUser({
    userId: 'ST-0001',
    role: 'STAFF',
    isPrimaryMaster: false,
  });

  const originalFindOne = User.findOne;
  const originalCountDocs = Session.countDocuments;
  const originalRecordAudit = auditService.recordRequestAudit;

  User.findOne = async (filter) => {
    if (filter.userId === 'MU-0001') return pm;
    if (filter.userId === 'ST-0001') return staffTarget;
    return null;
  };
  Session.countDocuments = async () => 0;
  auditService.recordRequestAudit = async () => {};

  try {
    await runController(previewRoleChange, req, res);
  } catch (err) {
    console.error('PREVIEW_TEST_ERROR:', err);
    throw err;
  } finally {
    User.findOne = originalFindOne;
    Session.countDocuments = originalCountDocs;
    auditService.recordRequestAudit = originalRecordAudit;
  }

  assert.equal(res.statusCode, 200);
  assert.equal(res.jsonPayload.success, true);
  assert.equal(res.jsonPayload.data.confirmationRequired, true);
  assert.equal(res.jsonPayload.data.currentRole, 'STAFF');
  assert.equal(res.jsonPayload.data.proposedRole, 'CAFE_ADMIN');
  assert.equal(res.jsonPayload.data.sessionsWillBeRevoked, true);
});

// ─── Execute Role Change Controller Test ─────────────────────────────────────

test('executeRoleChange requires confirmed: true', async () => {
  const req = createMockRequest({
    params: { userId: 'ST-0001' },
    body: { proposedRole: 'CAFE_ADMIN', confirmed: false },
  });
  const res = createMockResponse();

  const pm = createMockUser({ isPrimaryMaster: true });
  const staffTarget = createMockUser({
    userId: 'ST-0001',
    role: 'STAFF',
    isPrimaryMaster: false,
  });

  const originalFindOne = User.findOne;
  User.findOne = async (filter) => {
    if (filter.userId === 'MU-0001') return pm;
    if (filter.userId === 'ST-0001') return staffTarget;
    return null;
  };

  try {
    await assert.rejects(
      runController(executeRoleChange, req, res),
      (err) => err.code === 'ROLE_CHANGE_CONFIRMATION_REQUIRED' && err.statusCode === 400
    );
  } finally {
    User.findOne = originalFindOne;
  }
});

test('executeRoleChange executes valid confirmed role change, updates versions & appends history', async () => {
  const req = createMockRequest({
    params: { userId: 'ST-0001' },
    body: {
      proposedRole: 'CAFE_ADMIN',
      confirmed: true,
      reason: 'Promotion to store manager',
      expectedCurrentRole: 'STAFF',
      expectedSessionVersion: 1,
      expectedPermissionsVersion: 1,
    },
  });
  const res = createMockResponse();

  const pm = createMockUser({ isPrimaryMaster: true });
  const staffTarget = createMockUser({
    userId: 'ST-0001',
    role: 'STAFF',
    sessionVersion: 1,
    permissionsVersion: 1,
    isPrimaryMaster: false,
  });

  const originalFindOne = User.findOne;
  const originalSessionFind = Session.find;
  const originalRecordAudit = auditService.recordRequestAudit;

  let saved = false;
  staffTarget.save = async () => {
    saved = true;
    return staffTarget;
  };

  User.findOne = async (filter) => {
    if (filter.userId === 'MU-0001') return pm;
    if (filter.userId === 'ST-0001') return staffTarget;
    return null;
  };
  Session.find = () => ({
    select: async () => [],
  });
  auditService.recordRequestAudit = async () => {};

  try {
    await runController(executeRoleChange, req, res);
  } catch (err) {
    console.error('EXECUTE_TEST_ERROR:', err);
    throw err;
  } finally {
    User.findOne = originalFindOne;
    Session.find = originalSessionFind;
    auditService.recordRequestAudit = originalRecordAudit;
  }

  assert.equal(res.statusCode, 200);
  assert.equal(res.jsonPayload.success, true);
  assert.equal(saved, true);
  assert.equal(staffTarget.role, 'CAFE_ADMIN');
  assert.equal(staffTarget.sessionVersion, 2);
  assert.equal(staffTarget.permissionsVersion, 2);
  assert.equal(staffTarget.roleHistory.length, 1);
  assert.equal(staffTarget.roleHistory[0].fromRole, 'STAFF');
  assert.equal(staffTarget.roleHistory[0].toRole, 'CAFE_ADMIN');
  assert.equal(staffTarget.roleHistory[0].reason, 'Promotion to store manager');
});


