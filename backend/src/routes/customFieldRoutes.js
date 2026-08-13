'use strict';

/**
 * CUSTOM FIELD DEFINITION ROUTES  (Capability 26)
 * Mounted at: /api/v1/custom-fields (registered in routes/index.js)
 */

const express = require('express');
const { authenticate } = require('../middleware/authenticate');
const { authorize } = require('../middleware/authorize');
const {
  listCustomFields,
  getCustomField,
  createCustomField,
  updateCustomField,
  archiveCustomField,
} = require('../controllers/customFieldController');

const router = express.Router();

router.use(authenticate);

// Reads: All authenticated roles
router.get(
  '/',
  authorize('ADMIN', { allowedRoles: ['MASTER', 'OWNER', 'CAFE_ADMIN', 'STAFF'] }),
  listCustomFields
);

router.get(
  '/:key',
  authorize('ADMIN', { allowedRoles: ['MASTER', 'OWNER', 'CAFE_ADMIN', 'STAFF'] }),
  getCustomField
);

// Writes: MASTER ONLY
router.post(
  '/',
  authorize('ADMIN', { allowedRoles: ['MASTER'] }),
  createCustomField
);

router.patch(
  '/:key',
  authorize('ADMIN', { allowedRoles: ['MASTER'] }),
  updateCustomField
);

router.delete(
  '/:key',
  authorize('ADMIN', { allowedRoles: ['MASTER'] }),
  archiveCustomField
);

module.exports = router;
