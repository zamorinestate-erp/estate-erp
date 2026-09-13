'use strict';

/**
 * ZAMORIN CAFÉ ERP — REPORTING FOUNDATION
 * Module: reportingDataQuality.js
 * 
 * Canonical Data Quality & Actuality Semantics:
 * - Governs metric actuality: ACTUAL, ESTIMATED, FORECAST, SIMULATED, UNAVAILABLE
 * - Governs data quality: COMPLETE, PARTIAL, STALE, UNAVAILABLE, ERROR
 * - Strict rule: Zero (0) must never masquerade as Unknown / Unavailable.
 */

const ACTUALITY_STATES = {
  ACTUAL: {
    code: 'ACTUAL',
    label: 'Authoritative Actual',
    description: 'Derived from finalized, posted double-entry or transactional ledger records.',
  },
  ESTIMATED: {
    code: 'ESTIMATED',
    label: 'Engineered Estimate',
    description: 'Derived from standard recipe BOMs, estimated averages, or algorithmic approximations.',
  },
  FORECAST: {
    code: 'FORECAST',
    label: 'Forward Projection',
    description: 'Statistical or trend-based future expectation.',
  },
  SIMULATED: {
    code: 'SIMULATED',
    label: 'Scenario Simulation',
    description: 'What-if parametric model without transactional basis.',
  },
  UNAVAILABLE: {
    code: 'UNAVAILABLE',
    label: 'Source Unavailable',
    description: 'Canonical calculation source is absent, unposted, or unconfigured in the ERP.',
  },
};

const DATA_QUALITY_STATUSES = {
  COMPLETE: {
    status: 'COMPLETE',
    label: 'Complete & Reconciled',
    completenessScore: 1.0,
    description: 'All underlying tills, registers, and sub-ledgers for this period are closed and balanced.',
  },
  PARTIAL: {
    status: 'PARTIAL',
    label: 'Partial Data Recorded',
    completenessScore: null, // Numerical score calculated only when measurable source completeness exists
    description: 'Some café registers remain open or pending reconciliation; numbers subject to minor adjustments.',
  },
  STALE: {
    status: 'STALE',
    label: 'Replication Lag Detected',
    completenessScore: null,
    description: 'Data has exceeded the configured freshness threshold for this domain.',
  },
  UNAVAILABLE: {
    status: 'UNAVAILABLE',
    label: 'No Authoritative Source',
    completenessScore: null,
    description: 'Required posting ledger or canonical accounting source is not implemented.',
  },
  ERROR: {
    status: 'ERROR',
    label: 'Invariant Violation / Pipeline Error',
    completenessScore: null,
    description: 'Aggregation pipeline failed or detected an internal balance discrepancy.',
  },
};

/**
 * Standard data freshness SLAs by report domain (in seconds).
 * Designated as a PROPOSED_DEFAULT template until tenant SLA configurations are stored.
 */
const DEFAULT_FRESHNESS_SLAS = Object.freeze({
  SALES: 300,        // 5 minutes for live POS sales
  CASH: 300,         // 5 minutes for cash book & register sessions
  OPERATIONS: 600,   // 10 minutes for KDS and speed of service
  INVENTORY: 3600,   // 1 hour for stock movements
  WORKFORCE: 3600,   // 1 hour for attendance punches
  FINANCE: 86400,    // 24 hours for daily financial reconciliation
  GOVERNANCE: 86400, // 24 hours for audit and scorecards
});

const FRESHNESS_SLA_TEMPLATE = Object.freeze({
  template: 'PROPOSED_DEFAULT',
  configurationSource: 'NOT_CONFIGURED',
  isConfigured: false,
  freshnessStatus: 'UNASSESSED',
  slas: DEFAULT_FRESHNESS_SLAS,
});

/**
 * Validates whether an actuality code is canonical.
 * @param {string} code
 * @returns {boolean}
 */
function isValidActuality(code) {
  return Object.prototype.hasOwnProperty.call(ACTUALITY_STATES, String(code).toUpperCase());
}

/**
 * Evaluates the overall report data quality status from operational signals.
 * @param {object} params
 * @param {boolean} [params.hasData=true]
 * @param {string[]} [params.missingSources=[]]
 * @param {boolean} [params.isStale=false]
 * @param {boolean} [params.hasOpenRegisters=false]
 * @param {number|null} [params.measurableClosedCount=null]
 * @param {number|null} [params.measurableTotalCount=null]
 * @param {string} [params.domain='SALES']
 * @param {number|null} [params.expectedFreshnessSeconds=null]
 * @param {Date|string|null} [params.lastSuccessfulUpdate=null]
 * @param {number|null} [params.observedLagSeconds=null]
 * @param {Error|null} [params.error=null]
 * @returns {{ status: string, label: string, completenessScore: number|null, missingSources: string[], freshness: object }}
 */
function resolveDataQuality({
  hasData = true,
  missingSources = [],
  isStale = false,
  hasOpenRegisters = false,
  measurableClosedCount = null,
  measurableTotalCount = null,
  hasPartialRefundsWithoutPreTax = false,
  partialRefundCount = 0,
  affectedBillCount = 0,
  legacyInsufficientBillsCount = 0,
  warnings = [],
  domain = 'SALES',
  expectedFreshnessSeconds = null,
  lastSuccessfulUpdate = null,
  observedLagSeconds = null,
  error = null,
} = {}) {
  // Freshness calculation
  const hasConfiguredSla = typeof expectedFreshnessSeconds === 'number' && expectedFreshnessSeconds > 0;
  const targetSla = hasConfiguredSla ? expectedFreshnessSeconds : (DEFAULT_FRESHNESS_SLAS[String(domain).toUpperCase()] || 300);
  let lag = observedLagSeconds;
  if (lag === null && lastSuccessfulUpdate) {
    const updateTime = new Date(lastSuccessfulUpdate).getTime();
    if (!Number.isNaN(updateTime)) {
      lag = Math.max(0, Math.floor((Date.now() - updateTime) / 1000));
    }
  }

  const effectiveIsStale = isStale || (lag !== null && lag > targetSla);

  let freshnessStatus;
  if (!hasConfiguredSla) {
    freshnessStatus = 'UNASSESSED';
  } else if (lag !== null) {
    freshnessStatus = lag <= targetSla ? 'COMPLIANT' : 'BREACHED';
  } else {
    freshnessStatus = effectiveIsStale ? 'BREACHED' : 'COMPLIANT';
  }

  const freshness = {
    domain: String(domain).toUpperCase(),
    template: 'PROPOSED_DEFAULT',
    configurationSource: hasConfiguredSla ? 'CONFIGURED' : 'NOT_CONFIGURED',
    isConfigured: hasConfiguredSla,
    freshnessStatus,
    expectedFreshnessSeconds: targetSla,
    lastSuccessfulUpdate: lastSuccessfulUpdate ? new Date(lastSuccessfulUpdate).toISOString() : null,
    observedLagSeconds: lag,
    isWithinSla: lag !== null ? lag <= targetSla : !effectiveIsStale,
  };

  // Measurable completeness calculation (only calculated when genuine source measures exist)
  let calculatedCompleteness = null;
  if (typeof measurableClosedCount === 'number' && typeof measurableTotalCount === 'number' && measurableTotalCount > 0) {
    calculatedCompleteness = Number(Math.min(1.0, Math.max(0.0, measurableClosedCount / measurableTotalCount)).toFixed(2));
  }

  if (error) {
    return {
      ...DATA_QUALITY_STATUSES.ERROR,
      completenessScore: null,
      missingSources,
      freshness,
      errorMessage: error.message || 'Unknown pipeline error',
    };
  }

  if (missingSources && missingSources.length > 0) {
    return {
      ...DATA_QUALITY_STATUSES.UNAVAILABLE,
      completenessScore: null,
      missingSources,
      freshness,
    };
  }

  if (!hasData) {
    return {
      ...DATA_QUALITY_STATUSES.COMPLETE,
      completenessScore: 1.0,
      missingSources: [],
      freshness,
      note: 'Truthful zero state; no activity recorded.',
    };
  }

  // Handle partial refunds without line-item tax allocations or legacy bills with missing fields
  const hasPartialRefundIssue = hasPartialRefundsWithoutPreTax || partialRefundCount > 0;
  const hasLegacyIssue = legacyInsufficientBillsCount > 0;

  if (hasPartialRefundIssue || hasLegacyIssue) {
    const activeWarnings = [...warnings];
    let warningCode = null;
    if (hasPartialRefundIssue) {
      activeWarnings.push('PARTIAL_REFUND_PRE_TAX_UNKNOWN');
      warningCode = 'PARTIAL_REFUND_PRE_TAX_UNKNOWN';
    }
    if (hasLegacyIssue) {
      activeWarnings.push('LEGACY_BILL_INSUFFICIENT_GROSS_SALES_FIELDS');
      warningCode = warningCode || 'LEGACY_BILL_INSUFFICIENT_GROSS_SALES_FIELDS';
    }

    return {
      ...DATA_QUALITY_STATUSES.PARTIAL,
      completenessScore: calculatedCompleteness,
      completenessRatio: calculatedCompleteness,
      missingSources: [],
      freshness,
      freshnessSlas: DEFAULT_FRESHNESS_SLAS,
      partialRefundCount: partialRefundCount || 0,
      affectedBillCount: affectedBillCount || partialRefundCount || legacyInsufficientBillsCount || 0,
      legacyInsufficientBillsCount: legacyInsufficientBillsCount || 0,
      warningCode,
      warnings: activeWarnings,
    };
  }

  if (effectiveIsStale) {
    return {
      ...DATA_QUALITY_STATUSES.STALE,
      completenessScore: calculatedCompleteness,
      completenessRatio: calculatedCompleteness,
      missingSources: [],
      freshness,
      freshnessSlas: DEFAULT_FRESHNESS_SLAS,
    };
  }

  if (hasOpenRegisters || (calculatedCompleteness !== null && calculatedCompleteness < 1.0)) {
    return {
      ...DATA_QUALITY_STATUSES.PARTIAL,
      completenessScore: calculatedCompleteness, // Null unless measurable counts provided
      completenessRatio: calculatedCompleteness,
      missingSources: [],
      freshness,
      freshnessSlas: DEFAULT_FRESHNESS_SLAS,
    };
  }

  return {
    ...DATA_QUALITY_STATUSES.COMPLETE,
    completenessScore: calculatedCompleteness !== null ? calculatedCompleteness : 1.0,
    completenessRatio: calculatedCompleteness,
    missingSources: [],
    freshness,
    freshnessSlas: DEFAULT_FRESHNESS_SLAS,
  };
}

module.exports = {
  ACTUALITY_STATES,
  DATA_QUALITY_STATUSES,
  DEFAULT_FRESHNESS_SLAS,
  FRESHNESS_SLA_TEMPLATE,
  isValidActuality,
  resolveDataQuality,
};
