'use strict';

const crypto = require('node:crypto');
const { DeviceRegistration } = require('../models/DeviceRegistration');
const { DeviceSecurityEvent } = require('../models/DeviceSecurityEvent');
const { defaultEventBus } = require('./distributedEventBus');
const { defaultPresenceService } = require('./devicePresenceService');

class DeviceTrustService {
  /**
   * Derives the effective privilege profile from human role and device context.
   *
   * Invariant:
   * CAFE_ADMIN + PERSONAL => SELF_ONLY
   * CAFE_ADMIN + ACTIVE CAFE_OWNED (bound to cafe) => CAFE_OPERATIONS
   */
  derivePrivilegeProfile(role, deviceRegistration, requestedCafeId = null) {
    if (role === 'MASTER') {
      if (
        deviceRegistration &&
        deviceRegistration.deviceClass === 'CAFE_OWNED' &&
        deviceRegistration.status === 'ACTIVE' &&
        deviceRegistration.assignedCafeId
      ) {
        const boundCafe = deviceRegistration.assignedCafeId;
        if (requestedCafeId && requestedCafeId !== '*' && requestedCafeId !== boundCafe) {
          return {
            privilegeProfile: 'SELF_ONLY',
            allowedCafeScope: [],
            isCafeOperationsAllowed: false,
            boundCafeId: boundCafe,
            workspaceMode: 'CAFE_OPERATIONS',
          };
        }
        return {
          privilegeProfile: 'CAFE_OPERATIONS',
          allowedCafeScope: [boundCafe],
          isCafeOperationsAllowed: true,
          boundCafeId: boundCafe,
          workspaceMode: 'CAFE_OPERATIONS',
        };
      }

      return {
        privilegeProfile: 'ORGANISATION_GOVERNANCE',
        allowedCafeScope: ['*'],
        isCafeOperationsAllowed: true,
        workspaceMode: 'MASTER_WORKSPACE',
      };
    }

    if (role === 'OWNER') {
      return {
        privilegeProfile: 'STRATEGIC_EXECUTIVE_READ',
        allowedCafeScope: ['*'],
        isCafeOperationsAllowed: false,
      };
    }

    if (role === 'STAFF') {
      return {
        privilegeProfile: 'SELF_ONLY',
        allowedCafeScope: [],
        isCafeOperationsAllowed: false,
      };
    }

    if (role === 'CAFE_ADMIN') {
      // If no device registration or device is PERSONAL or not ACTIVE -> Clamp to SELF_ONLY
      if (
        !deviceRegistration ||
        deviceRegistration.deviceClass !== 'CAFE_OWNED' ||
        deviceRegistration.status !== 'ACTIVE'
      ) {
        return {
          privilegeProfile: 'SELF_ONLY',
          allowedCafeScope: [],
          isCafeOperationsAllowed: false,
        };
      }

      // Check if device is bound to a valid assigned cafe
      const boundCafe = deviceRegistration.assignedCafeId;
      if (!boundCafe) {
        return {
          privilegeProfile: 'SELF_ONLY',
          allowedCafeScope: [],
          isCafeOperationsAllowed: false,
        };
      }

      // If requested cafe does not match the device's bound cafe, deny access
      if (requestedCafeId && requestedCafeId !== '*' && requestedCafeId !== boundCafe) {
        return {
          privilegeProfile: 'SELF_ONLY',
          allowedCafeScope: [],
          isCafeOperationsAllowed: false,
          boundCafeId: boundCafe,
        };
      }

      return {
        privilegeProfile: 'CAFE_OPERATIONS',
        allowedCafeScope: [boundCafe],
        isCafeOperationsAllowed: true,
        boundCafeId: boundCafe,
      };
    }

    return {
      privilegeProfile: 'SELF_ONLY',
      allowedCafeScope: [],
      isCafeOperationsAllowed: false,
    };
  }

  /**
   * Initializes device enrollment request on cafe tablet.
   */
  async startEnrollment({ organisationId, deviceId, deviceName, publicSigningKey, requestedCafeId, correlationId }) {
    const enrollmentCode = `ENR-${crypto.randomBytes(3).toString('hex').toUpperCase()}-${requestedCafeId || 'GEN'}`;
    const enrollmentExpiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes TTL

    let thumbprint = null;
    if (publicSigningKey) {
      thumbprint = crypto.createHash('sha256').update(publicSigningKey).digest('hex');
    }

    const reg = await DeviceRegistration.findOneAndUpdate(
      { deviceId },
      {
        $set: {
          organisationId,
          deviceId,
          deviceName,
          deviceClass: 'CAFE_OWNED',
          assignedCafeId: requestedCafeId,
          publicSigningKey,
          signingKeyThumbprint: thumbprint,
          status: 'PENDING',
          enrollmentCode,
          enrollmentExpiresAt,
          policyVersion: 1,
          deviceVersion: 1,
        },
      },
      { upsert: true, new: true }
    );

    return {
      deviceId: reg.deviceId,
      enrollmentCode: reg.enrollmentCode,
      expiresAt: reg.enrollmentExpiresAt,
    };
  }

  /**
   * Approves device enrollment by MASTER.
   */
  async approveEnrollment({ deviceId, masterUserId, assignedCafeId, correlationId }) {
    const reg = await DeviceRegistration.findOne({ deviceId });
    if (!reg) {
      throw new Error('DEVICE_NOT_FOUND');
    }

    if (reg.status === 'REVOKED') {
      throw new Error('DEVICE_PREVIOUSLY_REVOKED_REQUIRES_NEW_HARDWARE_ENROLLMENT');
    }

    reg.status = 'ACTIVE';
    reg.assignedCafeId = assignedCafeId;
    reg.enrollmentApprovedBy = masterUserId;
    reg.enrollmentApprovedAt = new Date();
    reg.enrollmentCode = null;
    reg.policyVersion += 1;
    reg.deviceVersion += 1;

    await reg.save();

    await DeviceSecurityEvent.create({
      eventId: `DEV_EVT_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`,
      organisationId: reg.organisationId,
      deviceId: reg.deviceId,
      deviceClass: reg.deviceClass,
      cafeId: reg.assignedCafeId,
      actorUserId: masterUserId,
      actorRole: 'MASTER',
      eventType: 'DEVICE_APPROVED',
      severity: 'INFO',
      metadata: { assignedCafeId },
      correlationId,
    });

    return reg;
  }

  /**
   * Emergency revocation of a compromised device.
   */
  async revokeDevice({ deviceId, masterUserId, reason, correlationId }) {
    const reg = await DeviceRegistration.findOne({ deviceId });
    if (!reg) {
      throw new Error('DEVICE_NOT_FOUND');
    }

    reg.status = 'REVOKED';
    reg.revokedAt = new Date();
    reg.revocationReason = reason || 'MASTER_REVOCATION';
    reg.policyVersion += 1;
    reg.deviceVersion += 1;

    await reg.save();

    // Immediately terminate any active operator sessions on this device
    const { OperatorSession } = require('../models/OperatorSession');
    await OperatorSession.updateMany(
      { deviceId: reg.deviceId, status: { $in: ['ACTIVE', 'LOCKED'] } },
      {
        $set: {
          status: 'REVOKED',
          endedAt: new Date(),
          endReason: 'DEVICE_REVOKED',
        },
      }
    );

    await DeviceSecurityEvent.create({
      eventId: `DEV_EVT_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`,
      organisationId: reg.organisationId,
      deviceId: reg.deviceId,
      deviceClass: reg.deviceClass,
      cafeId: reg.assignedCafeId,
      actorUserId: masterUserId,
      actorRole: 'MASTER',
      eventType: 'DEVICE_REVOKED',
      severity: 'CRITICAL',
      metadata: { reason },
      correlationId,
    });

    // Broadcast across cluster to terminate live sockets / SSE on any replica instance
    defaultEventBus.publish('DEVICE_REVOKED', {
      deviceId: reg.deviceId,
      organisationId: reg.organisationId,
      cafeId: reg.assignedCafeId,
      reason,
      revokedAt: reg.revokedAt,
    }).catch(() => {});

    defaultPresenceService.recordHeartbeat({
      deviceId: reg.deviceId,
      organisationId: reg.organisationId,
      cafeId: reg.assignedCafeId,
      status: 'REVOKED',
      forceDurable: true,
    }).catch(() => {});

    return reg;
  }

  /**
   * Marks a device as LOST.
   */
  async reportDeviceLost({ deviceId, masterUserId, reason, correlationId }) {
    const reg = await DeviceRegistration.findOne({ deviceId });
    if (!reg) {
      throw new Error('DEVICE_NOT_FOUND');
    }

    reg.status = 'LOST';
    reg.revocationReason = reason || 'REPORTED_LOST';
    reg.policyVersion += 1;
    reg.deviceVersion += 1;
    await reg.save();

    const { OperatorSession } = require('../models/OperatorSession');
    await OperatorSession.updateMany(
      { deviceId: reg.deviceId, status: { $in: ['ACTIVE', 'LOCKED'] } },
      {
        $set: {
          status: 'REVOKED',
          endedAt: new Date(),
          endReason: 'DEVICE_LOST',
        },
      }
    );

    defaultEventBus.publish('DEVICE_LOST', {
      deviceId: reg.deviceId,
      organisationId: reg.organisationId,
      cafeId: reg.assignedCafeId,
      reason,
    }).catch(() => {});

    defaultPresenceService.recordHeartbeat({
      deviceId: reg.deviceId,
      organisationId: reg.organisationId,
      cafeId: reg.assignedCafeId,
      status: 'LOST',
      forceDurable: true,
    }).catch(() => {});

    return reg;
  }

  /**
   * Marks a device as RETIRED.
   */
  async retireDevice({ deviceId, masterUserId, reason, correlationId }) {
    const reg = await DeviceRegistration.findOne({ deviceId });
    if (!reg) {
      throw new Error('DEVICE_NOT_FOUND');
    }

    reg.status = 'RETIRED';
    reg.retiredAt = new Date();
    reg.revocationReason = reason || 'HARDWARE_RETIRED';
    reg.policyVersion += 1;
    reg.deviceVersion += 1;
    await reg.save();

    const { OperatorSession } = require('../models/OperatorSession');
    await OperatorSession.updateMany(
      { deviceId: reg.deviceId, status: { $in: ['ACTIVE', 'LOCKED'] } },
      {
        $set: {
          status: 'ENDED',
          endedAt: new Date(),
          endReason: 'DEVICE_RETIRED',
        },
      }
    );

    defaultEventBus.publish('DEVICE_RETIRED', {
      deviceId: reg.deviceId,
      organisationId: reg.organisationId,
      cafeId: reg.assignedCafeId,
      reason,
    }).catch(() => {});

    defaultPresenceService.recordHeartbeat({
      deviceId: reg.deviceId,
      organisationId: reg.organisationId,
      cafeId: reg.assignedCafeId,
      status: 'RETIRED',
      forceDurable: true,
    }).catch(() => {});

    return reg;
  }

  /**
   * Replaces an old device with a fresh new hardware device registration.
   */
  async replaceDevice({ oldDeviceId, newDeviceId, newDeviceName, masterUserId, reason, correlationId }) {
    const oldReg = await DeviceRegistration.findOne({ deviceId: oldDeviceId });
    if (!oldReg) {
      throw new Error('OLD_DEVICE_NOT_FOUND');
    }

    oldReg.status = 'REPLACED';
    oldReg.replacedAt = new Date();
    oldReg.replacedByDeviceId = newDeviceId;
    oldReg.revocationReason = reason || 'HARDWARE_REPLACEMENT';
    await oldReg.save();

    const { OperatorSession } = require('../models/OperatorSession');
    await OperatorSession.updateMany(
      { deviceId: oldReg.deviceId, status: { $in: ['ACTIVE', 'LOCKED'] } },
      {
        $set: {
          status: 'ENDED',
          endedAt: new Date(),
          endReason: 'DEVICE_REPLACED',
        },
      }
    );

    // Create new device registration in ACTIVE state assigned to same cafe
    const newReg = await DeviceRegistration.create({
      deviceId: newDeviceId,
      organisationId: oldReg.organisationId,
      deviceName: newDeviceName || `${oldReg.deviceName} (Replacement)`,
      deviceClass: 'CAFE_OWNED',
      assignedCafeId: oldReg.assignedCafeId,
      status: 'ACTIVE',
      trustLevel: 'ENROLLED',
      enrollmentApprovedBy: masterUserId,
      enrollmentApprovedAt: new Date(),
      policyVersion: 1,
      deviceVersion: 1,
    });

    defaultEventBus.publish('DEVICE_REPLACED', {
      oldDeviceId,
      newDeviceId,
      organisationId: oldReg.organisationId,
      cafeId: oldReg.assignedCafeId,
      reason,
    }).catch(() => {});

    defaultPresenceService.recordHeartbeat({
      deviceId: oldDeviceId,
      organisationId: oldReg.organisationId,
      cafeId: oldReg.assignedCafeId,
      status: 'REPLACED',
      forceDurable: true,
    }).catch(() => {});

    defaultPresenceService.recordHeartbeat({
      deviceId: newDeviceId,
      organisationId: newReg.organisationId,
      cafeId: newReg.assignedCafeId,
      status: 'ACTIVE',
      forceDurable: true,
    }).catch(() => {});

    return { oldDevice: oldReg, newDevice: newReg };
  }

  /**
   * Lists devices for an organisation / cafe with bounded pagination and search.
   */
  async listDevices({ organisationId, cafeId, status, search, page = 1, limit = 50 }) {
    const filter = { organisationId: organisationId.toUpperCase() };
    if (cafeId && cafeId !== '*') {
      filter.assignedCafeId = cafeId.toUpperCase();
    }
    if (status) {
      filter.status = status;
    }
    if (search && typeof search === 'string' && search.trim()) {
      const s = search.trim();
      filter.$or = [
        { deviceId: { $regex: s, $options: 'i' } },
        { deviceName: { $regex: s, $options: 'i' } },
        { assignedCafeId: { $regex: s, $options: 'i' } },
      ];
    }

    const parsedLimit = Math.min(200, Math.max(1, parseInt(limit, 10) || 50));
    const parsedPage = Math.max(1, parseInt(page, 10) || 1);
    const skip = (parsedPage - 1) * parsedLimit;

    const [devices, total] = await Promise.all([
      DeviceRegistration.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parsedLimit)
        .lean(),
      DeviceRegistration.countDocuments(filter),
    ]);

    devices.pagination = {
      total,
      page: parsedPage,
      limit: parsedLimit,
      totalPages: Math.ceil(total / parsedLimit) || 1,
    };

    return devices;
  }
}

module.exports = new DeviceTrustService();
