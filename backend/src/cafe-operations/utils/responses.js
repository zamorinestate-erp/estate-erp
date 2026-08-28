'use strict';
// Envelope matches the REAL client (src/js/pages/login.js's apiRequest):
// success -> { success: true, data: {...} }
// failure -> { success: false, error: { code, message, ...extra } }, and
// the client reads err.status from the HTTP status code, not the body.
// Message text mirrors the login spec (Section 49/51) and master spec
// (Section 35) exactly so the API and UI never drift apart.

function ok(res, data, status = 200) {
  return res.status(status).json({ success: true, data: data || {} });
}

function fail(res, status, code, message, extra) {
  return res.status(status).json({ success: false, error: { code, message, ...(extra || {}) } });
}

function genericAuthFailure(res, { supportReference } = {}) {
  return fail(res, 401, 'UNABLE_TO_SIGN_IN',
    'This Operator cannot access Cafe Operations on this device. Check the Operator PIN or contact an authorised administrator.',
    { supportReference: supportReference || null });
}

function masterAuthFailure(res, { supportReference } = {}) {
  return fail(res, 401, 'MASTER_ACCESS_UNAVAILABLE',
    'Master access could not be verified on this device. Check your details or try again.',
    { supportReference: supportReference || null });
}

function throttled(res, { retryAt, supportReference } = {}) {
  return fail(res, 429, 'SIGNIN_TEMPORARILY_UNAVAILABLE',
    'Too many unsuccessful attempts were detected. Please try again later or contact an authorised administrator.',
    { retryAt: retryAt || null, supportReference: supportReference || null });
}

function offlineUnavailable(res) {
  return fail(res, 503, 'AUTH_UNAVAILABLE_OFFLINE',
    'This device is connected, but Zamorin cannot currently be reached. Sign-in requires a live connection.');
}

module.exports = { ok, fail, genericAuthFailure, masterAuthFailure, throttled, offlineUnavailable };
