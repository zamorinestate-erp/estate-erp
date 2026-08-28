'use strict';
/**
 * Central session policy. Every timeout in this module reads from here —
 * nothing is hardcoded in a screen or a route. All values are overridable
 * via env vars without touching code.
 */
module.exports = {
  INACTIVITY_LOCK_TIMEOUT_MINUTES: Number(process.env.CAFE_OPS_INACTIVITY_TIMEOUT_MIN || 5),
  PRE_TIMEOUT_WARNING_SECONDS: Number(process.env.CAFE_OPS_PRE_TIMEOUT_WARNING_SEC || 30),
  OVERALL_SESSION_LIFETIME_HOURS: Number(process.env.CAFE_OPS_SESSION_LIFETIME_HRS || 12),

  MAX_FAILED_PIN_ATTEMPTS: Number(process.env.CAFE_OPS_MAX_PIN_ATTEMPTS || 5),
  MAX_FAILED_MASTER_ATTEMPTS: Number(process.env.CAFE_OPS_MAX_MASTER_ATTEMPTS || 5),
  LOCKOUT_DURATION_MINUTES: Number(process.env.CAFE_OPS_LOCKOUT_MIN || 15),
  RATE_LIMIT_WINDOW_MINUTES: Number(process.env.CAFE_OPS_RATE_WINDOW_MIN || 15),

  ENROLLMENT_TOKEN_TTL_MINUTES: Number(process.env.CAFE_OPS_ENROLL_TTL_MIN || 15),
  MFA_CHALLENGE_TTL_MINUTES: Number(process.env.CAFE_OPS_MFA_TTL_MIN || 5),

  // Section 92 (login spec) / Section 20+161 (master spec): neither auth path
  // may create a NEW session while the backend can't be reached. Reuse of an
  // already-live session across a network blip is a separate, later concern
  // (a secure, time-limited, device-bound offline lease) and isn't built here
  // because no such existing lease was described anywhere in the source docs.
  OFFLINE_SIGNIN_ENABLED: false,

  // Section 71 (login spec) / Section 111-113 (master spec): same person,
  // two devices at once. Default = allow + audit; flip to strict if you'd
  // rather it just deny the second one outright.
  DENY_CONCURRENT_SESSIONS: process.env.CAFE_OPS_DENY_CONCURRENT === 'true',

  MAX_CLOCK_DRIFT_SECONDS: 120,

  // Master spec Section 46: centralized, not hardcoded per-screen.
  MASTER_ACCESS_REASON_REQUIRED: process.env.CAFE_OPS_MASTER_REASON_REQUIRED === 'true',

  // Master spec Section 51-53: the mechanism (Confirm Operator / Confirm
  // Master Identity) is built; deliberately no actions are wired to require
  // it yet — Section 53 explicitly says not to invent thresholds here. Add
  // action keys as the modules that need them get built, e.g.
  // STEP_UP_REQUIRED_ACTIONS: ['EXPENSE_REVERSAL', 'CASH_ADJUSTMENT']
  STEP_UP_REQUIRED_ACTIONS: [],
  STEP_UP_MAX_AGE_MINUTES: Number(process.env.CAFE_OPS_STEP_UP_MAX_AGE_MIN || 15),
};
