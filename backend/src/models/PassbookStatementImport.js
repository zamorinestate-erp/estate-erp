'use strict';

/**
 * PASSBOOK STATEMENT IMPORT — MONGOOSE MODEL
 * Represents manual statement imports (CSV/XLSX/PDF evidence), parsed transaction rows,
 * column mapping profiles, and match states.
 */

const mongoose = require('mongoose');

const statementRowSchema = new mongoose.Schema(
  {
    rowId: { type: String, required: true },
    rowNumber: { type: Number, required: true },
    date: { type: String, required: true },
    valueDate: { type: String, default: null },
    reference: { type: String, default: '' },
    narration: { type: String, required: true },
    debitPaisa: { type: Number, default: 0 },
    creditPaisa: { type: Number, default: 0 },
    balancePaisa: { type: Number, default: null },
    matchStatus: { type: String, enum: ['EXACT_MATCH', 'HIGH_CONFIDENCE', 'POSSIBLE_MATCH', 'NO_MATCH', 'MANUALLY_MATCHED'], default: 'NO_MATCH' },
    matchedTxnId: { type: String, default: null },
    matchConfidence: { type: Number, default: 0 },
  },
  { _id: false }
);

const passbookStatementImportSchema = new mongoose.Schema(
  {
    importSessionId: {
      type: String,
      required: true,
      unique: true,
      immutable: true,
      trim: true,
      uppercase: true,
      index: true,
    },

    organisationId: {
      type: String,
      required: true,
      immutable: true,
      trim: true,
      uppercase: true,
      index: true,
      default: 'ZAMORIN',
    },

    accountId: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
      index: true,
    },

    fileName: {
      type: String,
      required: true,
      trim: true,
    },

    fileSize: {
      type: Number,
      required: true,
    },

    fileHash: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },

    fileType: {
      type: String,
      enum: ['PDF', 'CSV', 'XLSX'],
      default: 'CSV',
    },

    profileId: {
      type: String,
      trim: true,
      default: 'STANDARD',
    },

    statementPeriodStart: {
      type: String,
      required: true,
    },

    statementPeriodEnd: {
      type: String,
      required: true,
    },

    openingBalancePaisa: {
      type: Number,
      required: true,
    },

    closingBalancePaisa: {
      type: Number,
      required: true,
    },

    rowCount: {
      type: Number,
      default: 0,
    },

    matchedRowCount: {
      type: Number,
      default: 0,
    },

    unmatchedRowCount: {
      type: Number,
      default: 0,
    },

    rows: {
      type: [statementRowSchema],
      default: [],
    },

    status: {
      type: String,
      enum: ['PARSED', 'COMMITTED', 'RECONCILED', 'CANCELLED'],
      default: 'COMMITTED',
      index: true,
    },

    importedBy: {
      type: String,
      required: true,
      trim: true,
    },
  },
  {
    timestamps: true,
    collection: 'passbook_statement_imports',
  }
);

passbookStatementImportSchema.index({ organisationId: 1, accountId: 1, statementPeriodStart: 1 });

const PassbookStatementImport =
  mongoose.models.PassbookStatementImport ||
  mongoose.model('PassbookStatementImport', passbookStatementImportSchema);

module.exports = {
  PassbookStatementImport,
};
