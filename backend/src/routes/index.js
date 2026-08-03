'use strict';

const express = require('express');

const authRoutes =
  require('./authRoutes');

const cafeRoutes =
  require('./cafeRoutes');

const userRoutes =
  require('./userRoutes');

const auditRoutes =
  require('./auditRoutes');

const notificationRoutes =
  require('./notificationRoutes');

const attendanceRoutes =
  require('./attendanceRoutes');

const cashRoutes =
  require('./cashRoutes');

const expenseRoutes =
  require('./expenseRoutes');

const reportRoutes =
  require('./reportRoutes');

const router = express.Router();

router.use('/auth', authRoutes);

router.use(
  '/cafes',
  cafeRoutes
);

router.use(
  '/users',
  userRoutes
);

router.use(
  '/audit-events',
  auditRoutes
);

router.use(
  '/notifications',
  notificationRoutes
);

router.use(
  '/attendance',
  attendanceRoutes
);

router.use(
  '/cash-transactions',
  cashRoutes
);

router.use(
  '/expenses',
  expenseRoutes
);

router.use(
  '/reports',
  reportRoutes
);

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
