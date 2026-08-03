'use strict';

const express = require('express');

const {
  authenticate,
} = require('../middleware/authenticate');

const {
  listCashTransactions,
  getCashTransaction,
  createCashTransaction,
  getCashSummary,
  reverseCashTransaction,
} = require('../controllers/cashController');

const router = express.Router();

router.use(authenticate);

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
