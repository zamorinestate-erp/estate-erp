'use strict';

/**
 * Zamorin Café ERP — Data Classification & Field Minimisation Utility
 *
 * Enforces DPDP Act compliance, role-based field access, and sensitive data masking
 * according to dataClassification.json definitions.
 */

const dataClassification = require('../config/dataClassification.json');

function getFieldClassification(fieldPath) {
  for (const [tierName, config] of Object.entries(dataClassification.tiers)) {
    if (config.fields && config.fields.includes(fieldPath)) {
      return { tier: tierName, ...config };
    }
  }
  return { tier: 'INTERNAL', ...dataClassification.tiers.INTERNAL };
}

function sanitizeRecordByRole(record, role = 'STAFF') {
  if (!record || typeof record !== 'object') return record;
  const copy = Array.isArray(record) ? [...record] : { ...record };

  // Always strip HIGHLY_SENSITIVE fields
  delete copy.password;
  delete copy.passwordHash;
  delete copy.pin;
  delete copy.token;
  delete copy.accessToken;
  delete copy.refreshToken;
  delete copy.deviceTokenHash;

  // Mask PII if role is not MASTER or OWNER
  if (role !== 'MASTER' && role !== 'OWNER') {
    if (copy.aadhaar) copy.aadhaar = 'XXXXXXXX' + String(copy.aadhaar).slice(-4);
    if (copy.pan) copy.pan = 'XXXXX' + String(copy.pan).slice(-4);
    if (copy.salary) delete copy.salary;
  }

  return copy;
}

module.exports = {
  dataClassification,
  getFieldClassification,
  sanitizeRecordByRole,
};
