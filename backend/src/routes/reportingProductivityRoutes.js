'use strict';

/**
 * REPORTING PRODUCTIVITY ROUTES — PM-02M
 * Mounted at: /api/v1/reporting-productivity (registered in routes/index.js)
 *
 * All routes require authentication.
 * Authorization is enforced per-endpoint inside the controller.
 */

const express = require('express');
const { authenticate } = require('../middleware/authenticate');
const {
  createCustomReport,
  listCustomReports,
  getCustomReport,
  updateCustomReport,
  archiveCustomReport,
  cloneCustomReport,
  signOffCustomReport,
  createReportPack,
  listReportPacks,
  getReportPack,
  updateReportPack,
  archiveReportPack,
  previewReportPack,
  exportReportPack,
  addFavourite,
  listFavourites,
  removeFavourite,
  validateExportFormatEndpoint,
  getExportManifest,
  getSubscriptionCapability,
  createSubscription,
  denyRegistryMutation,
} = require('../controllers/reportingProductivityController');

const router = express.Router();

router.use(authenticate);

// ── Custom Reports / Saved Views ───────────────────────────────────────────────
router.post('/custom-reports', createCustomReport);
router.get('/custom-reports', listCustomReports);
router.get('/custom-reports/:customReportId', getCustomReport);
router.patch('/custom-reports/:customReportId', updateCustomReport);
router.delete('/custom-reports/:customReportId', archiveCustomReport);
router.post('/custom-reports/:customReportId/clone', cloneCustomReport);
router.post('/custom-reports/:customReportId/sign-off', signOffCustomReport);
router.get('/custom-reports/:customReportId/export-manifest', getExportManifest);

// ── Report Packs ───────────────────────────────────────────────────────────────
router.post('/report-packs', createReportPack);
router.get('/report-packs', listReportPacks);
router.get('/report-packs/:reportPackId', getReportPack);
router.patch('/report-packs/:reportPackId', updateReportPack);
router.delete('/report-packs/:reportPackId', archiveReportPack);
router.get('/report-packs/:reportPackId/preview', previewReportPack);
router.post('/report-packs/:reportPackId/export', exportReportPack);

// ── Favourites ─────────────────────────────────────────────────────────────────
router.post('/favourites', addFavourite);
router.get('/favourites', listFavourites);
router.delete('/favourites/:favouriteId', removeFavourite);

// ── Export Format Validation ───────────────────────────────────────────────────
router.post('/validate-export-format', validateExportFormatEndpoint);

// ── Subscriptions — truthfully NOT_IMPLEMENTED ─────────────────────────────────
router.get('/subscriptions/capability', getSubscriptionCapability);
router.post('/subscriptions', createSubscription);

// ── Registry Protection — canonical definitions are immutable ──────────────────
router.all('/registry/*splat', denyRegistryMutation);

module.exports = router;
