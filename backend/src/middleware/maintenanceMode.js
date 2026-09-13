'use strict';

/**
 * ============================================================================
 * ZAMORIN CAFÉ ERP — MAINTENANCE & READ-ONLY MODE MIDDLEWARE
 * ============================================================================
 * Enforces scheduled maintenance windows and read-only degraded states.
 *
 * Invariants:
 * 1. Health and liveness probes (/health, /readiness) are ALWAYS exempt.
 * 2. Primary Master (MU-0001) and Owner roles possess operational bypass rights.
 * 3. Read-only mode allows GET/HEAD while safely blocking state mutations.
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

    // 3. Check for operational bypass (MASTER / PRIMARY_MASTER / OWNER)
    const userRole = req.auth?.role || req.user?.role;
    const isMasterOrOwner = userRole === 'MASTER' || userRole === 'PRIMARY_MASTER' || userRole === 'OWNER';

    const state = manager.getState();

    // 4. Full Maintenance Mode
    if (state.maintenanceActive) {
      if (isMasterOrOwner) {
        // Authorized operational bypass
        if (typeof res.setHeader === 'function') {
          res.setHeader('X-Maintenance-Bypass', 'true');
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
      if (isMutation && !isMasterOrOwner) {
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
};
