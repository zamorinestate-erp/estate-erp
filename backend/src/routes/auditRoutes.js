'use strict';

const express = require('express');

const {
  authenticate,
} = require('../middleware/authenticate');

const {
  listAuditEvents,
  getAuditEvent,
} = require('../controllers/auditController');

const router = express.Router();

router.use(authenticate);

router.get(
  '/',
  listAuditEvents
);

router.get(
  '/:auditEventId',
  getAuditEvent
);

module.exports = router;