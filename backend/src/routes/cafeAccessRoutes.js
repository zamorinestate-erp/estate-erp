'use strict';

const express = require('express');

const { authenticate } = require('../middleware/authenticate');
const {
  resolveGateway,
  getAccessSummary,
  revealPermanentPin,
  rotateQr,
  rotateLink,
  emergencyLock,
  emergencyUnlock,
  runAccessTest,
} = require('../controllers/cafeAccessController');

const router = express.Router();

// 1. Gateway Resolution (Public resolver: resolves Permanent PIN, QR, or Link to short-lived Gateway Context)
router.post('/resolve', resolveGateway);

// 2. Governance Endpoints (Requires valid authentication: MASTER or OWNER only)
router.use(authenticate);

router.get('/:cafeId', getAccessSummary);
router.post('/:cafeId/reveal-pin', revealPermanentPin);
router.post('/:cafeId/rotate-qr', rotateQr);
router.post('/:cafeId/rotate-link', rotateLink);
router.post('/:cafeId/emergency-lock', emergencyLock);
router.post('/:cafeId/emergency-unlock', emergencyUnlock);
router.post('/:cafeId/test-access', runAccessTest);

module.exports = router;
