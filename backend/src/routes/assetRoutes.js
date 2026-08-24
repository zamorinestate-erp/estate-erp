'use strict';

/**
 * ASSET & EQUIPMENT MAINTENANCE ROUTES
 * Mounted at: /api/v1/assets (registered in routes/index.js)
 */

const express = require('express');
const { authenticate } = require('../middleware/authenticate');
const {
  getAssetOverview,
  listAssets,
  createAsset,
  getAssetDetail,
  commissionAsset,
  transferAsset,
  toggleSafetyHold,
  retireAsset,
  listWorkOrders,
  createWorkOrder,
  updateWorkOrder,
  listMaintenancePlans,
  createMaintenancePlan,
  logMaintenanceJob,
} = require('../controllers/assetController');

const router = express.Router();

router.use(authenticate);

// Overview
router.get('/overview', getAssetOverview);

// Work Orders
router.get('/work-orders', listWorkOrders);
router.post('/work-orders', createWorkOrder);
router.patch('/work-orders/:workOrderId', updateWorkOrder);

// Maintenance Plans
router.get('/plans', listMaintenancePlans);
router.post('/plans', createMaintenancePlan);

// Asset Register CRUD & Lifecycle
router.get('/', listAssets);
router.get('/items', listAssets);
router.post('/', createAsset);
router.get('/:assetId', getAssetDetail);
router.post('/:assetId/commission', commissionAsset);
router.post('/:assetId/transfer', transferAsset);
router.post('/:assetId/safety-hold', toggleSafetyHold);
router.post('/:assetId/retire', retireAsset);
router.post('/:assetId/maintenance', logMaintenanceJob);

module.exports = router;
