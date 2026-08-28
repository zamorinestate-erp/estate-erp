'use strict';
/**
 * INTEGRATION SEAM.
 *
 * This module is standalone: it does not have your real Employee/User or
 * Cafe collections. When mounted into the real Zamorin backend, both of
 * those already exist as Mongoose models registered elsewhere in the same
 * process — Mongoose's model registry is process-global, so
 * `mongoose.model('Employee')` will find them automatically as long as
 * this file names them correctly. That's the entire integration step for
 * this seam: set these two names (or the matching env vars) to whatever
 * your actual models are actually called, nothing else.
 */
module.exports = {
  EMPLOYEE_MODEL_NAME: process.env.CAFE_OPS_EMPLOYEE_MODEL || 'User',
  CAFE_MODEL_NAME: process.env.CAFE_OPS_CAFE_MODEL || 'Cafe',
};
