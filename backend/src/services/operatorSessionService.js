'use strict';

const crypto = require('node:crypto');
const bcrypt = require('bcrypt');

const { User } = require('../models/User');
const { DeviceRegistration } = require('../models/DeviceRegistration');
const { OperatorSession } = require('../models/OperatorSession');
const { AuditEvent } = require('../models/AuditEvent');
const { ApiError } = require('../utils/ApiError');

const PIN_HASH_ROUNDS = 12;
const MAX_FAILED_PIN_ATTEMPTS = 5;
const PIN_LOCK_MINUTES = 15;
const INACTIVITY_LOCK_MINUTES = 30;

class OperatorSessionService {
  /**
   * Hashes a 6-digit Operator PIN.
   */
  async hashPin(pin) {
    if (!pin || !/^\d{6}$/.test(String(pin))) {
      throw new ApiError(400, 'INVALID_OPERATOR_PIN', 'Operator PIN must be exactly 6 digits.');
    }
    return bcrypt.hash(String(pin), PIN_HASH_ROUNDS);
  }

  /**
   * Sets or resets an Operator PIN for an eligible employee.
   */
  async setOperatorPin({ organisationId, targetUserId, actorUserId, actorRole, newPin }) {
    if (!newPin || !/^\d{6}$/.test(String(newPin))) {
      throw new ApiError(400, 'INVALID_OPERATOR_PIN', 'Operator PIN must be exactly 6 numeric digits.');
    }

    // Weak PIN check
    const weakPins = ['000000', '111111', '123456', '654321', '999999', '121212'];
    if (weakPins.includes(String(newPin))) {
      throw new ApiError(400, 'WEAK_OPERATOR_PIN', 'Please choose a stronger, non-sequential 6-digit PIN.');
    }

    const user = await User.findOne({
      organisationId: organisationId.toUpperCase(),
      userId: targetUserId.toUpperCase(),
    });

    if (!user) {
      throw new ApiError(404, 'USER_NOT_FOUND', `User ${targetUserId} was not found.`);
    }

    // Role check: Only MASTER or the user themselves can set their PIN
    if (actorRole !== 'MASTER' && actorUserId !== targetUserId) {
      throw new ApiError(403, 'UNAUTHORIZED_PIN_SETUP', 'Only Master or the user themselves can configure Operator PIN.');
    }

    const pinHash = await this.hashPin(newPin);
    user.operatorPinHash = pinHash;
    user.operatorPinSetAt = new Date();
    user.operatorPinFailedAttempts = 0;
    user.operatorPinLockedUntil = null;

    await user.save();

    await AuditEvent.create({
      organisationId: user.organisationId,
      action: 'OPERATOR_PIN_SET',
      actor: {
        userId: actorUserId,
        role: actorRole,
      },
      target: {
        entityType: 'USER',
        entityId: user.userId,
      },
      details: {
        targetUserId: user.userId,
        reason: 'Operator PIN configured / updated',
      },
    });

    return {
      success: true,
      message: 'Operator PIN configured successfully.',
      userId: user.userId,
    };
  }

  /**
   * Operator Sign-In on a cafe-owned, trusted device.
   */
  async signInOperator({ organisationId, deviceId, operatorUserId, pin, clientIp, userAgent, correlationId }) {
    const orgId = (organisationId || 'ZAMORIN').toUpperCase();

    // 1. Device Verification
    if (!deviceId) {
      throw new ApiError(400, 'DEVICE_ID_REQUIRED', 'Cafe Operations require a registered device ID.');
    }

    const device = await DeviceRegistration.findOne({
      deviceId,
      organisationId: orgId,
    });

    if (!device) {
      throw new ApiError(403, 'DEVICE_NOT_REGISTERED', 'This device is not enrolled in Zamorin Cafe Operations.');
    }

    if (device.deviceClass !== 'CAFE_OWNED') {
      throw new ApiError(403, 'PERSONAL_DEVICE_DENIED', 'Cafe Operations is only accessible on cafe-owned trusted devices.');
    }

    if (device.status !== 'ACTIVE') {
      throw new ApiError(403, 'DEVICE_INACTIVE', `This device is currently ${device.status}. Cafe Operations access is blocked.`);
    }

    if (!device.assignedCafeId) {
      throw new ApiError(403, 'DEVICE_UNASSIGNED', 'This device has not been assigned to a specific cafe.');
    }

    // 2. Operator Identification & Role Verification
    if (!operatorUserId || !pin) {
      throw new ApiError(400, 'MISSING_CREDENTIALS', 'Operator ID and 6-digit PIN are required.');
    }

    const user = await User.findOne({
      organisationId: orgId,
      userId: operatorUserId.toUpperCase(),
    }).select('+operatorPinHash');

    if (!user) {
      throw new ApiError(401, 'INVALID_OPERATOR_CREDENTIALS', 'Operator code not recognised. Please try again.');
    }

    if (user.accountStatus !== 'ACTIVE') {
      throw new ApiError(403, 'OPERATOR_INACTIVE', 'Operator account is not active.');
    }

    // Invariant: STAFF cannot elevate on a trusted device
    if (user.role === 'STAFF') {
      throw new ApiError(403, 'STAFF_ELEVATION_DENIED', 'Staff users cannot access Cafe Operations without explicit Operator authorization.');
    }

    // Only CAFE_ADMIN and MASTER can operate
    if (user.role !== 'CAFE_ADMIN' && user.role !== 'MASTER') {
      throw new ApiError(403, 'UNAUTHORIZED_ROLE', 'User does not possess Cafe Operations authority.');
    }

    // 3. Cafe Assignment Matching (Strict Invariant: No cross-cafe leakage)
    const deviceCafe = device.assignedCafeId;
    let isCafeAllowed = false;

    if (user.role === 'MASTER') {
      isCafeAllowed = true;
    } else {
      if (user.primaryCafeId === deviceCafe) {
        isCafeAllowed = true;
      } else if (Array.isArray(user.assignedCafeIds) && user.assignedCafeIds.includes(deviceCafe)) {
        isCafeAllowed = true;
      } else if (
        user.cafeOperatorAccess &&
        user.cafeOperatorAccess.active &&
        user.cafeOperatorAccess.assignedCafeId === deviceCafe &&
        (!user.cafeOperatorAccess.validUntil || new Date(user.cafeOperatorAccess.validUntil) >= new Date())
      ) {
        isCafeAllowed = true;
      }
    }

    if (!isCafeAllowed) {
      await AuditEvent.create({
        organisationId: orgId,
        action: 'OPERATOR_WRONG_CAFE_ATTEMPT',
        actor: { userId: user.userId, role: user.role },
        target: { entityType: 'DEVICE', entityId: device.deviceId },
        details: { deviceCafeId: deviceCafe, userPrimaryCafeId: user.primaryCafeId },
      });
      throw new ApiError(403, 'WRONG_CAFE_ACCESS', 'Operator is not assigned to this cafe location.');
    }

    // 4. Rate-Limiting & Lockout Check
    if (user.operatorPinLockedUntil && new Date(user.operatorPinLockedUntil) > new Date()) {
      const waitMinutes = Math.ceil((new Date(user.operatorPinLockedUntil) - new Date()) / 60000);
      throw new ApiError(429, 'OPERATOR_PIN_LOCKED', `Too many failed attempts. Try again in ${waitMinutes} minute(s).`);
    }

    // If user does not have PIN set yet, set it or throw
    if (!user.operatorPinHash) {
      throw new ApiError(403, 'OPERATOR_PIN_NOT_SET', 'Operator PIN has not been set for this account. Please contact Master Administrator.');
    }

    // 5. PIN Verification
    const isPinValid = await bcrypt.compare(String(pin), user.operatorPinHash);
    if (!isPinValid) {
      user.operatorPinFailedAttempts = (user.operatorPinFailedAttempts || 0) + 1;
      if (user.operatorPinFailedAttempts >= MAX_FAILED_PIN_ATTEMPTS) {
        user.operatorPinLockedUntil = new Date(Date.now() + PIN_LOCK_MINUTES * 60 * 1000);
      }
      await user.save();

      await AuditEvent.create({
        organisationId: orgId,
        action: 'OPERATOR_AUTH_FAILED',
        actor: { userId: user.userId, role: user.role },
        target: { entityType: 'DEVICE', entityId: device.deviceId },
        details: { failedAttempts: user.operatorPinFailedAttempts },
      });

      throw new ApiError(401, 'INVALID_OPERATOR_CREDENTIALS', 'Operator code not recognised. Please try again.');
    }

    // Reset failed attempts on success
    user.operatorPinFailedAttempts = 0;
    user.operatorPinLockedUntil = null;
    await user.save();

    // 6. Close Any Existing Active Operator Sessions on this Device
    await OperatorSession.updateMany(
      { deviceId: device.deviceId, status: { $in: ['ACTIVE', 'LOCKED'] } },
      {
        $set: {
          status: 'ENDED',
          endedAt: new Date(),
          endReason: 'SWITCH_OPERATOR',
        },
      }
    );

    // 7. Create New Active Operator Session
    const operatorSessionId = `OPS-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
    const session = await OperatorSession.create({
      operatorSessionId,
      organisationId: orgId,
      cafeId: deviceCafe,
      deviceId: device.deviceId,
      operatorUserId: user.userId,
      operatorNameSnapshot: user.name,
      status: 'ACTIVE',
      authMethod: 'OPERATOR_PIN',
      sessionStartedAt: new Date(),
      lastActivityAt: new Date(),
    });

    // Update device last seen
    device.lastSeenAt = new Date();
    device.lastSyncAt = new Date();
    await device.save();

    // Record Audit Event
    await AuditEvent.create({
      organisationId: orgId,
      action: 'OPERATOR_SESSION_STARTED',
      actor: { userId: user.userId, role: user.role },
      target: { entityType: 'OPERATOR_SESSION', entityId: session.operatorSessionId },
      details: {
        cafeId: deviceCafe,
        deviceId: device.deviceId,
        operatorUserId: user.userId,
      },
    });

    return {
      success: true,
      operatorSession: {
        operatorSessionId: session.operatorSessionId,
        cafeId: session.cafeId,
        deviceId: session.deviceId,
        operatorUserId: session.operatorUserId,
        operatorName: session.operatorNameSnapshot,
        status: session.status,
        sessionStartedAt: session.sessionStartedAt,
      },
      cafeContext: {
        cafeId: deviceCafe,
        deviceName: device.deviceName,
        businessDate: new Date().toISOString().slice(0, 10),
      },
    };
  }

  /**
   * Locks an active operator session.
   */
  async lockOperatorSession({ operatorSessionId, deviceId, operatorUserId }) {
    const session = await OperatorSession.findOne({
      operatorSessionId,
      status: 'ACTIVE',
    });

    if (!session) {
      throw new ApiError(404, 'SESSION_NOT_FOUND', 'Active operator session not found.');
    }

    session.status = 'LOCKED';
    session.lockedAt = new Date();
    session.lastActivityAt = new Date();
    await session.save();

    await AuditEvent.create({
      organisationId: session.organisationId,
      action: 'OPERATOR_SESSION_LOCKED',
      actor: { userId: session.operatorUserId, role: 'CAFE_ADMIN' },
      target: { entityType: 'OPERATOR_SESSION', entityId: session.operatorSessionId },
      details: { deviceId: session.deviceId, cafeId: session.cafeId },
    });

    return {
      success: true,
      message: 'Operator session locked.',
      operatorSession: session,
    };
  }

  /**
   * Unlocks a locked operator session using the operator PIN.
   */
  async unlockOperatorSession({ operatorSessionId, pin }) {
    const session = await OperatorSession.findOne({
      operatorSessionId,
      status: 'LOCKED',
    });

    if (!session) {
      throw new ApiError(404, 'SESSION_NOT_FOUND', 'Locked operator session not found.');
    }

    const user = await User.findOne({
      organisationId: session.organisationId,
      userId: session.operatorUserId,
    }).select('+operatorPinHash');

    if (!user || !user.operatorPinHash) {
      throw new ApiError(401, 'INVALID_OPERATOR_CREDENTIALS', 'Operator code not recognised.');
    }

    const isValid = await bcrypt.compare(String(pin), user.operatorPinHash);
    if (!isValid) {
      throw new ApiError(401, 'INVALID_OPERATOR_CREDENTIALS', 'Incorrect Operator PIN.');
    }

    session.status = 'ACTIVE';
    session.lockedAt = null;
    session.lastActivityAt = new Date();
    await session.save();

    await AuditEvent.create({
      organisationId: session.organisationId,
      action: 'OPERATOR_SESSION_UNLOCKED',
      actor: { userId: session.operatorUserId, role: 'CAFE_ADMIN' },
      target: { entityType: 'OPERATOR_SESSION', entityId: session.operatorSessionId },
      details: { deviceId: session.deviceId, cafeId: session.cafeId },
    });

    return {
      success: true,
      message: 'Operator session unlocked.',
      operatorSession: session,
    };
  }

  /**
   * Ends an active or locked session and starts a new one for a new operator.
   */
  async switchOperator({ operatorSessionId, handoverNote, newOperatorUserId, newPin, deviceId, organisationId }) {
    if (operatorSessionId) {
      const currentSession = await OperatorSession.findOne({
        operatorSessionId,
        status: { $in: ['ACTIVE', 'LOCKED'] },
      });

      if (currentSession) {
        currentSession.status = 'ENDED';
        currentSession.endedAt = new Date();
        currentSession.endReason = 'SWITCH_OPERATOR';
        if (handoverNote) {
          currentSession.handoverNote = handoverNote;
        }
        await currentSession.save();
      }
    }

    // Sign in the new operator
    return this.signInOperator({
      organisationId,
      deviceId,
      operatorUserId: newOperatorUserId,
      pin: newPin,
    });
  }

  /**
   * Closes an active operator session.
   */
  async endOperatorSession({ operatorSessionId, endReason = 'MANUAL_END' }) {
    const session = await OperatorSession.findOne({
      operatorSessionId,
      status: { $in: ['ACTIVE', 'LOCKED'] },
    });

    if (!session) {
      return { success: true, message: 'Session already ended or not found.' };
    }

    session.status = 'ENDED';
    session.endedAt = new Date();
    session.endReason = endReason;
    await session.save();

    await AuditEvent.create({
      organisationId: session.organisationId,
      action: 'OPERATOR_SESSION_ENDED',
      actor: { userId: session.operatorUserId, role: 'CAFE_ADMIN' },
      target: { entityType: 'OPERATOR_SESSION', entityId: session.operatorSessionId },
      details: { deviceId: session.deviceId, cafeId: session.cafeId, endReason },
    });

    return {
      success: true,
      message: 'Operator session ended.',
    };
  }

  /**
   * Retrieves current active session for a device.
   */
  async getCurrentOperatorSession({ deviceId, organisationId }) {
    const session = await OperatorSession.findOne({
      deviceId,
      organisationId: organisationId.toUpperCase(),
      status: { $in: ['ACTIVE', 'LOCKED'] },
    }).sort({ sessionStartedAt: -1 });

    if (!session) {
      return null;
    }

    // Check inactivity
    const now = new Date();
    const elapsedMinutes = (now - new Date(session.lastActivityAt)) / 60000;
    if (elapsedMinutes > INACTIVITY_LOCK_MINUTES && session.status === 'ACTIVE') {
      session.status = 'LOCKED';
      session.lockedAt = now;
      await session.save();
    }

    return session;
  }

  /**
   * Lists Operator Sessions for governance and auditing.
   */
  async listOperatorSessions({ organisationId, cafeId, operatorUserId, deviceId, status, dateFrom, dateTo, page = 1, limit = 20 }) {
    const filter = {
      organisationId: organisationId.toUpperCase(),
    };

    if (cafeId && cafeId !== '*') {
      filter.cafeId = cafeId.toUpperCase();
    }
    if (operatorUserId) {
      filter.operatorUserId = operatorUserId.toUpperCase();
    }
    if (deviceId) {
      filter.deviceId = deviceId;
    }
    if (status) {
      filter.status = status;
    }
    if (dateFrom || dateTo) {
      filter.sessionStartedAt = {};
      if (dateFrom) filter.sessionStartedAt.$gte = new Date(dateFrom);
      if (dateTo) filter.sessionStartedAt.$lte = new Date(dateTo);
    }

    const skip = (Math.max(1, page) - 1) * limit;
    const [sessions, total] = await Promise.all([
      OperatorSession.find(filter).sort({ sessionStartedAt: -1 }).skip(skip).limit(limit).lean(),
      OperatorSession.countDocuments(filter),
    ]);

    return {
      sessions,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Master Account Sign-In on a cafe-owned, trusted device.
   * Authenticates using canonical Master password.
   * Creates Master Cafe Operations Session (workspaceMode: 'CAFE_OPERATIONS') without side-effects on Attendance.
   */
  async signInMasterOperator({ organisationId, deviceId, masterUserId, password, mfaCode, clientIp, userAgent, correlationId }) {
    const orgId = (organisationId || 'ZAMORIN').toUpperCase();

    // 1. Device Verification
    if (!deviceId) {
      throw new ApiError(400, 'DEVICE_ID_REQUIRED', 'Cafe Operations require a registered device ID.');
    }

    const device = await DeviceRegistration.findOne({
      deviceId,
      organisationId: orgId,
    });

    if (!device || device.deviceClass !== 'CAFE_OWNED' || device.status !== 'ACTIVE' || !device.assignedCafeId) {
      throw new ApiError(403, 'DEVICE_NOT_ELIGIBLE', 'Cafe Operations is only accessible on active cafe-owned devices assigned to a cafe.');
    }

    // 2. Master Identification & Password Verification
    if (!masterUserId || !password) {
      throw new ApiError(400, 'MISSING_CREDENTIALS', 'Master identifier and password are required.');
    }

    const user = await User.findOne({
      organisationId: orgId,
      userId: masterUserId.toUpperCase(),
    }).select('+passwordHash +mfaSecret');

    if (!user || user.role !== 'MASTER') {
      throw new ApiError(401, 'INVALID_MASTER_CREDENTIALS', 'Invalid Master credentials.');
    }

    if (user.accountStatus !== 'ACTIVE') {
      throw new ApiError(403, 'ACCOUNT_INACTIVE', 'Master account is not active.');
    }

    const { verifyPassword } = require('./authService');
    const isPasswordValid = await verifyPassword(password, user.passwordHash);
    if (!isPasswordValid) {
      await AuditEvent.create({
        organisationId: orgId,
        action: 'MASTER_CAFE_OPS_AUTH_FAILED',
        actor: { userId: user.userId, role: 'MASTER' },
        target: { entityType: 'DEVICE', entityId: device.deviceId },
        details: { reason: 'INVALID_PASSWORD' },
      });
      throw new ApiError(401, 'INVALID_MASTER_CREDENTIALS', 'Invalid Master credentials.');
    }

    // 3. Close any existing operator sessions on device
    await OperatorSession.updateMany(
      { deviceId: device.deviceId, status: { $in: ['ACTIVE', 'LOCKED'] } },
      {
        $set: {
          status: 'ENDED',
          endedAt: new Date(),
          endReason: 'SWITCH_MASTER_OPERATOR',
        },
      }
    );

    // 4. Create Master Cafe Operations Session (strictly single-cafe scope)
    const operatorSessionId = `OPS-MST-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
    const session = await OperatorSession.create({
      operatorSessionId,
      organisationId: orgId,
      cafeId: device.assignedCafeId,
      deviceId: device.deviceId,
      operatorUserId: user.userId,
      operatorNameSnapshot: user.name,
      status: 'ACTIVE',
      authMethod: 'MASTER_PASSWORD_MFA',
      workspaceMode: 'CAFE_OPERATIONS',
      sessionStartedAt: new Date(),
      lastActivityAt: new Date(),
    });

    device.lastSeenAt = new Date();
    device.lastSyncAt = new Date();
    await device.save();

    await AuditEvent.create({
      organisationId: orgId,
      action: 'MASTER_CAFE_OPS_SESSION_STARTED',
      actor: { userId: user.userId, role: 'MASTER' },
      target: { entityType: 'OPERATOR_SESSION', entityId: session.operatorSessionId },
      details: {
        cafeId: device.assignedCafeId,
        deviceId: device.deviceId,
        operatorUserId: user.userId,
        workspaceMode: 'CAFE_OPERATIONS',
      },
    });

    return {
      success: true,
      operatorSession: {
        operatorSessionId: session.operatorSessionId,
        cafeId: session.cafeId,
        deviceId: session.deviceId,
        operatorUserId: session.operatorUserId,
        operatorName: session.operatorNameSnapshot,
        operatorRole: 'MASTER',
        workspaceMode: 'CAFE_OPERATIONS',
        status: session.status,
        sessionStartedAt: session.sessionStartedAt,
      },
      cafeContext: {
        cafeId: device.assignedCafeId,
        deviceName: device.deviceName,
        businessDate: new Date().toISOString().slice(0, 10),
      },
    };
  }

  /**
   * Acknowledges an incoming handover note.
   */
  async acknowledgeHandover({ operatorSessionId, acknowledgingOperatorId }) {
    const session = await OperatorSession.findOne({ operatorSessionId });
    if (!session) {
      throw new ApiError(404, 'SESSION_NOT_FOUND', 'Session not found.');
    }

    session.handoverAcknowledgedBy = acknowledgingOperatorId.toUpperCase();
    session.handoverAcknowledgedAt = new Date();
    await session.save();

    return {
      success: true,
      message: 'Handover note acknowledged.',
      session,
    };
  }
}

module.exports = new OperatorSessionService();
