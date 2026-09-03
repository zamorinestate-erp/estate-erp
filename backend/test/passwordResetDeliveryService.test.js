'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

const service = require('../src/services/passwordResetDeliveryService');

function restore(name, value) {
  if (value === undefined) {
    delete process.env[name];
  } else {
    process.env[name] = value;
  }
}

const GMAIL_ENV_NAMES = [
  'GMAIL_API_ACCESS_TOKEN',
  'GMAIL_REFRESH_TOKEN',
  'GOOGLE_OAUTH_CLIENT_ID',
  'GOOGLE_OAUTH_CLIENT_SECRET',
];

function saveGmailEnvironment() {
  return Object.fromEntries(
    GMAIL_ENV_NAMES.map((name) => [name, process.env[name]])
  );
}

function clearGmailEnvironment() {
  for (const name of GMAIL_ENV_NAMES) {
    delete process.env[name];
  }
}

function restoreGmailEnvironment(saved) {
  for (const name of GMAIL_ENV_NAMES) {
    restore(name, saved[name]);
  }
}

test('development reset-code logging requires explicit opt-in', async () => {
  const oldEnv = process.env.NODE_ENV;
  const oldFlag = process.env.PASSWORD_RESET_DEV_LOG_CODE;
  const oldInfo = console.info;
  const savedGmail = saveGmailEnvironment();

  const logs = [];

  try {
    clearGmailEnvironment();

    process.env.NODE_ENV = 'development';
    process.env.PASSWORD_RESET_DEV_LOG_CODE = 'true';

    console.info = (...args) => logs.push(args);

    const result = await service.deliverPasswordResetCode({
      recipientEmail: 'user@example.test',
      code: '123456',
      challengeId: 'PRC-20260809-0001',
    });

    assert.equal(result.delivered, true);
    assert.equal(result.channel, 'DEVELOPMENT_LOG');
    assert.equal(logs.length, 1);
  } finally {
    console.info = oldInfo;
    restore('NODE_ENV', oldEnv);
    restore('PASSWORD_RESET_DEV_LOG_CODE', oldFlag);
    restoreGmailEnvironment(savedGmail);
  }
});

test('production never enables development reset-code logging', async () => {
  const oldEnv = process.env.NODE_ENV;
  const oldFlag = process.env.PASSWORD_RESET_DEV_LOG_CODE;
  const oldInfo = console.info;
  const savedGmail = saveGmailEnvironment();

  const logs = [];

  try {
    clearGmailEnvironment();

    process.env.NODE_ENV = 'production';
    process.env.PASSWORD_RESET_DEV_LOG_CODE = 'true';

    console.info = (...args) => logs.push(args);

    assert.equal(
      service.isDevelopmentCodeLoggingEnabled(),
      false
    );

    const result = await service.deliverPasswordResetCode({
      recipientEmail: 'user@example.test',
      code: '123456',
      challengeId: 'PRC-20260809-0001',
    });

    assert.equal(result.delivered, false);
    assert.equal(
      result.reason,
      'PASSWORD_RESET_DELIVERY_NOT_CONFIGURED'
    );
    assert.equal(logs.length, 0);
  } finally {
    console.info = oldInfo;
    restore('NODE_ENV', oldEnv);
    restore('PASSWORD_RESET_DEV_LOG_CODE', oldFlag);
    restoreGmailEnvironment(savedGmail);
  }
});

test('production reset delivery uses configured Gmail API provider', async () => {
  const oldEnv = process.env.NODE_ENV;
  const oldFlag = process.env.PASSWORD_RESET_DEV_LOG_CODE;
  const savedGmail = saveGmailEnvironment();
  const oldFetch = global.fetch;

  let capturedRequest = null;

  try {
    clearGmailEnvironment();

    process.env.NODE_ENV = 'production';
    process.env.PASSWORD_RESET_DEV_LOG_CODE = 'false';

    process.env.GMAIL_API_ACCESS_TOKEN =
      'unit-test-access-token';

    global.fetch = async (url, options) => {
      capturedRequest = {
        url,
        options,
      };

      return {
        ok: true,
        status: 200,
        async json() {
          return {
            id: 'gmail-test-message-001',
          };
        },
        async text() {
          return '';
        },
      };
    };

    assert.equal(
      service.isPasswordResetDeliveryAvailable(),
      true
    );

    const result = await service.deliverPasswordResetCode({
      recipientEmail: 'user@example.test',
      code: '654321',
      challengeId: 'PRC-20260809-0002',
    });

    assert.equal(result.delivered, true);
    assert.equal(result.channel, 'GMAIL_API');
    assert.equal(
      result.providerMessageId,
      'gmail-test-message-001'
    );

    assert.ok(capturedRequest);

    assert.equal(
      capturedRequest.url,
      'https://gmail.googleapis.com/gmail/v1/users/me/messages/send'
    );

    assert.equal(
      capturedRequest.options.method,
      'POST'
    );

    assert.equal(
      capturedRequest.options.headers.Authorization,
      'Bearer unit-test-access-token'
    );

    const requestBody =
      JSON.parse(capturedRequest.options.body);

    assert.equal(
      typeof requestBody.raw,
      'string'
    );

    assert.ok(requestBody.raw.length > 0);
  } finally {
    global.fetch = oldFetch;
    restore('NODE_ENV', oldEnv);
    restore('PASSWORD_RESET_DEV_LOG_CODE', oldFlag);
    restoreGmailEnvironment(savedGmail);
  }
});

test('production Gmail delivery failure is returned safely without leaking provider details', async () => {
  const oldEnv = process.env.NODE_ENV;
  const savedGmail = saveGmailEnvironment();
  const oldFetch = global.fetch;

  try {
    clearGmailEnvironment();

    process.env.NODE_ENV = 'production';
    process.env.GMAIL_API_ACCESS_TOKEN =
      'unit-test-access-token';

    global.fetch = async () => ({
      ok: false,
      status: 401,

      async text() {
        return 'synthetic provider rejection';
      },

      async json() {
        return {};
      },
    });

    const result = await service.deliverPasswordResetCode({
      recipientEmail: 'user@example.test',
      code: '123456',
      challengeId: 'PRC-20260809-0003',
    });

    assert.equal(result.delivered, false);
    assert.equal(result.channel, 'GMAIL_API');

    assert.equal(
      result.reason,
      'PASSWORD_RESET_DELIVERY_FAILED'
    );

    assert.equal(
      result.providerErrorCode,
      'GMAIL_HTTP_401'
    );

    assert.equal(
      Object.prototype.hasOwnProperty.call(
        result,
        'providerError'
      ),
      false
    );
  } finally {
    global.fetch = oldFetch;
    restore('NODE_ENV', oldEnv);
    restoreGmailEnvironment(savedGmail);
  }
});

test('delivery rejects incomplete reset data', async () => {
  await assert.rejects(
    () =>
      service.deliverPasswordResetCode({
        recipientEmail: '',
        code: '123456',
        challengeId: 'PRC-20260809-0001',
      }),
    /requires recipient email, code and challenge ID/
  );
});

test('delivery availability follows safe environment rules', () => {
  const oldEnv = process.env.NODE_ENV;
  const oldFlag = process.env.PASSWORD_RESET_DEV_LOG_CODE;
  const savedGmail = saveGmailEnvironment();

  try {
    clearGmailEnvironment();

    process.env.NODE_ENV = 'development';
    process.env.PASSWORD_RESET_DEV_LOG_CODE = 'false';

    assert.equal(
      service.isPasswordResetDeliveryAvailable(),
      false
    );

    process.env.PASSWORD_RESET_DEV_LOG_CODE = 'true';

    assert.equal(
      service.isPasswordResetDeliveryAvailable(),
      true
    );

    process.env.NODE_ENV = 'production';

    assert.equal(
      service.isPasswordResetDeliveryAvailable(),
      false
    );

    process.env.GMAIL_REFRESH_TOKEN =
      'synthetic-refresh-token';

    process.env.GOOGLE_OAUTH_CLIENT_ID =
      'synthetic-client-id';

    process.env.GOOGLE_OAUTH_CLIENT_SECRET =
      'synthetic-client-secret';

    assert.equal(
      service.isPasswordResetDeliveryAvailable(),
      true
    );
  } finally {
    restore('NODE_ENV', oldEnv);
    restore('PASSWORD_RESET_DEV_LOG_CODE', oldFlag);
    restoreGmailEnvironment(savedGmail);
  }
});
