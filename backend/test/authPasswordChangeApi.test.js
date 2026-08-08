'use strict';

const assert = require('node:assert/strict');
const http = require('node:http');
const test = require('node:test');

const { createApp } = require('../src/server');
const { User } = require('../src/models/User');
const { Session } = require('../src/models/Session');
const authService = require('../src/services/authService');
const auditService = require('../src/services/auditService');

function makeSession(overrides = {}) {
  return {
    sessionId: 'SS-20260808-0001',
    organisationId: 'ORG-TEST',
    userId: 'MU-0001',
    roleSnapshot: 'MASTER',
    sessionVersion: 0,
    userSessionVersionSnapshot: 0,
    permissionsVersionSnapshot: 0,
    status: 'ACTIVE',
    mfaVerified: true,
    stepUpVerifiedAt: null,
    isActive: () => true,
    revoke: async () => null,
    ...overrides,
  };
}

function makeQueryMock(result) {
  const promise = Promise.resolve(result);
  promise.lean = async () => result;
  promise.select = async () => result;
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
          resolve({
            status: res.statusCode,
            body,
            headers: res.headers,
          });
        });
      }
    );
    req.on('error', reject);
    if (options.body) req.write(JSON.stringify(options.body));
    req.end();
  });
}

async function startServer(t) {
  const app = createApp({ allowedOrigins: ['*'], production: false });
  const server = await new Promise((resolve) => {
    const instance = app.listen(0, () => resolve(instance));
  });
  t.after(() => new Promise((resolve) => server.close(resolve)));
  return server;
}

async function makeUser(currentPassword, overrides = {}) {
  const user = new User({
    userId: 'MU-0001',
    organisationId: 'ORG-TEST',
    name: 'Test Master',
    email: 'master@example.test',
    role: 'MASTER',
    accountStatus: 'ACTIVE',
    primaryCafeId: null,
    assignedCafeIds: [],
    isPrimaryMaster: false,
    passwordHash: await authService.hashPassword(currentPassword),
    mustChangePassword: true,
    sessionVersion: 0,
    permissionsVersion: 0,
    createdBy: 'SYSTEM',
    ...overrides,
  });

  user.save = async () => user;
  return user;
}

function mockAuthenticatedRequest(t, user, session) {
  t.mock.method(authService, 'verifyAccessToken', async () => ({
    payload: {
      sub: user.userId,
      org: user.organisationId,
      role: user.role,
      sv: session.sessionVersion,
      usv: user.sessionVersion,
      pv: user.permissionsVersion,
      sid: session.sessionId,
    },
    session,
  }));

  t.mock.method(Session, 'findOne', async () => session);
  t.mock.method(User, 'findOne', () => makeQueryMock(user));
}

test('POST /api/v1/auth/password/change returns 401 when unauthenticated', async (t) => {
  const server = await startServer(t);
  const { status, body } = await request(
    server,
    '/api/v1/auth/password/change',
    {
      method: 'POST',
      body: {
        currentPassword: 'CurrentPass1!',
        newPassword: 'NewSecurePass2!',
      },
    }
  );

  assert.equal(status, 401);
  assert.equal(body.error?.code, 'AUTHENTICATION_REQUIRED');
});

test('POST /api/v1/auth/password/change rejects an incorrect current password', async (t) => {
  const user = await makeUser('CurrentPass1!');
  const session = makeSession();
  mockAuthenticatedRequest(t, user, session);

  const server = await startServer(t);
  const { status, body } = await request(
    server,
    '/api/v1/auth/password/change',
    {
      method: 'POST',
      token: 'mock-token',
      body: {
        currentPassword: 'WrongPass1!',
        newPassword: 'NewSecurePass2!',
      },
    }
  );

  assert.equal(status, 401);
  assert.equal(body.error?.code, 'INVALID_CURRENT_PASSWORD');
  assert.equal(user.mustChangePassword, true);
  assert.equal(user.sessionVersion, 0);
});

test('POST /api/v1/auth/password/change rejects reuse of the current password', async (t) => {
  const user = await makeUser('CurrentPass1!');
  const session = makeSession();
  mockAuthenticatedRequest(t, user, session);

  const server = await startServer(t);
  const { status, body } = await request(
    server,
    '/api/v1/auth/password/change',
    {
      method: 'POST',
      token: 'mock-token',
      body: {
        currentPassword: 'CurrentPass1!',
        newPassword: 'CurrentPass1!',
      },
    }
  );

  assert.equal(status, 400);
  assert.equal(body.error?.code, 'PASSWORD_REUSE_NOT_ALLOWED');
  assert.equal(user.mustChangePassword, true);
  assert.equal(user.sessionVersion, 0);
});

test('POST /api/v1/auth/password/change updates credentials, revokes sessions, audits, and requires fresh login', async (t) => {
  const user = await makeUser('CurrentPass1!');
  const session = makeSession();
  let revoked = 0;
  session.revoke = async () => {
    revoked += 1;
    return session;
  };

  mockAuthenticatedRequest(t, user, session);

  t.mock.method(Session, 'find', () => ({
    select: async () => [session],
  }));

  const auditCalls = [];
  t.mock.method(auditService, 'recordRequestAudit', async (payload) => {
    auditCalls.push(payload);
    return null;
  });

  const originalHash = user.passwordHash;
  const server = await startServer(t);
  const { status, body } = await request(
    server,
    '/api/v1/auth/password/change',
    {
      method: 'POST',
      token: 'mock-token',
      body: {
        currentPassword: 'CurrentPass1!',
        newPassword: 'NewSecurePass2!',
      },
    }
  );

  assert.equal(status, 200);
  assert.equal(body.success, true);
  assert.equal(body.data?.requiresLogin, true);
  assert.equal(body.data?.revokedSessionCount, 1);
  assert.equal(user.mustChangePassword, false);
  assert.equal(user.sessionVersion, 1);
  assert.equal(user.updatedBy, 'MU-0001');
  assert.ok(user.passwordChangedAt instanceof Date);
  assert.notEqual(user.passwordHash, originalHash);
  assert.equal(
    await authService.verifyPassword('NewSecurePass2!', user.passwordHash),
    true
  );
  assert.equal(revoked, 1);
  assert.equal(auditCalls.length, 1);
  assert.equal(auditCalls[0].module, 'AUTHENTICATION');
  assert.equal(auditCalls[0].action, 'PASSWORD_CHANGED');
  assert.equal(auditCalls[0].riskClassification, 'HIGH');
  assert.deepEqual(auditCalls[0].before, { mustChangePassword: true });
  assert.deepEqual(auditCalls[0].after, { mustChangePassword: false });
});
