'use strict';

const { ShiftChangeRequest, SHIFT_CHANGE_STATUSES } = require('../models/ShiftChangeRequest');
const { ShiftRoster } = require('../models/ShiftRoster');
const { NotificationOutbox } = require('../models/NotificationOutbox');
const { Notification } = require('../models/Notification');
const { User } = require('../models/User');
const { asyncHandler } = require('../utils/asyncHandler');
const { ApiError } = require('../utils/ApiError');
const { recordRequestAudit } = require('../services/auditService');

// 1. Employee: Submit Shift Change Request
const createSelfShiftChangeRequest = asyncHandler(async (request, response) => {
  const { organisationId, userId, name } = request.auth;
  const {
    requestedDate,
    endDate = null,
    currentShift = '',
    requestedShift,
    reason,
    notes = '',
    cafeId = null,
  } = request.body || {};

  if (!requestedDate || !/^\d{4}-\d{2}-\d{2}$/.test(String(requestedDate).trim())) {
    throw new ApiError(400, 'INVALID_DATE', 'Requested date must be in YYYY-MM-DD format.');
  }

  if (endDate && !/^\d{4}-\d{2}-\d{2}$/.test(String(endDate).trim())) {
    throw new ApiError(400, 'INVALID_END_DATE', 'End date must be in YYYY-MM-DD format.');
  }

  if (!requestedShift || !String(requestedShift).trim()) {
    throw new ApiError(400, 'REQUESTED_SHIFT_REQUIRED', 'Requested shift is required.');
  }

  if (!reason || !String(reason).trim()) {
    throw new ApiError(400, 'REASON_REQUIRED', 'A reason for the shift change request is required.');
  }

  // Resolve cafeId if not passed in body
  let effectiveCafeId = cafeId;
  if (!effectiveCafeId) {
    const userDoc = await User.findOne({ userId, organisationId }).select('cafeId').lean();
    effectiveCafeId = userDoc?.cafeId || null;
  }

  const dateStr = new Date().getFullYear();
  const randSeq = Math.floor(1000 + Math.random() * 9000);
  const requestId = `SCR-${dateStr}-${randSeq}`;

  const shiftRequest = await ShiftChangeRequest.create({
    requestId,
    organisationId,
    employeeUserId: userId,
    employeeName: name || userId,
    cafeId: effectiveCafeId,
    requestedDate: String(requestedDate).trim(),
    endDate: endDate ? String(endDate).trim() : null,
    currentShift: String(currentShift || '').trim(),
    requestedShift: String(requestedShift).trim(),
    reason: String(reason).trim(),
    notes: String(notes || '').trim(),
    status: 'SUBMITTED',
  });

  try {
    await recordRequestAudit({
      request,
      module: 'ATTENDANCE',
      action: 'SHIFT_CHANGE_REQUEST_CREATE',
      entityType: 'SHIFT_CHANGE_REQUEST',
      entityId: requestId,
      metadata: { requestedDate, requestedShift, reason },
      result: 'SUCCESS',
    });
  } catch (e) {}

  return response.status(201).json({
    success: true,
    message: 'Shift change request submitted successfully.',
    data: { request: shiftRequest },
    correlationId: request.correlationId || null,
  });
});

// 2. Employee: List Own Shift Change Requests
const listSelfShiftChangeRequests = asyncHandler(async (request, response) => {
  const { organisationId, userId } = request.auth;
  const { status, limit = 50, offset = 0 } = request.query;

  const safeLimit = Math.min(100, Math.max(1, parseInt(limit, 10) || 50));
  const safeOffset = Math.max(0, parseInt(offset, 10) || 0);

  const filter = { organisationId, employeeUserId: userId };
  if (status && SHIFT_CHANGE_STATUSES.includes(status)) {
    filter.status = status;
  }

  const [requests, total] = await Promise.all([
    ShiftChangeRequest.find(filter)
      .sort({ createdAt: -1 })
      .skip(safeOffset)
      .limit(safeLimit)
      .lean(),
    ShiftChangeRequest.countDocuments(filter),
  ]);

  return response.status(200).json({
    success: true,
    data: { requests, total },
    correlationId: request.correlationId || null,
  });
});

// 3. Employee: Get My Shifts / Schedule
const getMyShiftsSchedule = asyncHandler(async (request, response) => {
  const { organisationId, userId } = request.auth;
  const { startDate, endDate } = request.query;

  const rosterFilter = {
    organisationId,
    status: { $in: ['PUBLISHED', 'LOCKED'] },
    'assignments.userId': userId,
  };

  if (startDate || endDate) {
    if (startDate && endDate) {
      rosterFilter.rosterPeriodStart = { $lte: endDate };
      rosterFilter.rosterPeriodEnd = { $gte: startDate };
    } else if (startDate) {
      rosterFilter.rosterPeriodEnd = { $gte: startDate };
    } else if (endDate) {
      rosterFilter.rosterPeriodStart = { $lte: endDate };
    }
  }

  const rosters = await ShiftRoster.find(rosterFilter).lean();

  const mySchedule = [];
  for (const roster of rosters) {
    for (const assignment of roster.assignments || []) {
      if (assignment.userId === userId) {
        if (startDate && assignment.date < startDate) continue;
        if (endDate && assignment.date > endDate) continue;
        mySchedule.push({
          rosterId: roster.rosterId,
          cafeId: roster.cafeId,
          ...assignment,
        });
      }
    }
  }

  mySchedule.sort((a, b) => a.date.localeCompare(b.date));

  return response.status(200).json({
    success: true,
    data: { schedule: mySchedule, count: mySchedule.length },
    correlationId: request.correlationId || null,
  });
});

// 4. Org / Management: List Shift Change Requests
const listOrgShiftChangeRequests = asyncHandler(async (request, response) => {
  const { organisationId } = request.auth;
  const { status, cafeId, employeeUserId, limit = 50, offset = 0 } = request.query;

  const filter = { organisationId };
  if (status && SHIFT_CHANGE_STATUSES.includes(status)) {
    filter.status = status;
  }
  if (cafeId) filter.cafeId = cafeId;
  if (employeeUserId) filter.employeeUserId = employeeUserId;

  const [requests, total] = await Promise.all([
    ShiftChangeRequest.find(filter)
      .sort({ createdAt: -1 })
      .skip(Number(offset))
      .limit(Math.min(Number(limit), 100))
      .lean(),
    ShiftChangeRequest.countDocuments(filter),
  ]);

  return response.status(200).json({
    success: true,
    data: { requests, total },
    correlationId: request.correlationId || null,
  });
});

// 5. Org / Management: Review Shift Change Request
const reviewShiftChangeRequest = asyncHandler(async (request, response) => {
  const { organisationId, userId } = request.auth;
  const { requestId } = request.params;
  const { status, reviewNotes = '' } = request.body || {};

  if (!status || !SHIFT_CHANGE_STATUSES.includes(status)) {
    throw new ApiError(400, 'INVALID_STATUS', `Status must be one of: ${SHIFT_CHANGE_STATUSES.join(', ')}`);
  }

  const shiftRequest = await ShiftChangeRequest.findOne({ requestId, organisationId });
  if (!shiftRequest) {
    throw new ApiError(404, 'NOT_FOUND', 'Shift change request not found.');
  }

  shiftRequest.status = status;
  shiftRequest.reviewNotes = String(reviewNotes || '').trim();
  shiftRequest.reviewedByUserId = userId;
  shiftRequest.reviewedAt = new Date();
  await shiftRequest.save();

  // Create notification to employee
  try {
    await Notification.create({
      organisationId,
      userId: shiftRequest.employeeUserId,
      type: 'SHIFT_CHANGE_UPDATE',
      title: `Shift Change Request ${status}`,
      body: `Your shift change request for ${shiftRequest.requestedDate} has been updated to ${status}.`,
      data: { requestId: shiftRequest.requestId, status },
    });
  } catch (e) {}

  try {
    await recordRequestAudit({
      request,
      module: 'ATTENDANCE',
      action: 'SHIFT_CHANGE_REQUEST_REVIEW',
      entityType: 'SHIFT_CHANGE_REQUEST',
      entityId: requestId,
      metadata: { newStatus: status, reviewerUserId: userId },
      result: 'SUCCESS',
    });
  } catch (e) {}

  return response.status(200).json({
    success: true,
    message: `Shift change request ${requestId} has been updated to ${status}.`,
    data: { request: shiftRequest },
    correlationId: request.correlationId || null,
  });
});

module.exports = {
  createSelfShiftChangeRequest,
  listSelfShiftChangeRequests,
  getMyShiftsSchedule,
  listOrgShiftChangeRequests,
  reviewShiftChangeRequest,
};
