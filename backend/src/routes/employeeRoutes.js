'use strict';

const express = require('express');
const { authenticate } = require('../middleware/authenticate');
const { authorize } = require('../middleware/authorize');
const {
  getWorkforceOverview,
  listEmployees,
  getEmployee360,
  onboardEmployee,
  createEmployeeMovement,
  submitProbationReview,
  addEmployeeSkill,
  assignEmployeeTraining,
  generateEmployeeLetter,
  initiateOffboarding,
  getWorkforceIntegrity,
  listPositions,
  createPosition,
  listStaffingRequests,
  createStaffingRequest,
  getSelfDashboard,
  getSelfProfile,
  updateSelfProfile,
  listSelfChangeRequests,
  createSelfChangeRequest,
  withdrawSelfChangeRequest,
  getSelfProfileHistory,
  submitSelfProfileAttestation,
  searchEmployees,
  getEmployeeProfile,
} = require('../controllers/employeeController');

const router = express.Router();

router.use(authenticate);

// 1. Overview & Workforce KPIs
router.get(
  '/overview',
  authorize('EMPLOYEE:READ', { allowedRoles: ['MASTER', 'OWNER', 'CAFE_ADMIN'] }),
  getWorkforceOverview
);

// 2. Positions & Org Structure
router.get(
  '/positions',
  authorize('EMPLOYEE:READ', { allowedRoles: ['MASTER', 'OWNER', 'CAFE_ADMIN'] }),
  listPositions
);
router.post(
  '/positions',
  authorize('EMPLOYEE:WRITE', { allowedRoles: ['MASTER', 'OWNER'] }),
  createPosition
);

// 3. Staffing Requests
router.get(
  '/staffing-requests',
  authorize('EMPLOYEE:READ', { allowedRoles: ['MASTER', 'OWNER', 'CAFE_ADMIN'] }),
  listStaffingRequests
);
router.post(
  '/staffing-requests',
  authorize('EMPLOYEE:WRITE', { allowedRoles: ['MASTER', 'OWNER', 'CAFE_ADMIN'] }),
  createStaffingRequest
);

// 4. Workforce Integrity Checks
router.get(
  '/integrity',
  authorize('EMPLOYEE:READ', { allowedRoles: ['MASTER', 'OWNER'] }),
  getWorkforceIntegrity
);

// 5. Employee Directory Listing & Search
router.get(
  '/',
  authorize('EMPLOYEE:READ', { allowedRoles: ['MASTER', 'OWNER', 'CAFE_ADMIN'] }),
  listEmployees
);

router.get(
  '/search',
  authorize('EMPLOYEE:READ', { allowedRoles: ['MASTER', 'OWNER', 'CAFE_ADMIN'] }),
  searchEmployees
);

// 6. Onboard New Employee
router.post(
  '/',
  authorize('EMPLOYEE:WRITE', { allowedRoles: ['MASTER', 'OWNER'] }),
  onboardEmployee
);

// 7. Self Employee Dashboard & Self Profile (Self-Scoped Endpoints)
router.get(
  '/me/dashboard',
  authorize('EMPLOYEE:READ_SELF', {
    allowedRoles: ['MASTER', 'OWNER', 'CAFE_ADMIN', 'STAFF'],
    targetUserIdResolver: (req) => req.auth?.userId,
    selfOnly: true,
  }),
  getSelfDashboard
);

router.get(
  '/me',
  authorize('EMPLOYEE:READ_SELF', {
    allowedRoles: ['MASTER', 'OWNER', 'CAFE_ADMIN', 'STAFF'],
    targetUserIdResolver: (req) => req.auth?.userId,
    selfOnly: true,
  }),
  getSelfProfile
);

router.patch(
  '/me',
  authorize('EMPLOYEE:WRITE_SELF', {
    allowedRoles: ['MASTER', 'OWNER', 'CAFE_ADMIN', 'STAFF'],
    targetUserIdResolver: (req) => req.auth?.userId,
    selfOnly: true,
  }),
  updateSelfProfile
);

router.get(
  '/me/change-requests',
  authorize('EMPLOYEE:READ_SELF', {
    allowedRoles: ['MASTER', 'OWNER', 'CAFE_ADMIN', 'STAFF'],
    targetUserIdResolver: (req) => req.auth?.userId,
    selfOnly: true,
  }),
  listSelfChangeRequests
);

router.post(
  '/me/change-requests',
  authorize('EMPLOYEE:WRITE_SELF', {
    allowedRoles: ['MASTER', 'OWNER', 'CAFE_ADMIN', 'STAFF'],
    targetUserIdResolver: (req) => req.auth?.userId,
    selfOnly: true,
  }),
  createSelfChangeRequest
);

router.post(
  '/me/change-requests/:requestId/withdraw',
  authorize('EMPLOYEE:WRITE_SELF', {
    allowedRoles: ['MASTER', 'OWNER', 'CAFE_ADMIN', 'STAFF'],
    targetUserIdResolver: (req) => req.auth?.userId,
    selfOnly: true,
  }),
  withdrawSelfChangeRequest
);

router.get(
  '/me/history',
  authorize('EMPLOYEE:READ_SELF', {
    allowedRoles: ['MASTER', 'OWNER', 'CAFE_ADMIN', 'STAFF'],
    targetUserIdResolver: (req) => req.auth?.userId,
    selfOnly: true,
  }),
  getSelfProfileHistory
);

router.post(
  '/me/attestation',
  authorize('EMPLOYEE:WRITE_SELF', {
    allowedRoles: ['MASTER', 'OWNER', 'CAFE_ADMIN', 'STAFF'],
    targetUserIdResolver: (req) => req.auth?.userId,
    selfOnly: true,
  }),
  submitSelfProfileAttestation
);

// 8. Individual Employee Profile (Administrative Access Only; Staff use /me)
router.get(
  '/:userId',
  authorize('EMPLOYEE:READ', {
    allowedRoles: ['MASTER', 'OWNER', 'CAFE_ADMIN'],
    targetUserIdResolver: (req) => req.params?.userId,
  }),
  getEmployee360
);

router.get(
  '/:userId/360',
  authorize('EMPLOYEE:READ', {
    allowedRoles: ['MASTER', 'OWNER', 'CAFE_ADMIN'],
    targetUserIdResolver: (req) => req.params?.userId,
  }),
  getEmployee360
);

// 9. Employee Movements (Transfer / Promotion / Acting)
router.post(
  '/:userId/movements',
  authorize('EMPLOYEE:WRITE', { allowedRoles: ['MASTER', 'OWNER'] }),
  createEmployeeMovement
);

// 10. Probation Review
router.post(
  '/:userId/probation',
  authorize('EMPLOYEE:WRITE', { allowedRoles: ['MASTER', 'OWNER', 'CAFE_ADMIN'] }),
  submitProbationReview
);

// 11. Skills Verification
router.post(
  '/:userId/skills',
  authorize('EMPLOYEE:WRITE', { allowedRoles: ['MASTER', 'OWNER', 'CAFE_ADMIN'] }),
  addEmployeeSkill
);

// 12. Training Assignment
router.post(
  '/:userId/training',
  authorize('EMPLOYEE:WRITE', { allowedRoles: ['MASTER', 'OWNER', 'CAFE_ADMIN'] }),
  assignEmployeeTraining
);

// 13. Document & HR Letter Generation
router.post(
  '/:userId/documents/generate',
  authorize('EMPLOYEE:WRITE', { allowedRoles: ['MASTER', 'OWNER'] }),
  generateEmployeeLetter
);

// 14. Offboarding Initiation
router.post(
  '/:userId/offboard',
  authorize('EMPLOYEE:WRITE', { allowedRoles: ['MASTER', 'OWNER'] }),
  initiateOffboarding
);

module.exports = router;
