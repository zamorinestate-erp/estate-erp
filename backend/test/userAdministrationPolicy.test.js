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

function makeExistingRule(
  rule,
  overrides = {}
) {
  return {
    requiresMfa:
      Boolean(rule.requiresMfa),
    requiresStepUpAuthentication:
      Boolean(
        rule.requiresStepUpAuthentication
      ),
    requiresReason:
      Boolean(rule.requiresReason),
    requiresAuditEvent:
      rule.requiresAuditEvent !== false,
    requiresReauthentication:
      Boolean(
        rule.requiresReauthentication
      ),
    policyVersion: 1,
    updatedBy: 'MU-0001',
    saveCount: 0,
    async save() {
      this.saveCount += 1;
      return this;
    },
    ...overrides,
  };
}

test('USER:MANAGE requires MFA, recent step-up, a reason and an audit event', () => {
  const rule =
    getRule(
      'MASTER',
      'USER:MANAGE'
    );

  assert.ok(rule);
  assert.equal(rule.requiresMfa, true);
  assert.equal(
    rule.requiresStepUpAuthentication,
    true
  );
  assert.equal(
    rule.requiresReason,
    true
  );
  assert.equal(
    rule.requiresAuditEvent,
    true
  );
  assert.equal(
    rule.requiresReauthentication,
    false
  );
});

test('permission seeding upgrades an existing stale USER:MANAGE security policy', async () => {
  const originalFindOne =
    RolePermission.findOne;
  const originalCreate =
    RolePermission.create;
  const originalGenerateId =
    SequenceCounter.generateId;

  const existingRules =
    new Map();

  for (
    const rule of
    DEFAULT_PERMISSION_RULES
  ) {
    existingRules.set(
      `${rule.role}|${rule.permissionCode}`,
      makeExistingRule(rule)
    );
  }

  const userManageRule =
    getRule(
      'MASTER',
      'USER:MANAGE'
    );

  const staleUserManage =
    makeExistingRule(
      userManageRule,
      {
        requiresStepUpAuthentication:
          false,
        requiresReason: false,
        requiresAuditEvent: false,
        policyVersion: 3,
        updatedBy: 'MU-0999',
      }
    );

  existingRules.set(
    'MASTER|USER:MANAGE',
    staleUserManage
  );

  RolePermission.findOne =
    async (filter) =>
      existingRules.get(
        `${filter.role}|${filter.permissionCode}`
      ) || null;

  RolePermission.create =
    async () => {
      throw new Error(
        'No permission rule should be created.'
      );
    };

  SequenceCounter.generateId =
    async () => {
      throw new Error(
        'No permission-rule ID should be generated.'
      );
    };

  try {
    await seedPermissionRules({
      organisationId: 'ORG-TEST',
      masterUserId: 'MU-0001',
    });

    assert.equal(
      staleUserManage
        .requiresStepUpAuthentication,
      true
    );

    assert.equal(
      staleUserManage.requiresReason,
      true
    );

    assert.equal(
      staleUserManage
        .requiresAuditEvent,
      true
    );

    assert.equal(
      staleUserManage.policyVersion,
      4
    );

    assert.equal(
      staleUserManage.updatedBy,
      'MU-0001'
    );

    assert.equal(
      staleUserManage.saveCount,
      1
    );
  } finally {
    RolePermission.findOne =
      originalFindOne;
    RolePermission.create =
      originalCreate;
    SequenceCounter.generateId =
      originalGenerateId;
  }
});

test('permission seeding creates USER:MANAGE with its sensitive security requirements', async () => {
  const originalFindOne =
    RolePermission.findOne;
  const originalCreate =
    RolePermission.create;
  const originalGenerateId =
    SequenceCounter.generateId;

  const existingRules =
    new Map();

  for (
    const rule of
    DEFAULT_PERMISSION_RULES
  ) {
    if (
      rule.role === 'MASTER' &&
      rule.permissionCode ===
        'USER:MANAGE'
    ) {
      continue;
    }

    existingRules.set(
      `${rule.role}|${rule.permissionCode}`,
      makeExistingRule(rule)
    );
  }

  let createdRule = null;

  RolePermission.findOne =
    async (filter) =>
      existingRules.get(
        `${filter.role}|${filter.permissionCode}`
      ) || null;

  RolePermission.create =
    async (document) => {
      createdRule = document;
      return document;
    };

  SequenceCounter.generateId =
    async () => 'PR-9001';

  try {
    await seedPermissionRules({
      organisationId: 'ORG-TEST',
      masterUserId: 'MU-0001',
    });

    assert.ok(createdRule);

    assert.equal(
      createdRule.permissionCode,
      'USER:MANAGE'
    );

    assert.equal(
      createdRule.requiresMfa,
      true
    );

    assert.equal(
      createdRule
        .requiresStepUpAuthentication,
      true
    );

    assert.equal(
      createdRule.requiresReason,
      true
    );

    assert.equal(
      createdRule
        .requiresAuditEvent,
      true
    );

    assert.equal(
      createdRule
        .requiresReauthentication,
      false
    );
  } finally {
    RolePermission.findOne =
      originalFindOne;
    RolePermission.create =
      originalCreate;
    SequenceCounter.generateId =
      originalGenerateId;
  }
});
