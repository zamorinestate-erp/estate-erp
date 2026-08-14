const path = require('node:path');
module.paths.push(path.join(__dirname, '../../backend/node_modules'));

const mongoose = require('mongoose');
const bcrypt = require('bcrypt');

const { Cafe } = require('../../backend/src/models/Cafe');
const { User } = require('../../backend/src/models/User');
const { MenuItem } = require('../../backend/src/models/MenuItem');
const { Bill } = require('../../backend/src/models/Bill');
const { Expense } = require('../../backend/src/models/Expense');
const { CashTransaction } = require('../../backend/src/models/CashTransaction');
const { AuditEvent } = require('../../backend/src/models/AuditEvent');
const { RolePermission } = require('../../backend/src/models/RolePermission');
const { Attendance } = require('../../backend/src/modules/attendance/Attendance');
const { Session } = require('../../backend/src/models/Session');
const { SequenceCounter } = require('../../backend/src/models/SequenceCounter');
const { seedPermissionRules } = require('../../backend/src/scripts/seedInitialData');

const ORG_ID = 'LOADTEST_ORG';
const PASSWORD_PLAIN = 'LoadTestPass123!';

function assertSafetyGuard() {
  if (process.env.NODE_ENV === 'production' && process.env.LOAD_TEST_ENV !== 'true') {
    throw new Error('SAFETY VIOLATION: seedLoadTestData.js cannot run in production without LOAD_TEST_ENV=true.');
  }
}

async function resetLoadTestData() {
  assertSafetyGuard();
  console.log(`[RESET] Purging synthetic load test data for org ${ORG_ID}...`);

  await Cafe.deleteMany({ organisationId: ORG_ID });
  await User.deleteMany({ organisationId: ORG_ID });
  await MenuItem.deleteMany({ organisationId: ORG_ID });
  await Bill.deleteMany({ organisationId: ORG_ID });
  await Expense.deleteMany({ organisationId: ORG_ID });
  await CashTransaction.deleteMany({ organisationId: ORG_ID });
  await AuditEvent.collection.deleteMany({ organisationId: ORG_ID });
  await RolePermission.deleteMany({ organisationId: ORG_ID });
  await Attendance.deleteMany({ organisationId: ORG_ID });
  await Session.deleteMany({ organisationId: ORG_ID });
  await SequenceCounter.deleteMany({ organisationId: ORG_ID });

  console.log(`[RESET] Synthetic load test data reset complete.`);
}

async function seedLoadTestData() {
  await assertSafetyGuard();
  await resetLoadTestData();

  console.log(`[SEED] Seeding synthetic load test dataset for ${ORG_ID}...`);

  const passwordHash = await bcrypt.hash(PASSWORD_PLAIN, 12);

  // 1. Create 10 Synthetic Cafés
  const cafeIds = [];
  for (let i = 1; i <= 10; i++) {
    const cafeId = `CF-LOAD-${String(i).padStart(4, '0')}`;
    cafeIds.push(cafeId);

    await Cafe.updateOne(
      { cafeId, organisationId: ORG_ID },
      {
        $set: {
          cafeId,
          organisationId: ORG_ID,
          name: `Synthetic Cafe #${i}`,
          code: `SC${i}`,
          status: 'ACTIVE',
          address: { city: 'Kozhikode', state: 'Kerala', country: 'India' },
        },
      },
      { upsert: true }
    );
  }

  // 2. Create 1 Primary Master
  await User.updateOne(
    { userId: 'MU-9001', organisationId: ORG_ID },
    {
      $set: {
        userId: 'MU-9001',
        organisationId: ORG_ID,
        name: 'Primary Master LoadTest',
        email: 'primary.master@loadtest.internal',
        role: 'MASTER',
        accountStatus: 'ACTIVE',
        isPrimaryMaster: true,
        primaryMasterDesignatedAt: new Date(),
        primaryMasterDesignatedBy: 'SYSTEM',
        primaryMasterDesignationReason: 'Synthetic Load Test Seed',
        passwordHash,
        mustChangePassword: false,
        createdBy: 'SYSTEM',
      },
    },
    { upsert: true }
  );

  // 3. Create 9 Additional MASTER Users
  for (let i = 2; i <= 10; i++) {
    const userId = `MU-${String(9000 + i)}`;
    await User.updateOne(
      { userId, organisationId: ORG_ID },
      {
        $set: {
          userId,
          organisationId: ORG_ID,
          name: `Master LoadTest #${i}`,
          email: `master${i}@loadtest.internal`,
          role: 'MASTER',
          accountStatus: 'ACTIVE',
          passwordHash,
          mustChangePassword: false,
          createdBy: 'SYSTEM',
        },
      },
      { upsert: true }
    );
  }

  // 4. Create 5 OWNER Users
  for (let i = 1; i <= 5; i++) {
    const userId = `OW-${String(9000 + i)}`;
    await User.updateOne(
      { userId, organisationId: ORG_ID },
      {
        $set: {
          userId,
          organisationId: ORG_ID,
          name: `Owner LoadTest #${i}`,
          email: `owner${i}@loadtest.internal`,
          role: 'OWNER',
          accountStatus: 'ACTIVE',
          passwordHash,
          mustChangePassword: false,
          createdBy: 'SYSTEM',
        },
      },
      { upsert: true }
    );
  }

  // 5. Create 200 CAFE_ADMIN Users (20 per Cafe)
  const adminOps = [];
  for (let i = 1; i <= 200; i++) {
    const userId = `AD-${String(9000 + i)}`;
    const assignedCafe = cafeIds[(i - 1) % 10];

    adminOps.push({
      updateOne: {
        filter: { userId, organisationId: ORG_ID },
        update: {
          $set: {
            userId,
            organisationId: ORG_ID,
            name: `Cafe Admin #${i}`,
            email: `admin${i}@loadtest.internal`,
            role: 'CAFE_ADMIN',
            accountStatus: 'ACTIVE',
            primaryCafeId: assignedCafe,
            assignedCafeIds: [assignedCafe],
            passwordHash,
            mustChangePassword: false,
            createdBy: 'SYSTEM',
          },
        },
        upsert: true,
      },
    });
  }
  await User.bulkWrite(adminOps);

  // 6. Create 2,500 STAFF Users (250 per Cafe)
  const staffOps = [];
  for (let i = 1; i <= 2500; i++) {
    const userId = `ST-${String(1000 + i)}`;
    const assignedCafe = cafeIds[(i - 1) % 10];

    staffOps.push({
      updateOne: {
        filter: { userId, organisationId: ORG_ID },
        update: {
          $set: {
            userId,
            organisationId: ORG_ID,
            name: `Staff Member #${i}`,
            email: `staff${i}@loadtest.internal`,
            role: 'STAFF',
            accountStatus: 'ACTIVE',
            primaryCafeId: assignedCafe,
            assignedCafeIds: [assignedCafe],
            permanentEmployeeId: `EMP-${String(1000 + i)}`,
            passwordHash,
            mustChangePassword: false,
            createdBy: 'SYSTEM',
          },
        },
        upsert: true,
      },
    });
  }

  await User.bulkWrite(staffOps);

  // 7. Create 20 Synthetic Menu Items
  const menuItems = [
    { menuItemId: 'MENU-0001', name: 'Espresso', category: 'COFFEE', currentPricePaisa: 12000 },
    { menuItemId: 'MENU-0002', name: 'Cappuccino', category: 'COFFEE', currentPricePaisa: 16000 },
    { menuItemId: 'MENU-0003', name: 'Cafe Latte', category: 'COFFEE', currentPricePaisa: 18000 },
    { menuItemId: 'MENU-0004', name: 'Cold Brew', category: 'COFFEE', currentPricePaisa: 20000 },
    { menuItemId: 'MENU-0005', name: 'Malabar Filter Coffee', category: 'COFFEE', currentPricePaisa: 9000 },
    { menuItemId: 'MENU-0006', name: 'Masala Chai', category: 'TEA', currentPricePaisa: 6000 },
    { menuItemId: 'MENU-0007', name: 'Earl Grey Tea', category: 'TEA', currentPricePaisa: 11000 },
    { menuItemId: 'MENU-0008', name: 'Green Tea', category: 'TEA', currentPricePaisa: 10000 },
    { menuItemId: 'MENU-0009', name: 'Butter Croissant', category: 'BAKERY', currentPricePaisa: 15000 },
    { menuItemId: 'MENU-0010', name: 'Pain au Chocolat', category: 'BAKERY', currentPricePaisa: 18000 },
    { menuItemId: 'MENU-0011', name: 'Cinnamon Roll', category: 'BAKERY', currentPricePaisa: 14000 },
    { menuItemId: 'MENU-0012', name: 'Banana Bread Slice', category: 'BAKERY', currentPricePaisa: 11000 },
    { menuItemId: 'MENU-0013', name: 'Veg Club Sandwich', category: 'SNACKS', currentPricePaisa: 22000 },
    { menuItemId: 'MENU-0014', name: 'Chicken Tikka Sandwich', category: 'SNACKS', currentPricePaisa: 26000 },
    { menuItemId: 'MENU-0015', name: 'Paneer Tikka Wrap', category: 'SNACKS', currentPricePaisa: 23000 },
    { menuItemId: 'MENU-0016', name: 'Kerala Parotta Combo', category: 'MAIN_COURSE', currentPricePaisa: 28000 },
    { menuItemId: 'MENU-0017', name: 'Ghee Roast Dosa Platter', category: 'MAIN_COURSE', currentPricePaisa: 24000 },
    { menuItemId: 'MENU-0018', name: 'Zamorin Special Biryani', category: 'MAIN_COURSE', currentPricePaisa: 35000 },
    { menuItemId: 'MENU-0019', name: 'Tiramisu', category: 'DESSERTS', currentPricePaisa: 22000 },
    { menuItemId: 'MENU-0020', name: 'Chocolate Lava Cake', category: 'DESSERTS', currentPricePaisa: 21000 },
  ];

  const menuOps = menuItems.map((item) => ({
    updateOne: {
      filter: { menuItemId: item.menuItemId, organisationId: ORG_ID },
      update: {
        $set: {
          menuItemId: item.menuItemId,
          organisationId: ORG_ID,
          name: item.name,
          nameLower: item.name.toLowerCase(),
          category: item.category,
          currentPricePaisa: item.currentPricePaisa,
          taxRatePercent: 5,
          isTaxInclusive: true,
          availableCafeIds: [],
          status: 'ACTIVE',
          createdBy: 'SYSTEM',
        },
      },
      upsert: true,
    },
  }));

  await MenuItem.bulkWrite(menuOps);

  // 8. Seed Role Permissions for LOADTEST_ORG
  await seedPermissionRules({ organisationId: ORG_ID, masterUserId: 'MU-9001' });

  console.log(`[SEED] Seeded: 1 Primary Master, 4 Masters, 2 Owners, 50 Cafe Admins, 1,000 Staff across 10 Cafes, 20 Menu Items, and Role Permissions.`);
}

module.exports = {
  resetLoadTestData,
  seedLoadTestData,
};
