'use strict';

const express = require('express');

const router = express.Router();

router.get('/', (req, res) => {
  return res.status(200).json({
    success: true,
    message: 'Zamorin Cafe ERP API is running.',
    version: 'v1',
    correlationId: req.correlationId || null,
  });
});

module.exports = router;