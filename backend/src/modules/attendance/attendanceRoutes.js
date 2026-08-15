'use strict';

const express = require('express');

const {
  authenticate,
} = require('../../middleware/authenticate');

const {
  listAttendance,
  getTodayAttendance,
  checkIn,
  checkOut,
  submitQrAttendance,
  syncOfflineAttendance,
  recordManualAttendance,
} = require('./attendanceController');

const { attachDeviceContext } = require('../../middleware/deviceContext');

const router = express.Router();

router.use(authenticate);
router.use(attachDeviceContext);

router.get(
  '/',
  listAttendance
);

router.get(
  '/me/today',
  getTodayAttendance
);

router.post(
  '/check-in',
  checkIn
);

router.post(
  '/check-out',
  checkOut
);

router.post(
  '/qr/submit',
  submitQrAttendance
);

router.post(
  '/offline/sync',
  syncOfflineAttendance
);

router.post(
  '/manual',
  recordManualAttendance
);

module.exports = router;