'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

const {
  EMPLOYEE_SEARCH_PROJECTION,
  buildEmployeeSearchRequest,
  buildEmployeeSearchFilter,
} = require('../src/controllers/employeeController');

function auth(overrides = {}) {
  return {
    userId: 'MU-0001',
    organisationId: 'ORG-TEST',
    role: 'MASTER',
    assignedCafeIds: [],
    ...overrides,
  };
}

test(
  'exact permanent employee IDs use uppercase exact-ID search',
  () => {
    for (const value of [
      'mu-0001',
      'ow-1234',
      'ad-9999',
      'st-0007',
      'future-1234',
    ]) {
      const result =
        buildEmployeeSearchRequest({
          q: value,
        });

      assert.equal(
        result.mode,
        'EXACT_ID'
      );

      assert.equal(
        result.normalizedQuery,
        value.toUpperCase()
      );
    }
  }
);

test(
  'name searches are case-insensitive and accent-insensitive',
  () => {
    const result =
      buildEmployeeSearchRequest({
        q: '  José   NAIR ',
        page: '2',
        limit: '10',
      });

    assert.deepEqual(
      result,
      {
        mode: 'NAME',
        normalizedQuery:
          'jose nair',
        page: 2,
        limit: 10,
      }
    );
  }
);

test(
  'search query validation rejects missing, repeated, short and oversized values',
  () => {
    const cases = [
      [
        {},
        'EMPLOYEE_SEARCH_QUERY_REQUIRED',
      ],
      [
        {
          q: [
            'Priya',
            'Nair',
          ],
        },
        'INVALID_SEARCH_QUERY',
      ],
      [
        { q: 'P' },
        'EMPLOYEE_SEARCH_QUERY_TOO_SHORT',
      ],
      [
        {
          q: 'x'.repeat(121),
        },
        'EMPLOYEE_SEARCH_QUERY_TOO_LONG',
      ],
      [
        {
          q: 'longname '.repeat(5),
        },
        'EMPLOYEE_SEARCH_QUERY_TOO_LONG',
      ],
    ];

    for (const [
      query,
      expectedCode,
    ] of cases) {
      assert.throws(
        () =>
          buildEmployeeSearchRequest(
            query
          ),
        (error) =>
          error.statusCode === 400 &&
          error.code ===
            expectedCode
      );
    }
  }
);

test(
  'pagination validation is strict and bounded',
  () => {
    for (const query of [
      {
        q: 'Priya',
        page: '0',
      },
      {
        q: 'Priya',
        page: '1.5',
      },
      {
        q: 'Priya',
        page: '100001',
      },
      {
        q: 'Priya',
        limit: '0',
      },
      {
        q: 'Priya',
        limit: '101',
      },
      {
        q: 'Priya',
        limit: 'abc',
      },
    ]) {
      assert.throws(
        () =>
          buildEmployeeSearchRequest(
            query
          ),
        (error) =>
          error.statusCode === 400 &&
          error.code ===
            'INVALID_PAGINATION'
      );
    }
  }
);

test(
  'employee search scope comes only from authenticated backend identity',
  () => {
    const searchRequest =
      buildEmployeeSearchRequest({
        q: 'Priya',
      });

    const filter =
      buildEmployeeSearchFilter(
        auth({
          organisationId:
            'ORG-SECURE',
        }),
        searchRequest
      );

    assert.deepEqual(
      filter,
      {
        organisationId:
          'ORG-SECURE',
        employeeSearchTerms:
          'priya',
      }
    );
  }
);

test(
  'exact ID filters combine backend organisation scope with exact userId',
  () => {
    const searchRequest =
      buildEmployeeSearchRequest({
        q: 'st-0042',
      });

    assert.deepEqual(
      buildEmployeeSearchFilter(
        auth(),
        searchRequest
      ),
      {
        organisationId:
          'ORG-TEST',
        userId: 'ST-0042',
      }
    );
  }
);

test(
  'search projection is a compact allowlist and excludes sensitive fields',
  () => {
    const fields =
      EMPLOYEE_SEARCH_PROJECTION
        .split(/\s+/)
        .filter(Boolean);

    assert.deepEqual(
      fields.sort(),
      [
        'userId',
        'name',
        'preferredName',
        'role',
        'accountStatus',
        'isPrimaryMaster',
        'primaryCafeId',
        'assignedCafeIds',
        'joiningDate',
        'department',
        'designation',
      ].sort()
    );

    for (const forbidden of [
      'email',
      'phone',
      'address',
      'emergencyContact',
      'previousNames',
      'employeeSearchTerms',
      'passwordHash',
      'mfaSecretEncrypted',
      'recoveryCodeHashes',
      'sessionVersion',
      'permissionsVersion',
    ]) {
      assert.equal(
        fields.includes(forbidden),
        false
      );
    }
  }
);
