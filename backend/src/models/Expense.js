'use strict';

const mongoose = require('mongoose');

const EXPENSE_STATUSES = [
  'DRAFT',
  'SUBMITTED',
  'RETURNED',
  'APPROVED',
  'REJECTED',
  'PAID',
  'REVERSED',
];

const PAYMENT_METHODS = [
  'CASH',
  'CARD',
  'UPI',
  'BANK_TRANSFER',
  'WALLET',
  'CREDIT',
];

const expenseSchema = new mongoose.Schema(
  {
    expenseId: {
      type: String,
      required: true,
      unique: true,
      immutable: true,
      trim: true,
      uppercase: true,
      match: /^EX-\d{8}-\d{4,}$/,
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

    businessDate: {
      type: String,
      required: true,
      immutable: true,
      match: /^\d{4}-\d{2}-\d{2}$/,
      index: true,
    },

    category: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
      maxlength: 120,
      index: true,
    },

    description: {
      type: String,
      required: true,
      trim: true,
      maxlength: 1000,
    },

    amount: {
      type: Number,
      required: true,
      min: 0.01,
    },

    currency: {
      type: String,
      immutable: true,
      enum: ['INR'],
      default: 'INR',
    },

    paymentMethod: {
      type: String,
      enum: PAYMENT_METHODS,
      default: 'CASH',
    },

    vendorName: {
      type: String,
      trim: true,
      maxlength: 200,
      default: '',
    },

    invoiceNumber: {
      type: String,
      trim: true,
      uppercase: true,
      maxlength: 150,
      default: '',
    },

    receiptUrl: {
      type: String,
      trim: true,
      maxlength: 1000,
      default: '',
    },

    notes: {
      type: String,
      trim: true,
      maxlength: 2000,
      default: '',
    },

    status: {
      type: String,
      required: true,
      enum: EXPENSE_STATUSES,
      default: 'DRAFT',
      index: true,
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

    decisionAt: {
      type: Date,
      default: null,
    },

    decisionBy: {
      type: String,
      trim: true,
      uppercase: true,
      default: null,
    },

    decisionReason: {
      type: String,
      trim: true,
      maxlength: 2000,
      default: '',
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

    reversedAt: {
      type: Date,
      default: null,
    },

    reversedBy: {
      type: String,
      trim: true,
      uppercase: true,
      default: null,
    },

    reversalReason: {
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
    collection: 'expenses',
  }
);

expenseSchema.index(
  {
    organisationId: 1,
    cafeId: 1,
    businessDate: 1,
    status: 1,
  },
  {
    name: 'expense_cafe_date_status',
  }
);

expenseSchema.index(
  {
    organisationId: 1,
    status: 1,
    submittedAt: -1,
  },
  {
    name: 'expense_status_submitted',
  }
);

expenseSchema.index(
  {
    organisationId: 1,
    category: 1,
    businessDate: -1,
  },
  {
    name: 'expense_category_date',
  }
);

expenseSchema.pre(
  'validate',
  function normalizeExpenseFields() {
    const identifierFields = [
      'expenseId',
      'organisationId',
      'cafeId',
      'category',
      'invoiceNumber',
      'submittedBy',
      'decisionBy',
      'paidBy',
      'paymentReference',
      'reversedBy',
      'createdBy',
      'updatedBy',
    ];

    identifierFields.forEach((field) => {
      if (this[field]) {
        this[field] = this[field]
          .trim()
          .toUpperCase();
      }
    });

    if (
      this.status === 'PAID' &&
      !this.paidAt
    ) {
      this.invalidate(
        'paidAt',
        'A paid expense requires a payment timestamp.'
      );
    }

    if (
      this.status === 'REVERSED' &&
      !this.reversalReason
    ) {
      this.invalidate(
        'reversalReason',
        'A reversed expense requires a reversal reason.'
      );
    }
  }
);

expenseSchema.methods.submit =
  async function submit(userId) {
    if (
      !['DRAFT', 'RETURNED'].includes(
        this.status
      )
    ) {
      throw new Error(
        'Only draft or returned expenses may be submitted.'
      );
    }

    this.status = 'SUBMITTED';
    this.submittedAt = new Date();
    this.submittedBy = userId
      .trim()
      .toUpperCase();
    this.updatedBy = this.submittedBy;

    return this.save();
  };

expenseSchema.methods.recordDecision =
  async function recordDecision({
    userId,
    decision,
    reason = '',
  }) {
    if (this.status !== 'SUBMITTED') {
      throw new Error(
        'Only submitted expenses may receive a decision.'
      );
    }

    if (
      ![
        'APPROVED',
        'REJECTED',
        'RETURNED',
      ].includes(decision)
    ) {
      throw new Error(
        'The expense decision is invalid.'
      );
    }

    this.status = decision;
    this.decisionAt = new Date();
    this.decisionBy = userId
      .trim()
      .toUpperCase();
    this.decisionReason = reason.trim();
    this.updatedBy = this.decisionBy;

    return this.save();
  };

const Expense =
  mongoose.models.Expense ||
  mongoose.model(
    'Expense',
    expenseSchema
  );

module.exports = {
  Expense,
  EXPENSE_STATUSES,
  PAYMENT_METHODS,
};