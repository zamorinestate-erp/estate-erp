'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

const {
  RolePermission,
} = require('../src/models/RolePermission');

const {
  SequenceCounter,
} = require('../src/models/SequenceCounter');

const {
  DEFAULT_PERMISSION_RULES,
  seedPermissionRules,
} = require('../src/scripts/seedInitialData');

const EXPECTED_RULES = [
  {
    role: 'MASTER',
    permissionCode: 'EMPLOYEE:READ',
    scope: 'ORGANISATION',
    requiresMfa: true,
  },
  {
    role: 'OWNER',
    permissionCode: 'EMPLOYEE:READ',
    scope: 'ORGANISATION',
    requiresMfa: true,
  },
  {
    role: 'CAFE_ADMIN',
    permissionCode: 'EMPLOYEE:READ',
    scope: 'RECORD',
    requiresMfa: true,
  },
  {
    role: 'STAFF',
    permissionCode: 'EMPLOYEE:READ_SELF',
    scope: 'SELF',
    requiresMfa: false,
  },
];

function getRule(
  role,
  permissionCode
) {
  return DEFAULT_PERMISSION_RULES.find(
    (rule) =>
      rule.role === role &&
      rule.permissionCode ===
        permissionCode
  );
}

test(
  'dedicated employee read permissions match the approved matrix',
  () => {
    for (const expected of EXPECTED_RULES) {
      const rule = getRule(
        expected.role,
        expected.permissionCode
      );

      assert.ok(rule);
      assert.equal(rule.module, 'EMPLOYEE');
      assert.equal(rule.resource, 'EMPLOYEE');
      assert.equal(rule.action, 'READ');
      assert.equal(rule.effect, 'ALLOW');
      assert.equal(rule.scope, expected.scope);
      assert.equal(
        Boolean(rule.requiresMfa),
        expected.requiresMfa
      );
      assert.equal(
        Boolean(
          rule
            .requiresStepUpAuthentication
        ),
        false
      );
      assert.equal(
        Boolean(rule.requiresReason),
        false
      );
      assert.equal(
        rule.requiresAuditEvent,
        false
      );
    }
  }
);

test(
  'permission seeding creates the four missing employee read rules',
  async () => {
    const originalFindOne =
      RolePermission.findOne;
    const originalCreate =
      RolePermission.create;
    const originalGenerateId =
      SequenceCounter.generateId;

    const missingKeys = new Set(
      EXPECTED_RULES.map(
        ({ role, permissionCode }) =>
          `${role}|${permissionCode}`
      )
    );

    const created = [];

    RolePermission.findOne =
      async (filter) => {
        const key =
          `${filter.role}|${filter.permissionCode}`;

        if (missingKeys.has(key)) {
          return null;
        }

        const rule = getRule(
          filter.role,
          filter.permissionCode
        );

        assert.ok(rule);

        return {
          requiresMfa:
            Boolean(rule.requiresMfa),
          requiresStepUpAuthentication:
            Boolean(
              rule
                .requiresStepUpAuthentication
            ),
          requiresReason:
            Boolean(rule.requiresReason),
          requiresAuditEvent:
            rule.requiresAuditEvent !== false,
          requiresReauthentication:
            Boolean(
              rule
                .requiresReauthentication
            ),
          policyVersion: 1,
          updatedBy: 'MU-0001',
          async save() {
            throw new Error(
              'An unchanged rule must not be saved.'
            );
          },
        };
      };

    RolePermission.create =
      async (document) => {
        created.push(document);
        return document;
      };

    SequenceCounter.generateId =
      async () =>
        `PR-${9001 + created.length}`;

    try {
      await seedPermissionRules({
        organisationId: 'ORG-TEST',
        masterUserId: 'MU-0001',
      });

      assert.equal(created.length, 4);

      for (const expected of EXPECTED_RULES) {
        const rule = created.find(
          (item) =>
            item.role === expected.role &&
            item.permissionCode ===
              expected.permissionCode
        );

        assert.ok(rule);
        assert.equal(
          rule.scope,
          expected.scope
        );
        assert.equal(
          Boolean(rule.requiresMfa),
          expected.requiresMfa
        );
        assert.equal(
          rule.requiresAuditEvent,
          false
        );
        assert.deepEqual(
          rule.fieldAccess,
          {
            allowedFields: [],
            deniedFields: [],
            maskedFields: [],
          }
        );
      }
    } finally {
      RolePermission.findOne =
        originalFindOne;
      RolePermission.create =
        originalCreate;
      SequenceCounter.generateId =
        originalGenerateId;
    }
  }
);
