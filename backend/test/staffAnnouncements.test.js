'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  listNotifications,
  getNotification,
  markNotificationRead,
  markAllNotificationsRead,
  acknowledgeNotification,
  archiveNotification,
} = require('../src/controllers/notificationController');
const { Notification } = require('../src/models/Notification');

test('EMP-SCR-002: listNotifications returns self-scoped announcements with unread and actionRequired counts', async () => {
  const staffReq = {
    auth: {
      userId: 'STAFF-001',
      role: 'STAFF',
      organisationId: 'ZAMORIN',
      assignedCafeIds: ['CAFE-001'],
    },
    query: {},
  };

  const originalFind = Notification.find;
  const originalCountDocuments = Notification.countDocuments;

  Notification.find = () => ({
    sort: () => ({
      skip: () => ({
        limit: async () => [
          {
            notificationId: 'NT-20260819-0001',
            title: 'Updated FSSAI Hygiene SOP',
            message: 'Mandatory hygiene checklist SOP.',
            category: 'COMPLIANCE',
            priority: 'CRITICAL',
            acknowledgementRequired: true,
            acknowledgedAt: null,
            readAt: null,
          },
        ],
      }),
    }),
  });

  Notification.countDocuments = async (filter) => {
    if (filter.acknowledgementRequired) return 1;
    if (filter.readAt === null) return 1;
    return 1;
  };

  let responseStatus = null;
  let responseJson = null;

  const mockRes = {
    status(code) {
      responseStatus = code;
      return this;
    },
    json(data) {
      responseJson = data;
      return this;
    },
  };

  await listNotifications(staffReq, mockRes);

  assert.equal(responseStatus, 200);
  assert.equal(responseJson.success, true);
  assert.ok(Array.isArray(responseJson.data.notifications), 'notifications must be array');
  assert.equal(responseJson.data.unreadCount, 1);
  assert.equal(responseJson.data.actionRequiredCount, 1);
  assert.equal(responseJson.data.notifications[0].title, 'Updated FSSAI Hygiene SOP');

  Notification.find = originalFind;
  Notification.countDocuments = originalCountDocuments;
});

test('EMP-SCR-002: acknowledgeNotification sets acknowledgedAt timestamp and returns updated record', async () => {
  const staffReq = {
    auth: {
      userId: 'STAFF-001',
      role: 'STAFF',
      organisationId: 'ZAMORIN',
    },
    params: {
      notificationId: 'NT-20260819-0001',
    },
  };

  let ackCalled = false;
  const mockNotification = {
    notificationId: 'NT-20260819-0001',
    organisationId: 'ZAMORIN',
    recipientUserId: 'STAFF-001',
    acknowledgementRequired: true,
    acknowledgedAt: null,
    async acknowledge() {
      ackCalled = true;
      this.acknowledgedAt = new Date();
      return this;
    },
  };

  const originalFindOne = Notification.findOne;
  Notification.findOne = async () => mockNotification;

  let responseStatus = null;
  let responseJson = null;

  const mockRes = {
    status(code) {
      responseStatus = code;
      return this;
    },
    json(data) {
      responseJson = data;
      return this;
    },
  };

  await acknowledgeNotification(staffReq, mockRes);

  assert.equal(responseStatus, 200);
  assert.equal(responseJson.success, true);
  assert.ok(ackCalled, 'acknowledge() must be called');
  assert.ok(responseJson.data.notification.acknowledgedAt, 'acknowledgedAt must be set');

  Notification.findOne = originalFindOne;
});

test('EMP-SCR-002: acknowledgeNotification rejects if notification does not require acknowledgement (400)', async () => {
  const staffReq = {
    auth: {
      userId: 'STAFF-001',
      role: 'STAFF',
      organisationId: 'ZAMORIN',
    },
    params: {
      notificationId: 'NT-20260819-0002',
    },
  };

  const mockNotification = {
    notificationId: 'NT-20260819-0002',
    organisationId: 'ZAMORIN',
    recipientUserId: 'STAFF-001',
    acknowledgementRequired: false,
  };

  const originalFindOne = Notification.findOne;
  Notification.findOne = async () => mockNotification;

  const mockRes = {
    status() { return this; },
    json() { return this; },
  };

  await assert.rejects(
    async () => {
      await acknowledgeNotification(staffReq, mockRes);
    },
    {
      statusCode: 400,
      code: 'ACKNOWLEDGEMENT_NOT_REQUIRED',
    }
  );

  Notification.findOne = originalFindOne;
});

test('EMP-SCR-002: STAFF cannot query another cafe notifications (403 CAFE_ACCESS_DENIED)', async () => {
  const staffReq = {
    auth: {
      userId: 'STAFF-001',
      role: 'STAFF',
      organisationId: 'ZAMORIN',
      assignedCafeIds: ['CAFE-001'],
    },
    query: {
      cafeId: 'CAFE-OTHER-999',
    },
  };

  const mockRes = {
    status() { return this; },
    json() { return this; },
  };

  await assert.rejects(
    async () => {
      await listNotifications(staffReq, mockRes);
    },
    {
      statusCode: 403,
      code: 'CAFE_ACCESS_DENIED',
    }
  );
});
