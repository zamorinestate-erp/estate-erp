'use strict';

const assert = require('node:assert/strict');
const http = require('node:http');
const test = require('node:test');
const { User } = require('../src/models/User');
const { Session } = require('../src/models/Session');
const { SequenceCounter } = require('../src/models/SequenceCounter');
const authService = require('../src/services/authService');
const mfaService = require('../src/services/mfaService');

const TEST_ORG_ID = 'ORG-TEST-0001';
const TEST_JWT_SECRET = 'test-jwt-access-secret-12345678901234567890';
const TEST_MFA_KEY = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
const TEST_TOTP_SECRET = 'JBSWY3DPEHPK3PXP';

function mockMongooseQuery(result) {
  return {
    select() { return this; },
    populate() { return this; },
    lean() { return Promise.resolve(result); },
    then(resolve, reject) { return Promise.resolve(result).then(resolve, reject); },
    catch(reject) { return Promise.resolve(result).catch(reject); },
  };
}

async function startServer(t) {
  const express = require('express');
  const cookieParser = require('cookie-parser');
  const authRoutes = require('../src/routes/authRoutes');

  const app = express();
  app.use(express.json());
  app.use(cookieParser());
  app.use('/api/v1/auth', authRoutes);

  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));
  t.after(() => server.close());
  return server;
}

function request(server, path, payload = {}) {
  const port = server.address().port;
  return new Promise((resolve, reject) => {
    const req = http.request(
      `http://127.0.0.1:${port}${path}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-device-id': 'DEV-SEC-TEST',
        },
      },
      (res) => {
        let body = '';
        res.on('data', (c) => (body += c));
        res.on('end', () => {
          try {
            resolve({
              status: res.statusCode,
              headers: res.headers,
              body: body ? JSON.parse(body) : {},
            });
          } catch (e) {
            reject(e);
          }
        });
      }
    );
    req.on('error', reject);
    req.write(JSON.stringify(payload));
    req.end();
  });
}

test.beforeEach(() => {
  process.env.JWT_ACCESS_SECRET = TEST_JWT_SECRET;
  process.env.MFA_ENCRYPTION_KEY = TEST_MFA_KEY;
  process.env.NODE_ENV = 'production';
});

test('POST /auth/login sets HttpOnly cookies and omits refreshToken from response JSON payload', async (t) => {
  const passwordHash = await authService.hashPassword('SuperSecret123!');
  const user = {
    organisationId: TEST_ORG_ID,
    userId: 'ST-0001',
    email: 'staff@zamorin.test',
    passwordHash,
    role: 'STAFF',
    accountStatus: 'ACTIVE',
    archivedAt: null,
    mfaEnabled: false,
    mustChangePassword: false,
    sessionVersion: 0,
    permissionsVersion: 0,
    failedLoginAttempts: 0,
    lockedUntil: null,
    save: async () => user,
    toJSON: () => ({ userId: 'ST-0001', role: 'STAFF' }),
  };

  t.mock.method(User, 'findOne', () => mockMongooseQuery(user));
  t.mock.method(SequenceCounter, 'generateId', async () => 'SS-20260829-0001');
  t.mock.method(Session, 'create', async (data) => ({
    ...data,
    sessionId: 'SS-20260829-0001',
    isActive: () => true,
    toJSON: () => ({ sessionId: 'SS-20260829-0001' }),
  }));

  const server = await startServer(t);
  const response = await request(server, '/api/v1/auth/login', {
    organisationId: TEST_ORG_ID,
    email: 'staff@zamorin.test',
    password: 'SuperSecret123!',
    device: { deviceId: 'DEV-SEC-TEST' },
  });

  assert.equal(response.status, 200);
  assert.equal(response.body.success, true);

  // Security Check 1: refreshToken must NOT be exposed in data JSON
  assert.equal(response.body.data?.refreshToken, undefined, 'refreshToken must not be in response JSON');
  assert.ok(response.body.data?.accessToken, 'accessToken is provided for API client');

  // Security Check 2: HttpOnly cookies must be set
  const setCookie = response.headers['set-cookie'] || [];
  assert.ok(setCookie.some((c) => c.includes('zamorin_refresh_token=') && c.includes('HttpOnly')));
  assert.ok(setCookie.some((c) => c.includes('zamorin_access_token=') && c.includes('HttpOnly')));
});

test('POST /auth/mfa/verify sets HttpOnly cookies and omits refreshToken from response JSON payload', async (t) => {
  const user = {
    organisationId: TEST_ORG_ID,
    userId: 'MU-0001',
    email: 'master@zamorin.test',
    role: 'MASTER',
    accountStatus: 'ACTIVE',
    archivedAt: null,
    mfaEnabled: true,
    mfaMethod: 'TOTP',
    mfaSecretEncrypted: mfaService.encryptMfaSecret(TEST_TOTP_SECRET),
    lastMfaCounter: 0,
    recoveryCodeHashes: [],
    save: async () => user,
    toJSON: () => ({ userId: 'MU-0001', role: 'MASTER' }),
  };

  const challengeToken = mfaService.generateMfaToken({
    user,
    purpose: 'mfa_challenge',
  });

  const validCode = mfaService.generateTotpCode(TEST_TOTP_SECRET).code;

  t.mock.method(User, 'findOne', () => mockMongooseQuery(user));
  t.mock.method(SequenceCounter, 'generateId', async () => 'SS-20260829-0002');
  t.mock.method(Session, 'create', async (data) => ({
    ...data,
    sessionId: 'SS-20260829-0002',
    isActive: () => true,
    toJSON: () => ({ sessionId: 'SS-20260829-0002' }),
  }));

  const server = await startServer(t);
  const response = await request(server, '/api/v1/auth/mfa/verify', {
    mfaChallengeToken: challengeToken,
    code: validCode,
    device: { deviceId: 'DEV-SEC-TEST' },
  });

  assert.equal(response.status, 200);
  assert.equal(response.body.data?.refreshToken, undefined, 'refreshToken must not be in MFA response JSON');
  assert.ok(response.body.data?.accessToken);
  const setCookie = response.headers['set-cookie'] || [];
  assert.ok(setCookie.some((c) => c.includes('zamorin_refresh_token=') && c.includes('HttpOnly')));
});

test('Frontend Auth Token Security: Tokens are strictly in-memory and NEVER persisted to localStorage or sessionStorage', async () => {
  const fs = require('node:fs');
  const path = require('node:path');
  const apiClientPath = path.resolve(__dirname, '../../frontend/src/js/apiClient.js');
  const content = fs.readFileSync(apiClientPath, 'utf8');

  // Verify setAccessToken does not call localStorage.setItem or sessionStorage.setItem with tokens
  assert.ok(
    !content.includes('localStorage?.setItem(ACCESS_TOKEN_STORAGE_KEY'),
    'apiClient.js must NOT write access tokens to localStorage'
  );
  assert.ok(
    !content.includes('sessionStorage?.setItem(ACCESS_TOKEN_STORAGE_KEY'),
    'apiClient.js must NOT write access tokens to sessionStorage'
  );
  assert.ok(
    !content.includes('localStorage?.setItem(SESSION_ID_STORAGE_KEY'),
    'apiClient.js must NOT write session IDs to localStorage'
  );
  assert.ok(
    !content.includes('sessionStorage?.setItem(SESSION_ID_STORAGE_KEY'),
    'apiClient.js must NOT write session IDs to sessionStorage'
  );

  // Verify getAccessToken reads strictly from inMemoryAccessToken
  assert.ok(
    !content.includes('localStorage?.getItem(ACCESS_TOKEN_STORAGE_KEY'),
    'getAccessToken must NOT read from localStorage'
  );
  assert.ok(
    !content.includes('sessionStorage?.getItem(ACCESS_TOKEN_STORAGE_KEY'),
    'getAccessToken must NOT read from sessionStorage'
  );

  // Verify /auth/me is NOT cached
  assert.ok(
    content.includes('{ prefix: "/auth/me", policy: CachePolicy.SENSITIVE_NO_CACHE }'),
    '/auth/me MUST have policy CachePolicy.SENSITIVE_NO_CACHE'
  );
});
