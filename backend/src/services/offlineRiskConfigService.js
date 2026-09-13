'use strict';

/**
 * ============================================================================
 * ZAMORIN CAFÉ ERP — OFFLINE RISK CONFIGURATION SERVICE (R02C-01 / R02C-02)
 * ============================================================================
 * Central governance service for offline risk thresholds.
 * Enforces canonical RBAC permissions (OFFLINE_RISK_CONFIG_READ/WRITE),
 * strict organisation & café scoping, non-weakening policy invariants,
 * integer minor-unit currency (paise), and hierarchical fallback:
 *   validated cafe override -> organisation setting -> safe application default
 *
 * Strictly eliminates invented/non-canonical roles (ADMIN, ORG_ADMIN, etc.).
 * Canonical roles: MASTER, OWNER, CAFE_ADMIN, STAFF.
 */

const { OfflineRiskConfig, DEFAULT_OFFLINE_RISK_CONFIG } = require('../models/OfflineRiskConfig');
const { ApiError } = require('../utils/ApiError');

const OFFLINE_RISK_PERMISSIONS = Object.freeze({
  READ: 'OFFLINE_RISK_CONFIG_READ',
  WRITE: 'OFFLINE_RISK_CONFIG_WRITE',
});

const CANONICAL_ROLES = Object.freeze([
  'MASTER',
  'OWNER',
  'CAFE_ADMIN',
  'STAFF',
]);

class OfflineRiskConfigService {
  /**
   * Retrieves effective risk thresholds with hierarchical fallback:
   * 1. Cafe override (if cafeId provided, override exists, and org permits)
   * 2. Organisation default
   * 3. Safe system application defaults
   *
   * Enforces read-scope authorization when actor context is supplied.
   */
  static async getEffectiveRiskConfig({
    organisationId,
    cafeId = null,
    actor = null,
    actorRole = null,
    actorPermissions = null,
  }) {
    if (!organisationId) {
      throw new ApiError(400, 'INVALID_CONFIG_INPUT', 'organisationId is required.');
    }

    const cleanOrg = organisationId.trim().toUpperCase();
    const cleanCafe = cafeId ? cafeId.trim().toUpperCase() : null;

    // Optional Actor authorization evaluation on read path
    if (actor) {
      const actorOrg = (actor.organisationId || actor.orgId || '').trim().toUpperCase();
      if (actorOrg && actorOrg !== cleanOrg) {
        throw new ApiError(
          403,
          'CROSS_ORGANISATION_ACCESS_DENIED',
          'Cannot read offline risk configuration from a different organisation.'
        );
      }

      const role = (actor.role || actorRole || '').trim().toUpperCase();
      if (role && !CANONICAL_ROLES.includes(role)) {
        throw new ApiError(
          403,
          'FORBIDDEN_RISK_CONFIG',
          `Role '${role}' is not a recognized canonical role.`
        );
      }

      const assignedCafes = (actor.assignedCafeIds || actor.assignedCafes || []).map((c) =>
        String(c).trim().toUpperCase()
      );
      if (cleanCafe && role === 'CAFE_ADMIN' && assignedCafes.length > 0 && !assignedCafes.includes(cleanCafe)) {
        throw new ApiError(
          403,
          'CROSS_CAFE_ACCESS_DENIED',
          `CAFE_ADMIN is not assigned to café '${cleanCafe}'.`
        );
      }

      const permissions = actor.permissions || actorPermissions;
      if (Array.isArray(permissions) && !permissions.includes(OFFLINE_RISK_PERMISSIONS.READ)) {
        throw new ApiError(
          403,
          'PERMISSION_DENIED',
          `Missing required canonical permission: '${OFFLINE_RISK_PERMISSIONS.READ}'.`
        );
      }
    }

    // Fetch org-level config
    const orgConfig = await OfflineRiskConfig.findOne({
      organisationId: cleanOrg,
      $or: [{ cafeId: null }, { cafeId: '' }],
    }).lean();

    // Check for cafe-specific override
    if (cleanCafe) {
      const cafeConfig = await OfflineRiskConfig.findOne({
        organisationId: cleanOrg,
        cafeId: cleanCafe,
      }).lean();

      if (cafeConfig) {
        // Only respect café override if org permits or orgConfig doesn't explicitly disallow
        const allowed = orgConfig ? orgConfig.allowCafeOverride !== false : true;
        if (allowed) {
          return {
            organisationId: cleanOrg,
            cafeId: cleanCafe,
            maxDiscountPercent: cafeConfig.maxDiscountPercent,
            highValueAmountPaise: cafeConfig.highValueAmountPaise,
            source: 'CAFE_OVERRIDE',
          };
        }
      }
    }

    if (orgConfig) {
      return {
        organisationId: cleanOrg,
        cafeId: null,
        maxDiscountPercent: orgConfig.maxDiscountPercent,
        highValueAmountPaise: orgConfig.highValueAmountPaise,
        allowCafeOverride: orgConfig.allowCafeOverride,
        source: 'ORGANISATION_SETTING',
      };
    }

    // Fallback to application defaults
    return {
      organisationId: cleanOrg,
      cafeId: null,
      maxDiscountPercent: DEFAULT_OFFLINE_RISK_CONFIG.maxDiscountPercent,
      highValueAmountPaise: DEFAULT_OFFLINE_RISK_CONFIG.highValueAmountPaise,
      allowCafeOverride: DEFAULT_OFFLINE_RISK_CONFIG.allowCafeOverride,
      source: 'APPLICATION_DEFAULT',
    };
  }

  /**
   * Sets or updates offline risk configuration.
   * Strictly enforces canonical permission boundaries, organisation scope,
   * and café-specific governance invariants.
   *
   * Conceptually evaluates:
   *   Authenticated User + Canonical Permission + Organisation Scope + Configuration Scope = Allowed / Denied
   */
  static async updateRiskConfig({
    organisationId,
    cafeId = null,
    config = {},
    actorRole = null,
    actorUserId = 'SYSTEM',
    actorPermissions = null,
    actorAssignedCafes = [],
    actor = null,
  }) {
    if (!organisationId) {
      throw new ApiError(400, 'INVALID_CONFIG_INPUT', 'organisationId is required.');
    }

    const cleanOrg = organisationId.trim().toUpperCase();
    const cleanCafe = cafeId ? cafeId.trim().toUpperCase() : null;

    // Extract actor attributes from either actor object or explicit arguments
    const role = (actor?.role || actorRole || '').trim().toUpperCase();
    const userId = (actor?.userId || actorUserId || 'SYSTEM').trim().toUpperCase();
    const actorOrg = (actor?.organisationId || cleanOrg).trim().toUpperCase();
    const assignedCafes = (actor?.assignedCafeIds || actor?.assignedCafes || actorAssignedCafes || []).map((c) =>
      String(c).trim().toUpperCase()
    );
    const permissions = actor?.permissions || actorPermissions;

    // 1. Cross-organisation check (Organisation Scope)
    if (actorOrg !== cleanOrg) {
      throw new ApiError(
        403,
        'CROSS_ORGANISATION_ACCESS_DENIED',
        'Cannot configure offline risk thresholds for a different organisation.'
      );
    }

    // 2. Canonical Role Enforcement (Deny by default for any unknown / invented role)
    if (!CANONICAL_ROLES.includes(role)) {
      throw new ApiError(
        403,
        'FORBIDDEN_RISK_CONFIG',
        `Role '${role}' is not a recognized canonical role. Access denied by default.`
      );
    }

    // 3. Role-Specific Governance & Configuration Scope
    if (role === 'STAFF') {
      // Ordinary café operator / staff is strictly denied from modifying enterprise risk policy
      throw new ApiError(
        403,
        'FORBIDDEN_RISK_CONFIG',
        'STAFF role is not permitted to modify offline risk policy.'
      );
    }

    // 4. Permission Enforcement
    // If permissions are explicitly provided, actor MUST hold OFFLINE_RISK_CONFIG_WRITE
    if (Array.isArray(permissions)) {
      const hasWritePerm = permissions.includes(OFFLINE_RISK_PERMISSIONS.WRITE);
      if (!hasWritePerm) {
        throw new ApiError(
          403,
          'PERMISSION_DENIED',
          `Missing required canonical permission: '${OFFLINE_RISK_PERMISSIONS.WRITE}'.`
        );
      }
    }

    if (role === 'OWNER') {
      // Owner has read-only portfolio governance unless explicit write permission rule applies
      if (!Array.isArray(permissions) || !permissions.includes(OFFLINE_RISK_PERMISSIONS.WRITE)) {
        throw new ApiError(
          403,
          'FORBIDDEN_RISK_CONFIG',
          'OWNER role has read-only financial oversight and cannot modify operational risk thresholds without explicit write authorization.'
        );
      }
    }

    // Fetch existing organisation default config
    const orgConfig = await OfflineRiskConfig.findOne({
      organisationId: cleanOrg,
      $or: [{ cafeId: null }, { cafeId: '' }],
    }).lean();

    if (role === 'CAFE_ADMIN') {
      // CAFE_ADMIN cannot modify organisation-wide policy
      if (!cleanCafe) {
        throw new ApiError(
          403,
          'FORBIDDEN_ORGANISATION_SCOPE',
          'CAFE_ADMIN cannot modify organisation-wide offline risk defaults. Enterprise administration required.'
        );
      }

      // CAFE_ADMIN can only modify assigned café
      if (assignedCafes.length > 0 && !assignedCafes.includes(cleanCafe)) {
        throw new ApiError(
          403,
          'CROSS_CAFE_ACCESS_DENIED',
          `CAFE_ADMIN is not assigned to café '${cleanCafe}'.`
        );
      }

      // Check if organisation allows café overrides
      if (orgConfig && orgConfig.allowCafeOverride === false) {
        throw new ApiError(
          403,
          'CAFE_OVERRIDE_DISALLOWED',
          'Organisation policy strictly disallows café-level risk overrides.'
        );
      }

      // Non-weakening invariant: Café Admin cannot exceed/relax enterprise limits
      if (orgConfig) {
        if (
          config.maxDiscountPercent !== undefined &&
          Number(config.maxDiscountPercent) > orgConfig.maxDiscountPercent
        ) {
          throw new ApiError(
            400,
            'CANNOT_WEAKEN_RISK_POLICY',
            `Café discount threshold (${config.maxDiscountPercent}%) cannot exceed organisation policy limit (${orgConfig.maxDiscountPercent}%).`
          );
        }
        if (
          config.highValueAmountPaise !== undefined &&
          Number(config.highValueAmountPaise) > orgConfig.highValueAmountPaise
        ) {
          throw new ApiError(
            400,
            'CANNOT_WEAKEN_RISK_POLICY',
            `Café high-value threshold (${config.highValueAmountPaise} paise) cannot exceed organisation policy limit (${orgConfig.highValueAmountPaise} paise).`
          );
        }
      }
    }

    // Input validation
    const updateFields = {};

    if (config.maxDiscountPercent !== undefined) {
      const disc = Number(config.maxDiscountPercent);
      if (!Number.isFinite(disc) || isNaN(disc) || disc < 0 || disc > 100) {
        throw new ApiError(
          400,
          'INVALID_DISCOUNT_THRESHOLD',
          'maxDiscountPercent must be a finite number between 0 and 100.'
        );
      }
      updateFields.maxDiscountPercent = disc;
    }

    if (config.highValueAmountPaise !== undefined) {
      const amt = Number(config.highValueAmountPaise);
      if (!Number.isFinite(amt) || isNaN(amt) || !Number.isInteger(amt) || amt < 0) {
        throw new ApiError(
          400,
          'INVALID_AMOUNT_THRESHOLD',
          'highValueAmountPaise must be a finite non-negative integer in paise.'
        );
      }
      updateFields.highValueAmountPaise = amt;
    }

    if (config.allowCafeOverride !== undefined) {
      // allowCafeOverride can only be set at organisation level
      if (cleanCafe) {
        throw new ApiError(
          400,
          'INVALID_OVERRIDE_SETTING',
          'allowCafeOverride can only be configured on organisation defaults, not on café overrides.'
        );
      }
      updateFields.allowCafeOverride = Boolean(config.allowCafeOverride);
    }

    updateFields.updatedByUserId = userId;

    const updated = await OfflineRiskConfig.findOneAndUpdate(
      { organisationId: cleanOrg, cafeId: cleanCafe },
      { $set: updateFields },
      { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true }
    );

    return updated;
  }
}

module.exports = {
  OfflineRiskConfigService,
  OFFLINE_RISK_PERMISSIONS,
  CANONICAL_ROLES,
};
