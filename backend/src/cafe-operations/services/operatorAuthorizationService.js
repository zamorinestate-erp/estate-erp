'use strict';
// Pure, dependency-free authorization decision for the Operator/PIN path —
// no DB calls in here on purpose, so it's trivial to unit test exhaustively
// against the required security matrix (login spec Section 121). This is
// the literal AND-chain from Section 6 of the login spec, minus the parts
// (PIN validity, rate limiting) that are evaluated before this is called.
const { DEVICE_STATUS, DENIAL_REASON } = require('../utils/constants');

function evaluateOperatorAccess({ device, employee, operatorAccess, now = new Date() }) {
  if (!device) return deny(DENIAL_REASON.DEVICE_NOT_FOUND);
  if (device.lifecycleStatus !== DEVICE_STATUS.ACTIVE) return deny(DENIAL_REASON.DEVICE_NOT_ACTIVE);

  if (!employee) return deny(DENIAL_REASON.INVALID_PIN); // PIN didn't resolve to anyone
  if (employee.isActive === false) return deny(DENIAL_REASON.EMPLOYEE_INACTIVE);

  if (!operatorAccess) return deny(DENIAL_REASON.ACCESS_MISSING); // e.g. STAFF: no elevation from a trusted device alone
  if (operatorAccess.status === 'REVOKED') return deny(DENIAL_REASON.ACCESS_REVOKED);
  if (operatorAccess.status !== 'ACTIVE') return deny(DENIAL_REASON.ACCESS_MISSING);

  if (String(operatorAccess.cafeId) !== String(device.cafeId)) return deny(DENIAL_REASON.CAFE_MISMATCH);

  if (operatorAccess.validFrom && now < new Date(operatorAccess.validFrom)) return deny(DENIAL_REASON.ACCESS_EXPIRED);
  if (operatorAccess.validUntil && now > new Date(operatorAccess.validUntil)) return deny(DENIAL_REASON.ACCESS_EXPIRED);

  return { granted: true, reason: null };
}

function deny(reason) { return { granted: false, reason }; }

module.exports = { evaluateOperatorAccess };
