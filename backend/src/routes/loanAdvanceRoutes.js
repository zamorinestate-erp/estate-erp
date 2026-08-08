'use strict';

const express = require('express');

const {
  authenticate,
} = require('../middleware/authenticate');

const {
  listMyLoanAdvances,
  getMyLoanAdvance,
} = require('../controllers/loanAdvanceController');

const router = express.Router();

router.use(authenticate);

router.get(
  '/me',
  listMyLoanAdvances
);

router.get(
  '/me/:loanAdvanceId',
  getMyLoanAdvance
);

module.exports = router;
