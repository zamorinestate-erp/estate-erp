'use strict';
const express = require('express');
const deviceEnrollmentRoutes = require('./deviceEnrollmentRoutes');
const cafeOpsAuthRoutes = require('./cafeOpsAuthRoutes');
const adminDeviceRoutes = require('./adminDeviceRoutes');
const adminOperatorAccessRoutes = require('./adminOperatorAccessRoutes');
const adminSessionRoutes = require('./adminSessionRoutes');

const router = express.Router();

router.use('/devices', deviceEnrollmentRoutes);
router.use('/operator', cafeOpsAuthRoutes);
router.use('/admin/devices', adminDeviceRoutes);
router.use('/admin/operator-access', adminOperatorAccessRoutes);
router.use('/admin/operator-sessions', adminSessionRoutes);

module.exports = router;
