'use strict';

const {
  Payslip,
} = require('../models/Payslip');

const {
  asyncHandler,
} = require('../utils/asyncHandler');

const {
  ApiError,
} = require('../utils/ApiError');

const STAFF_VISIBLE_PAYSLIP_STATUSES = [
  'ISSUED',
  'PAID',
];

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

function ensureStaffSelfServiceAccess(
  request
) {
  if (
    request.auth.role !== 'STAFF'
  ) {
    throw new ApiError(
      403,
      'STAFF_SELF_SERVICE_REQUIRED',
      'This endpoint is available only to authenticated Staff users.'
    );
  }
}

function getPeriodKey(request) {
  const periodKey =
    typeof request.query.periodKey ===
      'string'
      ? request.query.periodKey.trim()
      : '';

  if (
    periodKey &&
    !/^\d{4}-\d{2}$/.test(
      periodKey
    )
  ) {
    throw new ApiError(
      400,
      'INVALID_PAYROLL_PERIOD',
      'periodKey must use YYYY-MM format.'
    );
  }

  return periodKey;
}

function getVisibleStatus(request) {
  const status =
    normalizeIdentifier(
      request.query.status
    );

  if (
    status &&
    !STAFF_VISIBLE_PAYSLIP_STATUSES
      .includes(status)
  ) {
    throw new ApiError(
      400,
      'INVALID_PAYSLIP_STATUS',
      'Staff may filter payslips only by ISSUED or PAID status.'
    );
  }

  return status;
}

function buildStaffPayslipFilter(
  request
) {
  const periodKey =
    getPeriodKey(request);

  const status =
    getVisibleStatus(request);

  const filter = {
    organisationId:
      request.auth.organisationId,

    employeeUserId:
      request.auth.userId,

    status: status || {
      $in:
        STAFF_VISIBLE_PAYSLIP_STATUSES,
    },
  };

  if (periodKey) {
    filter.periodKey =
      periodKey;
  }

  return filter;
}

const listMyPayslips = asyncHandler(
  async (request, response) => {
    ensureStaffSelfServiceAccess(
      request
    );

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
      buildStaffPayslipFilter(
        request
      );

    const skip =
      (page - 1) * limit;

    const [
      payslips,
      total,
    ] = await Promise.all([
      Payslip.find(filter)
        .sort({
          periodKey: -1,
          issuedAt: -1,
          payslipId: -1,
        })
        .skip(skip)
        .limit(limit),

      Payslip.countDocuments(
        filter
      ),
    ]);

    return response.status(200).json({
      success: true,

      data: {
        payslips,

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

const getMyPayslip = asyncHandler(
  async (request, response) => {
    ensureStaffSelfServiceAccess(
      request
    );

    const payslipId =
      normalizeIdentifier(
        request.params.payslipId
      );

    if (
      !/^PS-\d{6}-\d{4,}$/.test(
        payslipId
      )
    ) {
      throw new ApiError(
        400,
        'INVALID_PAYSLIP_ID',
        'A valid payslip ID is required.'
      );
    }

    const payslip =
      await Payslip.findOne({
        organisationId:
          request.auth.organisationId,

        employeeUserId:
          request.auth.userId,

        payslipId,

        status: {
          $in:
            STAFF_VISIBLE_PAYSLIP_STATUSES,
        },
      });

    if (!payslip) {
      throw new ApiError(
        404,
        'PAYSLIP_NOT_FOUND',
        'The payslip was not found.'
      );
    }

    return response.status(200).json({
      success: true,

      data: {
        payslip,
      },

      correlationId:
        request.correlationId || null,
    });
  }
);

module.exports = {
  listMyPayslips,
  getMyPayslip,
};
