'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  getServerTime,
  getStaffPolicy,
  getStaffToday,
  staffCheckIn,
  staffCheckOut,
  getStaffHistory,
  requestStaffCorrection,
  recordStaffAttestation,
} = require('../src/modules/attendance/attendanceController');
const { Attendance } = require('../src/modules/attendance/Attendance');

test('EMP-SCR-003: getServerTime returns server-verified IST and UTC timestamps', async () => {
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

  await getServerTime(req, res);

  assert.equal(responseJson.success, true);
  assert.ok(responseJson.data.utc, 'utc must be present');
  assert.ok(responseJson.data.istDisplay.includes('IST'), 'istDisplay must include IST');
});

test('EMP-SCR-003: getStaffPolicy returns effective verification requirements', async () => {
  const req = {
    auth: { userId: 'STAFF-001', assignedCafeIds: ['CAFE-001'] },
    query: {},
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

  await getStaffPolicy(req, res);

  assert.equal(responseJson.success, true);
  assert.equal(responseJson.data.verificationMode, 'SECURE');
  assert.equal(responseJson.data.geofenceEnabled, true);
  assert.equal(responseJson.data.liveSelfieRequired, true);
  assert.equal(responseJson.data.rotatingQrRequired, true);
});

test('EMP-SCR-003: staffCheckIn records check-in and rejects duplicate check-in (400)', async () => {
  const staffReq = {
    auth: {
      userId: 'STAFF-001',
      role: 'STAFF',
      organisationId: 'ZAMORIN',
      assignedCafeIds: ['CAFE-001'],
    },
    body: {
      cafeId: 'CAFE-001',
      latitude: 12.9352,
      longitude: 77.6245,
      qrToken: 'QR-TOKEN-VALID',
    },
  };

  const originalFindOne = Attendance.findOne;
  Attendance.findOne = async () => ({
    status: 'CHECKED_IN',
  });

  const res = {
    status() { return this; },
    json() { return this; },
  };

  await assert.rejects(
    async () => {
      await staffCheckIn(staffReq, res);
    },
    {
      statusCode: 400,
      code: 'ALREADY_CHECKED_IN',
    }
  );

  Attendance.findOne = originalFindOne;
});

test('EMP-SCR-003: staffCheckOut rejects if employee is not checked in (400)', async () => {
  const staffReq = {
    auth: {
      userId: 'STAFF-001',
      role: 'STAFF',
      organisationId: 'ZAMORIN',
    },
    body: {},
  };

  const originalFindOne = Attendance.findOne;
  Attendance.findOne = async () => null;

  const res = {
    status() { return this; },
    json() { return this; },
  };

  await assert.rejects(
    async () => {
      await staffCheckOut(staffReq, res);
    },
    {
      statusCode: 400,
      code: 'NOT_CHECKED_IN',
    }
  );

  Attendance.findOne = originalFindOne;
});

test('EMP-SCR-003: requestStaffCorrection requires attendanceId and mandatory reason', async () => {
  const staffReq = {
    auth: {
      userId: 'STAFF-001',
      role: 'STAFF',
      organisationId: 'ZAMORIN',
    },
    body: {
      attendanceId: 'AT-20260818-001',
      reason: '',
    },
  };

  const res = {
    status() { return this; },
    json() { return this; },
  };

  await assert.rejects(
    async () => {
      await requestStaffCorrection(staffReq, res);
    },
    {
      statusCode: 400,
      code: 'REASON_REQUIRED',
    }
  );
});

const { SequenceCounter } = require('../src/models/SequenceCounter');
const { AuditEvent } = require('../src/models/AuditEvent');

test('EMP-SCR-003: recordStaffAttestation records employee period review', async () => {
  const staffReq = {
    auth: {
      userId: 'STAFF-001',
      role: 'STAFF',
      organisationId: 'ZAMORIN',
    },
    body: {
      month: '2026-08',
      decision: 'CONFIRM_REVIEWED',
    },
  };

  const originalGenerateId = SequenceCounter.generateId;
  const originalCreate = AuditEvent.create;
  SequenceCounter.generateId = async () => 'AE-20260819-0001';
  AuditEvent.create = async () => ({});

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

  await recordStaffAttestation(staffReq, res);

  assert.equal(responseJson.success, true);
  assert.equal(responseJson.data.decision, 'CONFIRM_REVIEWED');
  assert.ok(responseJson.data.attestedAt, 'attestedAt must be recorded');

  SequenceCounter.generateId = originalGenerateId;
  AuditEvent.create = originalCreate;
});
