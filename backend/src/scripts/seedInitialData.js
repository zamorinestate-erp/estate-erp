'use strict';

require('dotenv').config();

const mongoose = require('mongoose');

const {
  connectDatabase,
} = require('../config/database');

const {
  User,
} = require('../models/User');

const {
  RolePermission,
} = require('../models/RolePermission');

const {
  SequenceCounter,
} = require('../models/SequenceCounter');

const {
  hashPassword,
} = require('../services/authService');

function requireEnvironmentValue(name) {
  const value = process.env[name];

  if (!value || !value.trim()) {
    throw new Error(
      `${name} is required.`
    );
  }

  return value.trim();
}

function normalizeIdentifier(value) {
  return value
    .trim()
    .toUpperCase();
}

function normalizeEmail(value) {
  return value
    .trim()
    .toLowerCase();
}

const DEFAULT_PERMISSION_RULES = [
  {
    role: 'MASTER',
    permissionCode: 'CAFE:MANAGE',
    module: 'CAFE',
    resource: 'CAFE',
    action: 'MANAGE',
    effect: 'ALLOW',
    scope: 'ORGANISATION',
    requiresMfa: true,
    description:
      'MASTER may manage cafés across the organisation.',
  },
  {
    role: 'MASTER',
    permissionCode: 'USER:MANAGE',
    module: 'USER',
    resource: 'USER',
    action: 'MANAGE',
    effect: 'ALLOW',
    scope: 'ORGANISATION',
    requiresMfa: true,
    description:
      'MASTER may manage organisation users.',
  },
  {
    role: 'MASTER',
    permissionCode: 'AUDIT:READ',
    module: 'AUDIT',
    resource: 'AUDIT_EVENT',
    action: 'READ',
    effect: 'ALLOW',
    scope: 'ORGANISATION',
    requiresMfa: true,
    description:
      'MASTER may read organisation audit events.',
  },
  {
    role: 'OWNER',
    permissionCode: 'CAFE:READ',
    module: 'CAFE',
    resource: 'CAFE',
    action: 'READ',
    effect: 'ALLOW',
    scope: 'ORGANISATION',
    requiresMfa: true,
    description:
      'OWNER may read organisation café information.',
  },
  {
    role: 'OWNER',
    permissionCode: 'USER:READ',
    module: 'USER',
    resource: 'USER',
    action: 'READ',
    effect: 'ALLOW',
    scope: 'ORGANISATION',
    requiresMfa: true,
    description:
      'OWNER may read organisation user information.',
  },
  {
    role: 'CAFE_ADMIN',
    permissionCode: 'CAFE:READ',
    module: 'CAFE',
    resource: 'CAFE',
    action: 'READ',
    effect: 'ALLOW',
    scope: 'ASSIGNED_CAFES',
    requiresMfa: true,
    description:
      'Café Admin may read assigned café information.',
  },
  {
    role: 'CAFE_ADMIN',
    permissionCode: 'USER:READ',
    module: 'USER',
    resource: 'USER',
    action: 'READ',
    effect: 'ALLOW',
    scope: 'ASSIGNED_CAFES',
    requiresMfa: true,
    description:
      'Café Admin may read users in assigned cafés.',
  },
  {
    role: 'STAFF',
    permissionCode: 'USER:READ_SELF',
    module: 'USER',
    resource: 'USER',
    action: 'READ',
    effect: 'ALLOW',
    scope: 'SELF',
    requiresMfa: false,
    description:
      'Staff may read their own user information.',
  },
  {
    role: 'STAFF',
    permissionCode: 'NOTIFICATION:READ_SELF',
    module: 'NOTIFICATION',
    resource: 'NOTIFICATION',
    action: 'READ',
    effect: 'ALLOW',
    scope: 'SELF',
    requiresMfa: false,
    description:
      'Staff may read their own notifications.',
  },
];

async function seedMasterUser({
  organisationId,
  masterName,
  masterEmail,
  masterPassword,
}) {
  const existingMaster =
    await User.findOne({
      organisationId,
      role: 'MASTER',
    });

  if (existingMaster) {
    console.log(
      `MASTER already exists: ${existingMaster.userId}`
    );

    return existingMaster;
  }

  const duplicateEmail =
    await User.findOne({
      email: masterEmail,
    });

  if (duplicateEmail) {
    throw new Error(
      'The MASTER email is already used by another user.'
    );
  }

  const userId =
    await SequenceCounter.generateId({
      organisationId,
      sequenceKey: 'USER_MASTER',
      prefix: 'MU',
      minimumDigits: 4,
    });

  const passwordHash =
    await hashPassword(
      masterPassword
    );

  const masterUser =
    await User.create({
      userId,
      organisationId,
      name: masterName,
      preferredName: '',
      email: masterEmail,
      phone: '',
      role: 'MASTER',
      accountStatus: 'ACTIVE',
      primaryCafeId: null,
      assignedCafeIds: [],
      passwordHash,
      mustChangePassword: true,
      passwordChangedAt: new Date(),
      mfaEnabled: false,
      mfaMethod: 'NONE',
      preferredLanguage: 'en',
      timezone: 'Asia/Kolkata',
      createdBy: userId,
      updatedBy: userId,
    });

  console.log(
    `Created MASTER user: ${masterUser.userId}`
  );

  return masterUser;
}

async function seedPermissionRules({
  organisationId,
  masterUserId,
}) {
  let createdCount = 0;
  let existingCount = 0;

  for (
    const rule of
    DEFAULT_PERMISSION_RULES
  ) {
    const existingRule =
      await RolePermission.findOne({
        organisationId,
        role: rule.role,
        cafeId: null,
        permissionCode:
          rule.permissionCode,
        isActive: true,
        archivedAt: null,
      });

    if (existingRule) {
      existingCount += 1;
      continue;
    }

    const permissionRuleId =
      await SequenceCounter.generateId({
        organisationId,
        sequenceKey:
          'PERMISSION_RULE',
        prefix: 'PR',
        minimumDigits: 4,
      });

    await RolePermission.create({
      permissionRuleId,
      organisationId,
      role: rule.role,
      cafeId: null,
      permissionCode:
        rule.permissionCode,
      module: rule.module,
      resource: rule.resource,
      action: rule.action,
      effect: rule.effect,
      scope: rule.scope,
      fieldAccess: {
        allowedFields: [],
        deniedFields: [],
        maskedFields: [],
      },
      conditions: {},
      requiresMfa:
        rule.requiresMfa,
      requiresStepUpAuthentication:
        false,
      requiresReason: false,
      requiresAuditEvent: true,
      requiresReauthentication:
        false,
      isDelegable: false,
      isActive: true,
      effectiveFrom: new Date(),
      effectiveTo: null,
      description:
        rule.description,
      policyVersion: 1,
      createdBy:
        masterUserId,
      updatedBy:
        masterUserId,
    });

    createdCount += 1;
  }

  console.log(
    `Permission rules created: ${createdCount}`
  );

  console.log(
    `Permission rules already existing: ${existingCount}`
  );
}

async function runSeed() {
  try {
    const organisationId =
      normalizeIdentifier(
        requireEnvironmentValue(
          'INITIAL_ORGANISATION_ID'
        )
      );

    const masterName =
      requireEnvironmentValue(
        'INITIAL_MASTER_NAME'
      );

    const masterEmail =
      normalizeEmail(
        requireEnvironmentValue(
          'INITIAL_MASTER_EMAIL'
        )
      );

    const masterPassword =
      requireEnvironmentValue(
        'INITIAL_MASTER_PASSWORD'
      );

    await connectDatabase();

    const masterUser =
      await seedMasterUser({
        organisationId,
        masterName,
        masterEmail,
        masterPassword,
      });

    await seedPermissionRules({
      organisationId,
      masterUserId:
        masterUser.userId,
    });

    console.log(
      'Initial backend data seeded successfully.'
    );
  } catch (error) {
    console.error(
      `Initial data seed failed: ${error.message}`
    );

    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
}

runSeed();