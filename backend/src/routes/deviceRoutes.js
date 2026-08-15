'use strict';

const express = require('express');
const router = express.Router();

const { authenticate } = require('../middleware/authenticate');
const { authorize } = require('../middleware/authorize');
const { attachDeviceContext } = require('../middleware/deviceContext');
const deviceController = require('../controllers/deviceController');

// 1. Device Enrollment Initialization (Tablet creates pending enrollment)
router.post('/enrollment/start', (req, res, next) => deviceController.startEnrollment(req, res, next));

// 2. Device Enrollment Approval (MASTER only + Step-up Auth)
router.post(
  '/:deviceId/approve',
  authenticate,
  authorize('USER:MANAGE'),
  attachDeviceContext,
  (req, res, next) => deviceController.approveEnrollment(req, res, next)
);

// 3. Emergency Device Revocation (MASTER only + Step-up Auth)
router.post(
  '/:deviceId/revoke',
  authenticate,
  authorize('USER:MANAGE'),
  attachDeviceContext,
  (req, res, next) => deviceController.revokeDevice(req, res, next)
);

// 4. Issue Rotating QR Challenge (CAFE_OWNED device capability)
router.post(
  '/attendance/challenges',
  authenticate,
  attachDeviceContext,
  (req, res, next) => deviceController.issueChallenge(req, res, next)
);

// 5. Issue Offline Signing Lease (CAFE_ADMIN / MASTER on CAFE_OWNED device)
router.post(
  '/attendance/leases',
  authenticate,
  attachDeviceContext,
  (req, res, next) => deviceController.issueOfflineLease(req, res, next)
);

module.exports = router;
