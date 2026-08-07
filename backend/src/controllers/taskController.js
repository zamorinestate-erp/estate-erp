'use strict';

/**
 * TASK CONTROLLER
 */

const {
  Task,
  TASK_PRIORITIES,
  TASK_STATUSES,
} = require('../models/Task');

const {
  SequenceCounter,
} = require('../models/SequenceCounter');

const {
  asyncHandler,
} = require('../utils/asyncHandler');

const {
  ApiError,
} = require('../utils/ApiError');

const {
  recordRequestAudit,
} = require('../services/auditService');

function normalizeId(value) {
  return typeof value === 'string'
    ? value.trim().toUpperCase()
    : '';
}

function parsePositiveInteger(value, fallback, maximum) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed < 1) return fallback;
  return Math.min(parsed, maximum);
}

const listTasks = asyncHandler(async (request, response) => {
  const page = parsePositiveInteger(request.query.page, 1, 1000);
  const limit = parsePositiveInteger(request.query.limit, 25, 100);
  const skip = (page - 1) * limit;

  const filter = { organisationId: request.auth.organisationId };
  const { cafeId, status, priority } = request.query;

  if (cafeId) filter.cafeId = normalizeId(cafeId);
  if (status && TASK_STATUSES.includes(status.toUpperCase())) filter.status = status.toUpperCase();
  if (priority && TASK_PRIORITIES.includes(priority.toUpperCase())) filter.priority = priority.toUpperCase();

  const [tasks, total] = await Promise.all([
    Task.find(filter)
      .select('-__v -version')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    Task.countDocuments(filter),
  ]);

  return response.status(200).json({
    success: true,
    data: {
      tasks,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    },
    correlationId: request.correlationId || null,
  });
});

const createTask = asyncHandler(async (request, response) => {
  const { title, description, cafeId, assignedRole, assignedUserId, priority, dueDate } = request.body;

  const titleText = typeof title === 'string' ? title.trim() : '';
  if (!titleText) {
    throw new ApiError(400, 'TITLE_REQUIRED', 'Task title is required.');
  }

  const seqId = await SequenceCounter.generateId({
    organisationId: request.auth.organisationId,
    sequenceKey: 'TASK',
    prefix: 'TSK',
    minimumDigits: 4,
  });

  const task = new Task({
    taskId: seqId,
    organisationId: request.auth.organisationId,
    cafeId: cafeId ? normalizeId(cafeId) : null,
    title: titleText,
    description: typeof description === 'string' ? description.trim() : '',
    assignedRole: assignedRole ? normalizeId(assignedRole) : 'CAFE_ADMIN',
    assignedUserId: assignedUserId ? normalizeId(assignedUserId) : null,
    priority: priority ? normalizeId(priority) : 'NORMAL',
    status: 'PENDING',
    dueDate: dueDate && /^\d{4}-\d{2}-\d{2}$/.test(dueDate) ? dueDate : null,
    createdByUserId: request.auth.userId,
  });

  await task.save();

  await recordRequestAudit({
    request,
    module: 'TASKS',
    action: 'CREATE_TASK',
    entityType: 'TASK',
    entityId: seqId,
    after: { taskId: seqId, title: titleText },
    result: 'SUCCESS',
    riskClassification: 'LOW',
  });

  return response.status(201).json({
    success: true,
    data: { task: task.toObject() },
    correlationId: request.correlationId || null,
  });
});

const updateTaskStatus = asyncHandler(async (request, response) => {
  const taskId = normalizeId(request.params.taskId);
  const { status } = request.body;

  const targetStatus = normalizeId(status);
  if (!TASK_STATUSES.includes(targetStatus)) {
    throw new ApiError(400, 'INVALID_STATUS', 'Invalid status.');
  }

  const task = await Task.findOne({
    taskId,
    organisationId: request.auth.organisationId,
  });

  if (!task) {
    throw new ApiError(404, 'NOT_FOUND', 'Task not found.');
  }

  task.status = targetStatus;
  if (targetStatus === 'COMPLETED') {
    task.completedByUserId = request.auth.userId;
    task.completedAt = new Date();
  }

  await task.save();

  await recordRequestAudit({
    request,
    module: 'TASKS',
    action: 'UPDATE_TASK_STATUS',
    entityType: 'TASK',
    entityId: taskId,
    after: { status: targetStatus },
    result: 'SUCCESS',
    riskClassification: 'LOW',
  });

  return response.status(200).json({
    success: true,
    data: { task: task.toObject() },
    correlationId: request.correlationId || null,
  });
});

module.exports = {
  listTasks,
  createTask,
  updateTaskStatus,
};
