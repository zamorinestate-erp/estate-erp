'use strict';

const { DeviceRegistration } = require('../models/DeviceRegistration');
const deviceTrustService = require('../services/deviceTrustService');

/**
 * Middleware that inspects incoming request headers/session for device identity,
 * resolves DeviceRegistration from Atlas, and attaches effective privilege profile.
 */
async function attachDeviceContext(req, res, next) {
  try {
    if (!req.auth || !req.auth.userId) {
      return next();
    }

    const deviceId = req.headers['x-device-id'] || (req.session && req.session.deviceId) || null;
    let deviceRegistration = null;

    if (deviceId) {
      deviceRegistration = await DeviceRegistration.findOne({
        deviceId,
        status: 'ACTIVE',
      }).lean();
    }

    const effective = deviceTrustService.derivePrivilegeProfile(
      req.auth.role,
      deviceRegistration,
      req.params.cafeId || req.query.cafeId || (req.body && req.body.cafeId)
    );

    req.auth.deviceContext = {
      deviceId: deviceId || 'UNKNOWN_PERSONAL_DEVICE',
      deviceClass: deviceRegistration ? deviceRegistration.deviceClass : 'PERSONAL',
      boundCafeId: deviceRegistration ? deviceRegistration.assignedCafeId : null,
      status: deviceRegistration ? deviceRegistration.status : 'UNREGISTERED',
      trustLevel: deviceRegistration ? deviceRegistration.trustLevel : 'UNVERIFIED',
    };

    req.auth.privilegeProfile = effective.privilegeProfile;
    req.auth.isCafeOperationsAllowed = effective.isCafeOperationsAllowed;
    req.auth.allowedCafeScope = effective.allowedCafeScope;

    next();
  } catch (err) {
    next(err);
  }
}

module.exports = {
  attachDeviceContext,
};
