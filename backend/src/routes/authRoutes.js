'use strict';

const express = require('express');
const rateLimit = require('express-rate-limit');

const {
  login,
  mfaSetup,
  mfaConfirm,
  mfaVerify,
  getMfaStatus,
  regenerateRecoveryCodes,
  refreshSession,
  logout,
  logoutAll,
  getSessions,
  getCurrentUser,
  revokeSessionById,
} = require('../controllers/authController');

const {
  authenticate,
} = require('../middleware/authenticate');

const router = express.Router();

const mfaRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 15,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: {
    success: false,
    error: {
      code: 'TOO_MANY_REQUESTS',
      message: 'Too many MFA requests. Please try again later.',
    },
  },
});

router.post('/login', login);
router.post('/refresh', refreshSession);

// Unauthenticated MFA setup, confirmation, and verification routes
router.post('/mfa/setup', mfaRateLimiter, mfaSetup);
router.post('/mfa/confirm', mfaRateLimiter, mfaConfirm);
router.post('/mfa/verify', mfaRateLimiter, mfaVerify);

// Authenticated MFA status and recovery code regeneration routes
router.get(
  '/mfa/status',
  authenticate,
  getMfaStatus
);

router.post(
  '/mfa/recovery-codes/regenerate',
  authenticate,
  mfaRateLimiter,
  regenerateRecoveryCodes
);

router.get(
  '/me',
  authenticate,
  getCurrentUser
);

router.post(
  '/logout',
  authenticate,
  logout
);

router.post(
  '/logout-all',
  authenticate,
  logoutAll
);

router.get(
  '/sessions',
  authenticate,
  getSessions
);

router.delete(
  '/sessions/:sessionId',
  authenticate,
  revokeSessionById
);

module.exports = router;
