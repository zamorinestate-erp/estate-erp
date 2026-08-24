'use strict';

const mongoose = require('mongoose');

const mailTemplateSchema = new mongoose.Schema(
  {
    organisationId: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
      index: true,
    },
    templateId: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
      index: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    version: {
      type: Number,
      default: 1,
      min: 1,
    },
    category: {
      type: String,
      enum: [
        'PURCHASE_ORDER',
        'RFQ',
        'VENDOR_CLARIFICATION',
        'EXPENSE_APPROVAL',
        'PAYMENT_ADVICE',
        'DEPARTMENT_STATEMENT',
        'EMPLOYEE_COMMUNICATION',
        'INVENTORY_ALERT',
        'COMPLIANCE_ALERT',
        'REPORT_DISTRIBUTION',
        'GENERAL_OPERATIONAL',
      ],
      default: 'GENERAL_OPERATIONAL',
      index: true,
    },
    subjectTemplate: {
      type: String,
      required: true,
      trim: true,
    },
    bodyTemplateHtml: {
      type: String,
      required: true,
    },
    bodyTemplatePlain: {
      type: String,
      default: '',
    },
    requiredVariables: [
      {
        type: String,
        trim: true,
      },
    ],
    isSensitive: {
      type: Boolean,
      default: false,
    },
    status: {
      type: String,
      enum: ['ACTIVE', 'DRAFT', 'ARCHIVED'],
      default: 'ACTIVE',
      index: true,
    },
    createdByUserId: {
      type: String,
      required: true,
      trim: true,
    },
  },
  {
    timestamps: true,
  }
);

mailTemplateSchema.index({ organisationId: 1, templateId: 1 }, { unique: true });

const MailTemplate =
  mongoose.models.MailTemplate || mongoose.model('MailTemplate', mailTemplateSchema);

module.exports = {
  MailTemplate,
};
