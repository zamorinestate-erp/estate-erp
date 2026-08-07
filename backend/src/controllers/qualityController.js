'use strict';

/**
 * QUALITY CONTROLLER
 */

const {
  QualityChecklist,
  CHECKLIST_FREQUENCIES,
  OVERALL_RESULTS,
} = require('../models/QualityChecklist');

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

function getIstBusinessDate(date = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

function parsePositiveInteger(value, fallback, maximum) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed < 1) return fallback;
  return Math.min(parsed, maximum);
}

function assertCafeAccess(request, cafeId) {
  if (request.auth.role === 'MASTER') return;
  if (!request.auth.assignedCafeIds.includes(cafeId)) {
    throw new ApiError(
      403,
      'CAFE_ACCESS_DENIED',
      'You do not have access to this café.'
    );
  }
}

const listChecklists = asyncHandler(async (request, response) => {
  const page = parsePositiveInteger(request.query.page, 1, 1000);
  const limit = parsePositiveInteger(request.query.limit, 25, 100);
  const skip = (page - 1) * limit;

  const filter = { organisationId: request.auth.organisationId };
  const { cafeId, date } = request.query;

  if (cafeId) {
    const normCafeId = normalizeId(cafeId);
    assertCafeAccess(request, normCafeId);
    filter.cafeId = normCafeId;
  } else if (request.auth.role !== 'MASTER') {
    filter.cafeId = { $in: request.auth.assignedCafeIds };
  }

  if (date && /^\d{4}-\d{2}-\d{2}$/.test(date)) {
    filter.inspectionDate = date;
  }

  const [checklists, total] = await Promise.all([
    QualityChecklist.find(filter)
      .select('-__v -version')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    QualityChecklist.countDocuments(filter),
  ]);

  return response.status(200).json({
    success: true,
    data: {
      checklists,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    },
    correlationId: request.correlationId || null,
  });
});

const submitChecklist = asyncHandler(async (request, response) => {
  const { cafeId: rawCafeId, title, frequency, items, overallResult, actionRequired } = request.body;

  const cafeId = normalizeId(rawCafeId);
  if (!cafeId) {
    throw new ApiError(400, 'CAFE_ID_REQUIRED', 'cafeId is required.');
  }
  assertCafeAccess(request, cafeId);

  const titleText = typeof title === 'string' ? title.trim() : '';
  if (!titleText) {
    throw new ApiError(400, 'TITLE_REQUIRED', 'Checklist title is required.');
  }

  if (!Array.isArray(items) || items.length === 0) {
    throw new ApiError(400, 'ITEMS_REQUIRED', 'Checklist items are required.');
  }

  const normResult = normalizeId(overallResult);
  if (!OVERALL_RESULTS.includes(normResult)) {
    throw new ApiError(400, 'INVALID_RESULT', `overallResult must be one of: ${OVERALL_RESULTS.join(', ')}.`);
  }

  const seqId = await SequenceCounter.generateId({
    organisationId: request.auth.organisationId,
    sequenceKey: 'QUALITY_CHECKLIST',
    prefix: 'QC',
    minimumDigits: 4,
  });

  const checklist = new QualityChecklist({
    checklistId: seqId,
    organisationId: request.auth.organisationId,
    cafeId,
    title: titleText,
    frequency: frequency ? normalizeId(frequency) : 'DAILY',
    items,
    overallResult: normResult,
    inspectionDate: getIstBusinessDate(),
    inspectedByUserId: request.auth.userId,
    actionRequired: typeof actionRequired === 'string' ? actionRequired.trim() : '',
  });

  await checklist.save();

  await recordRequestAudit({
    request,
    module: 'QUALITY',
    action: 'SUBMIT_QUALITY_CHECKLIST',
    entityType: 'QUALITY_CHECKLIST',
    entityId: seqId,
    after: { checklistId: seqId, cafeId, result: normResult },
    result: 'SUCCESS',
    riskClassification: normResult === 'CRITICAL_FAIL' ? 'HIGH' : 'LOW',
  });

  return response.status(201).json({
    success: true,
    data: { checklist: checklist.toObject() },
    correlationId: request.correlationId || null,
  });
});

module.exports = {
  listChecklists,
  submitChecklist,
};
