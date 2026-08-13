'use strict';

/**
 * PARTIAL CAPABILITIES COMPLETION TESTS
 *
 * Covers schema completeness for the five capabilities that were PARTIAL
 * in the World-Class Expansion Matrix and are now upgraded to COMPLETE:
 *
 *   Capability 02 — Contract & Renewal (Vendor model)
 *   Capability 03 — Compliance Calendar (QualityChecklist model)
 *   Capability 10 — Purchase Recommendation Engine (CafeInventoryConfig model)
 *   Capability 12 — Batch & Lot Traceability (StockMovement model)
 *   Capability 13 — Recall & Quarantine (StockMovement model)
 *   Capability 16 — Insurance & Claims (Vendor model)
 */

const assert = require('node:assert/strict');
const { describe, it } = require('node:test');

const { Vendor } = require('../src/models/Vendor.js');
const { QualityChecklist } = require('../src/models/QualityChecklist.js');
const { CafeInventoryConfig } = require('../src/models/CafeInventoryConfig.js');
const { StockMovement } = require('../src/models/StockMovement.js');

// ── Helpers ──────────────────────────────────────────────────────────────────

function schemaPaths(Model) {
  return Object.keys(Model.schema.paths);
}

// ── Capability 02 & 16 — Vendor: Contract & Insurance fields ─────────────────

describe('Capability 02 — Contract & Renewal schema fields exist on Vendor', () => {
  it('Vendor schema contains contractExpiryDate', () => {
    assert.ok(
      schemaPaths(Vendor).includes('contractExpiryDate'),
      'contractExpiryDate must be present on Vendor schema'
    );
  });

  it('Vendor schema contains contractRenewalAlertDays with default 30', () => {
    const path = Vendor.schema.path('contractRenewalAlertDays');
    assert.ok(path, 'contractRenewalAlertDays must be present on Vendor schema');
    assert.strictEqual(path.defaultValue, 30);
  });

  it('Vendor schema contains contractNotes', () => {
    assert.ok(
      schemaPaths(Vendor).includes('contractNotes'),
      'contractNotes must be present on Vendor schema'
    );
  });
});

describe('Capability 16 — Insurance & Claims schema fields exist on Vendor', () => {
  it('Vendor schema contains insurancePolicyNumber', () => {
    assert.ok(
      schemaPaths(Vendor).includes('insurancePolicyNumber'),
      'insurancePolicyNumber must be present on Vendor schema'
    );
  });

  it('Vendor schema contains insuranceExpiryDate', () => {
    assert.ok(
      schemaPaths(Vendor).includes('insuranceExpiryDate'),
      'insuranceExpiryDate must be present on Vendor schema'
    );
  });

  it('Vendor schema contains insuranceRenewalAlertDays with default 30', () => {
    const path = Vendor.schema.path('insuranceRenewalAlertDays');
    assert.ok(path, 'insuranceRenewalAlertDays must be present on Vendor schema');
    assert.strictEqual(path.defaultValue, 30);
  });

  it('Vendor schema contains insuranceProvider', () => {
    assert.ok(
      schemaPaths(Vendor).includes('insuranceProvider'),
      'insuranceProvider must be present on Vendor schema'
    );
  });
});

// ── Capability 03 — QualityChecklist: Compliance Calendar fields ──────────────

describe('Capability 03 — Compliance Calendar schema fields exist on QualityChecklist', () => {
  it('QualityChecklist schema contains nextDueDate', () => {
    assert.ok(
      schemaPaths(QualityChecklist).includes('nextDueDate'),
      'nextDueDate must be present on QualityChecklist schema'
    );
  });

  it('nextDueDate enforces YYYY-MM-DD format via regex', () => {
    const path = QualityChecklist.schema.path('nextDueDate');
    assert.ok(path.options.match, 'nextDueDate must have a regex match validator');
    assert.ok(path.options.match.test('2026-08-13'), 'must accept valid ISO date');
    assert.ok(!path.options.match.test('13-08-2026'), 'must reject non-ISO format');
  });

  it('QualityChecklist schema contains scheduledTime', () => {
    assert.ok(
      schemaPaths(QualityChecklist).includes('scheduledTime'),
      'scheduledTime must be present on QualityChecklist schema'
    );
  });

  it('QualityChecklist schema contains managerSignOffUserId', () => {
    assert.ok(
      schemaPaths(QualityChecklist).includes('managerSignOffUserId'),
      'managerSignOffUserId must be present on QualityChecklist schema'
    );
  });

  it('QualityChecklist schema contains signOffAt', () => {
    assert.ok(
      schemaPaths(QualityChecklist).includes('signOffAt'),
      'signOffAt must be present on QualityChecklist schema'
    );
  });

  it('QualityChecklist schema contains reminderSentAt', () => {
    assert.ok(
      schemaPaths(QualityChecklist).includes('reminderSentAt'),
      'reminderSentAt must be present on QualityChecklist schema'
    );
  });
});

// ── Capability 10 — CafeInventoryConfig: Purchase Recommendation fields ───────

describe('Capability 10 — Purchase Recommendation Engine schema fields exist on CafeInventoryConfig', () => {
  it('CafeInventoryConfig schema contains avgDailyUsageBase', () => {
    assert.ok(
      schemaPaths(CafeInventoryConfig).includes('avgDailyUsageBase'),
      'avgDailyUsageBase must be present on CafeInventoryConfig schema'
    );
  });

  it('CafeInventoryConfig schema contains leadTimeDays with max 365', () => {
    const path = CafeInventoryConfig.schema.path('leadTimeDays');
    assert.ok(path, 'leadTimeDays must be present on CafeInventoryConfig schema');
    assert.strictEqual(path.options.max, 365);
  });

  it('CafeInventoryConfig schema contains lastRecommendedOrderQtyBase', () => {
    assert.ok(
      schemaPaths(CafeInventoryConfig).includes('lastRecommendedOrderQtyBase'),
      'lastRecommendedOrderQtyBase must be present on CafeInventoryConfig schema'
    );
  });

  it('CafeInventoryConfig schema contains lastRecommendationComputedAt', () => {
    assert.ok(
      schemaPaths(CafeInventoryConfig).includes('lastRecommendationComputedAt'),
      'lastRecommendationComputedAt must be present on CafeInventoryConfig schema'
    );
  });

  it('CafeInventoryConfig schema contains nearExpiryQuantityBase with default 0', () => {
    const path = CafeInventoryConfig.schema.path('nearExpiryQuantityBase');
    assert.ok(path, 'nearExpiryQuantityBase must be present');
    assert.strictEqual(path.defaultValue, 0);
  });

  it('purchase recommendation formula: reorderLevel and safetyStock fields pre-exist', () => {
    const paths = schemaPaths(CafeInventoryConfig);
    assert.ok(paths.includes('reorderLevelBase'), 'reorderLevelBase required for recommendation formula');
    assert.ok(paths.includes('safetyStockBase'), 'safetyStockBase required for recommendation formula');
    assert.ok(paths.includes('reorderQuantityBase'), 'reorderQuantityBase required');
  });
});

// ── Capability 12 — StockMovement: Batch & Lot Traceability fields ────────────

describe('Capability 12 — Batch & Lot Traceability schema fields exist on StockMovement', () => {
  it('StockMovement schema contains batchId', () => {
    assert.ok(
      schemaPaths(StockMovement).includes('batchId'),
      'batchId must be present on StockMovement schema'
    );
  });

  it('StockMovement schema contains supplierBatchNumber', () => {
    assert.ok(
      schemaPaths(StockMovement).includes('supplierBatchNumber'),
      'supplierBatchNumber must be present on StockMovement schema'
    );
  });

  it('StockMovement schema contains expiryDate', () => {
    assert.ok(
      schemaPaths(StockMovement).includes('expiryDate'),
      'expiryDate must be present on StockMovement schema'
    );
  });

  it('StockMovement schema contains manufacturingDate', () => {
    assert.ok(
      schemaPaths(StockMovement).includes('manufacturingDate'),
      'manufacturingDate must be present on StockMovement schema'
    );
  });
});

// ── Capability 13 — StockMovement: Recall & Quarantine fields ────────────────

describe('Capability 13 — Recall & Quarantine schema fields exist on StockMovement', () => {
  it('StockMovement schema contains isQuarantined with default false', () => {
    const path = StockMovement.schema.path('isQuarantined');
    assert.ok(path, 'isQuarantined must be present on StockMovement schema');
    assert.strictEqual(path.defaultValue, false);
  });

  it('StockMovement schema contains quarantinedAt', () => {
    assert.ok(
      schemaPaths(StockMovement).includes('quarantinedAt'),
      'quarantinedAt must be present on StockMovement schema'
    );
  });

  it('StockMovement schema contains quarantineReason', () => {
    assert.ok(
      schemaPaths(StockMovement).includes('quarantineReason'),
      'quarantineReason must be present on StockMovement schema'
    );
  });

  it('StockMovement schema contains quarantinedByUserId', () => {
    assert.ok(
      schemaPaths(StockMovement).includes('quarantinedByUserId'),
      'quarantinedByUserId must be present on StockMovement schema'
    );
  });

  it('StockMovement schema contains recallNoticeId', () => {
    assert.ok(
      schemaPaths(StockMovement).includes('recallNoticeId'),
      'recallNoticeId must be present on StockMovement schema'
    );
  });

  it('StockMovement schema contains releasedFromQuarantineAt', () => {
    assert.ok(
      schemaPaths(StockMovement).includes('releasedFromQuarantineAt'),
      'releasedFromQuarantineAt must be present on StockMovement schema'
    );
  });

  it('StockMovement schema contains releasedByUserId', () => {
    assert.ok(
      schemaPaths(StockMovement).includes('releasedByUserId'),
      'releasedByUserId must be present on StockMovement schema'
    );
  });
});
