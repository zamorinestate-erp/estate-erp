'use strict';

const assert = require('node:assert/strict');
const http = require('node:http');
const test = require('node:test');

const { createApp } = require('../src/server');
const { User } = require('../src/models/User');
const { Session } = require('../src/models/Session');
const authService = require('../src/services/authService');
const auditService = require('../src/services/auditService');
const mfaService = require('../src/services/mfaService');

const TEST_MFA_KEY =
  '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
const TEST_TOTP_SECRET = 'JBSWY3DPEHPK3PXP';

function makeSession(overrides = {}) {
  const session = {
    sessionId: 'SS-20260808-0002',
    organisationId: 'ORG-TEST',
    userId: 'MU-0001',
    roleSnapshot: 'MASTER',
    sessionVersion: 0,
    userSessionVersionSnapshot: 0,
    permissionsVersionSnapshot: 0,
    status: 'ACTIVE',
    mfaVerified: true,
    mfaVerifiedAt: new Date(),
    stepUpVerifiedAt: null,
    isActive: () => true,
    save: async () => session,
    ...overrides,
  };

  session.markStepUpVerified = async () => {
    if (!session.isActive()) {
      throw new Error('The session is not active.');
    }
    session.stepUpVerifiedAt = new Date();
    await session.save();
    return session;
  };

  return session;
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
  const app = createApp({
    allowedOrigins: ['*'],
    production: false,
  });

  const server = await new Promise((resolve) => {
    const instance = app.listen(0, () => resolve(instance));
  });

  t.after(() => new Promise((resolve) => server.close(resolve)));
  return server;
}

function makeUser(overrides = {}) {
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
    passwordHash: 'unused-password-hash',
    mustChangePassword: false,
    sessionVersion: 0,
    permissionsVersion: 0,
    mfaEnabled: true,
    mfaMethod: 'TOTP',
    mfaSecretEncrypted: mfaService.encryptMfaSecret(TEST_TOTP_SECRET),
    recoveryCodeHashes: [],
    lastMfaCounter: null,
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
      type: 'access',
    },
    session,
  }));

  t.mock.method(Session, 'findOne', async () => session);
  t.mock.method(User, 'findOne', () => makeQueryMock(user));
}

function mockAudit(t) {
  const calls = [];
  t.mock.method(auditService, 'recordRequestAudit', async (payload) => {
    calls.push(payload);
    return null;
  });
  return calls;
}

test.beforeEach(() => {
  process.env.MFA_ENCRYPTION_KEY = TEST_MFA_KEY;
});

test('POST /api/v1/auth/step-up returns 401 when unauthenticated', async (t) => {
  const server = await startServer(t);

  const { status, body } = await request(
    server,
    '/api/v1/auth/step-up',
    {
      method: 'POST',
      body: { code: '123456' },
    }
  );

  assert.equal(status, 401);
  assert.equal(body.error?.code, 'AUTHENTICATION_REQUIRED');
});

test('POST /api/v1/auth/step-up requires an MFA-verified session', async (t) => {
  const user = makeUser();
  const session = makeSession({ mfaVerified: false });
  mockAuthenticatedRequest(t, user, session);

  const server = await startServer(t);
  const { status, body } = await request(
    server,
    '/api/v1/auth/step-up',
    {
      method: 'POST',
      token: 'mock-token',
      body: { code: '123456' },
    }
  );

  assert.equal(status, 403);
  assert.equal(body.error?.code, 'MFA_REQUIRED');
  assert.equal(session.stepUpVerifiedAt, null);
});

test('POST /api/v1/auth/step-up requires a TOTP or recovery code', async (t) => {
  const user = makeUser();
  const session = makeSession();
  mockAuthenticatedRequest(t, user, session);

  const server = await startServer(t);
  const { status, body } = await request(
    server,
    '/api/v1/auth/step-up',
    {
      method: 'POST',
      token: 'mock-token',
      body: {},
    }
  );

  assert.equal(status, 400);
  assert.equal(body.error?.code, 'STEP_UP_FIELDS_REQUIRED');
  assert.equal(session.stepUpVerifiedAt, null);
});

test('POST /api/v1/auth/step-up rejects an invalid TOTP code', async (t) => {
  const user = makeUser();
  const session = makeSession();
  mockAuthenticatedRequest(t, user, session);

  const server = await startServer(t);
  const { status, body } = await request(
    server,
    '/api/v1/auth/step-up',
    {
      method: 'POST',
      token: 'mock-token',
      body: { code: '000000' },
    }
  );

  assert.equal(status, 400);
  assert.equal(body.error?.code, 'INVALID_MFA_CODE');
  assert.equal(user.lastMfaCounter, null);
  assert.equal(session.stepUpVerifiedAt, null);
});

test('POST /api/v1/auth/step-up rejects a reused TOTP counter', async (t) => {
  const { code, counter } = mfaService.generateTotpCode(TEST_TOTP_SECRET);
  const user = makeUser({ lastMfaCounter: counter });
  const session = makeSession();
  mockAuthenticatedRequest(t, user, session);

  const server = await startServer(t);
  const { status, body } = await request(
    server,
    '/api/v1/auth/step-up',
    {
      method: 'POST',
      token: 'mock-token',
      body: { code },
    }
  );

  assert.equal(status, 400);
  assert.equal(body.error?.code, 'MFA_CODE_REUSED');
  assert.equal(user.lastMfaCounter, counter);
  assert.equal(session.stepUpVerifiedAt, null);
});

test('POST /api/v1/auth/step-up rejects an invalid recovery code', async (t) => {
  const user = makeUser({
    recoveryCodeHashes: [
      mfaService.hashRecoveryCode('ABCDEF-123456'),
    ],
  });
  const session = makeSession();
  mockAuthenticatedRequest(t, user, session);

  const server = await startServer(t);
  const { status, body } = await request(
    server,
    '/api/v1/auth/step-up',
    {
      method: 'POST',
      token: 'mock-token',
      body: { recoveryCode: 'WRONG1-CODE22' },
    }
  );

  assert.equal(status, 400);
  assert.equal(body.error?.code, 'INVALID_RECOVERY_CODE');
  assert.equal(user.recoveryCodeHashes.length, 1);
  assert.equal(session.stepUpVerifiedAt, null);
});

test('POST /api/v1/auth/step-up verifies fresh TOTP, persists counter, stamps session, and audits', async (t) => {
  const { code, counter } = mfaService.generateTotpCode(TEST_TOTP_SECRET);
  const user = makeUser();
  const session = makeSession();
  mockAuthenticatedRequest(t, user, session);
  const auditCalls = mockAudit(t);

  const server = await startServer(t);
  const { status, body } = await request(
    server,
    '/api/v1/auth/step-up',
    {
      method: 'POST',
      token: 'mock-token',
      body: { code },
    }
  );

  assert.equal(status, 200);
  assert.equal(body.success, true);
  assert.equal(user.lastMfaCounter, counter);
  assert.ok(session.stepUpVerifiedAt instanceof Date);
  assert.ok(body.data?.stepUpVerifiedAt);
  assert.equal(auditCalls.length, 1);
  assert.equal(auditCalls[0].module, 'AUTHENTICATION');
  assert.equal(auditCalls[0].action, 'STEP_UP_VERIFIED');
  assert.equal(auditCalls[0].riskClassification, 'HIGH');
  assert.equal(auditCalls[0].metadata?.verificationMethod, 'TOTP');
});

test('POST /api/v1/auth/step-up consumes a valid recovery code once, stamps session, and audits', async (t) => {
  const recoveryCode = 'ABCDEF-123456';
  const recoveryHash = mfaService.hashRecoveryCode(recoveryCode);
  const user = makeUser({
    recoveryCodeHashes: [recoveryHash],
  });
  const session = makeSession();
  mockAuthenticatedRequest(t, user, session);
  const auditCalls = mockAudit(t);

  const server = await startServer(t);
  const { status, body } = await request(
    server,
    '/api/v1/auth/step-up',
    {
      method: 'POST',
      token: 'mock-token',
      body: { recoveryCode },
    }
  );

  assert.equal(status, 200);
  assert.equal(body.success, true);
  assert.equal(user.recoveryCodeHashes.length, 0);
  assert.ok(session.stepUpVerifiedAt instanceof Date);
  assert.ok(body.data?.stepUpVerifiedAt);
  assert.equal(auditCalls.length, 1);
  assert.equal(auditCalls[0].metadata?.verificationMethod, 'RECOVERY_CODE');
});
