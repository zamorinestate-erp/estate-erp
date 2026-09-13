'use strict';

/**
 * DASHBOARD ROUTES
 * Mounted at: /api/v1/dashboard (registered in routes/index.js)
 *
 * GET  /dashboard              — Full Command Centre payload (MASTER/OWNER)
 * GET  /dashboard/metrics      — Alias for /dashboard (legacy compatibility)
 * GET  /dashboard/cafe-ops     — ADM-SCR-001: Cafe Operations Dashboard (CAFE_ADMIN only)
 * GET  /dashboard/saved-views  — List user's saved dashboard views
 * POST /dashboard/saved-views  — Create a new saved view
 * PUT  /dashboard/saved-views/:savedViewId  — Update a saved view
 * DELETE /dashboard/saved-views/:savedViewId — Delete a saved view
 * GET  /dashboard/targets      — List café targets
 * POST /dashboard/targets      — Upsert a café target (Primary Master / Owner only)
 */

const express = require('express');
const { authenticate } = require('../middleware/authenticate');
const { attachDeviceContext } = require('../middleware/deviceContext');

const {
  getDashboardData,
  getDashboardMetrics,
  getCafeOpsDashboard,
  getOperationalExceptions,
  listSavedViews,
  createSavedView,
  updateSavedView,
  deleteSavedView,
  listTargets,
  upsertTarget,
} = require('../controllers/dashboardController');

const router = express.Router();

router.use(authenticate);
router.use(attachDeviceContext);

// ── ADM-SCR-001: Cafe Operations Dashboard ───────────────────────────────────
// Server derives effective cafe from trusted context (device / operator / assigned cafe).
router.get('/cafe-ops', getCafeOpsDashboard);

// ── Operational Exception Centre (R02-08) ───────────────────────────────────
router.get('/operational-exceptions', getOperationalExceptions);

// ── Main dashboard data ──────────────────────────────────────────────────────
router.get('/', getDashboardData);
router.get('/metrics', getDashboardMetrics);

// ── Saved views ──────────────────────────────────────────────────────────────
router.get('/saved-views', listSavedViews);
router.post('/saved-views', createSavedView);
router.put('/saved-views/:savedViewId', updateSavedView);
router.delete('/saved-views/:savedViewId', deleteSavedView);

// ── Targets ──────────────────────────────────────────────────────────────────
router.get('/targets', listTargets);
router.post('/targets', upsertTarget);

module.exports = router;
