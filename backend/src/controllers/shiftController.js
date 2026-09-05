'use strict';

/**
 * SHIFT CONTROLLER (P1)
 * Full CRUD for Shift templates.
 * MASTER / authorised CAFE_ADMIN create/edit; MASTER-only deactivate.
 */

const { Shift } = require('../models/Shift');
const { SequenceCounter } = require('../models/SequenceCounter');
const { asyncHandler } = require('../utils/asyncHandler');
const { ApiError } = require('../utils/ApiError');
const { recordRequestAudit } = require('../services/auditService');

function normalizeIdentifier(v) {
  return typeof v === 'string' ? v.trim().toUpperCase() : '';
}

function requireShiftWriteAccess(request) {
  if (!['MASTER', 'OWNER', 'CAFE_ADMIN'].includes(request.auth.role)) {
    throw new ApiError(403, 'PERMISSION_DENIED', 'Only Master, Owner, or Café Admin can manage shifts.');
  }
}

function validateTimeString(value, fieldName) {
  if (typeof value !== 'string' || !/^\d{2}:\d{2}$/.test(value.trim())) {
    throw new ApiError(400, `INVALID_${fieldName.toUpperCase()}`, `${fieldName} must be a valid HH:MM string.`);
  }
  return value.trim();
}

// GET /api/v1/shifts
const listShifts = asyncHandler(async (request, response) => {
  const { organisationId } = request.auth;
  const filter = { organisationId };

  if (request.query.cafeId) {
    const cafeId = normalizeIdentifier(request.query.cafeId);
    filter.$or = [{ cafeId }, { cafeId: null }];
  }

  if (request.query.isActive !== undefined) {
    filter.isActive = request.query.isActive === 'false' ? false : true;
  } else {
    filter.isActive = true;
  }

  const shifts = await Shift.find(filter).sort({ isDefault: -1, name: 1 }).lean();

  return response.status(200).json({
    success: true,
    data: { shifts },
    correlationId: request.correlationId || null,
  });
});

// GET /api/v1/shifts/:shiftId
const getShift = asyncHandler(async (request, response) => {
  const { organisationId } = request.auth;
  const shiftId = normalizeIdentifier(request.params.shiftId);

  const shift = await Shift.findOne({ organisationId, shiftId }).lean();
  if (!shift) throw new ApiError(404, 'SHIFT_NOT_FOUND', 'Shift not found.');

  return response.status(200).json({
    success: true,
    data: { shift },
    correlationId: request.correlationId || null,
  });
});

// POST /api/v1/shifts
const createShift = asyncHandler(async (request, response) => {
  requireShiftWriteAccess(request);

  const {
    name,
    cafeId: rawCafeId = null,
    startTime: rawStart,
    endTime: rawEnd,
    graceMinutes = 15,
    isDefault = false,
    effectiveFrom = null,
    description = '',
  } = request.body || {};

  if (!name || !String(name).trim()) {
    throw new ApiError(400, 'SHIFT_NAME_REQUIRED', 'Shift name is required.');
  }

  const startTime = validateTimeString(rawStart, 'startTime');
  const endTime = validateTimeString(rawEnd, 'endTime');
  const cafeId = rawCafeId ? normalizeIdentifier(rawCafeId) : null;

  // If cafeId supplied and caller is CAFE_ADMIN, verify access
  if (cafeId && request.auth.role === 'CAFE_ADMIN') {
    if (!request.auth.assignedCafeIds?.includes(cafeId)) {
      throw new ApiError(403, 'CAFE_ACCESS_DENIED', 'You do not have access to this café.');
    }
  }

  const shiftId = await SequenceCounter.generateId({
    organisationId: request.auth.organisationId,
    sequenceKey: 'SHIFT',
    prefix: 'SH',
    minimumDigits: 4,
  });

  // If this new shift is marked isDefault, unset all others for the same scope
  if (isDefault) {
    const mongoose = require('mongoose');
    if (mongoose.connection?.readyState === 1 || Shift.updateMany !== mongoose.Model.updateMany) {
      const unsetFilter = { organisationId: request.auth.organisationId, isDefault: true };
      if (cafeId) unsetFilter.cafeId = cafeId;
      await Shift.updateMany(unsetFilter, { $set: { isDefault: false } });
    }
  }

  const shift = new Shift({
    shiftId,
    organisationId: request.auth.organisationId,
    cafeId,
    name: String(name).trim(),
    startTime,
    endTime,
    graceMinutes: Math.max(0, Number(graceMinutes) || 15),
    isDefault: Boolean(isDefault),
    effectiveFrom: effectiveFrom || null,
    isActive: true,
    description: String(description).trim(),
  });

  await shift.save();

  await recordRequestAudit({
    request,
    module: 'ATTENDANCE',
    action: 'SHIFT_CREATED',
    entityType: 'Shift',
    entityId: shiftId,
    metadata: { shiftId, name: shift.name, cafeId, startTime, endTime },
  });

  return response.status(201).json({
    success: true,
    message: 'Shift template created successfully.',
    data: { shift },
    correlationId: request.correlationId || null,
  });
});

// PATCH /api/v1/shifts/:shiftId
const updateShift = asyncHandler(async (request, response) => {
  requireShiftWriteAccess(request);

  const shiftId = normalizeIdentifier(request.params.shiftId);
  const shift = await Shift.findOne({ organisationId: request.auth.organisationId, shiftId });
  if (!shift) throw new ApiError(404, 'SHIFT_NOT_FOUND', 'Shift not found.');

  if (request.auth.role === 'CAFE_ADMIN' && shift.cafeId) {
    if (!request.auth.assignedCafeIds?.includes(shift.cafeId)) {
      throw new ApiError(403, 'CAFE_ACCESS_DENIED', 'You do not have access to this shift.');
    }
  }

  const {
    name,
    startTime: rawStart,
    endTime: rawEnd,
    graceMinutes,
    isDefault,
    effectiveFrom,
    description,
  } = request.body || {};

  const before = {
    name: shift.name,
    startTime: shift.startTime,
    endTime: shift.endTime,
    graceMinutes: shift.graceMinutes,
    isDefault: shift.isDefault,
  };

  if (name !== undefined) shift.name = String(name).trim();
  if (rawStart !== undefined) shift.startTime = validateTimeString(rawStart, 'startTime');
  if (rawEnd !== undefined) shift.endTime = validateTimeString(rawEnd, 'endTime');
  if (graceMinutes !== undefined) shift.graceMinutes = Math.max(0, Number(graceMinutes) || 15);
  if (effectiveFrom !== undefined) shift.effectiveFrom = effectiveFrom || null;
  if (description !== undefined) shift.description = String(description).trim();

  if (isDefault !== undefined && Boolean(isDefault) !== shift.isDefault) {
    if (isDefault) {
      const mongoose = require('mongoose');
      if (mongoose.connection?.readyState === 1 || Shift.updateMany !== mongoose.Model.updateMany) {
        const unsetFilter = { organisationId: request.auth.organisationId, isDefault: true };
        if (shift.cafeId) unsetFilter.cafeId = shift.cafeId;
        await Shift.updateMany(unsetFilter, { $set: { isDefault: false } });
      }
    }
    shift.isDefault = Boolean(isDefault);
  }

  await shift.save();

  await recordRequestAudit({
    request,
    module: 'ATTENDANCE',
    action: 'SHIFT_UPDATED',
    entityType: 'Shift',
    entityId: shiftId,
    metadata: { before, after: { name: shift.name, startTime: shift.startTime, endTime: shift.endTime } },
  });

  return response.status(200).json({
    success: true,
    message: 'Shift template updated. Historical attendance records are not affected.',
    data: { shift },
    correlationId: request.correlationId || null,
  });
});

// PATCH /api/v1/shifts/:shiftId/deactivate
const deactivateShift = asyncHandler(async (request, response) => {
  if (!['MASTER', 'OWNER'].includes(request.auth.role)) {
    throw new ApiError(403, 'PERMISSION_DENIED', 'Only Master or Owner can deactivate a shift template.');
  }

  const shiftId = normalizeIdentifier(request.params.shiftId);
  const shift = await Shift.findOne({ organisationId: request.auth.organisationId, shiftId });
  if (!shift) throw new ApiError(404, 'SHIFT_NOT_FOUND', 'Shift not found.');
  if (!shift.isActive) {
    return response.status(200).json({ success: true, message: 'Shift is already inactive.', data: { shift: shift.toObject() } });
  }

  shift.isActive = false;
  shift.isDefault = false;
  await shift.save();

  await recordRequestAudit({
    request, module: 'ATTENDANCE', action: 'SHIFT_DEACTIVATED',
    entityType: 'Shift', entityId: shiftId,
    metadata: { shiftId, name: shift.name },
  });

  return response.status(200).json({
    success: true,
    message: 'Shift template deactivated. Future rosters will not include this shift.',
    data: { shift: shift.toObject() },
    correlationId: request.correlationId || null,
  });
});

// PATCH /api/v1/shifts/:shiftId/activate
const activateShift = asyncHandler(async (request, response) => {
  if (!['MASTER', 'OWNER'].includes(request.auth.role)) {
    throw new ApiError(403, 'PERMISSION_DENIED', 'Only Master or Owner can reactivate a shift template.');
  }

  const shiftId = normalizeIdentifier(request.params.shiftId);
  const shift = await Shift.findOne({ organisationId: request.auth.organisationId, shiftId });
  if (!shift) throw new ApiError(404, 'SHIFT_NOT_FOUND', 'Shift not found.');

  shift.isActive = true;
  await shift.save();

  await recordRequestAudit({
    request, module: 'ATTENDANCE', action: 'SHIFT_ACTIVATED',
    entityType: 'Shift', entityId: shiftId,
    metadata: { shiftId, name: shift.name },
  });

  return response.status(200).json({
    success: true, message: 'Shift template reactivated.',
    data: { shift: shift.toObject() },
    correlationId: request.correlationId || null,
  });
});

module.exports = {
  listShifts,
  getShift,
  createShift,
  updateShift,
  deactivateShift,
  activateShift,
};
