'use strict';

/**
 * CAPABILITY 26 — CUSTOM FIELDS
 *
 * Tests schema completeness and validation rules for:
 *   - User.customFields Map (arbitrary metadata store)
 *   - CustomFieldDefinition model (org-level field registry)
 */

const assert = require('node:assert/strict');
const { describe, it } = require('node:test');

const { User } = require('../src/models/User.js');
const {
  CustomFieldDefinition,
  FIELD_TYPES,
  FIELD_STATUSES,
} = require('../src/models/CustomFieldDefinition.js');

// ── User.customFields Map ─────────────────────────────────────────────────────

describe('Capability 26 — User.customFields Map field', () => {
  it('User schema contains customFields as a Map', () => {
    const path = User.schema.path('customFields');
    assert.ok(path, 'customFields must be present on User schema');
    // Mongoose Map paths have instance === 'Map'
    assert.strictEqual(
      path.instance,
      'Map',
      'customFields must be a Mongoose Map type'
    );
  });

  it('customFields defaults to an empty Map', () => {
    const defaultVal = User.schema.path('customFields').defaultValue;
    // default is a function returning new Map()
    assert.strictEqual(typeof defaultVal, 'function');
    const m = defaultVal();
    assert.ok(m instanceof Map, 'default must return a Map instance');
    assert.strictEqual(m.size, 0, 'default Map must be empty');
  });
});

// ── CustomFieldDefinition model ───────────────────────────────────────────────

describe('Capability 26 — CustomFieldDefinition model schema', () => {
  it('FIELD_TYPES exports the six supported types', () => {
    const expected = ['TEXT', 'LONG_TEXT', 'NUMBER', 'BOOLEAN', 'DATE', 'SELECT'];
    for (const t of expected) {
      assert.ok(FIELD_TYPES.includes(t), `FIELD_TYPES must include ${t}`);
    }
    assert.strictEqual(FIELD_TYPES.length, expected.length);
  });

  it('FIELD_STATUSES exports ACTIVE and ARCHIVED', () => {
    assert.ok(FIELD_STATUSES.includes('ACTIVE'));
    assert.ok(FIELD_STATUSES.includes('ARCHIVED'));
  });

  it('key field enforces alphanumeric-underscore pattern via regex', () => {
    const path = CustomFieldDefinition.schema.path('key');
    assert.ok(path, 'key must be present');
    const regex = path.options.match;
    assert.ok(regex, 'key must have a match regex');
    assert.ok(regex.test('staff_grade'), 'must accept valid key');
    assert.ok(regex.test('field1'), 'must accept alphanumeric key');
    assert.ok(!regex.test('bad-key'), 'must reject hyphen');
    assert.ok(!regex.test('bad key'), 'must reject spaces');
    assert.ok(!regex.test(''), 'must reject empty string');
  });

  it('appliesTo is immutable and defaults to USER', () => {
    const path = CustomFieldDefinition.schema.path('appliesTo');
    assert.ok(path, 'appliesTo must be present');
    assert.strictEqual(path.options.immutable, true);
    assert.strictEqual(path.options.default, 'USER');
  });

  it('fieldType is required and enum-restricted', () => {
    const path = CustomFieldDefinition.schema.path('fieldType');
    assert.ok(path, 'fieldType must be present');
    assert.ok(path.options.required, 'fieldType must be required');
    for (const t of FIELD_TYPES) {
      assert.ok(
        path.options.enum.includes(t),
        `fieldType enum must include ${t}`
      );
    }
  });

  it('organisationId is required and immutable', () => {
    const path = CustomFieldDefinition.schema.path('organisationId');
    assert.ok(path.options.required, 'organisationId must be required');
    assert.ok(path.options.immutable, 'organisationId must be immutable');
  });

  it('status defaults to ACTIVE', () => {
    const path = CustomFieldDefinition.schema.path('status');
    assert.strictEqual(path.options.default, 'ACTIVE');
  });

  it('displayOrder defaults to 0 and has min 0', () => {
    const path = CustomFieldDefinition.schema.path('displayOrder');
    assert.strictEqual(path.options.default, 0);
    assert.strictEqual(path.options.min, 0);
  });

  it('org_key_unique compound index is defined', () => {
    const indexes = CustomFieldDefinition.schema.indexes();
    const hasOrgKey = indexes.some(
      ([fields, opts]) =>
        fields.organisationId === 1 &&
        fields.key === 1 &&
        opts.unique === true
    );
    assert.ok(hasOrgKey, 'org_key_unique compound unique index must exist');
  });

  it('allowedValues defaults to empty array', () => {
    const path = CustomFieldDefinition.schema.path('allowedValues');
    assert.ok(Array.isArray(path.options.default), 'allowedValues must default to array');
  });
});
