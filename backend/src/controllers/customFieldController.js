'use strict';

/**
 * CUSTOM FIELD DEFINITION CONTROLLER  (Capability 26)
 *
 * CRUD for CustomFieldDefinition records.
 * All mutating routes are MASTER-only.
 * Reads are open to all authenticated roles (org-scoped).
 *
 * Route base: /api/v1/custom-fields
 */

const {
  CustomFieldDefinition,
  FIELD_TYPES,
  FIELD_STATUSES,
} = require('../models/CustomFieldDefinition');

const { ApiError } = require('../utils/ApiError');
const { asyncHandler } = require('../utils/asyncHandler');
const { recordRequestAudit } = require('../services/auditService');

const MAX_DEFINITIONS_PER_ORG = 50;
const VALID_KEY_RE = /^[a-z0-9_]{1,64}$/;

// ── List all active custom field definitions for the authenticated org ─────────

const listCustomFields = asyncHandler(async (request, response) => {
  const { organisationId } = request.user;

  const definitions = await CustomFieldDefinition.find({
    organisationId,
    status: 'ACTIVE',
  })
    .sort({ displayOrder: 1, createdAt: 1 })
    .lean();

  return response.status(200).json({
    success: true,
    data: { definitions },
    correlationId: request.correlationId,
  });
});

// ── Get a single custom field definition ──────────────────────────────────────

const getCustomField = asyncHandler(async (request, response) => {
  const { organisationId } = request.user;
  const { key } = request.params;

  const definition = await CustomFieldDefinition.findOne({
    organisationId,
    key: key.toLowerCase(),
  }).lean();

  if (!definition) {
    throw new ApiError(
      404,
      'CUSTOM_FIELD_NOT_FOUND',
      `No custom field definition found for key '${key}'.`
    );
  }

  return response.status(200).json({
    success: true,
    data: { definition },
    correlationId: request.correlationId,
  });
});

// ── Create a new custom field definition ─────────────────────────────────────

const createCustomField = asyncHandler(async (request, response) => {
  const { organisationId, userId } = request.user;
  const {
    key,
    label,
    description,
    fieldType,
    allowedValues,
    isRequired,
    displayOrder,
  } = request.body;

  // Validate required fields
  if (!key || !label || !fieldType) {
    throw new ApiError(
      400,
      'CUSTOM_FIELD_REQUIRED',
      'key, label, and fieldType are required.'
    );
  }

  // Validate key format
  const normKey = key.trim().toLowerCase();
  if (!VALID_KEY_RE.test(normKey)) {
    throw new ApiError(
      400,
      'INVALID_CUSTOM_FIELD_KEY',
      'key must be 1-64 characters, alphanumeric and underscores only.'
    );
  }

  // Validate fieldType
  if (!FIELD_TYPES.includes(fieldType.toUpperCase())) {
    throw new ApiError(
      400,
      'INVALID_FIELD_TYPE',
      `fieldType must be one of: ${FIELD_TYPES.join(', ')}.`
    );
  }

  // Enforce per-org cap
  const existingCount = await CustomFieldDefinition.countDocuments({
    organisationId,
    status: 'ACTIVE',
  });

  if (existingCount >= MAX_DEFINITIONS_PER_ORG) {
    throw new ApiError(
      409,
      'CUSTOM_FIELD_LIMIT_REACHED',
      `Organisation has reached the maximum of ${MAX_DEFINITIONS_PER_ORG} active custom field definitions.`
    );
  }

  // Validate SELECT type has allowedValues
  if (
    fieldType.toUpperCase() === 'SELECT' &&
    (!Array.isArray(allowedValues) || allowedValues.length === 0)
  ) {
    throw new ApiError(
      400,
      'SELECT_REQUIRES_VALUES',
      'allowedValues must be a non-empty array for SELECT type fields.'
    );
  }

  const definition = new CustomFieldDefinition({
    organisationId,
    key: normKey,
    label: String(label).trim(),
    description: description ? String(description).trim() : '',
    fieldType: fieldType.toUpperCase(),
    allowedValues: Array.isArray(allowedValues) ? allowedValues : [],
    isRequired: Boolean(isRequired),
    displayOrder: Number.isFinite(displayOrder) ? displayOrder : 0,
    appliesTo: 'USER',
    status: 'ACTIVE',
    createdByUserId: userId,
  });

  await definition.save();

  await recordRequestAudit({
    request,
    module: 'ADMINISTRATION',
    action: 'CREATE_CUSTOM_FIELD',
    entityType: 'CUSTOM_FIELD_DEFINITION',
    entityId: definition.key,
    after: { key: definition.key, fieldType: definition.fieldType },
    result: 'SUCCESS',
    riskClassification: 'LOW',
  });

  return response.status(201).json({
    success: true,
    data: { definition },
    correlationId: request.correlationId,
  });
});

// ── Update an existing custom field definition ────────────────────────────────

const updateCustomField = asyncHandler(async (request, response) => {
  const { organisationId, userId } = request.user;
  const { key } = request.params;

  const definition = await CustomFieldDefinition.findOne({
    organisationId,
    key: key.toLowerCase(),
  });

  if (!definition) {
    throw new ApiError(
      404,
      'CUSTOM_FIELD_NOT_FOUND',
      `No custom field definition found for key '${key}'.`
    );
  }

  if (definition.status === 'ARCHIVED') {
    throw new ApiError(
      409,
      'CUSTOM_FIELD_ARCHIVED',
      'Archived custom field definitions cannot be modified.'
    );
  }

  const allowed = ['label', 'description', 'allowedValues', 'isRequired', 'displayOrder'];
  for (const field of allowed) {
    if (request.body[field] !== undefined) {
      definition[field] = request.body[field];
    }
  }

  definition.lastModifiedByUserId = userId;
  await definition.save();

  await recordRequestAudit({
    request,
    module: 'ADMINISTRATION',
    action: 'UPDATE_CUSTOM_FIELD',
    entityType: 'CUSTOM_FIELD_DEFINITION',
    entityId: definition.key,
    after: { key: definition.key },
    result: 'SUCCESS',
    riskClassification: 'LOW',
  });

  return response.status(200).json({
    success: true,
    data: { definition },
    correlationId: request.correlationId,
  });
});

// ── Archive a custom field definition ─────────────────────────────────────────

const archiveCustomField = asyncHandler(async (request, response) => {
  const { organisationId, userId } = request.user;
  const { key } = request.params;

  const definition = await CustomFieldDefinition.findOne({
    organisationId,
    key: key.toLowerCase(),
  });

  if (!definition) {
    throw new ApiError(
      404,
      'CUSTOM_FIELD_NOT_FOUND',
      `No custom field definition found for key '${key}'.`
    );
  }

  if (definition.status === 'ARCHIVED') {
    throw new ApiError(
      409,
      'ALREADY_ARCHIVED',
      'Custom field definition is already archived.'
    );
  }

  definition.status = 'ARCHIVED';
  definition.lastModifiedByUserId = userId;
  await definition.save();

  await recordRequestAudit({
    request,
    module: 'ADMINISTRATION',
    action: 'ARCHIVE_CUSTOM_FIELD',
    entityType: 'CUSTOM_FIELD_DEFINITION',
    entityId: definition.key,
    after: { key: definition.key, status: 'ARCHIVED' },
    result: 'SUCCESS',
    riskClassification: 'LOW',
  });

  return response.status(200).json({
    success: true,
    data: { definition },
    correlationId: request.correlationId,
  });
});

module.exports = {
  listCustomFields,
  getCustomField,
  createCustomField,
  updateCustomField,
  archiveCustomField,
};
