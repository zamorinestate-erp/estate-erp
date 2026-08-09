'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

const service = require('../src/services/passwordResetDeliveryService');

function restore(name, value) {
  if (value === undefined) delete process.env[name];
  else process.env[name] = value;
}

test('development reset-code logging requires explicit opt-in', async () => {
  const oldEnv = process.env.NODE_ENV;
  const oldFlag = process.env.PASSWORD_RESET_DEV_LOG_CODE;
  const oldInfo = console.info;
  const logs = [];
  try {
    process.env.NODE_ENV = 'development';
    process.env.PASSWORD_RESET_DEV_LOG_CODE = 'true';
    console.info = (...args) => logs.push(args);
    const result = await service.deliverPasswordResetCode({ recipientEmail: 'user@example.test', code: '123456', challengeId: 'PRC-20260809-0001' });
    assert.equal(result.delivered, true);
    assert.equal(result.channel, 'DEVELOPMENT_LOG');
    assert.equal(logs.length, 1);
  } finally {
    console.info = oldInfo;
    restore('NODE_ENV', oldEnv);
    restore('PASSWORD_RESET_DEV_LOG_CODE', oldFlag);
  }
});

test('production never enables development reset-code logging', async () => {
  const oldEnv = process.env.NODE_ENV;
  const oldFlag = process.env.PASSWORD_RESET_DEV_LOG_CODE;
  const oldInfo = console.info;
  const logs = [];
  try {
    process.env.NODE_ENV = 'production';
    process.env.PASSWORD_RESET_DEV_LOG_CODE = 'true';
    console.info = (...args) => logs.push(args);
    assert.equal(service.isDevelopmentCodeLoggingEnabled(), false);
    const result = await service.deliverPasswordResetCode({ recipientEmail: 'user@example.test', code: '123456', challengeId: 'PRC-20260809-0001' });
    assert.equal(result.delivered, false);
    assert.equal(result.reason, 'PASSWORD_RESET_DELIVERY_NOT_CONFIGURED');
    assert.equal(logs.length, 0);
  } finally {
    console.info = oldInfo;
    restore('NODE_ENV', oldEnv);
    restore('PASSWORD_RESET_DEV_LOG_CODE', oldFlag);
  }
});

test('delivery rejects incomplete reset data', async () => {
  await assert.rejects(() => service.deliverPasswordResetCode({ recipientEmail: '', code: '123456', challengeId: 'PRC-20260809-0001' }), /requires recipient email, code and challenge ID/);
});

test('delivery availability follows safe environment rules', function () {
  const oldEnv = process.env.NODE_ENV;
  const oldFlag = process.env.PASSWORD_RESET_DEV_LOG_CODE;
  try {
    process.env.NODE_ENV = 'development';
    process.env.PASSWORD_RESET_DEV_LOG_CODE = 'false';
    assert.equal(service.isPasswordResetDeliveryAvailable(), false);
    process.env.PASSWORD_RESET_DEV_LOG_CODE = 'true';
    assert.equal(service.isPasswordResetDeliveryAvailable(), true);
    process.env.NODE_ENV = 'production';
    assert.equal(service.isPasswordResetDeliveryAvailable(), false);
  } finally {
    restore('NODE_ENV', oldEnv);
    restore('PASSWORD_RESET_DEV_LOG_CODE', oldFlag);
  }
});
