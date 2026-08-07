'use strict';

/**
 * PERSONAL LEDGER CONTROLLER
 *
 * ABSOLUTE RESTRICTION: MASTER ONLY
 * All routes in personalLedgerRoutes.js use:
 *   authorize('PERSONAL_LEDGER_*', { absoluteRestriction: 'PERSONAL_LEDGER' })
 *
 * Actor identity comes exclusively from request.auth — never from request.body.
 * The ownerUserId is always request.auth.userId.
 *
 * Undiscoverability:
 *   Unauthorised access returns 404 (not 403) so that the existence of
 *   Personal Ledger is not confirmed to non-Master callers.
 *   Routes are mounted at /personal-ledger; no other route or response
 *   must leak Personal Ledger data.
 *
 * Currency: INR. Amounts submitted in paise (integers). Displayed as INR.
 */

const {
  PersonalLedger,
  ENTRY_TYPES,
  ENTRY_CATEGORIES,
} = require('../models/PersonalLedger');

const {
  SequenceCounter,
} = require('../models/SequenceCounter');

const {
  asyncHandler,
} = require('../utils/asyncHandler');

const {
  ApiError,
} = require('../utils/ApiError');

const {
  recordRequestAudit,
} = require('../services/auditService');

// ── Helpers ──────────────────────────────────────────────────────────────────

function normalizeIdentifier(value) {
  return typeof value === 'string'
    ? value.trim().toUpperCase()
    : '';
}

function getIstBusinessDate(date = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

function parsePositiveInteger(value, fallback, maximum) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed < 1) return fallback;
  return Math.min(parsed, maximum);
}

/**
 * Build the owner-scoped query filter for list operations.
 * ownerUserId is always taken from request.auth — not from any request
 * parameter — so a Master cannot accidentally or maliciously query another
 * Master's ledger.
 */
function buildOwnerFilter(request) {
  const filter = {
    ownerUserId: request.auth.userId,
    organisationId: request.auth.organisationId,
  };

  // Optional: filter by date range (YYYY-MM-DD)
  const { from, to, category, entryType, status } = request.query;

  if (from && /^\d{4}-\d{2}-\d{2}$/.test(from)) {
    filter.businessDate = { ...filter.businessDate, $gte: from };
  }
  if (to && /^\d{4}-\d{2}-\d{2}$/.test(to)) {
    filter.businessDate = { ...filter.businessDate, $lte: to };
  }
  if (category && ENTRY_CATEGORIES.includes(category.toUpperCase())) {
    filter.category = category.toUpperCase();
  }
  if (entryType && ENTRY_TYPES.includes(entryType.toUpperCase())) {
    filter.entryType = entryType.toUpperCase();
  }
  if (status === 'ACTIVE' || status === 'REVERSED') {
    filter.status = status.toUpperCase();
  }

  return filter;
}

// ── Handlers ─────────────────────────────────────────────────────────────────

/**
 * GET /personal-ledger
 * List own Personal Ledger entries with pagination and filters.
 */
const listEntries = asyncHandler(async (request, response) => {
  const page = parsePositiveInteger(request.query.page, 1, 1000);
  const limit = parsePositiveInteger(request.query.limit, 25, 100);
  const skip = (page - 1) * limit;

  const filter = buildOwnerFilter(request);

  const [entries, total] = await Promise.all([
    PersonalLedger.find(filter)
      .select('-__v -version')
      .sort({ businessDate: -1, serverTimestamp: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    PersonalLedger.countDocuments(filter),
  ]);

  const balance = await PersonalLedger.calculateBalance({
    ownerUserId: request.auth.userId,
    organisationId: request.auth.organisationId,
  });

  return response.status(200).json({
    success: true,
    data: {
      entries,
      balance,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    },
    correlationId: request.correlationId || null,
  });
});

/**
 * GET /personal-ledger/:ledgerEntryId
 * Fetch a single entry. Returns 404 for any entry not owned by the caller.
 */
const getEntry = asyncHandler(async (request, response) => {
  const ledgerEntryId = normalizeIdentifier(
    request.params.ledgerEntryId
  );

  if (!ledgerEntryId) {
    throw new ApiError(400, 'INVALID_ID', 'A valid ledger entry ID is required.');
  }

  // Scope to owner — a Master cannot fetch another Master's entry.
  const entry = await PersonalLedger.findOne({
    ledgerEntryId,
    ownerUserId: request.auth.userId,
    organisationId: request.auth.organisationId,
  })
    .select('-__v -version')
    .lean();

  if (!entry) {
    // Return 404 — do not reveal that the entry exists or belongs to someone else.
    throw new ApiError(404, 'NOT_FOUND', 'Personal ledger entry not found.');
  }

  return response.status(200).json({
    success: true,
    data: { entry },
    correlationId: request.correlationId || null,
  });
});

/**
 * POST /personal-ledger
 * Create a new Personal Ledger entry.
 *
 * Body:
 *   entryType    CREDIT | DEBIT (required)
 *   amountPaisa  positive integer, INR × 100 (required)
 *   category     enum (required)
 *   businessDate YYYY-MM-DD; defaults to today IST (optional)
 *   description  string (required)
 *   notes        string (optional)
 *   counterparty string (optional)
 *   externalReference string (optional)
 */
const createEntry = asyncHandler(async (request, response) => {
  const {
    entryType,
    amountPaisa,
    category,
    businessDate,
    description,
    notes,
    counterparty,
    externalReference,
  } = request.body;

  // ── Validate ────────────────────────────────────────────────────────────

  const normalizedEntryType = normalizeIdentifier(entryType);
  if (!ENTRY_TYPES.includes(normalizedEntryType)) {
    throw new ApiError(
      400,
      'INVALID_ENTRY_TYPE',
      `entryType must be one of: ${ENTRY_TYPES.join(', ')}.`
    );
  }

  if (
    !Number.isInteger(amountPaisa) ||
    amountPaisa < 1
  ) {
    throw new ApiError(
      400,
      'INVALID_AMOUNT',
      'amountPaisa must be a positive integer (INR stored as paisa).'
    );
  }

  const normalizedCategory = normalizeIdentifier(category);
  if (!ENTRY_CATEGORIES.includes(normalizedCategory)) {
    throw new ApiError(
      400,
      'INVALID_CATEGORY',
      `category must be one of: ${ENTRY_CATEGORIES.join(', ')}.`
    );
  }

  const descriptionText =
    typeof description === 'string'
      ? description.trim()
      : '';
  if (!descriptionText) {
    throw new ApiError(400, 'DESCRIPTION_REQUIRED', 'description is required.');
  }
  if (descriptionText.length > 1000) {
    throw new ApiError(400, 'DESCRIPTION_TOO_LONG', 'description must not exceed 1000 characters.');
  }

  // Business date: use supplied date or today in IST.
  let resolvedBusinessDate = getIstBusinessDate();
  if (businessDate) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(businessDate)) {
      throw new ApiError(
        400,
        'INVALID_BUSINESS_DATE',
        'businessDate must be in YYYY-MM-DD format.'
      );
    }
    resolvedBusinessDate = businessDate;
  }

  // ── Generate ID ─────────────────────────────────────────────────────────

  const ledgerEntryId = await SequenceCounter.generateId({
    organisationId: request.auth.organisationId,
    sequenceKey: `PERSONAL_LEDGER_${request.auth.userId}`,
    prefix: 'PL',
    minimumDigits: 4,
  });

  // Reformat the generated ID to include today's date segment.
  // SequenceCounter generates PL-NNNN; we embed the date for readability.
  const datePart = resolvedBusinessDate.replace(/-/g, '');
  const seqNumber = ledgerEntryId.split('-')[1];
  const formattedId = `PL-${datePart}-${seqNumber}`;

  // ── Create entry ─────────────────────────────────────────────────────────

  const entry = new PersonalLedger({
    ledgerEntryId: formattedId,
    ownerUserId: request.auth.userId,       // Always from auth — never from body
    organisationId: request.auth.organisationId,
    entryType: normalizedEntryType,
    amountPaisa,
    category: normalizedCategory,
    businessDate: resolvedBusinessDate,
    serverTimestamp: new Date(),
    description: descriptionText,
    notes: typeof notes === 'string' ? notes.trim().slice(0, 3000) : '',
    counterparty: typeof counterparty === 'string' ? counterparty.trim().slice(0, 200) : '',
    externalReference: typeof externalReference === 'string' ? externalReference.trim().slice(0, 200) : '',
    status: 'ACTIVE',
    createdByUserId: request.auth.userId,
    correlationId: request.correlationId || null,
  });

  await entry.save();

  // ── Audit ────────────────────────────────────────────────────────────────

  await recordRequestAudit({
    request,
    module: 'PERSONAL_LEDGER',
    action: 'CREATE_ENTRY',
    entityType: 'PERSONAL_LEDGER_ENTRY',
    entityId: formattedId,
    after: {
      ledgerEntryId: formattedId,
      entryType: normalizedEntryType,
      amountPaisa,
      category: normalizedCategory,
      businessDate: resolvedBusinessDate,
    },
    reason: '',
    result: 'SUCCESS',
    riskClassification: 'LOW',
  });

  return response.status(201).json({
    success: true,
    data: { entry: entry.toObject() },
    correlationId: request.correlationId || null,
  });
});

/**
 * POST /personal-ledger/:ledgerEntryId/reverse
 * Post a reversing entry that cancels an existing ACTIVE entry.
 * The original entry is marked REVERSED; a new ACTIVE entry is created
 * with the opposite entryType and the same amount.
 *
 * Body:
 *   reason  string (required — minimum 10 characters)
 */
const reverseEntry = asyncHandler(async (request, response) => {
  const ledgerEntryId = normalizeIdentifier(
    request.params.ledgerEntryId
  );

  if (!ledgerEntryId) {
    throw new ApiError(400, 'INVALID_ID', 'A valid ledger entry ID is required.');
  }

  const { reason } = request.body;
  const reasonText =
    typeof reason === 'string' ? reason.trim() : '';
  if (reasonText.length < 10) {
    throw new ApiError(
      400,
      'REASON_REQUIRED',
      'A reason of at least 10 characters is required to reverse an entry.'
    );
  }
  if (reasonText.length > 2000) {
    throw new ApiError(400, 'REASON_TOO_LONG', 'reason must not exceed 2000 characters.');
  }

  // Fetch the original entry — scoped to owner.
  const original = await PersonalLedger.findOne({
    ledgerEntryId,
    ownerUserId: request.auth.userId,
    organisationId: request.auth.organisationId,
  });

  if (!original) {
    throw new ApiError(404, 'NOT_FOUND', 'Personal ledger entry not found.');
  }

  if (original.status !== 'ACTIVE') {
    throw new ApiError(
      409,
      'ALREADY_REVERSED',
      'This entry has already been reversed and cannot be reversed again.'
    );
  }

  // Generate ID for the reversing entry.
  const reversalDatePart = getIstBusinessDate().replace(/-/g, '');
  const reversalSeqId = await SequenceCounter.generateId({
    organisationId: request.auth.organisationId,
    sequenceKey: `PERSONAL_LEDGER_${request.auth.userId}`,
    prefix: 'PL',
    minimumDigits: 4,
  });
  const reversalSeqNumber = reversalSeqId.split('-')[1];
  const reversalEntryId = `PL-${reversalDatePart}-${reversalSeqNumber}`;

  // Post the reversing entry (opposite direction, same amount).
  const reversalEntry = new PersonalLedger({
    ledgerEntryId: reversalEntryId,
    ownerUserId: request.auth.userId,
    organisationId: request.auth.organisationId,
    entryType: original.entryType === 'CREDIT' ? 'DEBIT' : 'CREDIT',
    amountPaisa: original.amountPaisa,
    category: original.category,
    businessDate: getIstBusinessDate(),
    serverTimestamp: new Date(),
    description: `Reversal of ${ledgerEntryId}: ${original.description}`,
    notes: original.notes,
    counterparty: original.counterparty,
    externalReference: original.externalReference,
    status: 'ACTIVE',
    originalEntryId: ledgerEntryId,
    reversalReason: reasonText,
    createdByUserId: request.auth.userId,
    correlationId: request.correlationId || null,
  });

  await reversalEntry.save();

  // Mark the original as REVERSED and link to the correction.
  original.status = 'REVERSED';
  original.correctedByEntryId = reversalEntryId;
  original.correctedAt = new Date();
  await original.save();

  // Audit the reversal.
  await recordRequestAudit({
    request,
    module: 'PERSONAL_LEDGER',
    action: 'REVERSE_ENTRY',
    entityType: 'PERSONAL_LEDGER_ENTRY',
    entityId: ledgerEntryId,
    before: { status: 'ACTIVE', correctedByEntryId: null },
    after: {
      status: 'REVERSED',
      correctedByEntryId: reversalEntryId,
      reversalEntryId,
    },
    reason: reasonText,
    result: 'SUCCESS',
    riskClassification: 'MEDIUM',
  });

  return response.status(200).json({
    success: true,
    data: {
      reversedEntry: original.toObject(),
      reversalEntry: reversalEntry.toObject(),
    },
    correlationId: request.correlationId || null,
  });
});

/**
 * GET /personal-ledger/balance
 * Return current balance summary (credits, debits, net balance).
 */
const getBalance = asyncHandler(async (request, response) => {
  const balance = await PersonalLedger.calculateBalance({
    ownerUserId: request.auth.userId,
    organisationId: request.auth.organisationId,
  });

  return response.status(200).json({
    success: true,
    data: { balance },
    correlationId: request.correlationId || null,
  });
});

module.exports = {
  listEntries,
  getEntry,
  createEntry,
  reverseEntry,
  getBalance,
};
