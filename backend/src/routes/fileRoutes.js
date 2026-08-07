'use strict';

/**
 * FILE ROUTES
 * Mounted at: /api/v1/files (registered in routes/index.js)
 */

const express = require('express');
const { authenticate } = require('../middleware/authenticate');
const { getFileMetadata, registerFileRecord } = require('../controllers/fileController');

const router = express.Router();

router.use(authenticate);

router.get('/:fileId', getFileMetadata);
router.post('/register', registerFileRecord);

module.exports = router;
