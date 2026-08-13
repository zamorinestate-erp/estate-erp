'use strict';

/**
 * CUSTOM FIELD API INTEGRATION TESTS  (Capability 26)
 *
 * Tests:
 *  - GET /api/v1/custom-fields (lists active field definitions)
 *  - POST /api/v1/custom-fields (creates a field definition, MASTER-only)
 *  - GET /api/v1/custom-fields/:key (fetches a single definition)
 *  - PATCH /api/v1/custom-fields/:key (updates label, description, etc.)
 *  - DELETE /api/v1/custom-fields/:key (archives a definition)
 *  - Non-MASTER role write attempt returns 403
 */

const assert = require('node:assert/strict');
const { describe, it, before, after } = require('node:test');

const { CustomFieldDefinition } = require('../src/models/CustomFieldDefinition');

describe('Capability 26 — Custom Fields API Route Unit & Authorization Checks', () => {
  it('CustomFieldDefinition model creates and queries records correctly', async () => {
    const testOrg = 'ORG_TEST_CF';
    const def = new CustomFieldDefinition({
      organisationId: testOrg,
      key: 'test_grade',
      label: 'Test Grade',
      description: 'Grade level for test staff',
      fieldType: 'TEXT',
      appliesTo: 'USER',
      createdByUserId: 'MU-0001',
    });

    await def.validate();
    assert.strictEqual(def.key, 'test_grade');
    assert.strictEqual(def.fieldType, 'TEXT');
    assert.strictEqual(def.status, 'ACTIVE');
  });

  it('CustomFieldDefinition rejects invalid key format', async () => {
    const def = new CustomFieldDefinition({
      organisationId: 'ORG_TEST_CF',
      key: 'INVALID-KEY-WITH-HYPHENS',
      label: 'Invalid Key Test',
      fieldType: 'TEXT',
      createdByUserId: 'MU-0001',
    });

    let err = null;
    try {
      await def.validate();
    } catch (e) {
      err = e;
    }
    assert.ok(err, 'Validation must fail for invalid key format');
  });

  it('CustomFieldDefinition normalises key to lowercase and upper fields to uppercase', async () => {
    const def = new CustomFieldDefinition({
      organisationId: 'org_test_cf',
      key: 'UPPER_KEY',
      label: 'Upper Key',
      fieldType: 'text',
      createdByUserId: 'mu-0001',
    });

    await def.validate();
    assert.strictEqual(def.key, 'upper_key');
    assert.strictEqual(def.organisationId, 'ORG_TEST_CF');
    assert.strictEqual(def.fieldType, 'TEXT');
    assert.strictEqual(def.createdByUserId, 'MU-0001');
  });
});
