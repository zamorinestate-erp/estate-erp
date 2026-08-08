'use strict';

const assert = require('node:assert/strict');
const http = require('node:http');
const test = require('node:test');

const { createApp } = require('../src/server');
const { User } = require('../src/models/User');
const { Session } = require('../src/models/Session');
const authService = require('../src/services/authService');

const SAFE_USER_KEYS = [
  'accountStatus',
  'assignedCafeIds',
  'isPrimaryMaster',
  'mfaEnabled',
  'mfaMethod',
  'mustChangePassword',
  'name',
  'organisationId',
  'preferredLanguage',
  'preferredName',
  'primaryCafeId',
  'role',
  'userId',
].sort();

const SAFE_AUTH_KEYS = [
  'assignedCafeIds',
  'mfaVerified',
  'organisationId',
  'primaryCafeId',
  'role',
  'sessionId',
  'userId',
].sort();

const FORBIDDEN_KEYS = [
  'passwordHash',
  'passwordHistoryHashes',
  'mfaSecretEncrypted',
  'pendingMfaSecretEncrypted',
  'recoveryCodeHashes',
  'employeeSearchTerms',
  'failedLoginAttempts',
  'lockedUntil',
  'lastLoginAt',
  'lastPasswordResetAt',
  'sessionVersion',
  'permissionsVersion',
  'roleHistory',
  'cafeAssignmentHistory',
  'mfaVerifiedAt',
  'stepUpVerifiedAt',
];

function makeUser(overrides = {}) {
  return new User({
    userId: 'MU-0001',
    organisationId: 'ORG-TEST',
    name: 'Bootstrap User',
    preferredName: 'Preferred',
    email: 'bootstrap@example.com',
    role: 'MASTER',
    accountStatus: 'ACTIVE',
    primaryCafeId: null,
    assignedCafeIds: [],
    isPrimaryMaster: true,
    passwordHash: 'MUST_NOT_BE_EXPOSED',
    mustChangePassword: false,
    mfaEnabled: true,
    mfaMethod: 'TOTP',
    failedLoginAttempts: 7,
    sessionVersion: 9,
    permissionsVersion: 11,
    preferredLanguage: 'en',
    createdBy: 'SYSTEM',
    ...overrides,
  });
}

function makeSession(overrides = {}) {
  return {
    sessionId: 'SS-20260807-0001',
    organisationId: 'ORG-TEST',
    userId: 'MU-0001',
    roleSnapshot: 'MASTER',
    sessionVersion: 0,
    userSessionVersionSnapshot: 9,
    permissionsVersionSnapshot: 11,
    status: 'ACTIVE',
    mfaVerified: true,
    mfaVerifiedAt: new Date('2026-08-07T10:00:00.000Z'),
    stepUpVerifiedAt: new Date('2026-08-07T10:05:00.000Z'),
    isActive: () => true,
    ...overrides,
  };
}

function makeQueryMock(result) {
  const promise = Promise.resolve(result);
  promise.lean = async () => result;
  return promise;
}

function request(server, path, token) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, `http://127.0.0.1:${server.address().port}`);
    const req = http.request(
      {
        method: 'GET',
        hostname: url.hostname,
        port: url.port,
        path: url.pathname + url.search,
        headers: {
          Accept: 'application/json',
          Authorization: `Bearer ${token}`,
        },
      },
      (res) => {
        let raw = '';
        res.on('data', (chunk) => { raw += chunk; });
        res.on('end', () => {
          let body;
          try {
            body = JSON.parse(raw);
          } catch {
            body = raw;
          }
          resolve({ status: res.statusCode, body });
        });
      }
    );
    req.on('error', reject);
    req.end();
  });
}

function registerRoleContractTest({
  role,
  userId,
  assignedCafeIds = [],
  primaryCafeId = null,
  isPrimaryMaster = false,
  mfaVerified = true,
}) {
  test(`GET /api/v1/auth/me exposes only the safe bootstrap contract for ${role}`, async (t) => {
    const user = makeUser({
      userId,
      role,
      assignedCafeIds,
      primaryCafeId,
      isPrimaryMaster,
      mfaEnabled: role !== 'STAFF',
      mfaMethod: role !== 'STAFF' ? 'TOTP' : 'NONE',
    });

    const session = makeSession({
      userId,
      roleSnapshot: role,
      mfaVerified,
    });

    t.mock.method(authService, 'verifyAccessToken', async () => ({
      payload: {
        sub: userId,
        org: 'ORG-TEST',
        role,
        sv: 0,
        usv: 9,
        pv: 11,
        sid: 'SS-20260807-0001',
      },
      session,
    }));
    t.mock.method(Session, 'findOne', async () => session);
    t.mock.method(User, 'findOne', () => makeQueryMock(user));

    const app = createApp({
      allowedOrigins: ['*'],
      production: false,
    });
    const server = await new Promise((resolve) => {
      const instance = app.listen(0, () => resolve(instance));
    });
    t.after(() => new Promise((resolve) => server.close(resolve)));

    const { status, body } = await request(
      server,
      '/api/v1/auth/me',
      'mock-token'
    );

    assert.equal(status, 200);
    assert.equal(body.success, true);
    assert.deepEqual(
      Object.keys(body.data.user).sort(),
      SAFE_USER_KEYS
    );
    assert.deepEqual(
      Object.keys(body.data.authentication).sort(),
      SAFE_AUTH_KEYS
    );

    assert.equal(body.data.user.userId, userId);
    assert.equal(body.data.user.role, role);
    assert.equal(body.data.user.organisationId, 'ORG-TEST');
    assert.deepEqual(
      body.data.user.assignedCafeIds,
      assignedCafeIds
    );
    assert.equal(
      body.data.user.primaryCafeId,
      primaryCafeId
    );
    assert.equal(
      body.data.user.isPrimaryMaster,
      isPrimaryMaster
    );

    assert.equal(body.data.authentication.userId, userId);
    assert.equal(body.data.authentication.role, role);
    assert.deepEqual(
      body.data.authentication.assignedCafeIds,
      assignedCafeIds
    );
    assert.equal(
      body.data.authentication.primaryCafeId,
      primaryCafeId
    );
    assert.equal(
      body.data.authentication.mfaVerified,
      mfaVerified
    );

    const serialized = JSON.stringify(body.data);
    for (const key of FORBIDDEN_KEYS) {
      assert.equal(
        serialized.includes(`"${key}"`),
        false,
        `${key} must not be exposed by /auth/me`
      );
    }
  });
}

registerRoleContractTest({
  role: 'MASTER',
  userId: 'MU-0001',
  isPrimaryMaster: true,
});

registerRoleContractTest({
  role: 'OWNER',
  userId: 'OW-0001',
});

registerRoleContractTest({
  role: 'CAFE_ADMIN',
  userId: 'AD-0001',
  assignedCafeIds: ['CF-0001'],
  primaryCafeId: 'CF-0001',
});

registerRoleContractTest({
  role: 'STAFF',
  userId: 'ST-0001',
  assignedCafeIds: ['CF-0001'],
  primaryCafeId: 'CF-0001',
  mfaVerified: false,
});
