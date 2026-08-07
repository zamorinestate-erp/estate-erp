'use strict';

/**
 * REVENUE SHARE ROUTES
 * Mounted at: /api/v1/revenue-share (registered in routes/index.js)
 */

const express = require('express');
const { authenticate } = require('../middleware/authenticate');
const { authorize } = require('../middleware/authorize');
const {
  listAgreements,
  createAgreement,
} = require('../controllers/revenueShareController');

const router = express.Router();

router.use(authenticate);

router.get(
  '/agreements',
  authorize('REVENUE_SHARE_READ', { allowedRoles: ['MASTER', 'OWNER'] }),
  listAgreements
);

router.post(
  '/agreements',
  authorize('REVENUE_SHARE_WRITE', { allowedRoles: ['MASTER'] }),
  createAgreement
);

module.exports = router;
