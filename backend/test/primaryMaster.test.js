'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

const { User } = require('../src/models/User');
const {
  assertPrimaryMasterCandidate,
  seedMasterUser,
} = require('../src/scripts/seedInitialData');

function makePrimaryMaster(overrides = {}) {
  return new User({
    userId: 'MU-0001',
    organisationId: 'ORG-TEST',
    name: 'Primary Master',
    email: 'primary.master@example.com',
    phone: '',
    role: 'MASTER',
    accountStatus: 'ACTIVE',
    primaryCafeId: null,
    assignedCafeIds: [],
    isPrimaryMaster: true,
    primaryMasterDesignatedAt: new Date('2026-08-06T00:00:00.000Z'),
    primaryMasterDesignatedBy: 'MU-0001',
    primaryMasterDesignationReason: 'Secure bootstrap designation.',
    roleHistory: [
      {
        toRole: 'MASTER',
        changedAt: new Date('2026-08-06T00:00:00.000Z'),
        changedBy: 'MU-0001',
        reason: 'Secure bootstrap designation.',
        correlationId: null,
        sessionId: null,
      },
    ],
    cafeAssignmentHistory: [],
    passwordHash: 'test-password-hash',
    mustChangePassword: true,
    createdBy: 'SYSTEM',
    ...overrides,
  });
}

function makeRegularMaster(overrides = {}) {
  return new User({
    userId: 'MU-0002',
    organisationId: 'ORG-TEST',
    name: 'Legacy Master',
    email: 'legacy.master@example.com',
    phone: '',
    role: 'MASTER',
    accountStatus: 'ACTIVE',
    primaryCafeId: null,
    assignedCafeIds: [],
    isPrimaryMaster: false,
    roleHistory: [],
    cafeAssignmentHistory: [],
    passwordHash: 'test-password-hash',
    mustChangePassword: true,
    createdBy: 'SYSTEM',
    ...overrides,
  });
}

function candidate(overrides = {}) {
  return {
    userId: 'MU-0001',
    organisationId: 'ORG-TEST',
    role: 'MASTER',
    accountStatus: 'ACTIVE',
    primaryCafeId: null,
    assignedCafeIds: [],
    ...overrides,
  };
}

test('Primary Master schema contains the organisation-level partial unique index', () => {
  const index = User.schema.indexes().find(
    ([keys, options]) =>
      keys.organisationId === 1 &&
      keys.isPrimaryMaster === 1 &&
      options.unique === true &&
      options.name === 'organisation_primary_master_unique'
  );

  assert.ok(index);
  assert.deepEqual(index[1].partialFilterExpression, {
    isPrimaryMaster: true,
  });
});

test('a valid Primary Master passes asynchronous model validation', async () => {
  await makePrimaryMaster().validate();
});

test('Primary Master validation rejects role demotion', async () => {
  await assert.rejects(
    makePrimaryMaster({ role: 'OWNER' }).validate(),
    /Primary Master must retain the MASTER role/
  );
});

test('Primary Master validation rejects account deactivation', async () => {
  await assert.rejects(
    makePrimaryMaster({ accountStatus: 'DISABLED' }).validate(),
    /Primary Master account must remain active/
  );
});

test('Primary Master validation rejects a primary cafe restriction', async () => {
  await assert.rejects(
    makePrimaryMaster({ primaryCafeId: 'CAFE-001' }).validate(),
    /cannot be restricted to a primary café/
  );
});

test('Primary Master validation rejects assigned cafe restrictions', async () => {
  await assert.rejects(
    makePrimaryMaster({ assignedCafeIds: ['CAFE-001'] }).validate(),
    /cannot be restricted to assigned cafés/
  );
});

test('non-Primary-Master designation metadata is rejected', async () => {
  await assert.rejects(
    makeRegularMaster({
      primaryMasterDesignatedAt: new Date('2026-08-06T00:00:00.000Z'),
      primaryMasterDesignatedBy: 'MU-0002',
      primaryMasterDesignationReason: 'Invalid metadata.',
    }).validate(),
    /designation metadata requires isPrimaryMaster to be true/
  );
});

test('a regular scoped user remains valid and cafe IDs are normalized', async () => {
  const user = new User({
    userId: 'OW-0001',
    organisationId: 'ORG-TEST',
    name: 'Owner User',
    email: 'owner@example.com',
    role: 'OWNER',
    accountStatus: 'ACTIVE',
    primaryCafeId: 'cafe-001',
    assignedCafeIds: ['cafe-001', 'CAFE-001'],
    passwordHash: 'test-password-hash',
    createdBy: 'MU-0001',
  });

  await user.validate();

  assert.equal(user.primaryCafeId, 'CAFE-001');
  assert.deepEqual(user.assignedCafeIds, ['CAFE-001']);
});

test('bootstrap candidate validation accepts only an active organisation-wide MASTER', () => {
  assert.doesNotThrow(() =>
    assertPrimaryMasterCandidate({
      user: candidate(),
      organisationId: 'ORG-TEST',
    })
  );

  assert.throws(
    () =>
      assertPrimaryMasterCandidate({
        user: candidate({ role: 'OWNER' }),
        organisationId: 'ORG-TEST',
      }),
    /must have the MASTER role/
  );

  assert.throws(
    () =>
      assertPrimaryMasterCandidate({
        user: candidate({ accountStatus: 'SUSPENDED' }),
        organisationId: 'ORG-TEST',
      }),
    /must have an ACTIVE account/
  );

  assert.throws(
    () =>
      assertPrimaryMasterCandidate({
        user: candidate({ assignedCafeIds: ['CAFE-001'] }),
        organisationId: 'ORG-TEST',
      }),
    /cannot be restricted to café assignments/
  );

  assert.throws(
    () =>
      assertPrimaryMasterCandidate({
        user: candidate({ organisationId: 'ORG-OTHER' }),
        organisationId: 'ORG-TEST',
      }),
    /belongs to a different organisation/
  );
});

test('bootstrap preserves one valid existing Primary Master without database writes', async () => {
  const primaryMaster = makePrimaryMaster();
  const originalFind = User.find;

  User.find = (filter) => ({
    sort: async () =>
      filter.isPrimaryMaster === true
        ? [primaryMaster]
        : [],
  });

  try {
    const result = await seedMasterUser({
      organisationId: 'ORG-TEST',
      masterName: 'Ignored',
      masterEmail: 'ignored@example.com',
      masterPassword: 'IgnoredPassword123!',
    });

    assert.equal(result, primaryMaster);
  } finally {
    User.find = originalFind;
  }
});

test('bootstrap permits additional non-primary MASTER accounts when a valid Primary Master exists', async () => {
  const primaryMaster = makePrimaryMaster();
  const additionalMaster = makeRegularMaster();
  const originalFind = User.find;
  let primaryQueryCount = 0;

  User.find = (filter) => ({
    sort: async () => {
      if (filter.isPrimaryMaster === true) {
        primaryQueryCount += 1;
        return [primaryMaster];
      }

      return [primaryMaster, additionalMaster];
    },
  });

  try {
    const result = await seedMasterUser({
      organisationId: 'ORG-TEST',
      masterName: 'Ignored',
      masterEmail: 'ignored@example.com',
      masterPassword: 'IgnoredPassword123!',
    });

    assert.equal(result, primaryMaster);
    assert.equal(primaryQueryCount, 1);
  } finally {
    User.find = originalFind;
  }
});

test('bootstrap keeps duplicate MASTER email lookup scoped to the organisation', async () => {
  const originalFind = User.find;
  const originalFindOne = User.findOne;
  let duplicateEmailFilter = null;

  User.find = () => ({
    sort: async () => [],
  });

  User.findOne = async (filter) => {
    duplicateEmailFilter = filter;
    return {
      userId: 'OW-0999',
    };
  };

  try {
    await assert.rejects(
      seedMasterUser({
        organisationId: 'ORG-TEST',
        masterName: 'New Primary Master',
        masterEmail: 'shared@example.com',
        masterPassword: 'IgnoredPassword123!',
      }),
      /MASTER email is already used/
    );

    assert.deepEqual(duplicateEmailFilter, {
      organisationId: 'ORG-TEST',
      email: 'shared@example.com',
    });
  } finally {
    User.find = originalFind;
    User.findOne = originalFindOne;
  }
});
test('bootstrap rejects an archived Primary Master instead of creating a replacement', async () => {
  const archivedPrimaryMaster =
    makePrimaryMaster({
      accountStatus: 'ARCHIVED',
    });
  const originalFind = User.find;

  User.find = (filter) => ({
    sort: async () =>
      filter.isPrimaryMaster === true
        ? [archivedPrimaryMaster]
        : [],
  });

  try {
    await assert.rejects(
      seedMasterUser({
        organisationId: 'ORG-TEST',
        masterName: 'Ignored',
        masterEmail: 'ignored@example.com',
        masterPassword: 'IgnoredPassword123!',
      }),
      /must have an ACTIVE account/
    );
  } finally {
    User.find = originalFind;
  }
});

test('bootstrap rejects ambiguous multiple MASTER accounts', async () => {
  const first = makeRegularMaster();
  const second = makeRegularMaster({
    userId: 'MU-0003',
    email: 'second.master@example.com',
  });
  const originalFind = User.find;

  User.find = (filter) => ({
    sort: async () =>
      filter.isPrimaryMaster === true
        ? []
        : [first, second],
  });

  try {
    await assert.rejects(
      seedMasterUser({
        organisationId: 'ORG-TEST',
        masterName: 'Ignored',
        masterEmail: 'ignored@example.com',
        masterPassword: 'IgnoredPassword123!',
      }),
      /Multiple MASTER accounts exist and no Primary Master can be selected automatically/
    );
  } finally {
    User.find = originalFind;
  }
});

test('bootstrap safely designates one eligible legacy MASTER', async () => {
  const legacyMaster = makeRegularMaster();
  const designatedMaster = makePrimaryMaster({
    userId: legacyMaster.userId,
    email: legacyMaster.email,
  });
  const originalFind = User.find;
  const originalFindById = User.findById;
  const originalUpdateOne = User.collection.updateOne;
  let updateArguments = null;

  User.find = (filter) => ({
    sort: async () =>
      filter.isPrimaryMaster === true
        ? []
        : [legacyMaster],
  });
  User.findById = async () => designatedMaster;
  User.collection.updateOne = async (...args) => {
    updateArguments = args;
    return {
      matchedCount: 1,
      modifiedCount: 1,
    };
  };

  try {
    const result = await seedMasterUser({
      organisationId: 'ORG-TEST',
      masterName: 'Ignored',
      masterEmail: 'ignored@example.com',
      masterPassword: 'IgnoredPassword123!',
    });

    assert.equal(result, designatedMaster);
    assert.ok(updateArguments);
    assert.equal(updateArguments[0]._id, legacyMaster._id);
    assert.equal(updateArguments[0].organisationId, 'ORG-TEST');
    assert.equal(updateArguments[1].$set.isPrimaryMaster, true);
    assert.equal(
      updateArguments[1].$set.primaryMasterDesignatedBy,
      legacyMaster.userId
    );
    assert.equal(updateArguments[1].$push.roleHistory.toRole, 'MASTER');
  } finally {
    User.find = originalFind;
    User.findById = originalFindById;
    User.collection.updateOne = originalUpdateOne;
  }
});
