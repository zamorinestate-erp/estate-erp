'use strict';

const express = require('express');

const {
  login,
  refreshSession,
} = require('../controllers/authController');

const router = express.Router();

router.post('/login', login);
router.post('/refresh', refreshSession);

module.exports = router;