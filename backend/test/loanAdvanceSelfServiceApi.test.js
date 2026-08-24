'use strict';

const assert = require('node:assert/strict');
const http = require('node:http');
const test = require('node:test');

const { createApp } = require('../src/server');
const { User } = require('../src/models/User');
const { StaffLoanAdvance } = require('../src/models/StaffLoanAdvance');
const authService = require('../src/services/authService');

function request(server, path, token = '') {
  return new Promise((resolve, reject) => {
    const url = new URL(
      path,
      `http://127.0.0.1:${server.address().port}`
    );

    const req = http.request({
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      headers: {
        Accept: 'application/json',
        ...(token
          ? { Authorization: `Bearer ${token}` }
          : {}),
      },
    }, (res) => {
      let raw = '';
      res.on('data', (chunk) => {
        raw += chunk;
      });
      res.on('end', () => {
        let body;
        try {
          body = JSON.parse(raw);
        } catch {
          body = raw;
        }
        resolve({
          status: res.statusCode,
          body,
        });
      });
    });

    req.on('error', reject);
    req.end();
  });
}

async function startServer(t) {
  const app = createApp({
    allowedOrigins: ['*'],
    production: false,
  });

  const server = await new Promise((resolve) => {
    const instance = app.listen(
      0,
      () => resolve(instance)
    );
  });

  t.after(
    () =>
      new Promise((resolve) =>
        server.close(resolve)
      )
  );

  return server;
}

const { RolePermission } = require('../src/models/RolePermission');

function mockStaffAuth(t) {
  const user = {
    userId: 'ST-0001',
    organisationId: 'ORG-TEST',
    role: 'STAFF',
    assignedCafeIds: ['CF-0001'],
    primaryCafeId: 'CF-0001',
    sessionVersion: 1,
    permissionsVersion: 1,
  };

  const session = {
    sessionId: 'SS-20260809-0001',
    roleSnapshot: 'STAFF',
    sessionVersion: 1,
    mfaVerified: true,
    stepUpVerifiedAt: new Date().toISOString(),
  };

  t.mock.method(
    authService,
    'verifyAccessToken',
    async () => ({
      payload: {
        sub: user.userId,
        org: user.organisationId,
        role: user.role,
        sv: 1,
        usv: 1,
        pv: 1,
        sid: session.sessionId,
      },
      session,
    })
  );

  t.mock.method(
    User,
    'findOne',
    async () => user
  );

  t.mock.method(
    RolePermission,
    'findEffectiveRules',
    async () => [
      {
        effect: 'ALLOW',
        scope: 'SELF',
        isCurrentlyEffective: () => true,
      },
    ]
  );
}

function findQuery(rows, onSelect) {
  return {
    select(value) {
      if (onSelect) {
        onSelect(value);
      }
      return this;
    },
    sort() {
      return this;
    },
    skip() {
      return this;
    },
    async limit() {
      return rows;
    },
  };
}

function findOneQuery(row, onSelect) {
  return {
    select(value) {
      if (onSelect) {
        onSelect(value);
      }
      return this;
    },
    then(resolve, reject) {
      return Promise.resolve(row).then(resolve, reject);
    },
  };
}

test(
  'loan advance self-service requires authentication',
  async (t) => {
    const server = await startServer(t);

    const result = await request(
      server,
      '/api/v1/loan-advances/me'
    );

    assert.equal(result.status, 401);
    assert.equal(
      result.body.error?.code,
      'AUTHENTICATION_REQUIRED'
    );
  }
);

test(
  'STAFF lists only own loan and advance records with restricted projection',
  async (t) => {
    mockStaffAuth(t);

    const expectedFilter = {
      organisationId: 'ORG-TEST',
      employeeUserId: 'ST-0001',
    };

    const rows = [
      {
        loanAdvanceId: 'LN-0001',
        status: 'REQUESTED',
      },
    ];

    t.mock.method(
      StaffLoanAdvance,
      'find',
      (filter) => {
        assert.deepEqual(
          filter,
          expectedFilter
        );

        return findQuery(
          rows,
          (projection) => {
            assert.match(
              projection,
              /loanAdvanceId/
            );
            assert.doesNotMatch(
              projection,
              /decidedByUserId|createdByUserId/
            );
          }
        );
      }
    );

    t.mock.method(
      StaffLoanAdvance,
      'countDocuments',
      async (filter) => {
        assert.deepEqual(
          filter,
          expectedFilter
        );
        return rows.length;
      }
    );

    const server = await startServer(t);
    const result = await request(
      server,
      '/api/v1/loan-advances/me',
      'token'
    );

    assert.equal(
      result.status,
      200,
      JSON.stringify(result.body)
    );
    assert.equal(
      result.body.data
        ?.loanAdvances?.length,
      1
    );
  }
);

test(
  'invalid loan advance status is rejected before database access',
  async (t) => {
    mockStaffAuth(t);

    const server = await startServer(t);
    const result = await request(
      server,
      '/api/v1/loan-advances/me?status=paid',
      'token'
    );

    assert.equal(result.status, 400);
    assert.equal(
      result.body.error?.code,
      'INVALID_LOAN_ADVANCE_STATUS'
    );
  }
);

test(
  'STAFF cannot reveal another employee loan advance through self-service detail',
  async (t) => {
    mockStaffAuth(t);

    t.mock.method(
      StaffLoanAdvance,
      'findOne',
      (filter) => {
        assert.deepEqual(filter, {
          organisationId: 'ORG-TEST',
          employeeUserId: 'ST-0001',
          loanAdvanceId: 'LN-0002',
        });

        return findOneQuery(null);
      }
    );

    const server = await startServer(t);
    const result = await request(
      server,
      '/api/v1/loan-advances/me/LN-0002',
      'token'
    );

    assert.equal(result.status, 404);
    assert.equal(
      result.body.error?.code,
      'LOAN_ADVANCE_NOT_FOUND'
    );
  }
);
