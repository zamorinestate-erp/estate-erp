'use strict';

/**
 * ============================================================================
 * ZAMORIN CAFÉ ERP — MAINTENANCE & READ-ONLY MODE MIDDLEWARE
 * ============================================================================
 * Enforces scheduled maintenance windows and read-only degraded states.
 *
 * Bypass Rules (Stage 10 — Permission-Based, not role-blanket):
 *
 *   1. Health and liveness probes (/health, /readiness) are ALWAYS exempt.
 *   2. Auth login endpoints are ALWAYS exempt so operators can authenticate.
 *   3. PRIMARY_MASTER (MU-0001 system account) ALWAYS bypasses.
 *   4. Any principal with the explicit permission SYSTEM_OPERATIONS_BYPASS
 *      may bypass, regardless of role.
 *
 * CRITICAL: OWNER role alone does NOT automatically bypass an emergency
 * containment state. An OWNER must be explicitly granted
 * SYSTEM_OPERATIONS_BYPASS by a PRIMARY_MASTER to operate during maintenance.
 * This prevents an Owner from accidentally or maliciously defeating an
 * emergency shutdown.
 *
 * Read-Only Mode Bypass:
 *   Same rules apply. Only PRIMARY_MASTER and SYSTEM_OPERATIONS_BYPASS holders
 *   may write during read-only degraded operation.
 */

class MaintenanceModeManager {
  constructor() {
    this.maintenanceActive = false;
    this.readOnlyActive = false;
    this.reason = null;
    this.message = 'System maintenance is currently in progress. Please check back shortly.';
    this.startedAt = null;
    this.scheduledEnd = null;
  }

  setMaintenanceMode({ enabled, reason = 'Scheduled maintenance', message = null, scheduledEnd = null } = {}) {
    this.maintenanceActive = Boolean(enabled);
    this.reason = reason;
    if (message) this.message = message;
    this.startedAt = enabled ? new Date() : null;
    this.scheduledEnd = scheduledEnd ? new Date(scheduledEnd) : null;
    return this.getState();
  }

  setReadOnlyMode({ enabled, reason = 'Database maintenance window' } = {}) {
    this.readOnlyActive = Boolean(enabled);
    this.reason = reason;
    return this.getState();
  }

  getState() {
    return {
      maintenanceActive: this.maintenanceActive,
      readOnlyActive: this.readOnlyActive,
      reason: this.reason,
      message: this.message,
      startedAt: this.startedAt,
      scheduledEnd: this.scheduledEnd,
    };
  }
}

const maintenanceManager = new MaintenanceModeManager();

/**
 * Returns true if the requester is authorised to bypass maintenance/read-only
 * containment states.
 *
 * Authorised identities:
 *  - PRIMARY_MASTER system account (unconditional)
 *  - Any principal explicitly granted the SYSTEM_OPERATIONS_BYPASS permission
 *
 * OWNER role alone is NOT sufficient. An OWNER must hold the
 * SYSTEM_OPERATIONS_BYPASS permission to bypass. This permission must be
 * granted by a PRIMARY_MASTER through an authorised operational decision.
 *
 * @param {object} req - Express request object
 * @returns {boolean}
 */
function hasContainmentBypassAuthorisation(req) {
  const principal = req.auth || req.user;
  if (!principal) return false;

  // PRIMARY_MASTER always bypasses (system account - cannot be revoked)
  if (principal.role === 'PRIMARY_MASTER') return true;

  // Explicit SYSTEM_OPERATIONS_BYPASS permission (granted by PRIMARY_MASTER)
  const permissions = Array.isArray(principal.permissions) ? principal.permissions : [];
  if (permissions.includes('SYSTEM_OPERATIONS_BYPASS')) return true;

  return false;
}

function createMaintenanceMiddleware(manager = maintenanceManager) {
  return function maintenanceMiddleware(req, res, next) {
    const path = req.path || req.originalUrl || '';

    // 1. Health & readiness probes are strictly exempt
    if (
      path.startsWith('/health') ||
      path.startsWith('/api/health') ||
      path.startsWith('/api/v1/health') ||
      path.startsWith('/readiness') ||
      path.startsWith('/api/readiness') ||
      path.startsWith('/api/v1/readiness')
    ) {
      return next();
    }

    // 2. Auth login endpoints must remain accessible so operators can sign in
    if (path.includes('/auth/login') || path.includes('/auth/refresh') || path.includes('/auth/mfa')) {
      return next();
    }

    // 3. Permission-based containment bypass check
    const isAuthorisedBypass = hasContainmentBypassAuthorisation(req);

    const state = manager.getState();

    // 4. Full Maintenance Mode
    if (state.maintenanceActive) {
      if (isAuthorisedBypass) {
        if (typeof res.setHeader === 'function') {
          res.setHeader('X-Maintenance-Bypass', 'true');
          res.setHeader('X-Bypass-Reason', 'SYSTEM_OPERATIONS_BYPASS_AUTHORISED');
        }
        return next();
      }

      return res.status(503).json({
        success: false,
        error: {
          code: 'SERVICE_MAINTENANCE_MODE',
          message: state.message || 'System maintenance in progress.',
          reason: state.reason,
          scheduledEnd: state.scheduledEnd,
        },
        correlationId: req.correlationId || null,
        requestId: req.requestId || null,
      });
    }

    // 5. Read-Only Degraded Mode
    if (state.readOnlyActive) {
      const isMutation = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method.toUpperCase());
      if (isMutation && !isAuthorisedBypass) {
        return res.status(503).json({
          success: false,
          error: {
            code: 'SERVICE_READ_ONLY',
            message: 'Zamorin Café ERP is temporarily operating in Read-Only mode. State mutations are suspended.',
            reason: state.reason,
          },
          correlationId: req.correlationId || null,
          requestId: req.requestId || null,
        });
      }
    }

    next();
  };
}

module.exports = {
  MaintenanceModeManager,
  maintenanceManager,
  createMaintenanceMiddleware,
  hasContainmentBypassAuthorisation,
};
