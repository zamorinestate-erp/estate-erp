'use strict';

const express = require('express');

const {
  login,
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

router.post('/login', login);
router.post('/refresh', refreshSession);

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