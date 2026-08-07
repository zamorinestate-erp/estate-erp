'use strict';

/**
 * FILE CONTROLLER
 */

const { PrivateFile } = require('../models/PrivateFile');
const { SequenceCounter } = require('../models/SequenceCounter');
const { asyncHandler } = require('../utils/asyncHandler');
const { ApiError } = require('../utils/ApiError');
const { recordRequestAudit } = require('../services/auditService');

function normalizeId(value) {
  return typeof value === 'string' ? value.trim().toUpperCase() : '';
}

const getFileMetadata = asyncHandler(async (request, response) => {
  const fileId = normalizeId(request.params.fileId);
  const fileDoc = await PrivateFile.findOne({
    fileId,
    organisationId: request.auth.organisationId,
  }).select('-__v -version').lean();

  if (!fileDoc) {
    throw new ApiError(404, 'NOT_FOUND', 'File not found.');
  }

  return response.status(200).json({
    success: true,
    data: { file: fileDoc },
    correlationId: request.correlationId || null,
  });
});

const registerFileRecord = asyncHandler(async (request, response) => {
  const { originalName, mimeType, sizeBytes, storagePath } = request.body;

  if (!originalName || !mimeType || !storagePath) {
    throw new ApiError(400, 'MISSING_FIELDS', 'originalName, mimeType, and storagePath are required.');
  }

  const seqId = await SequenceCounter.generateId({
    organisationId: request.auth.organisationId,
    sequenceKey: 'PRIVATE_FILE',
    prefix: 'FILE',
    minimumDigits: 4,
  });

  const fileDoc = new PrivateFile({
    fileId: seqId,
    organisationId: request.auth.organisationId,
    originalName: String(originalName).trim(),
    mimeType: String(mimeType).trim(),
    sizeBytes: Number(sizeBytes) || 0,
    storagePath: String(storagePath).trim(),
    uploadedByUserId: request.auth.userId,
  });

  await fileDoc.save();

  await recordRequestAudit({
    request,
    module: 'FILES',
    action: 'REGISTER_FILE',
    entityType: 'PRIVATE_FILE',
    entityId: seqId,
    after: { fileId: seqId, name: originalName },
    result: 'SUCCESS',
    riskClassification: 'LOW',
  });

  return response.status(201).json({
    success: true,
    data: { file: fileDoc.toObject() },
    correlationId: request.correlationId || null,
  });
});

module.exports = {
  getFileMetadata,
  registerFileRecord,
};
