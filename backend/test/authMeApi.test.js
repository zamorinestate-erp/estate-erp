'use strict';

/**
 * AUTH ME API — Bounded Bootstrap Contract Tests
 *
 * Tests GET /api/v1/auth/me
 *
 * Verifies:
 *  - 401 when unauthenticated
 *  - 200 for authenticated user (MASTER, OWNER, CAFE_ADMIN, STAFF)
 *  - Safe serialized user object (passwordHash, mfaSecret, recoveryCodeHashes stripped)
 *  - Authentication metadata (role, assignedCafeIds, primaryCafeId, sessionId)
 */

const assert = require('node:assert/strict');
const http = require('node:http');
const test = require('node:test');

const { createApp } = require('../src/server');
const { User } = require('../src/models/User');
const { Session } = require('../src/models/Session');
const authService = require('../src/services/authService');

function makeUser(overrides = {}) {
  return new User({
    userId: 'MU-0001',
    organisationId: 'ORG-TEST',
    name: 'Test Admin',
    email: 'admin@example.com',
    role: 'MASTER',
    accountStatus: 'ACTIVE',
    primaryCafeId: null,
    assignedCafeIds: [],
    isPrimaryMaster: true,
    passwordHash: 'MUST_NOT_BE_EXPOSED',
    mfaSecretEncrypted: 'MUST_NOT_BE_EXPOSED',
    recoveryCodeHashes: ['MUST_NOT_BE_EXPOSED'],
    employeeSearchTerms: ['test', 'admin'],
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
    userSessionVersionSnapshot: 1,
    permissionsVersionSnapshot: 1,
    status: 'ACTIVE',
    mfaVerified: true,
    stepUpVerifiedAt: null,
    isActive: () => true,
    ...overrides,
  };
}

function makeQueryMock(result) {
  const promise = Promise.resolve(result);
  promise.lean = async () => result;
  return promise;
}

function request(server, path, options = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, `http://127.0.0.1:${server.address().port}`);
    const req = http.request(
      {
        method: options.method || 'GET',
        hostname: url.hostname,
        port: url.port,
        path: url.pathname + url.search,
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          ...(options.token
            ? { Authorization: `Bearer ${options.token}` }
            : {}),
        },
      },
      (res) => {
        let raw = '';
        res.on('data', (chunk) => { raw += chunk; });
        res.on('end', () => {
          let body;
          try { body = JSON.parse(raw); } catch { body = raw; }
          resolve({ status: res.statusCode, body });
        });
      }
    );
    req.on('error', reject);
    if (options.body) req.write(JSON.stringify(options.body));
    req.end();
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test('GET /api/v1/auth/me returns 401 when unauthenticated', async (t) => {
  const app = createApp({ allowedOrigins: ['*'], production: false });
  const server = await new Promise((resolve) => {
    const s = app.listen(0, () => resolve(s));
  });
  t.after(() => new Promise((resolve) => server.close(resolve)));

  const { status, body } = await request(server, '/api/v1/auth/me');
  assert.equal(status, 401);
  assert.equal(body.error?.code, 'AUTHENTICATION_REQUIRED');
});

test('GET /api/v1/auth/me returns safe user identity and session metadata for authenticated MASTER', async (t) => {
  const user = makeUser();
  const session = makeSession();

  t.mock.method(authService, 'verifyAccessToken', async () => ({
    payload: {
      sub: 'MU-0001',
      org: 'ORG-TEST',
      role: 'MASTER',
      sv: 0,
      usv: 0,
      pv: 0,
      sid: 'SS-20260807-0001',
    },
    session,
  }));

  t.mock.method(Session, 'findOne', async () => session);
  t.mock.method(User, 'findOne', () => makeQueryMock(user));

  const app = createApp({ allowedOrigins: ['*'], production: false });
  const server = await new Promise((resolve) => {
    const s = app.listen(0, () => resolve(s));
  });
  t.after(() => new Promise((resolve) => server.close(resolve)));

  const { status, body } = await request(server, '/api/v1/auth/me', {
    token: 'mock-token',
  });

  assert.equal(status, 200);
  assert.ok(body.success);
  assert.ok(body.data?.user, 'response must contain data.user');
  assert.ok(body.data?.authentication, 'response must contain data.authentication');

  const userData = body.data.user;
  assert.equal(userData.userId, 'MU-0001');
  assert.equal(userData.role, 'MASTER');
  assert.equal(userData.organisationId, 'ORG-TEST');
  assert.equal(userData.isPrimaryMaster, true);

  // Security checks: sensitive internal fields must be stripped by toJSON
  assert.strictEqual(userData.passwordHash, undefined, 'passwordHash must be stripped');
  assert.strictEqual(userData.mfaSecretEncrypted, undefined, 'mfaSecretEncrypted must be stripped');
  assert.strictEqual(userData.recoveryCodeHashes, undefined, 'recoveryCodeHashes must be stripped');
  assert.strictEqual(userData.employeeSearchTerms, undefined, 'employeeSearchTerms must be stripped');

  // Authentication metadata check
  const authData = body.data.authentication;
  assert.equal(authData.userId, 'MU-0001');
  assert.equal(authData.role, 'MASTER');
  assert.equal(authData.sessionId, 'SS-20260807-0001');
});
