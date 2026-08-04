'use strict';

const express = require('express');

const {
  authenticate,
} = require('../middleware/authenticate');

const {
  listMyPayslips,
  getMyPayslip,
} = require('../controllers/payrollController');

const {
  listPayrollRuns,
  getPayrollRun,
  listPayrollRunPayslips,
} = require('../controllers/payrollManagementController');

const {
  createPayrollRun,
  createPayrollRunPayslip,
} = require('../controllers/payrollWriteController');

const router = express.Router();

router.use(authenticate);

router.get(
  '/me/payslips',
  listMyPayslips
);

router.get(
  '/me/payslips/:payslipId',
  getMyPayslip
);

router.get(
  '/runs',
  listPayrollRuns
);

router.post(
  '/runs',
  createPayrollRun
);

router.get(
  '/runs/:payrollRunId/payslips',
  listPayrollRunPayslips
);

router.post(
  '/runs/:payrollRunId/payslips',
  createPayrollRunPayslip
);

router.get(
  '/runs/:payrollRunId',
  getPayrollRun
);

module.exports = router;
