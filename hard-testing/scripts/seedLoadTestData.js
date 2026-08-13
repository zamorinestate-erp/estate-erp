'use strict';

/**
 * SYNTHETIC LOAD-TEST DATA GENERATOR & RESET PROCEDURE
 * 
 * Safety: Requires LOAD_TEST_ENV === 'true' or NODE_ENV === 'test'.
 * Will NEVER execute against production databases without explicit opt-in.
 */

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const { User } = require('../../backend/src/models/User');
const { Cafe } = require('../../backend/src/models/Cafe');
const { Session } = require('../../backend/src/models/Session');
const { AttendanceLog } = require('../../backend/src/models/AttendanceLog');

const ORG_ID = 'LOADTEST_ORG';
const PASSWORD_PLAIN = 'LoadTestPass123!';

async function assertSafetyGuard() {
  const isTestEnv =
    process.env.LOAD_TEST_ENV === 'true' ||
    process.env.NODE_ENV === 'test';

  if (!isTestEnv) {
    throw new Error(
      'SAFETY VIOLATION: seedLoadTestData.js requires LOAD_TEST_ENV=true or NODE_ENV=test.'
    );
  }
}

async function resetLoadTestData() {
  await assertSafetyGuard();

  console.log(`[RESET] Purging synthetic load test data for org ${ORG_ID}...`);
  await User.deleteMany({ organisationId: ORG_ID });
  await Cafe.deleteMany({ organisationId: ORG_ID });
  await Session.deleteMany({ organisationId: ORG_ID });
  await AttendanceLog.deleteMany({ organisationId: ORG_ID });
  console.log(`[RESET] Synthetic load test data reset complete.`);
}

async function seedLoadTestData() {
  await assertSafetyGuard();

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
        $setOnInsert: {
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
    { userId: 'MU-LOAD-0001', organisationId: ORG_ID },
    {
      $setOnInsert: {
        userId: 'MU-LOAD-0001',
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
      },
    },
    { upsert: true }
  );

  // 3. Create 4 Additional MASTER Users
  for (let i = 2; i <= 5; i++) {
    const userId = `MU-LOAD-${String(i).padStart(4, '0')}`;
    await User.updateOne(
      { userId, organisationId: ORG_ID },
      {
        $setOnInsert: {
          userId,
          organisationId: ORG_ID,
          name: `Master LoadTest #${i}`,
          email: `master${i}@loadtest.internal`,
          role: 'MASTER',
          accountStatus: 'ACTIVE',
          passwordHash,
        },
      },
      { upsert: true }
    );
  }

  // 4. Create 2 OWNER Users
  for (let i = 1; i <= 2; i++) {
    const userId = `OW-LOAD-${String(i).padStart(4, '0')}`;
    await User.updateOne(
      { userId, organisationId: ORG_ID },
      {
        $setOnInsert: {
          userId,
          organisationId: ORG_ID,
          name: `Owner LoadTest #${i}`,
          email: `owner${i}@loadtest.internal`,
          role: 'OWNER',
          accountStatus: 'ACTIVE',
          passwordHash,
        },
      },
      { upsert: true }
    );
  }

  // 5. Create 50 CAFE_ADMIN Users (5 per Cafe)
  for (let i = 1; i <= 50; i++) {
    const userId = `CA-LOAD-${String(i).padStart(4, '0')}`;
    const assignedCafe = cafeIds[(i - 1) % 10];

    await User.updateOne(
      { userId, organisationId: ORG_ID },
      {
        $setOnInsert: {
          userId,
          organisationId: ORG_ID,
          name: `Cafe Admin #${i}`,
          email: `admin${i}@loadtest.internal`,
          role: 'CAFE_ADMIN',
          accountStatus: 'ACTIVE',
          primaryCafeId: assignedCafe,
          assignedCafeIds: [assignedCafe],
          passwordHash,
        },
      },
      { upsert: true }
    );
  }

  // 6. Create 1,000 STAFF Users (100 per Cafe)
  const staffOps = [];
  for (let i = 1; i <= 1000; i++) {
    const userId = `ST-LOAD-${String(i).padStart(4, '0')}`;
    const assignedCafe = cafeIds[(i - 1) % 10];

    staffOps.push({
      updateOne: {
        filter: { userId, organisationId: ORG_ID },
        update: {
          $setOnInsert: {
            userId,
            organisationId: ORG_ID,
            name: `Staff Member #${i}`,
            email: `staff${i}@loadtest.internal`,
            role: 'STAFF',
            accountStatus: 'ACTIVE',
            primaryCafeId: assignedCafe,
            assignedCafeIds: [assignedCafe],
            permanentEmployeeId: `EMP-LOAD-${String(i).padStart(4, '0')}`,
            passwordHash,
          },
        },
        upsert: true,
      },
    });
  }

  await User.bulkWrite(staffOps);

  console.log(`[SEED] Seeded: 1 Primary Master, 4 Masters, 2 Owners, 50 Cafe Admins, 1,000 Staff across 10 Cafes.`);
}

module.exports = {
  resetLoadTestData,
  seedLoadTestData,
};
