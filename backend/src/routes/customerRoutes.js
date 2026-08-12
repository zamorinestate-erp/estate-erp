'use strict';

/**
 * CUSTOMER ROUTES
 * Mounted at: /api/v1/customers (registered in routes/index.js)
 */

const express = require('express');
const { authenticate } = require('../middleware/authenticate');
const { authorize } = require('../middleware/authorize');
const {
  listCustomers,
  getCustomer,
  createCustomer,
  earnPoints,
  redeemPoints,
} = require('../controllers/customerController');

const router = express.Router();

router.use(authenticate);

router.get(
  '/',
  authorize('CUSTOMERS_READ', { allowedRoles: ['MASTER', 'OWNER', 'CAFE_ADMIN'] }),
  listCustomers
);

router.get(
  '/:customerId',
  authorize('CUSTOMERS_READ', { allowedRoles: ['MASTER', 'OWNER', 'CAFE_ADMIN'] }),
  getCustomer
);

router.post(
  '/',
  authorize('CUSTOMERS_WRITE', { allowedRoles: ['MASTER', 'CAFE_ADMIN'] }),
  createCustomer
);

router.post(
  '/:customerId/points/earn',
  authorize('CUSTOMERS_WRITE', { allowedRoles: ['MASTER', 'CAFE_ADMIN'] }),
  earnPoints
);

router.post(
  '/:customerId/points/redeem',
  authorize('CUSTOMERS_WRITE', { allowedRoles: ['MASTER', 'CAFE_ADMIN'] }),
  redeemPoints
);

module.exports = router;
