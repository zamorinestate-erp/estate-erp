'use strict';

const mongoose = require('mongoose');

const contractObligationSchema = new mongoose.Schema(
  {
    organisationId: {
      type: String,
      required: true,
      index: true,
    },
    contractId: {
      type: String,
      required: true,
      index: true,
    },
    obligationId: {
      type: String,
      required: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    responsibleParty: {
      type: String,
      enum: ['ZAMORIN', 'COUNTERPARTY', 'MUTUAL'],
      default: 'COUNTERPARTY',
    },
    dueDate: {
      type: Date,
      default: null,
    },
    recurrence: {
      type: String,
      enum: ['ONE_TIME', 'MONTHLY', 'QUARTERLY', 'ANNUAL', 'MILESTONE_BASED'],
      default: 'ONE_TIME',
    },
    status: {
      type: String,
      enum: ['PENDING', 'MET', 'POTENTIAL_EXCEPTION', 'WAIVED'],
      default: 'PENDING',
    },
    exceptionObservation: {
      type: String,
      default: null,
    },
    evidenceDocumentId: {
      type: String,
      default: null,
    },
    ownerId: {
      type: String,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

contractObligationSchema.index({ organisationId: 1, contractId: 1, obligationId: 1 }, { unique: true });
contractObligationSchema.index({ organisationId: 1, status: 1 });

const ContractObligation = mongoose.model('ContractObligation', contractObligationSchema);

module.exports = { ContractObligation };
