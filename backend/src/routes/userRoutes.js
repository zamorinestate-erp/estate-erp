'use strict';

const express = require('express');

const {
  authenticate,
} = require('../middleware/authenticate');

const {
  listUsers,
  getUser,
  createUser,
  updateUser,
  changeUserStatus,
  archiveUser,
} = require('../controllers/userController');

const router = express.Router();

router.use(authenticate);

router
  .route('/')
  .get(listUsers)
  .post(createUser);

router
  .route('/:userId')
  .get(getUser)
  .patch(updateUser);

router.patch(
  '/:userId/status',
  changeUserStatus
);

router.post(
  '/:userId/archive',
  archiveUser
);

module.exports = router;