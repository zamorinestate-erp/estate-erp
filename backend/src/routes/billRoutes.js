'use strict';

/**
 * BILL ROUTES
 * Mounted at: /api/v1/bills (registered in routes/index.js)
 */

const express = require('express');
const { authenticate } = require('../middleware/authenticate');
const { authorize } = require('../middleware/authorize');
const {
  listBills,
  getBill,
  createBill,
  voidBill,
} = require('../controllers/billController');

const router = express.Router();

router.use(authenticate);

router.get(
  '/',
  authorize('POS_READ', { allowedRoles: ['MASTER', 'OWNER', 'CAFE_ADMIN', 'STAFF'] }),
  listBills
);

router.get(
  '/:billId',
  authorize('POS_READ', { allowedRoles: ['MASTER', 'OWNER', 'CAFE_ADMIN', 'STAFF'] }),
  getBill
);

router.post(
  '/',
  authorize('POS_WRITE', { allowedRoles: ['MASTER', 'CAFE_ADMIN', 'STAFF'] }),
  createBill
);

router.post(
  '/:billId/void',
  authorize('POS_VOID', { allowedRoles: ['MASTER', 'CAFE_ADMIN'] }),
  voidBill
);

module.exports = router;
