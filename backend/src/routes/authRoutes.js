'use strict';

const express = require('express');
const rateLimit = require('express-rate-limit');

const {
  login,
  requestPasswordReset,
  verifyPasswordResetCode,
  resetPassword,
  mfaSetup,
  mfaConfirm,
  mfaVerify,
  getMfaStatus,
  regenerateRecoveryCodes,
  changePassword,
  stepUpAuthentication,
  refreshSession,
  logout,
  logoutAll,
  getSessions,
  getCurrentUser,
  revokeSessionById,
} = require('../controllers/authController');

const {
  authenticate,
  requireMfa,
} = require('../middleware/authenticate');
const passkeyController = require('../controllers/passkeyController');

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

const passwordResetRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: {
    success: false,
    error: {
      code: 'TOO_MANY_REQUESTS',
      message: 'Too many password reset requests. Please try again later.',
    },
  },
});

const passkeyRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: {
    success: false,
    error: {
      code: 'TOO_MANY_REQUESTS',
      message: 'Too many passkey requests. Please try again later.',
    },
  },
});

router.post('/login', login);
router.post('/password/forgot', passwordResetRateLimiter, requestPasswordReset);
router.post('/password/reset/verify', passwordResetRateLimiter, verifyPasswordResetCode);
router.post('/password/reset', passwordResetRateLimiter, resetPassword);
router.post('/refresh', refreshSession);

// Passkeys / WebAuthn Endpoints
router.post('/passkeys/register/options', authenticate, passkeyRateLimiter, passkeyController.getRegistrationOptions);
router.post('/passkeys/register/verify', authenticate, passkeyRateLimiter, passkeyController.verifyRegistration);
router.post('/passkeys/authenticate/options', passkeyRateLimiter, passkeyController.getAuthenticationOptions);
router.post('/passkeys/authenticate/verify', passkeyRateLimiter, passkeyController.verifyAuthentication);
router.get('/passkeys', authenticate, passkeyController.listUserPasskeys);
router.delete('/passkeys/:credentialId', authenticate, passkeyController.revokeUserPasskey);

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
  '/step-up',
  authenticate,
  requireMfa,
  mfaRateLimiter,
  stepUpAuthentication
);

router.post(
  '/password/change',
  authenticate,
  changePassword
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
