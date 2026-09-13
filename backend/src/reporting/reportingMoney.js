'use strict';

/**
 * ZAMORIN CAFÉ ERP — REPORTING FOUNDATION
 * Module: reportingMoney.js
 * 
 * Canonical monetary representation standard:
 * - Integer paise (INR_PAISE) as authoritative calculation unit.
 * - Zero floating-point rupee additions/subtractions in financial calculations.
 * - Strict presentation-boundary rounding.
 * - No parsing of formatted currency strings as calculation sources.
 */

/**
 * Converts integer paise to decimal rupees with fixed decimal places.
 * @param {number|null|undefined} paisa
 * @param {number} [decimals=2]
 * @returns {number}
 */
function paisaToRupees(paisa, decimals = 2) {
  if (paisa === null || paisa === undefined || Number.isNaN(paisa)) return 0;
  return Number((Number(paisa) / 100).toFixed(decimals));
}

/**
 * Converts decimal rupees to integer paise.
 * @param {number|null|undefined} rupees
 * @returns {number}
 */
function rupeesToPaisa(rupees) {
  if (rupees === null || rupees === undefined || Number.isNaN(rupees)) return 0;
  return Math.round(Number(rupees) * 100);
}

/**
 * Formats integer paise into Indian currency string (₹X,XX,XXX.XX).
 * @param {number|null|undefined} paisa
 * @param {boolean} [includeSymbol=true]
 * @returns {string}
 */
function formatInr(paisa, includeSymbol = true) {
  const numPaisa = Number(paisa || 0);
  const isNegative = numPaisa < 0;
  const absRupees = Math.abs(numPaisa) / 100;
  const formatted = absRupees.toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  const prefix = isNegative ? '-' : '';
  const symbol = includeSymbol ? '₹' : '';
  return `${prefix}${symbol}${formatted}`;
}

/**
 * Formats integer paise into a compact representation (e.g. ₹1.25L, ₹45.5K, ₹850).
 * @param {number|null|undefined} paisa
 * @returns {string}
 */
function formatInrShort(paisa) {
  const numPaisa = Number(paisa || 0);
  const rupees = numPaisa / 100;
  const abs = Math.abs(rupees);
  const sign = numPaisa < 0 ? '-' : '';

  if (abs >= 10000000) {
    return `${sign}₹${(abs / 10000000).toFixed(2)} Cr`;
  }
  if (abs >= 100000) {
    return `${sign}₹${(abs / 100000).toFixed(2)} L`;
  }
  if (abs >= 1000) {
    return `${sign}₹${(abs / 1000).toFixed(1)} K`;
  }
  return `${sign}₹${Math.round(abs).toLocaleString('en-IN')}`;
}

/**
 * Calculates a percentage from integer paise components.
 * @param {number} partPaisa
 * @param {number} totalPaisa
 * @param {number} [decimals=1]
 * @returns {number|null} Returns 0.0 if total is 0.
 */
function calculatePercentage(partPaisa, totalPaisa, decimals = 1) {
  const total = Number(totalPaisa || 0);
  if (total === 0) return 0.0;
  const part = Number(partPaisa || 0);
  return Number(((part / total) * 100).toFixed(decimals));
}

/**
 * Calculates a ratio (e.g. Sales per Labour Hour).
 * @param {number} numerator
 * @param {number} denominator
 * @param {number} [decimals=2]
 * @returns {number}
 */
function calculateRatio(numerator, denominator, decimals = 2) {
  const denom = Number(denominator || 0);
  if (denom === 0) return 0.0;
  return Number((Number(numerator || 0) / denom).toFixed(decimals));
}

/**
 * Safely sums integer paise values.
 * @param  {...number} amounts
 * @returns {number}
 */
function addPaisa(...amounts) {
  return amounts.reduce((acc, curr) => acc + Math.round(Number(curr || 0)), 0);
}

/**
 * Safely subtracts integer paise values.
 * @param {number} minuend
 * @param  {...number} subtrahends
 * @returns {number}
 */
function subtractPaisa(minuend, ...subtrahends) {
  const base = Math.round(Number(minuend || 0));
  const deductions = subtrahends.reduce((acc, curr) => acc + Math.round(Number(curr || 0)), 0);
  return base - deductions;
}

/**
 * Reconstructs Gross Sales for a Bill following the authoritative hierarchy:
 * A) Current Bill: If subtotalPaisa exists and is authoritative -> subtotalPaisa
 * B) Legacy Bill with line items -> SUM(lineItems[].lineSubtotalPaisa)
 * C) Legacy Bill with taxableAmountPaisa AND stored discountPaisa -> taxableAmountPaisa + discountPaisa
 * D) Legacy Bill with totalPaisa, taxPaisa, and discountPaisa -> totalPaisa - taxPaisa + discountPaisa
 * E) Insufficient fields -> returns null, warning: 'LEGACY_BILL_INSUFFICIENT_GROSS_SALES_FIELDS'
 *
 * @param {object} bill - Bill document or plain object
 * @returns {{ grossSalesPaisa: number|null, quality: string, method: string, warning: string|null }}
 */
function reconstructGrossSales(bill) {
  if (!bill) {
    return { grossSalesPaisa: null, quality: 'UNAVAILABLE', method: 'NONE', warning: 'BILL_REQUIRED' };
  }

  // Hierarchy A: Current Bill with authoritative subtotalPaisa
  if (typeof bill.subtotalPaisa === 'number' && !Number.isNaN(bill.subtotalPaisa) && bill.subtotalPaisa >= 0) {
    return { grossSalesPaisa: Math.round(bill.subtotalPaisa), quality: 'COMPLETE', method: 'SUBTOTAL_PAISA', warning: null };
  }

  // Hierarchy B: Legacy Bill with line items containing lineSubtotalPaisa
  if (Array.isArray(bill.lineItems) && bill.lineItems.length > 0) {
    const hasValidLines = bill.lineItems.every(
      (li) => typeof li.lineSubtotalPaisa === 'number' && !Number.isNaN(li.lineSubtotalPaisa)
    );
    if (hasValidLines) {
      const sum = bill.lineItems.reduce((acc, li) => acc + Math.round(li.lineSubtotalPaisa), 0);
      return { grossSalesPaisa: sum, quality: 'COMPLETE', method: 'LINE_SUBTOTALS_SUM', warning: null };
    }
  }

  // Hierarchy C: Legacy Bill with taxableAmountPaisa AND stored discountPaisa
  // Source semantics: taxableAmountPaisa = subtotalPaisa - discountPaisa => subtotalPaisa = taxableAmountPaisa + discountPaisa
  const hasTaxable = typeof bill.taxableAmountPaisa === 'number' && !Number.isNaN(bill.taxableAmountPaisa);
  const hasDiscount = typeof bill.discountPaisa === 'number' && !Number.isNaN(bill.discountPaisa);
  if (hasTaxable && hasDiscount) {
    const reconstructed = Math.round(bill.taxableAmountPaisa) + Math.round(bill.discountPaisa);
    return { grossSalesPaisa: reconstructed, quality: 'COMPLETE', method: 'TAXABLE_PLUS_DISCOUNT', warning: null };
  }

  // Hierarchy D: Legacy Bill with totalPaisa, taxPaisa, and discountPaisa
  // Source semantics: totalPaisa = subtotalPaisa - discountPaisa + taxPaisa => subtotalPaisa = totalPaisa - taxPaisa + discountPaisa
  const hasTotal = typeof bill.totalPaisa === 'number' && !Number.isNaN(bill.totalPaisa);
  const hasTax = typeof bill.taxPaisa === 'number' && !Number.isNaN(bill.taxPaisa);
  if (hasTotal && hasTax && hasDiscount) {
    const reconstructed = Math.round(bill.totalPaisa) - Math.round(bill.taxPaisa) + Math.round(bill.discountPaisa);
    return { grossSalesPaisa: reconstructed, quality: 'COMPLETE', method: 'TOTAL_MINUS_TAX_PLUS_DISCOUNT', warning: null };
  }

  // Hierarchy E: Insufficient legacy data. Do NOT estimate. Do NOT use tax rate divisor.
  return {
    grossSalesPaisa: null,
    quality: 'PARTIAL',
    method: 'INSUFFICIENT_DATA',
    warning: 'LEGACY_BILL_INSUFFICIENT_GROSS_SALES_FIELDS',
  };
}

/**
 * Computes canonical Gross-to-Net Sales Bridge for a bill or aggregated period:
 * Gross Sales
 * - Discounts
 * - Pre-Tax Returns / Refunds
 * = Net Sales
 *
 * @param {object} params
 * @param {number} params.grossSalesPaisa
 * @param {number} [params.discountPaisa=0]
 * @param {number} [params.preTaxRefundPaisa=0]
 * @returns {{ grossSalesPaisa: number, discountPaisa: number, salesBeforeTaxPaisa: number, preTaxRefundPaisa: number, netSalesPaisa: number, isValid: boolean }}
 */
function computeGrossToNetBridge({ grossSalesPaisa, discountPaisa = 0, preTaxRefundPaisa = 0 }) {
  const gross = Math.round(Number(grossSalesPaisa || 0));
  const disc = Math.round(Number(discountPaisa || 0));
  const refund = Math.round(Number(preTaxRefundPaisa || 0));

  const salesBeforeTax = Math.max(0, gross - disc);
  const netSales = Math.max(0, salesBeforeTax - refund);

  // Invariant: Net Sales cannot exceed Gross Sales under ordinary non-adjustment conditions
  const isValid = netSales <= gross;

  return {
    grossSalesPaisa: gross,
    discountPaisa: disc,
    salesBeforeTaxPaisa: salesBeforeTax,
    preTaxRefundPaisa: refund,
    netSalesPaisa: netSales,
    isValid,
  };
}

module.exports = {
  paisaToRupees,
  rupeesToPaisa,
  formatInr,
  formatRupees: formatInr,
  formatInrShort,
  calculatePercentage,
  calculateRatio,
  addPaisa,
  subtractPaisa,
  reconstructGrossSales,
  computeGrossToNetBridge,
};
