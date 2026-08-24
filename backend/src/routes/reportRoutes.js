'use strict';

/**
 * REPORTS & ANALYTICS ROUTES — SCR-022
 * Mounted at: /api/v1/reports (registered in routes/index.js)
 */

const express = require('express');
const { authenticate } = require('../middleware/authenticate');
const { authorize } = require('../middleware/authorize');
const {
  getAnalyticsOverview,
  getReportCatalogue,
  getSalesAnalytics,
  getFinanceAnalytics,
  getWorkforceAnalytics,
  getCustomerAnalytics,
  getInventoryAnalytics,
  getProcurementAnalytics,
  getMenuAnalytics,
  getQualityAnalytics,
  getAssetAnalytics,
  getPortfolioAnalytics,
  getGoalsAndScorecards,
  getScheduledReportsAndAlerts,
  getCrossModuleReconciliations,
  getDataQualityAndLineage,
  getMetricsDictionary,
  generateZurfExport,
  listExportJobs,
  getAnalyticsIntegrity,
  getDashboardReport,
  getDailySummaryReport,
  getCashFlowReport,
  getExpensesReport,
  getAttendanceReport,
} = require('../controllers/reportController');

const router = express.Router();

router.use(authenticate);

// ── Headline & Overview ────────────────────────────────────────────────────────
router.get(
  '/overview',
  authorize('REPORTS_READ', { allowedRoles: ['MASTER', 'OWNER', 'CAFE_ADMIN'] }),
  getAnalyticsOverview
);

router.get(
  '/library',
  authorize('REPORTS_READ', { allowedRoles: ['MASTER', 'OWNER', 'CAFE_ADMIN'] }),
  getReportCatalogue
);

// ── Domain Analytics ───────────────────────────────────────────────────────────
router.get(
  '/sales',
  authorize('REPORTS_READ', { allowedRoles: ['MASTER', 'OWNER', 'CAFE_ADMIN'] }),
  getSalesAnalytics
);

router.get(
  '/finance',
  authorize('REPORTS_READ', { allowedRoles: ['MASTER', 'OWNER', 'CAFE_ADMIN'] }),
  getFinanceAnalytics
);

router.get(
  '/workforce',
  authorize('REPORTS_READ', { allowedRoles: ['MASTER', 'OWNER', 'CAFE_ADMIN'] }),
  getWorkforceAnalytics
);

router.get(
  '/customers',
  authorize('REPORTS_READ', { allowedRoles: ['MASTER', 'OWNER', 'CAFE_ADMIN'] }),
  getCustomerAnalytics
);

router.get(
  '/inventory',
  authorize('REPORTS_READ', { allowedRoles: ['MASTER', 'OWNER', 'CAFE_ADMIN'] }),
  getInventoryAnalytics
);

router.get(
  '/procurement',
  authorize('REPORTS_READ', { allowedRoles: ['MASTER', 'OWNER', 'CAFE_ADMIN'] }),
  getProcurementAnalytics
);

router.get(
  '/menu',
  authorize('REPORTS_READ', { allowedRoles: ['MASTER', 'OWNER', 'CAFE_ADMIN'] }),
  getMenuAnalytics
);

router.get(
  '/quality',
  authorize('REPORTS_READ', { allowedRoles: ['MASTER', 'OWNER', 'CAFE_ADMIN'] }),
  getQualityAnalytics
);

router.get(
  '/assets',
  authorize('REPORTS_READ', { allowedRoles: ['MASTER', 'OWNER', 'CAFE_ADMIN'] }),
  getAssetAnalytics
);

router.get(
  '/portfolio',
  authorize('REPORTS_READ', { allowedRoles: ['MASTER', 'OWNER'] }),
  getPortfolioAnalytics
);

router.get(
  '/goals',
  authorize('REPORTS_READ', { allowedRoles: ['MASTER', 'OWNER', 'CAFE_ADMIN'] }),
  getGoalsAndScorecards
);

router.get(
  '/scheduled-alerts',
  authorize('REPORTS_READ', { allowedRoles: ['MASTER', 'OWNER', 'CAFE_ADMIN'] }),
  getScheduledReportsAndAlerts
);

router.get(
  '/reconciliations',
  authorize('REPORTS_READ', { allowedRoles: ['MASTER', 'OWNER'] }),
  getCrossModuleReconciliations
);

router.get(
  '/data-quality',
  authorize('REPORTS_READ', { allowedRoles: ['MASTER', 'OWNER'] }),
  getDataQualityAndLineage
);

router.get(
  '/metrics',
  authorize('REPORTS_READ', { allowedRoles: ['MASTER', 'OWNER', 'CAFE_ADMIN'] }),
  getMetricsDictionary
);

// ── ZURF Corporate Exports ────────────────────────────────────────────────────
router.post(
  '/export',
  authorize('REPORTS_EXPORT', { allowedRoles: ['MASTER', 'OWNER', 'CAFE_ADMIN'] }),
  generateZurfExport
);

router.get(
  '/export/jobs',
  authorize('REPORTS_EXPORT', { allowedRoles: ['MASTER', 'OWNER', 'CAFE_ADMIN'] }),
  listExportJobs
);

router.get(
  '/integrity',
  authorize('REPORTS_READ', { allowedRoles: ['MASTER', 'OWNER'] }),
  getAnalyticsIntegrity
);

// ── Legacy Compatibility ───────────────────────────────────────────────────────
router.get(
  '/dashboard',
  authorize('REPORTS_READ', { allowedRoles: ['MASTER', 'OWNER', 'CAFE_ADMIN'] }),
  getDashboardReport
);

router.get(
  '/daily-summary',
  authorize('REPORTS_READ', { allowedRoles: ['MASTER', 'OWNER', 'CAFE_ADMIN'] }),
  getDailySummaryReport
);

router.get(
  '/cash-flow',
  authorize('REPORTS_READ', { allowedRoles: ['MASTER', 'OWNER', 'CAFE_ADMIN'] }),
  getCashFlowReport
);

router.get(
  '/expenses',
  authorize('REPORTS_READ', { allowedRoles: ['MASTER', 'OWNER', 'CAFE_ADMIN'] }),
  getExpensesReport
);

router.get(
  '/attendance',
  authorize('REPORTS_READ', { allowedRoles: ['MASTER', 'OWNER', 'CAFE_ADMIN'] }),
  getAttendanceReport
);

module.exports = router;
