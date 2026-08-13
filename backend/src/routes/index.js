'use strict';

const express = require('express');

const authRoutes =
  require('./authRoutes');

const cafeRoutes =
  require('./cafeRoutes');

const userRoutes =
  require('./userRoutes');

const employeeRoutes =
  require('./employeeRoutes');

const auditRoutes =
  require('./auditRoutes');

const notificationRoutes =
  require('./notificationRoutes');

const attendanceRoutes =
  require('../modules/attendance/attendanceRoutes');

const cashRoutes =
  require('./cashRoutes');

const expenseRoutes =
  require('./expenseRoutes');

const reportRoutes =
  require('./reportRoutes');

const payrollRoutes =
  require('./payrollRoutes');

const loanAdvanceRoutes =
  require('./loanAdvanceRoutes');

const personalLedgerRoutes =
  require('./personalLedgerRoutes');

const inventoryRoutes =
  require('./inventoryRoutes');

const vendorRoutes =
  require('./vendorRoutes');

const procurementRoutes =
  require('./procurementRoutes');

const menuRoutes =
  require('./menuRoutes');

const billRoutes =
  require('./billRoutes');

const customerRoutes =
  require('./customerRoutes');

const taskRoutes =
  require('./taskRoutes');

const approvalRoutes =
  require('./approvalRoutes');

const qualityRoutes =
  require('./qualityRoutes');

const assetRoutes =
  require('./assetRoutes');

const departmentOrderRoutes =
  require('./departmentOrderRoutes');

const revenueShareRoutes =
  require('./revenueShareRoutes');

const dashboardRoutes =
  require('./dashboardRoutes');

const fileRoutes =
  require('./fileRoutes');

const trashRoutes =
  require('./trashRoutes');

const searchRoutes =
  require('./searchRoutes');

const customFieldRoutes =
  require('./customFieldRoutes');

const router = express.Router();

router.use(
  '/auth',
  authRoutes
);

router.use(
  '/cafes',
  cafeRoutes
);

router.use(
  '/users',
  userRoutes
);

router.use(
  '/employees',
  employeeRoutes
);

router.use(
  '/audit-events',
  auditRoutes
);

router.use(
  '/notifications',
  notificationRoutes
);

router.use(
  '/attendance',
  attendanceRoutes
);

router.use(
  '/cash-transactions',
  cashRoutes
);

router.use(
  '/expenses',
  expenseRoutes
);

router.use(
  '/reports',
  reportRoutes
);

router.use(
  '/payroll',
  payrollRoutes
);

router.use(
  '/loan-advances',
  loanAdvanceRoutes
);

router.use(
  '/personal-ledger',
  personalLedgerRoutes
);

router.use(
  '/inventory',
  inventoryRoutes
);

router.use(
  '/vendors',
  vendorRoutes
);

router.use(
  '/procurement',
  procurementRoutes
);

router.use(
  '/menu',
  menuRoutes
);

router.use(
  '/bills',
  billRoutes
);

router.use(
  '/customers',
  customerRoutes
);

router.use(
  '/tasks',
  taskRoutes
);

router.use(
  '/approvals',
  approvalRoutes
);

router.use(
  '/quality',
  qualityRoutes
);

router.use(
  '/assets',
  assetRoutes
);

router.use(
  '/department-orders',
  departmentOrderRoutes
);

router.use(
  '/revenue-share',
  revenueShareRoutes
);

router.use(
  '/dashboard',
  dashboardRoutes
);

router.use(
  '/files',
  fileRoutes
);

router.use(
  '/trash',
  trashRoutes
);

router.use(
  '/search',
  searchRoutes
);

router.use(
  '/custom-fields',
  customFieldRoutes
);

router.get(
  '/',
  (request, response) => {
    return response
      .status(200)
      .json({
        success: true,

        message:
          'Zamorin Cafe ERP API is running.',

        version: 'v1',

        correlationId:
          request.correlationId || null,
      });
  }
);

module.exports = router;
