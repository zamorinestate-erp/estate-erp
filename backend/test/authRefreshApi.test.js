'use strict';

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const http = require('node:http');
const test = require('node:test');

const { createApp } = require('../src/server');
const { Session } = require('../src/models/Session');
const { User } = require('../src/models/User');

const JWT_SECRET =
  '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';

function hashToken(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function query(result) {
  const promise = Promise.resolve(result);
  promise.select = async () => result;
  return promise;
}

function request(server, body, headers = {}) {
  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        method: 'POST',
        hostname: '127.0.0.1',
        port: server.address().port,
        path: '/api/v1/auth/refresh',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          ...headers,
        },
      },
      (res) => {
        let raw = '';
        res.on('data', (chunk) => { raw += chunk; });
        res.on('end', () => {
          resolve({
            status: res.statusCode,
            body: JSON.parse(raw),
            headers: res.headers,
          });
        });
      }
    );
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
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

function makeUser() {
  const user = new User({
    userId: 'MU-0001',
    organisationId: 'ORG-TEST',
    name: 'Test Master',
    email: 'master@example.test',
    role: 'MASTER',
    accountStatus: 'ACTIVE',
    assignedCafeIds: [],
    isPrimaryMaster: false,
    passwordHash: 'unused',
    sessionVersion: 0,
    permissionsVersion: 0,
    mfaEnabled: true,
    mfaMethod: 'TOTP',
    createdBy: 'SYSTEM',
  });
  return user;
}

function makeSession(refreshToken, overrides = {}) {
  const session = {
    sessionId: 'SS-20260808-0200',
    organisationId: 'ORG-TEST',
    userId: 'MU-0001',
    roleSnapshot: 'MASTER',
    assignedCafeIdsSnapshot: [],
    refreshTokenHash: hashToken(refreshToken),
    previousRefreshTokenHashes: [],
    sessionVersion: 0,
    userSessionVersionSnapshot: 0,
    permissionsVersionSnapshot: 0,
    status: 'ACTIVE',
    device: { deviceId: 'DEV-REFRESH-1' },
    absoluteExpiresAt: new Date(Date.now() + 60 * 60 * 1000),
    isActive() { return this.status === 'ACTIVE'; },
    async save() { return this; },
    async markCompromised({ details }) {
      this.status = 'COMPROMISED';
      this.compromiseDetails = details;
      return this;
    },
    async revoke({ reason }) {
      this.status = 'REVOKED';
      this.revocationReason = reason;
      return this;
    },
    toJSON() {
      return {
        sessionId: this.sessionId,
        status: this.status,
        sessionVersion: this.sessionVersion,
      };
    },
    ...overrides,
  };
  return session;
}

test.beforeEach(() => {
  process.env.JWT_ACCESS_SECRET = JWT_SECRET;
});

test('POST /auth/refresh requires session ID, refresh token, and device ID', async (t) => {
  const server = await startServer(t);
  const response = await request(server, {});
  assert.equal(response.status, 401);
  assert.equal(response.body.error?.code, 'REFRESH_SESSION_REQUIRED');
});

test('POST /auth/refresh rotates a valid device-bound refresh token', async (t) => {
  const currentRefreshToken = 'refresh-token-current';
  const user = makeUser();
  const session = makeSession(currentRefreshToken);

  t.mock.method(Session, 'findOne', () => query(session));
  t.mock.method(User, 'findOne', () => query(user));

  const server = await startServer(t);
  const response = await request(
    server,
    {
      sessionId: session.sessionId,
      refreshToken: currentRefreshToken,
      deviceId: session.device.deviceId,
    }
  );

  assert.equal(response.status, 200);
  assert.equal(response.body.success, true);
  assert.equal(response.body.data.session.sessionId, session.sessionId);
  assert.equal(session.sessionVersion, 1);
  assert.deepEqual(session.previousRefreshTokenHashes, [hashToken(currentRefreshToken)]);
  assert.notEqual(session.refreshTokenHash, hashToken(currentRefreshToken));
  assert.ok(Array.isArray(response.headers['set-cookie']));
});

test('POST /auth/refresh detects reuse of a previously rotated refresh token', async (t) => {
  const reusedToken = 'refresh-token-reused';
  const session = makeSession('refresh-token-current', {
    previousRefreshTokenHashes: [hashToken(reusedToken)],
  });

  t.mock.method(Session, 'findOne', () => query(session));

  const server = await startServer(t);
  const response = await request(
    server,
    {
      sessionId: session.sessionId,
      refreshToken: reusedToken,
      deviceId: session.device.deviceId,
    }
  );

  assert.equal(response.status, 401);
  assert.equal(response.body.error?.code, 'INVALID_REFRESH_SESSION');
  assert.equal(session.status, 'COMPROMISED');
  assert.match(session.compromiseDetails, /previously rotated refresh token/i);
});
