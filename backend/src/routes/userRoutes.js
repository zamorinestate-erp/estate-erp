'use strict';

const express = require('express');

const {
  authenticate,
  requireStepUpAuthentication,
} = require('../middleware/authenticate');

const {
  authorize,
  requireReason,
} = require('../middleware/authorize');

const {
  listUsers,
  getUser,
  createUser,
  updateUser,
  changeUserStatus,
  archiveUser,
} = require('../controllers/userController');

const router = express.Router();

const authorizeUserAdministration =
  authorize(
    'USER:MANAGE',
    {
      allowedRoles: ['MASTER'],
      absoluteRestriction:
        'MASTER_USER_ADMINISTRATION',
      targetUserIdResolver:
        (request) =>
          request.params?.userId ||
          null,
    }
  );

const userAdministrationGuards = [
  authorizeUserAdministration,
  requireStepUpAuthentication,
  requireReason,
];

router.use(authenticate);

router
  .route('/')
  .get(listUsers)
  .post(
    ...userAdministrationGuards,
    createUser
  );

router
  .route('/:userId')
  .get(getUser)
  .patch(
    ...userAdministrationGuards,
    updateUser
  );

router.patch(
  '/:userId/status',
  ...userAdministrationGuards,
  changeUserStatus
);

router.post(
  '/:userId/archive',
  ...userAdministrationGuards,
  archiveUser
);

module.exports = router;
