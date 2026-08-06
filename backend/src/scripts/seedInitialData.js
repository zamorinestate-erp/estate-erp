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

const PRIMARY_MASTER_DESIGNATION_REASON =
  'Initial Primary Master designation during secure bootstrap.';

function assertPrimaryMasterCandidate({
  user,
  organisationId,
}) {
  if (!user) {
    throw new Error(
      'A Primary Master candidate is required.'
    );
  }

  if (
    user.organisationId !== organisationId
  ) {
    throw new Error(
      'The Primary Master candidate belongs to a different organisation.'
    );
  }

  if (user.role !== 'MASTER') {
    throw new Error(
      'The Primary Master candidate must have the MASTER role.'
    );
  }

  if (user.accountStatus !== 'ACTIVE') {
    throw new Error(
      'The Primary Master candidate must have an ACTIVE account.'
    );
  }

  if (
    user.primaryCafeId ||
    (user.assignedCafeIds || []).length > 0
  ) {
    throw new Error(
      'The Primary Master candidate cannot be restricted to café assignments.'
    );
  }
}

async function seedMasterUser({
  organisationId,
  masterName,
  masterEmail,
  masterPassword,
}) {
  const existingMasters =
    await User.find({
      organisationId,
      role: 'MASTER',
      accountStatus: {
        $ne: 'ARCHIVED',
      },
    }).sort({
      createdAt: 1,
      userId: 1,
    });

  const existingPrimaryMasters =
    existingMasters.filter(
      (user) => user.isPrimaryMaster
    );

  if (
    existingPrimaryMasters.length > 1
  ) {
    throw new Error(
      'Multiple Primary Master accounts exist for this organisation.'
    );
  }

  if (
    existingPrimaryMasters.length === 1
  ) {
    const primaryMaster =
      existingPrimaryMasters[0];

    if (
      existingMasters.some(
        (user) =>
          user.userId !==
          primaryMaster.userId
      )
    ) {
      throw new Error(
        'Additional active MASTER accounts exist alongside the Primary Master.'
      );
    }

    assertPrimaryMasterCandidate({
      user: primaryMaster,
      organisationId,
    });

    await primaryMaster.validate();

    console.log(
      `Primary MASTER already exists: ${primaryMaster.userId}`
    );

    return primaryMaster;
  }

  if (existingMasters.length > 1) {
    throw new Error(
      'Multiple MASTER accounts exist and no Primary Master can be selected automatically.'
    );
  }

  if (existingMasters.length === 1) {
    const legacyMaster =
      existingMasters[0];

    assertPrimaryMasterCandidate({
      user: legacyMaster,
      organisationId,
    });

    const designatedAt = new Date();

    const designationResult =
      await User.collection.updateOne(
        {
          _id: legacyMaster._id,
          organisationId,
          role: 'MASTER',
          accountStatus: 'ACTIVE',
          isPrimaryMaster: {
            $ne: true,
          },
        },
        {
          $set: {
            isPrimaryMaster: true,
            primaryMasterDesignatedAt:
              designatedAt,
            primaryMasterDesignatedBy:
              legacyMaster.userId,
            primaryMasterDesignationReason:
              PRIMARY_MASTER_DESIGNATION_REASON,
            updatedBy:
              legacyMaster.userId,
          },
          $push: {
            roleHistory: {
              toRole: 'MASTER',
              changedAt:
                designatedAt,
              changedBy:
                legacyMaster.userId,
              reason:
                PRIMARY_MASTER_DESIGNATION_REASON,
              correlationId: null,
              sessionId: null,
            },
          },
        }
      );

    if (
      designationResult.matchedCount !== 1 ||
      designationResult.modifiedCount !== 1
    ) {
      throw new Error(
        'The existing MASTER could not be designated as Primary Master.'
      );
    }

    const primaryMaster =
      await User.findById(
        legacyMaster._id
      );

    assertPrimaryMasterCandidate({
      user: primaryMaster,
      organisationId,
    });

    await primaryMaster.validate();

    console.log(
      `Designated existing MASTER as Primary Master: ${primaryMaster.userId}`
    );

    return primaryMaster;
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

  const designatedAt = new Date();

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
      isPrimaryMaster: true,
      primaryMasterDesignatedAt:
        designatedAt,
      primaryMasterDesignatedBy:
        userId,
      primaryMasterDesignationReason:
        PRIMARY_MASTER_DESIGNATION_REASON,
      roleHistory: [
        {
          toRole: 'MASTER',
          changedAt:
            designatedAt,
          changedBy:
            userId,
          reason:
            PRIMARY_MASTER_DESIGNATION_REASON,
          correlationId: null,
          sessionId: null,
        },
      ],
      cafeAssignmentHistory: [],
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
    `Created Primary MASTER user: ${masterUser.userId}`
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

if (require.main === module) {
  runSeed();
}

module.exports = {
  PRIMARY_MASTER_DESIGNATION_REASON,
  assertPrimaryMasterCandidate,
  seedMasterUser,
  seedPermissionRules,
  runSeed,
};