'use strict';

/**
 * ASSET ROUTES
 * Mounted at: /api/v1/assets (registered in routes/index.js)
 */

const express = require('express');
const { authenticate } = require('../middleware/authenticate');
const { authorize } = require('../middleware/authorize');
const {
  listAssets,
  createAsset,
  logMaintenanceJob,
} = require('../controllers/assetController');

const router = express.Router();

router.use(authenticate);

router.get(
  '/',
  authorize('ASSETS_READ', { allowedRoles: ['MASTER', 'OWNER', 'CAFE_ADMIN'] }),
  listAssets
);

router.post(
  '/',
  authorize('ASSETS_WRITE', { allowedRoles: ['MASTER', 'CAFE_ADMIN'] }),
  createAsset
);

router.post(
  '/:assetId/maintenance',
  authorize('ASSETS_WRITE', { allowedRoles: ['MASTER', 'CAFE_ADMIN'] }),
  logMaintenanceJob
);

module.exports = router;
