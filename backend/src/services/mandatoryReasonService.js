'use strict';

const { ApiError } = require('../utils/ApiError');
const { recordRequestAudit } = require('./auditService');

/**
 * MANDATORY ACTIONS REGISTRY
 * Critical operations that cannot be performed without an explicit,
 * auditable business justification (reason).
 */
const MANDATORY_REASON_ACTIONS = new Set([
  'CANCEL_INVOICE',
  'VOID_BILL',
  'REPRINT_RECEIPT',
  'DELETE_ATTACHMENT',
  'ARCHIVE_ATTACHMENT',
  'REPLACE_DOCUMENT_VERSION',
  'INVENTORY_ADJUSTMENT',
  'VARIANCE_OVERRIDE',
  'MODIFY_APPROVED_PURCHASE',
  'RESTORE_TRASH_ENTRY',
  'PRIVILEGED_OVERRIDE',
  'DISPOSITION_PURGE',
  'SECURITY_OVERRIDE',
]);

const MIN_REASON_LENGTH = 5;

/**
 * Asserts that a mandatory justification reason is provided.
 * Rejects with 400 MANDATORY_REASON_REQUIRED if missing or too short.
 */
function assertMandatoryReason(reason, action, minLength = MIN_REASON_LENGTH) {
  const normAction = String(action || '').trim().toUpperCase();
  const normReason = typeof reason === 'string' ? reason.trim() : '';

  if (!normReason || normReason.length < minLength) {
    throw new ApiError(
      400,
      'MANDATORY_REASON_REQUIRED',
      `A valid business justification (minimum ${minLength} characters) is mandatory for action "${normAction}".`
    );
  }

  return normReason;
}

/**
 * Express middleware to enforce mandatory reason on sensitive endpoints.
 */
function requireMandatoryReason(actionName, minLength = MIN_REASON_LENGTH) {
  return (req, res, next) => {
    const reason = req.body?.reason || req.query?.reason;
    try {
      const validReason = assertMandatoryReason(reason, actionName, minLength);
      req.validatedReason = validReason;
      next();
    } catch (err) {
      next(err);
    }
  };
}

class MandatoryReasonService {
  static assertMandatoryReason(reason, action, minLength = MIN_REASON_LENGTH) {
    return assertMandatoryReason(reason, action, minLength);
  }

  static requireMandatoryReason(actionName, minLength = MIN_REASON_LENGTH) {
    return requireMandatoryReason(actionName, minLength);
  }
}

module.exports = {
  MANDATORY_REASON_ACTIONS,
  MIN_REASON_LENGTH,
  assertMandatoryReason,
  requireMandatoryReason,
  MandatoryReasonService,
};

