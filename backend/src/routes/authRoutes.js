'use strict';

const express = require('express');

const {
  login,
  refreshSession,
  logout,
} = require('../controllers/authController');
const {
  authenticate,
} = require('../middleware/authenticate');

const router = express.Router();

router.post('/login', login);
router.post('/refresh', refreshSession);
router.post('/logout', authenticate, logout);

module.exports = router;