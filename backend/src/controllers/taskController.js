'use strict';

/**
 * TASK CONTROLLER — OWN-SCR-002: Operational Task Oversight & Governance
 */

const {
  Task,
  TASK_PRIORITIES,
  TASK_STATUSES,
  TASK_CATEGORIES,
  TASK_RISK_LEVELS,
  VERIFICATION_STATUSES,
} = require('../models/Task');

const {
  SequenceCounter,
} = require('../models/SequenceCounter');

const {
  AuditEvent,
} = require('../models/AuditEvent');

const {
  asyncHandler,
} = require('../utils/asyncHandler');

const {
  ApiError,
} = require('../utils/ApiError');

const {
  recordRequestAudit,
} = require('../services/auditService');

const { resolveEffectiveCafeScope, assertResourceCafeOwnership } = require('../utils/cafeScope');

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

function getIstDateString(date = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

// ─── LIST TASKS WITH EXECUTIVE SUMMARY METRICS ────────────────────────────────

const listTasks = asyncHandler(async (request, response) => {
  const page = parsePositiveInteger(request.query.page, 1, 1000);
  const limit = parsePositiveInteger(request.query.limit, 25, 100);
  const skip = (page - 1) * limit;
  const today = getIstDateString();

  const effectiveCafe = resolveEffectiveCafeScope(request);
  const filter = { organisationId: request.auth.organisationId };
  const { cafeId, status, priority, category, risk, verificationStatus, isCriticalControl, exceptionsOnly, search } = request.query;

  // Scoping
  if (effectiveCafe) {
    filter.cafeId = effectiveCafe;
  } else if (cafeId && cafeId !== 'ALL') {
    filter.cafeId = normalizeId(cafeId);
  } else if (request.auth.role === 'OWNER') {
    filter.cafeId = { $in: request.auth.assignedCafeIds || [] };
  }

  // Filters
  if (status && TASK_STATUSES.includes(status.toUpperCase())) {
    filter.status = status.toUpperCase();
  }
  if (priority && TASK_PRIORITIES.includes(priority.toUpperCase())) {
    filter.priority = priority.toUpperCase();
  }
  if (category && TASK_CATEGORIES.includes(category.toUpperCase())) {
    filter.category = category.toUpperCase();
  }
  if (risk && TASK_RISK_LEVELS.includes(risk.toUpperCase())) {
    filter.risk = risk.toUpperCase();
  }
  if (verificationStatus && VERIFICATION_STATUSES.includes(verificationStatus.toUpperCase())) {
    filter.verificationStatus = verificationStatus.toUpperCase();
  }
  if (isCriticalControl === 'true') {
    filter.isCriticalControl = true;
  }

  // Exceptions Only Filter (Overdue, Critical, Blocked, Returned, Verification Pending)
  if (exceptionsOnly === 'true') {
    filter.$or = [
      { status: 'RETURNED_FOR_CORRECTION' },
      { status: 'BLOCKED' },
      { status: 'AWAITING_VERIFICATION' },
      { risk: 'CRITICAL', status: { $in: ['PENDING', 'IN_PROGRESS'] } },
      { dueDate: { $lt: today }, status: { $in: ['PENDING', 'IN_PROGRESS', 'AWAITING_VERIFICATION'] } },
    ];
  }

  // Search
  if (search && typeof search === 'string' && search.trim()) {
    const searchRegex = new RegExp(search.trim(), 'i');
    filter.$and = filter.$and || [];
    filter.$and.push({
      $or: [
        { taskId: searchRegex },
        { title: searchRegex },
        { description: searchRegex },
        { assignedUserId: searchRegex },
      ],
    });
  }

  // Summary Metrics Aggregation
  const baseScopeFilter = { organisationId: request.auth.organisationId };
  if (filter.cafeId) baseScopeFilter.cafeId = filter.cafeId;

  const [tasks, total, allScopeTasks] = await Promise.all([
    Task.find(filter)
      .select('-__v -version')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    Task.countDocuments(filter),
    Task.find(baseScopeFilter)
      .select('taskId status priority risk isCriticalControl dueDate completedAt createdAt verificationStatus')
      .lean(),
  ]);

  let totalOpen = 0;
  let overdueCount = 0;
  let dueTodayCount = 0;
  let criticalCount = 0;
  let verificationPendingCount = 0;
  let completedCount = 0;
  let onTimeCompletedCount = 0;

  for (const t of allScopeTasks) {
    const isOpen = ['PENDING', 'IN_PROGRESS', 'AWAITING_VERIFICATION', 'RETURNED_FOR_CORRECTION', 'BLOCKED'].includes(t.status);
    if (isOpen) {
      totalOpen++;
      if (t.dueDate && t.dueDate < today) overdueCount++;
      if (t.dueDate === today) dueTodayCount++;
      if (t.risk === 'CRITICAL' || t.priority === 'URGENT' || t.isCriticalControl) criticalCount++;
      if (t.status === 'AWAITING_VERIFICATION' || t.verificationStatus === 'PENDING_VERIFICATION') verificationPendingCount++;
    } else if (t.status === 'COMPLETED') {
      completedCount++;
      if (!t.dueDate || (t.completedAt && getIstDateString(t.completedAt) <= t.dueDate)) {
        onTimeCompletedCount++;
      }
    }
  }

  const onTimeRate = completedCount > 0 ? Math.round((onTimeCompletedCount / completedCount) * 100) : 100;

  return response.status(200).json({
    success: true,
    data: {
      tasks,
      summary: {
        totalOpen,
        overdueCount,
        dueTodayCount,
        criticalCount,
        verificationPendingCount,
        onTimeRate,
        totalScopeTasks: allScopeTasks.length,
      },
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    },
    correlationId: request.correlationId || null,
  });
});

// ─── GET SINGLE TASK DETAIL ───────────────────────────────────────────────────

const getTask = asyncHandler(async (request, response) => {
  const taskId = normalizeId(request.params.taskId);

  const query = Task.findOne({
    taskId,
    organisationId: request.auth.organisationId,
  });
  const task = query && typeof query.lean === 'function' ? await query.lean() : await query;

  if (!task) {
    throw new ApiError(404, 'TASK_NOT_FOUND', `Task ${taskId} not found.`);
  }

  assertResourceCafeOwnership(task, request, 'Task');

  let auditTrail = [];
  try {
    const auditQuery = AuditEvent.find({
      organisationId: request.auth.organisationId,
      'target.entityType': 'TASK',
      'target.entityId': taskId,
    });
    auditTrail = auditQuery && typeof auditQuery.sort === 'function'
      ? await auditQuery.sort({ createdAt: -1 }).limit(25).lean()
      : [];
  } catch (_) {
    auditTrail = [];
  }

  return response.status(200).json({
    success: true,
    data: { task, auditTrail },
    correlationId: request.correlationId || null,
  });
});

// ─── CREATE TASK (GOVERNED OWNER/ADMIN ASSIGNMENT) ─────────────────────────────

const createTask = asyncHandler(async (request, response) => {
  const {
    title,
    description,
    cafeId,
    category,
    risk,
    isCriticalControl,
    assignedRole,
    assignedUserId,
    responsibleUserId,
    priority,
    dueDate,
    dueTime,
    verificationRequired,
    checklist,
    sopReference,
    recurrence,
    source,
  } = request.body;

  const titleText = typeof title === 'string' ? title.trim() : '';
  if (!titleText) {
    throw new ApiError(400, 'TITLE_REQUIRED', 'Task title is required.');
  }

  const effectiveCafe = resolveEffectiveCafeScope(request);
  let targetCafeId = cafeId ? normalizeId(cafeId) : null;

  if (request.auth.role === 'CAFE_ADMIN') {
    targetCafeId = effectiveCafe;
  } else if (request.auth.role === 'OWNER') {
    const rawCafes = [
      ...(Array.isArray(request.auth.assignedCafeIds) ? request.auth.assignedCafeIds : (request.auth.assignedCafeIds ? [request.auth.assignedCafeIds] : [])),
      ...(request.auth.primaryCafeId ? [request.auth.primaryCafeId] : []),
      ...(request.auth.cafeId ? [request.auth.cafeId] : []),
    ];
    const authorizedCafes = [...new Set(rawCafes.filter(Boolean).map(c => String(c).trim().toUpperCase()))];
    if (targetCafeId) {
      if (!authorizedCafes.includes(targetCafeId)) {
        throw new ApiError(403, 'CAFE_OUT_OF_SCOPE', 'You can only assign tasks to your authorized cafés.');
      }
    } else if (authorizedCafes.length === 1) {
      targetCafeId = authorizedCafes[0];
    }
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
    cafeId: targetCafeId,
    title: titleText,
    description: typeof description === 'string' ? description.trim() : '',
    category: category && TASK_CATEGORIES.includes(category.toUpperCase()) ? category.toUpperCase() : 'GENERAL_OPERATIONS',
    risk: risk && TASK_RISK_LEVELS.includes(risk.toUpperCase()) ? risk.toUpperCase() : 'LOW',
    isCriticalControl: Boolean(isCriticalControl),
    assignedRole: assignedRole ? normalizeId(assignedRole) : 'CAFE_ADMIN',
    assignedUserId: assignedUserId ? normalizeId(assignedUserId) : null,
    responsibleUserId: responsibleUserId ? normalizeId(responsibleUserId) : null,
    priority: priority && TASK_PRIORITIES.includes(priority.toUpperCase()) ? priority.toUpperCase() : 'NORMAL',
    status: 'PENDING',
    dueDate: dueDate && /^\d{4}-\d{2}-\d{2}$/.test(dueDate) ? dueDate : null,
    dueTime: dueTime ? String(dueTime).trim() : '23:59',
    verificationRequired: Boolean(verificationRequired),
    verificationStatus: 'NONE',
    checklist: Array.isArray(checklist) ? checklist.map(c => ({
      item: String(c.item || c).trim(),
      status: 'PENDING',
      failureReason: '',
    })) : [],
    sopReference: sopReference || { title: '', version: '', docUrl: '' },
    recurrence: recurrence || { isRecurring: false, frequency: 'DAILY', occurrenceIndex: 1 },
    source: source || 'MANUAL',
    createdByUserId: request.auth.userId,
  });

  await task.save();

  await AuditEvent.create({
    organisationId: task.organisationId,
    action: 'TASK_CREATED',
    actor: { userId: request.auth.userId, role: request.auth.role },
    target: { entityType: 'TASK', entityId: task.taskId },
    details: {
      cafeId: task.cafeId,
      title: task.title,
      category: task.category,
      risk: task.risk,
      assignedUserId: task.assignedUserId,
      dueDate: task.dueDate,
    },
  }).catch(() => {});

  return response.status(201).json({
    success: true,
    message: `Task ${seqId} assigned successfully.`,
    data: { task: task.toObject() },
    correlationId: request.correlationId || null,
  });
});

// ─── UPDATE TASK STATUS / SUBMIT FOR VERIFICATION ─────────────────────────────

const updateTaskStatus = asyncHandler(async (request, response) => {
  const taskId = normalizeId(request.params.taskId);
  const { status, remarks } = request.body;

  const targetStatus = normalizeId(status);
  if (!TASK_STATUSES.includes(targetStatus)) {
    throw new ApiError(400, 'INVALID_STATUS', 'Invalid task status.');
  }

  const task = await Task.findOne({
    taskId,
    organisationId: request.auth.organisationId,
  });

  if (!task) {
    throw new ApiError(404, 'NOT_FOUND', 'Task not found.');
  }

  assertResourceCafeOwnership(task, request, 'Task');

  if (task.status === 'CANCELLED') {
    throw new ApiError(400, 'TASK_CANCELLED', 'Cancelled tasks cannot be modified.');
  }

  if (task.status === 'COMPLETED' && targetStatus !== 'COMPLETED') {
    throw new ApiError(400, 'TASK_COMPLETED', 'Completed task cannot be modified directly. Use /reopen to reopen.');
  }

  if (targetStatus === 'BLOCKED') {
    throw new ApiError(400, 'USE_BLOCK_ENDPOINT', 'Use /block endpoint with mandatory reason to mark a task as blocked.');
  }

  if (targetStatus === 'CANCELLED') {
    throw new ApiError(400, 'USE_CANCEL_ENDPOINT', 'Use /cancel endpoint with mandatory reason to cancel a task.');
  }

  // Work completion vs verification check
  if (targetStatus === 'COMPLETED') {
    if (task.verificationRequired) {
      task.status = 'AWAITING_VERIFICATION';
      task.verificationStatus = 'PENDING_VERIFICATION';
      task.completedByUserId = request.auth.userId;
      task.completedAt = new Date();
    } else {
      task.status = 'COMPLETED';
      task.completedByUserId = request.auth.userId;
      task.completedAt = new Date();
    }
  } else {
    task.status = targetStatus;
  }

  await task.save();

  await AuditEvent.create({
    organisationId: task.organisationId,
    action: 'TASK_STATUS_UPDATED',
    actor: { userId: request.auth.userId, role: request.auth.role },
    target: { entityType: 'TASK', entityId: taskId },
    details: { status: task.status, verificationStatus: task.verificationStatus, remarks },
  }).catch(() => {});

  return response.status(200).json({
    success: true,
    message: `Task ${taskId} status updated to ${task.status}.`,
    data: { task: task.toObject() },
    correlationId: request.correlationId || null,
  });
});

// ─── COMPLETE TASK (EXPLICIT / ALIAS) ─────────────────────────────────────────

const completeTask = asyncHandler(async (request, response) => {
  const taskId = normalizeId(request.params.taskId);
  const { remarks = '' } = request.body;

  const task = await Task.findOne({
    taskId,
    organisationId: request.auth.organisationId,
  });

  if (!task) {
    throw new ApiError(404, 'NOT_FOUND', 'Task not found.');
  }

  assertResourceCafeOwnership(task, request, 'Task');

  if (task.status === 'CANCELLED') {
    throw new ApiError(400, 'TASK_CANCELLED', 'Cancelled tasks cannot be completed.');
  }

  if (task.status === 'COMPLETED') {
    return response.status(200).json({
      success: true,
      message: `Task ${taskId} is already completed.`,
      data: { task: task.toObject() },
      correlationId: request.correlationId || null,
    });
  }

  if (task.verificationRequired) {
    task.status = 'AWAITING_VERIFICATION';
    task.verificationStatus = 'PENDING_VERIFICATION';
    task.completedByUserId = request.auth.userId;
    task.completedAt = new Date();
  } else {
    task.status = 'COMPLETED';
    task.completedByUserId = request.auth.userId;
    task.completedAt = new Date();
  }

  await task.save();

  await AuditEvent.create({
    organisationId: task.organisationId,
    action: 'TASK_COMPLETED_BY_STAFF',
    actor: { userId: request.auth.userId, role: request.auth.role },
    target: { entityType: 'TASK', entityId: taskId },
    details: { status: task.status, verificationStatus: task.verificationStatus, remarks },
  }).catch(() => {});

  return response.status(200).json({
    success: true,
    message: task.verificationRequired
      ? `Task ${taskId} submitted for verification.`
      : `Task ${taskId} completed successfully.`,
    data: { task: task.toObject() },
    correlationId: request.correlationId || null,
  });
});

// ─── VERIFY TASK (GOVERNANCE ACTION / APPROVE) ─────────────────────────────────

const verifyTask = asyncHandler(async (request, response) => {
  const taskId = normalizeId(request.params.taskId);
  const { remarks = '' } = request.body;

  const task = await Task.findOne({
    taskId,
    organisationId: request.auth.organisationId,
  });

  if (!task) {
    throw new ApiError(404, 'NOT_FOUND', 'Task not found.');
  }

  assertResourceCafeOwnership(task, request, 'Task');

  // Idempotency: already verified
  if (task.status === 'COMPLETED' && task.verificationStatus === 'VERIFIED') {
    return response.status(200).json({
      success: true,
      message: `Task ${taskId} is already verified.`,
      data: { task: task.toObject() },
      correlationId: request.correlationId || null,
    });
  }

  if (task.status === 'CANCELLED') {
    throw new ApiError(400, 'TASK_CANCELLED', 'Cancelled tasks cannot be verified.');
  }

  if (task.status !== 'AWAITING_VERIFICATION' && task.verificationStatus !== 'PENDING_VERIFICATION') {
    throw new ApiError(400, 'INVALID_STATE', `Task in ${task.status} status cannot be verified.`);
  }

  // Segregation of duties: Performer cannot verify their own work if verification is required
  const isPerformer = (task.completedByUserId && task.completedByUserId.toUpperCase() === request.auth.userId.toUpperCase()) ||
    (task.assignedUserId && task.assignedUserId.toUpperCase() === request.auth.userId.toUpperCase());

  if (task.verificationRequired && isPerformer) {
    throw new ApiError(403, 'SELF_VERIFICATION_PROHIBITED', 'Independent verification required: the task performer cannot verify their own work.');
  }

  task.status = 'COMPLETED';
  task.verificationStatus = 'VERIFIED';
  task.verifiedByUserId = request.auth.userId;
  task.verifiedAt = new Date();
  task.verificationRemarks = typeof remarks === 'string' ? remarks.trim() : '';

  await task.save();

  await AuditEvent.create({
    organisationId: task.organisationId,
    action: 'TASK_VERIFIED',
    actor: { userId: request.auth.userId, role: request.auth.role },
    target: { entityType: 'TASK', entityId: taskId },
    details: { remarks: task.verificationRemarks, verifiedAt: task.verifiedAt },
  }).catch(() => {});

  return response.status(200).json({
    success: true,
    message: `Task ${taskId} verified successfully.`,
    data: { task: task.toObject() },
    correlationId: request.correlationId || null,
  });
});

// ─── RETURN FOR CORRECTION / REJECT ───────────────────────────────────────────

const returnTask = asyncHandler(async (request, response) => {
  const taskId = normalizeId(request.params.taskId);
  const { reason, remarks = '' } = request.body;

  if (!reason || typeof reason !== 'string' || !reason.trim()) {
    throw new ApiError(400, 'REASON_REQUIRED', 'Mandatory return reason must be specified.');
  }

  const task = await Task.findOne({
    taskId,
    organisationId: request.auth.organisationId,
  });

  if (!task) {
    throw new ApiError(404, 'NOT_FOUND', 'Task not found.');
  }

  assertResourceCafeOwnership(task, request, 'Task');

  if (task.status === 'CANCELLED') {
    throw new ApiError(400, 'TASK_CANCELLED', 'Cancelled tasks cannot be returned for correction.');
  }

  if (task.status === 'COMPLETED') {
    throw new ApiError(400, 'TASK_COMPLETED', 'Completed tasks cannot be returned for correction. Reopen first if rework is needed.');
  }

  task.status = 'RETURNED_FOR_CORRECTION';
  task.verificationStatus = 'RETURNED_FOR_CORRECTION';
  task.returnReason = reason.trim();
  task.returnHistory.push({
    returnedByUserId: request.auth.userId,
    returnedAt: new Date(),
    reason: reason.trim(),
    remarks: typeof remarks === 'string' ? remarks.trim() : '',
  });

  await task.save();

  await AuditEvent.create({
    organisationId: task.organisationId,
    action: 'TASK_RETURNED_FOR_CORRECTION',
    actor: { userId: request.auth.userId, role: request.auth.role },
    target: { entityType: 'TASK', entityId: taskId },
    details: { reason: task.returnReason, remarks },
  }).catch(() => {});

  return response.status(200).json({
    success: true,
    message: `Task ${taskId} returned for correction.`,
    data: { task: task.toObject() },
    correlationId: request.correlationId || null,
  });
});

// ─── REOPEN TASK ──────────────────────────────────────────────────────────────

const reopenTask = asyncHandler(async (request, response) => {
  const taskId = normalizeId(request.params.taskId);
  const { reason } = request.body;

  if (!reason || typeof reason !== 'string' || !reason.trim()) {
    throw new ApiError(400, 'REASON_REQUIRED', 'Mandatory reason required to reopen a completed task.');
  }

  const task = await Task.findOne({
    taskId,
    organisationId: request.auth.organisationId,
  });

  if (!task) {
    throw new ApiError(404, 'NOT_FOUND', 'Task not found.');
  }

  assertResourceCafeOwnership(task, request, 'Task');

  if (task.status !== 'COMPLETED' && task.status !== 'CANCELLED') {
    throw new ApiError(400, 'INVALID_STATE', `Only COMPLETED or CANCELLED tasks may be reopened (current: ${task.status}).`);
  }

  task.status = 'IN_PROGRESS';
  task.verificationStatus = 'NONE';
  task.completedByUserId = null;
  task.completedAt = null;
  task.verifiedByUserId = null;
  task.verifiedAt = null;
  task.verificationRemarks = '';

  await task.save();

  await AuditEvent.create({
    organisationId: task.organisationId,
    action: 'TASK_REOPENED',
    actor: { userId: request.auth.userId, role: request.auth.role },
    target: { entityType: 'TASK', entityId: taskId },
    details: { reason: reason.trim() },
  }).catch(() => {});

  return response.status(200).json({
    success: true,
    message: `Task ${taskId} reopened successfully.`,
    data: { task: task.toObject() },
    correlationId: request.correlationId || null,
  });
});

// ─── CANCEL TASK ──────────────────────────────────────────────────────────────

const cancelTask = asyncHandler(async (request, response) => {
  const taskId = normalizeId(request.params.taskId);
  const { reason } = request.body;

  if (!reason || typeof reason !== 'string' || !reason.trim()) {
    throw new ApiError(400, 'REASON_REQUIRED', 'Mandatory reason required to cancel a task.');
  }

  const task = await Task.findOne({
    taskId,
    organisationId: request.auth.organisationId,
  });

  if (!task) {
    throw new ApiError(404, 'NOT_FOUND', 'Task not found.');
  }

  assertResourceCafeOwnership(task, request, 'Task');

  if (task.status === 'CANCELLED') {
    return response.status(200).json({
      success: true,
      message: `Task ${taskId} is already cancelled.`,
      data: { task: task.toObject() },
      correlationId: request.correlationId || null,
    });
  }

  task.status = 'CANCELLED';
  task.cancellationReason = reason.trim();

  await task.save();

  await AuditEvent.create({
    organisationId: task.organisationId,
    action: 'TASK_CANCELLED',
    actor: { userId: request.auth.userId, role: request.auth.role },
    target: { entityType: 'TASK', entityId: taskId },
    details: { reason: task.cancellationReason },
  }).catch(() => {});

  return response.status(200).json({
    success: true,
    message: `Task ${taskId} cancelled.`,
    data: { task: task.toObject() },
    correlationId: request.correlationId || null,
  });
});

// ─── BLOCK TASK ───────────────────────────────────────────────────────────────

const blockTask = asyncHandler(async (request, response) => {
  const taskId = normalizeId(request.params.taskId);
  const { reason } = request.body;

  if (!reason || typeof reason !== 'string' || !reason.trim()) {
    throw new ApiError(400, 'REASON_REQUIRED', 'Mandatory reason required to block a task.');
  }

  const task = await Task.findOne({
    taskId,
    organisationId: request.auth.organisationId,
  });

  if (!task) {
    throw new ApiError(404, 'NOT_FOUND', 'Task not found.');
  }

  assertResourceCafeOwnership(task, request, 'Task');

  if (task.status === 'BLOCKED') {
    throw new ApiError(400, 'ALREADY_BLOCKED', 'Task is already marked as blocked.');
  }

  if (task.status === 'COMPLETED' || task.status === 'CANCELLED') {
    throw new ApiError(400, 'INVALID_STATE', `Cannot block a ${task.status} task.`);
  }

  task.status = 'BLOCKED';
  task.blockedReason = reason.trim();
  task.blockedAt = new Date();

  await task.save();

  await AuditEvent.create({
    organisationId: task.organisationId,
    action: 'TASK_BLOCKED',
    actor: { userId: request.auth.userId, role: request.auth.role },
    target: { entityType: 'TASK', entityId: taskId },
    details: { reason: task.blockedReason },
  }).catch(() => {});

  return response.status(200).json({
    success: true,
    message: `Task ${taskId} marked as blocked.`,
    data: { task: task.toObject() },
    correlationId: request.correlationId || null,
  });
});

// ─── REASSIGN TASK (OWNER / MASTER / ADMIN GOVERNANCE) ─────────────────────────

const reassignTask = asyncHandler(async (request, response) => {
  const taskId = normalizeId(request.params.taskId);
  const { assignedUserId, responsibleUserId, assignedRole } = request.body;

  const task = await Task.findOne({
    taskId,
    organisationId: request.auth.organisationId,
  });

  if (!task) {
    throw new ApiError(404, 'NOT_FOUND', 'Task not found.');
  }

  assertResourceCafeOwnership(task, request, 'Task');

  if (task.status === 'COMPLETED' || task.status === 'CANCELLED') {
    throw new ApiError(400, 'INVALID_STATE', `Cannot reassign a ${task.status} task.`);
  }

  const previousAssignee = task.assignedUserId;
  if (assignedUserId !== undefined) {
    task.assignedUserId = assignedUserId ? normalizeId(assignedUserId) : null;
  }
  if (responsibleUserId !== undefined) {
    task.responsibleUserId = responsibleUserId ? normalizeId(responsibleUserId) : null;
  }
  if (assignedRole && ['MASTER', 'OWNER', 'CAFE_ADMIN', 'STAFF'].includes(assignedRole.toUpperCase())) {
    task.assignedRole = assignedRole.toUpperCase();
  }

  await task.save();

  await AuditEvent.create({
    organisationId: task.organisationId,
    action: 'TASK_REASSIGNED',
    actor: { userId: request.auth.userId, role: request.auth.role },
    target: { entityType: 'TASK', entityId: taskId },
    details: {
      previousAssignee,
      newAssignee: task.assignedUserId,
      responsibleUserId: task.responsibleUserId,
      assignedRole: task.assignedRole,
    },
  }).catch(() => {});

  return response.status(200).json({
    success: true,
    message: `Task ${taskId} reassigned successfully.`,
    data: { task: task.toObject() },
    correlationId: request.correlationId || null,
  });
});

module.exports = {
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
};
