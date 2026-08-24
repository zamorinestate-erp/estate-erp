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

const {
  getDashboardData,
  getDashboardMetrics,
  getCafeOpsDashboard,
  listSavedViews,
  createSavedView,
  updateSavedView,
  deleteSavedView,
  listTargets,
  upsertTarget,
} = require('../controllers/dashboardController');

const router = express.Router();

router.use(authenticate);

// ── ADM-SCR-001: Cafe Operations Dashboard ───────────────────────────────────
// CAFE_ADMIN only. Server derives cafe from auth.primaryCafeId — no query override.
router.get('/cafe-ops', getCafeOpsDashboard);

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
