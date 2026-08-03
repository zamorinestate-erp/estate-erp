'use strict';

const express = require('express');

const {
  authenticate,
} = require('../middleware/authenticate');

const {
  listExpenses,
  getExpenseSummary,
  getExpense,
  createExpense,
  updateExpense,
  submitExpense,
  decideExpense,
  markExpensePaid,
  reverseExpense,
} = require('../controllers/expenseController');

const router = express.Router();

router.use(authenticate);

router
  .route('/')
  .get(listExpenses)
  .post(createExpense);

router.get(
  '/summary',
  getExpenseSummary
);

router.get(
  '/:expenseId',
  getExpense
);

router.patch(
  '/:expenseId',
  updateExpense
);

router.post(
  '/:expenseId/submit',
  submitExpense
);

router.post(
  '/:expenseId/decision',
  decideExpense
);

router.post(
  '/:expenseId/pay',
  markExpensePaid
);

router.post(
  '/:expenseId/reverse',
  reverseExpense
);

module.exports = router;
