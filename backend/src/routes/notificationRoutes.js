'use strict';

const express = require('express');

const {
  authenticate,
} = require('../middleware/authenticate');

const {
  listNotifications,
  getNotification,
  markNotificationRead,
  markAllNotificationsRead,
  acknowledgeNotification,
  archiveNotification,
} = require('../controllers/notificationController');

const router = express.Router();

router.use(authenticate);

router.get(
  '/',
  listNotifications
);

router.patch(
  '/read-all',
  markAllNotificationsRead
);

router.get(
  '/:notificationId',
  getNotification
);

router.patch(
  '/:notificationId/read',
  markNotificationRead
);

router.patch(
  '/:notificationId/acknowledge',
  acknowledgeNotification
);

router.post(
  '/:notificationId/archive',
  archiveNotification
);

module.exports = router;