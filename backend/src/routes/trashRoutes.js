'use strict';

/**
 * TRASH BIN ROUTES
 * ABSOLUTE RESTRICTION: MASTER ONLY
 * Mounted at: /api/v1/trash (registered in routes/index.js)
 */

const express = require('express');
const { authenticate } = require('../middleware/authenticate');
const { authorize } = require('../middleware/authorize');
const { listTrashItems, restoreTrashItem } = require('../controllers/trashController');

const router = express.Router();

router.use(authenticate);

router.get(
  '/',
  authorize('TRASH_READ', { absoluteRestriction: 'MASTER_TRASH_BIN', allowedRoles: ['MASTER'] }),
  listTrashItems
);

router.post(
  '/restore',
  authorize('TRASH_RESTORE', { absoluteRestriction: 'MASTER_TRASH_BIN', allowedRoles: ['MASTER'] }),
  restoreTrashItem
);

module.exports = router;
