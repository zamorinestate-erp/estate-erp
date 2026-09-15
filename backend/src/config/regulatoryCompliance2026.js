'use strict';

/**
 * ============================================================================
 * ZAMORIN CAFÉ ERP — REGULATORY COMPLIANCE 2026 CONFIGURATION & VALIDATORS
 * ============================================================================
 * Centralized, testable regulatory rules for FSSAI 2026 Perpetual Regime,
 * Indian GSTIN & State Code Jurisdictions, and Financial Year Sequencing.
 */

// ---------------------------------------------------------------------------
// 1. CANONICAL INDIAN STATE CODES (GST State Codes)
// ---------------------------------------------------------------------------
const INDIAN_STATE_CODES = Object.freeze({
  '01': { code: '01', name: 'Jammu and Kashmir', type: 'UT' },
  '02': { code: '02', name: 'Himachal Pradesh', type: 'STATE' },
  '03': { code: '03', name: 'Punjab', type: 'STATE' },
  '04': { code: '04', name: 'Chandigarh', type: 'UT' },
  '05': { code: '05', name: 'Uttarakhand', type: 'STATE' },
  '06': { code: '06', name: 'Haryana', type: 'STATE' },
  '07': { code: '07', name: 'Delhi', type: 'UT' },
  '08': { code: '08', name: 'Rajasthan', type: 'STATE' },
  '09': { code: '09', name: 'Uttar Pradesh', type: 'STATE' },
  '10': { code: '10', name: 'Bihar', type: 'STATE' },
  '11': { code: '11', name: 'Sikkim', type: 'STATE' },
  '12': { code: '12', name: 'Arunachal Pradesh', type: 'STATE' },
  '13': { code: '13', name: 'Nagaland', type: 'STATE' },
  '14': { code: '14', name: 'Manipur', type: 'STATE' },
  '15': { code: '15', name: 'Mizoram', type: 'STATE' },
  '16': { code: '16', name: 'Tripura', type: 'STATE' },
  '17': { code: '17', name: 'Meghalaya', type: 'STATE' },
  '18': { code: '18', name: 'Assam', type: 'STATE' },
  '19': { code: '19', name: 'West Bengal', type: 'STATE' },
  '20': { code: '20', name: 'Jharkhand', type: 'STATE' },
  '21': { code: '21', name: 'Odisha', type: 'STATE' },
  '22': { code: '22', name: 'Chhattisgarh', type: 'STATE' },
  '23': { code: '23', name: 'Madhya Pradesh', type: 'STATE' },
  '24': { code: '24', name: 'Gujarat', type: 'STATE' },
  '25': { code: '25', name: 'Daman and Diu', type: 'UT' },
  '26': { code: '26', name: 'Dadra and Nagar Haveli', type: 'UT' },
  '27': { code: '27', name: 'Maharashtra', type: 'STATE' },
  '28': { code: '28', name: 'Andhra Pradesh (Old)', type: 'STATE' },
  '29': { code: '29', name: 'Karnataka', type: 'STATE' },
  '30': { code: '30', name: 'Goa', type: 'STATE' },
  '31': { code: '31', name: 'Lakshadweep', type: 'UT' },
  '32': { code: '32', name: 'Kerala', type: 'STATE' },
  '33': { code: '33', name: 'Tamil Nadu', type: 'STATE' },
  '34': { code: '34', name: 'Puducherry', type: 'UT' },
  '35': { code: '35', name: 'Andaman and Nicobar Islands', type: 'UT' },
  '36': { code: '36', name: 'Telangana', type: 'STATE' },
  '37': { code: '37', name: 'Andhra Pradesh', type: 'STATE' },
  '38': { code: '38', name: 'Ladakh', type: 'UT' },
});

function resolveStateByCode(code) {
  if (!code) return null;
  const clean = String(code).trim().padStart(2, '0');
  return INDIAN_STATE_CODES[clean] || null;
}

function resolveStateByName(name) {
  if (!name || typeof name !== 'string') return null;
  const target = name.trim().toLowerCase();
  for (const entry of Object.values(INDIAN_STATE_CODES)) {
    if (entry.name.toLowerCase() === target) {
      return entry;
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// 2. GSTIN VALIDATION & STATUS SPECIFICATION
// ---------------------------------------------------------------------------
const GSTIN_REGEX = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;

const GST_VERIFICATION_STATUSES = Object.freeze([
  'FORMAT_VALIDATED',
  'DOCUMENT_PROVIDED',
  'EXTERNALLY_VERIFIED',
]);

function validateGstinFormat(gstin, expectedStateCode = null) {
  const clean = String(gstin || '').trim().toUpperCase();
  if (!clean) {
    return { valid: false, reason: 'GSTIN is required.' };
  }
  if (clean.length !== 15) {
    return { valid: false, reason: 'GSTIN must be exactly 15 characters.' };
  }
  if (!GSTIN_REGEX.test(clean)) {
    return { valid: false, reason: 'Invalid GSTIN format structure.' };
  }

  const gstinStateCode = clean.substring(0, 2);
  const stateRecord = resolveStateByCode(gstinStateCode);
  if (!stateRecord) {
    return { valid: false, reason: `Unknown State code '${gstinStateCode}' in GSTIN.` };
  }

  if (expectedStateCode) {
    const expected = String(expectedStateCode).trim().padStart(2, '0');
    if (gstinStateCode !== expected) {
      return {
        valid: false,
        reason: `GSTIN State code '${gstinStateCode}' does not match location State code '${expected}'.`,
      };
    }
  }

  return {
    valid: true,
    cleanGstin: clean,
    stateCode: gstinStateCode,
    stateName: stateRecord.name,
    pan: clean.substring(2, 12),
  };
}

// ---------------------------------------------------------------------------
// 3. FSSAI 2026 REGULATORY FRAMEWORK (TURNOVER SLABS & PERPETUAL REGIME)
// ---------------------------------------------------------------------------
const FSSAI_2026_CATEGORIES = Object.freeze({
  REGISTRATION: {
    key: 'REGISTRATION',
    displayName: 'FSSAI Registration (Petty Food Business)',
    maxTurnoverInr: 15000000, // Up to ₹1.5 crore
    minTurnoverInr: 0,
    description: 'Turnover up to ₹1.5 crore',
    isPerpetual: true,
  },
  STATE_LICENCE: {
    key: 'STATE_LICENCE',
    displayName: 'FSSAI State Licence',
    minTurnoverInr: 15000001, // Above ₹1.5 crore
    maxTurnoverInr: 500000000, // Up to ₹50 crore
    description: 'Above ₹1.5 crore and up to ₹50 crore',
    isPerpetual: true,
  },
  CENTRAL_LICENCE: {
    key: 'CENTRAL_LICENCE',
    displayName: 'FSSAI Central Licence',
    minTurnoverInr: 500000001, // Above ₹50 crore
    maxTurnoverInr: Infinity,
    description: 'Above ₹50 crore',
    isPerpetual: true,
  },
});

const FSSAI_STATUSES = Object.freeze([
  'ACTIVE',
  'SUSPENDED',
  'CANCELLED',
  'SURRENDERED',
  'UNDER_REVIEW',
]);

function determineFssaiCategoryByTurnover(annualTurnoverInr) {
  const amount = Number(annualTurnoverInr);
  if (isNaN(amount) || amount < 0) {
    return FSSAI_2026_CATEGORIES.REGISTRATION;
  }
  if (amount <= 15000000) {
    return FSSAI_2026_CATEGORIES.REGISTRATION;
  }
  if (amount <= 500000000) {
    return FSSAI_2026_CATEGORIES.STATE_LICENCE;
  }
  return FSSAI_2026_CATEGORIES.CENTRAL_LICENCE;
}

function validateFssaiNumber(number) {
  const clean = String(number || '').trim();
  if (!clean) {
    return { valid: false, reason: 'FSSAI number is required.' };
  }
  if (!/^\d{14}$/.test(clean)) {
    return { valid: false, reason: 'FSSAI number must be exactly 14 digits.' };
  }
  return { valid: true, fssaiNumber: clean };
}

// ---------------------------------------------------------------------------
// 4. FINANCIAL YEAR & SEQUENCE IDENTITY HELPER
// ---------------------------------------------------------------------------
function resolveFinancialYear(date = new Date()) {
  const d = new Date(date);
  const year = d.getFullYear();
  const month = d.getMonth() + 1; // 1-12
  const startYear = month >= 4 ? year : year - 1;
  const endYear = startYear + 1;
  const shortEnd = String(endYear).slice(-2);
  return {
    financialYear: `${startYear}-${endYear}`, // e.g. '2026-2027'
    fyShort: `${startYear}-${shortEnd}`,     // e.g. '2026-27'
    startYear,
    endYear,
  };
}

module.exports = {
  INDIAN_STATE_CODES,
  resolveStateByCode,
  resolveStateByName,
  GSTIN_REGEX,
  GST_VERIFICATION_STATUSES,
  validateGstinFormat,
  FSSAI_2026_CATEGORIES,
  FSSAI_STATUSES,
  determineFssaiCategoryByTurnover,
  validateFssaiNumber,
  resolveFinancialYear,
};
