'use strict';

const mongoose = require('mongoose');

const LOAN_ADVANCE_TYPES = ['LOAN', 'SALARY_ADVANCE'];
const LOAN_ADVANCE_STATUSES = ['REQUESTED', 'APPROVED', 'REJECTED'];

function createPaiseField({ required = false, positive = false } = {}) {
  return {
    type: Number,
    required,
    min: 0,
    validate: {
      validator(value) {
        return Number.isSafeInteger(value) && (!positive || value > 0);
      },
      message: 'Money values must be safe integer amounts in paise.',
    },
  };
}

const staffLoanAdvanceSchema = new mongoose.Schema(
  {
    loanAdvanceId: {
      type: String,
      required: true,
      unique: true,
      immutable: true,
      trim: true,
      uppercase: true,
      match: /^LN-[0-9]{4,}$/,
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
    employeeUserId: {
      type: String,
      required: true,
      immutable: true,
      trim: true,
      uppercase: true,
      match: /^(MU|OW|AD|ST)-[0-9]{4,}$/,
      index: true,
    },
    requestType: {
      type: String,
      required: true,
      immutable: true,
      trim: true,
      uppercase: true,
      enum: LOAN_ADVANCE_TYPES,
    },
    requestedAmountPaise:
      createPaiseField({
        required: true,
        positive: true,
      }),
    requestReason: {
      type: String,
      trim: true,
      maxlength: 2000,
      default: '',
    },
    status: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
      enum: LOAN_ADVANCE_STATUSES,
      default: 'REQUESTED',
      index: true,
    },
    requestedAt: {
      type: Date,
      required: true,
      immutable: true,
      default: Date.now,
    },
    createdByUserId: {
      type: String,
      required: true,
      immutable: true,
      trim: true,
      uppercase: true,
    },
    updatedByUserId: {
      type: String,
      trim: true,
      uppercase: true,
      default: '',
    },
    decidedByUserId: {
      type: String,
      trim: true,
      uppercase: true,
      default: '',
    },
    decidedAt: {
      type: Date,
      default: null,
    },
    decisionReason: {
      type: String,
      trim: true,
      maxlength: 2000,
      default: '',
    },
    currency: {
      type: String,
      immutable: true,
      enum: ['INR'],
      default: 'INR',
    },
  },
  {
    timestamps: true,
    optimisticConcurrency: true,
    versionKey: 'version',
    collection: 'staff_loan_advances',
  }
);

staffLoanAdvanceSchema.index(
  {
    organisationId: 1,
    employeeUserId: 1,
    status: 1,
    createdAt: -1,
  },
  {
    name: 'loan_advance_employee_status',
  }
);

staffLoanAdvanceSchema.index(
  {
    organisationId: 1,
    cafeId: 1,
    status: 1,
    createdAt: -1,
  },
  {
    name: 'loan_advance_cafe_status',
  }
);

const StaffLoanAdvance =
  mongoose.models.StaffLoanAdvance ||
  mongoose.model(
    'StaffLoanAdvance',
    staffLoanAdvanceSchema
  );

module.exports = {
  StaffLoanAdvance,
  LOAN_ADVANCE_TYPES,
  LOAN_ADVANCE_STATUSES,
};
