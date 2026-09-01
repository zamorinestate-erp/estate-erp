'use strict';

/**
 * Settings Routes — SCR-023
 * Mounted at /api/v1/settings (registered in routes/index.js)
 *
 * All routes are authenticated. All self-service operations resolve the
 * acting user exclusively from req.user (set by authenticate middleware).
 * No userId is accepted from the request body or params for self-operations.
 */

const express = require('express');
const { authenticate } = require('../middleware/authenticate');

const {
  getSettingsOverview,
  getMyProfile,
  updateMyProfile,
  submitProfileChangeRequest,
  listMyProfileChangeRequests,
  getMyAccess,
  submitAccessRequest,
  listMyAccessRequests,
  getMyPreferences,
  updateAppearancePreferences,
  updateLanguagePreference,
  updateAccessibilityPreferences,
  updateWorkspacePreferences,
  updateNotificationPreferences,
  getLanguageCatalogue,
  getSecurityOverview,
  getMySessions,
  revokeMySession,
  revokeOtherSessions,
  revokeAllSessions,
  submitPrivacyRequest,
  listMyPrivacyRequests,
  getPrivacyNotice,
  listMyDelegations,
  createDelegation,
  revokeDelegation,
  getDiagnostics,
} = require('../controllers/settingsController');

const router = express.Router();

// All settings endpoints require an authenticated session.
router.use(authenticate);

// ── Overview ─────────────────────────────────────────────────────────────────
router.get('/overview', getSettingsOverview);

// ── Profile & Identity ────────────────────────────────────────────────────────
router.get('/profile', getMyProfile);
router.patch('/profile', updateMyProfile);
router.post('/profile/change-request', submitProfileChangeRequest);
router.get('/profile/change-requests', listMyProfileChangeRequests);

// ── My Access & Permissions ───────────────────────────────────────────────────
router.get('/access', getMyAccess);
router.post('/access/request', submitAccessRequest);
router.get('/access/requests', listMyAccessRequests);

// ── Preferences (Appearance, Language, Accessibility, Workspace, Notifications)
router.get('/preferences', getMyPreferences);
router.patch('/preferences/appearance', updateAppearancePreferences);
router.patch('/preferences/language', updateLanguagePreference);
router.patch('/preferences/accessibility', updateAccessibilityPreferences);
router.patch('/preferences/workspace', updateWorkspacePreferences);
router.patch('/preferences/notifications', updateNotificationPreferences);

// ── Language Catalogue ────────────────────────────────────────────────────────
router.get('/languages', getLanguageCatalogue);

// ── Security & Sign-In ────────────────────────────────────────────────────────
router.get('/security', getSecurityOverview);

// ── Devices & Sessions ────────────────────────────────────────────────────────
router.get('/sessions', getMySessions);
router.delete('/sessions/:sessionId', revokeMySession);
router.post('/sessions/revoke-others', revokeOtherSessions);
router.post('/sessions/revoke-all', revokeAllSessions);

// ── Delegation & Coverage (P2) ────────────────────────────────────────────────
router.get('/delegations', listMyDelegations);
router.post('/delegations', createDelegation);
router.delete('/delegations/:delegationId', revokeDelegation);

// ── Privacy & Data ────────────────────────────────────────────────────────────
router.post('/privacy/requests', submitPrivacyRequest);
router.get('/privacy/requests', listMyPrivacyRequests);
router.get('/privacy/notice', getPrivacyNotice);

// ── Help & Diagnostics ────────────────────────────────────────────────────────
router.get('/diagnostics', getDiagnostics);

// ── Organisation Identity (Restricted) ────────────────────────────────────────
const {
  getCompanyIdentity,
  unlockCompanyIdentity,
  updateCompanyIdentity,
  getCompanyIdentityHistory,
} = require('../controllers/companyIdentityController');

router.get('/company-identity', getCompanyIdentity);
router.post('/company-identity/unlock', unlockCompanyIdentity);
router.put('/company-identity', updateCompanyIdentity);
router.get('/company-identity/history', getCompanyIdentityHistory);

// ── Application Updates & Version Control (Role-Targeted) ────────────────────
const updateRoutes = require('./updateRoutes');
router.use('/updates', updateRoutes);

// ── Legacy redirect aliases ───────────────────────────────────────────────────
// My Profile was previously navigated to directly; now lives in Settings.
router.get('/my-profile', (req, res) => res.redirect(301, '/api/v1/settings/profile'));

module.exports = router;
