'use strict';

/**
 * TASK ROUTES
 * Mounted at: /api/v1/tasks (registered in routes/index.js)
 */

const express = require('express');
const { authenticate } = require('../middleware/authenticate');
const { authorize } = require('../middleware/authorize');
const {
  listTasks,
  createTask,
  updateTaskStatus,
} = require('../controllers/taskController');

const router = express.Router();

router.use(authenticate);

router.get(
  '/',
  authorize('TASKS_READ', { allowedRoles: ['MASTER', 'OWNER', 'CAFE_ADMIN', 'STAFF'] }),
  listTasks
);

router.post(
  '/',
  authorize('TASKS_WRITE', { allowedRoles: ['MASTER', 'OWNER', 'CAFE_ADMIN'] }),
  createTask
);

router.patch(
  '/:taskId/status',
  authorize('TASKS_WRITE', { allowedRoles: ['MASTER', 'OWNER', 'CAFE_ADMIN', 'STAFF'] }),
  updateTaskStatus
);

module.exports = router;
