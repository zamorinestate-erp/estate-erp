'use strict';

const express = require('express');

const {
  login,
  refreshSession,
  logout,
  logoutAll,
  getSessions,
} = require('../controllers/authController');

const {
  authenticate,
} = require('../middleware/authenticate');

const router = express.Router();

router.post('/login', login);
router.post('/refresh', refreshSession);
router.post('/logout', authenticate, logout);
router.post('/logout-all', authenticate, logoutAll);
router.get('/sessions', authenticate, getSessions);

module.exports = router;