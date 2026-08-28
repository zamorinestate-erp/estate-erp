'use strict';
const express = require('express');
const deviceService = require('../services/deviceService');
const { deviceContext } = require('../middleware/deviceContext');
const sessionPolicy = require('../config/sessionPolicy');
const { ok, fail } = require('../utils/responses');

const router = express.Router();

router.post('/enroll', async (req, res, next) => {
  try {
    const { enrollmentCode, displayName, platform, appVersion, osVersion } = req.body || {};
    if (!enrollmentCode) return fail(res, 400, 'INVALID_INPUT', 'Enter your registration code.');
    const { device, deviceToken } = await deviceService.enrollDevice({
      enrollmentCodePlain: enrollmentCode, displayName, platform, appVersion, osVersion,
    });
    return ok(res, {
      deviceToken,
      device: { id: device.id, displayName: device.displayName, cafeId: device.cafeId, cafeName: device.cafeDisplayName || null, lifecycleStatus: device.lifecycleStatus },
    });
  } catch (err) {
    if (err.code === 'ENROLLMENT_UNAVAILABLE') {
      return fail(res, 400, 'ENROLLMENT_UNAVAILABLE', 'This registration code is invalid, expired, or has already been used.');
    }
    next(err);
  }
});

router.get('/status', deviceContext, async (req, res, next) => {
  try {
    const diagnostics = await deviceService.getDiagnostics(req.cafeOpsDevice);
    return ok(res, { diagnostics, serverTime: new Date().toISOString() });
  } catch (err) { next(err); }
});

router.get('/policy', deviceContext, async (req, res) => {
  return ok(res, {
    policy: {
      inactivityLockTimeoutMinutes: sessionPolicy.INACTIVITY_LOCK_TIMEOUT_MINUTES,
      preTimeoutWarningSeconds: sessionPolicy.PRE_TIMEOUT_WARNING_SECONDS,
      overallSessionLifetimeHours: sessionPolicy.OVERALL_SESSION_LIFETIME_HOURS,
      masterAccessReasonRequired: sessionPolicy.MASTER_ACCESS_REASON_REQUIRED,
    },
  });
});

module.exports = router;
