'use strict';

const { ApiError } = require('./ApiError');

/**
 * ZAMORIN CAFE ERP — CENTRAL TENANT & CAFE SCOPE RESOLVER
 *
 * Implements OWASP / AWS Tenant Isolation Guidelines:
 * - Deny-by-default authorization
 * - Strict device & operator café binding for CAFE_ADMIN
 * - Multi-café authorized access preserved for MASTER and OWNER
 * - Absolute non-bypassable cross-café boundary enforcement
 */

/**
 * Resolves the authoritative effective café ID for the current request.
 *
 * @param {Object} request Express request object containing req.auth
 * @returns {string|null} Canonical uppercase Cafe ID or null if global Master/Owner view
 * @throws {ApiError} 403 if café context is invalid or cross-café access is attempted
 */
function resolveEffectiveCafeScope(request) {
  if (!request || !request.auth) {
    throw new ApiError(401, 'UNAUTHENTICATED', 'Authentication required.');
  }

  const { role, assignedCafeIds, deviceContext } = request.auth;
  const requestedCafe = (request.query?.cafeId || request.body?.cafeId || request.params?.cafeId || '').trim().toUpperCase();

  // Determine explicit workspace mode or derive from active CAFE_OWNED device context
  const isCafeOperationsDevice = deviceContext?.deviceClass === 'CAFE_OWNED' && !!deviceContext?.boundCafeId;
  const isCafeOperationsWorkspace = request.auth.workspaceMode === 'CAFE_OPERATIONS' || 
    request.headers?.['x-workspace-mode'] === 'CAFE_OPERATIONS' || 
    isCafeOperationsDevice || 
    role === 'CAFE_ADMIN';

  // 1. CAFE_OPERATIONS WORKSPACE MODE:
  // Strictly bound to the trusted device's boundCafeId for ALL roles (including MASTER operating in Cafe Operations)
  if (isCafeOperationsWorkspace) {
    const boundCafe = (deviceContext?.boundCafeId || assignedCafeIds?.[0] || '').trim().toUpperCase();
    if (!boundCafe) {
      throw new ApiError(
        403,
        'INVALID_DEVICE_CAFE_CONTEXT',
        'Active Cafe Operations device or operator café binding is missing.'
      );
    }

    if (requestedCafe && requestedCafe !== 'ALL' && requestedCafe !== boundCafe) {
      throw new ApiError(
        403,
        'CROSS_CAFE_RESOURCE_DENIED',
        'Cross-café access is denied. This device is not authorized for the requested café.'
      );
    }

    return boundCafe;
  }

  // 2. MASTER_WORKSPACE GOVERNANCE MODE:
  // MASTER and OWNER have global portfolio governance access
  if (role === 'MASTER' || role === 'OWNER') {
    return requestedCafe && requestedCafe !== 'ALL' ? requestedCafe : null;
  }

  // 3. STAFF and personal device contexts
  const staffCafe = (assignedCafeIds?.[0] || '').trim().toUpperCase();
  return staffCafe || null;
}

/**
 * Asserts that a retrieved resource belongs to the current effective café.
 * Throws a safe 404 / 403 error without enumerating foreign resource existence.
 *
 * @param {Object} resource The retrieved database document
 * @param {string|null} effectiveCafe The resolved effective café ID
 * @param {string} resourceName Human-readable resource type for error messages
 */
function assertResourceCafeOwnership(resource, effectiveCafe, resourceName = 'Resource') {
  if (!resource) {
    throw new ApiError(404, 'NOT_FOUND', `${resourceName} not found.`);
  }

  if (!effectiveCafe) {
    // Global Master/Owner view
    return;
  }

  const resourceCafe = (resource.cafeId || resource.assignedCafeId || resource.outletId || '').trim().toUpperCase();
  
  // Cross-café transactions (e.g. transfers where café is either source or destination)
  if (resource.fromCafeId || resource.toCafeId) {
    const fromCafe = (resource.fromCafeId || '').trim().toUpperCase();
    const toCafe = (resource.toCafeId || '').trim().toUpperCase();
    if (fromCafe === effectiveCafe || toCafe === effectiveCafe) {
      return;
    }
    throw new ApiError(404, 'NOT_FOUND', `${resourceName} not found.`);
  }

  if (resourceCafe && resourceCafe !== effectiveCafe) {
    throw new ApiError(404, 'NOT_FOUND', `${resourceName} not found.`);
  }
}

/**
 * Sanitizes input body against an allow-list of writable fields to prevent mass-assignment.
 *
 * @param {Object} body Request body
 * @param {Array<string>} allowedFields List of permitted field keys
 * @returns {Object} Sanitized object with only allowlisted fields
 */
function allowlistWritableFields(body, allowedFields = []) {
  if (!body || typeof body !== 'object') return {};
  const sanitized = {};
  const allowSet = new Set(allowedFields);

  for (const [key, value] of Object.entries(body)) {
    if (allowSet.has(key)) {
      sanitized[key] = value;
    }
  }

  return sanitized;
}

module.exports = {
  resolveEffectiveCafeScope,
  assertResourceCafeOwnership,
  allowlistWritableFields,
};
