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
} = require('./attendanceController');

const router = express.Router();

router.use(authenticate);

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

module.exports = router;