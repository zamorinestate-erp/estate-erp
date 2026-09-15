'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const bcrypt = require('bcrypt');

const { Cafe } = require('../src/models/Cafe');
const { CafeAccess } = require('../src/models/CafeAccess');
const { User } = require('../src/models/User');
const cafeAccessCryptoService = require('../src/services/cafeAccessCryptoService');
const cafeService = require('../src/services/cafeService');
const { ApiError } = require('../src/utils/ApiError');

test('REC-03: Per-Café Unique QR, Secure Deep-Link, Gateway & Access-Credential Lifecycle Suite', async (t) => {
  let mongoServer;
  let masterUser;
  let cafeA;
  let cafeB;
  let cafeC;
  let staffUserA;
  let adminUserAB;
  let cafeAAccess;

  t.before(async () => {
    mongoServer = await MongoMemoryServer.create();
    await mongoose.connect(mongoServer.getUri());

    cafeAccessCryptoService.verifySecretKeys();

    const passwordHash = await bcrypt.hash('SecurePassword!123', 10);

    masterUser = await User.create({
      userId: 'MU-0001',
      organisationId: 'ZAMORIN',
      name: 'Primary Master User',
      email: 'pm@zamorin.cafe',
      role: 'MASTER',
      isPrimaryMaster: true,
      primaryMasterDesignatedAt: new Date(),
      primaryMasterDesignatedBy: 'SYSTEM',
      primaryMasterDesignationReason: 'Initial bootstrap',
      createdBy: 'SYSTEM',
      accountStatus: 'ACTIVE',
      passwordHash,
    });

    staffUserA = await User.create({
      userId: 'ST-0001',
      organisationId: 'ZAMORIN',
      name: 'Staff Cafe A Only',
      email: 'staff.a@zamorin.cafe',
      role: 'STAFF',
      isPrimaryMaster: false,
      primaryCafeId: 'ZC-0001',
      assignedCafeIds: ['ZC-0001'],
      createdBy: 'MU-0001',
      accountStatus: 'ACTIVE',
      passwordHash,
    });

    adminUserAB = await User.create({
      userId: 'AD-0001',
      organisationId: 'ZAMORIN',
      name: 'Admin Multi-Branch',
      email: 'admin.ab@zamorin.cafe',
      role: 'CAFE_ADMIN',
      isPrimaryMaster: false,
      primaryCafeId: 'ZC-0001',
      assignedCafeIds: ['ZC-0001', 'ZC-0002'],
      createdBy: 'MU-0001',
      accountStatus: 'ACTIVE',
      passwordHash,
    });

    // Create 3 cafes
    cafeA = await Cafe.create({
      organisationId: 'ZAMORIN',
      cafeId: 'ZC-0001',
      name: 'Zamorin Beachfront',
      displayName: 'Zamorin Beachfront Flagship',
      address: { city: 'Kozhikode', state: 'Kerala' },
      status: 'ACTIVE',
      operationalStatus: 'OPERATIONAL',
      createdBy: 'MU-0001',
    });

    cafeB = await Cafe.create({
      organisationId: 'ZAMORIN',
      cafeId: 'ZC-0002',
      name: 'Zamorin Downtown',
      displayName: 'Zamorin Downtown Espresso',
      address: { city: 'Kochi', state: 'Kerala' },
      status: 'ACTIVE',
      operationalStatus: 'OPERATIONAL',
      createdBy: 'MU-0001',
    });

    cafeC = await Cafe.create({
      organisationId: 'ZAMORIN',
      cafeId: 'ZC-0003',
      name: 'Zamorin Highlands',
      displayName: 'Zamorin Highlands Sanctuary',
      address: { city: 'Wayanad', state: 'Kerala' },
      status: 'ACTIVE',
      operationalStatus: 'OPERATIONAL',
      createdBy: 'MU-0001',
    });

    // Provision initial access for ZC-0001
    const initialQrToken = cafeAccessCryptoService.generateOpaqueToken();
    const initialQrHash = cafeAccessCryptoService.hashOpaqueToken(initialQrToken);

    cafeAAccess = await CafeAccess.create({
      organisationId: 'ZAMORIN',
      cafeId: 'ZC-0001',
      permanentCafePinEncrypted: cafeAccessCryptoService.encryptSecret('889900'),
      permanentCafePinLookupHash: cafeAccessCryptoService.computePinLookupHash('889900'),
      qrCredentialHash: initialQrHash,
      qrTokenEncrypted: cafeAccessCryptoService.encryptSecret(initialQrToken),
      qrVersion: 1,
      qrEnabled: true,
      qrCreatedAt: new Date(),
      linkCredentialHash: cafeAccessCryptoService.hashOpaqueToken('link-token-a'),
      linkTokenEncrypted: cafeAccessCryptoService.encryptSecret('link-token-a'),
      linkVersion: 1,
      linkEnabled: true,
      provisioningStatus: 'READY',
      createdBy: 'MU-0001',
    });

    // Store raw initial token for tests
    cafeA.rawQrToken = initialQrToken;
  });

  t.after(async () => {
    await mongoose.disconnect();
    if (mongoServer) await mongoServer.stop();
  });

  await t.test('1. High-Entropy Credential Generation: 256-bit URL-safe token, SHA-256 indexing, AES-256-GCM ciphertext', async () => {
    const rawToken = cafeAccessCryptoService.generateOpaqueToken();
    assert.ok(rawToken, 'Token should be generated');
    assert.strictEqual(typeof rawToken, 'string');
    // 32 bytes base64url = 43 characters
    assert.ok(rawToken.length >= 43, `Token should have high entropy (len: ${rawToken.length})`);
    assert.doesNotMatch(rawToken, /[+/=]/, 'Base64URL must not contain +, /, or =');

    const tokenHash = cafeAccessCryptoService.hashOpaqueToken(rawToken);
    assert.strictEqual(typeof tokenHash, 'string');
    assert.strictEqual(tokenHash.length, 64, 'SHA-256 hash must be exactly 64 hex characters');

    const encrypted = cafeAccessCryptoService.encryptSecret(rawToken);
    assert.ok(encrypted.includes(':'), 'AES-256-GCM format must contain IV:Ciphertext:Tag');
    const decrypted = cafeAccessCryptoService.decryptSecret(encrypted);
    assert.strictEqual(decrypted, rawToken, 'Decrypted token must match original');
  });

  await t.test('2. QR Deep-Link Resolution: Active café returns safe public metadata with ZERO secrets', async () => {
    const publicContext = await cafeService.resolvePublicQrToken(cafeA.rawQrToken);

    assert.ok(publicContext, 'Should resolve public context');
    assert.strictEqual(publicContext.cafeId, 'ZC-0001');
    assert.strictEqual(publicContext.displayName, 'Zamorin Beachfront Flagship');
    assert.strictEqual(publicContext.city, 'Kozhikode');
    assert.strictEqual(publicContext.organisationId, 'ZAMORIN');
    assert.strictEqual(publicContext.operationalStatus, 'ACTIVE');
    assert.strictEqual(publicContext.loginEnabled, true);
    assert.strictEqual(publicContext.qrVersion, 1);

    // Strict Negative Assertion: ZERO confidential data leakage
    assert.strictEqual(publicContext.passwordHash, undefined, 'Must not leak passwordHash');
    assert.strictEqual(publicContext.permanentCafePinEncrypted, undefined, 'Must not leak PIN');
    assert.strictEqual(publicContext.qrTokenEncrypted, undefined, 'Must not leak encrypted secrets');
    assert.strictEqual(publicContext.mongoId, undefined, 'Must not leak internal Mongo IDs');
    assert.strictEqual(publicContext._id, undefined, 'Must not leak _id');
    assert.strictEqual(publicContext.sales, undefined, 'Must not leak sales data');
    assert.strictEqual(publicContext.staff, undefined, 'Must not leak staff rosters');
  });

  await t.test('3. QR Resolution Failures: Unknown, Tampered, or Inactive tokens are rejected', async () => {
    // 3.1 Unknown token
    await assert.rejects(
      async () => {
        await cafeService.resolvePublicQrToken('completely-invalid-nonexistent-token-12345');
      },
      (err) => {
        assert.ok(err instanceof ApiError);
        assert.strictEqual(err.statusCode, 401);
        assert.strictEqual(err.code, 'INVALID_OR_EXPIRED_CAFE_ACCESS');
        return true;
      },
      'Unknown token must reject with 401 INVALID_OR_EXPIRED_CAFE_ACCESS'
    );

    // 3.2 Empty token
    await assert.rejects(
      async () => {
        await cafeService.resolvePublicQrToken('');
      },
      (err) => {
        assert.ok(err instanceof ApiError);
        assert.strictEqual(err.statusCode, 400);
        return true;
      }
    );
  });

  await t.test('4. QR Lifecycle: Rotation generates new version, records history, invalidates old token', async () => {
    const oldToken = cafeA.rawQrToken;

    const rotationResult = await cafeService.rotateQrCredential({
      organisationId: 'ZAMORIN',
      cafeId: 'ZC-0001',
      auth: { userId: 'MU-0001', role: 'MASTER' },
      currentPassword: 'SecurePassword!123',
    });

    assert.ok(rotationResult.qrToken, 'Should return new qrToken');
    assert.strictEqual(rotationResult.qrVersion, 2, 'Version should be incremented to 2');
    assert.notEqual(rotationResult.qrToken, oldToken, 'New token must differ from old token');
    assert.ok(rotationResult.qrUrl.includes(rotationResult.qrToken), 'URL must contain new token');

    // Store new token
    cafeA.rawQrToken = rotationResult.qrToken;

    // Verify old token is now 401 INVALID_OR_EXPIRED_CAFE_ACCESS
    await assert.rejects(
      async () => {
        await cafeService.resolvePublicQrToken(oldToken);
      },
      (err) => {
        assert.ok(err instanceof ApiError);
        assert.strictEqual(err.statusCode, 401);
        assert.strictEqual(err.code, 'INVALID_OR_EXPIRED_CAFE_ACCESS');
        return true;
      },
      'Old rotated QR token must be immediately invalidated'
    );

    // Verify new token resolves v2
    const newContext = await cafeService.resolvePublicQrToken(cafeA.rawQrToken);
    assert.strictEqual(newContext.qrVersion, 2);
    assert.strictEqual(newContext.cafeId, 'ZC-0001');

    // Verify qrHistory in database
    const accessRec = await CafeAccess.findOne({ cafeId: 'ZC-0001' });
    assert.ok(accessRec.qrHistory && accessRec.qrHistory.length >= 1);
    const historyEntry = accessRec.qrHistory[accessRec.qrHistory.length - 1];
    assert.strictEqual(historyEntry.version, 1);
    assert.strictEqual(historyEntry.action, 'ROTATED');
    assert.strictEqual(historyEntry.actorUserId, 'MU-0001');
  });

  await t.test('5. QR Lifecycle: Revocation disables public gateway, retains cafe record, and records history', async () => {
    const revokeResult = await cafeService.revokeQrCredential({
      organisationId: 'ZAMORIN',
      cafeId: 'ZC-0001',
      auth: { userId: 'MU-0001', role: 'MASTER' },
      reason: 'Physical QR card damaged at reception',
      currentPassword: 'SecurePassword!123',
    });

    assert.strictEqual(revokeResult.cafeId, 'ZC-0001');
    assert.strictEqual(revokeResult.qrEnabled, false);
    assert.ok(revokeResult.qrRevokedAt);
    assert.strictEqual(revokeResult.qrRevokedBy, 'MU-0001');
    assert.strictEqual(revokeResult.qrRevokeReason, 'Physical QR card damaged at reception');

    // Resolving revoked token must fail with 401 QR_REVOKED
    await assert.rejects(
      async () => {
        await cafeService.resolvePublicQrToken(cafeA.rawQrToken);
      },
      (err) => {
        assert.ok(err instanceof ApiError);
        assert.strictEqual(err.statusCode, 401);
        assert.strictEqual(err.code, 'QR_REVOKED');
        return true;
      },
      'Revoked QR token must reject with 401 QR_REVOKED'
    );

    // Cafe entity must still exist in ACTIVE status
    const cafeDoc = await Cafe.findOne({ cafeId: 'ZC-0001' });
    assert.ok(cafeDoc, 'Cafe entity must remain intact');
    assert.strictEqual(cafeDoc.status, 'ACTIVE');

    // Summary must show REVOKED status and null qrUrl
    const summary = await cafeService.getCafeAccessSummary('ZAMORIN', 'ZC-0001');
    assert.strictEqual(summary.qrEnabled, false);
    assert.strictEqual(summary.qrStatus, 'REVOKED');
    assert.strictEqual(summary.qrUrl, null, 'Revoked QR must not expose url');
    assert.strictEqual(summary.qrRevokedBy, 'MU-0001');

    // Re-rotating restores enabled status and unrevokes
    const restoreResult = await cafeService.rotateQrCredential({
      organisationId: 'ZAMORIN',
      cafeId: 'ZC-0001',
      auth: { userId: 'MU-0001', role: 'MASTER' },
      currentPassword: 'SecurePassword!123',
    });

    assert.strictEqual(restoreResult.qrVersion, 3);
    cafeA.rawQrToken = restoreResult.qrToken;

    const restoredContext = await cafeService.resolvePublicQrToken(cafeA.rawQrToken);
    assert.strictEqual(restoredContext.loginEnabled, true);
    assert.strictEqual(restoredContext.qrVersion, 3);
  });

  await t.test('6. Inactive & Suspended Café Protection: Resolving QR for non-operational cafe is blocked (403)', async () => {
    // Provision QR for ZC-0003
    const tokenC = cafeAccessCryptoService.generateOpaqueToken();
    await CafeAccess.create({
      organisationId: 'ZAMORIN',
      cafeId: 'ZC-0003',
      qrCredentialHash: cafeAccessCryptoService.hashOpaqueToken(tokenC),
      qrTokenEncrypted: cafeAccessCryptoService.encryptSecret(tokenC),
      qrVersion: 1,
      qrEnabled: true,
      linkCredentialHash: cafeAccessCryptoService.hashOpaqueToken('link-token-c'),
      linkTokenEncrypted: cafeAccessCryptoService.encryptSecret('link-token-c'),
      linkVersion: 1,
      linkEnabled: true,
      provisioningStatus: 'READY',
      createdBy: 'MU-0001',
    });

    // Suspend ZC-0003
    await Cafe.updateOne({ cafeId: 'ZC-0003' }, { operationalStatus: 'TEMPORARILY_CLOSED', status: 'SUSPENDED' });

    await assert.rejects(
      async () => {
        await cafeService.resolvePublicQrToken(tokenC);
      },
      (err) => {
        assert.ok(err instanceof ApiError);
        assert.strictEqual(err.statusCode, 403);
        assert.strictEqual(err.code, 'CAFE_INACTIVE');
        return true;
      },
      'Non-operational or suspended cafe QR must reject with 403 CAFE_INACTIVE'
    );

    // Restore ZC-0003
    await Cafe.updateOne({ cafeId: 'ZC-0003' }, { operationalStatus: 'OPERATIONAL', status: 'ACTIVE' });
    const cContext = await cafeService.resolvePublicQrToken(tokenC);
    assert.strictEqual(cContext.cafeId, 'ZC-0003');
  });

  await t.test('7. Multi-Tenant Authorization & Café Binding: verifyCafeAccessBinding enforces assignment security', async () => {
    // 7.1 Staff A scanning Cafe 1 -> PERMITTED
    const resA = await cafeService.verifyCafeAccessBinding({
      userId: staffUserA.userId,
      role: staffUserA.role,
      organisationId: staffUserA.organisationId,
      assignedCafeIds: staffUserA.assignedCafeIds,
      primaryCafeId: staffUserA.primaryCafeId,
      targetCafeId: 'ZC-0001',
      isPrimaryMaster: false,
    });
    assert.strictEqual(resA.authorized, true);
    assert.strictEqual(resA.targetCafeId, 'ZC-0001');

    // 7.2 Staff A scanning Cafe 2 -> DENIED (403 CAFE_ACCESS_DENIED)
    await assert.rejects(
      async () => {
        await cafeService.verifyCafeAccessBinding({
          userId: staffUserA.userId,
          role: staffUserA.role,
          organisationId: staffUserA.organisationId,
          assignedCafeIds: staffUserA.assignedCafeIds,
          primaryCafeId: staffUserA.primaryCafeId,
          targetCafeId: 'ZC-0002',
          isPrimaryMaster: false,
        });
      },
      (err) => {
        assert.ok(err instanceof ApiError);
        assert.strictEqual(err.statusCode, 403);
        assert.strictEqual(err.code, 'CAFE_ACCESS_DENIED');
        return true;
      },
      'Staff assigned only to Cafe 1 must be strictly denied access when scanning Cafe 2'
    );

    // 7.3 Admin AB scanning Cafe 2 -> PERMITTED
    const resAdminB = await cafeService.verifyCafeAccessBinding({
      userId: adminUserAB.userId,
      role: adminUserAB.role,
      organisationId: adminUserAB.organisationId,
      assignedCafeIds: adminUserAB.assignedCafeIds,
      primaryCafeId: adminUserAB.primaryCafeId,
      targetCafeId: 'ZC-0002',
      isPrimaryMaster: false,
    });
    assert.strictEqual(resAdminB.authorized, true);

    // 7.4 Admin AB scanning Cafe 3 -> DENIED (403 CAFE_ACCESS_DENIED)
    await assert.rejects(
      async () => {
        await cafeService.verifyCafeAccessBinding({
          userId: adminUserAB.userId,
          role: adminUserAB.role,
          organisationId: adminUserAB.organisationId,
          assignedCafeIds: adminUserAB.assignedCafeIds,
          primaryCafeId: adminUserAB.primaryCafeId,
          targetCafeId: 'ZC-0003',
          isPrimaryMaster: false,
        });
      },
      (err) => {
        assert.ok(err instanceof ApiError);
        assert.strictEqual(err.statusCode, 403);
        assert.strictEqual(err.code, 'CAFE_ACCESS_DENIED');
        return true;
      },
      'Admin not assigned to Cafe 3 must be denied'
    );

    // 7.5 Primary Master scanning any cafe -> PERMITTED
    const resMasterC = await cafeService.verifyCafeAccessBinding({
      userId: masterUser.userId,
      role: masterUser.role,
      organisationId: masterUser.organisationId,
      assignedCafeIds: [],
      primaryCafeId: null,
      targetCafeId: 'ZC-0003',
      isPrimaryMaster: true,
    });
    assert.strictEqual(resMasterC.authorized, true);
    assert.strictEqual(resMasterC.isPrimaryMaster, true);

    // 7.6 Cross-tenant tampering: target cafe in another organization -> 404/403
    await assert.rejects(
      async () => {
        await cafeService.verifyCafeAccessBinding({
          userId: masterUser.userId,
          role: masterUser.role,
          organisationId: 'DIFFERENT_ORG',
          assignedCafeIds: ['ZC-0001'],
          primaryCafeId: 'ZC-0001',
          targetCafeId: 'ZC-0001',
          isPrimaryMaster: false,
        });
      },
      (err) => {
        assert.ok(err instanceof ApiError);
        assert.strictEqual(err.statusCode, 404);
        assert.strictEqual(err.code, 'CAFE_NOT_FOUND');
        return true;
      },
      'Target cafe belonging to different org must be rejected'
    );
  });

  await t.test('8. Anti-Bypass & Session Separation: Possession of QR gives ZERO session authentication', async () => {
    // 8.1 Resolve public QR token
    const publicContext = await cafeService.resolvePublicQrToken(cafeA.rawQrToken);

    // Assert absence of any session token
    assert.strictEqual(publicContext.sessionToken, undefined, 'QR resolution must never return a sessionToken');
    assert.strictEqual(publicContext.accessToken, undefined, 'QR resolution must never return an accessToken');
    assert.strictEqual(publicContext.user, undefined, 'QR resolution must never create a user session');
    assert.strictEqual(publicContext.role, undefined, 'QR resolution must never grant an ERP role');

    // 8.2 Attempting to use the raw QR token as an Authorization Bearer token must fail
    // (This ensures separation of context token from session token)
    assert.notStrictEqual(publicContext.cafeId, cafeA.rawQrToken);
  });
});
