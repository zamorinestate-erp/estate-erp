'use strict';

const express = require('express');

const {
  authenticate,
} = require('../middleware/authenticate');

const {
  authorize,
} = require('../middleware/authorize');

const {
  searchEmployees,
  getSelfProfile,
  getEmployeeProfile,
} = require('../controllers/employeeController');

const router = express.Router();

router.use(authenticate);

const authorizeEmployeeRead = authorize(
  'EMPLOYEE:READ',
  {
    allowedRoles: [
      'MASTER',
      'OWNER',
      'CAFE_ADMIN',
    ],
  }
);

const authorizeEmployeeSelfRead = authorize(
  'EMPLOYEE:READ_SELF',
  {
    allowedRoles: ['STAFF'],
    targetUserIdResolver: (request) =>
      request.params?.userId ||
      request.auth?.userId,
    selfOnly: true,
  }
);

function authorizeEmployeeProfileRead(
  request,
  response,
  next
) {
  const middleware =
    request.auth?.role === 'STAFF'
      ? authorizeEmployeeSelfRead
      : authorizeEmployeeRead;

  return middleware(
    request,
    response,
    next
  );
}

// Search — MASTER and OWNER only (organisation-wide directory)
router.get(
  '/search',
  authorize(
    'EMPLOYEE:READ',
    {
      allowedRoles: [
        'MASTER',
        'OWNER',
      ],
    }
  ),
  searchEmployees
);

// Self profile — all four roles may retrieve their own record.
// MUST be registered before /:userId to prevent Express consuming
// the literal string "me" as a :userId parameter.
router.get(
  '/me',
  authorizeEmployeeProfileRead,
  getSelfProfile
);

// Full employee profile — role-aware serialization.
// STAFF hits this with their own userId; scope filter enforces self-only.
router.get(
  '/:userId',
  authorizeEmployeeProfileRead,
  getEmployeeProfile
);

module.exports = router;
