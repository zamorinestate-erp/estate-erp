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
  getTask,
  createTask,
  updateTaskStatus,
  completeTask,
  verifyTask,
  returnTask,
  reopenTask,
  cancelTask,
  blockTask,
  reassignTask,
} = require('../controllers/taskController');

const router = express.Router();

router.use(authenticate);

router.get(
  '/',
  authorize('TASKS_READ', { allowedRoles: ['MASTER', 'OWNER', 'CAFE_ADMIN', 'STAFF'] }),
  listTasks
);

router.get(
  '/:taskId',
  authorize('TASKS_READ', { allowedRoles: ['MASTER', 'OWNER', 'CAFE_ADMIN', 'STAFF'] }),
  getTask
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

router.post(
  '/:taskId/complete',
  authorize('TASKS_WRITE', { allowedRoles: ['MASTER', 'OWNER', 'CAFE_ADMIN', 'STAFF'] }),
  completeTask
);

router.post(
  '/:taskId/verify',
  authorize('TASKS_WRITE', { allowedRoles: ['MASTER', 'OWNER', 'CAFE_ADMIN'] }),
  verifyTask
);

router.post(
  '/:taskId/approve',
  authorize('TASKS_WRITE', { allowedRoles: ['MASTER', 'OWNER', 'CAFE_ADMIN'] }),
  verifyTask
);

router.post(
  '/:taskId/return',
  authorize('TASKS_WRITE', { allowedRoles: ['MASTER', 'OWNER', 'CAFE_ADMIN'] }),
  returnTask
);

router.post(
  '/:taskId/reject',
  authorize('TASKS_WRITE', { allowedRoles: ['MASTER', 'OWNER', 'CAFE_ADMIN'] }),
  returnTask
);

router.post(
  '/:taskId/reopen',
  authorize('TASKS_WRITE', { allowedRoles: ['MASTER', 'OWNER', 'CAFE_ADMIN'] }),
  reopenTask
);

router.post(
  '/:taskId/cancel',
  authorize('TASKS_WRITE', { allowedRoles: ['MASTER', 'OWNER', 'CAFE_ADMIN'] }),
  cancelTask
);

router.post(
  '/:taskId/block',
  authorize('TASKS_WRITE', { allowedRoles: ['MASTER', 'OWNER', 'CAFE_ADMIN'] }),
  blockTask
);

router.post(
  '/:taskId/assign',
  authorize('TASKS_WRITE', { allowedRoles: ['MASTER', 'OWNER', 'CAFE_ADMIN'] }),
  reassignTask
);

router.patch(
  '/:taskId/assign',
  authorize('TASKS_WRITE', { allowedRoles: ['MASTER', 'OWNER', 'CAFE_ADMIN'] }),
  reassignTask
);

module.exports = router;
