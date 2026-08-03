'use strict';

const express = require('express');

const {
  authenticate,
} = require('../middleware/authenticate');

const {
  getDashboardReport,
  getDailySummaryReport,
  getCashFlowReport,
  getExpensesReport,
  getAttendanceReport,
} = require('../controllers/reportController');

const router = express.Router();

router.use(authenticate);

router.get(
  '/dashboard',
  getDashboardReport
);

router.get(
  '/daily-summary',
  getDailySummaryReport
);

router.get(
  '/cash-flow',
  getCashFlowReport
);

router.get(
  '/expenses',
  getExpensesReport
);

router.get(
  '/attendance',
  getAttendanceReport
);

module.exports = router;
