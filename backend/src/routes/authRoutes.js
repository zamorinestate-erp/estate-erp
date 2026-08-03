'use strict';

const express = require('express');

const {
  login,
  refreshSession,
  logout,
  logoutAll,
} = require('../controllers/authController');

const {
  authenticate,
} = require('../middleware/authenticate');

const router = express.Router();

router.post('/login', login);
router.post('/refresh', refreshSession);
router.post('/logout', authenticate, logout);
router.post('/logout-all', authenticate, logoutAll);

module.exports = router;