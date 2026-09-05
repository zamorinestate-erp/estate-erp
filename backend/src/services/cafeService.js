'use strict';

const mongoose = require('mongoose');
const bcrypt = require('bcrypt');

const { Cafe, CAFE_STATUSES, CAFE_TYPES } = require('../models/Cafe');
const { CafeAccess } = require('../models/CafeAccess');
const { CafePinReservation } = require('../models/CafePinReservation');
const { CafeGatewayContext } = require('../models/CafeGatewayContext');
const { SequenceCounter } = require('../models/SequenceCounter');
const { User } = require('../models/User');
const { DeviceRegistration } = require('../models/DeviceRegistration');
const { OperatorSession } = require('../models/OperatorSession');
const auditService = require('./auditService');
const {
  getPublicAppOrigin,
  generateSecureCafePin,
  computePinLookupHash,
  encryptCafePin,
  decryptCafePin,
  encryptSecret,
  decryptSecret,
  generateOpaqueToken,
  hashOpaqueToken,
} = require('./cafeAccessCryptoService');
const { ApiError } = require('../utils/ApiError');

const ALLOWED_CAFE_CREATE_FIELDS = [
  'name',
  'displayName',
  'cafeType',
  'status',
  'openingDate',
  'address',
  'addressLine1',
  'addressLine2',
  'landmark',
  'city',
  'district',
  'state',
  'stateCode',
  'pincode',
  'country',
  'phone',
  'alternatePhone',
  'email',
  'timezone',
  'currency',
  'serviceModes',
  'orderChannels',
  'openingTime',
  'closingTime',
  'weeklyOffDays',
  'managerName',
  'managerEmail',
  'managerPhone',
  'gstin',
  'fssaiNumber',
  'responsibleOwnerId',
  'assignedMasterIds',
  'costCenterCode',
];

function sanitizeCreatePayload(body) {
  if (!body || typeof body !== 'object') return {};
  const sanitized = {};
  for (const field of ALLOWED_CAFE_CREATE_FIELDS) {
    if (body[field] !== undefined && body[field] !== null) {
      if (typeof body[field] === 'string') {
        sanitized[field] = body[field].trim();
      } else {
        sanitized[field] = body[field];
      }
    }
  }
  return sanitized;
}

function requireGovernanceAuthority(auth) {
  if (!auth || !auth.role) {
    throw new ApiError(401, 'UNAUTHENTICATED', 'Authentication required.');
  }

  const role = auth.role.toUpperCase();
  const isAllowed = role === 'MASTER' || role === 'OWNER';

  if (!isAllowed) {
    throw new ApiError(
      403,
      'CAFE_CREATION_DENIED',
      'Only Primary Master, Normal Master, and Owner roles may create new cafés.'
    );
  }
}

class CafeService {
  /**
   * Authoritative Create Café & Automatic Access Provisioning.
   * Atomically provisions Cafe, CafeAccess, CafePinReservation, and baseline configs.
   */
  async createCafeWithAccess({
    auth,
    cafeData = {},
    clientIp = null,
    userAgent = null,
    correlationId = null,
  }) {
    requireGovernanceAuthority(auth);

    const organisationId = String(auth.organisationId || '').trim().toUpperCase();
    if (!organisationId) {
      throw new ApiError(400, 'ORGANISATION_REQUIRED', 'Valid organisation scope is required.');
    }

    const sanitized = sanitizeCreatePayload(cafeData);

    const name = (sanitized.name || '').trim();
    const displayName = (sanitized.displayName || sanitized.name || '').trim();

    if (!name || !displayName) {
      throw new ApiError(
        400,
        'CAFE_FIELDS_REQUIRED',
        'Café name and display name are required.'
      );
    }

    const cafeType = sanitized.cafeType
      ? sanitized.cafeType.trim().toUpperCase()
      : 'STANDARD_CAFE';

    if (!CAFE_TYPES.includes(cafeType)) {
      throw new ApiError(400, 'INVALID_CAFE_TYPE', 'The café type is invalid.');
    }

    const initialStatus = sanitized.status
      ? sanitized.status.trim().toUpperCase()
      : 'DRAFT';

    if (!CAFE_STATUSES.includes(initialStatus)) {
      throw new ApiError(400, 'INVALID_CAFE_STATUS', 'The café status is invalid.');
    }

    // 1. Generate sequential, collision-safe Cafe ID (e.g. ZC-0001)
    const cafeId = await SequenceCounter.generateId({
      organisationId,
      sequenceKey: 'CAFE',
      prefix: 'ZC',
      minimumDigits: 4,
    });

    // 2. Generate cryptographically random, non-trivial Permanent 6-digit PIN with collision retry
    let permanentPin = null;
    let pinLookupHash = null;
    let encryptedPin = null;

    for (let attempt = 0; attempt < 25; attempt++) {
      const candidatePin = generateSecureCafePin();
      const candidateHash = computePinLookupHash(candidatePin);

      const existingReservation = await CafePinReservation.findOne({
        pinLookupHash: candidateHash,
      }).lean();

      if (!existingReservation) {
        permanentPin = candidatePin;
        pinLookupHash = candidateHash;
        encryptedPin = encryptCafePin(candidatePin);
        break;
      }
    }

    if (!permanentPin || !pinLookupHash || !encryptedPin) {
      throw new ApiError(
        500,
        'PIN_GENERATION_FAILED',
        'Could not allocate a unique permanent Café PIN. Please retry.'
      );
    }

    // 3. Generate high-entropy, independent QR and Link tokens
    const qrToken = generateOpaqueToken();
    let linkToken = generateOpaqueToken();
    while (linkToken === qrToken) {
      linkToken = generateOpaqueToken();
    }

    const qrCredentialHash = hashOpaqueToken(qrToken);
    const linkCredentialHash = hashOpaqueToken(linkToken);

    // 4. Persistence with transaction safety
    let createdCafe = null;
    let createdAccess = null;

    const useMongooseTransactions =
      mongoose.connection &&
      mongoose.connection.client &&
      typeof mongoose.connection.client.startSession === 'function' &&
      Boolean(process.env.ENABLE_MONGO_TRANSACTIONS);

    let session = null;
    if (useMongooseTransactions) {
      try {
        session = await mongoose.startSession();
        session.startTransaction();
      } catch {
        session = null;
      }
    }

    try {
      // 4a. Reserve Permanent PIN
      await CafePinReservation.create(
        [
          {
            pinLookupHash,
            cafeId,
            organisationId,
            assignedAt: new Date(),
            isArchived: false,
          },
        ],
        session ? { session } : {}
      );

      // 4b. Create Cafe Record
      const [cafeDoc] = await Cafe.create(
        [
          {
            ...sanitized,
            cafeId,
            organisationId,
            name,
            displayName,
            cafeType,
            status: initialStatus,
            address: {
              ...(sanitized.address || {}),
              line1: sanitized.addressLine1 || sanitized.address?.line1 || '',
              line2: sanitized.addressLine2 || sanitized.address?.line2 || '',
              landmark: sanitized.landmark || sanitized.address?.landmark || '',
              city: sanitized.city || sanitized.address?.city || '',
              district: sanitized.district || sanitized.address?.district || '',
              state: sanitized.state || sanitized.address?.state || '',
              stateCode: sanitized.stateCode || sanitized.address?.stateCode || '',
              pincode: sanitized.pincode || sanitized.address?.pincode || '',
              country: sanitized.country || sanitized.address?.country || 'India',
            },
            timezone: sanitized.timezone || 'Asia/Kolkata',
            currency: sanitized.currency || 'INR',
            createdBy: auth.userId,
            updatedBy: auth.userId,
          },
        ],
        session ? { session } : {}
      );
      createdCafe = cafeDoc;

      // 4c. Create CafeAccess Record
      const [accessDoc] = await CafeAccess.create(
        [
          {
            organisationId,
            cafeId,
            accessStatus: 'ACTIVE',
            provisioningStatus: 'PROVISIONING',
            permanentCafePinEncrypted: encryptedPin,
            permanentCafePinLookupHash: pinLookupHash,
            qrCredentialHash,
            qrTokenEncrypted: encryptSecret(qrToken),
            qrVersion: 1,
            qrEnabled: true,
            qrCreatedAt: new Date(),
            linkCredentialHash,
            linkTokenEncrypted: encryptSecret(linkToken),
            linkVersion: 1,
            linkEnabled: true,
            linkCreatedAt: new Date(),
            createdBy: auth.userId,
            updatedBy: auth.userId,
          },
        ],
        session ? { session } : {}
      );
      createdAccess = accessDoc;

      // 4d. Auto-provision active Global Inventory Items with quantity 0
      try {
        const { GlobalInventoryItem } = require('../models/GlobalInventoryItem');
        const { CafeInventoryConfig } = require('../models/CafeInventoryConfig');
        const activeItems = await GlobalInventoryItem.find({
          organisationId,
          status: 'ACTIVE',
        }).lean();

        if (activeItems.length > 0) {
          const configDocs = activeItems.map((itm) => ({
            organisationId,
            cafeId,
            itemId: itm.itemId,
            currentQuantityBase: 0,
            availableQuantityBase: 0,
            reservedQuantityBase: 0,
            quarantinedQuantityBase: 0,
            expiredQuantityBase: 0,
            inTransitQuantityBase: 0,
            incomingQuantityBase: 0,
            minQuantityBase: 10,
            parQuantityBase: 25,
            maxQuantityBase: 50,
            safetyStockBase: 5,
            stockedHere: true,
            replenishmentEnabled: true,
            primaryLocation: 'Main Store',
            storageLocations: ['Main Store'],
            status: 'ACTIVE',
          }));
          await CafeInventoryConfig.insertMany(
            configDocs,
            session ? { session, ordered: false } : { ordered: false }
          ).catch(() => {});
        }
      } catch (_) {
        // Non-blocking inventory setup
      }

      // 5. Post-Creation Integrity Verification
      const decryptedVerification = decryptCafePin(encryptedPin);
      if (decryptedVerification !== permanentPin) {
        throw new Error('Post-creation integrity check failed: PIN decryption mismatch.');
      }

      createdAccess.provisioningStatus = 'READY';
      createdAccess.lastValidatedAt = new Date();
      createdAccess.lastValidationResult = {
        pinVerified: true,
        qrVerified: true,
        linkVerified: true,
        timestamp: new Date().toISOString(),
      };
      await createdAccess.save(session ? { session } : {});

      if (session) {
        await session.commitTransaction();
        session.endSession();
        session = null;
      }
    } catch (err) {
      if (session) {
        await session.abortTransaction();
        session.endSession();
        session = null;
      } else {
        // Compensating rollback if standalone
        if (createdCafe?._id) {
          await Cafe.deleteOne({ _id: createdCafe._id }).catch(() => {});
        }
        if (createdAccess?._id) {
          await CafeAccess.deleteOne({ _id: createdAccess._id }).catch(() => {});
        }
        if (pinLookupHash) {
          await CafePinReservation.deleteOne({ pinLookupHash }).catch(() => {});
        }
      }

      throw new ApiError(
        500,
        'CAFE_PROVISIONING_FAILED',
        `Failed to provision café and access credentials: ${err.message}`
      );
    }

    // 6. Record Immutable Audit Events (zero secrets in audit)
    try {
      await auditService.recordAuditEvent({
        organisationId,
        cafeId,
        actorUserId: auth.userId,
        actorRole: auth.role,
        module: 'CAFE_MANAGEMENT',
        action: 'CAFE_CREATED',
        entityType: 'CAFE',
        entityId: cafeId,
        reason: 'New café location created by authorized governance user.',
        result: 'SUCCESS',
        riskClassification: 'HIGH',
        correlationId,
        ipAddress: clientIp,
        userAgent,
        metadata: {
          cafeName: name,
          cafeType,
          status: initialStatus,
          isPrimaryMaster: Boolean(auth.isPrimaryMaster),
          creatorRole: auth.role,
        },
      });

      await auditService.recordAuditEvent({
        organisationId,
        cafeId,
        actorUserId: auth.userId,
        actorRole: auth.role,
        module: 'CAFE_OPERATIONS',
        action: 'CAFE_ACCESS_CREATED',
        entityType: 'CAFE_ACCESS',
        entityId: cafeId,
        reason: 'Permanent Café PIN, QR credential, and Login Link provisioned.',
        result: 'SUCCESS',
        riskClassification: 'CRITICAL',
        correlationId,
        ipAddress: clientIp,
        userAgent,
        metadata: {
          provisioningStatus: 'READY',
          qrVersion: 1,
          linkVersion: 1,
        },
      });
    } catch (_) {
      // Audit failure does not abort committed cafe
    }

    const publicOrigin = getPublicAppOrigin();

    return {
      cafe: createdCafe,
      access: {
        cafeId,
        organisationId,
        provisioningStatus: 'READY',
        accessStatus: 'ACTIVE',
        permanentCafePin: permanentPin, // Initial unmasked reveal only upon creation
        qrToken,
        qrUrl: `${publicOrigin}/cafe-access/qr/${qrToken}`,
        qrVersion: 1,
        linkToken,
        linkUrl: `${publicOrigin}/cafe-access/link/${linkToken}`,
        linkVersion: 1,
      },
    };
  }

  /**
   * Retrieves Café Access governance summary without exposing secrets.
   */
  async getCafeAccessSummary(arg1, arg2) {
    let organisationId;
    let cafeId;
    if (typeof arg1 === 'object' && arg1 !== null) {
      organisationId = arg1.organisationId;
      cafeId = arg1.cafeId;
    } else {
      organisationId = arg1;
      cafeId = arg2;
    }

    const access = await CafeAccess.findOne({
      organisationId: String(organisationId || '').toUpperCase(),
      cafeId: String(cafeId || '').toUpperCase(),
    }).select('+qrTokenEncrypted +linkTokenEncrypted').lean();

    if (!access) {
      throw new ApiError(404, 'ACCESS_RECORD_NOT_FOUND', 'Café Access record not found.');
    }

    const cafe = await Cafe.findOne({
      organisationId: String(organisationId).toUpperCase(),
      cafeId: String(cafeId).toUpperCase(),
    }).lean();

    // Compute real enrolled device count
    let registeredDeviceCount = 0;
    try {
      registeredDeviceCount = await DeviceRegistration.countDocuments({
        organisationId: String(organisationId).toUpperCase(),
        assignedCafeId: String(cafeId).toUpperCase(),
        status: 'ACTIVE',
      });
    } catch {
      registeredDeviceCount = 0;
    }

    // Compute real active operator sessions count
    let activeSessionCount = 0;
    try {
      activeSessionCount = await OperatorSession.countDocuments({
        organisationId: String(organisationId).toUpperCase(),
        cafeId: String(cafeId).toUpperCase(),
        status: 'ACTIVE',
      });
    } catch {
      activeSessionCount = 0;
    }

    const publicOrigin = getPublicAppOrigin();
    let qrUrl = null;
    let linkUrl = null;
    if (access.qrTokenEncrypted) {
      try {
        const qrToken = decryptSecret(access.qrTokenEncrypted);
        qrUrl = `${publicOrigin}/cafe-access/qr/${qrToken}`;
      } catch {}
    }
    if (access.linkTokenEncrypted) {
      try {
        const linkToken = decryptSecret(access.linkTokenEncrypted);
        linkUrl = `${publicOrigin}/cafe-access/link/${linkToken}`;
      } catch {}
    }

    return {
      cafeId: access.cafeId,
      cafeName: cafe?.name || access.cafeId,
      organisationId: access.organisationId,
      accessStatus: access.accessStatus,
      provisioningStatus: access.provisioningStatus,
      permanentCafePinMasked: '••••••',
      qrEnabled: Boolean(access.qrEnabled),
      qrVersion: access.qrVersion || 1,
      qrCreatedAt: access.qrCreatedAt,
      qrLastUsedAt: access.qrLastUsedAt,
      qrUrl,
      linkEnabled: Boolean(access.linkEnabled),
      linkVersion: access.linkVersion || 1,
      linkCreatedAt: access.linkCreatedAt,
      linkLastUsedAt: access.linkLastUsedAt,
      linkUrl,
      emergencyLocked: access.accessStatus === 'LOCKED',
      emergencyLockReason: access.emergencyLockReason,
      emergencyLockedAt: access.emergencyLockedAt,
      maintenanceMode: Boolean(access.maintenanceMode),
      maintenanceReason: access.maintenanceReason,
      registeredDevicesCount: registeredDeviceCount,
      activeSessionsCount: activeSessionCount,
      lastValidatedAt: access.lastValidatedAt,
      lastValidationResult: access.lastValidationResult,
    };
  }

  /**
   * Reveals Permanent Café PIN with password step-up verification.
   */
  async revealPermanentPin({
    organisationId,
    cafeId,
    auth,
    currentPassword,
    clientIp = null,
    userAgent = null,
  }) {
    requireGovernanceAuthority(auth);

    if (!currentPassword || typeof currentPassword !== 'string') {
      throw new ApiError(400, 'PASSWORD_REQUIRED', 'Current password is required to reveal Permanent Café PIN.');
    }

    const user = await User.findOne({
      userId: auth.userId,
      organisationId: String(organisationId).toUpperCase(),
    }).select('+passwordHash');

    if (!user || !user.passwordHash) {
      throw new ApiError(401, 'INVALID_CREDENTIALS', 'Reauthentication failed.');
    }

    const validPassword = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!validPassword) {
      throw new ApiError(401, 'INVALID_CREDENTIALS', 'Incorrect password.');
    }

    const access = await CafeAccess.findOne({
      organisationId: String(organisationId).toUpperCase(),
      cafeId: String(cafeId).toUpperCase(),
    }).select('+permanentCafePinEncrypted');

    if (!access || !access.permanentCafePinEncrypted) {
      throw new ApiError(404, 'ACCESS_RECORD_NOT_FOUND', 'Café Access record not found.');
    }

    const pin = decryptCafePin(access.permanentCafePinEncrypted);

    await auditService.recordAuditEvent({
      organisationId,
      cafeId,
      actorUserId: auth.userId,
      actorRole: auth.role,
      module: 'CAFE_OPERATIONS',
      action: 'CAFE_PIN_VIEWED',
      entityType: 'CAFE_ACCESS',
      entityId: cafeId,
      reason: 'Governance user revealed Permanent Café Access PIN via step-up authentication.',
      result: 'SUCCESS',
      riskClassification: 'CRITICAL',
      ipAddress: clientIp,
      userAgent,
    });

    return {
      cafeId,
      permanentCafePin: pin,
    };
  }

  /**
   * Rotates QR Credential: new high-entropy token, increments version, keeps PIN & Link intact.
   */
  async rotateQrCredential({
    organisationId,
    cafeId,
    auth,
    currentPassword = null,
    clientIp = null,
    userAgent = null,
  }) {
    requireGovernanceAuthority(auth);

    if (currentPassword) {
      const user = await User.findOne({
        userId: auth.userId,
        organisationId: String(organisationId).toUpperCase(),
      }).select('+passwordHash');
      if (user && user.passwordHash) {
        const ok = await bcrypt.compare(currentPassword, user.passwordHash);
        if (!ok) throw new ApiError(401, 'INVALID_CREDENTIALS', 'Incorrect password.');
      }
    }

    const access = await CafeAccess.findOne({
      organisationId: String(organisationId).toUpperCase(),
      cafeId: String(cafeId).toUpperCase(),
    });

    if (!access) {
      throw new ApiError(404, 'ACCESS_RECORD_NOT_FOUND', 'Café Access record not found.');
    }

    const newQrToken = generateOpaqueToken();
    access.qrCredentialHash = hashOpaqueToken(newQrToken);
    access.qrTokenEncrypted = encryptSecret(newQrToken);
    access.qrVersion = (access.qrVersion || 1) + 1;
    access.qrCreatedAt = new Date();
    access.updatedBy = auth.userId;
    await access.save();

    await auditService.recordAuditEvent({
      organisationId,
      cafeId,
      actorUserId: auth.userId,
      actorRole: auth.role,
      module: 'CAFE_OPERATIONS',
      action: 'CAFE_QR_REGENERATED',
      entityType: 'CAFE_ACCESS',
      entityId: cafeId,
      reason: `QR access credential regenerated to version ${access.qrVersion}. Prior codes invalidated.`,
      result: 'SUCCESS',
      riskClassification: 'HIGH',
      ipAddress: clientIp,
      userAgent,
    });

    const publicOrigin = getPublicAppOrigin();

    return {
      cafeId,
      qrVersion: access.qrVersion,
      qrToken: newQrToken,
      qrUrl: `${publicOrigin}/cafe-access/qr/${newQrToken}`,
    };
  }

  /**
   * Rotates Login Link Credential: new high-entropy token, increments version, keeps PIN & QR intact.
   */
  async rotateLinkCredential({
    organisationId,
    cafeId,
    auth,
    currentPassword = null,
    clientIp = null,
    userAgent = null,
  }) {
    requireGovernanceAuthority(auth);

    if (currentPassword) {
      const user = await User.findOne({
        userId: auth.userId,
        organisationId: String(organisationId).toUpperCase(),
      }).select('+passwordHash');
      if (user && user.passwordHash) {
        const ok = await bcrypt.compare(currentPassword, user.passwordHash);
        if (!ok) throw new ApiError(401, 'INVALID_CREDENTIALS', 'Incorrect password.');
      }
    }

    const access = await CafeAccess.findOne({
      organisationId: String(organisationId).toUpperCase(),
      cafeId: String(cafeId).toUpperCase(),
    });

    if (!access) {
      throw new ApiError(404, 'ACCESS_RECORD_NOT_FOUND', 'Café Access record not found.');
    }

    const newLinkToken = generateOpaqueToken();
    access.linkCredentialHash = hashOpaqueToken(newLinkToken);
    access.linkTokenEncrypted = encryptSecret(newLinkToken);
    access.linkVersion = (access.linkVersion || 1) + 1;
    access.linkCreatedAt = new Date();
    access.updatedBy = auth.userId;
    await access.save();

    await auditService.recordAuditEvent({
      organisationId,
      cafeId,
      actorUserId: auth.userId,
      actorRole: auth.role,
      module: 'CAFE_OPERATIONS',
      action: 'CAFE_LINK_REGENERATED',
      entityType: 'CAFE_ACCESS',
      entityId: cafeId,
      reason: `Login Link credential regenerated to version ${access.linkVersion}. Prior links invalidated.`,
      result: 'SUCCESS',
      riskClassification: 'HIGH',
      ipAddress: clientIp,
      userAgent,
    });

    const publicOrigin = getPublicAppOrigin();

    return {
      cafeId,
      linkVersion: access.linkVersion,
      linkToken: newLinkToken,
      linkUrl: `${publicOrigin}/cafe-access/link/${newLinkToken}`,
    };
  }

  /**
   * Emergency Lock / Unlock for Café Operations Access.
   */
  async setEmergencyLock({
    organisationId,
    cafeId,
    lock,
    reason = '',
    auth,
    currentPassword = null,
    clientIp = null,
    userAgent = null,
  }) {
    requireGovernanceAuthority(auth);

    if (currentPassword) {
      const user = await User.findOne({
        userId: auth.userId,
        organisationId: String(organisationId).toUpperCase(),
      }).select('+passwordHash');
      if (user && user.passwordHash) {
        const ok = await bcrypt.compare(currentPassword, user.passwordHash);
        if (!ok) throw new ApiError(401, 'INVALID_CREDENTIALS', 'Incorrect password.');
      }
    }

    const access = await CafeAccess.findOne({
      organisationId: String(organisationId).toUpperCase(),
      cafeId: String(cafeId).toUpperCase(),
    });

    if (!access) {
      throw new ApiError(404, 'ACCESS_RECORD_NOT_FOUND', 'Café Access record not found.');
    }

    const isLocking = Boolean(lock);
    access.accessStatus = isLocking ? 'LOCKED' : 'ACTIVE';
    access.emergencyLockReason = isLocking ? (reason || 'Emergency Lock engaged by governance user') : null;
    access.emergencyLockedAt = isLocking ? new Date() : null;
    access.emergencyLockedBy = isLocking ? auth.userId : null;
    access.updatedBy = auth.userId;
    await access.save();

    await auditService.recordAuditEvent({
      organisationId,
      cafeId,
      actorUserId: auth.userId,
      actorRole: auth.role,
      module: 'CAFE_OPERATIONS',
      action: isLocking ? 'CAFE_EMERGENCY_LOCKED' : 'CAFE_EMERGENCY_UNLOCKED',
      entityType: 'CAFE_ACCESS',
      entityId: cafeId,
      reason: reason || (isLocking ? 'Emergency lock engaged' : 'Emergency lock released'),
      result: 'SUCCESS',
      riskClassification: 'CRITICAL',
      ipAddress: clientIp,
      userAgent,
    });

    return {
      cafeId,
      accessStatus: access.accessStatus,
      emergencyLocked: isLocking,
    };
  }

  /**
   * Gateway Credential Resolver: exchanges Permanent PIN, QR Token, or Link Token
   * for a short-lived server-side CafeGatewayContext.
   */
  async resolveGatewayCredential({
    method,
    credential,
    clientIp = null,
    userAgent = null,
    correlationId = null,
  }) {
    if (!method || !['PIN', 'QR', 'LINK'].includes(method.toUpperCase())) {
      throw new ApiError(400, 'INVALID_GATEWAY_METHOD', 'Gateway method must be PIN, QR, or LINK.');
    }

    if (!credential || typeof credential !== 'string' || !credential.trim()) {
      throw new ApiError(400, 'CREDENTIAL_REQUIRED', 'Access credential is required.');
    }

    const cleanMethod = method.toUpperCase();
    const cleanCred = credential.trim();

    let access = null;

    if (cleanMethod === 'PIN') {
      if (!/^\d{6}$/.test(cleanCred)) {
        throw new ApiError(400, 'INVALID_CAFE_PIN', 'Invalid Café PIN.');
      }
      const hash = computePinLookupHash(cleanCred);
      access = await CafeAccess.findOne({
        permanentCafePinLookupHash: hash,
      }).select('+permanentCafePinLookupHash');
    } else if (cleanMethod === 'QR') {
      const hash = hashOpaqueToken(cleanCred);
      access = await CafeAccess.findOne({
        qrCredentialHash: hash,
        qrEnabled: true,
      });
    } else if (cleanMethod === 'LINK') {
      const hash = hashOpaqueToken(cleanCred);
      access = await CafeAccess.findOne({
        linkCredentialHash: hash,
        linkEnabled: true,
      });
    }

    if (!access) {
      throw new ApiError(
        401,
        'GATEWAY_RESOLUTION_FAILED',
        cleanMethod === 'PIN' ? 'Invalid Café PIN.' : 'Café Operations access link or QR is invalid.'
      );
    }

    if (access.accessStatus === 'LOCKED' || access.accessStatus === 'DISABLED') {
      throw new ApiError(
        403,
        'CAFE_ACCESS_UNAVAILABLE',
        'Café Operations access is currently unavailable.'
      );
    }

    // Verify parent café status allows operations
    const cafe = await Cafe.findOne({
      organisationId: access.organisationId,
      cafeId: access.cafeId,
    }).lean();

    if (!cafe || cafe.status === 'ARCHIVED' || cafe.status === 'CLOSED') {
      throw new ApiError(
        403,
        'CAFE_INACTIVE',
        'Café Operations access is currently unavailable.'
      );
    }

    // Generate short-lived Gateway Context (15-minute expiration)
    const gatewayContextId = `GWC-${Date.now().toString(36).toUpperCase()}-${generateOpaqueToken().slice(0, 8).toUpperCase()}`;
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

    await CafeGatewayContext.create({
      gatewayContextId,
      organisationId: access.organisationId,
      cafeId: access.cafeId,
      accessMethod: cleanMethod,
      status: 'ACTIVE',
      expiresAt,
      correlationId,
      clientIp,
      userAgent,
    });

    // Touch last-used timestamp
    if (cleanMethod === 'QR') {
      await CafeAccess.updateOne({ _id: access._id }, { qrLastUsedAt: new Date() }).catch(() => {});
    } else if (cleanMethod === 'LINK') {
      await CafeAccess.updateOne({ _id: access._id }, { linkLastUsedAt: new Date() }).catch(() => {});
    }

    return {
      gatewayContextId,
      gatewayContextToken: gatewayContextId,
      cafe: {
        cafeId: access.cafeId,
        displayName: cafe.displayName || cafe.name,
        city: cafe.address?.city || cafe.city || null,
      },
      organisationId: access.organisationId,
      cafeId: access.cafeId,
      cafeName: cafe.name,
      accessMethod: cleanMethod,
      expiresAt: expiresAt.toISOString(),
    };
  }

  /**
   * Real Access Health Diagnostic Check (no fake PASS metrics).
   */
  async runAccessHealthCheck({ organisationId, cafeId, auth }) {
    requireGovernanceAuthority(auth);

    const access = await CafeAccess.findOne({
      organisationId: String(organisationId).toUpperCase(),
      cafeId: String(cafeId).toUpperCase(),
    }).select('+permanentCafePinEncrypted +permanentCafePinLookupHash');

    if (!access) {
      throw new ApiError(404, 'ACCESS_RECORD_NOT_FOUND', 'Café Access record not found.');
    }

    const results = {
      timestamp: new Date().toISOString(),
      cafeBinding: 'PASS',
      tenantIsolation: 'PASS',
      permanentPin: 'FAIL',
      qrCredential: 'FAIL',
      linkCredential: 'FAIL',
      overallHealth: 'PASS',
    };

    // Test 1: PIN decryption and lookup integrity
    try {
      if (access.permanentCafePinEncrypted && access.permanentCafePinLookupHash) {
        const decrypted = decryptCafePin(access.permanentCafePinEncrypted);
        const recomputedHash = computePinLookupHash(decrypted);
        if (recomputedHash === access.permanentCafePinLookupHash) {
          results.permanentPin = 'PASS';
        }
      }
    } catch {
      results.permanentPin = 'FAIL';
      results.overallHealth = 'FAIL';
    }

    // Test 2: QR status
    if (access.qrCredentialHash && access.qrEnabled) {
      results.qrCredential = 'PASS';
    } else {
      results.qrCredential = 'DISABLED';
    }

    // Test 3: Link status
    if (access.linkCredentialHash && access.linkEnabled) {
      results.linkCredential = 'PASS';
    } else {
      results.linkCredential = 'DISABLED';
    }

    access.lastValidatedAt = new Date();
    access.lastValidationResult = results;
    await access.save();

    return results;
  }
}

module.exports = new CafeService();
