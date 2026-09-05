'use strict';

const {
  Cafe,
  CAFE_STATUSES,
  CAFE_TYPES,
} = require('../models/Cafe');

const {
  SequenceCounter,
} = require('../models/SequenceCounter');

const cafeService = require('../services/cafeService');

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

function requireGovernanceRole(request) {
  const role = request.auth?.role ? request.auth.role.toUpperCase() : '';
  if (role !== 'MASTER' && role !== 'OWNER') {
    throw new ApiError(
      403,
      'GOVERNANCE_ACCESS_REQUIRED',
      'Only Master and Owner roles may perform this action.'
    );
  }
}

function requireMaster(request) {
  requireGovernanceRole(request);
}

function buildCafeFilter(request) {
  const filter = {
    organisationId:
      request.auth.organisationId,
  };

  if (request.auth.role !== 'MASTER' && request.auth.role !== 'OWNER') {
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
      request.auth.role !== 'OWNER' &&
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
    requireGovernanceRole(request);

    const result = await cafeService.createCafeWithAccess({
      auth: request.auth,
      cafeData: request.body || {},
      clientIp: request.ip,
      userAgent: request.headers['user-agent'],
      correlationId:
        request.correlationId ||
        request.headers['x-correlation-id'] ||
        null,
    });

    return response.status(201).json({
      success: true,
      message:
        'Café created successfully and access credentials provisioned.',
      data: {
        cafe: result.cafe,
        access: result.access,
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

    try {
      const { CafeAccess } = require('../models/CafeAccess');
      if (status === 'TEMPORARILY_CLOSED' || status === 'CLOSED') {
        await CafeAccess.updateOne(
          { organisationId: request.auth.organisationId, cafeId },
          { $set: { accessStatus: 'DISABLED', updatedBy: request.auth.userId } }
        ).catch(() => {});
      } else if (status === 'ACTIVE') {
        await CafeAccess.updateOne(
          { organisationId: request.auth.organisationId, cafeId, accessStatus: 'DISABLED' },
          { $set: { accessStatus: 'ACTIVE', updatedBy: request.auth.userId } }
        ).catch(() => {});
      }
    } catch (_) {}

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

    try {
      const { CafeAccess } = require('../models/CafeAccess');
      await CafeAccess.updateOne(
        {
          organisationId: request.auth.organisationId,
          cafeId,
        },
        {
          $set: {
            accessStatus: 'SUSPENDED',
            provisioningStatus: 'ARCHIVED',
            updatedBy: request.auth.userId,
          },
        }
      ).catch(() => {});
    } catch (_) {}

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