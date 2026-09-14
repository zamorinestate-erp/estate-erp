'use strict';

const express = require('express');

const {
  authenticate,
} = require('../middleware/authenticate');

const {
  listCafes,
  getCafe,
  createCafe,
  updateCafe,
  changeCafeStatus,
  archiveCafe,
  getCafeReadiness,
  updateReadinessChecklist,
  transitionLifecycleState,
  getComplianceAlerts,
  regenerateCafeLoginQr,
  downloadPrintableQrCardPdf,
  getCafeComplianceAndLicences,
} = require('../controllers/cafeController');

const router = express.Router();

router.use(authenticate);

router.get('/compliance/alerts', getComplianceAlerts);

router
  .route('/')
  .get(listCafes)
  .post(createCafe);

router
  .route('/:cafeId')
  .get(getCafe)
  .patch(updateCafe);

router.patch(
  '/:cafeId/status',
  changeCafeStatus
);

router.post(
  '/:cafeId/archive',
  archiveCafe
);

// Stage 03: Café Readiness Engine & Lifecycle States
router.get(
  '/:cafeId/readiness',
  getCafeReadiness
);

router.post(
  '/:cafeId/readiness/checklist',
  updateReadinessChecklist
);

router.post(
  '/:cafeId/readiness/transition',
  transitionLifecycleState
);

router.get(
  '/:cafeId/compliance-alerts',
  getComplianceAlerts
);

router.get(
  '/:cafeId/compliance-licences',
  getCafeComplianceAndLicences
);

// Stage 03: Stage 02 Universal QR Integration & A4 Printable Card
router.post(
  '/:cafeId/qr/regenerate',
  regenerateCafeLoginQr
);

router.get(
  '/:cafeId/qr/card',
  downloadPrintableQrCardPdf
);

module.exports = router;