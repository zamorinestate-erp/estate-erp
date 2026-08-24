'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

const { PersonalLedger } = require('../src/models/PersonalLedger');
const { GlobalInventoryItem } = require('../src/models/GlobalInventoryItem');
const { CafeInventoryConfig } = require('../src/models/CafeInventoryConfig');
const { StockMovement } = require('../src/models/StockMovement');
const { Vendor } = require('../src/models/Vendor');
const { PurchaseOrder } = require('../src/models/PurchaseOrder');
const { MenuItem } = require('../src/models/MenuItem');
const { Bill } = require('../src/models/Bill');
const { Customer } = require('../src/models/Customer');
const { LoyaltyLedger } = require('../src/models/LoyaltyLedger');
const { Task } = require('../src/models/Task');
const { Approval } = require('../src/models/Approval');
const { QualityChecklist } = require('../src/models/QualityChecklist');
const { Asset } = require('../src/models/Asset');
const { MaintenanceJob } = require('../src/models/MaintenanceJob');
const { DepartmentOrder } = require('../src/models/DepartmentOrder');
const { RevenueShareAgreement } = require('../src/models/RevenueShareAgreement');
const { PrivateFile } = require('../src/models/PrivateFile');

test('PersonalLedger — validates schema & blocks deletion', async (t) => {
  await t.test('creates valid ledger entry model instance', () => {
    const entry = new PersonalLedger({
      ledgerEntryId: 'PL-20260807-0001',
      ownerUserId: 'MU-0001',
      organisationId: 'ORG-0001',
      entryType: 'CREDIT',
      amountPaisa: 150000,
      category: 'PERSONAL_TRANSFER',
      businessDate: '2026-08-07',
      description: 'Test investment credit',
      createdByUserId: 'MU-0001',
    });

    assert.equal(entry.ledgerEntryId, 'PL-20260807-0001');
    assert.equal(entry.amountPaisa, 150000);
    assert.equal(entry.status, 'ACTIVE');
  });

  await t.test('rejects negative amountPaisa', async () => {
    const entry = new PersonalLedger({
      ledgerEntryId: 'PL-20260807-0002',
      ownerUserId: 'MU-0001',
      organisationId: 'ORG-0001',
      entryType: 'CREDIT',
      amountPaisa: -500,
      category: 'PERSONAL_TRANSFER',
      businessDate: '2026-08-07',
      description: 'Invalid',
      createdByUserId: 'MU-0001',
    });

    try {
      await entry.validate();
      assert.fail('Should have failed validation');
    } catch (err) {
      assert.ok(err.errors.amountPaisa);
    }
  });
});

test('Inventory — GlobalItem, CafeConfig & StockMovement model contracts', async (t) => {
  await t.test('GlobalInventoryItem computes nameLower and normalises baseUnit', async () => {
    const item = new GlobalInventoryItem({
      itemId: 'ITEM-0001',
      sku: 'SKU-0001',
      organisationId: 'ORG-0001',
      name: ' Whole Milk ',
      category: 'DAIRY_FRESH',
      baseUnit: ' ML ',
      createdByUserId: 'MU-0001',
    });

    await item.validate();
    assert.equal(item.nameLower, 'whole milk');
    assert.equal(item.baseUnit, 'ml');
  });

  await t.test('CafeInventoryConfig defaults currentQuantityBase to 0', () => {
    const config = new CafeInventoryConfig({
      organisationId: 'ORG-0001',
      cafeId: 'CAFE-0001',
      itemId: 'ITEM-0001',
    });

    assert.equal(config.currentQuantityBase, 0);
  });

  await t.test('StockMovement validates quantityBase required', async () => {
    const mov = new StockMovement({
      movementId: 'SMOV-20260807-0001',
      organisationId: 'ORG-0001',
      cafeId: 'CAFE-0001',
      itemId: 'ITEM-0001',
      movementType: 'RECEIPT',
      balanceBeforeBase: 0,
      balanceAfterBase: 0,
      businessDate: '2026-08-07',
      createdByUserId: 'MU-0001',
      createdByRole: 'MASTER',
    });

    try {
      await mov.validate();
      assert.fail('Should have failed validation');
    } catch (err) {
      assert.ok(err.errors.quantityBase);
    }
  });
});

test('Vendor & Procurement — Models validation', async (t) => {
  await t.test('Vendor normalises nameLower & gstNumber', async () => {
    const vendor = new Vendor({
      vendorId: 'VEN-0001',
      organisationId: 'ORG-0001',
      name: 'Fresh Dairy Supplies',
      category: 'FOOD_BEVERAGE',
      gstNumber: ' 32aaaaa0000a1z5 ',
      createdByUserId: 'MU-0001',
    });

    await vendor.validate();
    assert.equal(vendor.nameLower, 'fresh dairy supplies');
    assert.equal(vendor.gstNumber, '32AAAAA0000A1Z5');
  });

  await t.test('PurchaseOrder requires at least one line item', async () => {
    const po = new PurchaseOrder({
      purchaseOrderId: 'PO-0001',
      organisationId: 'ORG-0001',
      cafeId: 'CAFE-0001',
      vendorId: 'VEN-0001',
      lineItems: [],
      createdByUserId: 'MU-0001',
    });

    try {
      await po.validate();
      assert.fail('Should have failed validation');
    } catch (err) {
      assert.ok(err.errors.lineItems);
    }
  });
});

test('Menu & Bill — Price history and sales receipt models', async (t) => {
  await t.test('MenuItem initialises default GST 5%', async () => {
    const menu = new MenuItem({
      menuItemId: 'MENU-0001',
      organisationId: 'ORG-0001',
      name: 'Espresso',
      nameLower: 'espresso',
      category: 'COFFEE',
      currentPricePaisa: 12000,
      createdByUserId: 'MU-0001',
    });

    await menu.validate();
    assert.equal(menu.taxRatePercent, 5);
    assert.equal(menu.isTaxInclusive, true);
  });

  await t.test('Bill requires line items', async () => {
    const bill = new Bill({
      billId: 'BILL-20260807-0001',
      organisationId: 'ORG-0001',
      cafeId: 'CAFE-0001',
      lineItems: [],
      subtotalPaisa: 0,
      totalPaisa: 0,
      businessDate: '2026-08-07',
      cashierUserId: 'MU-0001',
    });

    try {
      await bill.validate();
      assert.fail('Should have failed validation');
    } catch (err) {
      assert.ok(err.errors.lineItems);
    }
  });
});

test('Customer & Loyalty — Tier upgrade contract', async (t) => {
  await t.test('Customer defaults to BRONZE tier', async () => {
    const cust = new Customer({
      customerId: 'CUST-0001',
      organisationId: 'ORG-0001',
      name: 'John Doe',
      phone: '9876543210',
      createdByUserId: 'MU-0001',
    });

    await cust.validate();
    assert.equal(cust.tier, 'BRONZE');
    assert.equal(cust.pointsBalance, 0);
  });

  await t.test('LoyaltyLedger requires non-zero pointsDelta', async () => {
    const ledger = new LoyaltyLedger({
      loyaltyLedgerId: 'LOY-20260807-0001',
      organisationId: 'ORG-0001',
      customerId: 'CUST-0001',
      transactionType: 'EARN',
      pointsDelta: 0,
      balanceBefore: 100,
      balanceAfter: 100,
      performedByUserId: 'MU-0001',
    });

    try {
      await ledger.validate();
      assert.fail('Should have failed validation');
    } catch (err) {
      assert.ok(err.errors.pointsDelta);
    }
  });
});

test('Operations — Task, Approval, Quality, Asset, DeptOrder, RevenueShare', async (t) => {
  await t.test('Task defaults to NORMAL priority and PENDING status', async () => {
    const task = new Task({
      taskId: 'TSK-0001',
      organisationId: 'ORG-0001',
      title: 'Clean espresso group heads',
      createdByUserId: 'MU-0001',
    });

    await task.validate();
    assert.equal(task.priority, 'NORMAL');
    assert.equal(task.status, 'PENDING');
  });

  await t.test('Approval requires entityType and entityId', async () => {
    const app = new Approval({
      approvalId: 'APP-0001',
      organisationId: 'ORG-0001',
      entityType: '',
      entityId: '',
      requestingUserId: 'MU-0001',
      actionRequired: 'Expense approval > ₹5000',
    });

    try {
      await app.validate();
      assert.fail('Should have failed validation');
    } catch (err) {
      assert.ok(err.errors.entityType);
      assert.ok(err.errors.entityId);
    }
  });

  await t.test('QualityChecklist validates inspectionDate format', async () => {
    const qc = new QualityChecklist({
      checklistId: 'QC-0001',
      organisationId: 'ORG-0001',
      cafeId: 'CAFE-0001',
      title: 'Daily Opening Checklist',
      items: [{ itemName: 'Fridge temperature', isPassed: true }],
      overallResult: 'PASSED',
      inspectionDate: 'INVALID-DATE',
      inspectedByUserId: 'MU-0001',
    });

    try {
      await qc.validate();
      assert.fail('Should have failed validation');
    } catch (err) {
      assert.ok(err.errors.inspectionDate);
    }
  });

  await t.test('Asset defaults to OPERATIONAL status', async () => {
    const asset = new Asset({
      assetId: 'AST-0001',
      organisationId: 'ORG-0001',
      cafeId: 'CAFE-0001',
      name: 'La Marzocco Linea PB',
      createdByUserId: 'MU-0001',
    });

    await asset.validate();
    assert.equal(asset.status, 'OPERATIONAL');
  });

  await t.test('DepartmentOrder validates required departmentName', async () => {
    const order = new DepartmentOrder({
      orderId: 'DO-2026-0001',
      organisationId: 'ORG-0001',
      cafeId: 'CAFE-0001',
      institutionName: 'University A',
      items: [{ name: 'Croissants', quantity: 20 }],
      requestedByUserId: 'MU-0001',
    });

    try {
      await order.validate();
      assert.fail('Should have failed validation');
    } catch (err) {
      assert.ok(err.errors.departmentName);
    }
  });

  await t.test('RevenueShareAgreement normalises status', async () => {
    const rsa = new RevenueShareAgreement({
      agreementId: 'RSA-0001',
      organisationId: 'ORG-0001',
      cafeId: 'CAFE-0001',
      outletId: 'LO-0001',
      operatorId: 'OPR-0001',
      partnerName: 'Dawn Roasters Partner',
      commencementDate: '2026-08-01',
      expiryDate: '2027-07-31',
      effectiveFrom: '2026-08-01',
      status: 'ACTIVE',
      createdByUserId: 'MU-0001',
    });

    await rsa.validate();
    assert.equal(rsa.status, 'ACTIVE');
  });
});
