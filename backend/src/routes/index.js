'use strict';

const express = require('express');

const authRoutes =
  require('./authRoutes');

const cafeRoutes =
  require('./cafeRoutes');

const userRoutes =
  require('./userRoutes');

const router = express.Router();

router.use('/auth', authRoutes);
router.use('/cafes', cafeRoutes);
router.use('/users', userRoutes);

router.get('/', (req, res) => {
  return res.status(200).json({
    success: true,
    message:
      'Zamorin Cafe ERP API is running.',
    version: 'v1',
    correlationId:
      req.correlationId || null,
  });
});

module.exports = router;