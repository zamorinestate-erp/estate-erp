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
} = require('../controllers/employeeController');

const router = express.Router();

router.use(authenticate);

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

module.exports = router;
