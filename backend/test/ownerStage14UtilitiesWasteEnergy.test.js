'use strict';

/**
 * ============================================================================
 * ZAMORIN CAFÉ ERP — STAGE 14: UTILITIES, WASTE & ENERGY TEST SUITE
 * ============================================================================
 * Tests:
 * 1. Utility Meter Registration: Registers electricity, water, and gas meters.
 * 2. Meter Reading Intake & Rollover: Correctly calculates consumption & detects rollover.
 * 3. Reading Anomaly Detection: Flags consumption exceeding baseline threshold by >35%.
 * 4. Waste Recording & Inventory Linkage: Prevents financial double counting with WastageRecord.
 * 5. Used Cooking Oil (RUCO): Enforces 25% TPC limit & permanent food inventory reentry prohibition.
 * 6. SWM 2026 Legal Applicability: Evaluates MoEFCC S.O. 388(E) BWG 100 kg/day threshold.
 * 7. Normalized KPI Aggregations: Zero-division protected intensity metrics.
 * 8. Multi-Tenant IDOR Isolation: Strictly restricts meter queries to owning organisation.
 */

const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');

const UtilityMeter = require('../src/models/UtilityMeter');
const UtilityReading = require('../src/models/UtilityReading');
const WasteRecord = require('../src/models/WasteRecord');
const UsedCookingOilLog = require('../src/models/UsedCookingOilLog');
const SolidWaste2026Applicability = require('../src/models/SolidWaste2026Applicability');
const BillModule = require('../src/models/Bill');
const Bill = BillModule.Bill || BillModule;
const ownerUtilitiesWasteService = require('../src/services/ownerUtilitiesWasteService');

describe('STAGE 14 — Utilities, Waste & Energy Management Suite', () => {
  const TEST_ORG = new mongoose.Types.ObjectId().toString().toUpperCase();
  const FOREIGN_ORG = new mongoose.Types.ObjectId().toString().toUpperCase();
  const TEST_CAFE = new mongoose.Types.ObjectId().toString();

  const USER_OWNER = { userId: 'USR-OWNER-14', email: 'owner14@zamorin.com', role: 'OWNER' };

  let testElectricityMeterId;
  let testWaterMeterId;

  before(async () => {
    if (mongoose.connection.readyState === 0) {
      const uri = process.env.MONGO_URI || 'mongodb://localhost:27017/zamorin_erp_test';
      await mongoose.connect(uri);
    }

    await UtilityMeter.deleteMany({ organisationId: { $in: [TEST_ORG, FOREIGN_ORG] } });
    await UtilityReading.deleteMany({ organisationId: { $in: [TEST_ORG, FOREIGN_ORG] } });
    await WasteRecord.deleteMany({ organisationId: { $in: [TEST_ORG, FOREIGN_ORG] } });
    await UsedCookingOilLog.deleteMany({ organisationId: { $in: [TEST_ORG, FOREIGN_ORG] } });
    await SolidWaste2026Applicability.deleteMany({ organisationId: { $in: [TEST_ORG, FOREIGN_ORG] } });
    await Bill.deleteMany({ organisationId: { $in: [TEST_ORG, FOREIGN_ORG] } });
  });

  test('1. Utility Meter Registration: Registers electricity and water meters at café level', async () => {
    const eleMeter = await ownerUtilitiesWasteService.registerMeter(TEST_ORG, {
      cafeId: TEST_CAFE,
      utilityCategory: 'ELECTRICITY',
      meterName: 'Main Kitchen Electricity',
      meterIdentifier: 'KSEB-ZC01-001',
      providerName: 'KSEB Commercial',
      unitOfMeasure: 'KWH',
      baselineMonthlyConsumption: 1200
    }, USER_OWNER);

    assert.ok(eleMeter.meterId);
    assert.equal(eleMeter.utilityCategory, 'ELECTRICITY');
    assert.equal(eleMeter.baselineMonthlyConsumption, 1200);
    testElectricityMeterId = eleMeter.meterId;

    const waterMeter = await ownerUtilitiesWasteService.registerMeter(TEST_ORG, {
      cafeId: TEST_CAFE,
      utilityCategory: 'WATER',
      meterName: 'Main Water Inflow',
      meterIdentifier: 'KWA-ZC01-002',
      providerName: 'Kerala Water Authority',
      unitOfMeasure: 'LITRE',
      baselineMonthlyConsumption: 15000
    }, USER_OWNER);

    assert.ok(waterMeter.meterId);
    assert.equal(waterMeter.utilityCategory, 'WATER');
    testWaterMeterId = waterMeter.meterId;
  });

  test('2. Meter Reading Intake & Rollover: Correctly calculates consumption & detects rollover', async () => {
    // Normal reading
    const reading1 = await ownerUtilitiesWasteService.recordMeterReading(TEST_ORG, {
      meterId: testElectricityMeterId,
      startReading: 1000,
      endReading: 1250,
      periodStart: new Date('2026-08-01'),
      periodEnd: new Date('2026-08-15')
    }, USER_OWNER);

    assert.equal(reading1.consumption, 250);
    assert.equal(reading1.isAnomaly, false);

    // Negative reading without rollover rejected
    await assert.rejects(
      async () => {
        await ownerUtilitiesWasteService.recordMeterReading(TEST_ORG, {
          meterId: testElectricityMeterId,
          startReading: 1250,
          endReading: 1100, // Negative without being near 99999 rollover
          periodStart: new Date('2026-08-16'),
          periodEnd: new Date('2026-08-31')
        }, USER_OWNER);
      },
      (err) => err.message.includes('NEGATIVE_CONSUMPTION_DETECTED')
    );

    // Rollover reading (e.g. 99500 to 00200 = 700)
    const rolloverReading = await ownerUtilitiesWasteService.recordMeterReading(TEST_ORG, {
      meterId: testElectricityMeterId,
      startReading: 99500,
      endReading: 200,
      periodStart: new Date('2026-09-01'),
      periodEnd: new Date('2026-09-15')
    }, USER_OWNER);

    assert.equal(rolloverReading.consumption, 700);
  });

  test('3. Reading Anomaly Detection: Flags consumption exceeding baseline threshold by >35%', async () => {
    // Baseline is 1200. A single period reading of 1700 is > 35% above 1200
    const anomalyReading = await ownerUtilitiesWasteService.recordMeterReading(TEST_ORG, {
      meterId: testElectricityMeterId,
      startReading: 2000,
      endReading: 3750, // consumption = 1750 (45.8% above baseline 1200)
      periodStart: new Date('2026-09-16'),
      periodEnd: new Date('2026-09-30')
    }, USER_OWNER);

    assert.equal(anomalyReading.consumption, 1750);
    assert.equal(anomalyReading.isAnomaly, true);
    assert.ok(anomalyReading.anomalyReason.includes('above monthly baseline'));
  });

  test('4. Waste Recording & Inventory Linkage: Prevents financial double counting with WastageRecord', async () => {
    const wasteRecord = await ownerUtilitiesWasteService.recordWaste(TEST_ORG, {
      cafeId: TEST_CAFE,
      wasteCategory: 'FOOD_WASTE',
      quantity: 12.5,
      unitOfMeasure: 'KG',
      wasteReason: 'Trimmings and prep scrap',
      disposalRoute: 'MUNICIPAL_COLLECTION',
      inventoryWastageId: 'WAST-202609-001'
    }, USER_OWNER);

    assert.ok(wasteRecord.wasteId);
    assert.equal(wasteRecord.quantity, 12.5);
    assert.equal(wasteRecord.isDoubleCountingPrevented, true);
  });

  test('5. Used Cooking Oil (RUCO): Enforces 25% TPC limit & permanent food inventory reentry prohibition', async () => {
    // Safe oil (< 25% TPC)
    const safeUco = await ownerUtilitiesWasteService.recordUsedCookingOil(TEST_ORG, {
      cafeId: TEST_CAFE,
      oilType: 'PALMOLEIN_BLENDED',
      totalPolarCompoundsPercent: 18.5,
      quantityLiters: 15,
      collectorName: 'BioFuel Solutions Ltd',
      collectorFssaiRegistration: 'FSSAI-RUCO-KL-9988'
    }, USER_OWNER);

    assert.equal(safeUco.reentryBlocked, true);
    assert.ok(safeUco.tpcSafetyAlert.includes('within lawful food safety limits'));

    // Degraded oil (> 25% TPC FSSAI boundary)
    const degradedUco = await ownerUtilitiesWasteService.recordUsedCookingOil(TEST_ORG, {
      cafeId: TEST_CAFE,
      oilType: 'PALMOLEIN_BLENDED',
      totalPolarCompoundsPercent: 27.2,
      quantityLiters: 20,
      collectorName: 'BioFuel Solutions Ltd',
      collectorFssaiRegistration: 'FSSAI-RUCO-KL-9988'
    }, USER_OWNER);

    assert.equal(degradedUco.reentryBlocked, true);
    assert.ok(degradedUco.tpcSafetyAlert.includes('CRITICAL_SAFETY_ALERT: TPC exceeds 25.0% FSSAI limit'));
  });

  test('6. SWM 2026 Legal Applicability: Evaluates MoEFCC S.O. 388(E) BWG 100 kg/day threshold', async () => {
    // Current waste records generate < 100 kg/day -> Standard generator
    const standardEvaluation = await ownerUtilitiesWasteService.evaluateSWM2026Applicability(TEST_ORG, TEST_CAFE, USER_OWNER);
    assert.equal(standardEvaluation.isBulkWasteGenerator, false);
    assert.ok(standardEvaluation.bulkWasteClassificationRationale.includes('NOT classified as Bulk Waste Generator'));
    assert.equal(standardEvaluation.localBodyRegistrationRequired, false);

    // Seed large waste records to exceed 100 kg/day
    for (let i = 0; i < 5; i++) {
      await ownerUtilitiesWasteService.recordWaste(TEST_ORG, {
        cafeId: TEST_CAFE,
        wasteCategory: 'FOOD_WASTE',
        quantity: 800, // 800 * 5 = 4,000 kg over 30 days = 133 kg/day
        unitOfMeasure: 'KG',
        disposalRoute: 'MUNICIPAL_COLLECTION'
      }, USER_OWNER);
    }

    const bwgEvaluation = await ownerUtilitiesWasteService.evaluateSWM2026Applicability(TEST_ORG, TEST_CAFE, USER_OWNER);
    assert.equal(bwgEvaluation.isBulkWasteGenerator, true);
    assert.ok(bwgEvaluation.bulkWasteClassificationRationale.includes('Generates >= 100 kg/day'));
    assert.equal(bwgEvaluation.localBodyRegistrationRequired, true);
  });

  test('7. Normalized KPI Aggregations: Zero-division protected intensity metrics', async () => {
    // Record water reading
    await ownerUtilitiesWasteService.recordMeterReading(TEST_ORG, {
      meterId: testWaterMeterId,
      startReading: 1000,
      endReading: 4500, // 3,500 L
      periodStart: new Date('2026-08-01'),
      periodEnd: new Date('2026-08-31')
    }, USER_OWNER);

    // Seed bills
    const rand = Math.floor(Math.random() * 8999 + 1000);
    await Bill.create({
      billId: `BILL-20260914-${rand}1`,
      organisationId: TEST_ORG,
      cafeId: TEST_CAFE,
      businessDate: '2026-09-14',
      status: 'COMPLETED',
      cashierUserId: 'USR-CASHIER-01',
      subtotalPaisa: 500000, // ₹5,000
      totalPaisa: 500000,
      totalPayablePaisa: 500000,
      lineItems: [{
        lineItemId: 'LINE-01',
        menuItemId: 'MENU-01',
        itemNameSnapshot: 'Coffee',
        quantity: 1,
        unitPricePaisa: 500000,
        lineSubtotalPaisa: 500000,
        lineTotalPaisa: 500000
      }]
    });

    const dashboard = await ownerUtilitiesWasteService.getUtilitiesDashboard(TEST_ORG, { cafeId: TEST_CAFE });
    assert.ok(dashboard.totalElectricityKwh > 0);
    assert.ok(dashboard.totalWaterLitres >= 3500);
    assert.equal(dashboard.totalBillsProcessed, 1);
    assert.equal(dashboard.totalRevenueRupees, 5000);
    assert.ok(dashboard.normalizedKpis.electricityKwhPerThousandSales > 0);
    assert.ok(dashboard.normalizedKpis.waterLitresPerHundredBills > 0);
    assert.ok(dashboard.environmentalClaimsNotice.includes('UNSUPPORTED_CLAIMS_PROHIBITED'));
  });

  test('8. Multi-Tenant IDOR Isolation: Strictly restricts meter queries to owning organisation', async () => {
    await assert.rejects(
      async () => {
        await ownerUtilitiesWasteService.recordMeterReading(FOREIGN_ORG, {
          meterId: testElectricityMeterId,
          startReading: 5000,
          endReading: 5200,
          periodStart: new Date('2026-10-01'),
          periodEnd: new Date('2026-10-15')
        }, USER_OWNER);
      },
      (err) => err.message.includes('METER_NOT_FOUND')
    );
  });

  after(async () => {
    await mongoose.disconnect();
  });
});
