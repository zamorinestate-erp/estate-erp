'use strict';

const {
  StaffLoanAdvance,
  LOAN_ADVANCE_STATUSES,
} = require('../models/StaffLoanAdvance');

const {
  asyncHandler,
} = require('../utils/asyncHandler');

const {
  ApiError,
} = require('../utils/ApiError');

const SELF_SERVICE_PROJECTION = [
  'loanAdvanceId',
  'cafeId',
  'requestType',
  'requestedAmountPaise',
  'requestReason',
  'status',
  'requestedAt',
  'currency',
  'createdAt',
  'updatedAt',
].join(' ');

function normalizeIdentifier(value) {
  return typeof value === 'string'
    ? value.trim().toUpperCase()
    : '';
}

function parsePositiveInteger(
  value,
  fallback,
  maximum
) {
  const parsedValue =
    Number.parseInt(value, 10);

  if (
    !Number.isInteger(parsedValue) ||
    parsedValue < 1
  ) {
    return fallback;
  }

  return Math.min(
    parsedValue,
    maximum
  );
}

function getStatusFilter(request) {
  const status =
    normalizeIdentifier(
      request.query.status
    );

  if (
    status &&
    !LOAN_ADVANCE_STATUSES.includes(status)
  ) {
    throw new ApiError(
      400,
      'INVALID_LOAN_ADVANCE_STATUS',
      'status must be REQUESTED, APPROVED or REJECTED.'
    );
  }

  return status;
}

function buildMyLoanAdvanceFilter(request) {
  const filter = {
    organisationId:
      request.auth.organisationId,

    employeeUserId:
      request.auth.userId,
  };

  const status =
    getStatusFilter(request);

  if (status) {
    filter.status = status;
  }

  return filter;
}

const listMyLoanAdvances = asyncHandler(
  async (request, response) => {
    const page =
      parsePositiveInteger(
        request.query.page,
        1,
        100000
      );

    const limit =
      parsePositiveInteger(
        request.query.limit,
        12,
        100
      );

    const filter =
      buildMyLoanAdvanceFilter(
        request
      );

    const skip =
      (page - 1) * limit;

    const [
      loanAdvances,
      total,
    ] = await Promise.all([
      StaffLoanAdvance.find(filter)
        .select(SELF_SERVICE_PROJECTION)
        .sort({
          requestedAt: -1,
          loanAdvanceId: -1,
        })
        .skip(skip)
        .limit(limit),

      StaffLoanAdvance.countDocuments(
        filter
      ),
    ]);

    return response.status(200).json({
      success: true,

      data: {
        loanAdvances,

        pagination: {
          page,
          limit,
          total,

          totalPages:
            Math.ceil(
              total / limit
            ),
        },
      },

      correlationId:
        request.correlationId || null,
    });
  }
);

const getMyLoanAdvance = asyncHandler(
  async (request, response) => {
    const loanAdvanceId =
      normalizeIdentifier(
        request.params.loanAdvanceId
      );

    if (
      !/^LN-[0-9]{4,}$/.test(
        loanAdvanceId
      )
    ) {
      throw new ApiError(
        400,
        'INVALID_LOAN_ADVANCE_ID',
        'A valid loan or advance ID is required.'
      );
    }

    const loanAdvance =
      await StaffLoanAdvance.findOne({
        organisationId:
          request.auth.organisationId,

        employeeUserId:
          request.auth.userId,

        loanAdvanceId,
      }).select(
        SELF_SERVICE_PROJECTION
      );

    if (!loanAdvance) {
      throw new ApiError(
        404,
        'LOAN_ADVANCE_NOT_FOUND',
        'The loan or advance was not found.'
      );
    }

    return response.status(200).json({
      success: true,

      data: {
        loanAdvance,
      },

      correlationId:
        request.correlationId || null,
    });
  }
);

module.exports = {
  listMyLoanAdvances,
  getMyLoanAdvance,
};
