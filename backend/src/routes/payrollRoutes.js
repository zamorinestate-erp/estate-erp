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
  getPayrollOverview,
  getPayrollReconciliation,
  getPayrollExceptions,
  getPayrollPayments,
  generatePaymentBatch,
  getPayrollCompliance,
  getPayrollIntegrity,
} = require('../controllers/payrollManagementController');

const {
  createPayrollRun,
  createPayrollRunPayslip,
} = require('../controllers/payrollWriteController');

const {
  updateDraftPayrollRun,
  updateDraftPayrollRunPayslip,
} = require('../controllers/payrollDraftController');

const {
  calculatePayrollRun,
} = require('../controllers/payrollCalculationController');

const {
  submitPayrollRun,
  approvePayrollRun,
} = require('../controllers/payrollApprovalController');

const {
  issuePayrollRunPayslips,
} = require('../controllers/payrollIssuanceController');

const {
  payPayrollRun,
} = require('../controllers/payrollPaymentController');

const {
  voidPayrollRun,
} = require('../controllers/payrollVoidController');

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
  '/overview',
  getPayrollOverview
);

router.get(
  '/compliance/overview',
  getPayrollCompliance
);

router.get(
  '/integrity',
  getPayrollIntegrity
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

router.get(
  '/runs/:payrollRunId/reconciliation',
  getPayrollReconciliation
);

router.get(
  '/runs/:payrollRunId/exceptions',
  getPayrollExceptions
);

router.get(
  '/runs/:payrollRunId/payments',
  getPayrollPayments
);

router.post(
  '/runs/:payrollRunId/payments/batch',
  generatePaymentBatch
);

router.post(
  '/runs/:payrollRunId/payslips',
  createPayrollRunPayslip
);

router.patch(
  '/runs/:payrollRunId/payslips/:payslipId',
  updateDraftPayrollRunPayslip
);

router.post(
  '/runs/:payrollRunId/calculate',
  calculatePayrollRun
);

router.post(
  '/runs/:payrollRunId/submit',
  submitPayrollRun
);

router.post(
  '/runs/:payrollRunId/approve',
  approvePayrollRun
);

router.post(
  '/runs/:payrollRunId/issue-payslips',
  issuePayrollRunPayslips
);

router.post(
  '/runs/:payrollRunId/pay',
  payPayrollRun
);

router.post(
  '/runs/:payrollRunId/void',
  voidPayrollRun
);

router.get(
  '/runs/:payrollRunId',
  getPayrollRun
);

router.patch(
  '/runs/:payrollRunId',
  updateDraftPayrollRun
);

module.exports = router;
