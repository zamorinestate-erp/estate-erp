'use strict';
const { getRepositories } = require('../repositories');
const { sha256Hex } = require('../utils/ids');
const { DEVICE_STATUS } = require('../utils/constants');
const { fail } = require('../utils/responses');

function extractDeviceToken(req) {
  const header = req.headers['x-cafeops-device-token'];
  if (header) return header;
  const auth = req.headers['authorization'];
  if (auth && auth.startsWith('Bearer ')) return auth.slice(7);
  return null;
}

const LIFECYCLE_MESSAGE = {
  REVOKED: 'This Cafe Operations Device is no longer authorised.',
  LOST: 'This device cannot access Cafe Operations.',
  RETIRED: 'Cafe Operations has been disabled on this device.',
  REPLACED: 'Cafe Operations has been disabled on this device.',
  PENDING: 'This device has not completed registration.',
};

// Resolves and validates the device on EVERY protected request, deriving
// identity purely from the validated token — never from a client-supplied
// deviceId (login spec Section 77 / master spec Section 79: no forged
// attribution). This is what makes a forged `deviceId` in a request body a
// no-op everywhere downstream: nothing ever reads it.
async function deviceContext(req, res, next) {
  try {
    const token = extractDeviceToken(req);
    if (!token) {
      return fail(res, 401, 'DEVICE_TOKEN_REQUIRED', 'This device is not recognised. Registration is required.');
    }
    const repos = getRepositories();
    const device = await repos.devices.findByTokenHash(sha256Hex(token));
    if (!device) {
      return fail(res, 401, 'DEVICE_NOT_RECOGNISED', 'This device is not recognised. Registration is required.');
    }
    if (device.lifecycleStatus !== DEVICE_STATUS.ACTIVE) {
      return fail(res, 403, `DEVICE_${device.lifecycleStatus}`, LIFECYCLE_MESSAGE[device.lifecycleStatus] || 'This device cannot access Cafe Operations.');
    }
    await repos.devices.touchLastSeen(device.id, new Date());
    req.cafeOpsDevice = device;
    next();
  } catch (err) { next(err); }
}

module.exports = { deviceContext, extractDeviceToken };
