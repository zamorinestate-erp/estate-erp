'use strict';

const path = require('node:path');
module.paths.push(path.join(__dirname, '../../backend/node_modules'));

const { errorHandler } = require('../../backend/src/middleware/errorHandler');

function simulateError(error, reqUrl) {
  let responseData = null;
  let responseStatus = null;

  const req = { originalUrl: reqUrl, url: reqUrl };
  const res = {
    headersSent: false,
    status(code) {
      responseStatus = code;
      return this;
    },
    json(data) {
      responseData = data;
      return this;
    },
  };
  const next = () => {};

  errorHandler(error, req, res, next);
  return { status: responseStatus, body: responseData };
}

function runTests() {
  console.log(`[E11000 DOMAIN MAPPING TEST] Running domain error classification tests...`);

  // 1. Attendance Duplicate Error
  const attError = new Error('E11000 duplicate key error collection: zamorin.attendance index: organisation_user_date_unique');
  attError.code = 11000;
  const res1 = simulateError(attError, '/api/v1/attendance/check-in');
  console.log(`Test 1 (Attendance): status=${res1.status}, code=${res1.body.error.code}`);

  // 2. User Duplicate Error
  const userError = new Error('E11000 duplicate key error collection: zamorin.users index: email_1');
  userError.code = 11000;
  const res2 = simulateError(userError, '/api/v1/users');
  console.log(`Test 2 (User Email): status=${res2.status}, code=${res2.body.error.code}`);

  // 3. Vendor Duplicate Error
  const vendorError = new Error('E11000 duplicate key error collection: zamorin.vendors index: vendorId_1');
  vendorError.code = 11000;
  const res3 = simulateError(vendorError, '/api/v1/vendors');
  console.log(`Test 3 (Vendor ID): status=${res3.status}, code=${res3.body.error.code}`);

  // 4. General Duplicate Fallback
  const genError = new Error('E11000 duplicate key error collection: zamorin.other index: custom_key_1');
  genError.code = 11000;
  const res4 = simulateError(genError, '/api/v1/other');
  console.log(`Test 4 (General Conflict): status=${res4.status}, code=${res4.body.error.code}`);

  const pass =
    res1.status === 409 && res1.body.error.code === 'ATTENDANCE_ALREADY_EXISTS' &&
    res2.status === 409 && res2.body.error.code === 'USER_ALREADY_EXISTS' &&
    res3.status === 409 && res3.body.error.code === 'VENDOR_ALREADY_EXISTS' &&
    res4.status === 409 && res4.body.error.code === 'DUPLICATE_KEY_CONFLICT';

  console.log(`\nDomain E11000 Mapping Result: ${pass ? 'PASS' : 'FAIL'}`);
  process.exit(pass ? 0 : 1);
}

runTests();
