'use strict';

const assert = require('node:assert/strict');
const http = require('node:http');
const test = require('node:test');
const jwt = require('jsonwebtoken');

const { createApp } = require('../src/server');
const { User } = require('../src/models/User');
const authService = require('../src/services/authService');

const PASSWORD = 'CurrentPass1!';
const JWT_SECRET =
  '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';

let passwordHash;

function queryResult(value) {
  const promise = Promise.resolve(value);
  promise.select = async function select() {
    return value;
  };
  return promise;
}

function requestJson(server, body) {
  return new Promise(function executor(resolve, reject) {
    const req = http.request(
      {
        method: 'POST',
        hostname: '127.0.0.1',
        port: server.address().port,
        path: '/api/v1/auth/login',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
      },
      function onResponse(res) {
        let raw = '';
        res.on('data', function onData(chunk) {
          raw += chunk;
        });
        res.on('end', function onEnd() {
          resolve({
            status: res.statusCode,
            body: JSON.parse(raw),
          });
        });
      }
    );

    req.on('error', reject);
    req.write(JSON.stringify(body));
    req.end();
  });
}

async function startServer(t) {
  const app = createApp({
    allowedOrigins: ['*'],
    production: false,
  });

  const server = await new Promise(function listen(resolve) {
    const instance = app.listen(0, function onListen() {
      resolve(instance);
    });
  });

  t.after(function closeServer() {
    return new Promise(function close(resolve) {
      server.close(resolve);
    });
  });

  return server;
}

function makeUser(overrides) {
  const user = new User({
    userId: 'MU-0001',
    organisationId: 'ORG-TEST',
    name: 'Test Master',
    email: 'master@example.test',
    role: 'MASTER',
    accountStatus: 'ACTIVE',
    assignedCafeIds: [],
    isPrimaryMaster: false,
    passwordHash,
    mustChangePassword: false,
    sessionVersion: 0,
    permissionsVersion: 0,
    mfaEnabled: false,
    createdBy: 'SYSTEM',
    ...(overrides || {}),
  });

  user.save = async function save() {
    return user;
  };

  return user;
}

test.before(async function setup() {
  process.env.JWT_ACCESS_SECRET = JWT_SECRET;
  process.env.REQUIRE_MFA = 'true';
  passwordHash = await authService.hashPassword(PASSWORD);
});

test('MASTER login without configured MFA returns purpose-bound setup token', async function (t) {
  const user = makeUser();

  t.mock.method(User, 'findOne', function findOne() {
    return queryResult(user);
  });

  const server = await startServer(t);
  const response = await requestJson(server, {
    organisationId: 'org-test',
    email: 'MASTER@EXAMPLE.TEST',
    password: PASSWORD,
    device: { deviceId: 'DEV-1' },
  });

  assert.equal(response.status, 403);
  assert.equal(response.body.error?.code, 'MFA_SETUP_REQUIRED');
  assert.ok(response.body.data?.mfaSetupToken);
  assert.equal(response.body.data?.mfaChallengeToken, undefined);

  const payload = jwt.verify(
    response.body.data.mfaSetupToken,
    JWT_SECRET,
    {
      algorithms: ['HS256'],
      issuer: 'zamorin-cafe-erp-api',
      audience: 'zamorin-cafe-erp',
    }
  );

  assert.equal(payload.type, 'mfa_setup');
  assert.equal(payload.sub, user.userId);
  assert.equal(payload.org, user.organisationId);
});

test('MASTER login with configured MFA returns purpose-bound challenge token', async function (t) {
  const user = makeUser({
    mfaEnabled: true,
    mfaMethod: 'TOTP',
  });

  t.mock.method(User, 'findOne', function findOne() {
    return queryResult(user);
  });

  const server = await startServer(t);
  const response = await requestJson(server, {
    organisationId: 'ORG-TEST',
    email: 'master@example.test',
    password: PASSWORD,
    device: { deviceId: 'DEV-2' },
  });

  assert.equal(response.status, 403);
  assert.equal(response.body.error?.code, 'MFA_REQUIRED');
  assert.ok(response.body.data?.mfaChallengeToken);
  assert.equal(response.body.data?.mfaSetupToken, undefined);

  const payload = jwt.verify(
    response.body.data.mfaChallengeToken,
    JWT_SECRET,
    {
      algorithms: ['HS256'],
      issuer: 'zamorin-cafe-erp-api',
      audience: 'zamorin-cafe-erp',
    }
  );

  assert.equal(payload.type, 'mfa_challenge');
  assert.equal(payload.sub, user.userId);
  assert.equal(payload.org, user.organisationId);
});

test('login rejects missing device ID before password authentication', async function (t) {
  const server = await startServer(t);
  const response = await requestJson(server, {
    organisationId: 'ORG-TEST',
    email: 'master@example.test',
    password: PASSWORD,
    device: {},
  });

  assert.equal(response.status, 400);
  assert.equal(response.body.error?.code, 'DEVICE_ID_REQUIRED');
});
