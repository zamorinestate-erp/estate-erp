'use strict';

const crypto = require('node:crypto');
const { AttendanceQrChallenge } = require('../models/AttendanceQrChallenge');
const { AttendanceSubmission } = require('../models/AttendanceSubmission');
const { AttendanceOfflineLease } = require('../models/AttendanceOfflineLease');
const { DeviceRegistration } = require('../models/DeviceRegistration');
const { DeviceSecurityEvent } = require('../models/DeviceSecurityEvent');
const { Attendance } = require('../modules/attendance/Attendance');
const { Cafe } = require('../models/Cafe');

const QR_SIGNING_SECRET = process.env.QR_SIGNING_SECRET || 'zamorin_qr_master_signing_secret_key_2026_dsec';

function calculateDistanceMetres(lat1, lon1, lat2, lon2) {
  const R = 6371000; // Earth radius in metres
  const toRad = (deg) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

class AttendanceQrService {
  constructor() {
    this.userPinAttempts = new Map();
  }

  getUserPinAttemptState(userId) {
    return this.userPinAttempts.get(userId) || { failedAttempts: 0, lockedUntil: null };
  }

  setUserPinAttemptState(userId, state) {
    this.userPinAttempts.set(userId, state);
  }

  clearUserPinAttemptState(userId) {
    this.userPinAttempts.delete(userId);
  }

  /**
   * Generates HMAC-SHA256 signature for challenge payload.
   */
  signPayload(payload) {
    const serialized = JSON.stringify(payload);
    return crypto.createHmac('sha256', QR_SIGNING_SECRET).update(serialized).digest('hex');
  }

  /**
   * Issues a rotating QR attendance challenge for an active bound cafe device.
   */
  async issueChallenge({ organisationId, deviceId, cafeId, correlationId }) {
    const device = await DeviceRegistration.findOne({ deviceId, status: 'ACTIVE', deviceClass: 'CAFE_OWNED' });
    if (!device) {
      throw new Error('DEVICE_NOT_REGISTERED_OR_INACTIVE');
    }

    if (device.assignedCafeId !== cafeId) {
      throw new Error('DEVICE_CAFE_SCOPE_MISMATCH');
    }

    const challengeId = `CHL_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
    const fallbackPin = Math.floor(100000 + Math.random() * 900000).toString(); // 6 digits
    const issuedAt = new Date();
    const expiresAt = new Date(Date.now() + 60 * 1000); // 60 seconds TTL
    const nonce = crypto.randomBytes(8).toString('hex');

    const envelopeData = {
      ver: 1,
      cid: challengeId,
      did: deviceId,
      cafeId,
      iat: Math.floor(issuedAt.getTime() / 1000),
      exp: Math.floor(expiresAt.getTime() / 1000),
      nonce,
    };

    const signature = this.signPayload(envelopeData);

    const challengeDoc = await AttendanceQrChallenge.create({
      challengeId,
      organisationId,
      deviceId,
      cafeId,
      fallbackPin,
      issuedAt,
      expiresAt,
      nonce,
      signature,
    });

    return {
      challengeId,
      envelope: {
        ...envelopeData,
        sig: signature,
      },
      fallbackPin,
      expiresAt,
      rotationIntervalSeconds: 20,
    };
  }

  /**
   * Submits and validates a QR attendance scan from an authenticated staff personal session.
   */
  async submitAttendance({ organisationId, userId, cafeId, challengeEnvelope, fallbackPin, idempotencyKey, clientScannedAt, latitude, longitude, correlationId }) {
    if (!idempotencyKey) {
      throw new Error('IDEMPOTENCY_KEY_REQUIRED');
    }

    const idempotencyKeyHash = crypto.createHash('sha256').update(String(idempotencyKey)).digest('hex');

    // 1. Check Idempotency Submission
    const existingSubmission = await AttendanceSubmission.findOne({
      organisationId,
      userId,
      idempotencyKeyHash,
    });

    if (existingSubmission) {
      return {
        submissionId: existingSubmission.submissionId,
        result: existingSubmission.result,
        transition: existingSubmission.transition,
        serverReceivedAt: existingSubmission.serverReceivedAt,
        idempotentReplay: true,
      };
    }

    // Geofence Validation if coordinates are provided
    if (typeof latitude === 'number' && typeof longitude === 'number') {
      const cafeDoc = await Cafe.findOne({ cafeId }).lean();
      if (
        cafeDoc &&
        cafeDoc.address &&
        typeof cafeDoc.address.latitude === 'number' &&
        typeof cafeDoc.address.longitude === 'number'
      ) {
        const distance = calculateDistanceMetres(
          latitude,
          longitude,
          cafeDoc.address.latitude,
          cafeDoc.address.longitude
        );
        const maxRadius = cafeDoc.address.geofenceRadiusMetres || 100;
        if (distance > maxRadius) {
          throw new Error(
            `GEOFENCE_RADIUS_EXCEEDED: Distance ${Math.round(distance)}m exceeds allowed radius of ${maxRadius}m`
          );
        }
      }
    }

    // 2. Resolve and Validate Challenge
    let challenge = null;
    let envelopeData = null;

    if (challengeEnvelope) {
      if (typeof challengeEnvelope === 'string') {
        try {
          envelopeData = JSON.parse(Buffer.from(challengeEnvelope, 'base64').toString('utf8'));
        } catch (e) {
          envelopeData = JSON.parse(challengeEnvelope);
        }
      } else {
        envelopeData = challengeEnvelope;
      }

      const { sig, ...dataToVerify } = envelopeData;
      const expectedSig = this.signPayload(dataToVerify);
      if (sig !== expectedSig) {
        throw new Error('INVALID_QR_SIGNATURE');
      }

      challenge = await AttendanceQrChallenge.findOne({ challengeId: envelopeData.cid });
    } else if (fallbackPin) {
      const userAttempt = this.getUserPinAttemptState(userId);
      if (userAttempt.lockedUntil && userAttempt.lockedUntil > new Date()) {
        throw new Error('FALLBACK_PIN_USER_LOCKED_TOO_MANY_ATTEMPTS');
      }

      challenge = await AttendanceQrChallenge.findOne({
        cafeId,
        fallbackPin,
        expiresAt: { $gt: new Date() },
      });

      if (!challenge) {
        userAttempt.failedAttempts += 1;
        if (userAttempt.failedAttempts >= 5) {
          userAttempt.lockedUntil = new Date(Date.now() + 15 * 60 * 1000);
        }
        this.setUserPinAttemptState(userId, userAttempt);
        throw new Error('INVALID_OR_EXPIRED_FALLBACK_PIN');
      }

      // Reset user failure counter on successful PIN match
      this.clearUserPinAttemptState(userId);
    } else {
      throw new Error('CHALLENGE_ENVELOPE_OR_PIN_REQUIRED');
    }

    if (!challenge) {
      throw new Error('CHALLENGE_NOT_FOUND_OR_EXPIRED');
    }

    if (new Date() > challenge.expiresAt) {
      throw new Error('QR_CHALLENGE_EXPIRED');
    }

    if (challenge.cafeId !== cafeId) {
      throw new Error('QR_CAFE_SCOPE_MISMATCH');
    }

    // 3. Determine Transition & Prevent Tuple Replay
    const today = new Date().toISOString().split('T')[0];
    let attendance = await Attendance.findOne({
      organisationId,
      userId,
      businessDate: today,
    });

    let transition = 'CHECK_IN';
    if (attendance && attendance.checkInAt && !attendance.checkOutAt) {
      transition = 'CHECK_OUT';
    } else if (attendance && attendance.checkInAt && attendance.checkOutAt) {
      throw new Error('ATTENDANCE_ALREADY_COMPLETED_FOR_TODAY');
    }

    // Check challenge tuple replay
    const tupleCheck = await AttendanceSubmission.findOne({
      challengeId: challenge.challengeId,
      userId,
      transition,
    });

    if (tupleCheck) {
      throw new Error('QR_CHALLENGE_ALREADY_USED_BY_USER_FOR_TRANSITION');
    }

    const submissionId = `SUB_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
    const serverReceivedAt = new Date();

    // 4. Atomic Attendance Record Update
    const datePart = today.replaceAll('-', '');
    const timeSlice = Date.now().toString().slice(-6);
    const randDigits = Math.floor(1000 + Math.random() * 9000).toString();
    const generatedAttendanceId = `AT-${datePart}-${timeSlice}${randDigits}`;

    if (transition === 'CHECK_IN') {
      if (!attendance) {
        attendance = new Attendance({
          attendanceId: generatedAttendanceId,
          organisationId,
          cafeId,
          userId,
          businessDate: today,
          checkInAt: serverReceivedAt,
          status: 'CHECKED_IN',
          checkInSource: 'SELF',
          checkInRecordedBy: userId,
          timezone: 'Asia/Kolkata',
          createdBy: userId,
          updatedBy: userId,
        });
      } else {
        attendance.checkInAt = serverReceivedAt;
        attendance.status = 'CHECKED_IN';
        attendance.checkInSource = 'SELF';
        attendance.checkInRecordedBy = userId;
        attendance.updatedBy = userId;
      }
    } else {
      if (attendance) {
        attendance.checkOutAt = serverReceivedAt;
        attendance.status = 'CHECKED_OUT';
        attendance.checkOutSource = 'SELF';
        attendance.checkOutRecordedBy = userId;
        attendance.updatedBy = userId;
      } else {
        attendance = new Attendance({
          attendanceId: generatedAttendanceId,
          organisationId,
          cafeId,
          userId,
          businessDate: today,
          checkOutAt: serverReceivedAt,
          status: 'CHECKED_OUT',
          checkOutSource: 'SELF',
          checkOutRecordedBy: userId,
          timezone: 'Asia/Kolkata',
          createdBy: userId,
          updatedBy: userId,
        });
      }
    }

    await attendance.save();

    // 5. Save Immutable Submission Record
    await AttendanceSubmission.create({
      submissionId,
      organisationId,
      userId,
      cafeId,
      deviceId: challenge.deviceId,
      challengeId: challenge.challengeId,
      idempotencyKeyHash,
      transition,
      challengeIssuedAt: challenge.issuedAt,
      clientScannedAt: clientScannedAt ? new Date(clientScannedAt) : serverReceivedAt,
      serverReceivedAt,
      isOffline: false,
      result: 'ACCEPTED',
      correlationId,
    });

    return {
      submissionId,
      result: 'ACCEPTED',
      transition,
      serverReceivedAt,
      idempotentReplay: false,
    };
  }

  /**
   * Issues a bounded offline signing lease to a verified cafe device.
   */
  async issueOfflineLease({ organisationId, deviceId, cafeId, durationMinutes = 480, correlationId }) {
    const device = await DeviceRegistration.findOne({ deviceId, status: 'ACTIVE', deviceClass: 'CAFE_OWNED' });
    if (!device || device.assignedCafeId !== cafeId) {
      throw new Error('DEVICE_UNAUTHORIZED_FOR_OFFLINE_LEASE');
    }

    const leaseId = `LEASE_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
    const serverNotBefore = new Date();
    const serverNotAfter = new Date(Date.now() + durationMinutes * 60 * 1000);

    const leasePayload = {
      leaseId,
      deviceId,
      cafeId,
      notBefore: Math.floor(serverNotBefore.getTime() / 1000),
      notAfter: Math.floor(serverNotAfter.getTime() / 1000),
      policyVersion: device.policyVersion,
    };

    const serverSignature = this.signPayload(leasePayload);

    await AttendanceOfflineLease.create({
      leaseId,
      organisationId,
      deviceId,
      cafeId,
      serverNotBefore,
      serverNotAfter,
      maxSequence: 5000,
      policyVersion: device.policyVersion,
      serverSignature,
      status: 'ACTIVE',
    });

    await DeviceSecurityEvent.create({
      eventId: `DEV_EVT_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`,
      organisationId,
      deviceId,
      deviceClass: 'CAFE_OWNED',
      cafeId,
      actorUserId: 'SYSTEM',
      actorRole: 'CAFE_ADMIN',
      eventType: 'OFFLINE_LEASE_ISSUED',
      severity: 'INFO',
      metadata: { leaseId, durationMinutes },
      correlationId,
    });

    return {
      leaseId,
      serverNotBefore,
      serverNotAfter,
      serverSignature,
    };
  }
}

module.exports = new AttendanceQrService();
