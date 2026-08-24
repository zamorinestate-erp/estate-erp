'use strict';

/**
 * DEPARTMENT / INSTITUTIONAL ORDER ROUTES (SCREEN 007)
 * Mounted at: /api/v1/department-orders
 */

const express = require('express');
const { authenticate } = require('../middleware/authenticate');
const { authorize } = require('../middleware/authorize');
const {
  getDepartmentOrdersOverview,
  listDepartmentOrders,
  getDepartmentOrder,
  createDepartmentOrder,
  createOrderRevision,
  confirmOrderFulfilment,
  recordOrderSettlement,
  listQuotes,
  createQuote,
  getInstitutionalSchedule,
  getInstitutionalAccounts,
  getInstitutionalIntegrityStatus,
} = require('../controllers/departmentOrderController');

const router = express.Router();

router.use(authenticate);

// 1. Overview & KPIs
router.get(
  '/overview',
  authorize('DEPARTMENT_ORDERS_READ', { allowedRoles: ['MASTER', 'OWNER', 'CAFE_ADMIN'] }),
  getDepartmentOrdersOverview
);

// 2. Schedule Calendar
router.get(
  '/schedule',
  authorize('DEPARTMENT_ORDERS_READ', { allowedRoles: ['MASTER', 'OWNER', 'CAFE_ADMIN'] }),
  getInstitutionalSchedule
);

// 3. Institutional Quotes
router.get(
  '/quotes',
  authorize('DEPARTMENT_ORDERS_READ', { allowedRoles: ['MASTER', 'OWNER', 'CAFE_ADMIN'] }),
  listQuotes
);

router.post(
  '/quotes',
  authorize('DEPARTMENT_ORDERS_WRITE', { allowedRoles: ['MASTER', 'CAFE_ADMIN'] }),
  createQuote
);

// 4. Institutional Accounts
router.get(
  '/accounts',
  authorize('DEPARTMENT_ORDERS_READ', { allowedRoles: ['MASTER', 'OWNER', 'CAFE_ADMIN'] }),
  getInstitutionalAccounts
);

// 5. Integrity & Three-Way Reconciliation
router.get(
  '/integrity',
  authorize('DEPARTMENT_ORDERS_READ', { allowedRoles: ['MASTER', 'OWNER', 'CAFE_ADMIN'] }),
  getInstitutionalIntegrityStatus
);

// 6. Orders List & Creation
router.get(
  '/',
  authorize('DEPARTMENT_ORDERS_READ', { allowedRoles: ['MASTER', 'OWNER', 'CAFE_ADMIN'] }),
  listDepartmentOrders
);

router.post(
  '/',
  authorize('DEPARTMENT_ORDERS_WRITE', { allowedRoles: ['MASTER', 'CAFE_ADMIN'] }),
  createDepartmentOrder
);

// 7. Single Order 360 & Operations
router.get(
  '/:orderId',
  authorize('DEPARTMENT_ORDERS_READ', { allowedRoles: ['MASTER', 'OWNER', 'CAFE_ADMIN'] }),
  getDepartmentOrder
);

router.post(
  '/:orderId/revisions',
  authorize('DEPARTMENT_ORDERS_WRITE', { allowedRoles: ['MASTER', 'CAFE_ADMIN'] }),
  createOrderRevision
);

router.post(
  '/:orderId/fulfil',
  authorize('DEPARTMENT_ORDERS_WRITE', { allowedRoles: ['MASTER', 'CAFE_ADMIN'] }),
  confirmOrderFulfilment
);

router.post(
  '/:orderId/settle',
  authorize('DEPARTMENT_ORDERS_WRITE', { allowedRoles: ['MASTER', 'OWNER', 'CAFE_ADMIN'] }),
  recordOrderSettlement
);

module.exports = router;
