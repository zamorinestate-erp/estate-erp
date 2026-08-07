'use strict';

/**
 * SEARCH ROUTES
 * Mounted at: /api/v1/search (registered in routes/index.js)
 */

const express = require('express');
const { authenticate } = require('../middleware/authenticate');
const { performGlobalSearch } = require('../controllers/searchController');

const router = express.Router();

router.use(authenticate);

router.get('/', performGlobalSearch);

module.exports = router;
