'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

const { User } = require('../src/models/User');
const {
  PROTECTED_USER_FIELDS,
  rejectProtectedFields,
} = require('../src/services/userGovernanceService');

function makeEmployee(overrides = {}) {
  return new User({
    userId: 'ST-0099',
    organisationId: 'ORG-TEST',
    name: '  Priya   Nair  ',
    preferredName: '  Pri  ',
    previousNames: [
      '  Priya Menon  ',
      'priya menon',
      'José Nair',
      'Jose Nair',
      '',
      null,
    ],
    joiningDate: new Date('2026-01-15T00:00:00.000Z'),
    employmentType: '  Full Time  ',
    department: '  Operations  ',
    designation: '  Barista  ',
    address: {
      line1: '  12 Main Road  ',
      line2: '  Second Floor  ',
      city: '  Bengaluru  ',
      state: '  Karnataka  ',
      postalCode: '  560001  ',
      country: '  India  ',
    },
    emergencyContact: {
      name: '  Anil Nair  ',
      relationship: '  Parent  ',
      phone: '  +919876543210  ',
    },
    email: 'PRIYA.NAIR@EXAMPLE.COM',
    phone: '+919999999999',
    role: 'STAFF',
    accountStatus: 'ACTIVE',
    primaryCafeId: 'zc-0001',
    assignedCafeIds: ['zc-0001', 'ZC-0001'],
    passwordHash: 'test-password-hash',
    createdBy: 'MU-0001',
    ...overrides,
  });
}

test('employee profile schema paths and internal search index exist', () => {
  const expectedPaths = [
    'previousNames',
    'employeeSearchTerms',
    'joiningDate',
    'employmentType',
    'department',
    'designation',
    'address',
    'emergencyContact',
  ];

  for (const field of expectedPaths) {
    assert.ok(
      User.schema.path(field),
      `Expected User schema path "${field}".`
    );
  }

  assert.equal(
    User.schema.path('employeeSearchTerms').options.select,
    false
  );

  const index = User.schema.indexes().find(
    ([keys, options]) =>
      keys.organisationId === 1 &&
      keys.employeeSearchTerms === 1 &&
      keys.accountStatus === 1 &&
      options.name ===
        'organisation_employee_search_status'
  );

  assert.ok(index);
});

test('employee fields normalize and generated search terms are bounded', async () => {
  const employee = makeEmployee();

  await employee.validate();

  assert.equal(employee.name, 'Priya   Nair');
  assert.equal(employee.preferredName, 'Pri');
  assert.deepEqual(
    [...employee.previousNames],
    ['Priya Menon', 'José Nair']
  );
  assert.equal(employee.employmentType, 'Full Time');
  assert.equal(employee.department, 'Operations');
  assert.equal(employee.designation, 'Barista');
  assert.equal(employee.address.line1, '12 Main Road');
  assert.equal(employee.address.city, 'Bengaluru');
  assert.equal(
    employee.emergencyContact.name,
    'Anil Nair'
  );
  assert.equal(
    employee.emergencyContact.relationship,
    'Parent'
  );
  assert.equal(employee.email, 'priya.nair@example.com');
  assert.equal(employee.primaryCafeId, 'ZC-0001');
  assert.deepEqual(
    [...employee.assignedCafeIds],
    ['ZC-0001']
  );

  const terms = [...employee.employeeSearchTerms];

  assert.ok(terms.includes('priya nair'));
  assert.ok(terms.includes('priya'));
  assert.ok(terms.includes('riya'));
  assert.ok(terms.includes('pri'));
  assert.ok(terms.includes('priya menon'));
  assert.ok(terms.includes('jose nair'));
  assert.equal(
    new Set(terms).size,
    terms.length,
    'Generated search terms must be deduplicated.'
  );
  assert.ok(
    terms.length <= 512,
    'Generated search terms must remain bounded.'
  );
});

test('employeeSearchTerms are regenerated from canonical names', async () => {
  const employee = makeEmployee({
    name: 'Asha Rao',
    preferredName: '',
    previousNames: [],
    employeeSearchTerms: ['browser-supplied-value'],
  });

  await employee.validate();

  assert.ok(employee.employeeSearchTerms.includes('asha rao'));
  assert.ok(employee.employeeSearchTerms.includes('asha'));
  assert.equal(
    employee.employeeSearchTerms.includes(
      'browser-supplied-value'
    ),
    false
  );
});

test('safe User JSON excludes internal employee search terms', async () => {
  const employee = makeEmployee();

  await employee.validate();

  const json = employee.toJSON();

  assert.equal(
    Object.prototype.hasOwnProperty.call(
      json,
      'employeeSearchTerms'
    ),
    false
  );
  assert.equal(
    Object.prototype.hasOwnProperty.call(
      json,
      'passwordHash'
    ),
    false
  );
});

test('new employee profile fields remain protected from general updates', () => {
  const protectedEmployeeFields = [
    'previousNames',
    'employeeSearchTerms',
    'joiningDate',
    'employmentType',
    'department',
    'designation',
    'address',
    'emergencyContact',
  ];

  for (const field of protectedEmployeeFields) {
    assert.equal(PROTECTED_USER_FIELDS.has(field), true);
    assert.throws(
      () =>
        rejectProtectedFields({
          [field]: 'attempted-override',
        }),
      (error) =>
        error.code === 'PROTECTED_USER_FIELD' &&
        error.statusCode === 400
    );
  }
});
