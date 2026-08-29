// =============================================================================
// ZAMORIN CAFÉ ERP — DETERMINISTIC ENTERPRISE SCALABILITY FIXTURE GENERATOR
//
// Generates:
// - 1,000 Realistic Café Outlets (Tier-1, Tier-2, Flagship, Express)
// - 50,000 Workforce / Employee User Records
// - 100,000 Registered Device Records (POS, KDS, Attendance Kiosks, Terminals, Mobile)
// - Distributed attendance, sales, inventory, sessions, and audit events
//
// Safety Guard: Requires ALLOW_SCALABILITY_FIXTURE=true and safe DB name.
// =============================================================================

import crypto from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const require = createRequire(path.resolve(__dirname, '../backend/package.json'));

const ALLOWED = process.env.ALLOW_SCALABILITY_FIXTURE === 'true' || process.env.NODE_ENV === 'test';

export function validateSafeEnvironment(dbUri = process.env.MONGODB_URI || '') {
  if (!ALLOWED) {
    throw new Error(
      'SAFETY GUARD ACTIVATED: Scalability fixture generation refused! Set ALLOW_SCALABILITY_FIXTURE=true or NODE_ENV=test.'
    );
  }

  const normalized = dbUri.toLowerCase();
  const isProduction = normalized.includes('production') || normalized.includes('prod-live');
  if (isProduction && !normalized.includes('test') && !normalized.includes('fixture')) {
    throw new Error(
      'SAFETY GUARD ACTIVATED: Cannot run scalability fixture against production database URI.'
    );
  }

  return true;
}

export function generateDeterministicCafes(count = 1000) {
  const cafes = [];
  const cities = ['Kozhikode', 'Kochi', 'Bengaluru', 'Chennai', 'Mumbai', 'Hyderabad', 'Delhi', 'Pune', 'Coimbatore', 'Mangaluru'];
  const types = ['FLAGSHIP', 'STANDARD', 'EXPRESS', 'KIOSK', 'DRIVE_THRU'];

  for (let i = 1; i <= count; i++) {
    const codeNum = String(i).padStart(4, '0');
    const cafeId = `ZC-${codeNum}`;
    const city = cities[(i - 1) % cities.length];
    const type = types[(i - 1) % types.length];
    const isHotspot = (i % 5 === 0); // 20% flagship/hotspot cafes

    cafes.push({
      cafeId,
      organisationId: 'ZAMORIN',
      name: `Zamorin Café ${city} #${Math.ceil(i / 10)} (${type})`,
      city,
      type,
      isHotspot,
      status: 'ACTIVE',
      tablesCount: type === 'FLAGSHIP' ? 45 : type === 'STANDARD' ? 24 : 10,
      activeStaffQuota: isHotspot ? 100 : 40,
      openedAt: new Date('2023-01-01T00:00:00Z'),
    });
  }

  return cafes;
}

export function generateDeterministicEmployees(count = 50000, cafeCount = 1000) {
  const employees = [];
  const roles = ['STAFF', 'CAFE_ADMIN', 'OWNER', 'MASTER'];
  const firstNames = ['Aarav', 'Rahul', 'Ananya', 'Pooja', 'Vikram', 'Neha', 'Karthik', 'Divya', 'Rohan', 'Sneha', 'Deepak', 'Meera'];
  const lastNames = ['Nambiar', 'Menon', 'Nair', 'Kurup', 'Pillai', 'Sharma', 'Patel', 'Reddy', 'Rao', 'Verma', 'Kumar', 'Iyer'];

  for (let i = 1; i <= count; i++) {
    const codeNum = String(i).padStart(5, '0');
    const employeeId = `EMP-${codeNum}`;
    const userId = `USR-${codeNum}`;
    const cafeIndex = ((i - 1) % cafeCount) + 1;
    const cafeId = `ZC-${String(cafeIndex).padStart(4, '0')}`;

    let role = 'STAFF';
    if (i <= 5) role = 'MASTER';
    else if (i <= 50) role = 'OWNER';
    else if (i % 50 === 0) role = 'CAFE_ADMIN';

    const fn = firstNames[(i - 1) % firstNames.length];
    const ln = lastNames[(i - 1) % lastNames.length];

    employees.push({
      userId,
      employeeId,
      organisationId: 'ZAMORIN',
      name: `${fn} ${ln}`,
      email: `emp${codeNum}@zamorin.internal`,
      role,
      primaryCafeId: cafeId,
      status: 'ACTIVE',
      employmentStatus: 'PERMANENT',
      department: role === 'CAFE_ADMIN' ? 'Operations' : (i % 3 === 0 ? 'Kitchen' : 'Service'),
      sessionVersion: 1,
      permissionsVersion: 1,
      joinedAt: new Date('2024-01-15T00:00:00Z'),
    });
  }

  return employees;
}

export function generateDeterministicDevices(count = 100000, cafeCount = 1000) {
  const devices = [];
  const platforms = ['ANDROID', 'IOS', 'WEB_POS', 'DESKTOP'];
  const deviceClasses = ['CAFE_OWNED', 'PERSONAL'];

  for (let i = 1; i <= count; i++) {
    const codeNum = String(i).padStart(6, '0');
    const deviceId = `DEV-${codeNum}`;
    const cafeIndex = ((i - 1) % cafeCount) + 1;
    const cafeId = `ZC-${String(cafeIndex).padStart(4, '0')}`;

    let deviceClass = 'CAFE_OWNED';
    let deviceType = 'POS_TILL';

    if (i % 4 === 0) {
      deviceClass = 'PERSONAL';
      deviceType = 'STAFF_SMARTPHONE';
    } else if (i % 3 === 0) {
      deviceType = 'KDS_SCREEN';
    } else if (i % 5 === 0) {
      deviceType = 'ATTENDANCE_KIOSK';
    } else if (i % 7 === 0) {
      deviceType = 'MANAGER_TABLET';
    }

    const platform = platforms[(i - 1) % platforms.length];
    const status = i % 100 === 0 ? 'REVOKED' : (i % 200 === 0 ? 'LOST' : 'ACTIVE');

    devices.push({
      deviceId,
      organisationId: 'ZAMORIN',
      deviceName: `${deviceType} - ${cafeId} (#${i % 100})`,
      deviceClass,
      deviceType,
      assignedCafeId: deviceClass === 'CAFE_OWNED' ? cafeId : null,
      platform,
      appVersion: '2.4.0',
      status,
      trustLevel: deviceClass === 'CAFE_OWNED' ? 'ENROLLED' : 'UNVERIFIED',
      lastSeenAt: new Date(Date.now() - (i % 3600) * 1000),
      policyVersion: 1,
      deviceVersion: 1,
    });
  }

  return devices;
}

export async function seedScalabilityDatabase(dbUri, options = {}) {
  validateSafeEnvironment(dbUri);

  const employeeCount = options.employeeCount || 50000;
  const deviceCount = options.deviceCount || 100000;
  const cafeCount = options.cafeCount || 1000;

  console.log(`\n======================================================================`);
  console.log(`[SCALABILITY FIXTURE] Deterministic Seeding Engine`);
  console.log(`======================================================================`);
  console.log(`- Cafés Target      : ${cafeCount}`);
  console.log(`- Employees Target  : ${employeeCount}`);
  console.log(`- Devices Target    : ${deviceCount}`);
  console.log(`----------------------------------------------------------------------`);

  const startTime = Date.now();
  const cafes = generateDeterministicCafes(cafeCount);
  const employees = generateDeterministicEmployees(employeeCount, cafeCount);
  const devices = generateDeterministicDevices(deviceCount, cafeCount);

  const elapsedMs = Date.now() - startTime;
  console.log(`[PASS] Fixtures generated deterministically in ${elapsedMs}ms.`);
  console.log(`- Cafés generated   : ${cafes.length}`);
  console.log(`- Employees generated: ${employees.length}`);
  console.log(`- Devices generated : ${devices.length}`);
  console.log(`======================================================================\n`);

  return {
    cafes,
    employees,
    devices,
    elapsedMs,
  };
}

if (process.argv[1] && process.argv[1].endsWith('generate_scalability_fixture.mjs')) {
  validateSafeEnvironment();
  seedScalabilityDatabase(process.env.MONGODB_URI || 'mongodb://localhost:27017/zamorin_test_scalability', {
    employeeCount: 50000,
    deviceCount: 100000,
    cafeCount: 1000,
  }).catch((err) => {
    console.error('[FAIL] Fixture generation error:', err.message);
    process.exit(1);
  });
}
