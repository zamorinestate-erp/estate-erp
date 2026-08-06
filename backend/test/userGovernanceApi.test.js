'use strict';

const assert = require('node:assert/strict');
const http = require('node:http');
const test = require('node:test');

const { createApp } = require('../src/server');
const { User } = require('../src/models/User');
const { Session } = require('../src/models/Session');
const { RolePermission } = require('../src/models/RolePermission');
const authService = require('../src/services/authService');
const auditService = require('../src/services/auditService');

function makeUser(overrides = {}) {
  return new User({
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
}

function makeSession(overrides = {}) {
  return {
    sessionId: 'SS-20260806-0001',
    organisationId: 'ORG-TEST',
    userId: 'MU-0001',
    roleSnapshot: 'MASTER',
    sessionVersion: 0,
    userSessionVersionSnapshot: 1,
    permissionsVersionSnapshot: 1,
    status: 'ACTIVE',
    mfaVerified: true,
    stepUpVerifiedAt: new Date().toISOString(),
    isActive: () => true,
    ...overrides,
  };
}

function makePermissionRule(overrides = {}) {
  return new RolePermission({
    permissionRuleId: 'PR-0001',
    organisationId: 'ORG-TEST',
    role: 'MASTER',
    permissionCode: 'USER:MANAGE',
    module: 'USER',
    resource: 'USER',
    action: 'MANAGE',
    effect: 'ALLOW',
    scope: 'ORGANISATION',
    requiresMfa: true,
    requiresStepUpAuthentication: true,
    requiresReason: true,
    requiresAuditEvent: true,
    requiresReauthentication: false,
    policyVersion: 1,
    createdBy: 'SYSTEM',
    ...overrides,
  });
}

let server = null;
let baseUrl = '';

async function startApiServer() {
  const app = createApp({
    allowedOrigins: ['*'],
    production: false,
  });

  server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;
  baseUrl = `http://127.0.0.1:${port}/api/v1`;
}

async function stopApiServer() {
  if (server) {
    await new Promise((resolve) => server.close(resolve));
    server = null;
  }
}

test('HTTP API Server Setup & Teardown for User Governance', async (t) => {
  await startApiServer();

  t.after(async () => {
    await stopApiServer();
  });

  // 1. Unauthenticated request -> 401
  await t.test('Unauthenticated request to user route returns 401', async () => {
    const res = await fetch(`${baseUrl}/users`);
    assert.equal(res.status, 401);
    const data = await res.json();
    assert.equal(data.error.code, 'AUTHENTICATION_REQUIRED');
  });

  // 2. Non-MASTER actor request -> 403 ROLE_NOT_ALLOWED
  await t.test('Non-MASTER actor (OWNER) attempting user administration returns 403', async () => {
    const ownerUser = makeUser({
      userId: 'OW-0001',
      role: 'OWNER',
      isPrimaryMaster: false,
    });
    const ownerSession = makeSession({
      userId: 'OW-0001',
      roleSnapshot: 'OWNER',
    });

    const origVerifyAccess = authService.verifyAccessToken;
    const origUserFindOne = User.findOne;
    const origSessionFindOne = Session.findOne;

    authService.verifyAccessToken = async () => ({
      payload: {
        sub: 'OW-0001',
        org: 'ORG-TEST',
        role: 'OWNER',
        sv: 0,
        usv: 1,
        pv: 1,
        type: 'access',
      },
      session: ownerSession,
    });

    User.findOne = async (filter) => {
      if (filter.userId === 'OW-0001') return ownerUser;
      return null;
    };

    Session.findOne = async () => ownerSession;

    try {
      const res = await fetch(`${baseUrl}/users/ST-0001/role-impact`, {
        method: 'POST',
        headers: {
          Authorization: 'Bearer valid-owner-token',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ proposedRole: 'CAFE_ADMIN' }),
      });

      assert.equal(res.status, 403);
      const data = await res.json();
      assert.equal(data.error.code, 'ROLE_NOT_ALLOWED');
    } finally {
      authService.verifyAccessToken = origVerifyAccess;
      User.findOne = origUserFindOne;
      Session.findOne = origSessionFindOne;
    }
  });

  // Helper for authenticated MASTER requests
  function setupMasterAuthMocks({ targetUser, sessionOverrides = {} } = {}) {
    const pm = makeUser({ isPrimaryMaster: true });
    const masterSession = makeSession(sessionOverrides);

    const origVerifyAccess = authService.verifyAccessToken;
    const origUserFindOne = User.findOne;
    const origSessionFindOne = Session.findOne;
    const origRules = RolePermission.findEffectiveRules;
    const origAudit = auditService.recordRequestAudit;
    const origSessionCount = Session.countDocuments;
    const origSessionFind = Session.find;

    authService.verifyAccessToken = async () => ({
      payload: {
        sub: 'MU-0001',
        org: 'ORG-TEST',
        role: 'MASTER',
        sv: 0,
        usv: 1,
        pv: 1,
        type: 'access',
      },
      session: masterSession,
    });

    User.findOne = async (filter) => {
      if (filter.userId === 'MU-0001') return pm;
      if (targetUser && filter.userId === targetUser.userId) return targetUser;
      return null;
    };

    Session.findOne = async () => masterSession;
    Session.countDocuments = async () => 0;
    Session.find = () => ({ select: async () => [] });
    RolePermission.findEffectiveRules = async () => [makePermissionRule()];
    auditService.recordRequestAudit = async () => {};

    return () => {
      authService.verifyAccessToken = origVerifyAccess;
      User.findOne = origUserFindOne;
      Session.findOne = origSessionFindOne;
      RolePermission.findEffectiveRules = origRules;
      auditService.recordRequestAudit = origAudit;
      Session.countDocuments = origSessionCount;
      Session.find = origSessionFind;
    };
  }

  // 3. Missing recent step-up authentication -> 403 STEP_UP_AUTHENTICATION_REQUIRED
  await t.test('MASTER actor without recent step-up auth returns 403', async () => {
    const restore = setupMasterAuthMocks({
      sessionOverrides: { stepUpVerifiedAt: null },
    });

    try {
      const res = await fetch(`${baseUrl}/users/ST-0001/role-impact`, {
        method: 'POST',
        headers: {
          Authorization: 'Bearer valid-master-token',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ proposedRole: 'CAFE_ADMIN' }),
      });

      assert.equal(res.status, 403);
      const data = await res.json();
      assert.equal(data.error.code, 'STEP_UP_AUTHENTICATION_REQUIRED');
    } finally {
      restore();
    }
  });

  // 4. Role preview route success
  await t.test('POST /api/v1/users/:userId/role-impact returns 200 with preview payload', async () => {
    const staffTarget = makeUser({
      userId: 'ST-0001',
      role: 'STAFF',
      isPrimaryMaster: false,
    });
    const restore = setupMasterAuthMocks({ targetUser: staffTarget });

    try {
      const res = await fetch(`${baseUrl}/users/ST-0001/role-impact`, {
        method: 'POST',
        headers: {
          Authorization: 'Bearer valid-master-token',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ proposedRole: 'CAFE_ADMIN' }),
      });

      assert.equal(res.status, 200);
      const payload = await res.json();
      assert.equal(payload.success, true);
      assert.equal(payload.data.confirmationRequired, true);
      assert.equal(payload.data.currentRole, 'STAFF');
      assert.equal(payload.data.proposedRole, 'CAFE_ADMIN');
    } finally {
      restore();
    }
  });

  // 5. Role execution without confirmed true -> 400
  await t.test('PATCH /api/v1/users/:userId/role without confirmed: true returns 400', async () => {
    const staffTarget = makeUser({
      userId: 'ST-0001',
      role: 'STAFF',
      isPrimaryMaster: false,
    });
    const restore = setupMasterAuthMocks({ targetUser: staffTarget });

    try {
      const res = await fetch(`${baseUrl}/users/ST-0001/role`, {
        method: 'PATCH',
        headers: {
          Authorization: 'Bearer valid-master-token',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          proposedRole: 'CAFE_ADMIN',
          confirmed: false,
          reason: 'Promotion',
        }),
      });

      assert.equal(res.status, 400);
      const payload = await res.json();
      assert.equal(payload.error.code, 'ROLE_CHANGE_CONFIRMATION_REQUIRED');
    } finally {
      restore();
    }
  });

  // 6. Role execution without reason -> 400
  await t.test('PATCH /api/v1/users/:userId/role without reason returns 400', async () => {
    const staffTarget = makeUser({
      userId: 'ST-0001',
      role: 'STAFF',
      isPrimaryMaster: false,
    });
    const restore = setupMasterAuthMocks({ targetUser: staffTarget });

    try {
      const res = await fetch(`${baseUrl}/users/ST-0001/role`, {
        method: 'PATCH',
        headers: {
          Authorization: 'Bearer valid-master-token',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          proposedRole: 'CAFE_ADMIN',
          confirmed: true,
          reason: '',
        }),
      });

      assert.equal(res.status, 400);
      const payload = await res.json();
      assert.equal(payload.error.code, 'REASON_REQUIRED');
    } finally {
      restore();
    }
  });

  // 7. Role execution with stale expected state -> 409
  await t.test('PATCH /api/v1/users/:userId/role with stale expectedRole returns 409', async () => {
    const staffTarget = makeUser({
      userId: 'ST-0001',
      role: 'STAFF',
      isPrimaryMaster: false,
    });
    const restore = setupMasterAuthMocks({ targetUser: staffTarget });

    try {
      const res = await fetch(`${baseUrl}/users/ST-0001/role`, {
        method: 'PATCH',
        headers: {
          Authorization: 'Bearer valid-master-token',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          proposedRole: 'CAFE_ADMIN',
          confirmed: true,
          reason: 'Promotion to Admin',
          expectedCurrentRole: 'OWNER', // stale!
        }),
      });

      assert.equal(res.status, 409);
      const payload = await res.json();
      assert.equal(payload.error.code, 'USER_GOVERNANCE_PREVIEW_STALE');
    } finally {
      restore();
    }
  });

  // 8. Protected Primary Master operation -> 403 PRIMARY_MASTER_PROTECTED
  await t.test('Attempting role change on Primary Master target returns 403', async () => {
    const pmTarget = makeUser({
      userId: 'MU-0001',
      role: 'MASTER',
      isPrimaryMaster: true,
    });
    const restore = setupMasterAuthMocks({ targetUser: pmTarget });

    try {
      const res = await fetch(`${baseUrl}/users/MU-0001/role-impact`, {
        method: 'POST',
        headers: {
          Authorization: 'Bearer valid-master-token',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ proposedRole: 'OWNER' }),
      });

      assert.equal(res.status, 403);
      const payload = await res.json();
      assert.equal(payload.error.code, 'PRIMARY_MASTER_PROTECTED');
    } finally {
      restore();
    }
  });

  // 9. Protected field rejection on general profile update -> 400
  await t.test('PATCH /api/v1/users/:userId with protected field returns 400', async () => {
    const staffTarget = makeUser({
      userId: 'ST-0001',
      role: 'STAFF',
      isPrimaryMaster: false,
    });
    const restore = setupMasterAuthMocks({ targetUser: staffTarget });

    try {
      const res = await fetch(`${baseUrl}/users/ST-0001`, {
        method: 'PATCH',
        headers: {
          Authorization: 'Bearer valid-master-token',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: 'Updated Name',
          role: 'MASTER', // protected!
          reason: 'Attempting illegal role update via general update',
        }),
      });

      assert.equal(res.status, 400);
      const payload = await res.json();
      assert.equal(payload.error.code, 'PROTECTED_USER_FIELD');
    } finally {
      restore();
    }
  });

  // 10. Successful role execution -> 200
  await t.test('PATCH /api/v1/users/:userId/role with valid data executes successfully', async () => {
    const staffTarget = makeUser({
      userId: 'ST-0001',
      role: 'STAFF',
      sessionVersion: 1,
      permissionsVersion: 1,
      isPrimaryMaster: false,
    });

    staffTarget.save = async () => staffTarget;

    const restore = setupMasterAuthMocks({ targetUser: staffTarget });

    try {
      const res = await fetch(`${baseUrl}/users/ST-0001/role`, {
        method: 'PATCH',
        headers: {
          Authorization: 'Bearer valid-master-token',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          proposedRole: 'CAFE_ADMIN',
          confirmed: true,
          reason: 'Promotion to store manager',
          expectedCurrentRole: 'STAFF',
          expectedSessionVersion: 1,
          expectedPermissionsVersion: 1,
        }),
      });

      assert.equal(res.status, 200);
      const payload = await res.json();
      assert.equal(payload.success, true);
      assert.equal(payload.data.toRole, 'CAFE_ADMIN');
      assert.equal(staffTarget.role, 'CAFE_ADMIN');
      assert.equal(staffTarget.roleHistory.length, 1);
    } finally {
      restore();
    }
  });
});
