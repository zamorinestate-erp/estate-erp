'use strict';

/**
 * Middleware guards for enforcing device-bound separation and privilege profiles.
 */

function requireCafeOperationsDevice(req, res, next) {
  if (!req.auth) {
    return res.status(401).json({ error: 'UNAUTHENTICATED' });
  }

  // MASTER retains global governance authority
  if (req.auth.role === 'MASTER') {
    return next();
  }

  if (req.auth.role !== 'CAFE_ADMIN') {
    return res.status(403).json({
      error: 'FORBIDDEN_ROLE',
      message: 'Operation requires CAFE_ADMIN or MASTER role',
    });
  }

  if (req.auth.privilegeProfile !== 'CAFE_OPERATIONS') {
    return res.status(403).json({
      error: 'DEVICE_SCOPE_DENIED',
      message: 'Cafe operations are strictly restricted to registered active CAFE_OWNED devices. Personal devices operate with SELF_ONLY privilege.',
    });
  }

  const targetCafeId = req.params.cafeId || req.query.cafeId || (req.body && req.body.cafeId);
  if (targetCafeId && req.auth.deviceContext.boundCafeId && req.auth.deviceContext.boundCafeId !== targetCafeId) {
    return res.status(403).json({
      error: 'CROSS_CAFE_DEVICE_SCOPE_DENIED',
      message: `Device is bound to ${req.auth.deviceContext.boundCafeId} and cannot operate on ${targetCafeId}`,
    });
  }

  next();
}

function requireSelfProfile(req, res, next) {
  if (!req.auth) {
    return res.status(401).json({ error: 'UNAUTHENTICATED' });
  }

  const requestedUserId = req.params.userId || req.query.userId || (req.body && req.body.userId);
  if (req.auth.privilegeProfile === 'SELF_ONLY' && requestedUserId && requestedUserId !== req.auth.userId) {
    return res.status(403).json({
      error: 'SELF_ONLY_SCOPE_DENIED',
      message: 'Personal device context restricts operations to own user profile data only',
    });
  }

  next();
}

module.exports = {
  requireCafeOperationsDevice,
  requireSelfProfile,
};
