'use strict';

/**
 * ASSET & MAINTENANCE CONTROLLER
 */

const {
  Asset,
  ASSET_CATEGORIES,
  ASSET_STATUSES,
} = require('../models/Asset');

const {
  MaintenanceJob,
  MAINTENANCE_STATUSES,
} = require('../models/MaintenanceJob');

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

function assertCafeAccess(request, cafeId) {
  if (request.auth.role === 'MASTER' || request.auth.role === 'OWNER') return;
  if (!request.auth.assignedCafeIds.includes(cafeId)) {
    throw new ApiError(
      403,
      'CAFE_ACCESS_DENIED',
      'You do not have access to this café.'
    );
  }
}

const listAssets = asyncHandler(async (request, response) => {
  const page = parsePositiveInteger(request.query.page, 1, 1000);
  const limit = parsePositiveInteger(request.query.limit, 25, 100);
  const skip = (page - 1) * limit;

  const filter = { organisationId: request.auth.organisationId };
  const { cafeId, status, category } = request.query;

  if (cafeId) {
    const normCafeId = normalizeId(cafeId);
    assertCafeAccess(request, normCafeId);
    filter.cafeId = normCafeId;
  } else if (!['MASTER', 'OWNER'].includes(request.auth.role)) {
    filter.cafeId = { $in: request.auth.assignedCafeIds };
  }

  if (status && ASSET_STATUSES.includes(status.toUpperCase())) filter.status = status.toUpperCase();
  if (category && ASSET_CATEGORIES.includes(category.toUpperCase())) filter.category = category.toUpperCase();

  const [assets, total] = await Promise.all([
    Asset.find(filter)
      .select('-__v -version')
      .sort({ name: 1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    Asset.countDocuments(filter),
  ]);

  return response.status(200).json({
    success: true,
    data: {
      assets,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    },
    correlationId: request.correlationId || null,
  });
});

const createAsset = asyncHandler(async (request, response) => {
  const { cafeId: rawCafeId, name, category, serialNumber, purchaseDate, warrantyExpiryDate, notes } = request.body;

  const cafeId = normalizeId(rawCafeId);
  if (!cafeId) throw new ApiError(400, 'CAFE_ID_REQUIRED', 'cafeId is required.');
  assertCafeAccess(request, cafeId);

  const nameText = typeof name === 'string' ? name.trim() : '';
  if (!nameText) throw new ApiError(400, 'NAME_REQUIRED', 'Asset name is required.');

  const seqId = await SequenceCounter.generateId({
    organisationId: request.auth.organisationId,
    sequenceKey: 'ASSET',
    prefix: 'AST',
    minimumDigits: 4,
  });

  const asset = new Asset({
    assetId: seqId,
    organisationId: request.auth.organisationId,
    cafeId,
    name: nameText,
    category: category ? normalizeId(category) : 'KITCHEN_EQUIPMENT',
    serialNumber: typeof serialNumber === 'string' ? serialNumber.trim() : '',
    purchaseDate: purchaseDate && /^\d{4}-\d{2}-\d{2}$/.test(purchaseDate) ? purchaseDate : null,
    warrantyExpiryDate: warrantyExpiryDate && /^\d{4}-\d{2}-\d{2}$/.test(warrantyExpiryDate) ? warrantyExpiryDate : null,
    notes: typeof notes === 'string' ? notes.trim() : '',
    createdByUserId: request.auth.userId,
  });

  await asset.save();

  await recordRequestAudit({
    request,
    module: 'ASSETS',
    action: 'CREATE_ASSET',
    entityType: 'ASSET',
    entityId: seqId,
    after: { assetId: seqId, cafeId, name: nameText },
    result: 'SUCCESS',
    riskClassification: 'LOW',
  });

  return response.status(201).json({
    success: true,
    data: { asset: asset.toObject() },
    correlationId: request.correlationId || null,
  });
});

const logMaintenanceJob = asyncHandler(async (request, response) => {
  const assetId = normalizeId(request.params.assetId);
  const { issueDescription } = request.body;

  const issueText = typeof issueDescription === 'string' ? issueDescription.trim() : '';
  if (!issueText) throw new ApiError(400, 'ISSUE_REQUIRED', 'issueDescription is required.');

  const asset = await Asset.findOne({
    assetId,
    organisationId: request.auth.organisationId,
  });

  if (!asset) throw new ApiError(404, 'NOT_FOUND', 'Asset not found.');
  assertCafeAccess(request, asset.cafeId);

  const seqId = await SequenceCounter.generateId({
    organisationId: request.auth.organisationId,
    sequenceKey: 'MAINTENANCE_JOB',
    prefix: 'MNT',
    minimumDigits: 4,
  });

  const job = new MaintenanceJob({
    jobId: seqId,
    organisationId: request.auth.organisationId,
    cafeId: asset.cafeId,
    assetId,
    issueDescription: issueText,
    status: 'LOGGED',
    loggedByUserId: request.auth.userId,
  });

  await job.save();

  asset.status = 'UNDER_MAINTENANCE';
  await asset.save();

  await recordRequestAudit({
    request,
    module: 'ASSETS',
    action: 'LOG_MAINTENANCE_JOB',
    entityType: 'MAINTENANCE_JOB',
    entityId: seqId,
    after: { jobId: seqId, assetId },
    result: 'SUCCESS',
    riskClassification: 'LOW',
  });

  return response.status(201).json({
    success: true,
    data: { job: job.toObject(), asset: asset.toObject() },
    correlationId: request.correlationId || null,
  });
});

module.exports = {
  listAssets,
  createAsset,
  logMaintenanceJob,
};
