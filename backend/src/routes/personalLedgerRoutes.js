'use strict';

/**
 * PERSONAL LEDGER ROUTES
 *
 * ABSOLUTE RESTRICTION: MASTER ONLY
 * Every route uses absoluteRestriction: 'PERSONAL_LEDGER'.
 * The backend will reject any request whose authenticated role is not MASTER.
 *
 * Undiscoverability:
 * The controller returns 404 (not 403) for any entry not owned by the
 * authenticated caller, so a non-Master impersonator cannot confirm that
 * Personal Ledger exists.
 *
 * Mounted at: /api/v1/personal-ledger (registered in routes/index.js)
 */

const express = require('express');

const {
  authenticate,
} = require('../middleware/authenticate');

const {
  authorize,
  requireReason,
} = require('../middleware/authorize');

const {
  listEntries,
  getEntry,
  createEntry,
  reverseEntry,
  getBalance,
} = require('../controllers/personalLedgerController');

const router = express.Router();

// All routes require an authenticated session.
router.use(authenticate);

// ── GET /personal-ledger/balance ─────────────────────────────────────────────
// Returns balance summary (credits, debits, net). Placed before /:id to avoid
// "balance" being misinterpreted as a ledgerEntryId.
router.get(
  '/balance',
  authorize('PERSONAL_LEDGER_READ', {
    absoluteRestriction: 'PERSONAL_LEDGER',
    allowedRoles: ['MASTER'],
  }),
  getBalance
);

// ── GET /personal-ledger ─────────────────────────────────────────────────────
// List own entries. Supports ?page, ?limit, ?from, ?to, ?category,
// ?entryType, ?status query parameters.
router.get(
  '/',
  authorize('PERSONAL_LEDGER_READ', {
    absoluteRestriction: 'PERSONAL_LEDGER',
    allowedRoles: ['MASTER'],
  }),
  listEntries
);

// ── GET /personal-ledger/:ledgerEntryId ──────────────────────────────────────
// Fetch a single entry by its business ID.
router.get(
  '/:ledgerEntryId',
  authorize('PERSONAL_LEDGER_READ', {
    absoluteRestriction: 'PERSONAL_LEDGER',
    allowedRoles: ['MASTER'],
  }),
  getEntry
);

// ── POST /personal-ledger ────────────────────────────────────────────────────
// Create a new Personal Ledger entry.
router.post(
  '/',
  authorize('PERSONAL_LEDGER_WRITE', {
    absoluteRestriction: 'PERSONAL_LEDGER',
    allowedRoles: ['MASTER'],
  }),
  createEntry
);

// ── POST /personal-ledger/:ledgerEntryId/reverse ─────────────────────────────
// Post a reversing entry. Body must include { reason }.
router.post(
  '/:ledgerEntryId/reverse',
  authorize('PERSONAL_LEDGER_WRITE', {
    absoluteRestriction: 'PERSONAL_LEDGER',
    allowedRoles: ['MASTER'],
    requiresReason: true,
  }),
  requireReason,
  reverseEntry
);

module.exports = router;
