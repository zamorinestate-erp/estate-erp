'use strict';

const express = require('express');
const { authenticate } = require('../middleware/authenticate');
const {
  listTargetedUpdates,
  checkForUpdates,
  publishRelease,
  downloadPackage,
  applyRelease,
  verifyRelease,
  rollbackRelease,
} = require('../controllers/updateController');

const router = express.Router();

router.use(authenticate);

// ── Role-Targeted Update Endpoints ───────────────────────────────────────────
router.get('/', listTargetedUpdates);
router.get('/check', checkForUpdates);
router.post('/', publishRelease);
router.get('/:releaseId/download', downloadPackage);
router.post('/:releaseId/apply', applyRelease);
router.post('/:releaseId/verify', verifyRelease);
router.post('/:releaseId/rollback', rollbackRelease);

module.exports = router;
