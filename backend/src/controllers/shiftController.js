'use strict';

/**
 * SHIFT CONTROLLER (P1)
 * Full CRUD for Shift templates.
 * MASTER / authorised CAFE_ADMIN create/edit; MASTER-only deactivate.
 */

const { Shift } = require('../models/Shift');
const { ShiftHandover } = require('../models/ShiftHandover');
const { SequenceCounter } = require('../models/SequenceCounter');
const { asyncHandler } = require('../utils/asyncHandler');
const { ApiError } = require('../utils/ApiError');
const { recordRequestAudit } = require('../services/auditService');
const { resolveEffectiveCafeScope } = require('../utils/cafeScope');

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
    if (request.auth.role === 'OWNER') {
      const authorizedCafes = (request.auth.assignedCafeIds || []).map((c) => String(c).trim().toUpperCase()).filter(Boolean);
      if (!authorizedCafes.includes(cafeId)) {
        throw new ApiError(403, 'CROSS_CAFE_RESOURCE_DENIED', 'You do not have access to this café.');
      }
    }
    filter.$or = [{ cafeId }, { cafeId: null }];
  } else if (request.auth.role === 'OWNER') {
    const authorizedCafes = (request.auth.assignedCafeIds || []).map((c) => String(c).trim().toUpperCase()).filter(Boolean);
    if (!authorizedCafes.length) {
      throw new ApiError(403, 'CROSS_CAFE_RESOURCE_DENIED', 'Owner has no assigned cafés.');
    }
    filter.$or = [{ cafeId: { $in: authorizedCafes } }, { cafeId: null }];
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

  if (request.auth.role === 'OWNER' && shift.cafeId) {
    const authorizedCafes = (request.auth.assignedCafeIds || []).map((c) => String(c).trim().toUpperCase()).filter(Boolean);
    if (!authorizedCafes.includes(shift.cafeId)) {
      throw new ApiError(403, 'CROSS_CAFE_RESOURCE_DENIED', 'You do not have access to this café.');
    }
  }

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

  // If cafeId supplied and caller is OWNER, verify access
  if (cafeId && request.auth.role === 'OWNER') {
    const authorizedCafes = (request.auth.assignedCafeIds || []).map((c) => String(c).trim().toUpperCase()).filter(Boolean);
    if (!authorizedCafes.includes(cafeId)) {
      throw new ApiError(403, 'CROSS_CAFE_RESOURCE_DENIED', 'You do not have access to this café.');
    }
  }

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

  if (request.auth.role === 'OWNER' && shift.cafeId) {
    const authorizedCafes = (request.auth.assignedCafeIds || []).map((c) => String(c).trim().toUpperCase()).filter(Boolean);
    if (!authorizedCafes.includes(shift.cafeId)) {
      throw new ApiError(403, 'CROSS_CAFE_RESOURCE_DENIED', 'You do not have access to this shift.');
    }
  }

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
  if (request.auth.role === 'OWNER' && shift.cafeId) {
    const authorizedCafes = (request.auth.assignedCafeIds || []).map((c) => String(c).trim().toUpperCase()).filter(Boolean);
    if (!authorizedCafes.includes(shift.cafeId)) {
      throw new ApiError(403, 'CROSS_CAFE_RESOURCE_DENIED', 'You do not have access to this shift.');
    }
  }
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
  if (request.auth.role === 'OWNER' && shift.cafeId) {
    const authorizedCafes = (request.auth.assignedCafeIds || []).map((c) => String(c).trim().toUpperCase()).filter(Boolean);
    if (!authorizedCafes.includes(shift.cafeId)) {
      throw new ApiError(403, 'CROSS_CAFE_RESOURCE_DENIED', 'You do not have access to this shift.');
    }
  }

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

// ── Shift Handover & Continuity (R02-07) ────────────────────────────────────
const listShiftHandovers = asyncHandler(async (request, response) => {
  const { organisationId } = request.auth;
  const cafeId = resolveEffectiveCafeScope(request);
  const { date, status } = request.query;

  const filter = { organisationId, cafeId };
  if (date) filter.handoverDate = date;
  if (status) filter.acknowledgementStatus = status.toUpperCase();

  const handovers = await ShiftHandover.find(filter).sort({ createdAt: -1 }).limit(50).lean();

  return response.status(200).json({
    success: true,
    data: { handovers, count: handovers.length },
  });
});

const getLatestShiftHandover = asyncHandler(async (request, response) => {
  const { organisationId } = request.auth;
  const cafeId = resolveEffectiveCafeScope(request);

  const handover = await ShiftHandover.findOne({ organisationId, cafeId })
    .sort({ createdAt: -1 })
    .lean();

  return response.status(200).json({
    success: true,
    data: { handover: handover || null },
  });
});

const recordShiftHandover = asyncHandler(async (request, response) => {
  const { organisationId, userId } = request.auth;
  const cafeId = resolveEffectiveCafeScope(request);
  const {
    handoverType = 'HANDOVER',
    shiftType = 'MORNING',
    handoverDate,
    receivingUserId,
    cashDrawer,
    operationalChecklist,
    equipmentStatusNotes,
    stockIssuesNotes,
    pendingOrdersCount,
    managerNotes,
  } = request.body || {};

  const todayStr = new Date().toISOString().slice(0, 10);
  const dateUsed = handoverDate || todayStr;

  const count = await ShiftHandover.countDocuments({ organisationId });
  const handoverId = `HND-${dateUsed.replace(/-/g, '')}-${String(count + 1).padStart(4, '0')}`;

  const cash = cashDrawer || {};
  const opening = Number(cash.openingFloatPaisa) || 0;
  const counted = Number(cash.countedCashPaisa) || 0;
  const expected = Number(cash.expectedCashPaisa) || 0;
  const variance = counted - expected;

  const handover = await ShiftHandover.create({
    handoverId,
    organisationId,
    cafeId,
    handoverType,
    shiftType,
    handoverDate: dateUsed,
    handingOverUserId: userId,
    receivingUserId: receivingUserId || null,
    cashDrawer: {
      openingFloatPaisa: opening,
      countedCashPaisa: counted,
      expectedCashPaisa: expected,
      variancePaisa: variance,
      varianceReason: cash.varianceReason || '',
      cashDropPaisa: Number(cash.cashDropPaisa) || 0,
      pettyCashRemainingPaisa: Number(cash.pettyCashRemainingPaisa) || 0,
    },
    operationalChecklist: operationalChecklist || {},
    equipmentStatusNotes: equipmentStatusNotes || '',
    stockIssuesNotes: stockIssuesNotes || '',
    pendingOrdersCount: Number(pendingOrdersCount) || 0,
    managerNotes: managerNotes || '',
    acknowledgementStatus: receivingUserId ? 'PENDING' : 'ACCEPTED',
    acknowledgedAt: receivingUserId ? null : new Date(),
  });

  await recordRequestAudit({
    request,
    module: 'OPERATIONS',
    action: 'SHIFT_HANDOVER_RECORDED',
    entityType: 'ShiftHandover',
    entityId: handoverId,
    metadata: {
      cafeId,
      handoverType,
      shiftType,
      variancePaisa: variance,
    },
  });

  return response.status(201).json({
    success: true,
    message: `Shift handover ${handoverId} recorded successfully.`,
    data: { handover },
  });
});

const acknowledgeShiftHandover = asyncHandler(async (request, response) => {
  const { organisationId, userId } = request.auth;
  const cafeId = resolveEffectiveCafeScope(request);
  const { handoverId } = request.params;
  const { decision = 'ACCEPTED', disputeReason = '' } = request.body || {};

  const handover = await ShiftHandover.findOne({
    organisationId,
    cafeId,
    handoverId: handoverId.toUpperCase(),
  });

  if (!handover) {
    throw new ApiError(404, 'NOT_FOUND', `Shift handover ${handoverId} not found.`);
  }

  handover.acknowledgementStatus = decision.toUpperCase();
  handover.receivingUserId = userId;
  handover.acknowledgedAt = new Date();
  if (decision.toUpperCase() === 'DISPUTED') {
    handover.disputeReason = disputeReason;
  }

  await handover.save();

  await recordRequestAudit({
    request,
    module: 'OPERATIONS',
    action: 'SHIFT_HANDOVER_ACKNOWLEDGED',
    entityType: 'ShiftHandover',
    entityId: handoverId,
    metadata: {
      cafeId,
      decision: handover.acknowledgementStatus,
      disputeReason,
    },
  });

  return response.status(200).json({
    success: true,
    message: `Shift handover acknowledged with status ${handover.acknowledgementStatus}.`,
    data: { handover },
  });
});

module.exports = {
  listShifts,
  getShift,
  createShift,
  updateShift,
  deactivateShift,
  activateShift,
  listShiftHandovers,
  getLatestShiftHandover,
  recordShiftHandover,
  acknowledgeShiftHandover,
};
