'use strict';

/**
 * ATTENDANCE & SHIFTS ROUTES (SCREEN 004)
 * Mounted at: /api/v1/attendance (registered in routes/index.js)
 */

const express = require('express');

const {
  authenticate,
} = require('../../middleware/authenticate');

const {
  getAttendanceOverview,
  getLiveAttendance,
  recordMasterManualAttendance,
  getEmployeeMonthlyCalendar,
  getRoster,
  saveRoster,
  decideOvertime,
  closePeriod,
  reopenPeriod,
  purgeSelfieEvidence,
  getServerTime,
  getStaffPolicy,
  getStaffToday,
  staffCheckIn,
  staffCheckOut,
  getStaffHistory,
  requestStaffCorrection,
  recordStaffAttestation,
} = require('./attendanceController');

const { attachDeviceContext } = require('../../middleware/deviceContext');

const router = express.Router();

router.use(authenticate);
router.use(attachDeviceContext);

// Staff Self-Service Endpoints
router.get('/server-time', getServerTime);
router.get('/policy', getStaffPolicy);
router.get('/today', getStaffToday);
router.get('/history', getStaffHistory);
router.post('/check-in', staffCheckIn);
router.post('/check-out', staffCheckOut);
router.post('/corrections', requestStaffCorrection);
router.post('/attestation', recordStaffAttestation);

// Overview & Live Presence
router.get('/overview', getAttendanceOverview);
router.get('/live', getLiveAttendance);
router.get('/', getLiveAttendance);

// Master Manual Attendance
router.post('/master-manual', recordMasterManualAttendance);
router.post('/manual', recordMasterManualAttendance);

// Employee Attendance 360 Calendar
router.get('/calendar-360/:userId', getEmployeeMonthlyCalendar);

// Shift Roster
router.get('/roster', getRoster);
router.post('/roster', saveRoster);

// Overtime Hierarchy Decision
router.post('/overtime/decide', decideOvertime);

// Period Closure & Reopen
router.post('/periods/:periodId/close', closePeriod);
router.post('/periods/:periodId/reopen', reopenPeriod);

// Privacy & Selfie Evidence Purge (Primary Master)
router.post('/evidence/purge', purgeSelfieEvidence);

module.exports = router;