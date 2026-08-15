'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { Shift } = require('../src/models/Shift');

test('Shift Model & Time Window Validation', async (t) => {
  await t.test('creates a valid Shift document', () => {
    const shift = new Shift({
      shiftId: 'SH-0001',
      organisationId: 'ZAMORIN',
      cafeId: 'ZC-0001',
      name: 'Morning Shift',
      startTime: '07:00',
      endTime: '15:00',
      graceMinutes: 15,
    });

    const err = shift.validateSync();
    assert.equal(err, undefined);
    assert.equal(shift.shiftId, 'SH-0001');
    assert.equal(shift.graceMinutes, 15);
    assert.equal(shift.isActive, true);
  });

  await t.test('rejects invalid shift time format', () => {
    const shift = new Shift({
      shiftId: 'SH-0002',
      organisationId: 'ZAMORIN',
      cafeId: 'ZC-0001',
      name: 'Invalid Shift',
      startTime: '25:99', // Invalid
      endTime: '15:00',
    });

    const err = shift.validateSync();
    assert.ok(err);
    assert.ok(err.errors.startTime);
  });
});
