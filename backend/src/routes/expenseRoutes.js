'use strict';

const express = require('express');

const { authenticate } = require('../middleware/authenticate');
const { authorize } = require('../middleware/authorize');

const {
  getExpenseOverview,
  listExpenses,
  getExpense,
  createExpense,
  updateExpense,
  submitExpense,
  decideExpense,
  recordMissingReceipt,
  matchCorporateCard,
  liquidateAdvance,
  markExpensePaid,
  reverseExpense,
  getExpenseIntegrity,
  getExpenseSummary,
  listExpenseRequests,
  createExpenseRequest,
  listExpensePolicies,
  createExpensePolicy,
  listCorporateCardTransactions,
  listOperationalAdvances,
  createOperationalAdvance,
} = require('../controllers/expenseController');

const router = express.Router();

router.use(authenticate);

// Overview & Summaries
router.get(
  '/overview',
  authorize('EXPENSE:READ', { allowedRoles: ['MASTER', 'OWNER', 'CAFE_ADMIN'] }),
  getExpenseOverview
);

router.get(
  '/summary',
  authorize('EXPENSE:READ', { allowedRoles: ['MASTER', 'OWNER', 'CAFE_ADMIN'] }),
  getExpenseSummary
);

router.get(
  '/integrity',
  authorize('EXPENSE:READ', { allowedRoles: ['MASTER', 'OWNER'] }),
  getExpenseIntegrity
);

// Pre-spend Requests
router.get(
  '/requests',
  authorize('EXPENSE:READ', { allowedRoles: ['MASTER', 'OWNER', 'CAFE_ADMIN', 'STAFF'] }),
  listExpenseRequests
);

router.post(
  '/requests',
  authorize('EXPENSE:WRITE', { allowedRoles: ['MASTER', 'CAFE_ADMIN', 'STAFF'] }),
  createExpenseRequest
);

// Policies
router.get(
  '/policies',
  authorize('EXPENSE:READ', { allowedRoles: ['MASTER', 'OWNER', 'CAFE_ADMIN'] }),
  listExpensePolicies
);

router.post(
  '/policies',
  authorize('EXPENSE:WRITE', { allowedRoles: ['MASTER'] }),
  createExpensePolicy
);

// Cards & Advances
router.get(
  '/cards',
  authorize('EXPENSE:READ', { allowedRoles: ['MASTER', 'OWNER', 'CAFE_ADMIN'] }),
  listCorporateCardTransactions
);

router.post(
  '/cards/match',
  authorize('EXPENSE:WRITE', { allowedRoles: ['MASTER', 'CAFE_ADMIN'] }),
  matchCorporateCard
);

router.get(
  '/advances',
  authorize('EXPENSE:READ', { allowedRoles: ['MASTER', 'OWNER', 'CAFE_ADMIN'] }),
  listOperationalAdvances
);

router.post(
  '/advances',
  authorize('EXPENSE:WRITE', { allowedRoles: ['MASTER'] }),
  createOperationalAdvance
);

router.post(
  '/advances/liquidate',
  authorize('EXPENSE:WRITE', { allowedRoles: ['MASTER', 'CAFE_ADMIN'] }),
  liquidateAdvance
);

// CRUD
router
  .route('/')
  .get(
    authorize('EXPENSE:READ', { allowedRoles: ['MASTER', 'OWNER', 'CAFE_ADMIN'] }),
    listExpenses
  )
  .post(
    authorize('EXPENSE:WRITE', { allowedRoles: ['MASTER', 'CAFE_ADMIN', 'STAFF'] }),
    createExpense
  );

router.get(
  '/:expenseId',
  authorize('EXPENSE:READ', { allowedRoles: ['MASTER', 'OWNER', 'CAFE_ADMIN', 'STAFF'] }),
  getExpense
);

router.patch(
  '/:expenseId',
  authorize('EXPENSE:WRITE', { allowedRoles: ['MASTER', 'CAFE_ADMIN', 'STAFF'] }),
  updateExpense
);

router.post(
  '/:expenseId/submit',
  authorize('EXPENSE:WRITE', { allowedRoles: ['MASTER', 'CAFE_ADMIN', 'STAFF'] }),
  submitExpense
);

router.post(
  '/:expenseId/decision',
  authorize('EXPENSE:DECIDE', { allowedRoles: ['MASTER', 'OWNER'] }),
  decideExpense
);

router.post(
  '/:expenseId/missing-receipt',
  authorize('EXPENSE:WRITE', { allowedRoles: ['MASTER', 'CAFE_ADMIN'] }),
  recordMissingReceipt
);

router.post(
  '/:expenseId/pay',
  authorize('EXPENSE:DECIDE', { allowedRoles: ['MASTER'] }),
  markExpensePaid
);

router.post(
  '/:expenseId/reverse',
  authorize('EXPENSE:DECIDE', { allowedRoles: ['MASTER'] }),
  reverseExpense
);

module.exports = router;
