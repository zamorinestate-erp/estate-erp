'use strict';

/**
 * PROCUREMENT ROUTES
 * Mounted at: /api/v1/procurement (registered in routes/index.js)
 */

const express = require('express');
const { authenticate } = require('../middleware/authenticate');
const { authorize } = require('../middleware/authorize');
const {
  listOrders,
  getOrder,
  createOrder,
  submitOrder,
  approveOrder,
  orderSent,
  receiveOrder,
  cancelOrder,
} = require('../controllers/procurementController');

const router = express.Router();

router.use(authenticate);

// Reads: MASTER, OWNER, CAFE_ADMIN
router.get(
  '/orders',
  authorize('PROCUREMENT_READ', { allowedRoles: ['MASTER', 'OWNER', 'CAFE_ADMIN'] }),
  listOrders
);

router.get(
  '/orders/:purchaseOrderId',
  authorize('PROCUREMENT_READ', { allowedRoles: ['MASTER', 'OWNER', 'CAFE_ADMIN'] }),
  getOrder
);

// Writes: MASTER, CAFE_ADMIN
router.post(
  '/orders',
  authorize('PROCUREMENT_WRITE', { allowedRoles: ['MASTER', 'CAFE_ADMIN'] }),
  createOrder
);

router.post(
  '/orders/:purchaseOrderId/submit',
  authorize('PROCUREMENT_WRITE', { allowedRoles: ['MASTER', 'CAFE_ADMIN'] }),
  submitOrder
);

router.post(
  '/orders/:purchaseOrderId/approve',
  authorize('PROCUREMENT_APPROVE', { allowedRoles: ['MASTER', 'OWNER', 'CAFE_ADMIN'] }),
  approveOrder
);

router.post(
  '/orders/:purchaseOrderId/order',
  authorize('PROCUREMENT_WRITE', { allowedRoles: ['MASTER', 'CAFE_ADMIN'] }),
  orderSent
);

router.post(
  '/orders/:purchaseOrderId/receive',
  authorize('PROCUREMENT_RECEIVE', { allowedRoles: ['MASTER', 'CAFE_ADMIN'] }),
  receiveOrder
);

router.post(
  '/orders/:purchaseOrderId/cancel',
  authorize('PROCUREMENT_WRITE', { allowedRoles: ['MASTER', 'OWNER', 'CAFE_ADMIN'] }),
  cancelOrder
);

module.exports = router;
