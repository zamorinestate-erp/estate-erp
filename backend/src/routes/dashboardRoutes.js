'use strict';

/**
 * DASHBOARD ROUTES
 * Mounted at: /api/v1/dashboard (registered in routes/index.js)
 */

const express = require('express');
const { authenticate } = require('../middleware/authenticate');
const { getDashboardMetrics } = require('../controllers/dashboardController');

const router = express.Router();

router.use(authenticate);

router.get('/metrics', getDashboardMetrics);

module.exports = router;
