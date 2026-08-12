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
  authorize('POS_READ', { allowedRoles: ['MASTER', 'OWNER', 'CAFE_ADMIN'] }),
  listBills
);

router.get(
  '/:billId',
  authorize('POS_READ', { allowedRoles: ['MASTER', 'OWNER', 'CAFE_ADMIN'] }),
  getBill
);

router.post(
  '/',
  authorize('POS_WRITE', { allowedRoles: ['MASTER', 'CAFE_ADMIN'] }),
  createBill
);

router.post(
  '/:billId/void',
  authorize('POS_VOID', { allowedRoles: ['MASTER', 'OWNER'] }),
  voidBill
);

module.exports = router;
