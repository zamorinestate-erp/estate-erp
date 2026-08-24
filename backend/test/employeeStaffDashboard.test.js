'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { getSelfDashboard } = require('../src/controllers/employeeController');
const { User } = require('../src/models/User');
const { Cafe } = require('../src/models/Cafe');

test('EMP-SCR-001: getSelfDashboard returns self-scoped aggregated dashboard payload', async () => {
  const staffReq = {
    auth: {
      userId: 'STAFF-TEST-001',
      role: 'STAFF',
      organisationId: 'ZAMORIN',
      primaryCafeId: 'CAFE-001',
      permissions: ['EMPLOYEE:READ_SELF'],
    },
  };

  const originalUserFindOne = User.findOne;
  User.findOne = (query) => ({
    lean: async () => {
      if (query.userId === 'STAFF-TEST-001') {
        return {
          userId: 'STAFF-TEST-001',
          name: 'Priya Nair',
          preferredName: 'Priya',
          email: 'priya@zamorin.cafe',
          role: 'STAFF',
          designation: 'Senior Barista',
          organisationId: 'ZAMORIN',
          primaryCafeId: 'CAFE-001',
          employmentStatus: 'ACTIVE',
          emergencyContact: {
            name: 'Kavita Nair',
            phone: '9876543210',
          },
        };
      }
      return null;
    },
  });

  const originalCafeFindOne = Cafe.findOne;
  Cafe.findOne = () => ({
    lean: async () => ({
      cafeId: 'CAFE-001',
      name: 'Dawn Roast',
      city: 'Koramangala',
    }),
  });

  let responseStatus = null;
  let responseJson = null;

  const mockRes = {
    status(code) {
      responseStatus = code;
      return this;
    },
    json(data) {
      responseJson = data;
      return this;
    },
  };

  await getSelfDashboard(staffReq, mockRes);

  assert.equal(responseStatus, 200);
  assert.equal(responseJson.success, true);
  assert.ok(responseJson.data.employee, 'Employee data must be present');
  assert.equal(responseJson.data.employee.userId, 'STAFF-TEST-001');
  assert.equal(responseJson.data.employee.name, 'Priya Nair');
  assert.equal(responseJson.data.employee.preferredName, 'Priya');

  // Verify dashboard sub-sections
  assert.ok(responseJson.data.todayShift, 'todayShift must be present');
  assert.ok(responseJson.data.nextShift, 'nextShift must be present');
  assert.ok(responseJson.data.attendanceSummary, 'attendanceSummary must be present');
  assert.ok(responseJson.data.leaveSummary, 'leaveSummary must be present');
  assert.ok(responseJson.data.payslipSummary, 'payslipSummary must be present');
  assert.ok(responseJson.data.loanSummary, 'loanSummary must be present');
  assert.ok(Array.isArray(responseJson.data.actionRequired), 'actionRequired must be an array');
  assert.ok(Array.isArray(responseJson.data.announcements), 'announcements must be an array');
  assert.ok(Array.isArray(responseJson.data.weekSchedule), 'weekSchedule must be an array');
  assert.equal(responseJson.data.weekSchedule.length, 7, 'Weekly schedule must cover 7 days');

  // Restore mocks
  User.findOne = originalUserFindOne;
  Cafe.findOne = originalCafeFindOne;
});

test('EMP-SCR-001: getSelfDashboard throws 404 if authenticated user not found', async () => {
  const staffReq = {
    auth: {
      userId: 'NON-EXISTENT',
      role: 'STAFF',
      organisationId: 'ZAMORIN',
    },
  };

  const originalUserFindOne = User.findOne;
  User.findOne = () => ({
    lean: async () => null,
  });

  const mockRes = {
    status() { return this; },
    json() { return this; },
  };

  await assert.rejects(
    async () => {
      await getSelfDashboard(staffReq, mockRes);
    },
    {
      statusCode: 404,
      code: 'USER_NOT_FOUND',
    }
  );

  User.findOne = originalUserFindOne;
});
