'use strict';
/**
 * INTEGRATION SEAM.
 *
 * NOT a full authentication system. Assumes the existing Zamorin personal
 * login/session middleware has already run earlier in the request chain and
 * populated `req.user` (or whatever the real shape is) with at minimum
 * { employeeId, role, organisationId }.
 *
 * Wire this up by replacing resolveCallerFromRequest() with a call into the
 * real session/JWT verification your MASTER/OWNER/CAFE_ADMIN login already
 * does — or delete this file and mount these routes behind your existing
 * role-guard middleware instead.
 */
const { fail } = require('../utils/responses');

function resolveCallerFromRequest(req) {
  if (req.auth) {
    return {
      employeeId: req.auth.userId,
      role: req.auth.role,
      organisationId: req.auth.organisationId,
      isPrimaryMaster: req.auth.isPrimaryMaster,
    };
  }
  if (req.authenticatedUser) {
    return {
      employeeId: req.authenticatedUser.userId || req.authenticatedUser._id,
      role: req.authenticatedUser.role,
      organisationId: req.authenticatedUser.organisationId,
      isPrimaryMaster: req.authenticatedUser.isPrimaryMaster,
    };
  }
  return req.user || null;
}

function requireGovernanceRole(...allowedRoles) {
  return function (req, res, next) {
    const caller = resolveCallerFromRequest(req);
    if (!caller || !allowedRoles.includes(caller.role)) {
      return fail(res, 403, 'FORBIDDEN', 'You do not have access to this area.');
    }
    req.cafeOpsCaller = caller;
    next();
  };
}

module.exports = { requireGovernanceRole, resolveCallerFromRequest };
