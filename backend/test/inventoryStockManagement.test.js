'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');

const { createApp } = require('../src/server');
const { GlobalInventoryItem } = require('../src/models/GlobalInventoryItem');
const { CafeInventoryConfig } = require('../src/models/CafeInventoryConfig');
const { StockMovement } = require('../src/models/StockMovement');
const { InventoryLot } = require('../src/models/InventoryLot');
const { StockTransfer } = require('../src/models/StockTransfer');
const { InventoryCycleCount } = require('../src/models/InventoryCycleCount');
const { RecallNotice } = require('../src/models/RecallNotice');
const { WastageRecord } = require('../src/models/WastageRecord');
const { InventoryReservation } = require('../src/models/InventoryReservation');
const { Cafe } = require('../src/models/Cafe');
const { User } = require('../src/models/User');
const { RolePermission } = require('../src/models/RolePermission');
const authService = require('../src/services/authService');

function makeRequest({ port, method, path, headers = {}, body = null }) {
  return new Promise((resolve, reject) => {
    const serializedBody = body ? JSON.stringify(body) : null;
    const reqHeaders = { ...headers };
    if (serializedBody) {
      reqHeaders['Content-Type'] = 'application/json';
      reqHeaders['Content-Length'] = Buffer.byteLength(serializedBody);
    }

    const req = http.request(
      {
        hostname: '127.0.0.1',
        port,
        method,
        path,
        headers: reqHeaders,
      },
      (res) => {
        let responseData = '';
        res.on('data', (chunk) => {
          responseData += chunk;
        });
        res.on('end', () => {
          let parsedJson = null;
          try {
            parsedJson = responseData ? JSON.parse(responseData) : null;
          } catch (e) {
            parsedJson = responseData;
          }
          resolve({
            statusCode: res.statusCode,
            headers: res.headers,
            body: parsedJson,
          });
        });
      }
    );

    req.on('error', reject);
    if (serializedBody) {
      req.write(serializedBody);
    }
    req.end();
  });
}

function createQueryWrapper(resolvedValue) {
  const query = {
    select() { return query; },
    sort() { return query; },
    skip() { return query; },
    limit() { return query; },
    lean() { return Promise.resolve(resolvedValue); },
    then(onFulfilled, onRejected) {
      return Promise.resolve(resolvedValue).then(onFulfilled, onRejected);
    },
  };
  return query;
}

test('SCR-011: Multi-Café Inventory & Stock Control Integration Suite', async (t) => {
  const app = createApp({ allowedOrigins: ['*'], production: false });
  const server = http.createServer(app);

  await new Promise((resolve) => {
    server.listen(0, '127.0.0.1', resolve);
  });

  const port = server.address().port;

  t.after(async () => {
    await new Promise((resolve) => server.close(resolve));
  });

  const masterUser = {
    userId: 'USR-MASTER-01',
    organisationId: 'ORG-ZAMORIN',
    role: 'MASTER',
    isPrimaryMaster: true,
    email: 'master@zamorin.com',
    fullName: 'Master User',
    sessionVersion: 1,
    permissionsVersion: 1,
    assignedCafeIds: ['ZC-0001', 'ZC-0002'],
    accountStatus: 'ACTIVE',
    save: async function () { return this; },
  };

  const cafeAdminKora = {
    userId: 'USR-ADMIN-KORA',
    organisationId: 'ORG-ZAMORIN',
    role: 'CAFE_ADMIN',
    email: 'admin.kora@zamorin.com',
    fullName: 'Koramangala Admin',
    sessionVersion: 1,
    permissionsVersion: 1,
    assignedCafeIds: ['ZC-0001'],
    accountStatus: 'ACTIVE',
    save: async function () { return this; },
  };

  const staffUser = {
    userId: 'USR-STAFF-01',
    organisationId: 'ORG-ZAMORIN',
    role: 'STAFF',
    email: 'staff@zamorin.com',
    fullName: 'Staff User',
    sessionVersion: 1,
    permissionsVersion: 1,
    assignedCafeIds: ['ZC-0001'],
    accountStatus: 'ACTIVE',
    save: async function () { return this; },
  };

  // In-memory data collections
  const inMemoryGlobalItems = [
    {
      organisationId: 'ORG-ZAMORIN',
      itemId: 'ITEM-1001',
      sku: 'CB-ARA-01',
      name: 'Arabica Whole Beans',
      category: 'COFFEE_BEANS',
      baseUnit: 'kg',
      criticality: 'CRITICAL',
      unitCostPaisa: 85000,
      shelfLifeDays: 90,
      status: 'ACTIVE',
      save: async function () { return this; },
    },
  ];

  const inMemoryCafeConfigs = [
    {
      organisationId: 'ORG-ZAMORIN',
      cafeId: 'ZC-0001',
      itemId: 'ITEM-1001',
      currentQuantityBase: 45,
      availableQuantityBase: 45,
      reservedQuantityBase: 0,
      quarantinedQuantityBase: 0,
      expiredQuantityBase: 0,
      inTransitQuantityBase: 0,
      minQuantityBase: 20,
      parQuantityBase: 50,
      maxQuantityBase: 100,
      stockedHere: true,
      primaryLocation: 'Main Store',
      status: 'ACTIVE',
      save: async function () { return this; },
    },
    {
      organisationId: 'ORG-ZAMORIN',
      cafeId: 'ZC-0002',
      itemId: 'ITEM-1001',
      currentQuantityBase: 0,
      availableQuantityBase: 0,
      reservedQuantityBase: 0,
      quarantinedQuantityBase: 0,
      expiredQuantityBase: 0,
      inTransitQuantityBase: 0,
      minQuantityBase: 20,
      parQuantityBase: 50,
      maxQuantityBase: 100,
      stockedHere: true,
      primaryLocation: 'Main Store',
      status: 'ACTIVE',
      save: async function () { return this; },
    },
  ];

  const inMemoryMovements = [];
  const inMemoryLots = [
    {
      organisationId: 'ORG-ZAMORIN',
      lotId: 'LOT-ZC0001-01',
      supplierLot: 'SUP-LOT-881',
      itemId: 'ITEM-1001',
      cafeId: 'ZC-0001',
      expiryDate: '2026-12-31',
      quantityBase: 45,
      status: 'AVAILABLE',
      save: async function () { return this; },
    },
  ];

  const inMemoryTransfers = [];
  const inMemoryRecalls = [];
  const inMemoryCounts = [];
  const inMemoryWastage = [];

  t.mock.method(authService, 'verifyAccessToken', async (token) => {
    let activeUser = masterUser;
    if (token === 'token_kora_admin') activeUser = cafeAdminKora;
    if (token === 'token_staff') activeUser = staffUser;
    return {
      payload: {
        sub: activeUser.userId,
        org: activeUser.organisationId,
        role: activeUser.role,
        isPrimaryMaster: activeUser.isPrimaryMaster,
        sv: 0,
        usv: 1,
        pv: 1,
        sid: 'SS-INV-TEST',
      },
      session: {
        sessionId: 'SS-INV-TEST',
        roleSnapshot: activeUser.role,
        sessionVersion: 0,
        mfaVerified: true,
        stepUpVerifiedAt: new Date().toISOString(),
      },
    };
  });

  t.mock.method(User, 'findOne', async (query) => {
    if (query?.userId === 'USR-MASTER-01') return masterUser;
    if (query?.userId === 'USR-ADMIN-KORA') return cafeAdminKora;
    if (query?.userId === 'USR-STAFF-01') return staffUser;
    return null;
  });

  t.mock.method(RolePermission, 'find', () => {
    return createQueryWrapper([
      { role: 'MASTER', permissionCode: 'INVENTORY_READ', effect: 'ALLOW', scope: 'ORGANISATION', isCurrentlyEffective: () => true },
      { role: 'MASTER', permissionCode: 'INVENTORY_WRITE', effect: 'ALLOW', scope: 'ORGANISATION', isCurrentlyEffective: () => true },
      { role: 'MASTER', permissionCode: 'INVENTORY_ADMIN', effect: 'ALLOW', scope: 'ORGANISATION', isCurrentlyEffective: () => true },
      { role: 'CAFE_ADMIN', permissionCode: 'INVENTORY_READ', effect: 'ALLOW', scope: 'ASSIGNED_CAFES', isCurrentlyEffective: () => true },
      { role: 'CAFE_ADMIN', permissionCode: 'INVENTORY_WRITE', effect: 'ALLOW', scope: 'ASSIGNED_CAFES', isCurrentlyEffective: () => true },
    ]);
  });

  t.mock.method(Cafe, 'find', () => {
    return createQueryWrapper([
      { cafeId: 'ZC-0001', name: 'Koramangala Flagship', status: 'ACTIVE' },
      { cafeId: 'ZC-0002', name: 'Indiranagar Roastery', status: 'ACTIVE' },
    ]);
  });

  // Mock GlobalInventoryItem
  t.mock.method(GlobalInventoryItem, 'find', (query) => {
    let list = inMemoryGlobalItems;
    if (query?.status) list = list.filter((i) => i.status === query.status);
    return createQueryWrapper(list);
  });

  t.mock.method(GlobalInventoryItem, 'findOne', async (query) => {
    if (query?.sku) return inMemoryGlobalItems.find((i) => i.sku === query.sku) || null;
    if (query?.itemId) return inMemoryGlobalItems.find((i) => i.itemId === query.itemId) || null;
    return null;
  });

  t.mock.method(GlobalInventoryItem, 'create', async (doc) => {
    const item = { ...doc, save: async function () { return this; } };
    inMemoryGlobalItems.push(item);
    return item;
  });

  // Mock CafeInventoryConfig
  t.mock.method(CafeInventoryConfig, 'find', (query) => {
    let list = inMemoryCafeConfigs;
    if (query?.cafeId) list = list.filter((c) => c.cafeId === query.cafeId);
    if (query?.itemId) list = list.filter((c) => c.itemId === query.itemId);
    return createQueryWrapper(list);
  });

  t.mock.method(CafeInventoryConfig, 'findOne', async (query) => {
    return inMemoryCafeConfigs.find((c) => c.cafeId === query.cafeId && c.itemId === query.itemId) || null;
  });

  t.mock.method(CafeInventoryConfig, 'insertMany', async (docs) => {
    for (const d of docs) {
      inMemoryCafeConfigs.push({ ...d, save: async function () { return this; } });
    }
    return docs;
  });

  // Mock StockMovement
  t.mock.method(StockMovement, 'find', () => createQueryWrapper(inMemoryMovements));
  t.mock.method(StockMovement, 'countDocuments', async () => inMemoryMovements.length);
  t.mock.method(StockMovement, 'create', async (doc) => {
    inMemoryMovements.push(doc);
    return doc;
  });

  // Mock InventoryLot
  t.mock.method(InventoryLot, 'find', (query) => {
    let list = inMemoryLots;
    if (query?.itemId) list = list.filter((l) => l.itemId === query.itemId);
    if (query?.cafeId) list = list.filter((l) => l.cafeId === query.cafeId);
    if (query?.supplierLot) list = list.filter((l) => l.supplierLot === query.supplierLot);
    return createQueryWrapper(list);
  });
  t.mock.method(InventoryLot, 'countDocuments', async () => inMemoryLots.length);
  t.mock.method(InventoryLot, 'create', async (doc) => {
    const lot = { ...doc, save: async function () { return this; } };
    inMemoryLots.push(lot);
    return lot;
  });

  // Mock StockTransfer
  t.mock.method(StockTransfer, 'find', () => createQueryWrapper(inMemoryTransfers));
  t.mock.method(StockTransfer, 'findOne', async (query) => inMemoryTransfers.find((t) => t.transferId === query.transferId) || null);
  t.mock.method(StockTransfer, 'countDocuments', async () => inMemoryTransfers.length);
  t.mock.method(StockTransfer, 'create', async (doc) => {
    const trf = { ...doc, save: async function () { return this; } };
    inMemoryTransfers.push(trf);
    return trf;
  });

  // Mock InventoryCycleCount
  t.mock.method(InventoryCycleCount, 'find', () => createQueryWrapper(inMemoryCounts));
  t.mock.method(InventoryCycleCount, 'findOne', async (query) => inMemoryCounts.find((c) => c.countId === query.countId) || null);
  t.mock.method(InventoryCycleCount, 'countDocuments', async () => inMemoryCounts.length);
  t.mock.method(InventoryCycleCount, 'create', async (doc) => {
    const cnt = { ...doc, save: async function () { return this; } };
    inMemoryCounts.push(cnt);
    return cnt;
  });

  // Mock RecallNotice
  t.mock.method(RecallNotice, 'find', () => createQueryWrapper(inMemoryRecalls));
  t.mock.method(RecallNotice, 'countDocuments', async () => inMemoryRecalls.length);
  t.mock.method(RecallNotice, 'create', async (doc) => {
    const rcl = { ...doc, save: async function () { return this; } };
    inMemoryRecalls.push(rcl);
    return rcl;
  });

  // Mock WastageRecord
  t.mock.method(WastageRecord, 'find', () => createQueryWrapper(inMemoryWastage));
  t.mock.method(WastageRecord, 'countDocuments', async () => inMemoryWastage.length);
  t.mock.method(WastageRecord, 'create', async (doc) => {
    inMemoryWastage.push(doc);
    return doc;
  });

  // Mock InventoryReservation
  const inMemoryReservations = [];
  t.mock.method(InventoryReservation, 'find', () => createQueryWrapper(inMemoryReservations));
  t.mock.method(InventoryReservation, 'findOne', async (query) => inMemoryReservations.find((r) => r.reservationId === query.reservationId) || null);
  t.mock.method(InventoryReservation, 'countDocuments', async () => inMemoryReservations.length);
  t.mock.method(InventoryReservation, 'create', async (doc) => {
    const rsv = { ...doc, save: async function () { return this; } };
    inMemoryReservations.push(rsv);
    return rsv;
  });

  // ── TEST CASES ──────────────────────────────────────────────────────────────

  await t.test('1. Global Item Creation auto-provisions 0 quantity to all active cafés', async () => {
    const res = await makeRequest({
      port,
      method: 'POST',
      path: '/api/v1/inventory/items',
      headers: { Authorization: 'Bearer token_master' },
      body: {
        sku: 'DY-OAT-99',
        name: 'Oat Milk Barista Edition',
        category: 'DAIRY_FRESH',
        baseUnit: 'litre',
        unitCost: 280,
      },
    });

    assert.equal(res.statusCode, 201);
    assert.equal(res.body.item.sku, 'DY-OAT-99');

    // Check provisioned configs in memory
    const oatConfigs = inMemoryCafeConfigs.filter((c) => c.itemId === res.body.item.itemId);
    assert.equal(oatConfigs.length, 2);
    assert.equal(oatConfigs[0].currentQuantityBase, 0);
    assert.equal(oatConfigs[1].currentQuantityBase, 0);
  });

  await t.test('2. Duplicate SKU creation is rejected with 409 DUPLICATE_SKU', async () => {
    const res = await makeRequest({
      port,
      method: 'POST',
      path: '/api/v1/inventory/items',
      headers: { Authorization: 'Bearer token_master' },
      body: {
        sku: 'CB-ARA-01', // Already in memory
        name: 'Arabica Duplicate',
        category: 'COFFEE_BEANS',
        baseUnit: 'kg',
      },
    });

    assert.equal(res.statusCode, 409);
    assert.equal(res.body.error?.code || res.body.code, 'DUPLICATE_SKU');
  });

  await t.test('3. Stock Overview returns KPIs and Multi-Café Heatmap', async () => {
    const res = await makeRequest({
      port,
      method: 'GET',
      path: '/api/v1/inventory/overview',
      headers: { Authorization: 'Bearer token_master' },
    });

    assert.equal(res.statusCode, 200);
    assert.ok(res.body.kpis);
    assert.ok(Array.isArray(res.body.heatmap));
    assert.equal(res.body.kpis.totalActiveSkus, 2);
  });

  await t.test('4. Atomic stock movement deduction prevents negative inventory', async () => {
    const res = await makeRequest({
      port,
      method: 'POST',
      path: '/api/v1/inventory/movements',
      headers: { Authorization: 'Bearer token_kora_admin' },
      body: {
        cafeId: 'ZC-0001',
        itemId: 'ITEM-1001',
        movementType: 'CONSUMPTION',
        quantity: -60, // Current stock is 45
        reason: 'Over-consumption attempt',
      },
    });

    assert.equal(res.statusCode, 400);
    assert.equal(res.body.error?.code || res.body.code, 'NEGATIVE_STOCK_PREVENTED');
  });

  await t.test('5. Valid stock consumption reduces balance and logs ledger', async () => {
    const res = await makeRequest({
      port,
      method: 'POST',
      path: '/api/v1/inventory/movements',
      headers: { Authorization: 'Bearer token_kora_admin' },
      body: {
        cafeId: 'ZC-0001',
        itemId: 'ITEM-1001',
        movementType: 'CONSUMPTION',
        quantity: -5,
        reason: 'Barista shift consumption',
      },
    });

    assert.equal(res.statusCode, 201);
    assert.equal(res.body.currentStock, 40); // 45 - 5 = 40
  });

  let transferId = null;

  await t.test('6. Inter-Café Transfer Request and Dispatch', async () => {
    // Request 10 units transfer
    const reqRes = await makeRequest({
      port,
      method: 'POST',
      path: '/api/v1/inventory/transfers',
      headers: { Authorization: 'Bearer token_kora_admin' },
      body: {
        sourceCafeId: 'ZC-0001',
        destCafeId: 'ZC-0002',
        itemId: 'ITEM-1001',
        requestedQty: 10,
        reason: 'Indiranagar bean shortfall',
      },
    });

    assert.equal(reqRes.statusCode, 201);
    transferId = reqRes.body.transfer.transferId;

    // Dispatch
    const dispRes = await makeRequest({
      port,
      method: 'POST',
      path: `/api/v1/inventory/transfers/${transferId}/dispatch`,
      headers: { Authorization: 'Bearer token_master' },
      body: {},
    });

    assert.equal(dispRes.statusCode, 200);
    assert.equal(dispRes.body.transfer.status, 'IN_TRANSIT');

    // Source dropped from 40 to 30
    const srcCfg = inMemoryCafeConfigs.find((c) => c.cafeId === 'ZC-0001' && c.itemId === 'ITEM-1001');
    assert.equal(srcCfg.currentQuantityBase, 30);
  });

  await t.test('7. Inter-Café Transfer Receipt increases destination balance', async () => {
    const recRes = await makeRequest({
      port,
      method: 'POST',
      path: `/api/v1/inventory/transfers/${transferId}/receive`,
      headers: { Authorization: 'Bearer token_master' },
      body: { receivedQty: 10 },
    });

    assert.equal(recRes.statusCode, 200);
    assert.equal(recRes.body.transfer.status, 'COMPLETED');

    const destCfg = inMemoryCafeConfigs.find((c) => c.cafeId === 'ZC-0002' && c.itemId === 'ITEM-1001');
    assert.equal(destCfg.currentQuantityBase, 10);
  });

  await t.test('8. Reason-coded Wastage logs write-off and deducts balance', async () => {
    const res = await makeRequest({
      port,
      method: 'POST',
      path: '/api/v1/inventory/wastage',
      headers: { Authorization: 'Bearer token_kora_admin' },
      body: {
        cafeId: 'ZC-0001',
        itemId: 'ITEM-1001',
        quantity: 2,
        reasonCode: 'SPILLED',
        notes: 'Grinder jar accident',
      },
    });

    assert.equal(res.statusCode, 201);
    assert.equal(res.body.wastage.reasonCode, 'SPILLED');

    const cfg = inMemoryCafeConfigs.find((c) => c.cafeId === 'ZC-0001' && c.itemId === 'ITEM-1001');
    assert.equal(cfg.currentQuantityBase, 28); // 30 - 2 = 28
  });

  await t.test('9. Cycle Count submission and approval adjusts physical inventory', async () => {
    const submitRes = await makeRequest({
      port,
      method: 'POST',
      path: '/api/v1/inventory/counts',
      headers: { Authorization: 'Bearer token_kora_admin' },
      body: {
        cafeId: 'ZC-0001',
        countType: 'CYCLE_COUNT',
        items: [
          {
            itemId: 'ITEM-1001',
            systemQty: 28,
            countedQty: 27,
            reason: 'Bean calibration loss',
          },
        ],
      },
    });

    assert.equal(submitRes.statusCode, 201);
    const countId = submitRes.body.cycleCount.countId;

    const appRes = await makeRequest({
      port,
      method: 'POST',
      path: `/api/v1/inventory/counts/${countId}/approve`,
      headers: { Authorization: 'Bearer token_master' },
      body: {},
    });

    assert.equal(appRes.statusCode, 200);
    assert.equal(appRes.body.count.status, 'POSTED');

    const cfg = inMemoryCafeConfigs.find((c) => c.cafeId === 'ZC-0001' && c.itemId === 'ITEM-1001');
    assert.equal(cfg.currentQuantityBase, 27);
  });

  await t.test('10. Food Safety Recall broadcasts lockdown and quarantines matching lots', async () => {
    const res = await makeRequest({
      port,
      method: 'POST',
      path: '/api/v1/inventory/recalls',
      headers: { Authorization: 'Bearer token_master' },
      body: {
        itemId: 'ITEM-1001',
        supplierLot: 'SUP-LOT-881',
        reason: 'Vendor recall on packaging seal',
      },
    });

    assert.equal(res.statusCode, 201);
    assert.equal(res.body.recall.status, 'ACTIVE');

    const lot = inMemoryLots.find((l) => l.supplierLot === 'SUP-LOT-881');
    assert.equal(lot.status, 'RECALL_HOLD');
  });

  await t.test('11. Café Admin cross-café modification attempt is denied with 403', async () => {
    const res = await makeRequest({
      port,
      method: 'POST',
      path: '/api/v1/inventory/movements',
      headers: { Authorization: 'Bearer token_kora_admin' }, // Assigned only to ZC-0001
      body: {
        cafeId: 'ZC-0002', // Indiranagar
        itemId: 'ITEM-1001',
        movementType: 'CONSUMPTION',
        quantity: -1,
      },
    });

    assert.equal(res.statusCode, 403);
    assert.equal(res.body.error?.code || res.body.code, 'CAFE_ACCESS_DENIED');
  });

  await t.test('12. Inventory Integrity Audit evaluates 16 checks and flags health status', async () => {
    const res = await makeRequest({
      port,
      method: 'GET',
      path: '/api/v1/inventory/integrity',
      headers: { Authorization: 'Bearer token_master' },
    });

    assert.equal(res.statusCode, 200);
    assert.equal(res.body.checksEvaluated, 16);
    assert.ok(res.body.status);
  });

  let reservationId = null;

  await t.test('13. Inventory Reservation reduces Available stock without changing On Hand', async () => {
    const res = await makeRequest({
      port,
      method: 'POST',
      path: '/api/v1/inventory/reservations',
      headers: { Authorization: 'Bearer token_kora_admin' },
      body: {
        cafeId: 'ZC-0001',
        itemId: 'ITEM-1001',
        reservedQty: 5,
        reservationType: 'DEPARTMENT_ORDER',
        demandReferenceId: 'DO-2026-0001',
      },
    });

    assert.equal(res.statusCode, 201);
    reservationId = res.body.reservation.reservationId;

    const cfg = inMemoryCafeConfigs.find((c) => c.cafeId === 'ZC-0001' && c.itemId === 'ITEM-1001');
    assert.equal(cfg.currentQuantityBase, 27); // On hand unchanged
    assert.equal(cfg.reservedQuantityBase, 5); // Reserved is 5
    assert.equal(cfg.availableQuantityBase, 22); // Available drops from 27 to 22
  });

  await t.test('14. Releasing Reservation restores Available stock', async () => {
    const res = await makeRequest({
      port,
      method: 'POST',
      path: `/api/v1/inventory/reservations/${reservationId}/release`,
      headers: { Authorization: 'Bearer token_kora_admin' },
      body: {},
    });

    assert.equal(res.statusCode, 200);
    assert.equal(res.body.reservation.status, 'RELEASED');

    const cfg = inMemoryCafeConfigs.find((c) => c.cafeId === 'ZC-0001' && c.itemId === 'ITEM-1001');
    assert.equal(cfg.reservedQuantityBase, 0);
    assert.equal(cfg.availableQuantityBase, 27);
  });

  await t.test('15. Internal Location Transfer moves storage bin without changing café stock total', async () => {
    const res = await makeRequest({
      port,
      method: 'POST',
      path: '/api/v1/inventory/internal-transfers',
      headers: { Authorization: 'Bearer token_kora_admin' },
      body: {
        cafeId: 'ZC-0001',
        itemId: 'ITEM-1001',
        fromLocation: 'Main Store',
        toLocation: 'Bar Counter',
        quantity: 5,
        reason: 'Shift PAR replenishment',
      },
    });

    assert.equal(res.statusCode, 201);
    assert.equal(res.body.movement.movementType, 'INTERNAL_TRANSFER');
    assert.equal(res.body.movement.balanceAfterBase, 27); // Unchanged total
  });

  await t.test('16. Item 360 Drilldown returns 10 unified sections', async () => {
    const res = await makeRequest({
      port,
      method: 'GET',
      path: '/api/v1/inventory/items/ITEM-1001/360',
      headers: { Authorization: 'Bearer token_master' },
    });

    assert.equal(res.statusCode, 200);
    assert.ok(res.body.item);
    assert.ok(res.body.summary);
    assert.ok(Array.isArray(res.body.cafeConfigs));
    assert.ok(Array.isArray(res.body.recentMovements));
  });

  await t.test('17. Recipe Consumption Variance and Valuation Reports return accurate data', async () => {
    const varRes = await makeRequest({
      port,
      method: 'GET',
      path: '/api/v1/inventory/consumption/variance',
      headers: { Authorization: 'Bearer token_master' },
    });

    assert.equal(varRes.statusCode, 200);
    assert.ok(Array.isArray(varRes.body.varianceReport));

    const valRes = await makeRequest({
      port,
      method: 'GET',
      path: '/api/v1/inventory/reports/valuation',
      headers: { Authorization: 'Bearer token_master' },
    });

    assert.equal(valRes.statusCode, 200);
    assert.ok(valRes.body.totalValuePaisa !== undefined);
    assert.ok(Array.isArray(valRes.body.valuationRows));
  });
});
