'use strict';

const express = require('express');

const {
  authenticate,
} = require('../middleware/authenticate');
const {
  attachDeviceContext,
} = require('../middleware/deviceContext');

const {
  listCashTransactions,
  getCashTransaction,
  createCashTransaction,
  getCashSummary,
  reverseCashTransaction,
} = require('../controllers/cashController');

const router = express.Router();

router.use(authenticate);
router.use(attachDeviceContext);

router
  .route('/')
  .get(listCashTransactions)
  .post(createCashTransaction);

router.get(
  '/summary',
  getCashSummary
);

router.get(
  '/:cashTransactionId',
  getCashTransaction
);

router.post(
  '/:cashTransactionId/reverse',
  reverseCashTransaction
);

module.exports = router;
