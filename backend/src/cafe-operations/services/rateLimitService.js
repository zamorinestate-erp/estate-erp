'use strict';
// In-memory, per-device, per-auth-path rate limiting. Scoped by (deviceId,
// scope) rather than by employee, because the employee isn't known until
// AFTER a PIN/password is checked — the whole point of Section 50/51 (login
// spec) and Section 24 (master spec) is that this must not depend on
// knowing identity first. PIN attempts and Master attempts are tracked
// separately so a wave of PIN guessing can't lock out Master sign-in on the
// same device, or vice versa.
//
// Production note: this is per-process memory. If Cafe Operations ever runs
// as more than one Render instance behind a load balancer, move this to a
// shared store (Redis, or a Mongo collection with a TTL index) — the
// interface below is small enough to swap without touching callers.
const sessionPolicy = require('../config/sessionPolicy');
const { defaultLimiter, DistributedRateLimiter } = require('../../services/distributedRateLimiter');

const store = new Map(); // local synchronous fast path: key: `${deviceId}:${scope}` -> { failures, lockedUntil, firstFailureAt }

let sharedLimiter = defaultLimiter;

function setDistributedLimiter(limiter) {
  sharedLimiter = limiter;
}

function key(deviceId, scope) { return `${deviceId}:${scope}`; }
function getState(deviceId, scope) { return store.get(key(deviceId, scope)) || { failures: 0, lockedUntil: null, firstFailureAt: null }; }
function maxAttempts(scope) { return scope === 'MASTER' ? sessionPolicy.MAX_FAILED_MASTER_ATTEMPTS : sessionPolicy.MAX_FAILED_PIN_ATTEMPTS; }

function isLocked(deviceId, scope = 'PIN', now = new Date()) {
  const state = getState(deviceId, scope);
  if (state.lockedUntil && now < state.lockedUntil) return { locked: true, retryAt: state.lockedUntil };
  return { locked: false, retryAt: null };
}

function recordFailure(deviceId, scope = 'PIN', now = new Date()) {
  const state = getState(deviceId, scope);
  const windowMs = sessionPolicy.RATE_LIMIT_WINDOW_MINUTES * 60 * 1000;
  if (!state.firstFailureAt || now - state.firstFailureAt > windowMs) { state.firstFailureAt = now; state.failures = 0; }
  state.failures += 1;
  if (state.failures >= maxAttempts(scope)) {
    state.lockedUntil = new Date(now.getTime() + sessionPolicy.LOCKOUT_DURATION_MINUTES * 60 * 1000);
  }
  store.set(key(deviceId, scope), state);

  // Propagate to shared limiter if distributed
  if (sharedLimiter && sharedLimiter.isDistributed) {
    sharedLimiter.recordFailure({ deviceId, scope }, {
      maxAttempts: maxAttempts(scope),
      windowMs,
      lockoutMs: sessionPolicy.LOCKOUT_DURATION_MINUTES * 60 * 1000,
      now,
    }).catch(() => {});
  }

  return state;
}

function recordSuccess(deviceId, scope = 'PIN') {
  store.delete(key(deviceId, scope));
  if (sharedLimiter && sharedLimiter.isDistributed) {
    sharedLimiter.recordSuccess({ deviceId, scope }).catch(() => {});
  }
}

function _reset() {
  store.clear();
  if (sharedLimiter) sharedLimiter.reset().catch(() => {});
}

// When a shared distributed store (e.g. Redis) is connected, limitation is false
function isMultiInstanceLimitationActive() {
  return !(sharedLimiter && sharedLimiter.isDistributed && !sharedLimiter.degraded);
}

module.exports = {
  isLocked,
  recordFailure,
  recordSuccess,
  _reset,
  setDistributedLimiter,
  isMultiInstanceLimitationActive,
  get MULTI_INSTANCE_PRODUCTION_LIMITATION() {
    return isMultiInstanceLimitationActive();
  },
};
