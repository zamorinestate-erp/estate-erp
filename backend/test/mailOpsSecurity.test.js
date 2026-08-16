'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

const { SystemCommunicationSettings } = require('../src/models/SystemCommunicationSettings');
const { User, USER_ROLES } = require('../src/models/User');
const { notificationService } = require('../src/services/NotificationService');
const { ConsoleTestEmailProvider } = require('../src/services/ConsoleTestEmailProvider');

function makeUser(overrides = {}) {
  return new User({
    userId: 'MU-0001',
    organisationId: 'ZAMORIN',
    name: 'Primary Master',
    email: 'pradeeshk331@gmail.com',
    role: 'MASTER',
    accountStatus: 'ACTIVE',
    primaryCafeId: null,
    assignedCafeIds: [],
    isPrimaryMaster: true,
    primaryMasterDesignatedAt: new Date(),
    primaryMasterDesignatedBy: 'MU-0001',
    primaryMasterDesignationReason: 'Initial setup',
    roleHistory: [],
    cafeAssignmentHistory: [],
    sessionVersion: 1,
    permissionsVersion: 1,
    passwordHash: 'hash',
    createdBy: 'SYSTEM',
    ...overrides,
  });
}

test('MailOps Security & Governance Suite', async (t) => {
  let mongoServer;
  const testProvider = new ConsoleTestEmailProvider();
  notificationService.setProvider(testProvider);

  t.before(async () => {
    mongoServer = await MongoMemoryServer.create();
    await mongoose.connect(mongoServer.getUri());

    // Seed Primary Master human user
    await makeUser().save();

    // Seed Cafe A Admin
    await makeUser({
      userId: 'AD-0001',
      name: 'Calicut Admin',
      email: 'admin.calicut@zamorin.com',
      role: 'CAFE_ADMIN',
      primaryCafeId: 'ZC-0001',
      assignedCafeIds: ['ZC-0001'],
      isPrimaryMaster: false,
      primaryMasterDesignatedAt: null,
      primaryMasterDesignatedBy: null,
      primaryMasterDesignationReason: null,
    }).save();

    // Seed Cafe B Admin
    await makeUser({
      userId: 'AD-0002',
      name: 'Kochi Admin',
      email: 'admin.kochi@zamorin.com',
      role: 'CAFE_ADMIN',
      primaryCafeId: 'ZC-0002',
      assignedCafeIds: ['ZC-0002'],
      isPrimaryMaster: false,
      primaryMasterDesignatedAt: null,
      primaryMasterDesignatedBy: null,
      primaryMasterDesignationReason: null,
    }).save();

    // Seed SystemCommunicationSettings
    await SystemCommunicationSettings.create({
      organisationId: 'ZAMORIN',
      operationsEmail: 'zamorinestatepvtltd.erp@gmail.com',
      primaryMasterEmail: 'pradeeshk331@gmail.com',
      identityType: 'SYSTEM_OPERATIONS_MAILBOX',
      applicationRole: 'NONE',
      canLoginToERP: false,
      enabled: true,
      provider: 'CONSOLE_TEST',
    });
  });

  t.after(async () => {
    await mongoose.disconnect();
    if (mongoServer) await mongoServer.stop();
  });

  await t.test('Operations mailbox cannot login and has applicationRole NONE', async () => {
    const settings = await SystemCommunicationSettings.findOne({ organisationId: 'ZAMORIN' });
    assert.ok(settings);
    assert.equal(settings.operationsEmail, 'zamorinestatepvtltd.erp@gmail.com');
    assert.equal(settings.applicationRole, 'NONE');
    assert.equal(settings.canLoginToERP, false);

    // Verify no fake User record exists for operations mailbox
    const mailboxUser = await User.findOne({ email: 'zamorinestatepvtltd.erp@gmail.com' });
    assert.equal(mailboxUser, null, 'No User document should exist for system operations mailbox');
  });

  await t.test('Exactly 4 ERP roles exist in User model', () => {
    assert.deepEqual(USER_ROLES, ['MASTER', 'OWNER', 'CAFE_ADMIN', 'STAFF']);
    assert.equal(USER_ROLES.length, 4);
    assert.equal(USER_ROLES.includes('SYSTEM'), false);
    assert.equal(USER_ROLES.includes('MAILOPS'), false);
    assert.equal(USER_ROLES.includes('EMAIL'), false);
  });

  await t.test('MU-0001 is distinct Primary Master with pradeeshk331@gmail.com', async () => {
    const pm = await User.findOne({ userId: 'MU-0001' });
    assert.ok(pm);
    assert.equal(pm.role, 'MASTER');
    assert.equal(pm.isPrimaryMaster, true);
    assert.equal(pm.email, 'pradeeshk331@gmail.com');
  });

  await t.test('Strict Cross-Cafe Recipient Isolation (0 leakage)', async () => {
    // Publish Cafe A alert
    const resultCafeA = await notificationService.publishNotification({
      eventType: 'STOCK_DEFICIT',
      organisationId: 'ZAMORIN',
      cafeId: 'ZC-0001',
      recipientRoles: ['CAFE_ADMIN'],
      templateId: 'SECURITY_ALERT',
      templateData: { title: 'Low Milk', message: 'Milk low in Calicut' },
      idempotencyKey: 'CAFE_A_TEST_KEY_1',
      processImmediately: false,
    });

    assert.equal(resultCafeA.success, true);
    const cafeARecipients = resultCafeA.recipients.map(r => r.email);
    assert.ok(cafeARecipients.includes('admin.calicut@zamorin.com'));
    assert.equal(cafeARecipients.includes('admin.kochi@zamorin.com'), false, 'Cafe B admin must not receive Cafe A alerts');

    // Publish Cafe B alert
    const resultCafeB = await notificationService.publishNotification({
      eventType: 'STOCK_DEFICIT',
      organisationId: 'ZAMORIN',
      cafeId: 'ZC-0002',
      recipientRoles: ['CAFE_ADMIN'],
      templateId: 'SECURITY_ALERT',
      templateData: { title: 'Low Coffee', message: 'Coffee low in Kochi' },
      idempotencyKey: 'CAFE_B_TEST_KEY_1',
      processImmediately: false,
    });

    assert.equal(resultCafeB.success, true);
    const cafeBRecipients = resultCafeB.recipients.map(r => r.email);
    assert.ok(cafeBRecipients.includes('admin.kochi@zamorin.com'));
    assert.equal(cafeBRecipients.includes('admin.calicut@zamorin.com'), false, 'Cafe A admin must not receive Cafe B alerts');
  });
});
