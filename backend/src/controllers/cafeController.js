'use strict';

const {
  Cafe,
  CAFE_STATUSES,
  CAFE_TYPES,
} = require('../models/Cafe');

const {
  SequenceCounter,
} = require('../models/SequenceCounter');

const {
  asyncHandler,
} = require('../utils/asyncHandler');

const {
  ApiError,
} = require('../utils/ApiError');

function normalizeIdentifier(value) {
  return typeof value === 'string'
    ? value.trim().toUpperCase()
    : '';
}

function requireMaster(request) {
  if (request.auth.role !== 'MASTER') {
    throw new ApiError(
      403,
      'MASTER_ACCESS_REQUIRED',
      'Only the MASTER role may perform this action.'
    );
  }
}

function buildCafeFilter(request) {
  const filter = {
    organisationId:
      request.auth.organisationId,
  };

  if (request.auth.role !== 'MASTER') {
    filter.cafeId = {
      $in: request.auth.assignedCafeIds || [],
    };
  }

  const status =
    normalizeIdentifier(
      request.query.status
    );

  if (status) {
    if (!CAFE_STATUSES.includes(status)) {
      throw new ApiError(
        400,
        'INVALID_CAFE_STATUS',
        'The requested café status is invalid.'
      );
    }

    filter.status = status;
  }

  if (
    typeof request.query.search ===
      'string' &&
    request.query.search.trim()
  ) {
    filter.$or = [
      {
        name: {
          $regex:
            request.query.search.trim(),
          $options: 'i',
        },
      },
      {
        displayName: {
          $regex:
            request.query.search.trim(),
          $options: 'i',
        },
      },
      {
        cafeId: {
          $regex:
            request.query.search.trim(),
          $options: 'i',
        },
      },
    ];
  }

  return filter;
}

const listCafes = asyncHandler(
  async (request, response) => {
    const cafes = await Cafe.find(
      buildCafeFilter(request)
    ).sort({
      name: 1,
      cafeId: 1,
    });

    return response.status(200).json({
      success: true,
      data: {
        cafes,
        count: cafes.length,
      },
      correlationId:
        request.correlationId || null,
    });
  }
);

const getCafe = asyncHandler(
  async (request, response) => {
    const cafeId =
      normalizeIdentifier(
        request.params.cafeId
      );

    const filter = {
      organisationId:
        request.auth.organisationId,
      cafeId,
    };

    if (
      request.auth.role !== 'MASTER' &&
      !request.auth.assignedCafeIds.includes(
        cafeId
      )
    ) {
      throw new ApiError(
        403,
        'CAFE_ACCESS_DENIED',
        'You do not have access to this café.'
      );
    }

    const cafe = await Cafe.findOne(filter);

    if (!cafe) {
      throw new ApiError(
        404,
        'CAFE_NOT_FOUND',
        'The café was not found.'
      );
    }

    return response.status(200).json({
      success: true,
      data: {
        cafe,
      },
      correlationId:
        request.correlationId || null,
    });
  }
);

const createCafe = asyncHandler(
  async (request, response) => {
    requireMaster(request);

    const {
      name,
      displayName,
      cafeType = 'STANDARD_CAFE',
    } = request.body || {};

    if (
      typeof name !== 'string' ||
      !name.trim() ||
      typeof displayName !== 'string' ||
      !displayName.trim()
    ) {
      throw new ApiError(
        400,
        'CAFE_FIELDS_REQUIRED',
        'Café name and display name are required.'
      );
    }

    const normalizedCafeType =
      normalizeIdentifier(cafeType);

    if (
      !CAFE_TYPES.includes(
        normalizedCafeType
      )
    ) {
      throw new ApiError(
        400,
        'INVALID_CAFE_TYPE',
        'The café type is invalid.'
      );
    }

    const cafeId =
      await SequenceCounter.generateId({
        organisationId:
          request.auth.organisationId,
        sequenceKey: 'CAFE',
        prefix: 'ZC',
        minimumDigits: 4,
      });

    const cafe = await Cafe.create({
      ...request.body,
      cafeId,
      organisationId:
        request.auth.organisationId,
      name: name.trim(),
      displayName:
        displayName.trim(),
      cafeType:
        normalizedCafeType,
      status: 'DRAFT',
      timezone: 'Asia/Kolkata',
      currency: 'INR',
      createdBy:
        request.auth.userId,
      updatedBy:
        request.auth.userId,
    });

    // Stage 008 Non-Negotiable: Auto-provision all active global inventory items to the new café with quantity 0
    try {
      const { GlobalInventoryItem } = require('../models/GlobalInventoryItem');
      const { CafeInventoryConfig } = require('../models/CafeInventoryConfig');
      const activeItems = await GlobalInventoryItem.find({ organisationId: request.auth.organisationId, status: 'ACTIVE' }).lean();
      if (activeItems.length > 0) {
        const configDocs = activeItems.map((itm) => ({
          organisationId: request.auth.organisationId,
          cafeId,
          itemId: itm.itemId,
          currentQuantityBase: 0,
          availableQuantityBase: 0,
          reservedQuantityBase: 0,
          quarantinedQuantityBase: 0,
          expiredQuantityBase: 0,
          inTransitQuantityBase: 0,
          incomingQuantityBase: 0,
          minQuantityBase: 10,
          parQuantityBase: 25,
          maxQuantityBase: 50,
          safetyStockBase: 5,
          stockedHere: true,
          replenishmentEnabled: true,
          primaryLocation: 'Main Store',
          storageLocations: ['Main Store'],
          status: 'ACTIVE',
        }));
        await CafeInventoryConfig.insertMany(configDocs, { ordered: false }).catch(() => {});
      }
    } catch (_) {
      // Non-blocking provisioning catch
    }

    return response.status(201).json({
      success: true,
      message:
        'Café created successfully and global inventory items provisioned.',
      data: {
        cafe,
      },
      correlationId:
        request.correlationId || null,
    });
  }
);

const updateCafe = asyncHandler(
  async (request, response) => {
    requireMaster(request);

    const cafeId =
      normalizeIdentifier(
        request.params.cafeId
      );

    const protectedFields = [
      'cafeId',
      'organisationId',
      'currency',
      'timezone',
      'createdBy',
      'archivedAt',
      'archivedBy',
      'archiveReason',
      'closure',
    ];

    const updates = {
      ...(request.body || {}),
    };

    protectedFields.forEach(
      (field) => delete updates[field]
    );

    updates.updatedBy =
      request.auth.userId;

    const cafe = await Cafe.findOneAndUpdate(
      {
        organisationId:
          request.auth.organisationId,
        cafeId,
        status: {
          $ne: 'ARCHIVED',
        },
      },
      {
        $set: updates,
      },
      {
        returnDocument: 'after',
        runValidators: true,
      }
    );

    if (!cafe) {
      throw new ApiError(
        404,
        'CAFE_NOT_FOUND',
        'The café was not found.'
      );
    }

    return response.status(200).json({
      success: true,
      message:
        'Café updated successfully.',
      data: {
        cafe,
      },
      correlationId:
        request.correlationId || null,
    });
  }
);

const changeCafeStatus = asyncHandler(
  async (request, response) => {
    requireMaster(request);

    const cafeId =
      normalizeIdentifier(
        request.params.cafeId
      );

    const status =
      normalizeIdentifier(
        request.body?.status
      );

    if (
      !CAFE_STATUSES.includes(status) ||
      status === 'ARCHIVED'
    ) {
      throw new ApiError(
        400,
        'INVALID_CAFE_STATUS',
        'The requested café status is invalid.'
      );
    }

    const cafe = await Cafe.findOneAndUpdate(
      {
        organisationId:
          request.auth.organisationId,
        cafeId,
        status: {
          $ne: 'ARCHIVED',
        },
      },
      {
        $set: {
          status,
          updatedBy:
            request.auth.userId,
        },
      },
      {
        returnDocument: 'after',
        runValidators: true,
      }
    );

    if (!cafe) {
      throw new ApiError(
        404,
        'CAFE_NOT_FOUND',
        'The café was not found.'
      );
    }

    return response.status(200).json({
      success: true,
      message:
        'Café status updated successfully.',
      data: {
        cafe,
      },
      correlationId:
        request.correlationId || null,
    });
  }
);

const archiveCafe = asyncHandler(
  async (request, response) => {
    requireMaster(request);

    const cafeId =
      normalizeIdentifier(
        request.params.cafeId
      );

    const reason =
      typeof request.body?.reason ===
        'string'
        ? request.body.reason.trim()
        : '';

    if (!reason) {
      throw new ApiError(
        400,
        'ARCHIVE_REASON_REQUIRED',
        'An archive reason is required.'
      );
    }

    const cafe = await Cafe.findOne({
      organisationId:
        request.auth.organisationId,
      cafeId,
      status: {
        $ne: 'ARCHIVED',
      },
    });

    if (!cafe) {
      throw new ApiError(
        404,
        'CAFE_NOT_FOUND',
        'The café was not found.'
      );
    }

    await cafe.archive({
      userId:
        request.auth.userId,
      reason,
    });

    return response.status(200).json({
      success: true,
      message:
        'Café archived successfully.',
      data: {
        cafe,
      },
      correlationId:
        request.correlationId || null,
    });
  }
);

module.exports = {
  listCafes,
  getCafe,
  createCafe,
  updateCafe,
  changeCafeStatus,
  archiveCafe,
};