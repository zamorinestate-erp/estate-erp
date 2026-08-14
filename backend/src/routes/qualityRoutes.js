'use strict';

/**
 * QUALITY ROUTES
 * Mounted at: /api/v1/quality (registered in routes/index.js)
 */

const express = require('express');
const { authenticate } = require('../middleware/authenticate');
const { authorize } = require('../middleware/authorize');
const {
  listChecklists,
  submitChecklist,
} = require('../controllers/qualityController');

const router = express.Router();

router.use(authenticate);

// Reads: Management roles
router.get(
  '/checklists',
  authorize('QUALITY_READ', { allowedRoles: ['MASTER', 'OWNER', 'CAFE_ADMIN'] }),
  listChecklists
);

// Writes: MASTER & CAFE_ADMIN
router.post(
  '/checklists',
  authorize('QUALITY_WRITE', { allowedRoles: ['MASTER', 'CAFE_ADMIN'] }),
  submitChecklist
);

module.exports = router;
