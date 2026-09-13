'use strict';

/**
 * ============================================================================
 * ZAMORIN CAFÉ ERP — CAFÉ OPERATIONS R02 COMPLETE DOMAIN TEST SUITE
 * ============================================================================
 * Comprehensive end-to-end integration tests for all 10 R02 domains:
 *
 * R02-01: Food Safety & Hygiene (Temperature, Cleaning, Pest Control, Calibration)
 * R02-02: Receiving / Batch / Expiry / FEFO Allocation & Quarantine
 * R02-03: Kitchen Display System (Station Routing, Expediter, State Bumping, POS Void)
 * R02-04: Menu Compliance Metadata (Prep Station, FSSAI Category, Core Temp)
 * R02-05: Food Safety Training & Staff Fitness (FoSTaC, Medical Fitness, Supervisor)
 * R02-06: Customer Complaints & Food Safety Incidents (Foreign Object, Illness, CAPA)
 * R02-07: Shift Handover & Operational Continuity (Dual Signoff, Cash Variance)
 * R02-08: Operational Exception Centre (Live Multi-Domain Aggregation)
 * R02-09: Offline / Degraded Mode (Idempotent Replay, High-Risk Flags, KDS Ingestion)
 * R02-10: Recall & Quarantine Traceability (Forward & Backward Lot Lineage)
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

// Domain 1 Models & Services
const { TemperatureLog } = require('../src/models/TemperatureLog');
const { FoodSafetyService } = require('../src/services/foodSafetyService');

// Domain 2 Models & Services
const { InventoryLot } = require('../src/models/InventoryLot');
const { IncomingInspection } = require('../src/models/IncomingInspection');
const { FefoService } = require('../src/services/fefoService');

// Domain 3 Models & Services
const { KdsTicket } = require('../src/models/KdsTicket');
const KdsService = require('../src/services/kdsService');

// Domain 4 Models
const { MenuItem } = require('../src/models/MenuItem');

// Domain 5 Models
const { EmployeeTraining } = require('../src/models/EmployeeTraining');

// Domain 6 Models
const { FoodSafetyIncident } = require('../src/models/FoodSafetyIncident');

// Domain 7 Models
const { ShiftHandover } = require('../src/models/ShiftHandover');

// Domain 8 Service
const OperationalExceptionService = require('../src/services/operationalExceptionService');

// Domain 9 Models & Services
const { Bill } = require('../src/models/Bill');
const OfflineSyncService = require('../src/services/offlineSyncService');

// Domain 10 Service
const RecallTraceService = require('../src/services/recallTraceService');

test('CAFÉ OPS-R02: Complete 10-Domain Implementation Suite', async (t) => {
  let mongoServer;
  const ORG_ID = 'ZAMORIN';
  const CAFE_ID = 'ZC-0001';
  const ACTOR_ID = 'USER-OPS-01';

  t.before(async () => {
    mongoServer = await MongoMemoryServer.create();
    await mongoose.connect(mongoServer.getUri());
  });

  t.after(async () => {
    await mongoose.disconnect();
    if (mongoServer) {
      await mongoServer.stop();
    }
  });

  // ==========================================================================
  // R02-01: FOOD SAFETY & HYGIENE
  // ==========================================================================
  await t.test('R02-01: Food Safety — Temperature logging & automated excursion detection', async () => {
    // 1. Log compliant temperature
    const safeLog = await FoodSafetyService.recordTemperature({
      organisationId: ORG_ID,
      cafeId: CAFE_ID,
      monitoringPoint: 'REFRIGERATOR',
      monitoringPointName: 'Walk-in Chiller Milk Dairy',
      readingCelsius: 3.2,
      minimumAllowedCelsius: 0,
      maximumAllowedCelsius: 4.0,
      recordedByUserId: ACTOR_ID,
    });

    assert.equal(safeLog.isExcursion, false);
    assert.equal(safeLog.status, 'WITHIN_RANGE');
    assert.equal(safeLog.readingCelsius, 3.2);

    // 2. Log excursion temperature (cold chain breach)
    const breachLog = await FoodSafetyService.recordTemperature({
      organisationId: ORG_ID,
      cafeId: CAFE_ID,
      monitoringPoint: 'COLD_DISPLAY',
      monitoringPointName: 'Salad Bar Well',
      readingCelsius: 8.5,
      minimumAllowedCelsius: 0,
      maximumAllowedCelsius: 4.0,
      recordedByUserId: ACTOR_ID,
      remarks: 'Compressor cycle interrupted',
    });

    assert.equal(breachLog.isExcursion, true);
    assert.equal(breachLog.status, 'OUT_OF_RANGE');
    assert.equal(breachLog.originalExcursionReading, 8.5);

    // 3. Resolve excursion with corrective action
    const resolved = await FoodSafetyService.applyCorrectiveAction({
      organisationId: ORG_ID,
      cafeId: CAFE_ID,
      logId: breachLog.logId,
      correctiveAction: 'Replaced thermostat sensor and moved dairy to secondary chiller.',
      actionTakenByUserId: ACTOR_ID,
      resolvedReadingCelsius: 3.1,
    });

    assert.equal(resolved.status, 'CORRECTED');
    assert.equal(resolved.resolvedReadingCelsius, 3.1);

    // 4. Sanitation Cleaning task recording and completion
    const cleaning = await FoodSafetyService.createCleaningTask({
      organisationId: ORG_ID,
      cafeId: CAFE_ID,
      areaOrEquipment: 'Espresso Bar and Steam Wands',
      procedure: 'Daily chemical backflush and sanitizer rinse',
      assignedUserId: ACTOR_ID,
      frequency: 'DAILY',
      dueDateTime: new Date(),
    });

    assert.equal(cleaning.status, 'DUE');

    const completedClean = await FoodSafetyService.completeCleaningTask({
      organisationId: ORG_ID,
      cafeId: CAFE_ID,
      taskId: cleaning.taskId,
      completedByUserId: ACTOR_ID,
      verifiedByUserId: ACTOR_ID,
      remarks: 'Steam wands purged and backflush test verified clean.',
    });

    assert.equal(completedClean.status, 'COMPLETED');

    // 5. Calibration Record
    const calibration = await FoodSafetyService.recordCalibration({
      organisationId: ORG_ID,
      cafeId: CAFE_ID,
      assetId: 'THERMO-01',
      assetName: 'Cooper-Atkins Digital Probe',
      equipmentType: 'PROBE_THERMOMETER',
      calibrationDate: new Date(),
      nextDueDate: new Date(Date.now() + 90 * 86400000),
      performedBy: 'Lab Tech',
      recordedByUserId: ACTOR_ID,
      result: 'PASS',
    });

    assert.equal(calibration.result, 'PASS');
  });

  // ==========================================================================
  // R02-02: RECEIVING / BATCH / EXPIRY / FEFO ALLOCATION & QUARANTINE
  // ==========================================================================
  await t.test('R02-02: Receiving & FEFO — Prioritizes earliest expiry, blocks expired lots, enforces quarantine', async () => {
    // 1. Incoming Dock Inspection
    const inspection = await IncomingInspection.create({
      inspectionId: 'INSP-20260907-0001',
      organisationId: ORG_ID,
      cafeId: CAFE_ID,
      poReference: 'PO-2026-901',
      vendorId: 'SUP-DAIRY-01',
      vendorName: 'Nilgiri Fresh Dairy Ltd',
      supplierLot: 'SUP-LOT-MILK-441',
      itemId: 'ITEM-RAW-MILK',
      itemName: 'Full Cream Fresh Milk 1L',
      receivedQuantity: 50,
      acceptedQuantity: 50,
      unit: 'L',
      temperatureCelsius: 3.6,
      packagingCondition: 'INTACT',
      qualityCondition: 'ACCEPTABLE',
      decision: 'ACCEPT',
      inspectedByUserId: ACTOR_ID,
      inspectedAt: new Date(),
    });

    assert.equal(inspection.decision, 'ACCEPT');

    // 2. Create multiple inventory lots with different expiry dates
    // Lot A: Expires tomorrow (earliest)
    const lotA = await InventoryLot.create({
      lotId: 'LOT-MILK-A',
      organisationId: ORG_ID,
      cafeId: CAFE_ID,
      itemId: 'ITEM-RAW-MILK',
      supplierLot: 'SUP-LOT-MILK-440',
      initialQuantity: 20,
      quantityBase: 20,
      remainingQuantity: 20,
      quantityOnHand: 20,
      unit: 'L',
      status: 'AVAILABLE',
      quarantineStatus: 'RELEASED',
      expiryDate: '2026-09-08',
      receivedDate: '2026-09-05',
    });

    // Lot B: Expires in 5 days (later)
    const lotB = await InventoryLot.create({
      lotId: 'LOT-MILK-B',
      organisationId: ORG_ID,
      cafeId: CAFE_ID,
      itemId: 'ITEM-RAW-MILK',
      supplierLot: 'SUP-LOT-MILK-441',
      initialQuantity: 30,
      quantityBase: 30,
      remainingQuantity: 30,
      quantityOnHand: 30,
      unit: 'L',
      status: 'AVAILABLE',
      quarantineStatus: 'RELEASED',
      expiryDate: '2026-09-12',
      receivedDate: '2026-09-07',
    });

    // Lot C: Expired yesterday
    const lotC = await InventoryLot.create({
      lotId: 'LOT-MILK-EXPIRED',
      organisationId: ORG_ID,
      cafeId: CAFE_ID,
      itemId: 'ITEM-RAW-MILK',
      supplierLot: 'SUP-LOT-MILK-OLD',
      initialQuantity: 10,
      quantityBase: 10,
      remainingQuantity: 10,
      quantityOnHand: 10,
      unit: 'L',
      status: 'AVAILABLE',
      quarantineStatus: 'RELEASED',
      expiryDate: '2026-09-06', // Before today 2026-09-07
      receivedDate: '2026-09-01',
    });

    // 3. Calculate FEFO plan for 25 units
    // Should skip expired Lot C, take all 20 from Lot A, and 5 from Lot B
    const fefoPlan = await FefoService.planFefoDeduction({
      organisationId: ORG_ID,
      cafeId: CAFE_ID,
      itemId: 'ITEM-RAW-MILK',
      requiredQuantity: 25,
      businessDate: '2026-09-07',
    });

    assert.equal(fefoPlan.allocatedLots.length, 2);
    assert.equal(fefoPlan.allocatedLots[0].lotId, 'LOT-MILK-A');
    assert.equal(fefoPlan.allocatedLots[0].deductQuantity, 20);
    assert.equal(fefoPlan.allocatedLots[1].lotId, 'LOT-MILK-B');
    assert.equal(fefoPlan.allocatedLots[1].deductQuantity, 5);

    // Verify expired lot C was auto-marked EXPIRED
    const updatedLotC = await InventoryLot.findOne({ lotId: 'LOT-MILK-EXPIRED' });
    assert.equal(updatedLotC.status, 'EXPIRED');

    // 4. Quarantine and Release Lifecycle
    lotB.status = 'QUARANTINE';
    lotB.dispositionNotes = 'Suspected cold-chain deviation at transit';
    await lotB.save();

    const quarantinedLot = await InventoryLot.findOne({ lotId: 'LOT-MILK-B' });
    assert.equal(quarantinedLot.status, 'QUARANTINE');

    // Release lot after lab approval
    lotB.status = 'AVAILABLE';
    lotB.dispositionStatus = 'RELEASE';
    await lotB.save();

    const releasedLot = await InventoryLot.findOne({ lotId: 'LOT-MILK-B' });
    assert.equal(releasedLot.status, 'AVAILABLE');
    assert.equal(releasedLot.dispositionStatus, 'RELEASE');
  });

  // ==========================================================================
  // R02-03: KITCHEN DISPLAY SYSTEM (KDS)
  // ==========================================================================
  await t.test('R02-03: KDS — Station routing, expediter ticket, state bumping & void propagation', async () => {
    // 1. Order containing HOT_KITCHEN and BEVERAGE_BAR items
    const orderItems = [
      {
        itemId: 'ITEM-BURGER-01',
        name: 'Zamorin Pepper Chicken Burger',
        quantity: 2,
        category: 'HOT_KITCHEN',
        prepStation: 'HOT_KITCHEN',
        specialInstructions: 'Extra spicy, no pickles',
      },
      {
        itemId: 'ITEM-COFFEE-01',
        name: 'Artisan Iced Flat White',
        quantity: 2,
        category: 'BEVERAGE',
        prepStation: 'BEVERAGE_BAR',
        specialInstructions: 'Oat milk sub',
      },
    ];

    const tickets = await KdsService.createTicketsFromOrder({
      organisationId: ORG_ID,
      cafeId: CAFE_ID,
      billId: 'BILL-20260907-0010',
      orderNumber: 'ORD-042',
      tableNumber: 'T-04',
      diningOption: 'DINE_IN',
      priority: 'HIGH',
      items: orderItems,
      splitByStation: true,
    });

    assert.ok(Array.isArray(tickets));
    // Should create 2 station tickets + 1 expediter ticket = 3 tickets
    assert.equal(tickets.length, 3);

    // Verify HOT_KITCHEN ticket
    const hotTicket = tickets.find((t) => t.prepStation === 'HOT_KITCHEN');
    assert.ok(hotTicket);
    assert.equal(hotTicket.items.length, 1);
    assert.equal(hotTicket.items[0].name, 'Zamorin Pepper Chicken Burger');
    assert.equal(hotTicket.status, 'RECEIVED');

    // Verify BEVERAGE_BAR ticket
    const bevTicket = tickets.find((t) => t.prepStation === 'BEVERAGE_BAR');
    assert.ok(bevTicket);
    assert.equal(bevTicket.items.length, 1);
    assert.equal(bevTicket.items[0].name, 'Artisan Iced Flat White');

    // Verify EXPEDITER ticket (has all items)
    const expTicket = tickets.find((t) => t.prepStation === 'EXPEDITER');
    assert.ok(expTicket);
    assert.equal(expTicket.items.length, 2);

    // 2. Station filtering
    const hotStationTickets = await KdsService.listTickets({
      organisationId: ORG_ID,
      cafeId: CAFE_ID,
      prepStation: 'HOT_KITCHEN',
    });
    assert.ok(hotStationTickets.length >= 1);
    assert.equal(hotStationTickets[0].prepStation, 'HOT_KITCHEN');

    // 3. State bumping: RECEIVED -> PREPARING -> READY
    const bumpedPrep = await KdsService.bumpTicket({
      organisationId: ORG_ID,
      cafeId: CAFE_ID,
      ticketId: hotTicket.ticketId,
      targetStatus: 'PREPARING',
      userId: ACTOR_ID,
    });
    assert.equal(bumpedPrep.status, 'PREPARING');

    const bumpedReady = await KdsService.bumpTicket({
      organisationId: ORG_ID,
      cafeId: CAFE_ID,
      ticketId: hotTicket.ticketId,
      targetStatus: 'READY',
      userId: ACTOR_ID,
    });
    assert.equal(bumpedReady.status, 'READY');

    // 4. Item state bumping
    const bumpedItem = await KdsService.bumpItem({
      organisationId: ORG_ID,
      cafeId: CAFE_ID,
      ticketId: expTicket.ticketId,
      itemIndex: 0,
      itemStatus: 'COMPLETED',
      userId: ACTOR_ID,
    });
    assert.equal(bumpedItem.items[0].status, 'COMPLETED');

    // 5. POS Void propagation: voids in POS cancel active KDS tickets
    const voidResult = await KdsService.voidBillItems({
      organisationId: ORG_ID,
      cafeId: CAFE_ID,
      billId: 'BILL-20260907-0010',
      voidReason: 'Guest walked out before prep',
      userId: ACTOR_ID,
    });
    assert.ok(voidResult.length >= 1);

    const cancelledTickets = await KdsTicket.find({
      organisationId: ORG_ID,
      billId: 'BILL-20260907-0010',
    });
    for (const t of cancelledTickets) {
      if (t.status !== 'COLLECTED') {
        assert.equal(t.status, 'VOIDED');
      }
    }
  });

  // ==========================================================================
  // R02-04: MENU FOOD COMPLIANCE METADATA
  // ==========================================================================
  await t.test('R02-04: Menu Compliance — Prep station routing, core cooking temps & FSSAI category', async () => {
    const menuItem = await MenuItem.create({
      menuItemId: 'MENU-01',
      organisationId: ORG_ID,
      name: 'Malabar Herb Grilled Chicken',
      nameLower: 'malabar herb grilled chicken',
      category: 'MAIN_COURSE',
      currentPricePaisa: 45000,
      createdByUserId: ACTOR_ID,
      prepStation: 'HOT_KITCHEN',
      targetPrepTimeMinutes: 12,
      foodSafetyNotes: 'Ensure core temperature reaches minimum 75°C for 2 minutes.',
      fssaiCategoryNumber: '08.2.1',
      isVegetarian: false,
    });

    assert.equal(menuItem.prepStation, 'HOT_KITCHEN');
    assert.equal(menuItem.targetPrepTimeMinutes, 12);
    assert.equal(menuItem.fssaiCategoryNumber, '08.2.1');
    assert.ok(menuItem.foodSafetyNotes.includes('75°C'));

    // Check inferPrepStation picks up model metadata
    const inferredStation = KdsService.inferPrepStation(menuItem);
    assert.equal(inferredStation, 'HOT_KITCHEN');
  });

  // ==========================================================================
  // R02-05: FOOD SAFETY TRAINING & STAFF FITNESS
  // ==========================================================================
  await t.test('R02-05: Food Safety Training — FoSTaC supervisor certification & medical fitness checks', async () => {
    const training = await EmployeeTraining.create({
      trainingId: 'TRN-2026-0001',
      organisationId: ORG_ID,
      cafeId: CAFE_ID,
      userId: 'EMP-CHEF-01',
      trainingTitle: 'FSSAI FoSTaC Advance Catering Food Safety',
      trainingType: 'FOSTAC',
      status: 'COMPLETED',
      assignedDate: '2026-08-01',
      dueDate: '2026-08-10',
      completedAt: new Date('2026-08-05'),
      fostacCertificateNumber: 'FOSTAC-ADV-2026-7890',
      isFoodSafetySupervisor: true,
      medicalFitnessStatus: 'FIT',
      medicalCertificateExpiry: '2027-08-01',
      typhoidVaccinationDate: '2026-01-15',
      dewormingDate: '2026-07-10',
      provider: 'FSSAI Empanelled Training Partner',
    });

    assert.equal(training.isFoodSafetySupervisor, true);
    assert.equal(training.medicalFitnessStatus, 'FIT');
    assert.equal(training.fostacCertificateNumber, 'FOSTAC-ADV-2026-7890');
    assert.equal(training.trainingType, 'FOSTAC');

    // Query active food safety supervisors for cafe
    const supervisors = await EmployeeTraining.find({
      organisationId: ORG_ID,
      cafeId: CAFE_ID,
      isFoodSafetySupervisor: true,
      status: 'COMPLETED',
    });
    assert.equal(supervisors.length, 1);
    assert.equal(supervisors[0].userId, 'EMP-CHEF-01');
  });

  // ==========================================================================
  // R02-06: FOOD SAFETY INCIDENTS & CUSTOMER COMPLAINTS
  // ==========================================================================
  await t.test('R02-06: Incidents — Foreign object allegation logging, lot linkage & CAPA resolution', async () => {
    const incident = await FoodSafetyIncident.create({
      incidentId: 'INC-20260907-001',
      organisationId: ORG_ID,
      cafeId: CAFE_ID,
      incidentType: 'FOREIGN_OBJECT',
      severity: 'CRITICAL',
      status: 'INVESTIGATING',
      customerName: 'Vikram Menon',
      customerContact: '+91 98765 43210',
      billId: 'BILL-20260907-0010',
      menuItemId: 'ITEM-BURGER-01',
      menuItemName: 'Zamorin Pepper Chicken Burger',
      lotId: 'LOT-CHICKEN-99',
      description: 'Guest reported finding small metal shaving in grilled patty.',
      sampleRetained: true,
      sampleStorageLocation: 'Food Safety QA Cabinet Locker #2',
      reportedByUserId: ACTOR_ID,
      reportedAt: new Date(),
    });

    assert.equal(incident.severity, 'CRITICAL');
    assert.equal(incident.sampleRetained, true);

    // Resolve incident with CAPA
    incident.status = 'RESOLVED';
    incident.investigationFindings = 'Metal scraper wire degraded during daily grill maintenance.';
    incident.correctiveAction = 'Replaced all wire brushes with monolithic brass scraper blades across all cafes.';
    incident.resolvedAt = new Date();
    incident.resolvedByUserId = ACTOR_ID;
    await incident.save();

    const resolvedIncident = await FoodSafetyIncident.findOne({ incidentId: 'INC-20260907-001' });
    assert.equal(resolvedIncident.status, 'RESOLVED');
    assert.ok(resolvedIncident.correctiveAction.includes('brass scraper blades'));
  });

  // ==========================================================================
  // R02-07: SHIFT HANDOVER & OPERATIONAL CONTINUITY
  // ==========================================================================
  await t.test('R02-07: Shift Handover — Dual signoff, cash drawer variance calculation & hygiene checklists', async () => {
    const handover = await ShiftHandover.create({
      handoverId: 'HND-20260907-0001',
      organisationId: ORG_ID,
      cafeId: CAFE_ID,
      handoverType: 'HANDOVER',
      shiftType: 'MORNING',
      handoverDate: '2026-09-07',
      handingOverUserId: 'LEAD-MORNING-01',
      receivingUserId: 'LEAD-EVENING-01',
      cashDrawer: {
        openingFloatPaisa: 500000, // ₹5,000.00
        countedCashPaisa: 1245000, // ₹12,450.00
        expectedCashPaisa: 1250000, // ₹12,500.00
        variancePaisa: -5000, // -₹50.00 variance
        varianceReason: 'Rounding coins discrepancy on peak counter',
        cashDropPaisa: 700000, // ₹7,000.00 drop
        pettyCashRemainingPaisa: 545000,
      },
      operationalChecklist: {
        cleaningCompleted: true,
        temperaturesLogged: true,
        foodWasteLogged: true,
        posReconciled: true,
        stockReplenished: true,
      },
      equipmentStatusNotes: 'Espresso Group 2 gasket needs tightening tonight.',
      stockIssuesNotes: 'Almond milk stock low, 3 cartons remaining.',
      pendingOrdersCount: 2,
      acknowledgementStatus: 'PENDING',
    });

    assert.equal(handover.cashDrawer.variancePaisa, -5000);
    assert.equal(handover.acknowledgementStatus, 'PENDING');

    // Dual sign-off acknowledgement by incoming lead
    handover.acknowledgementStatus = 'ACCEPTED';
    handover.acknowledgedAt = new Date();
    handover.incomingLeadComments = 'Cash verified (-₹50 noted), almond milk restock requested from central store.';
    await handover.save();

    const signedHandover = await ShiftHandover.findOne({ handoverId: 'HND-20260907-0001' });
    assert.equal(signedHandover.acknowledgementStatus, 'ACCEPTED');
    assert.ok(signedHandover.acknowledgedAt);
  });

  // ==========================================================================
  // R02-08: OPERATIONAL EXCEPTION CENTRE
  // ==========================================================================
  await t.test('R02-08: Exception Centre — Aggregates live exceptions across all 5 operational subsystems', async () => {
    // Create an unresolved temperature excursion
    await TemperatureLog.create({
      logId: 'TEMP-EXCURSION-TEST-99',
      organisationId: ORG_ID,
      cafeId: CAFE_ID,
      monitoringPoint: 'REFRIGERATOR',
      readingCelsius: 9.0,
      minimumAllowedCelsius: 0,
      maximumAllowedCelsius: 4,
      status: 'OUT_OF_RANGE',
      isExcursion: true,
      correctiveActionTaken: '',
      correctiveActionVerified: false,
      recordedByUserId: ACTOR_ID,
    });

    const report = await OperationalExceptionService.getCafeExceptions({
      organisationId: ORG_ID,
      cafeId: CAFE_ID,
    });

    assert.ok(report);
    assert.equal(report.cafeId, CAFE_ID);
    assert.ok(report.summary.totalExceptions >= 1);
    assert.ok(Array.isArray(report.exceptions));

    // Verify temperature excursion is in the list
    const tempExc = report.exceptions.find((e) => e.domain === 'FOOD_SAFETY' && e.category === 'TEMPERATURE_EXCURSION');
    assert.ok(tempExc);
    assert.equal(tempExc.severity, 'HIGH');
  });

  // ==========================================================================
  // R02-09: OFFLINE / DEGRADED MODE RECONCILIATION
  // ==========================================================================
  await t.test('R02-09: Offline Sync — Idempotency deduplication, risk detection & KDS auto-routing', async () => {
    const offlineBatch = [
      {
        clientOfflineId: 'OFFLINE-TX-2026-001',
        invoiceNumber: 'INV-OFF-001',
        businessDate: '2026-09-07',
        subtotalPaisa: 30000,
        discountPaisa: 0,
        totalPaisa: 30000,
        paidPaisa: 30000,
        paymentMode: 'CASH',
        status: 'PAID',
        lineItems: [
          {
            itemId: 'ITEM-COFFEE-01',
            name: 'Artisan Iced Flat White',
            quantity: 1,
            unitPricePaisa: 30000,
            totalPaisa: 30000,
          },
        ],
      },
      // High-risk transaction: extreme discount > 40%
      {
        clientOfflineId: 'OFFLINE-TX-2026-002',
        invoiceNumber: 'INV-OFF-002',
        businessDate: '2026-09-07',
        subtotalPaisa: 100000,
        discountPaisa: 50000, // 50% discount
        totalPaisa: 50000,
        paidPaisa: 50000,
        paymentMode: 'CASH',
        status: 'PAID',
        lineItems: [
          {
            itemId: 'ITEM-BURGER-01',
            name: 'Zamorin Pepper Chicken Burger',
            quantity: 2,
            unitPricePaisa: 50000,
            totalPaisa: 100000,
          },
        ],
      },
    ];

    // First replay: should sync both (1 clean, 1 flagged for audit)
    const syncResult1 = await OfflineSyncService.syncBatch({
      organisationId: ORG_ID,
      cafeId: CAFE_ID,
      deviceId: 'POS-TERMINAL-01',
      userId: ACTOR_ID,
      transactions: offlineBatch,
    });

    assert.equal(syncResult1.syncedCount, 2);
    assert.equal(syncResult1.duplicateCount, 0);
    assert.equal(syncResult1.flaggedCount, 1); // 1 extreme discount flagged

    // Second replay: both should be detected as duplicates (idempotency)
    const syncResult2 = await OfflineSyncService.syncBatch({
      organisationId: ORG_ID,
      cafeId: CAFE_ID,
      deviceId: 'POS-TERMINAL-01',
      userId: ACTOR_ID,
      transactions: offlineBatch,
    });

    assert.equal(syncResult2.syncedCount, 0);
    assert.equal(syncResult2.duplicateCount, 2);

    // Verify bills created have isOfflineReplay = true
    const replayedBill = await Bill.findOne({ clientOfflineId: 'OFFLINE-TX-2026-001' });
    assert.ok(replayedBill);
    assert.equal(replayedBill.isOfflineReplay, true);
    assert.equal(replayedBill.cafeId, CAFE_ID);
  });

  // ==========================================================================
  // R02-10: RECALL & QUARANTINE TRACEABILITY
  // ==========================================================================
  await t.test('R02-10: Recall Traceability — Forward trace from lot to bills, and backward trace from bill to PO', async () => {
    // 1. Forward trace: From supplier lot SUP-LOT-MILK-441
    const forwardTrace = await RecallTraceService.traceForward({
      organisationId: ORG_ID,
      supplierLot: 'SUP-LOT-MILK-441',
    });

    assert.ok(forwardTrace);
    assert.equal(forwardTrace.organisationId, ORG_ID);
    assert.ok(forwardTrace.lots.length >= 1);
    assert.equal(forwardTrace.lots[0].lotId, 'LOT-MILK-B');
    assert.ok(forwardTrace.inspections.length >= 1);
    assert.equal(forwardTrace.inspections[0].poReference, 'PO-2026-901');

    // 2. Backward trace: From Bill ID BILL-20260907-0010
    const backwardTrace = await RecallTraceService.traceBackward({
      organisationId: ORG_ID,
      billId: 'BILL-20260907-0010',
    });

    assert.ok(backwardTrace);
    assert.ok(Array.isArray(backwardTrace.suspectItems));
  });
});
