'use strict';

/**
 * WORKFLOW DEFINITION — MONGOOSE MODEL (Capability 24 — Workflow Designer)
 *
 * Configurable multi-step approval and notification workflow templates.
 */

const mongoose = require('mongoose');

const WORKFLOW_TRIGGERS = [
  'PURCHASE_ORDER_CREATE',
  'EXPENSE_CLAIM_CREATE',
  'OVERTIME_REQUEST',
  'PRICE_CHANGE',
  'ASSET_DISPOSAL',
];

const workflowDefinitionSchema = new mongoose.Schema(
  {
    workflowId: {
      type: String,
      required: true,
      unique: true,
      immutable: true,
      trim: true,
      uppercase: true,
      match: /^WF-\d{4,}$/,
      index: true,
    },

    organisationId: {
      type: String,
      required: true,
      immutable: true,
      trim: true,
      uppercase: true,
      index: true,
    },

    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200,
    },

    triggerEvent: {
      type: String,
      required: true,
      enum: WORKFLOW_TRIGGERS,
      index: true,
    },

    steps: [
      {
        stepNumber: { type: Number, required: true },
        approverRole: { type: String, required: true, enum: ['MASTER', 'OWNER', 'CAFE_ADMIN'] },
        minAmountMinorUnits: { type: Number, default: 0 },
        timeoutHours: { type: Number, default: 48 },
      },
    ],

    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },

    createdByUserId: {
      type: String,
      required: true,
      immutable: true,
      trim: true,
      uppercase: true,
    },
  },
  {
    timestamps: true,
    versionKey: 'version',
    collection: 'workflow_definitions',
  }
);

workflowDefinitionSchema.pre('validate', function normaliseWorkflow() {
  const upperFields = ['workflowId', 'organisationId', 'triggerEvent', 'createdByUserId'];
  for (const f of upperFields) {
    if (this[f] && typeof this[f] === 'string') this[f] = this[f].trim().toUpperCase();
  }
});

const WorkflowDefinition =
  mongoose.models.WorkflowDefinition ||
  mongoose.model('WorkflowDefinition', workflowDefinitionSchema);

module.exports = {
  WorkflowDefinition,
  WORKFLOW_TRIGGERS,
};
