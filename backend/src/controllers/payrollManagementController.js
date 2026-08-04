'use strict';

const {
  PayrollRun,
  PAYROLL_RUN_STATUSES,
} = require('../models/PayrollRun');

const {
  Payslip,
  PAYSLIP_STATUSES,
} = require('../models/Payslip');

const {
  canAccessCafe,
} = require('../middleware/authorize');

const {
  recordRequestAudit,
} = require('../services/auditService');

const {
  asyncHandler,
} = require('../utils/asyncHandler');

const {
  ApiError,
} = require('../utils/ApiError');

const PAYROLL_MANAGEMENT_ROLES = [
  'MASTER',
  'OWNER',
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

function requirePayrollManagementAccess(
  request
) {
  if (
    !PAYROLL_MANAGEMENT_ROLES.includes(
      request.auth.role
    )
  ) {
    throw new ApiError(
      403,
      'PAYROLL_MANAGEMENT_FORBIDDEN',
      'Only MASTER and OWNER may manage payroll.'
    );
  }
}

function parsePeriodKey(value) {
  const periodKey =
    typeof value === 'string'
      ? value.trim()
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

function parseStatus(
  value,
  allowedStatuses,
  errorCode,
  message
) {
  const status =
    normalizeIdentifier(value);

  if (
    status &&
    !allowedStatuses.includes(status)
  ) {
    throw new ApiError(
      400,
      errorCode,
      message
    );
  }

  return status;
}

function getRequestedCafeId(request) {
  const cafeId =
    normalizeIdentifier(
      request.query.cafeId
    );

  if (
    cafeId &&
    !canAccessCafe(
      request.auth,
      cafeId
    )
  ) {
    throw new ApiError(
      403,
      'CAFE_ACCESS_DENIED',
      'You do not have access to this café.'
    );
  }

  return cafeId;
}

function buildPayrollRunFilter(request) {
  const filter = {
    organisationId:
      request.auth.organisationId,
  };

  if (request.auth.role === 'OWNER') {
    filter.cafeId = {
      $in:
        request.auth.assignedCafeIds || [],
    };
  }

  const cafeId =
    getRequestedCafeId(request);

  if (cafeId) {
    filter.cafeId = cafeId;
  }

  const periodKey =
    parsePeriodKey(
      request.query.periodKey
    );

  if (periodKey) {
    filter.periodKey = periodKey;
  }

  const status =
    parseStatus(
      request.query.status,
      PAYROLL_RUN_STATUSES,
      'INVALID_PAYROLL_STATUS',
      'The requested payroll status is invalid.'
    );

  if (status) {
    filter.status = status;
  }

  return filter;
}

function normalizePayrollRunId(value) {
  const payrollRunId =
    normalizeIdentifier(value);

  if (
    !/^PR-\d{6}-\d{4,}$/.test(
      payrollRunId
    )
  ) {
    throw new ApiError(
      400,
      'INVALID_PAYROLL_RUN_ID',
      'A valid payroll run ID is required.'
    );
  }

  return payrollRunId;
}

async function findManagedPayrollRun(
  request,
  payrollRunId
) {
  const filter = {
    organisationId:
      request.auth.organisationId,
    payrollRunId,
  };

  if (request.auth.role === 'OWNER') {
    filter.cafeId = {
      $in:
        request.auth.assignedCafeIds || [],
    };
  }

  const payrollRun =
    await PayrollRun.findOne(filter);

  if (!payrollRun) {
    throw new ApiError(
      404,
      'PAYROLL_RUN_NOT_FOUND',
      'The payroll run was not found.'
    );
  }

  return payrollRun;
}

const listPayrollRuns = asyncHandler(
  async (request, response) => {
    requirePayrollManagementAccess(
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
        25,
        100
      );

    const filter =
      buildPayrollRunFilter(request);

    const skip =
      (page - 1) * limit;

    const [
      payrollRuns,
      total,
    ] = await Promise.all([
      PayrollRun.find(filter)
        .sort({
          periodKey: -1,
          cafeId: 1,
          payrollRunId: -1,
        })
        .skip(skip)
        .limit(limit),

      PayrollRun.countDocuments(
        filter
      ),
    ]);

    await recordRequestAudit({
      request,
      module: 'PAYROLL',
      action: 'LIST_PAYROLL_RUNS',
      entityType:
        'PAYROLL_RUN_COLLECTION',
      entityId: 'PAYROLL_RUNS',
      riskClassification: 'MEDIUM',
      metadata: {
        page,
        limit,
        total,
        resultCount:
          payrollRuns.length,
        cafeId:
          normalizeIdentifier(
            request.query.cafeId
          ) || null,
        periodKey:
          parsePeriodKey(
            request.query.periodKey
          ) || null,
        status:
          normalizeIdentifier(
            request.query.status
          ) || null,
      },
    });

    return response.status(200).json({
      success: true,
      data: {
        payrollRuns,
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

const getPayrollRun = asyncHandler(
  async (request, response) => {
    requirePayrollManagementAccess(
      request
    );

    const payrollRunId =
      normalizePayrollRunId(
        request.params.payrollRunId
      );

    const payrollRun =
      await findManagedPayrollRun(
        request,
        payrollRunId
      );

    await recordRequestAudit({
      request,
      module: 'PAYROLL',
      action: 'VIEW_PAYROLL_RUN',
      entityType: 'PAYROLL_RUN',
      entityId: payrollRunId,
      cafeId: payrollRun.cafeId,
      riskClassification: 'MEDIUM',
      metadata: {
        status: payrollRun.status,
        periodKey:
          payrollRun.periodKey,
      },
    });

    return response.status(200).json({
      success: true,
      data: {
        payrollRun,
      },
      correlationId:
        request.correlationId || null,
    });
  }
);

const listPayrollRunPayslips =
  asyncHandler(
    async (request, response) => {
      requirePayrollManagementAccess(
        request
      );

      const payrollRunId =
        normalizePayrollRunId(
          request.params.payrollRunId
        );

      const payrollRun =
        await findManagedPayrollRun(
          request,
          payrollRunId
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
          25,
          100
        );

      const filter = {
        organisationId:
          request.auth.organisationId,
        payrollRunId,
        cafeId:
          payrollRun.cafeId,
      };

      const employeeUserId =
        normalizeIdentifier(
          request.query.employeeUserId
        );

      if (employeeUserId) {
        if (
          !/^(MU|OW|AD|ST)-\d{4,}$/.test(
            employeeUserId
          )
        ) {
          throw new ApiError(
            400,
            'INVALID_EMPLOYEE_USER_ID',
            'A valid employee user ID is required.'
          );
        }

        filter.employeeUserId =
          employeeUserId;
      }

      const status =
        parseStatus(
          request.query.status,
          PAYSLIP_STATUSES,
          'INVALID_PAYSLIP_STATUS',
          'The requested payslip status is invalid.'
        );

      if (status) {
        filter.status = status;
      }

      const skip =
        (page - 1) * limit;

      const [
        payslips,
        total,
      ] = await Promise.all([
        Payslip.find(filter)
          .sort({
            employeeName: 1,
            employeeUserId: 1,
            payslipId: 1,
          })
          .skip(skip)
          .limit(limit),

        Payslip.countDocuments(
          filter
        ),
      ]);

      await recordRequestAudit({
        request,
        module: 'PAYROLL',
        action:
          'LIST_PAYROLL_RUN_PAYSLIPS',
        entityType: 'PAYROLL_RUN',
        entityId: payrollRunId,
        cafeId: payrollRun.cafeId,
        riskClassification: 'HIGH',
        metadata: {
          page,
          limit,
          total,
          resultCount:
            payslips.length,
          employeeUserId:
            employeeUserId || null,
          status: status || null,
        },
      });

      return response.status(200).json({
        success: true,
        data: {
          payrollRun,
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

module.exports = {
  listPayrollRuns,
  getPayrollRun,
  listPayrollRunPayslips,
};
