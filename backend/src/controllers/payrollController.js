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

const PAYSLIP_SELF_SERVICE_ROLES = [
  'MASTER',
  'OWNER',
  'CAFE_ADMIN',
  'STAFF',
];

const SELF_SERVICE_VISIBLE_PAYSLIP_STATUSES = [
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

function ensurePayrollSelfServiceAccess(
  request
) {
  if (
    !PAYSLIP_SELF_SERVICE_ROLES.includes(
      request.auth.role
    )
  ) {
    throw new ApiError(
      403,
      'PAYSLIP_SELF_SERVICE_FORBIDDEN',
      'This endpoint is available only to authenticated company employees.'
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
    !SELF_SERVICE_VISIBLE_PAYSLIP_STATUSES
      .includes(status)
  ) {
    throw new ApiError(
      400,
      'INVALID_PAYSLIP_STATUS',
      'Employees may filter their payslips only by ISSUED or PAID status.'
    );
  }

  return status;
}

function buildMyPayslipFilter(
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
        SELF_SERVICE_VISIBLE_PAYSLIP_STATUSES,
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
    ensurePayrollSelfServiceAccess(
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
      buildMyPayslipFilter(
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
    ensurePayrollSelfServiceAccess(
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
            SELF_SERVICE_VISIBLE_PAYSLIP_STATUSES,
        },
      });

    if (!payslip) {
      throw new ApiError(
        404,
        'PAYSLIP_NOT_FOUND',
        'The payslip was not found.'
      );
    }

    if (request.query?.format === 'PDF' || request.headers?.accept === 'application/pdf') {
      const { generatePdf } = require('../utils/exportGenerators');
      const earnings = payslip.earnings || [];
      const deductions = payslip.deductions || [];
      const columns = [
        { key: 'component', label: 'PAY COMPONENT' },
        { key: 'type', label: 'TYPE' },
        { key: 'amount', label: 'AMOUNT (₹)' },
      ];
      const rows = [
        ...earnings.map((e) => ({ component: e.name || e.componentCode, type: 'EARNING', amount: `₹${((e.amountPaisa || 0) / 100).toFixed(2)}` })),
        ...deductions.map((d) => ({ component: d.name || d.componentCode, type: 'DEDUCTION', amount: `₹${((d.amountPaisa || 0) / 100).toFixed(2)}` })),
        { component: 'NET SALARY DISBURSED', type: 'TOTAL', amount: `₹${((payslip.netPayPaisa || 0) / 100).toFixed(2)}` }
      ];
      const pdf = generatePdf({
        reportTitle: `MONTHLY SALARY PAYSLIP — ${payslip.periodKey}`,
        reportCode: `PS-${payslip.periodKey}`,
        scope: `Employee: ${payslip.employeeName || request.auth.name || 'Staff Member'} (${request.auth.userId})`,
        period: payslip.periodKey,
        columns,
        rows,
        kpiCards: [
          { label: 'Gross Pay', value: `₹${((payslip.grossPayPaisa || 0) / 100).toFixed(2)}` },
          { label: 'Total Deductions', value: `₹${((payslip.totalDeductionsPaisa || 0) / 100).toFixed(2)}` },
          { label: 'Net Pay', value: `₹${((payslip.netPayPaisa || 0) / 100).toFixed(2)}` },
          { label: 'Pay Status', value: payslip.status || 'ISSUED' },
        ]
      });
      response.setHeader('Content-Type', 'application/pdf');
      response.setHeader('Content-Disposition', `attachment; filename="payslip_${payslip.payslipId}.pdf"`);
      return response.status(200).send(pdf.buffer);
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
