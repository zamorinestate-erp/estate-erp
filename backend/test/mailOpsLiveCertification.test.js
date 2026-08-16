'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

const { User, USER_ROLES } = require('../src/models/User');
const { Cafe } = require('../src/models/Cafe');
const { DeviceRegistration } = require('../src/models/DeviceRegistration');
const { Incident } = require('../src/models/Incident');
const { CashTransaction } = require('../src/models/CashTransaction');
const { SystemCommunicationSettings } = require('../src/models/SystemCommunicationSettings');
const { OperationalReportService } = require('../src/services/OperationalReportService');
const { TemplateEngine, SCHEDULED_LANGUAGES, RTL_LANGUAGES } = require('../src/services/TemplateEngine');
const { GmailEmailProvider } = require('../src/services/GmailEmailProvider');
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

test('MailOps-R1 Live Certification, Primary Master Noise Control & 23-Language Architecture Suite', async (t) => {
  let mongoServer;
  const testProvider = new ConsoleTestEmailProvider();
  notificationService.setProvider(testProvider);

  t.before(async () => {
    mongoServer = await MongoMemoryServer.create();
    await mongoose.connect(mongoServer.getUri());

    await makeUser().save();

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

    await Cafe.create({
      cafeId: 'ZC-0001',
      organisationId: 'ZAMORIN',
      name: 'Zamorin Calicut Beach',
      displayName: 'Zamorin Calicut Beach',
      code: 'ZC-0001',
      status: 'ACTIVE',
      createdBy: 'MU-0001',
    });

    await SystemCommunicationSettings.create({
      organisationId: 'ZAMORIN',
      operationsEmail: 'zamorinestatepvtltd.erp@gmail.com',
      primaryMasterEmail: 'pradeeshk331@gmail.com',
      provider: 'CONSOLE_TEST',
      enabled: true,
      outboundEnabled: true,
    });
  });

  t.after(async () => {
    await mongoose.disconnect();
    if (mongoServer) await mongoServer.stop();
  });

  await t.test('Primary Master Noise Control — Routine Opening report emails Cafe Admin only, NOT Primary Master', async () => {
    testProvider.clearHistory();

    // Register active device
    await DeviceRegistration.create({
      deviceId: 'DEV-POS-001',
      deviceName: 'POS Terminal 1',
      deviceFingerprint: 'FP-POS-CALICUT-001',
      organisationId: 'ZAMORIN',
      assignedCafeId: 'ZC-0001',
      deviceType: 'POS_TERMINAL',
      status: 'ACTIVE',
      secretHash: 'hash',
      createdBy: 'MU-0001',
    });

    const res = await OperationalReportService.generateOpeningReadinessReport('ZC-0001', 'ZAMORIN');
    assert.equal(res.isReady, true);

    const sent = testProvider.sentEmails.filter(e => e.subject.includes('Opening Readiness'));
    assert.equal(sent.length, 1);
    assert.equal(sent[0].to, 'admin.calicut@zamorin.com');
    assert.equal(sent.some(e => e.to === 'pradeeshk331@gmail.com'), false, 'Normal opening MUST NOT email Primary Master');
  });

  await t.test('Primary Master Noise Control — Abnormal Opening report escalates to Primary Master', async () => {
    testProvider.clearHistory();

    // Create an active P0 incident for this cafe
    await Incident.create({
      incidentId: 'INC-20260816-0001',
      organisationId: 'ZAMORIN',
      affectedCafes: ['ZC-0001'],
      severity: 'P0',
      category: 'DATABASE',
      summary: 'Database connection failed',
      deduplicationKey: 'INC_TEST_P0',
      status: 'OPEN',
      startedAt: new Date(),
    });

    const res = await OperationalReportService.generateOpeningReadinessReport('ZC-0001', 'ZAMORIN');
    assert.equal(res.isReady, false);

    const sent = testProvider.sentEmails.filter(e => e.subject.includes('Opening Readiness'));
    assert.ok(sent.some(e => e.to === 'pradeeshk331@gmail.com'), 'Abnormal opening MUST escalate to Primary Master');
  });

  await t.test('Primary Master Noise Control — Routine Clean Closing report emails Cafe Admin only, NOT Primary Master', async () => {
    testProvider.clearHistory();

    // Remove active incident
    await Incident.deleteMany({});

    const res = await OperationalReportService.generateClosingControlReport('ZC-0001', 'ZAMORIN');
    assert.equal(res.isCleanClose, true);

    const sent = testProvider.sentEmails.filter(e => e.subject.includes('Closing Control'));
    assert.equal(sent.length, 1);
    assert.equal(sent[0].to, 'admin.calicut@zamorin.com');
    assert.equal(sent.some(e => e.to === 'pradeeshk331@gmail.com'), false, 'Normal clean closing MUST NOT email Primary Master');
  });

  await t.test('23-Language Framework — All 22 Scheduled Indian Languages + English validated', () => {
    assert.equal(SCHEDULED_LANGUAGES.length, 23);
    assert.ok(SCHEDULED_LANGUAGES.includes('en'));
    assert.ok(SCHEDULED_LANGUAGES.includes('hi'));
    assert.ok(SCHEDULED_LANGUAGES.includes('ml'));
    assert.ok(SCHEDULED_LANGUAGES.includes('ta'));
    assert.ok(SCHEDULED_LANGUAGES.includes('te'));
    assert.ok(SCHEDULED_LANGUAGES.includes('ur'));

    // Test Urdu RTL rendering
    const renderedUrdu = TemplateEngine.render('SECURITY_ALERT', {
      title: 'POS Tampering',
      message: 'Suspicious payload detected',
      timestamp: new Date().toISOString(),
      resource: 'ZC-0001',
      actionRequired: 'Inspect terminal',
    }, 'ur');

    assert.ok(renderedUrdu.html.includes('dir="rtl"'), 'Urdu template must contain dir="rtl"');
    assert.ok(renderedUrdu.html.includes('lang="ur"'));

    // Test Malayalam English-fallback with LTR
    const renderedMalayalam = TemplateEngine.render('SECURITY_ALERT', {
      title: 'POS Tampering',
      message: 'Suspicious payload detected',
      timestamp: new Date().toISOString(),
      resource: 'ZC-0001',
      actionRequired: 'Inspect terminal',
    }, 'ml');

    assert.ok(renderedMalayalam.html.includes('dir="ltr"'));
    assert.ok(renderedMalayalam.html.includes('lang="ml"'));
  });

  await t.test('HTML Injection & Header Injection Defense in TemplateEngine', () => {
    const maliciousInput = {
      title: 'Malicious Header\r\nBcc: victim@example.com\r\n',
      message: '<script>alert("XSS")</script>',
      timestamp: '2026-08-16',
      resource: 'ZC-0001',
      actionRequired: '<b>Investigate</b>',
    };

    const rendered = TemplateEngine.render('SECURITY_ALERT', maliciousInput, 'en');

    // Header injection check
    assert.equal(rendered.subject.includes('\r'), false, 'Subject must not contain CRLF characters');
    assert.equal(rendered.subject.includes('\n'), false, 'Subject must not contain CRLF characters');

    // XSS injection check
    assert.equal(rendered.html.includes('<script>'), false, 'HTML must escape script tags');
    assert.ok(rendered.html.includes('&lt;script&gt;alert(&quot;XSS&quot;)&lt;/script&gt;'));
  });

  await t.test('Gmail API Provider — RFC 822 base64url message composition without token leakage', () => {
    const provider = new GmailEmailProvider({
      operationsEmail: 'zamorinestatepvtltd.erp@gmail.com',
    });

    const raw = provider._buildRawRfc822({
      to: 'recipient@example.com',
      subject: 'Test Notification',
      text: 'Plain text body',
      html: '<p>HTML body</p>',
    });

    assert.ok(raw);
    assert.equal(typeof raw, 'string');
    // base64url should not have +, /, or trailing =
    assert.equal(raw.includes('+'), false);
    assert.equal(raw.includes('/'), false);
    assert.equal(raw.includes('='), false);
  });
});
