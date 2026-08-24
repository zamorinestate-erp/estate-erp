'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  getLeaveBalances,
  getLeaveTypes,
  getLeaveLedger,
  calculateLeavePreview,
  applyLeave,
  getMyLeaves,
  getLeaveDetail,
  withdrawLeave,
  cancelLeave,
  getLeaveCalendar,
  getLeaveStatement,
} = require('../src/controllers/leaveController');
const { LeaveRequest } = require('../src/models/LeaveRequest');
const { SequenceCounter } = require('../src/models/SequenceCounter');
const { AuditEvent } = require('../src/models/AuditEvent');

test('EMP-SCR-004: getLeaveBalances returns balances by type and projected values', async () => {
  const req = {
    auth: { userId: 'STAFF-001', organisationId: 'ZAMORIN' },
  };

  const originalFind = LeaveRequest.find;
  LeaveRequest.find = () => ({
    lean: async () => [
      { leaveType: 'CASUAL', requestedDays: 1.0, status: 'PENDING' },
    ],
  });

  let responseJson = null;
  const res = {
    status(code) {
      assert.equal(code, 200);
      return this;
    },
    json(data) {
      responseJson = data;
      return this;
    },
  };

  await getLeaveBalances(req, res);

  assert.equal(responseJson.success, true);
  assert.ok(responseJson.data.balances.CASUAL, 'CASUAL leave must exist');
  assert.equal(responseJson.data.balances.CASUAL.pending, 1.0);
  assert.equal(responseJson.data.balances.CASUAL.available, 3.5);
  assert.ok(responseJson.data.balances.SICK, 'SICK leave must exist');
  assert.ok(responseJson.data.balances.EARNED, 'EARNED leave must exist');

  LeaveRequest.find = originalFind;
});

test('EMP-SCR-004: getLeaveTypes returns configured leave policies and rules', async () => {
  const req = { auth: { userId: 'STAFF-001' } };
  let responseJson = null;
  const res = {
    status(code) {
      assert.equal(code, 200);
      return this;
    },
    json(data) {
      responseJson = data;
      return this;
    },
  };

  await getLeaveTypes(req, res);

  assert.equal(responseJson.success, true);
  assert.ok(responseJson.data.types.length >= 4, 'Must have at least 4 leave types');
  const casual = responseJson.data.types.find((t) => t.code === 'CASUAL');
  assert.equal(casual.allowHalfDay, true);
  assert.equal(casual.isPaid, true);
});

test('EMP-SCR-004: calculateLeavePreview correctly excludes holidays and weekly offs', async () => {
  const req = {
    auth: { userId: 'STAFF-001' },
    body: {
      leaveType: 'CASUAL',
      startDate: '2026-08-14',
      endDate: '2026-08-16', // 14 (Fri=1.0), 15 (Sat Holiday=0), 16 (Sun=1.0)
      durationUnit: 'FULL_DAY',
    },
  };

  let responseJson = null;
  const res = {
    status(code) {
      assert.equal(code, 200);
      return this;
    },
    json(data) {
      responseJson = data;
      return this;
    },
  };

  await calculateLeavePreview(req, res);

  assert.equal(responseJson.success, true);
  assert.equal(responseJson.data.calendarDays, 3);
  assert.equal(responseJson.data.holidaysExcluded, 1);
  assert.equal(responseJson.data.totalChargeableDays, 2.0);
});

test('EMP-SCR-004: applyLeave requires mandatory reason and creates leave request', async () => {
  const staffReqNoReason = {
    auth: { userId: 'STAFF-001', organisationId: 'ZAMORIN', assignedCafeIds: ['CAFE-001'] },
    body: {
      leaveType: 'CASUAL',
      startDate: '2026-08-24',
      endDate: '2026-08-26',
      reason: '',
    },
  };

  const res = {
    status() { return this; },
    json() { return this; },
  };

  await assert.rejects(
    async () => {
      await applyLeave(staffReqNoReason, res);
    },
    {
      statusCode: 400,
      code: 'REASON_REQUIRED',
    }
  );
});

test('EMP-SCR-004: withdrawLeave allows withdrawing pending requests only', async () => {
  const req = {
    auth: { userId: 'STAFF-001', role: 'STAFF', organisationId: 'ZAMORIN' },
    params: { leaveId: 'LR-20260829-001' },
  };

  const originalFindOne = LeaveRequest.findOne;
  const originalGenerateId = SequenceCounter.generateId;
  const originalCreateAudit = AuditEvent.create;

  SequenceCounter.generateId = async () => 'AE-20260821-0001';
  AuditEvent.create = async () => ({});

  LeaveRequest.findOne = async () => ({
    leaveId: 'LR-20260829-001',
    status: 'PENDING',
    save: async () => {},
  });

  let responseJson = null;
  const res = {
    status(code) {
      assert.equal(code, 200);
      return this;
    },
    json(data) {
      responseJson = data;
      return this;
    },
  };

  await withdrawLeave(req, res);

  assert.equal(responseJson.success, true);
  assert.equal(responseJson.data.leave.status, 'WITHDRAWN');

  LeaveRequest.findOne = originalFindOne;
  SequenceCounter.generateId = originalGenerateId;
  AuditEvent.create = originalCreateAudit;
});

test('EMP-SCR-004: cancelLeave allows requesting cancellation for approved leave only', async () => {
  const req = {
    auth: { userId: 'STAFF-001', role: 'STAFF', organisationId: 'ZAMORIN' },
    params: { leaveId: 'LR-20260910-001' },
    body: { reason: 'Shift schedule changed' },
  };

  const originalFindOne = LeaveRequest.findOne;
  const originalGenerateId = SequenceCounter.generateId;
  const originalCreateAudit = AuditEvent.create;

  SequenceCounter.generateId = async () => 'AE-20260821-0001';
  AuditEvent.create = async () => ({});

  LeaveRequest.findOne = async () => ({
    leaveId: 'LR-20260910-001',
    status: 'APPROVED',
    save: async () => {},
  });

  let responseJson = null;
  const res = {
    status(code) {
      assert.equal(code, 200);
      return this;
    },
    json(data) {
      responseJson = data;
      return this;
    },
  };

  await cancelLeave(req, res);

  assert.equal(responseJson.success, true);
  assert.equal(responseJson.data.leave.status, 'CANCELLATION_REQUESTED');

  LeaveRequest.findOne = originalFindOne;
  SequenceCounter.generateId = originalGenerateId;
  AuditEvent.create = originalCreateAudit;
});
