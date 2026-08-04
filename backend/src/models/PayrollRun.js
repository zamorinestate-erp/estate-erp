'use strict';

const mongoose = require('mongoose');

const PAYROLL_RUN_STATUSES = [
  'DRAFT',
  'CALCULATED',
  'SUBMITTED',
  'APPROVED',
  'PAID',
  'VOIDED',
];

function createNonNegativeIntegerField(
  defaultValue = 0
) {
  return {
    type: Number,
    min: 0,
    default: defaultValue,
    validate: {
      validator(value) {
        return Number.isSafeInteger(value);
      },
      message:
        'The value must be a safe non-negative integer.',
    },
  };
}

const payrollRunSchema =
  new mongoose.Schema(
    {
      payrollRunId: {
        type: String,
        required: true,
        unique: true,
        immutable: true,
        trim: true,
        uppercase: true,
        match: /^PR-\d{6}-\d{4,}$/,
      },

      organisationId: {
        type: String,
        required: true,
        immutable: true,
        trim: true,
        uppercase: true,
        index: true,
      },

      cafeId: {
        type: String,
        required: true,
        immutable: true,
        trim: true,
        uppercase: true,
        index: true,
      },

      periodKey: {
        type: String,
        required: true,
        immutable: true,
        trim: true,
        match: /^\d{4}-\d{2}$/,
        index: true,
      },

      periodStartDate: {
        type: String,
        required: true,
        immutable: true,
        trim: true,
        match: /^\d{4}-\d{2}-\d{2}$/,
      },

      periodEndDate: {
        type: String,
        required: true,
        immutable: true,
        trim: true,
        match: /^\d{4}-\d{2}-\d{2}$/,
      },

      status: {
        type: String,
        required: true,
        enum: PAYROLL_RUN_STATUSES,
        default: 'DRAFT',
        index: true,
      },

      employeeCount:
        createNonNegativeIntegerField(),

      totalGrossPaise:
        createNonNegativeIntegerField(),

      totalDeductionPaise:
        createNonNegativeIntegerField(),

      totalNetPayPaise:
        createNonNegativeIntegerField(),

      currency: {
        type: String,
        immutable: true,
        enum: ['INR'],
        default: 'INR',
      },

      calculatedAt: {
        type: Date,
        default: null,
      },

      calculatedBy: {
        type: String,
        trim: true,
        uppercase: true,
        default: null,
      },

      submittedAt: {
        type: Date,
        default: null,
      },

      submittedBy: {
        type: String,
        trim: true,
        uppercase: true,
        default: null,
      },

      approvedAt: {
        type: Date,
        default: null,
      },

      approvedBy: {
        type: String,
        trim: true,
        uppercase: true,
        default: null,
      },

      paidAt: {
        type: Date,
        default: null,
      },

      paidBy: {
        type: String,
        trim: true,
        uppercase: true,
        default: null,
      },

      paymentReference: {
        type: String,
        trim: true,
        uppercase: true,
        maxlength: 200,
        default: '',
      },

      voidedAt: {
        type: Date,
        default: null,
      },

      voidedBy: {
        type: String,
        trim: true,
        uppercase: true,
        default: null,
      },

      voidReason: {
        type: String,
        trim: true,
        maxlength: 2000,
        default: '',
      },

      notes: {
        type: String,
        trim: true,
        maxlength: 2000,
        default: '',
      },

      timezone: {
        type: String,
        immutable: true,
        default: 'Asia/Kolkata',
      },

      createdBy: {
        type: String,
        required: true,
        immutable: true,
        trim: true,
        uppercase: true,
      },

      updatedBy: {
        type: String,
        trim: true,
        uppercase: true,
        default: null,
      },
    },
    {
      timestamps: true,
      optimisticConcurrency: true,
      versionKey: 'version',
      collection: 'payroll_runs',
    }
  );

payrollRunSchema.index(
  {
    organisationId: 1,
    cafeId: 1,
    periodKey: 1,
  },
  {
    unique: true,
    name: 'payroll_run_cafe_period_unique',
  }
);

payrollRunSchema.index(
  {
    organisationId: 1,
    status: 1,
    periodKey: -1,
  },
  {
    name: 'payroll_run_status_period',
  }
);

payrollRunSchema.pre(
  'validate',
  function normalizePayrollRunFields() {
    const identifierFields = [
      'payrollRunId',
      'organisationId',
      'cafeId',
      'calculatedBy',
      'submittedBy',
      'approvedBy',
      'paidBy',
      'voidedBy',
      'createdBy',
      'updatedBy',
      'paymentReference',
    ];

    for (const field of identifierFields) {
      if (
        typeof this[field] === 'string' &&
        this[field]
      ) {
        this[field] =
          this[field]
            .trim()
            .toUpperCase();
      }
    }

    if (
      this.periodStartDate &&
      this.periodEndDate &&
      this.periodStartDate >
        this.periodEndDate
    ) {
      this.invalidate(
        'periodEndDate',
        'Payroll period end date must not be before its start date.'
      );
    }

    if (
      this.periodKey &&
      this.periodStartDate &&
      !this.periodStartDate.startsWith(
        this.periodKey
      )
    ) {
      this.invalidate(
        'periodStartDate',
        'Payroll period start date must match the period key.'
      );
    }

    if (
      this.periodKey &&
      this.periodEndDate &&
      !this.periodEndDate.startsWith(
        this.periodKey
      )
    ) {
      this.invalidate(
        'periodEndDate',
        'Payroll period end date must match the period key.'
      );
    }

    if (
      this.totalDeductionPaise >
      this.totalGrossPaise
    ) {
      this.invalidate(
        'totalDeductionPaise',
        'Payroll deductions cannot exceed gross pay.'
      );
    }

    const expectedNetPayPaise =
      this.totalGrossPaise -
      this.totalDeductionPaise;

    if (
      this.totalNetPayPaise !==
      expectedNetPayPaise
    ) {
      this.invalidate(
        'totalNetPayPaise',
        'Payroll net pay must equal gross pay minus deductions.'
      );
    }

    if (
      [
        'CALCULATED',
        'SUBMITTED',
        'APPROVED',
        'PAID',
      ].includes(this.status) &&
      (
        !this.calculatedAt ||
        !this.calculatedBy
      )
    ) {
      this.invalidate(
        'calculatedAt',
        'Calculated payroll requires a backend timestamp and actor.'
      );
    }

    if (
      [
        'SUBMITTED',
        'APPROVED',
        'PAID',
      ].includes(this.status) &&
      (
        !this.submittedAt ||
        !this.submittedBy
      )
    ) {
      this.invalidate(
        'submittedAt',
        'Submitted payroll requires a backend timestamp and actor.'
      );
    }

    if (
      ['APPROVED', 'PAID'].includes(
        this.status
      ) &&
      (
        !this.approvedAt ||
        !this.approvedBy
      )
    ) {
      this.invalidate(
        'approvedAt',
        'Approved payroll requires a backend timestamp and actor.'
      );
    }

    if (
      this.status === 'PAID' &&
      (
        !this.paidAt ||
        !this.paidBy
      )
    ) {
      this.invalidate(
        'paidAt',
        'Paid payroll requires a backend timestamp and actor.'
      );
    }

    if (
      this.status === 'VOIDED' &&
      (
        !this.voidedAt ||
        !this.voidedBy ||
        !this.voidReason
      )
    ) {
      this.invalidate(
        'voidReason',
        'Voided payroll requires a backend timestamp, actor and reason.'
      );
    }
  }
);

payrollRunSchema.methods.isLocked =
  function isLocked() {
    return [
      'APPROVED',
      'PAID',
      'VOIDED',
    ].includes(this.status);
  };

const PayrollRun =
  mongoose.models.PayrollRun ||
  mongoose.model(
    'PayrollRun',
    payrollRunSchema
  );

module.exports = {
  PayrollRun,
  PAYROLL_RUN_STATUSES,
};
