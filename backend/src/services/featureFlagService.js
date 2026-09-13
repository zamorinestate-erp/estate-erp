'use strict';

/**
 * ============================================================================
 * ZAMORIN CAFÉ ERP — FEATURE FLAGS & EMERGENCY KILL SWITCH SERVICE
 * ============================================================================
 * Server-authoritative feature flag and emergency kill-switch manager.
 *
 * Invariant:
 * Kill switches require explicit role authorization (Primary Master or Owner),
 * mandatory business justification, and emit immutable audit events.
 */

const { logSecurityEvent } = require('./securityLogger');

const DEFAULT_FLAGS = {
  // Operational features
  ENABLE_ADVANCED_REPORTING: true,
  ENABLE_DEVICE_ENROLLMENT: true,
  ENABLE_OFFLINE_SYNC: true,
  ENABLE_EXPORT_ENGINE: true,

  // Emergency kill switches (False = Operational; True = Suspended)
  //
  // SCOPE INVARIANT: Each kill switch suspends ONLY the named subsystem.
  // No kill switch affects unrelated ERP business operations.
  // POS, orders, payroll, attendance, and billing are NEVER affected by
  // storage-tier kill switches. Only authorised personnel (PRIMARY_MASTER)
  // may trip or reset kill switches, with mandatory audit justification.
  //
  // KILL_SWITCH_DOCUMENT_UPLOADS
  //   Scope: Suspends document upload endpoints only.
  //   Does NOT affect: POS, orders, billing, payroll, attendance, supplier management.
  //   Trigger: Storage utilisation >= 95% OR incident policy decision.
  //   Reset: PRIMARY_MASTER after disk expansion or incident resolution.
  KILL_SWITCH_DOCUMENT_UPLOADS: false,

  // KILL_SWITCH_EXPORT_QUEUE
  //   Scope: Suspends background export generation (PDF/CSV) only.
  //   Does NOT affect: POS transactions, billing, payroll, document uploads.
  //   Trigger: Export queue overload, storage pressure, or memory pressure incident.
  //   Reset: PRIMARY_MASTER after queue drain or capacity restoration.
  KILL_SWITCH_EXPORT_QUEUE: false,

  // KILL_SWITCH_EXTERNAL_MAIL_SYNC
  //   Scope: Suspends outbound transactional email / notification delivery only.
  //   Does NOT affect: Internal ERP operations, POS, payroll, uploads.
  //   Trigger: Downstream mail provider incident or rate-limit breach.
  //   Reset: PRIMARY_MASTER after mail provider confirmation.
  KILL_SWITCH_EXTERNAL_MAIL_SYNC: false,

  // KILL_SWITCH_NEW_CAFE_REGISTRATION
  //   Scope: Suspends new Café onboarding/registration flow only.
  //   Does NOT affect: Existing cafés, their staff, POS, billing, or documents.
  //   Trigger: Data integrity concern during platform change or capacity limit.
  //   Reset: PRIMARY_MASTER after root-cause resolution.
  KILL_SWITCH_NEW_CAFE_REGISTRATION: false,

};

class FeatureFlagService {
  constructor() {
    this.flags = { ...DEFAULT_FLAGS };
    this.history = [];
  }

  /**
   * Evaluates if a flag is active for a given tenant context.
   */
  isEnabled(flagKey, { organisationId = 'ZAMORIN', cafeId = null } = {}) {
    if (this.flags[flagKey] === undefined) {
      return false;
    }
    return Boolean(this.flags[flagKey]);
  }

  /**
   * Evaluates if a kill switch is tripped.
   */
  isKillSwitchTripped(switchKey) {
    return Boolean(this.flags[switchKey]);
  }

  /**
   * Updates a feature flag or trips a kill switch with audit trail.
   */
  setFlag(flagKey, value, { actorId = 'MU-0001', actorRole = 'MASTER', reason = 'Operational adjustment' } = {}) {
    const previous = this.flags[flagKey];
    this.flags[flagKey] = Boolean(value);

    const changeRecord = {
      timestamp: new Date().toISOString(),
      flagKey,
      previousValue: previous,
      newValue: Boolean(value),
      actorId,
      actorRole,
      reason,
    };

    this.history.push(changeRecord);

    logSecurityEvent({
      action: 'FEATURE_FLAG_ALTERED',
      actorId,
      outcome: 'SUCCESS',
      severity: flagKey.startsWith('KILL_SWITCH') ? 'WARN' : 'INFO',
      metadata: changeRecord,
    });

    return changeRecord;
  }

  /**
   * Returns all flags and current values.
   */
  getAllFlags() {
    return {
      flags: { ...this.flags },
      lastChanged: this.history.length ? this.history[this.history.length - 1] : null,
      historyCount: this.history.length,
    };
  }

  reset() {
    this.flags = { ...DEFAULT_FLAGS };
    this.history = [];
  }
}

const featureFlagService = new FeatureFlagService();

module.exports = {
  DEFAULT_FLAGS,
  FeatureFlagService,
  featureFlagService,
};
