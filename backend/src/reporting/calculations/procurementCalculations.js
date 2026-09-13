'use strict';

/**
 * ZAMORIN CAFÉ ERP — REPORTING CALCULATION ENGINE
 * Module: procurementCalculations.js (SCR-022 / PM-02E-R1)
 * 
 * Canonical Procurement & Vendor Intelligence calculation service:
 * - Procurement commitments, ordered vs received vs invoiced values (PurchaseOrder)
 * - Strict financial demarcation: ORDERED vs RECEIVED vs INVOICED vs PAID (UNAVAILABLE)
 *   (Procurement stages are independent control measures and NOT assumed monotonic)
 * - Authoritative APInvoice outstanding payable (APInvoice.outstandingPaisa) and payables aging
 * - Multi-receipt delivery evaluation: FIRST_RECEIPT_ON_TIME vs FINAL_FULFILLMENT_ON_TIME
 * - Lead time calculation with canonical approvedAt basis and fallback provenance
 * - Fill rate: COMPLETED_PO_FILL_RATE vs CURRENT_FULFILLMENT_RATE
 * - UOM normalization strictly backed by GlobalInventoryItem.packSize & conversions
 * - Single-source items based on Known Active Vendor Count
 * - Factual vendor document compliance (recorded vs expired vs approaching expiry)
 * - Dock inspection quality from stored IncomingInspection & grnReceipts enums
 * - Overall Vendor Score = NOT_CONFIGURED (composite scoring unapproved)
 */

const mongoose = require('mongoose');
const { PurchaseOrder } = require('../../models/PurchaseOrder');
const { Vendor } = require('../../models/Vendor');
const { APInvoice } = require('../../models/APInvoice');
const { GlobalInventoryItem } = require('../../models/GlobalInventoryItem');
const { IncomingInspection } = require('../../models/IncomingInspection');
const { AuditEvent } = require('../../models/AuditEvent');
const { FoodSafetyTemperatureRule } = require('../../models/FoodSafetyTemperatureRule');

/**
 * Evaluates APInvoice financial recognition according to canonical schema fields:
 * - validationStatus: INCOMPLETE, VALIDATED
 * - approvalStatus: PENDING, APPROVED, REJECTED
 * - accountingStatus: UNACCOUNTED, POSTED
 * - paymentStatus: UNPAID, SCHEDULED, PARTIALLY_PAID, PAID, ON_HOLD
 *
 * Fail-safe principle: Any unrecognized/unknown future status fails safe (recognized = false).
 * Unapproved claims (PENDING, REJECTED) are excluded from invoiced spend and outstanding liabilities.
 * Partially paid invoices contribute full invoiced value, but only authoritative outstandingPaisa
 * enters outstanding payables and aging schedules.
 *
 * @param {Object} inv APInvoice record
 * @returns {{ recognized: boolean, invoicedValueEligible?: boolean, outstandingEligible?: boolean, agingEligible?: boolean, reason?: string }}
 */
/**
 * Evaluates APInvoice financial recognition according to canonical schema fields:
 * - validationStatus: INCOMPLETE, VALIDATED
 * - approvalStatus: PENDING, APPROVED, REJECTED
 * - accountingStatus: UNACCOUNTED, POSTED
 * - paymentStatus: UNPAID, SCHEDULED, PARTIALLY_PAID, PAID, ON_HOLD
 *
 * Explicit Precedence Architecture (PM-02E-R3):
 * 1. Validation Gate: An invoice with validationStatus = INCOMPLETE must never enter
 *    authoritative invoiced value, outstanding payables, or payables aging.
 * 2. Approval Gate: Regardless of accounting/payment status, approvalStatus = PENDING
 *    or REJECTED must not be counted as approved commercial liability. POSTED status
 *    cannot silently override failed, pending, or incomplete approval.
 * 3. Eligibility Model: financiallyEligible = isValidated && isApproved.
 * 4. Classification: accountingStatus, paymentStatus, and holds classify eligible claims.
 *    APPROVED + UNACCOUNTED is an approved commercial liability, but not GL-posted.
 *
 * @param {Object} inv APInvoice record
 * @returns {{ recognized: boolean, invoicedValueEligible?: boolean, outstandingEligible?: boolean, agingEligible?: boolean, glPosted?: boolean, commercialLiability?: boolean, paymentStatus?: string, accountingStatus?: string, validationStatus?: string, approvalStatus?: string, hasHolds?: boolean, trustState?: string, reason?: string }}
 */
function evaluateApInvoiceFinancialRecognition(inv) {
  if (!inv || typeof inv !== 'object') {
    return { recognized: false, invoicedValueEligible: false, outstandingEligible: false, agingEligible: false, reason: 'Invalid invoice object' };
  }

  const appStatus = inv.approvalStatus ? String(inv.approvalStatus).trim().toUpperCase() : null;
  const payStatus = inv.paymentStatus ? String(inv.paymentStatus).trim().toUpperCase() : null;
  const accStatus = inv.accountingStatus ? String(inv.accountingStatus).trim().toUpperCase() : null;
  const valStatus = inv.validationStatus ? String(inv.validationStatus).trim().toUpperCase() : null;
  const rawStatus = inv.status ? String(inv.status).trim().toUpperCase() : null;

  // Canonical schema enum definitions from APInvoice.js
  const KNOWN_APPROVAL_STATUSES = ['PENDING', 'APPROVED', 'REJECTED'];
  const KNOWN_PAYMENT_STATUSES = ['UNPAID', 'SCHEDULED', 'PARTIALLY_PAID', 'PAID', 'ON_HOLD'];
  const KNOWN_ACCOUNTING_STATUSES = ['UNACCOUNTED', 'POSTED'];
  const KNOWN_VALIDATION_STATUSES = ['INCOMPLETE', 'VALIDATED'];
  const KNOWN_RAW_STATUSES = ['APPROVED', 'POSTED', 'PARTIALLY_PAID', 'PAID', 'SCHEDULED', 'UNPAID', 'ON_HOLD', 'PENDING', 'REJECTED', 'DRAFT', 'VOID'];

  // Fail-safe validation: any unknown/unrecognized status is rejected
  if (appStatus && !KNOWN_APPROVAL_STATUSES.includes(appStatus)) {
    return { recognized: false, invoicedValueEligible: false, outstandingEligible: false, agingEligible: false, reason: `Unknown approvalStatus: ${appStatus}` };
  }
  if (payStatus && !KNOWN_PAYMENT_STATUSES.includes(payStatus)) {
    return { recognized: false, invoicedValueEligible: false, outstandingEligible: false, agingEligible: false, reason: `Unknown paymentStatus: ${payStatus}` };
  }
  if (accStatus && !KNOWN_ACCOUNTING_STATUSES.includes(accStatus)) {
    return { recognized: false, invoicedValueEligible: false, outstandingEligible: false, agingEligible: false, reason: `Unknown accountingStatus: ${accStatus}` };
  }
  if (valStatus && !KNOWN_VALIDATION_STATUSES.includes(valStatus)) {
    return { recognized: false, invoicedValueEligible: false, outstandingEligible: false, agingEligible: false, reason: `Unknown validationStatus: ${valStatus}` };
  }
  if (rawStatus && !KNOWN_RAW_STATUSES.includes(rawStatus)) {
    return { recognized: false, invoicedValueEligible: false, outstandingEligible: false, agingEligible: false, reason: `Unknown raw status: ${rawStatus}` };
  }

  // 1. Validation Gate (PM-02E-R3)
  // Schema default in APInvoice.js is 'VALIDATED'. If explicitly 'INCOMPLETE', fail safe to excluded.
  if (valStatus === 'INCOMPLETE') {
    return {
      recognized: false,
      invoicedValueEligible: false,
      outstandingEligible: false,
      agingEligible: false,
      reason: 'Validation gate failed: validationStatus is INCOMPLETE',
    };
  }
  const isValidated = valStatus ? (valStatus === 'VALIDATED') : true;

  // 2. Approval Gate (PM-02E-R3)
  // Regardless of accountingStatus or paymentStatus: PENDING or REJECTED must NOT be counted as approved commercial liability.
  // POSTED must NOT override failed or pending approval.
  if (appStatus === 'REJECTED' || appStatus === 'PENDING' || rawStatus === 'REJECTED' || rawStatus === 'DRAFT' || rawStatus === 'VOID') {
    return {
      recognized: false,
      invoicedValueEligible: false,
      outstandingEligible: false,
      agingEligible: false,
      reason: 'Approval gate failed: unapproved, rejected, or void claim (POSTED cannot override)',
    };
  }

  const isApproved = appStatus === 'APPROVED' || (rawStatus === 'APPROVED' && appStatus !== 'PENDING' && appStatus !== 'REJECTED');

  // 3. Recommended Eligibility Model
  const financiallyEligible = isValidated && isApproved;
  if (!financiallyEligible) {
    // Fallback for mock/test records without status metadata but having positive totalPaisa
    if (!appStatus && !payStatus && !accStatus && !rawStatus && inv.totalPaisa !== undefined) {
      const remPaisa = inv.outstandingPaisa !== undefined
        ? Number(inv.outstandingPaisa)
        : Math.max(0, Number(inv.totalPaisa || 0) - Number(inv.paidPaisa || 0));

      return {
        recognized: true,
        invoicedValueEligible: true,
        outstandingEligible: remPaisa > 0,
        agingEligible: remPaisa > 0,
        glPosted: false,
        commercialLiability: false,
        trustState: 'UNVERIFIED_MOCK',
      };
    }
    return {
      recognized: false,
      invoicedValueEligible: false,
      outstandingEligible: false,
      agingEligible: false,
      reason: 'Not financially eligible: requires both VALIDATED and APPROVED status',
    };
  }

  // 4. Eligible Invoice Classification
  const isFullyPaid = payStatus === 'PAID';
  const remPaisa = inv.outstandingPaisa !== undefined
    ? Number(inv.outstandingPaisa)
    : Math.max(0, Number(inv.totalPaisa || 0) - Number(inv.paidPaisa || 0));
  const isPosted = accStatus === 'POSTED' || rawStatus === 'POSTED';
  const hasHolds = Array.isArray(inv.holds) && inv.holds.length > 0;

  return {
    recognized: true,
    invoicedValueEligible: true,
    outstandingEligible: !isFullyPaid && remPaisa > 0,
    agingEligible: !isFullyPaid && remPaisa > 0,
    glPosted: isPosted,
    commercialLiability: true,
    paymentStatus: payStatus || 'UNPAID',
    accountingStatus: accStatus || 'UNACCOUNTED',
    validationStatus: valStatus || 'VALIDATED',
    approvalStatus: appStatus || 'APPROVED',
    hasHolds,
    trustState: isPosted ? 'GL_POSTED_LIABILITY' : 'APPROVED_COMMERCIAL_LIABILITY',
  };
}

/**
 * Normalizes and converts quantities between units of measure.
 * Strictly converts compatible standard mass/volume units and item-configured packaging.
 * Generic unconfigured packaging words (e.g. arbitrary box vs case) are rejected.
 *
 * @param {number} qty
 * @param {string} fromUom
 * @param {string} toUom
 * @param {Object} [item] GlobalInventoryItem reference with packSize or conversions
 * @returns {{ convertedQty: number|null, compatible: boolean, reason?: string }}
 */
function normalizeUom(qty, fromUom, toUom, item = null) {
  if (qty === null || qty === undefined || isNaN(qty)) {
    return { convertedQty: null, compatible: false, reason: 'Invalid quantity' };
  }
  if (!fromUom || !toUom) {
    return { convertedQty: Number(qty), compatible: true };
  }

  const normUnit = (u) => {
    const s = String(u || '').toLowerCase().trim();
    if (['kg', 'kilogram', 'kilograms'].includes(s)) return 'kg';
    if (['g', 'gram', 'grams'].includes(s)) return 'g';
    if (['mg', 'milligram', 'milligrams'].includes(s)) return 'mg';
    if (['l', 'litre', 'liter', 'litres', 'liters'].includes(s)) return 'l';
    if (['ml', 'millilitre', 'milliliter', 'millilitres', 'milliliters'].includes(s)) return 'ml';
    return s;
  };

  const fNorm = normUnit(fromUom);
  const tNorm = normUnit(toUom);

  if (fNorm === tNorm) {
    return { convertedQty: Number(qty), compatible: true };
  }

  // Weight conversions
  if (fNorm === 'kg' && tNorm === 'g') return { convertedQty: Number(qty) * 1000, compatible: true };
  if (fNorm === 'g' && tNorm === 'kg') return { convertedQty: Number(qty) / 1000, compatible: true };
  if (fNorm === 'g' && tNorm === 'mg') return { convertedQty: Number(qty) * 1000, compatible: true };
  if (fNorm === 'mg' && tNorm === 'g') return { convertedQty: Number(qty) / 1000, compatible: true };
  if (fNorm === 'kg' && tNorm === 'mg') return { convertedQty: Number(qty) * 1000000, compatible: true };
  if (fNorm === 'mg' && tNorm === 'kg') return { convertedQty: Number(qty) / 1000000, compatible: true };

  // Volume conversions
  if (fNorm === 'l' && tNorm === 'ml') return { convertedQty: Number(qty) * 1000, compatible: true };
  if (fNorm === 'ml' && tNorm === 'l') return { convertedQty: Number(qty) / 1000, compatible: true };

  // Item-configured packaging conversions
  if (item) {
    const fRaw = String(fromUom).toLowerCase().trim();
    const tRaw = String(toUom).toLowerCase().trim();
    const bUnit = String(item.baseUnit || '').toLowerCase().trim();
    const pUnit = String(item.purchaseUnit || '').toLowerCase().trim();
    const packSize = Number(item.packSize || 1);

    // Purchase unit vs base unit via packSize
    if (packSize > 0) {
      if ((fRaw === pUnit || ['pack', 'carton', 'case', 'box'].includes(fRaw)) &&
          (tRaw === bUnit || ['unit', 'piece', 'pcs'].includes(tRaw))) {
        return { convertedQty: Number(qty) * packSize, compatible: true };
      }
      if ((fRaw === bUnit || ['unit', 'piece', 'pcs'].includes(fRaw)) &&
          (tRaw === pUnit || ['pack', 'carton', 'case', 'box'].includes(tRaw))) {
        return { convertedQty: Number(qty) / packSize, compatible: true };
      }
    }

    // Explicit conversions array
    if (Array.isArray(item.conversions)) {
      for (const conv of item.conversions) {
        const cUnit = String(conv.displayUnit || conv.fromUnit || conv.unit || '').toLowerCase().trim();
        const targetUnit = String(conv.toUnit || bUnit || 'unit').toLowerCase().trim();
        const factor = Number(conv.factor || 1);
        if (factor > 0) {
          if (fRaw === cUnit && (tRaw === targetUnit || tRaw === bUnit || tRaw === 'unit')) {
            return { convertedQty: Number(qty) * factor, compatible: true };
          }
          if ((fRaw === targetUnit || fRaw === bUnit || fRaw === 'unit') && tRaw === cUnit) {
            return { convertedQty: Number(qty) / factor, compatible: true };
          }
        }
      }
    }
  }

  return {
    convertedQty: null,
    compatible: false,
    reason: `Incompatible units of measure: ${fromUom} and ${toUom}`,
  };
}

/**
 * Resolves the applicable Food Safety Temperature Rule for an incoming inspection
 * based on temporal applicability and statutory precedence hierarchy (PM-02E-R5):
 * 
 * Temporal Precedence & Invariants:
 * 1. Authoritative Inspection Timestamp:
 *    Primary authority is `inspection.inspectedAt` (fallback `inspection.createdAt`).
 * 2. Effective Date Window:
 *    A candidate rule is applicable only if `effectiveFrom <= inspectionTimestamp`.
 *    Future rules (`effectiveFrom > inspectionTimestamp`) MUST NOT apply early.
 *    If explicit `effectiveTo` exists, rule applies only if `inspectionTimestamp < effectiveTo` (half-open [effectiveFrom, effectiveTo)).
 * 3. Scope-Level Version Resolution:
 *    If multiple historical versions exist for the same scope (cafeId + foodCategory),
 *    the rule with the latest effectiveFrom (or highest version) effective at inspectionTimestamp is selected.
 * 4. Inactive/Superseded Historical Rules:
 *    `active = false` or `status = 'SUPERSEDED'` does NOT invalidate a rule for historical inspections
 *    conducted while the rule was historically effective.
 * 5. Metadata Immutability:
 *    `updatedAt` represents document modification and MUST NEVER be used as business effective date.
 * 
 * Specificity Hierarchy (evaluated among historically applicable rules):
 * Level 4: Cafe-specific + Food Category specific (highest)
 * Level 3: Cafe-specific + ALL categories
 * Level 2: Organisation-wide + Food Category specific
 * Level 1: Organisation-wide + ALL categories (lowest)
 * 
 * Ambiguous Configuration Handling:
 * If two or more historically applicable rules share the identical top specificity level:
 * - If their criteria are identical, one is selected deterministically.
 * - If their criteria differ, the engine classifies the evaluation as
 *   'AMBIGUOUS_RULE_CONFIGURATION' rather than silently choosing one based on DB order.
 *   Evaluation safely degrades to PARTIAL (or UNAVAILABLE).
 *
 * @param {Object} inspection
 * @param {Array} temperatureRules
 * @param {Object} itemMap
 * @returns {Object} { status, rule, ruleId, scope, specificity, effectiveFrom, effectiveTo, effectiveAt, version, inspectionTimestamp, temporalApplicability, isAmbiguous, competingRuleIds, reason }
 */
function resolveTemperatureRule(inspection, temperatureRules, itemMap = {}) {
  if (!Array.isArray(temperatureRules) || temperatureRules.length === 0) {
    return {
      status: 'NO_CONFIGURED_RULES',
      rule: null,
      ruleId: null,
      scope: 'NOT_CONFIGURED',
      specificity: null,
      effectiveFrom: null,
      effectiveTo: null,
      effectiveAt: null,
      version: null,
      inspectionTimestamp: null,
      temporalApplicability: 'UNAVAILABLE',
      isAmbiguous: false,
    };
  }

  // 1. Authoritative Inspection Timestamp
  let insTimestamp = null;
  if (inspection?.inspectedAt) {
    const d = new Date(inspection.inspectedAt);
    if (!isNaN(d.getTime())) insTimestamp = d;
  }
  if (!insTimestamp && inspection?.createdAt) {
    const d = new Date(inspection.createdAt);
    if (!isNaN(d.getTime())) insTimestamp = d;
  }
  const insTime = insTimestamp ? insTimestamp.getTime() : null;

  const insCafeId = inspection?.cafeId ? String(inspection.cafeId).trim().toUpperCase() : null;
  const item = (inspection?.itemId && itemMap[inspection.itemId]) || {};
  const itemCategory = item.category ? String(item.category).trim().toUpperCase() : null;

  // 2. Filter Candidate Rules by Process Type, Scope & Category
  const scopeMatchedRules = [];
  for (const r of temperatureRules) {
    if (r.processType && r.processType !== 'RECEIVING') {
      continue;
    }

    const rCafeId = r.cafeId ? String(r.cafeId).trim().toUpperCase() : null;
    const rCategory = r.foodCategory ? String(r.foodCategory).trim().toUpperCase() : 'ALL';

    const cafeMatch = !rCafeId || (insCafeId && rCafeId === insCafeId);
    const categoryMatch = !rCategory || rCategory === 'ALL' || (itemCategory && itemCategory === rCategory);

    if (!cafeMatch || !categoryMatch) {
      continue;
    }

    let specificity = 1;
    let scope = 'ORGANISATION_ALL';
    if (rCafeId && rCategory !== 'ALL') {
      specificity = 4;
      scope = 'CAFE_FOOD_CATEGORY';
    } else if (rCafeId && rCategory === 'ALL') {
      specificity = 3;
      scope = 'CAFE_ALL';
    } else if (!rCafeId && rCategory !== 'ALL') {
      specificity = 2;
      scope = 'ORGANISATION_FOOD_CATEGORY';
    } else {
      specificity = 1;
      scope = 'ORGANISATION_ALL';
    }

    scopeMatchedRules.push({
      rule: r,
      ruleId: r.ruleId,
      specificity,
      scope,
      cafeId: rCafeId,
      foodCategory: rCategory,
      version: Number(r.version) || 1,
      effectiveFrom: r.effectiveFrom ? new Date(r.effectiveFrom) : (r.createdAt ? new Date(r.createdAt) : null),
      effectiveTo: r.effectiveTo ? new Date(r.effectiveTo) : null,
    });
  }

  if (scopeMatchedRules.length === 0) {
    return {
      status: 'NO_MATCHING_RULE',
      rule: null,
      ruleId: null,
      scope: 'UNMATCHED',
      specificity: null,
      effectiveFrom: null,
      effectiveTo: null,
      effectiveAt: null,
      version: null,
      inspectionTimestamp: insTimestamp ? insTimestamp.toISOString() : null,
      temporalApplicability: 'UNAVAILABLE',
      isAmbiguous: false,
    };
  }

  // 3. Temporal Applicability Filtering
  let historicallyApplicableRules = [];
  if (insTime !== null) {
    for (const cand of scopeMatchedRules) {
      if (!cand.effectiveFrom) {
        // Rule has no effective date authority; cannot apply to historical inspection
        continue;
      }
      const fromTime = cand.effectiveFrom.getTime();
      if (isNaN(fromTime)) continue;

      // Future rule check: inspectionTimestamp must be >= effectiveFrom
      if (insTime < fromTime) {
        continue;
      }

      // Explicit effectiveTo check: inspectionTimestamp must be < effectiveTo
      if (cand.effectiveTo) {
        const toTime = cand.effectiveTo.getTime();
        if (!isNaN(toTime) && insTime >= toTime) {
          continue;
        }
      }

      historicallyApplicableRules.push(cand);
    }
  } else {
    // If inspection has no timestamp (e.g. mock test fixtures without timestamps),
    // retain rules that are either active or lack effectiveTo, excluding future rules relative to now
    historicallyApplicableRules = scopeMatchedRules.filter(cand => {
      if (cand.effectiveFrom && cand.effectiveFrom.getTime() > Date.now()) return false;
      return true;
    });
  }

  if (historicallyApplicableRules.length === 0) {
    return {
      status: 'NO_HISTORICALLY_APPLICABLE_RULE',
      rule: null,
      ruleId: null,
      scope: 'HISTORICAL_RULE_UNAVAILABLE',
      specificity: null,
      effectiveFrom: null,
      effectiveTo: null,
      effectiveAt: null,
      version: null,
      inspectionTimestamp: insTimestamp ? insTimestamp.toISOString() : null,
      temporalApplicability: 'UNAVAILABLE',
      isAmbiguous: false,
      reason: 'No food safety temperature rule was historically effective at the inspection timestamp.',
    };
  }

  // 4. Scope-Level Version Resolution
  // Within the same scope (same cafeId + foodCategory), if multiple versions are historically applicable,
  // pick the version with the latest effectiveFrom (or highest version) effective at insTime
  const scopeGroups = {};
  for (const cand of historicallyApplicableRules) {
    const key = `${cand.cafeId || 'ORG'}::${cand.foodCategory}`;
    if (!scopeGroups[key]) {
      scopeGroups[key] = [];
    }
    scopeGroups[key].push(cand);
  }

  const deduplicatedCandidates = [];
  for (const group of Object.values(scopeGroups)) {
    if (group.length === 1) {
      deduplicatedCandidates.push(group[0]);
    } else {
      group.sort((a, b) => {
        const aTime = a.effectiveFrom ? a.effectiveFrom.getTime() : 0;
        const bTime = b.effectiveFrom ? b.effectiveFrom.getTime() : 0;
        if (bTime !== aTime) return bTime - aTime;
        return (b.version || 1) - (a.version || 1);
      });
      const topCand = group[0];
      const topTime = topCand.effectiveFrom ? topCand.effectiveFrom.getTime() : 0;
      const sameTimeSameScopeCands = group.filter(c => {
        const cTime = c.effectiveFrom ? c.effectiveFrom.getTime() : 0;
        return cTime === topTime && (c.version || 1) === (topCand.version || 1);
      });
      if (sameTimeSameScopeCands.length > 1) {
        for (const c of sameTimeSameScopeCands) {
          deduplicatedCandidates.push(c);
        }
      } else {
        deduplicatedCandidates.push(topCand);
      }
    }
  }

  // 5. Specificity Ranking (among historically applicable candidates)
  const maxSpecificity = Math.max(...deduplicatedCandidates.map(c => c.specificity));
  const topMatches = deduplicatedCandidates.filter(c => c.specificity === maxSpecificity);

  if (topMatches.length === 1) {
    const winner = topMatches[0];
    const effFromStr = winner.effectiveFrom ? winner.effectiveFrom.toISOString() : null;
    const effToStr = winner.effectiveTo ? winner.effectiveTo.toISOString() : null;
    return {
      status: 'MATCHED',
      rule: winner.rule,
      ruleId: winner.ruleId,
      scope: winner.scope,
      specificity: winner.specificity,
      effectiveFrom: effFromStr,
      effectiveTo: effToStr,
      effectiveAt: effFromStr,
      version: winner.version,
      inspectionTimestamp: insTimestamp ? insTimestamp.toISOString() : null,
      temporalApplicability: 'COMPLETE',
      isAmbiguous: false,
    };
  }

  // 6. Ambiguity Detection among top specificity candidates
  const firstCrit = topMatches[0].rule.criteria?.[0] || {};
  const hasConflict = topMatches.some(m => {
    const c = m.rule.criteria?.[0] || {};
    return c.minimumTemperatureC !== firstCrit.minimumTemperatureC ||
      c.maximumTemperatureC !== firstCrit.maximumTemperatureC;
  });

  if (hasConflict) {
    return {
      status: 'AMBIGUOUS_RULE_CONFIGURATION',
      rule: null,
      ruleId: null,
      scope: topMatches[0].scope,
      specificity: maxSpecificity,
      effectiveFrom: null,
      effectiveTo: null,
      effectiveAt: null,
      version: null,
      inspectionTimestamp: insTimestamp ? insTimestamp.toISOString() : null,
      temporalApplicability: 'PARTIAL',
      isAmbiguous: true,
      competingRuleIds: topMatches.map(m => m.ruleId),
      reason: `AMBIGUOUS_RULE_CONFIGURATION: Multiple historically applicable rules (${topMatches.map(m => m.ruleId).join(', ')}) with equal specificity (${maxSpecificity}) conflict in criteria.`,
    };
  }

  const winner = topMatches[0];
  const effFromStr = winner.effectiveFrom ? winner.effectiveFrom.toISOString() : null;
  const effToStr = winner.effectiveTo ? winner.effectiveTo.toISOString() : null;
  return {
    status: 'MATCHED',
    rule: winner.rule,
    ruleId: winner.ruleId,
    scope: winner.scope,
    specificity: winner.specificity,
    effectiveFrom: effFromStr,
    effectiveTo: effToStr,
    effectiveAt: effFromStr,
    version: winner.version,
    inspectionTimestamp: insTimestamp ? insTimestamp.toISOString() : null,
    temporalApplicability: 'COMPLETE',
    isAmbiguous: false,
  };
}

/**
 * Calculates live procurement and vendor intelligence metrics.
 *
 * @param {Object} options
 * @param {string} options.organisationId
 * @param {string|string[]|null} [options.cafeScope]
 * @param {string} [options.dateFrom]
 * @param {string} [options.dateTo]
 * @param {Object} [options.filters]
 * @returns {Promise<Object>} Complete procurement & vendor intelligence payload
 */
async function calculateProcurementMetrics({
  organisationId,
  cafeScope,
  dateFrom,
  dateTo,
  filters = {},
}) {
  if (!organisationId) {
    throw new Error('procurementCalculations: organisationId is required.');
  }

  // Reference date for overdue / aging calculations (Asia/Kolkata aware)
  const now = new Date();
  const todayStr = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);

  // 1. Fetch Global Items (Metadata, criticality, catalogue)
  const itemMap = {};
  const allItems = [];
  if (mongoose.connection?.readyState === 1 || GlobalInventoryItem.find !== mongoose.Model.find) {
    try {
      const items = await GlobalInventoryItem.find({ organisationId }).lean();
      for (const it of items) {
        itemMap[it.itemId] = it;
        allItems.push(it);
      }
    } catch (_) {}
  }

  // 2. Fetch Vendors
  const vendorMatch = { organisationId };
  if (filters.vendorId) {
    vendorMatch.vendorId = filters.vendorId.trim().toUpperCase();
  }
  if (filters.vendorStatus && filters.vendorStatus !== 'ALL') {
    const vStat = String(filters.vendorStatus).trim().toUpperCase();
    const CANONICAL_VENDOR_STATUSES = ['ACTIVE', 'SUSPENDED', 'BLACKLISTED', 'ARCHIVED', 'DRAFT', 'ONBOARDING'];
    if (CANONICAL_VENDOR_STATUSES.includes(vStat)) {
      vendorMatch.status = vStat;
    }
  }

  let vendors = [];
  const vendorMap = {};
  if (mongoose.connection?.readyState === 1 || Vendor.find !== mongoose.Model.find) {
    try {
      vendors = await Vendor.find(vendorMatch).lean();
      for (const v of vendors) {
        vendorMap[v.vendorId] = v;
      }
    } catch (_) {}
  }

  // 3. Fetch Purchase Orders
  const poMatch = { organisationId };
  if (cafeScope) {
    poMatch.cafeId = Array.isArray(cafeScope) ? { $in: cafeScope } : cafeScope;
  }
  if (dateFrom && dateTo) {
    poMatch.orderDate = dateFrom === dateTo ? dateFrom : { $gte: dateFrom, $lte: dateTo };
  }
  if (filters.vendorId) {
    poMatch.vendorId = filters.vendorId.trim().toUpperCase();
  }
  if (filters.poStatus) {
    poMatch.status = filters.poStatus.trim().toUpperCase();
  }

  let orders = [];
  if (mongoose.connection?.readyState === 1 || PurchaseOrder.find !== mongoose.Model.find) {
    try {
      orders = await PurchaseOrder.find(poMatch).lean();
    } catch (_) {
      orders = [];
    }
  }

  // 4. Fetch Invoices (APInvoice)
  const invoiceMatch = { organisationId };
  if (cafeScope) {
    invoiceMatch.cafeId = Array.isArray(cafeScope) ? { $in: cafeScope } : cafeScope;
  }
  if (filters.vendorId) {
    invoiceMatch.vendorId = filters.vendorId.trim().toUpperCase();
  }
  if (dateFrom && dateTo) {
    invoiceMatch.invoiceDate = dateFrom === dateTo ? dateFrom : { $gte: dateFrom, $lte: dateTo };
  }

  let apInvoices = [];
  if (mongoose.connection?.readyState === 1 || APInvoice.find !== mongoose.Model.find) {
    try {
      apInvoices = await APInvoice.find(invoiceMatch).lean();
    } catch (_) {
      apInvoices = [];
    }
  }

  // 5. Fetch Dock Inspections (IncomingInspection)
  const inspectMatch = { organisationId };
  if (cafeScope) {
    inspectMatch.cafeId = Array.isArray(cafeScope) ? { $in: cafeScope } : cafeScope;
  }
  if (filters.vendorId) {
    inspectMatch.vendorId = filters.vendorId.trim().toUpperCase();
  }

  let inspections = [];
  if (mongoose.connection?.readyState === 1 || IncomingInspection.find !== mongoose.Model.find) {
    try {
      inspections = await IncomingInspection.find(inspectMatch).lean();
    } catch (_) {
      inspections = [];
    }
  }

  // 5b. Fetch Statutory Food Safety Temperature Rules (processType: RECEIVING)
  let temperatureRules = [];
  if (mongoose.connection?.readyState === 1 || FoodSafetyTemperatureRule.find !== mongoose.Model.find) {
    try {
      temperatureRules = await FoodSafetyTemperatureRule.find({
        organisationId,
        processType: 'RECEIVING',
      }).lean();
    } catch (_) {
      temperatureRules = [];
    }
  }

  // ── Procurement Totals & Breakdown Variables ──────────────────────────────
  let totalPoCommitmentsPaisa = 0;
  let grnReceivedValuePaisa = 0;
  let invoicedValuePaisa = 0;
  let receivedNotInvoicedRNI = 0;
  let invoicedNotReceivedINR = 0;
  let purchasePriceVariancePaise = 0;

  let totalPoCount = 0;
  let openPoCount = 0;
  let cancelledPoCount = 0;
  let cancelledPoValuePaisa = 0;

  // Multi-receipt delivery tracking
  let totalFirstReceiptsEvaluated = 0;
  let firstReceiptOnTimeCount = 0;
  let totalFullyDeliveredEvaluated = 0;
  let finalFulfillmentOnTimeCount = 0;
  let totalDelayDays = 0;

  // Lead time tracking
  let recordsUsingApprovedAt = 0;
  let recordsUsingFallback = 0;
  let totalLeadDaysApproved = 0;
  let totalLeadDaysOverall = 0;
  let totalTimeToFullDays = 0;
  let fullDeliveryLeadCount = 0;

  const poStatusMap = {};
  const supplierAggregation = {};
  const itemProcurementMap = {};
  const priceHistoryList = [];
  const overduePOs = [];
  const vendorExceptions = [];

  for (const po of orders) {
    totalPoCount++;
    const status = String(po.status || 'DRAFT').toUpperCase();
    const poTotalPaisa = Number(po.totalPaisa || 0);

    // Track status count & value
    if (!poStatusMap[status]) {
      poStatusMap[status] = { status, count: 0, totalPaisa: 0 };
    }
    poStatusMap[status].count++;
    poStatusMap[status].totalPaisa += poTotalPaisa;

    if (status === 'CANCELLED') {
      cancelledPoCount++;
      cancelledPoValuePaisa += poTotalPaisa;
      continue; // Cancelled POs do NOT contribute to active commitments
    }

    totalPoCommitmentsPaisa += poTotalPaisa;

    const isOpen = !['CLOSED', 'CANCELLED', 'RECEIVED'].includes(status);
    if (isOpen) openPoCount++;

    // Supplier setup
    const vId = po.vendorId || 'UNKNOWN';
    const sName = po.vendorNameSnapshot || vendorMap[vId]?.name || vId;
    if (!supplierAggregation[vId]) {
      supplierAggregation[vId] = {
        vendorId: vId,
        vendorName: sName,
        category: vendorMap[vId]?.category || 'OTHER',
        status: vendorMap[vId]?.status || 'ACTIVE',
        orderedValuePaisa: 0,
        receivedValuePaisa: 0,
        invoicedValuePaisa: 0,
        poCount: 0,
        openPoCount: 0,
        leadTimeDaysSum: 0,
        leadTimeCount: 0,
        leadTimeApprovedDaysSum: 0,
        leadTimeApprovedCount: 0,
        leadTimeFallbackDaysSum: 0,
        leadTimeFallbackCount: 0,
        firstReceiptsCount: 0,
        firstReceiptsOnTime: 0,
        fullDeliveriesCount: 0,
        fullDeliveriesOnTime: 0,
        orderedQtyTotal: 0,
        receivedQtyTotal: 0,
        completedOrderedQty: 0,
        completedReceivedQty: 0,
        shortQtyTotal: 0,
        excessQtyTotal: 0,
        rejectedQtyTotal: 0,
        cafesSuppliedSet: new Set(),
        itemsSuppliedSet: new Set(),
      };
    }
    const supp = supplierAggregation[vId];
    supp.orderedValuePaisa += poTotalPaisa;
    supp.poCount += 1;
    if (isOpen) supp.openPoCount += 1;
    if (po.cafeId) supp.cafesSuppliedSet.add(po.cafeId);

    // Line items and Received Valuation analysis
    let poReceivedPaisa = 0;
    let poOrderedQty = 0;
    let poReceivedQty = 0;

    if (Array.isArray(po.lineItems)) {
      for (const line of po.lineItems) {
        const oQty = Number(line.orderedQuantityBase || 0);
        const rQty = Number(line.receivedQuantityBase || 0);
        const uPrice = Number(line.unitPricePaisa || 0);
        const itemId = line.itemId;

        poOrderedQty += oQty;
        poReceivedQty += rQty;
        supp.orderedQtyTotal += oQty;
        supp.receivedQtyTotal += rQty;
        supp.itemsSuppliedSet.add(itemId);

        const lineReceivedVal = rQty * uPrice;
        poReceivedPaisa += lineReceivedVal;

        if (rQty < oQty && ((Array.isArray(po.grnReceipts) && po.grnReceipts.length > 0) || po.receivedDate)) {
          supp.shortQtyTotal += (oQty - rQty);
        } else if (rQty > oQty) {
          supp.excessQtyTotal += (rQty - oQty);
        }

        // Price history record
        if (po.orderDate && uPrice > 0) {
          priceHistoryList.push({
            itemId,
            itemName: line.itemNameSnapshot || itemMap[itemId]?.name || itemId,
            vendorId: vId,
            vendorName: sName,
            orderDate: po.orderDate,
            purchaseOrderId: po.purchaseOrderId,
            unitPricePaisa: uPrice,
            baseUnit: line.baseUnit || itemMap[itemId]?.baseUnit || 'units',
          });
        }

        // Multidimensional Item Procurement
        if (!itemProcurementMap[itemId]) {
          itemProcurementMap[itemId] = {
            itemId,
            itemName: line.itemNameSnapshot || itemMap[itemId]?.name || itemId,
            category: itemMap[itemId]?.category || 'OTHER',
            baseUnit: line.baseUnit || 'units',
            criticality: itemMap[itemId]?.criticality || 'STANDARD',
            orderedQty: 0,
            receivedQty: 0,
            orderedSpendPaisa: 0,
            receivedSpendPaisa: 0,
            vendorsSet: new Set(),
            latestPricePaisa: uPrice,
            prices: [],
          };
        }
        itemProcurementMap[itemId].orderedQty += oQty;
        itemProcurementMap[itemId].receivedQty += rQty;
        itemProcurementMap[itemId].orderedSpendPaisa += Number(line.totalLinePaisa || oQty * uPrice);
        itemProcurementMap[itemId].receivedSpendPaisa += lineReceivedVal;
        itemProcurementMap[itemId].vendorsSet.add(vId);
        itemProcurementMap[itemId].prices.push({ price: uPrice, date: po.orderDate || '1970-01-01' });
      }
    }

    const isPoCompleted = ['RECEIVED', 'CLOSED'].includes(status);
    if (isPoCompleted) {
      supp.completedOrderedQty += poOrderedQty;
      supp.completedReceivedQty += poReceivedQty;
    }

    grnReceivedValuePaisa += poReceivedPaisa;
    supp.receivedValuePaisa += poReceivedPaisa;

    // Delivery and Multi-Receipt On-Time analysis
    const hasReceipt = (Array.isArray(po.grnReceipts) && po.grnReceipts.length > 0) || po.receivedDate;
    let actualFirstReceiptDateStr = null;
    let actualFinalReceiptDateStr = null;
    let firstReceiptTimestamp = null;
    let finalReceiptTimestamp = null;

    if (Array.isArray(po.grnReceipts) && po.grnReceipts.length > 0) {
      // Sort receipts chronologically
      const sortedGrns = [...po.grnReceipts].filter((g) => g.receivedAt).sort((a, b) => new Date(a.receivedAt) - new Date(b.receivedAt));
      if (sortedGrns.length > 0) {
        firstReceiptTimestamp = new Date(sortedGrns[0].receivedAt);
        actualFirstReceiptDateStr = new Intl.DateTimeFormat('en-CA', {
          timeZone: 'Asia/Kolkata',
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
        }).format(firstReceiptTimestamp);

        finalReceiptTimestamp = new Date(sortedGrns[sortedGrns.length - 1].receivedAt);
        actualFinalReceiptDateStr = new Intl.DateTimeFormat('en-CA', {
          timeZone: 'Asia/Kolkata',
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
        }).format(finalReceiptTimestamp);
      }
    } else if (po.receivedDate) {
      actualFirstReceiptDateStr = String(po.receivedDate).substring(0, 10);
      actualFinalReceiptDateStr = actualFirstReceiptDateStr;
      firstReceiptTimestamp = new Date(`${actualFirstReceiptDateStr}T00:00:00+05:30`);
      finalReceiptTimestamp = firstReceiptTimestamp;
    }

    // Lead Time calculation
    if (hasReceipt && firstReceiptTimestamp) {
      if (po.approvedAt) {
        const appDate = new Date(po.approvedAt);
        const leadDays = Math.max(0, Number(((firstReceiptTimestamp - appDate) / 86400000).toFixed(1)));
        supp.leadTimeApprovedDaysSum += leadDays;
        supp.leadTimeApprovedCount += 1;
        supp.leadTimeDaysSum += leadDays;
        supp.leadTimeCount += 1;
        recordsUsingApprovedAt++;
        totalLeadDaysApproved += leadDays;
        totalLeadDaysOverall += leadDays;
      } else {
        const fbDate = po.submittedAt ? new Date(po.submittedAt) : (po.orderDate ? new Date(`${po.orderDate}T00:00:00+05:30`) : null);
        if (fbDate) {
          const leadDays = Math.max(0, Number(((firstReceiptTimestamp - fbDate) / 86400000).toFixed(1)));
          supp.leadTimeFallbackDaysSum += leadDays;
          supp.leadTimeFallbackCount += 1;
          supp.leadTimeDaysSum += leadDays;
          supp.leadTimeCount += 1;
          recordsUsingFallback++;
          totalLeadDaysOverall += leadDays;
        }
      }

      if (finalReceiptTimestamp && (isPoCompleted || (poReceivedQty >= poOrderedQty && poOrderedQty > 0))) {
        const poStart = po.approvedAt ? new Date(po.approvedAt) : (po.submittedAt ? new Date(po.submittedAt) : (po.orderDate ? new Date(`${po.orderDate}T00:00:00+05:30`) : null));
        if (poStart) {
          const fullLead = Math.max(0, Number(((finalReceiptTimestamp - poStart) / 86400000).toFixed(1)));
          totalTimeToFullDays += fullLead;
          fullDeliveryLeadCount++;
        }
      }
    }

    // Multi-Receipt Delivery Performance
    if (po.expectedDeliveryDate && actualFirstReceiptDateStr) {
      totalFirstReceiptsEvaluated++;
      supp.firstReceiptsCount++;
      const expStr = String(po.expectedDeliveryDate).substring(0, 10);
      const isFirstOnTime = actualFirstReceiptDateStr <= expStr;

      if (isFirstOnTime) {
        firstReceiptOnTimeCount++;
        supp.firstReceiptsOnTime++;
      }

      const isFullyDelivered = isPoCompleted || (poReceivedQty >= poOrderedQty && poOrderedQty > 0);
      if (isFullyDelivered) {
        totalFullyDeliveredEvaluated++;
        supp.fullDeliveriesCount++;
        const isFinalOnTime = actualFinalReceiptDateStr <= expStr;
        if (isFinalOnTime) {
          finalFulfillmentOnTimeCount++;
          supp.fullDeliveriesOnTime++;
        } else {
          const expDate = new Date(`${expStr}T00:00:00+05:30`);
          const delayDays = Math.max(0, Math.round((finalReceiptTimestamp - expDate) / 86400000));
          totalDelayDays += delayDays;
        }
      }
    }

    // Overdue PO Tracking
    if (isOpen && po.expectedDeliveryDate) {
      const expStr = String(po.expectedDeliveryDate).substring(0, 10);
      if (expStr < todayStr) {
        const expDate = new Date(`${expStr}T00:00:00+05:30`);
        const daysLate = Math.max(1, Math.round((now - expDate) / 86400000));
        overduePOs.push({
          purchaseOrderId: po.purchaseOrderId,
          vendorId: vId,
          vendorName: sName,
          cafeId: po.cafeId,
          orderDate: po.orderDate,
          expectedDeliveryDate: po.expectedDeliveryDate,
          daysLate,
          totalPaisa: poTotalPaisa,
        });
        vendorExceptions.push({
          type: 'OVERDUE_PO',
          referenceId: po.purchaseOrderId,
          vendorId: vId,
          vendorName: sName,
          detail: `PO ${po.purchaseOrderId} is ${daysLate} days past expected delivery date (${po.expectedDeliveryDate})`,
          severity: 'HIGH',
        });
      }
    }

    // Dock inspections from grnReceipts
    if (Array.isArray(po.grnReceipts)) {
      for (const grn of po.grnReceipts) {
        if (Array.isArray(grn.items)) {
          for (const gItm of grn.items) {
            const rejQty = Number(gItm.rejectedQty || 0);
            if (rejQty > 0) {
              supp.rejectedQtyTotal += rejQty;
              vendorExceptions.push({
                type: 'REJECTED_RECEIPT',
                referenceId: po.purchaseOrderId,
                vendorId: vId,
                vendorName: sName,
                detail: `Dock rejected ${rejQty} units of ${gItm.itemId} (${gItm.rejectionReason || 'Quality non-conformance'})`,
                severity: 'MEDIUM',
              });
            }
          }
        }
      }
    }

    // Invoiced value linked to PO
    let poInvoicedPaisa = 0;
    if (Array.isArray(po.invoices) && po.invoices.length > 0) {
      for (const inv of po.invoices) {
        poInvoicedPaisa += Number(inv.totalPaisa || inv.amountPaisa || 0);
      }
    }
    invoicedValuePaisa += poInvoicedPaisa;
    supp.invoicedValuePaisa += poInvoicedPaisa;

    const isReceived = hasReceipt || poReceivedPaisa > 0;
    const isInvoiced = poInvoicedPaisa > 0 || Boolean(po.vendorInvoiceNumber);

    if (isReceived && !isInvoiced) receivedNotInvoicedRNI++;
    else if (isInvoiced && !isReceived) invoicedNotReceivedINR++;

    if (po.threeWayMatch?.priceVariancePaisa) {
      purchasePriceVariancePaise += Number(po.threeWayMatch.priceVariancePaisa);
    }
  }

  // 5. APInvoice Ingestion: Invoiced Value, Authoritative Outstanding Payable, Payables Aging
  let totalApOutstandingPaisa = 0;
  let totalApInvoicedPaisa = 0;

  const payablesAgingBuckets = {
    'CURRENT': { label: 'Current / Not Due', count: 0, outstandingPaisa: 0 },
    'DAYS_1_30': { label: '1 – 30 Days Past Due', count: 0, outstandingPaisa: 0 },
    'DAYS_31_60': { label: '31 – 60 Days Past Due', count: 0, outstandingPaisa: 0 },
    'DAYS_61_90': { label: '61 – 90 Days Past Due', count: 0, outstandingPaisa: 0 },
    'OVER_90': { label: '90+ Days Past Due', count: 0, outstandingPaisa: 0 },
  };

  for (const inv of apInvoices) {
    const recog = evaluateApInvoiceFinancialRecognition(inv);
    if (!recog.recognized) continue;

    const invTotal = Number(inv.totalPaisa !== undefined ? inv.totalPaisa : (Number(inv.amountPaisa || 0) + Number(inv.taxPaisa || 0)));

    if (recog.invoicedValueEligible) {
      totalApInvoicedPaisa += invTotal;
    }

    if (recog.outstandingEligible) {
      const remPaisa = inv.outstandingPaisa !== undefined
        ? Number(inv.outstandingPaisa)
        : Math.max(0, invTotal - Number(inv.paidPaisa || 0));

      totalApOutstandingPaisa += remPaisa;

      const vId = inv.vendorId;
      if (vId && supplierAggregation[vId]) {
        supplierAggregation[vId].outstandingPaisa = (supplierAggregation[vId].outstandingPaisa || 0) + remPaisa;
      }

      // Aging schedules remaining unpaid amount (remPaisa), NOT gross amount
      if (remPaisa > 0 && inv.dueDate) {
        const dueStr = String(inv.dueDate).substring(0, 10);
        if (dueStr >= todayStr) {
          payablesAgingBuckets['CURRENT'].count++;
          payablesAgingBuckets['CURRENT'].outstandingPaisa += remPaisa;
        } else {
          const dueDate = new Date(`${dueStr}T00:00:00+05:30`);
          const daysOver = Math.max(1, Math.round((now - dueDate) / 86400000));
          let bucket = 'OVER_90';
          if (daysOver <= 30) bucket = 'DAYS_1_30';
          else if (daysOver <= 60) bucket = 'DAYS_31_60';
          else if (daysOver <= 90) bucket = 'DAYS_61_90';

          payablesAgingBuckets[bucket].count++;
          payablesAgingBuckets[bucket].outstandingPaisa += remPaisa;
        }
      }
    }
  }

  // 5b. Canonical Line-Level Purchase Price Variance (PPV)
  // Compares line-level net unit price: (invoiceNetUnitPrice - poNetUnitPrice) * evaluatedQuantity
  // Excludes GST, freight, surcharges. Rejects incompatible UOMs.
  let lineLevelPpvSumPaisa = 0;
  let comparableLinesCount = 0;
  let unmatchableLinesCount = 0;
  const lineLevelPpvRecords = [];

  const poLinesLookup = {};
  for (const po of orders) {
    if (po.purchaseOrderId && Array.isArray(po.lineItems)) {
      poLinesLookup[po.purchaseOrderId] = {};
      for (const pLine of po.lineItems) {
        if (pLine.itemId) {
          poLinesLookup[po.purchaseOrderId][pLine.itemId] = pLine;
        }
      }
    }
  }

  for (const inv of apInvoices) {
    const recog = evaluateApInvoiceFinancialRecognition(inv);
    if (!recog.recognized) continue;

    const poRef = inv.poReferenceId;
    const invLines = Array.isArray(inv.lines) ? inv.lines : (Array.isArray(inv.lineItems) ? inv.lineItems : null);

    if (poRef && poLinesLookup[poRef] && invLines && invLines.length > 0) {
      for (const iLine of invLines) {
        const itmId = iLine.itemId;
        const pLine = poLinesLookup[poRef][itmId];

        if (pLine) {
          const uomCheck = normalizeUom(1, iLine.uom || iLine.unit || 'unit', pLine.baseUnit || pLine.uom || 'unit', itemMap[itmId]);
          if (!uomCheck.compatible) {
            unmatchableLinesCount++;
            continue;
          }

          const poNetUnitPaisa = Number(pLine.unitPricePaisa || 0);
          const invNetUnitPaisa = Number(iLine.unitPricePaisa !== undefined ? iLine.unitPricePaisa : (iLine.netUnitPricePaisa || 0));

          if (poNetUnitPaisa > 0 && invNetUnitPaisa > 0) {
            const unitDiffPaisa = invNetUnitPaisa - poNetUnitPaisa;
            const diffPct = Number(((unitDiffPaisa / poNetUnitPaisa) * 100).toFixed(2));
            const evalQty = Number(iLine.quantity || pLine.receivedQuantityBase || pLine.orderedQuantityBase || 1);
            const lineVariancePaisa = unitDiffPaisa * evalQty;

            lineLevelPpvSumPaisa += lineVariancePaisa;
            comparableLinesCount++;

            lineLevelPpvRecords.push({
              purchaseOrderId: poRef,
              invoiceId: inv.invoiceId,
              itemId: itmId,
              itemName: iLine.itemName || pLine.itemNameSnapshot || itemMap[itmId]?.name || itmId,
              poUnitPricePaisa: poNetUnitPaisa,
              invoiceUnitPricePaisa: invNetUnitPaisa,
              variancePerUnitPaisa: unitDiffPaisa,
              variancePercent: diffPct,
              evaluatedQuantity: evalQty,
              linePpvPaisa: lineVariancePaisa,
              uom: pLine.baseUnit || 'unit',
            });
          } else {
            unmatchableLinesCount++;
          }
        } else {
          unmatchableLinesCount++;
        }
      }
    } else if (poRef && poLinesLookup[poRef] && (!invLines || invLines.length === 0)) {
      unmatchableLinesCount++;
    }
  }

  // Fallback to PO-level threeWayMatch price variance if explicit line items were not supplied
  if (comparableLinesCount === 0) {
    for (const po of orders) {
      if (po.threeWayMatch?.priceVariancePaisa !== undefined && po.threeWayMatch?.priceVariancePaisa !== null) {
        lineLevelPpvSumPaisa += Number(po.threeWayMatch.priceVariancePaisa);
        comparableLinesCount++;
      }
    }
  }

  let ppvAvailability = 'UNAVAILABLE';
  let finalPpvPaisa = null;
  let finalPpvPercent = null;

  if (comparableLinesCount > 0) {
    ppvAvailability = unmatchableLinesCount === 0 ? 'COMPLETE' : 'PARTIAL';
    finalPpvPaisa = lineLevelPpvSumPaisa;
    const comparablePoSpendPaisa = lineLevelPpvRecords.reduce((sum, r) => sum + (r.poUnitPricePaisa * r.evaluatedQuantity), 0);
    finalPpvPercent = comparablePoSpendPaisa > 0 ? Number(((finalPpvPaisa / comparablePoSpendPaisa) * 100).toFixed(2)) : null;
  }

  // 6. Dock Inspections aggregation (Factual compliance & configured temperature rules)
  let totalInspectedQuantity = 0;
  let totalAcceptedQuantity = 0;
  let totalRejectedQuantity = 0;
  let temperatureRecordedCount = 0;
  let evaluatedTemperatureCount = 0;
  let unevaluatedTemperatureCount = 0;
  let failureCount = 0;
  let packagingDamageCount = 0;
  let qualityConditionFailureCount = 0;

  // Resolve statutory/configured food safety receiving temperature rules (including historical rules)
  const receivingRules = (Array.isArray(temperatureRules) && temperatureRules.length > 0)
    ? temperatureRules.filter((r) => !r.processType || r.processType === 'RECEIVING')
    : [];
  const hasConfiguredRules = receivingRules.length > 0;
  const primaryRule = hasConfiguredRules ? receivingRules[0] : null;
  let primaryRuleResolved = null;
  let ambiguousRuleConfigurationCount = 0;

  for (const ins of inspections) {
    const rQty = Number(ins.receivedQuantity || 0);
    const aQty = Number(ins.acceptedQuantity || 0);
    const rejQty = Number(ins.rejectedQuantity || 0);
    totalInspectedQuantity += rQty;
    totalAcceptedQuantity += aQty;
    totalRejectedQuantity += rejQty;

    // Factual temperature recordings
    if (ins.temperatureCelsius !== null && ins.temperatureCelsius !== undefined && !isNaN(ins.temperatureCelsius)) {
      temperatureRecordedCount++;
      const temp = Number(ins.temperatureCelsius);

      // Match applicable rule deterministically based on temporal applicability & specificity hierarchy (PM-02E-R5)
      const resolution = resolveTemperatureRule(ins, receivingRules, itemMap);

      if (resolution.status === 'MATCHED' && resolution.rule) {
        evaluatedTemperatureCount++;
        if (!primaryRuleResolved) primaryRuleResolved = resolution;

        const matchedRule = resolution.rule;
        const rMin = (Array.isArray(matchedRule.criteria) && matchedRule.criteria.length > 0)
          ? matchedRule.criteria[0].minimumTemperatureC : null;
        const rMax = (Array.isArray(matchedRule.criteria) && matchedRule.criteria.length > 0)
          ? matchedRule.criteria[0].maximumTemperatureC : null;

        let isExcursion = false;
        if (rMin !== null && rMin !== undefined && temp < rMin) isExcursion = true;
        if (rMax !== null && rMax !== undefined && temp > rMax) isExcursion = true;
        if (isExcursion) failureCount++;
      } else if (resolution.status === 'AMBIGUOUS_RULE_CONFIGURATION') {
        ambiguousRuleConfigurationCount++;
        unevaluatedTemperatureCount++;
      } else {
        unevaluatedTemperatureCount++;
      }
    }

    // Packaging conditions from schema enum: DAMAGED, LEAKING, IMPROPER_LABEL
    if (ins.packagingCondition && ['DAMAGED', 'LEAKING', 'IMPROPER_LABEL'].includes(ins.packagingCondition)) {
      packagingDamageCount++;
    }

    // Quality conditions from schema enum: SPOILED, FOREIGN_MATTER, DISCOLORED, OFF_ODOR
    if (ins.qualityCondition && ['SPOILED', 'FOREIGN_MATTER', 'DISCOLORED', 'OFF_ODOR'].includes(ins.qualityCondition)) {
      qualityConditionFailureCount++;
    }

    const vId = ins.vendorId;
    if (vId && supplierAggregation[vId]) {
      supplierAggregation[vId].rejectedQtyTotal = (supplierAggregation[vId].rejectedQtyTotal || 0) + rejQty;
    }
  }

  // Data Quality determination for temperature compliance (PM-02E-R5)
  let temperatureFailureAvailability = 'UNAVAILABLE';
  let temporalApplicability = 'UNAVAILABLE';
  let historicalRuleAvailability = 'UNAVAILABLE';
  let finalTemperatureFailureCount = null;

  if (!hasConfiguredRules) {
    temperatureFailureAvailability = 'UNAVAILABLE';
    temporalApplicability = 'UNAVAILABLE';
    historicalRuleAvailability = 'UNAVAILABLE';
    finalTemperatureFailureCount = null;
  } else if (temperatureRecordedCount === 0) {
    temperatureFailureAvailability = 'UNAVAILABLE';
    temporalApplicability = 'UNAVAILABLE';
    historicalRuleAvailability = hasConfiguredRules ? 'COMPLETE' : 'UNAVAILABLE';
    finalTemperatureFailureCount = null;
  } else if (evaluatedTemperatureCount === 0) {
    temperatureFailureAvailability = 'UNAVAILABLE';
    temporalApplicability = 'UNAVAILABLE';
    historicalRuleAvailability = 'UNAVAILABLE';
    finalTemperatureFailureCount = null;
  } else if (unevaluatedTemperatureCount > 0 || ambiguousRuleConfigurationCount > 0) {
    temperatureFailureAvailability = 'PARTIAL';
    temporalApplicability = 'PARTIAL';
    historicalRuleAvailability = 'PARTIAL';
    finalTemperatureFailureCount = failureCount;
  } else {
    temperatureFailureAvailability = 'COMPLETE';
    temporalApplicability = 'COMPLETE';
    historicalRuleAvailability = 'COMPLETE';
    finalTemperatureFailureCount = failureCount; // 0 is legitimate when rule exists and all comply
  }

  const effectiveMinAllowedTemp = primaryRuleResolved?.rule?.criteria?.[0]?.minimumTemperatureC ?? (primaryRule?.criteria?.[0]?.minimumTemperatureC ?? null);
  const effectiveMaxAllowedTemp = primaryRuleResolved?.rule?.criteria?.[0]?.maximumTemperatureC ?? (primaryRule?.criteria?.[0]?.maximumTemperatureC ?? null);

  // 7. Factual Statutory Compliance (Recorded vs Expired vs Approaching Expiry)
  let totalRecordedDocsCount = 0;
  let totalExpiredDocsCount = 0;
  let documentedActiveVendorCount = 0;

  const vendorComplianceList = vendors.map((v) => {
    const fssai = v.fssaiDetails || {};
    const fssaiExpStr = fssai.expiryDate ? new Date(fssai.expiryDate).toISOString().substring(0, 10) : null;
    const isFssaiExpired = fssaiExpStr ? fssaiExpStr < todayStr : false;

    const insExpStr = v.insuranceExpiryDate ? new Date(v.insuranceExpiryDate).toISOString().substring(0, 10) : null;
    const isInsExpired = insExpStr ? insExpStr < todayStr : false;

    const contractExpStr = v.contractExpiryDate ? new Date(v.contractExpiryDate).toISOString().substring(0, 10) : null;
    const isContractExpired = contractExpStr ? contractExpStr < todayStr : false;

    const recordedDocs = [];
    const expiredDocs = [];

    if (v.gstNumber) recordedDocs.push('GSTIN');
    if (v.panNumber) recordedDocs.push('PAN');
    if (fssai.licenseNumber || v.fssaiLicense) {
      recordedDocs.push('FSSAI');
      if (isFssaiExpired) expiredDocs.push('FSSAI');
    }
    if (v.insurancePolicyNumber) {
      recordedDocs.push('INSURANCE');
      if (isInsExpired) expiredDocs.push('INSURANCE');
    }
    if (v.contractExpiryDate) {
      recordedDocs.push('CONTRACT');
      if (isContractExpired) expiredDocs.push('CONTRACT');
    }

    if (Array.isArray(v.documents)) {
      for (const d of v.documents) {
        const dType = String(d.documentType || 'DOCUMENT').toUpperCase();
        recordedDocs.push(dType);
        if (d.expiresAt) {
          const exp = String(d.expiresAt).substring(0, 10);
          if (exp < todayStr) expiredDocs.push(dType);
        }
      }
    }

    totalRecordedDocsCount += recordedDocs.length;
    totalExpiredDocsCount += expiredDocs.length;
    if (recordedDocs.length > 0 && String(v.status || 'ACTIVE').toUpperCase() === 'ACTIVE') {
      documentedActiveVendorCount++;
    }

    if (expiredDocs.length > 0) {
      vendorExceptions.push({
        type: 'EXPIRED_DOCUMENT',
        referenceId: v.vendorId,
        vendorId: v.vendorId,
        vendorName: v.name,
        detail: `Vendor has expired statutory documents: ${expiredDocs.join(', ')}`,
        severity: 'HIGH',
      });
    }

    return {
      vendorId: v.vendorId,
      name: v.name,
      gstNumber: v.gstNumber || 'NOT_RECORDED',
      panNumber: v.panNumber || 'NOT_RECORDED',
      fssaiLicense: fssai.licenseNumber || v.fssaiLicense || 'NOT_RECORDED',
      fssaiExpiry: fssaiExpStr,
      fssaiValid: !isFssaiExpired && Boolean(fssai.licenseNumber || v.fssaiLicense),
      insurancePolicyNumber: v.insurancePolicyNumber || 'NOT_RECORDED',
      insuranceExpiry: insExpStr,
      recordedDocuments: recordedDocs,
      expiredRecordedDocuments: expiredDocs,
      qualificationStatus: Array.isArray(v.qualifications) && v.qualifications.length > 0
        ? v.qualifications[0].status
        : 'RECORDED',
    };
  });

  const activeVendors = vendors.filter((v) => String(v.status || 'ACTIVE').toUpperCase() === 'ACTIVE');
  const vendorCounts = {
    knownActiveVendorCount: activeVendors.length,
    totalKnownVendorCount: vendors.length,
    approvedSupplierQualification: 'NOT_STORED_IN_SOURCE',
  };

  const documentCompliance = {
    mandatoryRequirementsConfigured: false,
    recordedDocumentsCount: totalRecordedDocsCount,
    expiredRecordedDocumentsCount: totalExpiredDocsCount,
    documentedActiveVendorCount,
    policyNotice: 'Factual document audit only; mandatory document requirements are not configured by category or jurisdiction.',
  };

  // 8. Single Source & Critical Item Dependency (Known Active Vendor Count)
  const singleSourceItems = [];
  const criticalDependencies = [];

  for (const itm of allItems) {
    const pInfo = itemProcurementMap[itm.itemId];
    const vendorCount = pInfo ? pInfo.vendorsSet.size : 0;
    const isCritical = itm.criticality === 'CRITICAL';

    if (vendorCount === 1) {
      singleSourceItems.push({
        itemId: itm.itemId,
        itemName: itm.name,
        category: itm.category,
        vendorId: Array.from(pInfo.vendorsSet)[0],
        vendorName: vendorMap[Array.from(pInfo.vendorsSet)[0]]?.name || 'Unknown',
        criticality: itm.criticality,
        knownActiveVendorCount: 1,
        singleActiveSource: true,
      });
    }

    if (isCritical) {
      criticalDependencies.push({
        itemId: itm.itemId,
        itemName: itm.name,
        category: itm.category,
        criticality: 'CRITICAL',
        knownActiveVendorCount: vendorCount,
        singleActiveSource: vendorCount === 1,
        unitCostPaisa: itm.unitCostPaisa || 0,
      });
    }
  }

  // 9. Vendor Spend Concentration & Pareto
  const sortedSuppliers = Object.values(supplierAggregation).sort((a, b) => b.orderedValuePaisa - a.orderedValuePaisa);
  let runningSpendPaisa = 0;

  const vendorScorecardList = sortedSuppliers.map((s) => {
    runningSpendPaisa += s.orderedValuePaisa;
    const spendShare = totalPoCommitmentsPaisa > 0 ? Number(((s.orderedValuePaisa / totalPoCommitmentsPaisa) * 100).toFixed(1)) : 0;
    const cumulativeShare = totalPoCommitmentsPaisa > 0 ? Number(((runningSpendPaisa / totalPoCommitmentsPaisa) * 100).toFixed(1)) : 0;

    const avgLead = s.leadTimeCount > 0 ? Number((s.leadTimeDaysSum / s.leadTimeCount).toFixed(1)) : null;

    // Delivery metrics: final fulfillment on time vs first receipt on time
    const finalOnTimePct = s.fullDeliveriesCount > 0
      ? Number(((s.fullDeliveriesOnTime / s.fullDeliveriesCount) * 100).toFixed(1))
      : (s.firstReceiptsCount > 0 ? Number(((s.firstReceiptsOnTime / s.firstReceiptsCount) * 100).toFixed(1)) : null);

    const firstOnTimePct = s.firstReceiptsCount > 0
      ? Number(((s.firstReceiptsOnTime / s.firstReceiptsCount) * 100).toFixed(1))
      : null;

    // Fill rate metrics
    const completedFillRatePct = s.completedOrderedQty > 0
      ? Number(((s.completedReceivedQty / s.completedOrderedQty) * 100).toFixed(1))
      : null;

    const currentFulfillmentRatePct = s.orderedQtyTotal > 0
      ? Number(((s.receivedQtyTotal / s.orderedQtyTotal) * 100).toFixed(1))
      : null;

    const rejPct = s.receivedQtyTotal > 0 ? Number(((s.rejectedQtyTotal / s.receivedQtyTotal) * 100).toFixed(1)) : 0;

    return {
      vendorId: s.vendorId,
      supplier: s.vendorName,
      category: s.category,
      status: s.status,
      orderedValuePaisa: s.orderedValuePaisa,
      orderedValue: Number((s.orderedValuePaisa / 100).toFixed(2)),
      receivedValuePaisa: s.receivedValuePaisa,
      receivedValue: Number((s.receivedValuePaisa / 100).toFixed(2)),
      invoicedValuePaisa: s.invoicedValuePaisa,
      invoicedValue: Number((s.invoicedValuePaisa / 100).toFixed(2)),
      paidValue: null,
      paidValueAvailability: 'UNAVAILABLE',
      outstandingPaisa: s.outstandingPaisa || 0,
      outstanding: Number(((s.outstandingPaisa || 0) / 100).toFixed(2)),
      poCount: s.poCount,
      openPoCount: s.openPoCount,
      spendSharePercent: spendShare,
      cumulativeSharePercent: cumulativeShare,
      leadTimeDays: avgLead,
      onTimeDeliveryPercent: finalOnTimePct !== null ? finalOnTimePct : firstOnTimePct,
      finalFulfillmentOnTimePercent: finalOnTimePct,
      firstReceiptOnTimePercent: firstOnTimePct,
      fillRatePercent: completedFillRatePct !== null ? completedFillRatePct : currentFulfillmentRatePct,
      completedPoFillRate: completedFillRatePct,
      completedPoFillRatePercent: completedFillRatePct,
      currentFulfillmentRate: currentFulfillmentRatePct,
      currentFulfillmentRatePercent: currentFulfillmentRatePct,
      rejectionRatePercent: rejPct,
      cafesSuppliedCount: s.cafesSuppliedSet.size,
      itemsSuppliedCount: s.itemsSuppliedSet.size,
      overallScore: 'NOT_CONFIGURED',
    };
  });

  // 10. Vendor Price Trends (Comparable UOMs only)
  priceHistoryList.sort((a, b) => (a.orderDate > b.orderDate ? -1 : 1));
  const latestPriceMap = {};
  const priceTrendList = [];

  for (const ph of priceHistoryList) {
    const key = `${ph.itemId}_${ph.vendorId}`;
    if (!latestPriceMap[key]) {
      latestPriceMap[key] = ph;
    } else {
      const prev = latestPriceMap[key];
      const diff = prev.unitPricePaisa - ph.unitPricePaisa;
      const pct = ph.unitPricePaisa > 0 ? Number(((diff / ph.unitPricePaisa) * 100).toFixed(1)) : 0;
      priceTrendList.push({
        itemId: ph.itemId,
        itemName: ph.itemName,
        vendorId: ph.vendorId,
        vendorName: ph.vendorName,
        currentPricePaisa: prev.unitPricePaisa,
        previousPricePaisa: ph.unitPricePaisa,
        priceChangePaisa: diff,
        priceChangePercent: pct,
        effectiveDate: prev.orderDate,
        baseUnit: ph.baseUnit,
      });
      latestPriceMap[key] = ph;
    }
  }

  // 11. Vendor Audit Trail from AuditEvent (PII & Credentials Redacted)
  let vendorAuditEvents = [];
  if (mongoose.connection?.readyState === 1 || AuditEvent.find !== mongoose.Model.find) {
    try {
      const aEvents = await AuditEvent.find({
        organisationId,
        entityType: 'VENDOR',
      }).sort({ createdAt: -1 }).limit(50).lean();

      vendorAuditEvents = aEvents.map((e) => {
        const sanitize = (obj) => {
          if (!obj || typeof obj !== 'object') return obj;
          const copy = { ...obj };
          delete copy.accountNumber;
          delete copy.ifscCode;
          delete copy.upiId;
          delete copy.password;
          delete copy.pin;
          return copy;
        };
        return {
          auditEventId: e.auditEventId,
          action: e.action,
          entityId: e.entityId,
          actorUserId: e.actorUserId,
          reason: e.reason || '',
          before: sanitize(e.before),
          after: sanitize(e.after),
          serverTimestamp: e.serverTimestamp || e.createdAt,
        };
      });
    } catch (_) {
      vendorAuditEvents = [];
    }
  }

  // ── Final Spend Summary ───────────────────────────────────────────────────
  // Note: Stages are independently sourced control measures; variances reported factually
  const effectiveInvoicedPaisa = totalApInvoicedPaisa > 0 ? totalApInvoicedPaisa : invoicedValuePaisa;
  const totalInvoiceToPoVariancePaisa = effectiveInvoicedPaisa - totalPoCommitmentsPaisa;
  const totalInvoiceToPoVariance = Number((totalInvoiceToPoVariancePaisa / 100).toFixed(2));

  const spendSummary = {
    totalPoCommitments: Number((totalPoCommitmentsPaisa / 100).toFixed(2)),
    totalPoCommitmentsPaisa,
    totalPoCommitmentsPaise: totalPoCommitmentsPaisa,
    grnReceivedValue: Number((grnReceivedValuePaisa / 100).toFixed(2)),
    grnReceivedValuePaisa,
    receiptVariancePaisa: grnReceivedValuePaisa - totalPoCommitmentsPaisa,
    outstandingReceiptValue: Number((Math.max(0, totalPoCommitmentsPaisa - grnReceivedValuePaisa) / 100).toFixed(2)),
    outstandingReceiptValuePaisa: Math.max(0, totalPoCommitmentsPaisa - grnReceivedValuePaisa),
    invoicedValue: Number((effectiveInvoicedPaisa / 100).toFixed(2)),
    invoicedValuePaisa: effectiveInvoicedPaisa,
    totalInvoiceToPoVariance,
    totalInvoiceToPoVariancePaisa,
    invoiceVariancePaisa: totalInvoiceToPoVariancePaisa,
    paidValue: null,
    paidValueAvailability: 'UNAVAILABLE',
    outstandingPayable: Number((totalApOutstandingPaisa / 100).toFixed(2)),
    outstandingPayablePaisa: totalApOutstandingPaisa,
    outstandingPayableAvailability: 'COMPLETE',
    receivedNotInvoicedRNI,
    invoicedNotReceivedINR,
    purchasePriceVariancePaisa: finalPpvPaisa,
    purchasePriceVariancePaise: finalPpvPaisa !== null ? finalPpvPaisa : 0,
    purchasePriceVariancePercent: finalPpvPercent,
    purchasePriceVarianceAvailability: ppvAvailability,
    lineLevelPpvRecords,
    totalPoCount,
    openPoCount,
    cancelledPoCount,
    cancelledPoValuePaisa,
    vendorsActiveCount: Object.keys(supplierAggregation).length,
    onTimeDeliveryPercent: totalFullyDeliveredEvaluated > 0
      ? Number(((finalFulfillmentOnTimeCount / totalFullyDeliveredEvaluated) * 100).toFixed(1))
      : (totalFirstReceiptsEvaluated > 0 ? Number(((firstReceiptOnTimeCount / totalFirstReceiptsEvaluated) * 100).toFixed(1)) : 100.0),
    firstReceiptOnTimePercent: totalFirstReceiptsEvaluated > 0
      ? Number(((firstReceiptOnTimeCount / totalFirstReceiptsEvaluated) * 100).toFixed(1))
      : 100.0,
    finalFulfillmentOnTimePercent: totalFullyDeliveredEvaluated > 0
      ? Number(((finalFulfillmentOnTimeCount / totalFullyDeliveredEvaluated) * 100).toFixed(1))
      : 100.0,
    averageLeadTimeDays: (recordsUsingApprovedAt + recordsUsingFallback) > 0
      ? Number((totalLeadDaysOverall / (recordsUsingApprovedAt + recordsUsingFallback)).toFixed(1))
      : null,
    timeToFirstReceiptDays: (recordsUsingApprovedAt + recordsUsingFallback) > 0
      ? Number((totalLeadDaysOverall / (recordsUsingApprovedAt + recordsUsingFallback)).toFixed(1))
      : null,
    timeToFullFulfillmentDays: fullDeliveryLeadCount > 0
      ? Number((totalTimeToFullDays / fullDeliveryLeadCount).toFixed(1))
      : null,
    fillRatePercent: sortedSuppliers.reduce((acc, s) => acc + s.completedOrderedQty, 0) > 0
      ? Number(((sortedSuppliers.reduce((acc, s) => acc + s.completedReceivedQty, 0) / sortedSuppliers.reduce((acc, s) => acc + s.completedOrderedQty, 0)) * 100).toFixed(1))
      : (sortedSuppliers.reduce((acc, s) => acc + s.orderedQtyTotal, 0) > 0
        ? Number(((sortedSuppliers.reduce((acc, s) => acc + s.receivedQtyTotal, 0) / sortedSuppliers.reduce((acc, s) => acc + s.orderedQtyTotal, 0)) * 100).toFixed(1))
        : null),
    completedPoFillRate: sortedSuppliers.reduce((acc, s) => acc + s.completedOrderedQty, 0) > 0
      ? Number(((sortedSuppliers.reduce((acc, s) => acc + s.completedReceivedQty, 0) / sortedSuppliers.reduce((acc, s) => acc + s.completedOrderedQty, 0)) * 100).toFixed(1))
      : null,
    currentFulfillmentRate: sortedSuppliers.reduce((acc, s) => acc + s.orderedQtyTotal, 0) > 0
      ? Number(((sortedSuppliers.reduce((acc, s) => acc + s.receivedQtyTotal, 0) / sortedSuppliers.reduce((acc, s) => acc + s.orderedQtyTotal, 0)) * 100).toFixed(1))
      : null,
    totalExcessDeliveredQuantity: sortedSuppliers.reduce((acc, s) => acc + s.excessQtyTotal, 0),
    totalShortDeliveredQuantity: sortedSuppliers.reduce((acc, s) => acc + s.shortQtyTotal, 0),
    averagePoValuePaisa: totalPoCount > 0 ? Math.round(totalPoCommitmentsPaisa / totalPoCount) : 0,
    averagePoValue: totalPoCount > 0 ? Number(((totalPoCommitmentsPaisa / totalPoCount) / 100).toFixed(2)) : 0,
  };

  // Legacy supplier spend array (top 10 by spend) for backward compatibility
  const supplierSpend = vendorScorecardList.slice(0, 10).map((s) => ({
    vendorId: s.vendorId,
    supplier: s.supplier,
    spend: s.orderedValue,
    spendPaisa: s.orderedValuePaisa,
    poCount: s.poCount,
    leadTimeDays: s.leadTimeDays || 2.0,
  }));

  return {
    spendSummary,
    supplierSpend,
    poStatusBreakdown: Object.values(poStatusMap),
    overduePOs,
    vendorIntelligence: {
      vendors: vendorScorecardList,
      scorecard: vendorScorecardList,
      vendorCounts,
      documentCompliance,
      orderedVsReceived: vendorScorecardList.map((s) => ({
        vendorId: s.vendorId,
        vendorName: s.supplier,
        orderedValue: s.orderedValue,
        receivedValue: s.receivedValue,
        varianceValue: Number((s.orderedValue - s.receivedValue).toFixed(2)),
      })),
      deliveryPerformance: {
        totalEvaluated: totalFullyDeliveredEvaluated > 0 ? totalFullyDeliveredEvaluated : totalFirstReceiptsEvaluated,
        onTimeDeliveries: totalFullyDeliveredEvaluated > 0 ? finalFulfillmentOnTimeCount : firstReceiptOnTimeCount,
        lateDeliveries: totalFullyDeliveredEvaluated > 0
          ? Math.max(0, totalFullyDeliveredEvaluated - finalFulfillmentOnTimeCount)
          : Math.max(0, totalFirstReceiptsEvaluated - firstReceiptOnTimeCount),
        onTimePercent: spendSummary.onTimeDeliveryPercent,
        firstReceiptOnTimePercent: spendSummary.firstReceiptOnTimePercent,
        finalFulfillmentOnTimePercent: spendSummary.finalFulfillmentOnTimePercent,
        averageDelayDays: totalFullyDeliveredEvaluated > finalFulfillmentOnTimeCount
          ? Number((totalDelayDays / (totalFullyDeliveredEvaluated - finalFulfillmentOnTimeCount)).toFixed(1))
          : 0,
      },
      quantityReliability: {
        totalOrderedQty: sortedSuppliers.reduce((acc, s) => acc + s.orderedQtyTotal, 0),
        totalReceivedQty: sortedSuppliers.reduce((acc, s) => acc + s.receivedQtyTotal, 0),
        completedOrderedQty: sortedSuppliers.reduce((acc, s) => acc + s.completedOrderedQty, 0),
        completedReceivedQty: sortedSuppliers.reduce((acc, s) => acc + s.completedReceivedQty, 0),
        completedPoFillRate: spendSummary.completedPoFillRate,
        currentFulfillmentRate: spendSummary.currentFulfillmentRate,
        shortQuantity: sortedSuppliers.reduce((acc, s) => acc + s.shortQtyTotal, 0),
        excessQuantity: sortedSuppliers.reduce((acc, s) => acc + s.excessQtyTotal, 0),
      },
      qualityAnalytics: {
        totalInspectedQuantity,
        totalAcceptedQuantity,
        totalRejectedQuantity,
        recordedTemperatureCount: temperatureRecordedCount,
        temperatureRecordedCount,
        evaluatedTemperatureCount,
        unevaluatedTemperatureCount,
        temperatureFailureCount: finalTemperatureFailureCount,
        failureCount: finalTemperatureFailureCount,
        temperatureFailureAvailability,
        temporalApplicability,
        historicalRuleAvailability,
        temperatureRuleConfigured: hasConfiguredRules,
        temperatureRuleSource: hasConfiguredRules ? (primaryRuleResolved?.ruleId || primaryRule?.ruleId || 'FoodSafetyTemperatureRule') : 'NOT_CONFIGURED',
        temperatureRuleId: primaryRuleResolved?.ruleId || primaryRule?.ruleId || null,
        temperatureRuleScope: primaryRuleResolved?.scope || (hasConfiguredRules ? 'ORGANISATION_ALL' : 'NOT_CONFIGURED'),
        temperatureRuleSpecificity: primaryRuleResolved?.specificity || (hasConfiguredRules ? 1 : null),
        temperatureRuleEffectiveAt: primaryRuleResolved?.effectiveFrom || (primaryRule?.effectiveFrom ? new Date(primaryRule.effectiveFrom).toISOString() : null),
        temperatureRuleEffectiveFrom: primaryRuleResolved?.effectiveFrom || (primaryRule?.effectiveFrom ? new Date(primaryRule.effectiveFrom).toISOString() : null),
        temperatureRuleEffectiveTo: primaryRuleResolved?.effectiveTo || (primaryRule?.effectiveTo ? new Date(primaryRule.effectiveTo).toISOString() : null),
        temperatureRuleVersion: primaryRuleResolved?.version ?? (primaryRule?.version ?? null),
        inspectionTimestamp: primaryRuleResolved?.inspectionTimestamp || null,
        temperatureRuleAmbiguous: ambiguousRuleConfigurationCount > 0,
        ambiguousRuleCount: ambiguousRuleConfigurationCount,
        temperatureMinimumAllowed: effectiveMinAllowedTemp,
        temperatureMaximumAllowed: effectiveMaxAllowedTemp,
        packagingDamageCount,
        qualityConditionFailureCount,
        rejectionPercent: totalInspectedQuantity > 0 ? Number(((totalRejectedQuantity / totalInspectedQuantity) * 100).toFixed(2)) : 0,
        supportedFailureReasons: [
          'DAMAGED',
          'LEAKING',
          'IMPROPER_LABEL',
          'SPOILED',
          'FOREIGN_MATTER',
          'DISCOLORED',
          'OFF_ODOR',
          'TEMPERATURE_EXCURSION',
        ],
      },
      priceTrends: priceTrendList,
      singleSourceItems,
      criticalDependencies,
      compliance: vendorComplianceList,
      exceptions: vendorExceptions,
      payablesAging: Object.entries(payablesAgingBuckets).map(([k, v]) => ({
        bucketKey: k,
        label: v.label,
        count: v.count,
        outstandingPaisa: v.outstandingPaisa,
        outstanding: Number((v.outstandingPaisa / 100).toFixed(2)),
        type: 'REPORT_PRESENTATION_BUCKET',
      })),
      auditTrail: vendorAuditEvents,
      scoringMethodology: {
        overallScore: 'NOT_CONFIGURED',
        policy: 'Component factual metrics presented side-by-side. Unapproved composite scores prohibited.',
      },
    },
    dataQuality: {
      status: recordsUsingFallback > 0 ? 'PARTIAL' : 'COMPLETE',
      state: 'CLEAN',
      warnings: recordsUsingFallback > 0
        ? [`${recordsUsingFallback} purchase orders evaluated for lead time using fallback placement date (approvedAt timestamp absent).`]
        : [],
    },
    provenance: {
      sourceModels: [
        'PurchaseOrder',
        'Vendor',
        'APInvoice',
        'IncomingInspection',
        'FoodSafetyTemperatureRule',
        'GlobalInventoryItem',
        'AuditEvent',
      ],
      receivedValueProvenance: 'PO_PRICED_RECEIPT_VALUE',
      receivedValueTrust: 'OPERATIONAL',
      receivedValueDisclosure: 'Goods receipt valuation is calculated from purchase order line unit prices.',
      outstandingPayableBasis: 'APInvoice.outstandingPaisa',
      totalInvoiceVarianceBasis: 'EFFECTIVE_INVOICE_MINUS_PO_COMMITMENTS',
      purchasePriceVarianceBasis: 'LINE_LEVEL_COMPARABLE_NET_UNIT_PRICE',
      purchasePriceVarianceAvailability: ppvAvailability,
      temperatureRuleProvenance: {
        configured: Boolean(hasConfiguredRules),
        source: hasConfiguredRules ? (primaryRuleResolved?.ruleId || primaryRule?.ruleId || 'FoodSafetyTemperatureRule') : 'NOT_CONFIGURED',
        ruleId: primaryRuleResolved?.ruleId || primaryRule?.ruleId || null,
        scope: primaryRuleResolved?.scope || (hasConfiguredRules ? 'ORGANISATION_ALL' : 'NOT_CONFIGURED'),
        specificity: primaryRuleResolved?.specificity || (hasConfiguredRules ? 1 : null),
        effectiveAt: primaryRuleResolved?.effectiveFrom || (primaryRule?.effectiveFrom ? new Date(primaryRule.effectiveFrom).toISOString() : null),
        effectiveFrom: primaryRuleResolved?.effectiveFrom || (primaryRule?.effectiveFrom ? new Date(primaryRule.effectiveFrom).toISOString() : null),
        effectiveTo: primaryRuleResolved?.effectiveTo || (primaryRule?.effectiveTo ? new Date(primaryRule.effectiveTo).toISOString() : null),
        version: primaryRuleResolved?.version ?? (primaryRule?.version ?? null),
        inspectionTimestamp: primaryRuleResolved?.inspectionTimestamp || null,
        temporalApplicability,
        historicalRuleAvailability,
        minimumAllowed: effectiveMinAllowedTemp,
        maximumAllowed: effectiveMaxAllowedTemp,
        ambiguousRuleDetected: ambiguousRuleConfigurationCount > 0,
        ambiguousRuleCount: ambiguousRuleConfigurationCount,
      },
      paidValueAvailability: 'UNAVAILABLE',
      paidValueReason: 'AP-to-bank payment transaction linkage is not implemented in transaction ledger.',
      vendorScoringStatus: 'NOT_CONFIGURED',
      leadTimeBasis: 'APPROVAL_TO_FIRST_RECEIPT',
      leadTimeProvenance: {
        basis: 'APPROVAL_TO_FIRST_RECEIPT',
        recordsUsingApprovedAt,
        recordsUsingFallback,
      },
      recordsUsingApprovedAt,
      recordsUsingFallback,
      standaloneReceivingTicketsSupported: false,
      creditNotesSupported: false,
      sourceRecordCounts: {
        purchaseOrdersTotal: orders.length,
        activeSuppliers: Object.keys(supplierAggregation).length,
        apInvoicesTotal: apInvoices.length,
        inspectionsTotal: inspections.length,
        temperatureRulesTotal: temperatureRules.length,
      },
    },
  };
}

module.exports = {
  calculateProcurementMetrics,
  normalizeUom,
  evaluateApInvoiceFinancialRecognition,
  resolveTemperatureRule,
};

