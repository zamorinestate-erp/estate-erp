'use strict';

const mongoose = require('mongoose');

const approvalPolicyAuditSchema = new mongoose.Schema(
  {
    modifiedBy: {
      type: String,
      required: true,
      trim: true,
    },
    modifiedAt: {
      type: Date,
      default: Date.now,
    },
    previousMaxAmountPaisa: {
      type: Number,
      default: null,
    },
    newMaxAmountPaisa: {
      type: Number,
      default: null,
    },
    reason: {
      type: String,
      trim: true,
      default: '',
    },
  },
  { _id: false }
);

const approvalPolicySchema = new mongoose.Schema(
  {
    policyId: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      uppercase: true,
      index: true,
    },
    organisationId: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
      index: true,
    },
    cafeId: {
      type: String,
      trim: true,
      uppercase: true,
      default: null,
      index: true,
    },
    workflowType: {
      type: String,
      required: true,
      trim: true,
      uppercase: true, // e.g. 'PURCHASE_ORDER', 'EXPENSE_VOUCHER', 'GENERAL'
      default: 'GENERAL',
      index: true,
    },
    role: {
      type: String,
      required: true,
      trim: true,
      uppercase: true, // 'CAFE_ADMIN', 'OWNER', 'MASTER'
      index: true,
    },
    minAmountPaisa: {
      type: Number,
      default: 0,
      min: 0,
    },
    maxAmountPaisa: {
      type: Number,
      default: null, // null = unlimited (e.g. MASTER)
    },
    approvalLevel: {
      type: Number,
      default: 1,
    },
    effectiveFrom: {
      type: Date,
      default: Date.now,
      index: true,
    },
    effectiveTo: {
      type: Date,
      default: null,
      index: true,
    },
    createdBy: {
      type: String,
      required: true,
      trim: true,
    },
    updatedBy: {
      type: String,
      trim: true,
      default: null,
    },
    auditHistory: {
      type: [approvalPolicyAuditSchema],
      default: [],
    },
  },
  {
    timestamps: true,
  }
);

approvalPolicySchema.index(
  { organisationId: 1, cafeId: 1, workflowType: 1, role: 1, effectiveFrom: -1 }
);

const ApprovalPolicy = mongoose.models.ApprovalPolicy || mongoose.model('ApprovalPolicy', approvalPolicySchema);

module.exports = {
  ApprovalPolicy,
};
