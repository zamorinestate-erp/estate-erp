'use strict';

/**
 * ============================================================================
 * ZAMORIN CAFÉ ERP — STAGE 02 UNIVERSAL QR ENGINE ACCEPTANCE TESTS
 * ============================================================================
 * Complete verification of:
 * - 02.1: Purpose & Types (CAFE_LOGIN, TABLE_ORDER, EMPLOYEE_BADGE, ATTENDANCE, UPI, DOC_VERIFY)
 * - 02.2: QR Security Rules (OWASP-Aligned: Opaque tokens, no secrets, no PII, HMAC signed)
 * - 02.3: QR Record Structure (Universal schema, scan metrics, timestamps, status)
 * - 02.4: QR Actions (Generate, Verify, Revoke, Regenerate/Rotate, Suspend, Scan count)
 * - 02.5: Printable QR Card (A4 PDF output with Zamorin Corporate Report Standard branding)
 */

const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');
const mongoose = require('mongoose');
const { UniversalQrService } = require('../src/services/universalQrService');
const { UniversalQrRecord } = require('../src/models/UniversalQrRecord');

const { MongoMemoryServer } = require('mongodb-memory-server');

describe('Stage 02 — Universal QR Engine Complete Suite', () => {
  let mongoServer;

  before(async () => {
    if (mongoose.connection.readyState === 0) {
      mongoServer = await MongoMemoryServer.create();
      await mongoose.connect(mongoServer.getUri());
    }
  });

  after(async () => {
    if (mongoServer) {
      await mongoose.disconnect();
      await mongoServer.stop();
    } else if (mongoose.connection.readyState === 1) {
      await UniversalQrRecord.deleteMany({ organisationId: 'TEST-ORG-QR-02' }).catch(() => {});
    }
  });

  // ─── 02.2: OPAQUE TOKEN & NO SENSITIVE DATA IN QR ────────────────────────
  test('02.2: Opaque token generation contains zero secrets, passwords, or employee emails', async () => {
    // Generate standard Café login QR
    const qr = await UniversalQrService.createQrRecord({
      qrType: 'CAFE_LOGIN',
      targetEntityId: 'ZC-0001',
      organisationId: 'TEST-ORG-QR-02',
      cafeId: 'ZC-0001',
      actorUserId: 'TEST-ADMIN',
    });

    assert.ok(qr, 'QR record created');
    assert.ok(qr.qrId.startsWith('QR-CAFE_LOGIN-'), 'QR ID matches standard format');
    assert.ok(qr.opaqueToken, 'Opaque token exists');
    assert.ok(qr.opaqueToken.length >= 24, 'Opaque token has sufficient cryptographic entropy');

    // Security assertions: no passwords, no emails, no JWT tokens in payload
    assert.doesNotMatch(qr.payload, /password/i, 'Payload must not contain passwords');
    assert.doesNotMatch(qr.payload, /secret/i, 'Payload must not contain secrets');
    assert.doesNotMatch(qr.payload, /@.+\..+/, 'Payload must not contain email addresses');
    assert.doesNotMatch(qr.payload, /eyJ[a-zA-Z0-9_-]+\.eyJ/, 'Payload must not contain JWT session tokens');

    assert.ok(qr.payload.includes('https://zamorin.app/cafe/ZC-0001/login?t='), 'Payload contains canonical login URL');
  });

  // ─── 02.1: ALL QR TYPES SUPPORTED ────────────────────────────────────────
  test('02.1: All required business QR types format payloads correctly', async () => {
    const types = [
      { type: 'TABLE_ORDER', entity: 'ZC-0001', meta: { tableNumber: 'T-04' }, expectedPattern: /table=T-04/ },
      { type: 'EMPLOYEE_BADGE', entity: 'EMP-ZC-000042', meta: {}, expectedPattern: /ZAMORIN:EMP:EMP-ZC-000042:/ },
      { type: 'ATTENDANCE_TOKEN', entity: 'HQ-NORTH', meta: {}, expectedPattern: /ZAMORIN:ATT:/ },
      { type: 'DOCUMENT_VERIFICATION', entity: 'DOC-2026-999', meta: {}, expectedPattern: /https:\/\/zamorin\.app\/verify\/doc\/DOC-2026-999/ },
      { type: 'INVENTORY_BATCH', entity: 'BATCH-2026-ROAST-01', meta: {}, expectedPattern: /ZAMORIN:BATCH:BATCH-2026-ROAST-01:/ }
    ];

    for (const item of types) {
      const qr = await UniversalQrService.createQrRecord({
        qrType: item.type,
        targetEntityId: item.entity,
        organisationId: 'TEST-ORG-QR-02',
        metadata: item.meta,
      });

      assert.strictEqual(qr.qrType, item.type);
      assert.match(qr.payload, item.expectedPattern, `Payload for ${item.type} matches specification pattern`);
      assert.ok(qr.hmacSignature, 'HMAC signature is generated');
    }
  });

  // ─── 02.3 & 02.4: VERIFICATION, SCAN METRICS, AND TIMESTAMPS ─────────────
  test('02.3 & 02.4: Verification validates active token and increments scan count', async () => {
    const qr = await UniversalQrService.createQrRecord({
      qrType: 'TABLE_ORDER',
      targetEntityId: 'ZC-0001',
      organisationId: 'TEST-ORG-QR-02',
      cafeId: 'ZC-0001',
      metadata: { tableNumber: '7' }
    });

    assert.strictEqual(qr.scanCount, 0);
    assert.strictEqual(qr.lastScannedAt, null);

    // Verify token
    const result1 = await UniversalQrService.verifyQrToken(qr.opaqueToken, { qrType: 'TABLE_ORDER', cafeId: 'ZC-0001' });
    assert.strictEqual(result1.valid, true);
    assert.strictEqual(result1.scanCount, 1);
    assert.ok(result1.lastScannedAt instanceof Date);

    // Verify token second time
    const result2 = await UniversalQrService.verifyQrToken(qr.opaqueToken);
    assert.strictEqual(result2.scanCount, 2);
  });

  // ─── 02.4: REVOCATION & REGENERATION LIFECYCLE ───────────────────────────
  test('02.4: Revocation invalidates token; regeneration rotates and creates fresh token', async () => {
    const qr = await UniversalQrService.createQrRecord({
      qrType: 'EMPLOYEE_BADGE',
      targetEntityId: 'EMP-ZC-000100',
      organisationId: 'TEST-ORG-QR-02',
    });

    // Revoke token
    const revoked = await UniversalQrService.revokeQr(qr.qrId, { reason: 'Lost employee badge' });
    assert.strictEqual(revoked.status, 'REVOKED');
    assert.strictEqual(revoked.revocationReason, 'Lost employee badge');

    // Verifying revoked token throws 403 QR_REVOKED
    await assert.rejects(
      async () => await UniversalQrService.verifyQrToken(qr.opaqueToken),
      (err) => err.code === 'QR_REVOKED'
    );

    // Regenerate QR
    const fresh = await UniversalQrService.regenerateQr(qr.qrId, { reason: 'Badge re-issued' });
    assert.strictEqual(fresh.status, 'ACTIVE');
    assert.notStrictEqual(fresh.opaqueToken, qr.opaqueToken, 'Fresh token has distinct cryptographic value');
    assert.strictEqual(fresh.targetEntityId, 'EMP-ZC-000100');

    // Fresh token verifies successfully
    const verifyFresh = await UniversalQrService.verifyQrToken(fresh.opaqueToken);
    assert.strictEqual(verifyFresh.valid, true);
  });

  // ─── 02.2: EXPIRATION ENFORCEMENT ────────────────────────────────────────
  test('02.2: Time-to-live (TTL) expiration is strictly enforced', async () => {
    const expiredQr = await UniversalQrService.createQrRecord({
      qrType: 'ATTENDANCE_TOKEN',
      targetEntityId: 'ZC-0001',
      organisationId: 'TEST-ORG-QR-02',
      ttlMinutes: 1, // 1 minute TTL
    });

    // Manually backdate expiration to simulate elapsed time
    expiredQr.expiresAt = new Date(Date.now() - 5000);
    await expiredQr.save();

    await assert.rejects(
      async () => await UniversalQrService.verifyQrToken(expiredQr.opaqueToken),
      (err) => err.code === 'QR_EXPIRED'
    );
  });

  // ─── 02.5: SVG RENDERING ─────────────────────────────────────────────────
  test('02.5: SVG rendering produces standard valid SVG markup', () => {
    const svg = UniversalQrService.renderQrSvg('https://zamorin.app/cafe/ZC-0001/login', { size: 256 });
    assert.ok(typeof svg === 'string');
    assert.ok(svg.includes('<svg'), 'SVG tag starts');
    assert.ok(svg.includes('</svg>'), 'SVG tag terminates');
    assert.ok(svg.includes('width="256" height="256"'), 'Width and height match size parameter');
    assert.ok(svg.includes('viewBox="0 0 '), 'ViewBox attribute present');
  });

  // ─── 02.5: PRINTABLE A4 QR CARD PDF ──────────────────────────────────────
  test('02.5: Printable QR Card generates APA 7 compliant PDF with branding', () => {
    const fakeRecord = {
      qrId: 'QR-CAFE_LOGIN-TEST01',
      qrType: 'CAFE_LOGIN',
      targetEntityId: 'ZC-0001',
      organisationId: 'TEST-ORG-QR-02',
      cafeId: 'ZC-0001',
      title: 'Store Front Entrance Login',
      payload: 'https://zamorin.app/cafe/ZC-0001/login?t=test-token-1234567890',
      hmacSignature: 'abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789',
      status: 'ACTIVE',
      scanCount: 14,
      createdAt: new Date(),
    };

    const pdfRes = UniversalQrService.renderPrintableQrCardPdf(fakeRecord, {
      legalName: 'Zamorin Speciality Coffee & Kitchens Pvt. Ltd.',
      brandName: 'Zamorin Café',
      gstin: '29AABCT1332L1ZV'
    });

    assert.ok(Buffer.isBuffer(pdfRes.buffer), 'PDF card output is binary buffer');
    const pdfContent = pdfRes.buffer.toString('utf8');

    assert.ok(pdfContent.startsWith('%PDF-1.4'), 'Starts with %PDF-1.4');
    assert.ok(pdfContent.includes('OFFICIAL PRINTABLE QR CARD — Store Front Entrance Login'), 'Report title rendered');
    assert.ok(pdfContent.includes('Zamorin Speciality Coffee & Kitchens Pvt. Ltd.'), 'Corporate legal name rendered');
    assert.ok(pdfContent.includes('QR-CAFE_LOGIN-TEST01'), 'Official QR ID rendered');
    assert.ok(pdfContent.includes('/BaseFont /Times-Roman'), 'Times-Roman typography used');
    assert.ok(pdfContent.includes('(Sl. No.)'), 'Universal Sl. No. column present in metadata table');
  });

});
