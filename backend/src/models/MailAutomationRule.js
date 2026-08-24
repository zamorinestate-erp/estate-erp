'use strict';

const mongoose = require('mongoose');

const mailAutomationRuleSchema = new mongoose.Schema(
  {
    organisationId: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
      index: true,
    },
    ruleId: {
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
    triggerType: {
      type: String,
      enum: ['INBOUND_RECEIVED', 'OUTBOUND_APPROVED', 'SECURITY_FLAGGED', 'PO_ISSUED'],
      required: true,
      index: true,
    },
    conditions: {
      senderPattern: { type: String, default: '' },
      subjectPattern: { type: String, default: '' },
      module: { type: String, default: null },
      category: { type: String, default: null },
    },
    actions: {
      assignToRole: { type: String, default: null },
      routeToModule: { type: String, default: null },
      applyLabel: { type: String, default: null },
      autoLinkEntityType: { type: String, default: null },
      createCase: { type: Boolean, default: false },
      quarantine: { type: Boolean, default: false },
    },
    dryRunMatchesCount: {
      type: Number,
      default: 0,
    },
    status: {
      type: String,
      enum: ['ACTIVE', 'DRAFT', 'PAUSED', 'RETIRED'],
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

mailAutomationRuleSchema.index({ organisationId: 1, ruleId: 1 }, { unique: true });

const MailAutomationRule =
  mongoose.models.MailAutomationRule || mongoose.model('MailAutomationRule', mailAutomationRuleSchema);

module.exports = {
  MailAutomationRule,
};
