'use strict';

const crypto = require('node:crypto');
const { DeviceRegistration } = require('../models/DeviceRegistration');
const { DeviceSecurityEvent } = require('../models/DeviceSecurityEvent');

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
      return {
        privilegeProfile: 'ORGANISATION_GOVERNANCE',
        allowedCafeScope: ['*'],
        isCafeOperationsAllowed: true,
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

    return reg;
  }
}

module.exports = new DeviceTrustService();
