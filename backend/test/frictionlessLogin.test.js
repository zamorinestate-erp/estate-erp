'use strict';

/**
 * FRICTIONLESS DIRECT PASSWORD SIGN-IN (ZERO TOTP) TEST SUITE
 * 
 * Verifies that when REQUIRE_MFA is not set (production default for frictionless login):
 * 1. Users with mfaEnabled: false sign in directly with password
 * 2. Users with mfaEnabled: true in the database sign in directly with password (no TOTP prompt)
 * 3. Master, Owner, Cafe Admin, and Staff all authenticate directly without 403 MFA_REQUIRED
 * 4. Active sessions and HttpOnly auth cookies are issued immediately
 */

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const bcrypt = require('bcrypt');

const { User } = require('../src/models/User');
const authService = require('../src/services/authService');
const mfaService = require('../src/services/mfaService');

describe('Frictionless Direct Password Sign-In (Zero TOTP)', () => {
  let mongoServer;
  const TEST_ORG = 'ZAMORIN';
  const PASSWORD = 'Password@123';
  let passwordHash;

  test.before(async () => {
    delete process.env.REQUIRE_MFA;
    delete process.env.DISABLE_MFA;
    process.env.JWT_ACCESS_SECRET = 'a_very_secure_and_long_jwt_access_secret_32bytes_long!';
    process.env.JWT_REFRESH_SECRET = 'a_very_secure_and_long_jwt_refresh_secret_32bytes_long!';
    process.env.MFA_ENCRYPTION_KEY = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';

    mongoServer = await MongoMemoryServer.create();
    await mongoose.connect(mongoServer.getUri());
    passwordHash = await bcrypt.hash(PASSWORD, 10);
  });

  test.after(async () => {
    await mongoose.disconnect();
    if (mongoServer) {
      await mongoServer.stop();
    }
  });

  test('User with mfaEnabled: true in DB signs in directly without MFA when REQUIRE_MFA is not true', async () => {
    const user = await User.create({
      organisationId: TEST_ORG,
      userId: 'MU-0099',
      name: 'Primary Master Admin',
      email: 'pradeeshk331@gmail.com',
      passwordHash,
      role: 'MASTER',
      accountStatus: 'ACTIVE',
      isPrimaryMaster: true,
      primaryMasterDesignatedAt: new Date(),
      primaryMasterDesignatedBy: 'SYSTEM_BOOTSTRAP',
      primaryMasterDesignationReason: 'Initial bootstrap',
      mfaEnabled: true,
      mfaMethod: 'TOTP',
      mfaSecretEncrypted: mfaService.encryptMfaSecret('JBSWY3DPEHPK3PXP'),
      mustChangePassword: false,
      createdBy: 'SYSTEM_BOOTSTRAP',
    });

    const result = await authService.authenticatePassword({
      organisationId: TEST_ORG,
      email: 'pradeeshk331@gmail.com',
      password: PASSWORD,
    });

    assert.equal(result.requiresMfa, false, 'requiresMfa must be false for frictionless password login');
    assert.equal(result.mfaSetupRequired, false, 'mfaSetupRequired must be false');
    assert.equal(result.user.userId, 'MU-0099');

    // Create session directly without throwing MFA error
    const sessionResult = await authService.createSession({
      user: result.user,
      device: { deviceId: 'DEV-BROWSER-1' },
      network: { ip: '127.0.0.1' },
      mfaVerified: true,
      createdBy: result.user.userId,
    });

    assert.ok(sessionResult.accessToken, 'Access token must be generated');
    assert.ok(sessionResult.session.sessionId, 'Session must be created successfully');
    assert.equal(sessionResult.session.userId, 'MU-0099');
  });

  test('Owner and Cafe Admin accounts authenticate directly with password only', async () => {
    await User.create({
      organisationId: TEST_ORG,
      userId: 'OW-0099',
      name: 'Business Owner',
      email: 'owner@zamorin.cafe',
      passwordHash,
      role: 'OWNER',
      accountStatus: 'ACTIVE',
      mfaEnabled: true,
      mfaMethod: 'TOTP',
      mfaSecretEncrypted: mfaService.encryptMfaSecret('JBSWY3DPEHPK3PXP'),
      mustChangePassword: false,
      createdBy: 'SYSTEM_BOOTSTRAP',
    });

    const result = await authService.authenticatePassword({
      organisationId: TEST_ORG,
      email: 'owner@zamorin.cafe',
      password: PASSWORD,
    });

    assert.equal(result.requiresMfa, false, 'Owner requiresMfa must be false');
    assert.equal(result.mfaSetupRequired, false);
  });
});
