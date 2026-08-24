'use strict';

/**
 * QUALITY & COMPLIANCE ROUTES — SCR-021
 * Mounted at: /api/v1/quality (registered in routes/index.js)
 */

const express = require('express');
const { authenticate } = require('../middleware/authenticate');
const { authorize } = require('../middleware/authorize');
const {
  getQualityOverview,
  listChecklists,
  submitChecklist,
  listTemplates,
  listTemperatures,
  recordTemperature,
  listQualityHolds,
  createQualityHold,
  releaseQualityHold,
  listNcrs,
  createNcr,
  listCapas,
  createCapa,
  verifyCapa,
  listAudits,
  getComplianceRegister,
  getTraceability,
  getQualityIntegrity,
} = require('../controllers/qualityController');

const router = express.Router();

router.use(authenticate);

// ── Headline & Overview ────────────────────────────────────────────────────────
router.get(
  '/overview',
  authorize('QUALITY_READ', { allowedRoles: ['MASTER', 'OWNER', 'CAFE_ADMIN'] }),
  getQualityOverview
);

router.get(
  '/integrity',
  authorize('QUALITY_READ', { allowedRoles: ['MASTER', 'OWNER'] }),
  getQualityIntegrity
);

// ── Checklists & Templates ───────────────────────────────────────────────────
router.get(
  '/checklists',
  authorize('QUALITY_READ', { allowedRoles: ['MASTER', 'OWNER', 'CAFE_ADMIN'] }),
  listChecklists
);

router.post(
  '/checklists',
  authorize('QUALITY_WRITE', { allowedRoles: ['MASTER', 'CAFE_ADMIN'] }),
  submitChecklist
);

router.get(
  '/templates',
  authorize('QUALITY_READ', { allowedRoles: ['MASTER', 'OWNER', 'CAFE_ADMIN'] }),
  listTemplates
);

// ── Temperatures & Excursions ────────────────────────────────────────────────
router.get(
  '/temperatures',
  authorize('QUALITY_READ', { allowedRoles: ['MASTER', 'OWNER', 'CAFE_ADMIN'] }),
  listTemperatures
);

router.post(
  '/temperatures',
  authorize('QUALITY_WRITE', { allowedRoles: ['MASTER', 'CAFE_ADMIN'] }),
  recordTemperature
);

// ── Quality Holds & Quarantines ──────────────────────────────────────────────
router.get(
  '/holds',
  authorize('QUALITY_READ', { allowedRoles: ['MASTER', 'OWNER', 'CAFE_ADMIN'] }),
  listQualityHolds
);

router.post(
  '/holds',
  authorize('QUALITY_WRITE', { allowedRoles: ['MASTER', 'CAFE_ADMIN'] }),
  createQualityHold
);

router.post(
  '/holds/:id/release',
  authorize('QUALITY_WRITE', { allowedRoles: ['MASTER', 'OWNER', 'CAFE_ADMIN'] }),
  releaseQualityHold
);

// ── NCR & CAPA Engine ────────────────────────────────────────────────────────
router.get(
  '/ncrs',
  authorize('QUALITY_READ', { allowedRoles: ['MASTER', 'OWNER', 'CAFE_ADMIN'] }),
  listNcrs
);

router.post(
  '/ncrs',
  authorize('QUALITY_WRITE', { allowedRoles: ['MASTER', 'CAFE_ADMIN'] }),
  createNcr
);

router.get(
  '/capas',
  authorize('QUALITY_READ', { allowedRoles: ['MASTER', 'OWNER', 'CAFE_ADMIN'] }),
  listCapas
);

router.post(
  '/capas',
  authorize('QUALITY_WRITE', { allowedRoles: ['MASTER', 'CAFE_ADMIN'] }),
  createCapa
);

router.post(
  '/capas/:id/verify',
  authorize('QUALITY_WRITE', { allowedRoles: ['MASTER', 'OWNER'] }),
  verifyCapa
);

// ── Audits & Inspections ─────────────────────────────────────────────────────
router.get(
  '/audits',
  authorize('QUALITY_READ', { allowedRoles: ['MASTER', 'OWNER', 'CAFE_ADMIN'] }),
  listAudits
);

// ── Compliance & Traceability ────────────────────────────────────────────────
router.get(
  '/compliance',
  authorize('QUALITY_READ', { allowedRoles: ['MASTER', 'OWNER', 'CAFE_ADMIN'] }),
  getComplianceRegister
);

router.get(
  '/traceability',
  authorize('QUALITY_READ', { allowedRoles: ['MASTER', 'OWNER', 'CAFE_ADMIN'] }),
  getTraceability
);

module.exports = router;
