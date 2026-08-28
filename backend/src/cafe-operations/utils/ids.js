'use strict';
const crypto = require('crypto');

// Crockford base32 alphabet minus I, L, O, U — avoids visual ambiguity when
// a human is reading a code off a screen or typing an enrollment code.
const CROCKFORD = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';

function randomBase32(length) {
  const bytes = crypto.randomBytes(length);
  let out = '';
  for (let i = 0; i < length; i++) out += CROCKFORD[bytes[i] % CROCKFORD.length];
  return out;
}

function pad(n, width) { return String(n).padStart(width, '0'); }

function generateSessionCode(sessionType, date = new Date()) {
  const prefix = sessionType === 'MASTER_ACCOUNT' ? 'MST-SES' : 'OPS-SES';
  const y = date.getUTCFullYear();
  const m = pad(date.getUTCMonth() + 1, 2);
  const d = pad(date.getUTCDate(), 2);
  return `${prefix}-${y}${m}${d}-${randomBase32(6)}`;
}

function generateDeviceCode(cafeShortCode = 'CAF') {
  return `DEV-${cafeShortCode}-${randomBase32(4)}`;
}

function generateEnrollmentCode() { return randomBase32(10); }
function generateSupportReference() { return `SUP-${randomBase32(6)}`; }
function generateOpaqueToken() { return crypto.randomBytes(32).toString('base64url'); }
function sha256Hex(input) { return crypto.createHash('sha256').update(String(input)).digest('hex'); }

module.exports = {
  randomBase32, generateSessionCode, generateDeviceCode,
  generateEnrollmentCode, generateSupportReference, generateOpaqueToken, sha256Hex,
};
