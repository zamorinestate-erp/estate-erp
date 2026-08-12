'use strict';

/**
 * DEPARTMENT ORDER ROUTES
 * Mounted at: /api/v1/department-orders (registered in routes/index.js)
 */

const express = require('express');
const { authenticate } = require('../middleware/authenticate');
const { authorize } = require('../middleware/authorize');
const {
  listDepartmentOrders,
  createDepartmentOrder,
  updateOrderStatus,
} = require('../controllers/departmentOrderController');

const router = express.Router();

router.use(authenticate);

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

router.patch(
  '/:orderId/status',
  authorize('DEPARTMENT_ORDERS_WRITE', { allowedRoles: ['MASTER', 'CAFE_ADMIN'] }),
  updateOrderStatus
);

module.exports = router;
