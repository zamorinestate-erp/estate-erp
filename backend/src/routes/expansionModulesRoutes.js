'use strict';

/**
 * EXPANSION MODULES ROUTES (Capabilities 06, 17, 24, 32)
 */

const express = require('express');
const { authenticate } = require('../middleware/authenticate');
const { authorize } = require('../middleware/authorize');
const {
  listSupplierPortalOrders,
  listCandidates,
  createCandidate,
  listWorkflows,
  createWorkflow,
  listSustainabilityLogs,
  recordSustainabilityLog,
} = require('../controllers/expansionModulesController');

const router = express.Router();

router.use(authenticate);

// Capability 06 — Supplier Portal
router.get(
  '/supplier-portal/orders',
  authorize('VENDORS_READ', { allowedRoles: ['MASTER', 'OWNER', 'CAFE_ADMIN'] }),
  listSupplierPortalOrders
);

// Capability 17 — Recruitment / ATS (Deactivated per Frozen Scope Policy: Rejected Feature)

// Capability 24 — Workflow Designer
router.get(
  '/workflows',
  authorize('ADMIN', { allowedRoles: ['MASTER', 'OWNER'] }),
  listWorkflows
);

router.post(
  '/workflows',
  authorize('ADMIN', { allowedRoles: ['MASTER'] }),
  createWorkflow
);

// Capability 32 — Sustainability Tracking
router.get(
  '/sustainability',
  authorize('DASHBOARD_READ', { allowedRoles: ['MASTER', 'OWNER', 'CAFE_ADMIN'] }),
  listSustainabilityLogs
);

router.post(
  '/sustainability',
  authorize('DASHBOARD_READ', { allowedRoles: ['MASTER', 'OWNER', 'CAFE_ADMIN'] }),
  recordSustainabilityLog
);

module.exports = router;
