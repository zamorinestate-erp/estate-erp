'use strict';

/**
 * TRASH BIN, RECOVERY & DATA DISPOSITION ROUTES — SCR-024
 *
 * ABSOLUTE RESTRICTION: MASTER ONLY (Or explicitly permitted Governance Auditors)
 * Mounted at: /api/v1/trash (registered in routes/index.js)
 */

const express = require('express');
const { authenticate } = require('../middleware/authenticate');
const { authorize } = require('../middleware/authorize');
const {
  listTrashItems,
  getTrashItemDetails,
  previewRestoreItem,
  restoreTrashItem,
  bulkRestoreTrashItems,
  placePreservationHold,
  releasePreservationHold,
  submitDispositionRequest,
  approveDisposition,
  executeDispositionPurge,
  listDispositionCertificates,
  getDispositionCertificatePdf,
  listRetentionPolicies,
  toggleEmergencyDispositionPause,
} = require('../controllers/trashController');

const router = express.Router();

router.use(authenticate);

// ── Overview & Query ─────────────────────────────────────────────────────────
router.get('/', listTrashItems);
router.get('/stats', listTrashItems);
router.get('/policies', listRetentionPolicies);
router.get('/certificates', listDispositionCertificates);
router.get('/certificates/:certificateId/pdf', getDispositionCertificatePdf);
router.post('/emergency-pause', toggleEmergencyDispositionPause);

// ── Record Level Operations ──────────────────────────────────────────────────
router.get('/:trashId', getTrashItemDetails);
router.get('/:trashId/preview-restore', previewRestoreItem);
router.post('/restore', restoreTrashItem);
router.post('/bulk-restore', bulkRestoreTrashItems);

// ── Preservation Holds ───────────────────────────────────────────────────────
router.post('/:trashId/holds', placePreservationHold);
router.delete('/:trashId/holds/:holdId', releasePreservationHold);

// ── Governed Disposition Pipeline ────────────────────────────────────────────
router.post('/:trashId/disposition-request', submitDispositionRequest);
router.post('/:trashId/approve-disposition', approveDisposition);
router.post('/:trashId/purge', executeDispositionPurge);

module.exports = router;
