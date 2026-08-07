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
  require('./attendanceRoutes');

const cashRoutes =
  require('./cashRoutes');

const expenseRoutes =
  require('./expenseRoutes');

const reportRoutes =
  require('./reportRoutes');

const payrollRoutes =
  require('./payrollRoutes');

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
