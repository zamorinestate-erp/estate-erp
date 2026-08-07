'use strict';

/**
 * PERSONAL LEDGER — MONGOOSE MODEL
 *
 * ABSOLUTE RESTRICTION: MASTER ONLY
 * Backend enforces this via ABSOLUTE_ROLE_RESTRICTIONS.PERSONAL_LEDGER in
 * backend/src/middleware/authorize.js. All routes using this model must
 * include absoluteRestriction: 'PERSONAL_LEDGER'.
 *
 * Undiscoverability contract:
 *   - API routes return 404 (not 403) to non-Master roles so existence
 *     is not confirmed.
 *   - No Personal Ledger data must appear in notifications, reports,
 *     global search results, or export outputs visible to other roles.
 *
 * Immutability:
 *   - Ledger entries are NEVER deleted. Errors are corrected by posting
 *     a reversing entry that references the original entry ID.
 *   - The originalEntryId field links a correction to the entry it corrects.
 *   - The correctedByEntryId field on the original links forward to the
 *     correction — this is the only mutable field on a finalised entry.
 *
 * Currency: INR only. All amounts stored as paisa (integer, positive).
 * Direction is encoded by entryType (DEBIT = outflow, CREDIT = inflow).
 */

const mongoose = require('mongoose');

const ENTRY_TYPES = [
  'CREDIT',  // Inflow — money coming in to the personal account
  'DEBIT',   // Outflow — money going out of the personal account
];

const ENTRY_STATUSES = [
  'ACTIVE',     // Normal, counted-in balance
  'REVERSED',   // Replaced by a correcting entry — excluded from balance
];

const ENTRY_CATEGORIES = [
  'PERSONAL_TRANSFER',
  'BUSINESS_REIMBURSEMENT',
  'PERSONAL_SPEND',
  'SAVINGS',
  'INVESTMENT',
  'LOAN_GIVEN',
  'LOAN_RECEIVED',
  'LOAN_REPAYMENT',
  'DIVIDEND',
  'WITHDRAWAL',
  'DEPOSIT',
  'OTHER',
];

const personalLedgerSchema = new mongoose.Schema(
  {
    // ── Business identifier ──────────────────────────────────────────────────
    ledgerEntryId: {
      type: String,
      required: true,
      unique: true,
      immutable: true,
      trim: true,
      uppercase: true,
      match: /^PL-\d{8}-\d{4,}$/,
      index: true,
    },

    // ── Scope ────────────────────────────────────────────────────────────────
    // ownerUserId is the MASTER user who owns this entry.
    // It is derived exclusively from request.auth.userId — never from the
    // request body.
    ownerUserId: {
      type: String,
      required: true,
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
    },

    // ── Entry core ───────────────────────────────────────────────────────────
    entryType: {
      type: String,
      required: true,
      immutable: true,
      enum: ENTRY_TYPES,
    },

    // Amount in paisa (INR × 100). Always a positive integer.
    // The entryType determines direction.
    amountPaisa: {
      type: Number,
      required: true,
      immutable: true,
      min: 1,
      validate: {
        validator: Number.isInteger,
        message: 'amountPaisa must be an integer (INR stored as paisa).',
      },
    },

    category: {
      type: String,
      required: true,
      immutable: true,
      enum: ENTRY_CATEGORIES,
    },

    // Business date of the entry in YYYY-MM-DD (IST).
    businessDate: {
      type: String,
      required: true,
      immutable: true,
      trim: true,
      match: /^\d{4}-\d{2}-\d{2}$/,
      index: true,
    },

    // Server-authoritative timestamp of record creation.
    serverTimestamp: {
      type: Date,
      required: true,
      immutable: true,
      default: Date.now,
      index: true,
    },

    // ── Descriptive fields ───────────────────────────────────────────────────
    description: {
      type: String,
      required: true,
      immutable: true,
      trim: true,
      minlength: 1,
      maxlength: 1000,
    },

    notes: {
      type: String,
      immutable: true,
      trim: true,
      maxlength: 3000,
      default: '',
    },

    // Counterparty or payee — optional free text.
    counterparty: {
      type: String,
      immutable: true,
      trim: true,
      maxlength: 200,
      default: '',
    },

    // Reference to an external document, bank transfer ID, etc.
    externalReference: {
      type: String,
      immutable: true,
      trim: true,
      maxlength: 200,
      default: '',
    },

    // ── Reversal / correction linkage ────────────────────────────────────────
    status: {
      type: String,
      required: true,
      enum: ENTRY_STATUSES,
      default: 'ACTIVE',
    },

    // On a REVERSAL entry: points to the original entry being reversed.
    originalEntryId: {
      type: String,
      immutable: true,
      trim: true,
      uppercase: true,
      default: null,
    },

    reversalReason: {
      type: String,
      immutable: true,
      trim: true,
      maxlength: 2000,
      default: '',
    },

    // On the original entry: populated when a correcting entry is posted.
    // This is the only mutable field after initial creation.
    correctedByEntryId: {
      type: String,
      trim: true,
      uppercase: true,
      default: null,
    },

    correctedAt: {
      type: Date,
      default: null,
    },

    // ── Attachment ───────────────────────────────────────────────────────────
    // References a PrivateFile record (Batch 18). Stored as the file ID.
    attachmentFileId: {
      type: String,
      trim: true,
      uppercase: true,
      default: null,
    },

    // ── Actor ────────────────────────────────────────────────────────────────
    // Always == ownerUserId because only the owning Master may create entries.
    // Stored redundantly for audit clarity.
    createdByUserId: {
      type: String,
      required: true,
      immutable: true,
      trim: true,
      uppercase: true,
    },

    correlationId: {
      type: String,
      immutable: true,
      trim: true,
      maxlength: 150,
      default: null,
    },
  },
  {
    timestamps: true,
    versionKey: 'version',
    optimisticConcurrency: true,
    collection: 'personal_ledger_entries',
  }
);

// ── Compound indexes ─────────────────────────────────────────────────────────

personalLedgerSchema.index(
  {
    ownerUserId: 1,
    organisationId: 1,
    businessDate: -1,
  },
  { name: 'owner_org_date_desc' }
);

personalLedgerSchema.index(
  {
    ownerUserId: 1,
    organisationId: 1,
    status: 1,
    businessDate: -1,
  },
  { name: 'owner_org_status_date' }
);

personalLedgerSchema.index(
  {
    ownerUserId: 1,
    organisationId: 1,
    category: 1,
    businessDate: -1,
  },
  { name: 'owner_org_category_date' }
);

// ── Normalise fields ─────────────────────────────────────────────────────────

personalLedgerSchema.pre('validate', function normalisePersonalLedgerFields() {
  const stringFields = [
    'ledgerEntryId',
    'ownerUserId',
    'organisationId',
    'originalEntryId',
    'correctedByEntryId',
    'createdByUserId',
    'correlationId',
    'attachmentFileId',
  ];

  for (const field of stringFields) {
    if (this[field] && typeof this[field] === 'string') {
      this[field] = this[field].trim().toUpperCase();
    }
  }

  if (this.entryType) {
    this.entryType = this.entryType.trim().toUpperCase();
  }
  if (this.category) {
    this.category = this.category.trim().toUpperCase();
  }
  if (this.status) {
    this.status = this.status.trim().toUpperCase();
  }
});

// ── Guard against direct deletion ────────────────────────────────────────────
// Entries are never deleted; they are reversed by posting a correcting entry.

const BLOCKED_OPERATIONS = [
  'deleteOne',
  'deleteMany',
  'findOneAndDelete',
];

BLOCKED_OPERATIONS.forEach((op) => {
  personalLedgerSchema.pre(op, function blockPersonalLedgerDeletion() {
    throw new Error(
      'Personal Ledger entries are immutable and cannot be deleted. ' +
      'Post a reversing entry instead.'
    );
  });
});

// ── Virtual: amount in INR (for display) ─────────────────────────────────────

personalLedgerSchema.virtual('amountInr').get(function getAmountInr() {
  return this.amountPaisa / 100;
});

// ── Static: calculate running balance ────────────────────────────────────────
// Returns ACTIVE entries only. REVERSED entries are excluded from balance.

personalLedgerSchema.statics.calculateBalance =
  async function calculateBalance({ ownerUserId, organisationId }) {
    const result = await this.aggregate([
      {
        $match: {
          ownerUserId: ownerUserId.trim().toUpperCase(),
          organisationId: organisationId.trim().toUpperCase(),
          status: 'ACTIVE',
        },
      },
      {
        $group: {
          _id: '$entryType',
          totalPaisa: { $sum: '$amountPaisa' },
        },
      },
    ]);

    let creditPaisa = 0;
    let debitPaisa = 0;

    for (const row of result) {
      if (row._id === 'CREDIT') creditPaisa = row.totalPaisa;
      if (row._id === 'DEBIT') debitPaisa = row.totalPaisa;
    }

    return {
      creditPaisa,
      debitPaisa,
      balancePaisa: creditPaisa - debitPaisa,
    };
  };

const PersonalLedger =
  mongoose.models.PersonalLedger ||
  mongoose.model('PersonalLedger', personalLedgerSchema);

module.exports = {
  PersonalLedger,
  ENTRY_TYPES,
  ENTRY_STATUSES,
  ENTRY_CATEGORIES,
};
