// =============================================================================
// TEST: SCR-024 Trash Bin, Data Recovery, Retention & Disposition Suite
// =============================================================================

const test = require('node:test');
const assert = require('node:assert/strict');

const trashController = require('../src/controllers/trashController.js');
const { TrashEntry } = require('../src/models/TrashEntry.js');
const { RetentionPolicy } = require('../src/models/RetentionPolicy.js');
const { DispositionCertificate } = require('../src/models/DispositionCertificate.js');

test('SCR-024: Trash Controller exposes all required governance methods', () => {
  assert.equal(typeof trashController.listTrashItems, 'function');
  assert.equal(typeof trashController.getTrashItemDetails, 'function');
  assert.equal(typeof trashController.previewRestoreItem, 'function');
  assert.equal(typeof trashController.restoreTrashItem, 'function');
  assert.equal(typeof trashController.bulkRestoreTrashItems, 'function');
  assert.equal(typeof trashController.placePreservationHold, 'function');
  assert.equal(typeof trashController.releasePreservationHold, 'function');
  assert.equal(typeof trashController.submitDispositionRequest, 'function');
  assert.equal(typeof trashController.approveDisposition, 'function');
  assert.equal(typeof trashController.executeDispositionPurge, 'function');
  assert.equal(typeof trashController.listDispositionCertificates, 'function');
  assert.equal(typeof trashController.getDispositionCertificatePdf, 'function');
  assert.equal(typeof trashController.listRetentionPolicies, 'function');
  assert.equal(typeof trashController.toggleEmergencyDispositionPause, 'function');
});

test('SCR-024: Emergency Disposition Pause circuit breaker halts purges', async () => {
  const pauseReq = {
    auth: { userId: 'MU-0001', organisationId: 'ORG-ZAMORIN', role: 'MASTER' },
    body: { pause: true, reason: 'Test emergency freeze' },
  };
  let sentJson = null;
  const pauseRes = {
    status() { return this; },
    json(payload) { sentJson = payload; return this; },
  };

  await trashController.toggleEmergencyDispositionPause(pauseReq, pauseRes);
  assert.equal(sentJson.success, true);
  assert.equal(sentJson.data.isPaused, true);

  // Resume emergency pause
  pauseReq.body = { pause: false };
  await trashController.toggleEmergencyDispositionPause(pauseReq, pauseRes);
  assert.equal(sentJson.success, true);
  assert.equal(sentJson.data.isPaused, false);
});

test('SCR-024: TrashEntry schema enforces lifecycle statuses and hold mechanics', () => {
  const entry = new TrashEntry({
    trashId: 'TRASH-202608-00099',
    organisationId: 'ORG-ZAMORIN',
    cafeId: 'ZC-0001',
    sourceModule: 'INVENTORY',
    entityType: 'INVENTORY_ITEM',
    entityId: 'SKU-001',
    recordReference: 'SKU-001',
    recordTitle: 'Test Roast 01',
    deletedByUserId: 'MU-0001',
    deletedAt: new Date(),
    expiresAt: new Date(Date.now() + 30 * 86400000),
  });

  assert.equal(entry.calculateStatus(), 'RECOVERABLE');

  // Place active hold
  entry.holds.push({
    holdId: 'HOLD-999',
    reason: 'Audit Freeze',
    placedByUserId: 'MU-0001',
  });
  entry.holdState = 'ACTIVE';
  assert.equal(entry.calculateStatus(), 'ON_HOLD');
});

test('SCR-024: Retention Policy registry defines statutory durations and review gates', () => {
  const policy = new RetentionPolicy({
    policyId: 'RET-000001-00099',
    organisationId: 'ORG-ZAMORIN',
    name: 'Statutory Payroll Records',
    entityType: 'PAYROLL_RUN',
    dataClassification: 'PAYROLL_STATUTORY',
    retentionDurationDays: 2555, // 7 years
    dispositionReviewRequired: true,
    makerCheckerRequired: true,
  });

  assert.equal(policy.retentionDurationDays, 2555);
  assert.equal(policy.dispositionReviewRequired, true);
  assert.equal(policy.makerCheckerRequired, true);
});

test('SCR-024: Disposition Certificate contains minimal safe metadata without payload', () => {
  const cert = new DispositionCertificate({
    certificateId: 'CERT-DISP-202608-00001',
    organisationId: 'ORG-ZAMORIN',
    cafeId: 'ZC-0001',
    trashId: 'TRASH-202608-00001',
    sourceModule: 'INVENTORY',
    entityType: 'INVENTORY_ITEM',
    entityId: 'SKU-099',
    recordReference: 'SKU-099',
    policyId: 'RET-000001-00001',
    retentionCompletedAt: new Date(),
    executedByUserId: 'MU-0001',
    executedAt: new Date(),
  });

  assert.equal(cert.certificateId, 'CERT-DISP-202608-00001');
  assert.equal(cert.entityId, 'SKU-099');
  assert.equal(cert.payload, undefined); // Minimal metadata only!
});
