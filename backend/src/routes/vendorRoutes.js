'use strict';

/**
 * VENDOR ROUTES
 * Mounted at: /api/v1/vendors (registered in routes/index.js)
 */

const express = require('express');
const { authenticate } = require('../middleware/authenticate');
const { authorize } = require('../middleware/authorize');
const {
  listVendors,
  getVendor,
  createVendor,
  updateVendor,
  changeVendorStatus,
} = require('../controllers/vendorController');

const router = express.Router();

router.use(authenticate);

// Reads: MASTER, OWNER, CAFE_ADMIN
router.get(
  '/',
  authorize('VENDORS_READ', { allowedRoles: ['MASTER', 'OWNER', 'CAFE_ADMIN'] }),
  listVendors
);

router.get(
  '/:vendorId',
  authorize('VENDORS_READ', { allowedRoles: ['MASTER', 'OWNER', 'CAFE_ADMIN'] }),
  getVendor
);

// Writes: MASTER ONLY
router.post(
  '/',
  authorize('VENDORS_WRITE', { allowedRoles: ['MASTER'] }),
  createVendor
);

router.patch(
  '/:vendorId',
  authorize('VENDORS_WRITE', { allowedRoles: ['MASTER'] }),
  updateVendor
);

router.post(
  '/:vendorId/status',
  authorize('VENDORS_WRITE', { allowedRoles: ['MASTER'] }),
  changeVendorStatus
);

module.exports = router;
