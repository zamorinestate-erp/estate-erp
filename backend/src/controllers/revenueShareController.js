'use strict';

/**
 * REVENUE SHARE CONTROLLER
 */

const {
  RevenueShareAgreement,
  AGREEMENT_STATUSES,
} = require('../models/RevenueShareAgreement');

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

const listAgreements = asyncHandler(async (request, response) => {
  const page = parsePositiveInteger(request.query.page, 1, 1000);
  const limit = parsePositiveInteger(request.query.limit, 25, 100);
  const skip = (page - 1) * limit;

  const filter = { organisationId: request.auth.organisationId };
  const { cafeId, status } = request.query;

  if (cafeId) filter.cafeId = normalizeId(cafeId);
  if (status && AGREEMENT_STATUSES.includes(status.toUpperCase())) filter.status = status.toUpperCase();

  const [agreements, total] = await Promise.all([
    RevenueShareAgreement.find(filter)
      .select('-__v -version')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    RevenueShareAgreement.countDocuments(filter),
  ]);

  return response.status(200).json({
    success: true,
    data: {
      agreements,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    },
    correlationId: request.correlationId || null,
  });
});

const createAgreement = asyncHandler(async (request, response) => {
  const { cafeId: rawCafeId, partnerName, sharePercentage, fixedFeePaisa, effectiveFrom, notes } = request.body;

  const cafeId = normalizeId(rawCafeId);
  if (!cafeId) throw new ApiError(400, 'CAFE_ID_REQUIRED', 'cafeId is required.');

  const partner = typeof partnerName === 'string' ? partnerName.trim() : '';
  if (!partner) throw new ApiError(400, 'PARTNER_NAME_REQUIRED', 'partnerName is required.');

  const seqId = await SequenceCounter.generateId({
    organisationId: request.auth.organisationId,
    sequenceKey: 'REVENUE_SHARE_AGREEMENT',
    prefix: 'RSA',
    minimumDigits: 4,
  });

  const agreement = new RevenueShareAgreement({
    agreementId: seqId,
    organisationId: request.auth.organisationId,
    cafeId,
    partnerName: partner,
    sharePercentage: Math.max(0, Math.min(100, Number(sharePercentage) || 0)),
    fixedFeePaisa: Math.max(0, Number(fixedFeePaisa) || 0),
    status: 'ACTIVE',
    effectiveFrom: effectiveFrom && /^\d{4}-\d{2}-\d{2}$/.test(effectiveFrom) ? effectiveFrom : getIstBusinessDate(),
    notes: typeof notes === 'string' ? notes.trim() : '',
    createdByUserId: request.auth.userId,
  });

  await agreement.save();

  await recordRequestAudit({
    request,
    module: 'REVENUE_SHARE',
    action: 'CREATE_AGREEMENT',
    entityType: 'REVENUE_SHARE_AGREEMENT',
    entityId: seqId,
    after: { agreementId: seqId, cafeId, partnerName: partner },
    result: 'SUCCESS',
    riskClassification: 'LOW',
  });

  return response.status(201).json({
    success: true,
    data: { agreement: agreement.toObject() },
    correlationId: request.correlationId || null,
  });
});

module.exports = {
  listAgreements,
  createAgreement,
};
