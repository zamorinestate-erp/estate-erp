'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

const {
  MAX_EMPLOYEE_SEARCH_TERMS,
  normalizeSearchText,
  normalizePreviousNames,
  buildEmployeeSearchTerms,
  buildEmployeeSearchQueryTerm,
  buildEmployeeScopeFilter,
  buildEmployeeSearchResult,
  buildEmployeeProfile,
} = require('../src/services/employeeReadService');

function auth(role, overrides = {}) {
  return {
    userId:
      role === 'MASTER'
        ? 'MU-0001'
        : role === 'OWNER'
          ? 'OW-0001'
          : role === 'CAFE_ADMIN'
            ? 'AD-0001'
            : 'ST-0001',
    organisationId: 'ORG-TEST',
    role,
    assignedCafeIds:
      role === 'CAFE_ADMIN'
        ? ['ZC-0001', 'ZC-0002']
        : [],
    ...overrides,
  };
}

function employee(overrides = {}) {
  return {
    userId: 'ST-0001',
    organisationId: 'ORG-TEST',
    name: 'Priya Nair',
    preferredName: 'Pri',
    previousNames: ['Priya Menon'],
    role: 'STAFF',
    accountStatus: 'ACTIVE',
    isPrimaryMaster: false,
    primaryCafeId: 'ZC-0001',
    assignedCafeIds: ['ZC-0001'],
    joiningDate: new Date('2026-01-15T00:00:00.000Z'),
    employmentType: 'FULL_TIME',
    department: 'Operations',
    designation: 'Barista',
    email: 'priya@example.com',
    phone: '+919999999999',
    address: {
      line1: '12 Main Road',
      line2: '',
      city: 'Bengaluru',
      state: 'Karnataka',
      postalCode: '560001',
      country: 'India',
    },
    emergencyContact: {
      name: 'Anil Nair',
      relationship: 'Parent',
      phone: '+919876543210',
    },
    roleHistory: [
      {
        fromRole: null,
        toRole: 'STAFF',
        changedAt: new Date('2026-01-01T00:00:00.000Z'),
        changedBy: 'MU-0001',
        reason: 'Joined',
        correlationId: null,
        sessionId: 'SECRET-SESSION',
      },
    ],
    cafeAssignmentHistory: [
      {
        previousAssignedCafeIds: [],
        assignedCafeIds: ['ZC-0001'],
        previousPrimaryCafeId: null,
        primaryCafeId: 'ZC-0001',
        changedAt: new Date('2026-01-01T00:00:00.000Z'),
        changedBy: 'MU-0001',
        reason: 'Initial assignment',
        correlationId: null,
        sessionId: 'SECRET-SESSION',
      },
    ],
    archivedAt: null,
    archivedBy: null,
    archiveReason: null,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-08-01T00:00:00.000Z'),
    passwordHash: 'SECRET',
    passwordHistoryHashes: ['SECRET'],
    mfaSecretEncrypted: 'SECRET',
    recoveryCodeHashes: ['SECRET'],
    failedLoginAttempts: 4,
    lockedUntil: new Date(),
    lastLoginAt: new Date(),
    lastPasswordResetAt: new Date(),
    passwordChangedAt: new Date(),
    passwordExpiresAt: new Date(),
    sessionVersion: 8,
    permissionsVersion: 9,
    mustChangePassword: true,
    employeeSearchTerms: ['priya'],
    ...overrides,
  };
}

function allKeys(value, result = new Set()) {
  if (!value || typeof value !== 'object') {
    return result;
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      allKeys(item, result);
    }
    return result;
  }

  for (const [key, nestedValue] of Object.entries(value)) {
    result.add(key);
    allKeys(nestedValue, result);
  }

  return result;
}

function assertNoSecurityFields(value) {
  const keys = allKeys(value);
  const forbidden = [
    'passwordHash',
    'passwordHistoryHashes',
    'mfaSecretEncrypted',
    'recoveryCodeHashes',
    'failedLoginAttempts',
    'lockedUntil',
    'lastLoginAt',
    'lastPasswordResetAt',
    'passwordChangedAt',
    'passwordExpiresAt',
    'sessionVersion',
    'permissionsVersion',
    'mustChangePassword',
    'employeeSearchTerms',
    'sessionId',
  ];

  for (const field of forbidden) {
    assert.equal(
      keys.has(field),
      false,
      `Response must exclude "${field}".`
    );
  }
}

test('search normalization is case-insensitive, accent-insensitive and bounded', () => {
  assert.equal(
    normalizeSearchText('  José   NAIR '),
    'jose nair'
  );
  assert.deepEqual(
    normalizePreviousNames([
      ' José Nair ',
      'Jose Nair',
      ' Mary   Jane ',
      'mary jane',
      '',
      null,
    ]),
    ['José Nair', 'Mary Jane']
  );
  assert.equal(buildEmployeeSearchQueryTerm(' P '), '');
  assert.equal(
    buildEmployeeSearchQueryTerm(' PRIYA '),
    'priya'
  );

  const terms = buildEmployeeSearchTerms({
    name: 'Priya Nair',
    preferredName: 'Pri',
    previousNames: ['Priya Menon'],
  });

  assert.ok(terms.includes('priya nair'));
  assert.ok(terms.includes('riya'));
  assert.ok(terms.includes('menon'));
  assert.equal(new Set(terms).size, terms.length);
  assert.ok(terms.length <= MAX_EMPLOYEE_SEARCH_TERMS);
});

test('record scope filters derive only from authenticated identity', () => {
  assert.deepEqual(
    buildEmployeeScopeFilter(auth('MASTER'), {
      targetUserId: ' st-0002 ',
    }),
    {
      organisationId: 'ORG-TEST',
      userId: 'ST-0002',
    }
  );

  assert.deepEqual(
    buildEmployeeScopeFilter(auth('OWNER')),
    {
      organisationId: 'ORG-TEST',
    }
  );

  assert.deepEqual(
    buildEmployeeScopeFilter(auth('CAFE_ADMIN')),
    {
      organisationId: 'ORG-TEST',
      accountStatus: 'ACTIVE',
      assignedCafeIds: {
        $in: ['ZC-0001', 'ZC-0002'],
      },
    }
  );

  assert.deepEqual(
    buildEmployeeScopeFilter(auth('STAFF')),
    {
      organisationId: 'ORG-TEST',
      userId: 'ST-0001',
    }
  );

  assert.throws(
    () =>
      buildEmployeeScopeFilter(auth('STAFF'), {
        targetUserId: 'ST-0002',
      }),
    (error) =>
      error.code === 'SELF_ACCESS_ONLY' &&
      error.statusCode === 403
  );

  assert.throws(
    () => buildEmployeeScopeFilter(null),
    (error) =>
      error.code === 'AUTHENTICATION_REQUIRED' &&
      error.statusCode === 401
  );
});

test('compact search results expose only approved fields', () => {
  const result =
    buildEmployeeSearchResult(employee());

  assert.deepEqual(
    Object.keys(result).sort(),
    [
      'accountStatus',
      'assignedCafeIds',
      'department',
      'designation',
      'isPrimaryMaster',
      'joiningDate',
      'name',
      'preferredName',
      'primaryCafeId',
      'role',
      'userId',
    ].sort()
  );

  assertNoSecurityFields(result);
  assert.equal(
    Object.prototype.hasOwnProperty.call(result, 'email'),
    false
  );
  assert.equal(
    Object.prototype.hasOwnProperty.call(result, 'phone'),
    false
  );
});

test('Master profile includes authorised private fields and sanitized histories', () => {
  const profile =
    buildEmployeeProfile(
      employee(),
      auth('MASTER')
    );

  assert.deepEqual(
    profile.identity.previousNames,
    ['Priya Menon']
  );
  assert.equal(
    profile.contact.address.city,
    'Bengaluru'
  );
  assert.equal(
    profile.contact.emergencyContact.name,
    'Anil Nair'
  );
  assert.equal(profile.history.roleHistory.length, 1);
  assert.equal(
    profile.history.cafeAssignmentHistory.length,
    1
  );
  assert.ok(profile.lifecycle);
  assertNoSecurityFields(profile);
});

test('Owner profile is read-only and excludes private contact and histories', () => {
  const profile =
    buildEmployeeProfile(
      employee(),
      auth('OWNER')
    );

  assert.equal(profile.contact.email, 'priya@example.com');
  assert.equal(profile.contact.phone, '+919999999999');
  assert.equal(
    profile.availability.loansAndAdvances,
    'NOT_INTEGRATED'
  );
  assert.equal(
    Object.prototype.hasOwnProperty.call(
      profile.contact,
      'address'
    ),
    false
  );
  assert.equal(
    Object.prototype.hasOwnProperty.call(
      profile.contact,
      'emergencyContact'
    ),
    false
  );
  assert.equal(
    Object.prototype.hasOwnProperty.call(
      profile,
      'history'
    ),
    false
  );
  assertNoSecurityFields(profile);
});

test('Café Admin profile requires active assigned-café intersection', () => {
  const profile =
    buildEmployeeProfile(
      employee(),
      auth('CAFE_ADMIN')
    );

  assert.equal(profile.identity.userId, 'ST-0001');
  assert.equal(
    Object.prototype.hasOwnProperty.call(
      profile.contact,
      'address'
    ),
    false
  );
  assertNoSecurityFields(profile);

  assert.throws(
    () =>
      buildEmployeeProfile(
        employee({
          assignedCafeIds: ['ZC-0099'],
        }),
        auth('CAFE_ADMIN')
      ),
    (error) =>
      error.code === 'EMPLOYEE_NOT_FOUND' &&
      error.statusCode === 404
  );

  assert.throws(
    () =>
      buildEmployeeProfile(
        employee({
          accountStatus: 'SUSPENDED',
        }),
        auth('CAFE_ADMIN')
      ),
    (error) =>
      error.code === 'EMPLOYEE_NOT_FOUND' &&
      error.statusCode === 404
  );
});

test('Staff profile is self-only and includes authorised own private contact', () => {
  const staffAuth = auth('STAFF');
  const profile =
    buildEmployeeProfile(
      employee(),
      staffAuth
    );

  assert.deepEqual(
    profile.identity.previousNames,
    ['Priya Menon']
  );
  assert.equal(
    profile.contact.address.postalCode,
    '560001'
  );
  assert.equal(
    profile.contact.emergencyContact.relationship,
    'Parent'
  );
  assert.equal(
    profile.availability.loansAndAdvances,
    'SELF_SERVICE_INTEGRATED'
  );
  assertNoSecurityFields(profile);

  assert.throws(
    () =>
      buildEmployeeProfile(
        employee({
          userId: 'ST-0002',
        }),
        staffAuth
      ),
    (error) =>
      error.code === 'SELF_ACCESS_ONLY' &&
      error.statusCode === 403
  );
});

test('cross-organisation profiles are concealed for every role', () => {
  for (const role of [
    'MASTER',
    'OWNER',
    'CAFE_ADMIN',
    'STAFF',
  ]) {
    assert.throws(
      () =>
        buildEmployeeProfile(
          employee({
            organisationId: 'ORG-OTHER',
          }),
          auth(role)
        ),
      (error) =>
        error.code === 'EMPLOYEE_NOT_FOUND' &&
        error.statusCode === 404
    );
  }
});
