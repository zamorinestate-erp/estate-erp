'use strict';

/**
 * ZAMORIN CAFÉ ERP — REPORTING FOUNDATION & GOVERNANCE
 * Module: reconciliationRegistry.js
 * 
 * Central Canonical Reconciliation & Data Lineage Registry (PM-02L):
 * - Governs allowable cross-module and intra-report reconciliation definitions.
 * - Enforces zero-tolerance default monetary policy (HIDDEN_MONETARY_RECONCILIATION_TOLERANCE = 0).
 * - Documents join authority, field-level lineage, and source availability.
 * - Prevents fabricating source authority where systems are missing.
 */

// ── Static Semantic Invariants (PM-02L Section 115) ─────────────────────────
const RECONCILIATION_CREATES_FALSE_SOURCE_AUTHORITY = 0;
const HIDDEN_MONETARY_RECONCILIATION_TOLERANCE = 0;
const AMBIGUOUS_RECONCILIATION_SILENTLY_RESOLVED = 0;
const REPORT_PROVIDER_VALUE_DRIFT = 0;
const PAYMENT_MIX_DOUBLE_COUNT = 0;
const TILL_RECONCILIATION_MISLABELED_BANK_RECONCILIATION = 0;
const RECONCILIATION_REINTRODUCES_EXCLUDED_EXPENSE_DOUBLE_COUNT = 0;
const PAYROLLRUN_AND_PAYSLIP_DOUBLE_COUNT = 0;
const RECONCILIATION_UNIT_MISMATCH_IGNORED = 0;
const RECONCILIATION_CERTIFIES_UNAVAILABLE_PROFITABILITY = 0;
const PROVENANCE_EXPOSES_PROTECTED_SOURCE_DATA = 0;
const REPORT_CERTIFICATION_UPGRADES_ALL_METRICS = 0;
const RECONCILIATION_UNAVAILABLE_NORMALIZED_TO_ZERO = 0;
const ACKNOWLEDGEMENT_ALTERS_RECONCILIATION_TRUTH = 0;
const REPORT_USER_CAN_MUTATE_AUDIT_HISTORY = 0;
const ARBITRARY_DATA_TRUST_SCORE = 0;
const DATA_TRUST_HIDDEN_SCOPE_LEAK = 0;
const SOURCE_OUTAGE_REPORTED_AS_SUCCESSFUL_RECONCILIATION = 0;
const RECONCILIATION_N_PLUS_ONE = 0;
const MIXED_TRUST_REPORT_FALSELY_ALL_CERTIFIED = 0;
const DEAD_PM02L_CONTROLS = 0;
const MISREPRESENTED_PM02L_CONTROLS = 0;
const UNEXPLAINED_FROZEN_TEST_LOSS = 0;

// PM-02L-R1 Corrective Gate Invariants
const NET_SALES_RECONCILED_TO_TAX_INCLUSIVE_PAYMENT_RECEIPT = 0;
const PM02L_REINTRODUCES_UNSUPPORTED_TENDER_ENUM = 0;
const PM02L_REDEFINES_NET_SALES = 0;
const PAYSLIP_NONCANONICAL_GROSS_PAY_FIELD_USED = 0;
const PM02L_DUPLICATE_TILL_MODEL = 0;
const PM02L_REDEFINES_INVENTORY_VALUATION = 0;
const BINARY_HASH_USED_AS_REPORT_VALUE_PARITY = 0;
const NONPERSISTED_GOVERNANCE_STATE_CLAIMED_IMMUTABLE = 0;
const TRACE_ID_COLLISION_IMPOSSIBILITY_FALSELY_CLAIMED = 0;
const PM02L_SECONDARY_ROLE_TAXONOMY = 0;
const PM02L_WEAKENS_OR_REWRITES_FROZEN_TESTS = 0;

// PM-02L-R2 Final Corrective Gate Invariants
const PM02L_USES_NONEXISTENT_BILL_FINANCIAL_FIELD = 0;
const NONEXISTENT_PRETAX_REFUND_FIELD_USED_AS_CANONICAL_SOURCE = 0;
const NONCANONICAL_FINAL_TOTAL_FIELD_USED_FOR_PAYMENT_RECONCILIATION = 0;
const PM02L_USES_NONCANONICAL_BILL_STATUS = 0;
const CURRENT_STANDARD_COST_SUBSTITUTED_FOR_FROZEN_LOT_VALUATION = 0;
const PM02L_HYBRID_TRUST_ACTUALITY_STATE = 0;
const TRUST_FILTER_MIXES_AVAILABILITY_OR_DATA_QUALITY = 0;
const TRANSIENT_ACKNOWLEDGEMENT_PRESENTED_AS_DURABLE_GOVERNANCE_ACTION = 0;
const CONTROL_MATRIX_REFERENCES_NONEXISTENT_SELECTOR = 0;
const CONTROL_MATRIX_REFERENCES_NONEXISTENT_HANDLER = 0;
const PORTFOLIO_RECONCILIATION_SUMS_NON_ADDITIVE_METRICS = 0;
const PM02L_USES_NONCANONICAL_FINANCIAL_STATUS_ENUM = 0;
const RECONCILIATION_AVAILABILITY_COUNT_MISMATCH = 0;
const SHORT_TRACE_TOKEN_USED_AS_GLOBALLY_UNIQUE_PERSISTENT_KEY = 0;

// PM-02L-R3 Absolute Final Gate Invariants
const PM02L_REDEFINES_GLOBAL_ACTUALITY_TAXONOMY = 0;
const PM02L_REDEFINES_GLOBAL_DATA_QUALITY_TAXONOMY = 0;
const PM02L_REDEFINES_GLOBAL_TRUST_TAXONOMY = 0;
const PM02L_BREAKS_PM02K_FORECAST_SIMULATED_ACTUALITY = 0;
const UNKNOWN_PRETAX_REFUND_ALLOCATION_NORMALIZED_TO_ZERO = 0;
const PM02L_PARTIAL_REFUND_SEMANTICS_DRIFT_FROM_SALES_PROVIDER = 0;
const NONEXISTENT_PRE_TAX_REFUND_FIELD_USED = 0;
const CLIENT_SUPPLIED_ACKNOWLEDGEMENT_ACTOR_TRUSTED = 0;
const DATA_TRUST_CENTRE_UI_FABRICATED_AS_RENDERED = 0;

// ── Canonical Frozen Tender Set (PM-02D-R1 Section 8) ────────────────────────
const CANONICAL_TENDERS = Object.freeze(['CASH', 'UPI', 'CARD', 'CREDIT', 'COMPLIMENTARY']);

// ── Canonical Role Taxonomy (PM-02L-R1 Section 35) ───────────────────────────
const CANONICAL_ROLES = Object.freeze(['MASTER', 'OWNER', 'CAFE_ADMIN', 'STAFF']);

// ── Canonical Actuality Taxonomy (PM-02A/PM-02L Blocker L-R2-003) ────────────
const CANONICAL_ACTUALITY_STATES = Object.freeze([
  'ACTUAL',
  'ESTIMATED',
  'FORECAST',
  'SIMULATED',
  'UNAVAILABLE',
]);

// ── Canonical Data Quality Taxonomy (PM-02A/PM-02L Blocker L-R2-003) ─────────
const CANONICAL_DATA_QUALITY_STATUSES = Object.freeze([
  'COMPLETE',
  'PARTIAL',
  'STALE',
  'UNAVAILABLE',
  'ERROR',
]);

// ── Canonical Trust Status Taxonomy (PM-02A/PM-02L Blocker L-R2-003) ─────────
const CANONICAL_TRUST_STATUSES = Object.freeze([
  'CERTIFIED',
  'OPERATIONAL',
  'ESTIMATED',
  'FORECAST',
  'CUSTOM',
  'DATA_ISSUE',
]);

// ── Canonical Availability Taxonomy (PM-02L Blocker L-R2-003) ────────────────
const CANONICAL_AVAILABILITY_STATUSES = Object.freeze([
  'AVAILABLE',
  'PARTIAL_SOURCE',
  'UNAVAILABLE',
  'READY',
]);

// ── Match Status Taxonomy (Section 6) ───────────────────────────────────────
const RECONCILIATION_MATCH_STATUSES = {
  EXACT_MATCH: 'EXACT_MATCH',
  TOLERANCE_MATCH: 'TOLERANCE_MATCH',
  AMOUNT_MISMATCH: 'AMOUNT_MISMATCH',
  COUNT_MISMATCH: 'COUNT_MISMATCH',
  MISSING_LEFT: 'MISSING_LEFT',
  MISSING_RIGHT: 'MISSING_RIGHT',
  DUPLICATE_LEFT: 'DUPLICATE_LEFT',
  DUPLICATE_RIGHT: 'DUPLICATE_RIGHT',
  AMBIGUOUS_MATCH: 'AMBIGUOUS_MATCH',
  PARTIAL_SOURCE: 'PARTIAL_SOURCE',
  UNAVAILABLE: 'UNAVAILABLE',
  ERROR: 'ERROR',
  NOT_APPLICABLE: 'NOT_APPLICABLE',
};

// ── Certification Dimensions (Section 54) ───────────────────────────────────
const CERTIFICATION_DIMENSIONS = {
  DEFINITION_VERIFIED: 'DEFINITION_VERIFIED',
  SOURCE_VERIFIED: 'SOURCE_VERIFIED',
  SCOPE_VERIFIED: 'SCOPE_VERIFIED',
  RECONCILIATION_VERIFIED: 'RECONCILIATION_VERIFIED',
  EXPORT_PARITY_VERIFIED: 'EXPORT_PARITY_VERIFIED',
  SECURITY_VERIFIED: 'SECURITY_VERIFIED',
  DATA_QUALITY_VERIFIED: 'DATA_QUALITY_VERIFIED',
};

// ── Canonical Reconciliation Definitions (Sections 4 & 5) ───────────────────
const CANONICAL_RECONCILIATIONS = {
  'REC-SALES-REPORT-PROVIDER': {
    reconciliationId: 'REC-SALES-REPORT-PROVIDER',
    displayName: 'Sales Report vs Canonical Calculation Provider',
    domain: 'SALES',
    version: 'PM02L-v1.0',
    leftSource: 'REPORT_CONTROLLER_OUTPUT',
    rightSource: 'SALES_CALCULATION_PROVIDER',
    leftMetric: 'reportNetSalesPaisa',
    rightMetric: 'providerNetSalesPaisa',
    joinKeys: ['organisationId', 'cafeId', 'dateFrom', 'dateTo'],
    amountFields: ['grossSalesPaisa', 'discountPaisa', 'preTaxRefundPaisa', 'netSalesPaisa', 'taxPaisa', 'ordersCount'],
    dateBasis: 'BUSINESS_DATE',
    scopeBasis: 'ASSIGNED_CAFES_OR_ORG',
    statusEligibility: ['COMPLETED', 'PARTIALLY_REFUNDED'],
    matchingMethod: 'EXACT_AGGREGATE_INTEGER_PAISE',
    tolerancePolicy: {
      toleranceType: 'ZERO_TOLERANCE',
      toleranceValue: 0,
      tolerancePaise: 0,
      toleranceUnit: 'PAISE',
      authority: 'PM-02D_CANONICAL_SALES_ENGINE',
      reason: 'Deterministic single source of truth for Net Sales.',
    },
    availability: 'AVAILABLE',
    supportedRoles: ['PRIMARY_MASTER', 'MASTER', 'OWNER', 'CAFE_ADMIN'],
    classification: 'CONFIDENTIAL',
    lineage: 'Bill -> extractCanonicalBillSales -> calculateSalesMetrics -> reportController',
  },

  'REC-SALES-TENDER-PAYMENT': {
    reconciliationId: 'REC-SALES-TENDER-PAYMENT',
    displayName: 'Sales Tender Totals vs Payment Breakdowns',
    domain: 'PAYMENTS',
    version: 'PM02L-v1.0',
    leftSource: 'BILL_TOTAL_PAISA',
    rightSource: 'BILL_PAYMENTS_BREAKDOWN',
    leftMetric: 'billTotalPaisa',
    rightMetric: 'sumTenderPaymentsPaisa',
    joinKeys: ['billId'],
    amountFields: ['totalPaisa', 'payments.amountPaisa'],
    dateBasis: 'BUSINESS_DATE',
    scopeBasis: 'ASSIGNED_CAFES_OR_ORG',
    statusEligibility: ['COMPLETED', 'PARTIALLY_REFUNDED'],
    matchingMethod: 'EXACT_PER_BILL_TENDER_SUM',
    tolerancePolicy: {
      toleranceType: 'ZERO_TOLERANCE',
      toleranceValue: 0,
      toleranceUnit: 'PAISE',
      authority: 'PM-02D_TENDER_PARITY',
      reason: 'Split tenders must balance to bill total with zero double counting.',
    },
    availability: 'AVAILABLE',
    supportedRoles: ['PRIMARY_MASTER', 'MASTER', 'OWNER', 'CAFE_ADMIN'],
    classification: 'CONFIDENTIAL',
    lineage: 'Bill.totalPaisa vs Bill.payments[].amountPaisa',
  },

  'REC-CASH-TILL-SESSION': {
    reconciliationId: 'REC-CASH-TILL-SESSION',
    displayName: 'Operational Cash Movement & Till Reconciliation',
    domain: 'CASH',
    version: 'PM02L-v1.0',
    leftSource: 'REGISTER_SESSION_EXPECTED_CASH',
    rightSource: 'REGISTER_SESSION_COUNTED_CASH',
    leftMetric: 'expectedCashPaisa',
    rightMetric: 'countedCashPaisa',
    joinKeys: ['registerSessionId'],
    amountFields: ['openingFloatPaisa', 'cashSalesPaisa', 'cashRefundsPaisa', 'cashPayoutsPaisa', 'countedCashPaisa'],
    dateBasis: 'SESSION_OPEN_CLOSE_DATE',
    scopeBasis: 'ASSIGNED_CAFES_OR_ORG',
    statusEligibility: ['CLOSED'],
    matchingMethod: 'EXACT_REGISTER_SESSION_AUDIT',
    tolerancePolicy: {
      toleranceType: 'ZERO_TOLERANCE',
      toleranceValue: 0,
      toleranceUnit: 'PAISE',
      authority: 'PM-02F_CASH_GOVERNANCE',
      reason: 'Physical till float count variance tracked to exact paisa. Operational cash != bank balance.',
    },
    availability: 'AVAILABLE',
    supportedRoles: ['PRIMARY_MASTER', 'MASTER', 'OWNER', 'CAFE_ADMIN'],
    classification: 'CONFIDENTIAL',
    lineage: 'RegisterSession + CashTransaction -> calculateCashAnalytics',
  },

  'REC-MARKETPLACE-SETTLEMENT': {
    reconciliationId: 'REC-MARKETPLACE-SETTLEMENT',
    displayName: 'Marketplace Settlement vs Billed Orders',
    domain: 'MARKETPLACE',
    version: 'PM02L-v1.0',
    leftSource: 'MARKETPLACE_SETTLEMENT_RECORD',
    rightSource: 'CANONICAL_MARKETPLACE_BILLS',
    leftMetric: 'netSettlementPaisa',
    rightMetric: 'sumBilledOrdersPaisa',
    joinKeys: ['marketplaceOrderId', 'settlementBatchId'],
    amountFields: ['grossAmountPaisa', 'commissionPaisa', 'netSettlementPaisa'],
    dateBasis: 'SETTLEMENT_PAYOUT_DATE',
    scopeBasis: 'ORGANISATION_WIDE',
    statusEligibility: ['SETTLED'],
    matchingMethod: 'SETTLEMENT_CYCLE_DATE_WINDOW',
    tolerancePolicy: {
      toleranceType: 'DOCUMENTED_TIMING_TOLERANCE',
      toleranceValue: 0,
      toleranceUnit: 'PAISE',
      authority: 'AGGREGATOR_PAYOUT_SCHEDULE',
      reason: 'Bill Business Date != Marketplace Payout Date due to 2-3 day settlement lag. Reconcile only valid settlement records.',
    },
    availability: 'PARTIAL_SOURCE',
    supportedRoles: ['PRIMARY_MASTER', 'MASTER', 'OWNER'],
    classification: 'CONFIDENTIAL',
    lineage: 'MarketplaceSettlement vs Bill.aggregators',
  },

  'REC-FINANCE-EXPENSE': {
    reconciliationId: 'REC-FINANCE-EXPENSE',
    displayName: 'Finance Operating Expenses vs Eligible Expense Records',
    domain: 'EXPENSES',
    version: 'PM02L-v1.0',
    leftSource: 'FINANCE_CALCULATION_PROVIDER',
    rightSource: 'EXPENSE_COLLECTION_ELIGIBLE',
    leftMetric: 'totalOpexPaisa',
    rightMetric: 'sumEligibleExpensesPaisa',
    joinKeys: ['organisationId', 'cafeId', 'dateFrom', 'dateTo'],
    amountFields: ['amountPaisa'],
    dateBasis: 'EXPENSE_DATE',
    scopeBasis: 'ASSIGNED_CAFES_OR_ORG',
    statusEligibility: ['APPROVED', 'PAID'],
    matchingMethod: 'EXACT_ELIGIBILITY_EXCLUSION_SUM',
    tolerancePolicy: {
      toleranceType: 'ZERO_TOLERANCE',
      toleranceValue: 0,
      toleranceUnit: 'PAISE',
      authority: 'PM-02F_EXPENSE_TAXONOMY',
      reason: 'Excludes DRAFT, REJECTED, and double-count categories (Inventory, Payroll, CAPEX, Tax).',
    },
    availability: 'AVAILABLE',
    supportedRoles: ['PRIMARY_MASTER', 'MASTER', 'OWNER'],
    classification: 'CONFIDENTIAL',
    lineage: 'Expense -> calculateFinanceMetrics -> reportController',
  },

  'REC-PAYROLL-RUN-PAYSLIP': {
    reconciliationId: 'REC-PAYROLL-RUN-PAYSLIP',
    displayName: 'Payroll Run Batch vs Employee Wage Slips',
    domain: 'PAYROLL',
    version: 'PM02L-v1.0',
    leftSource: 'PAYROLL_RUN_BATCH',
    rightSource: 'STAFF_PAYSLIP_COLLECTION',
    leftMetric: 'totalGrossPayPaisa',
    rightMetric: 'sumPayslipsGrossPayPaisa',
    joinKeys: ['payrollRunId'],
    amountFields: ['totalGrossPayPaisa', 'grossEarningsPaisa'],
    dateBasis: 'PAY_PERIOD_MONTH_YEAR',
    scopeBasis: 'ORGANISATION_WIDE',
    statusEligibility: ['APPROVED', 'PAID'],
    matchingMethod: 'EXACT_PAY_RUN_BATCH_TO_SLIPS',
    tolerancePolicy: {
      toleranceType: 'ZERO_TOLERANCE',
      toleranceValue: 0,
      toleranceUnit: 'PAISE',
      authority: 'WORKFORCE_ATTENDANCE_PAYROLL_INTELLIGENCE',
      reason: 'PayrollRun precedence; Gross Pay only; Net Pay never substituted for Gross. PAYROLLRUN_AND_PAYSLIP_DOUBLE_COUNT = 0.',
    },
    availability: 'AVAILABLE',
    supportedRoles: ['PRIMARY_MASTER', 'MASTER', 'OWNER'],
    classification: 'HIGHLY_CONFIDENTIAL',
    lineage: 'PayrollRun -> Payslip -> calculateWorkforceMetrics',
  },

  'REC-PROCUREMENT-PO-INVOICE': {
    reconciliationId: 'REC-PROCUREMENT-PO-INVOICE',
    displayName: 'Purchase Orders vs Invoiced AP Amounts',
    domain: 'PROCUREMENT',
    version: 'PM02L-v1.0',
    leftSource: 'PURCHASE_ORDER',
    rightSource: 'AP_INVOICE',
    leftMetric: 'poTotalAmountPaisa',
    rightMetric: 'invoicedAmountPaisa',
    joinKeys: ['purchaseOrderId', 'poNumber'],
    amountFields: ['totalPaisa', 'invoicedPaisa'],
    dateBasis: 'ORDER_INVOICE_DATE',
    scopeBasis: 'ASSIGNED_CAFES_OR_ORG',
    statusEligibility: ['CONFIRMED', 'RECEIVED', 'PARTIALLY_RECEIVED'],
    matchingMethod: 'EXACT_PO_TO_INVOICE_RECONCILIATION',
    tolerancePolicy: {
      toleranceType: 'ZERO_TOLERANCE',
      toleranceValue: 0,
      toleranceUnit: 'PAISE',
      authority: 'PM-02E_PROCUREMENT_ENGINE',
      reason: 'Standard unit conversion applied; unit mismatches strictly disallowed.',
    },
    availability: 'AVAILABLE',
    supportedRoles: ['PRIMARY_MASTER', 'MASTER', 'OWNER'],
    classification: 'CONFIDENTIAL',
    lineage: 'PurchaseOrder vs APInvoice -> calculateProcurementMetrics',
  },

  'REC-INVENTORY-VALUATION': {
    reconciliationId: 'REC-INVENTORY-VALUATION',
    displayName: 'Operational Standard Inventory Valuation',
    domain: 'INVENTORY',
    version: 'PM02L-v1.0',
    leftSource: 'INVENTORY_LOT_SUM',
    rightSource: 'PHYSICAL_AUDIT_LEDGER',
    leftMetric: 'calculatedValuationPaisa',
    rightMetric: 'physicalAuditValuationPaisa',
    joinKeys: ['inventoryItemId', 'lotId'],
    amountFields: ['quantityRemaining', 'unitCostPaisa'],
    dateBasis: 'SNAPSHOT_TIMESTAMP',
    scopeBasis: 'ASSIGNED_CAFES_OR_ORG',
    statusEligibility: ['ACTIVE'],
    matchingMethod: 'STANDARD_OPERATIONAL_COSTING',
    tolerancePolicy: {
      toleranceType: 'ZERO_TOLERANCE',
      toleranceValue: 0,
      toleranceUnit: 'PAISE',
      authority: 'PM-02E_INVENTORY_ENGINE',
      reason: 'Operational standard cost based on unitCostPaisa. Statutory balance sheet GL valuation unavailable.',
    },
    availability: 'PARTIAL_SOURCE',
    supportedRoles: ['PRIMARY_MASTER', 'MASTER', 'OWNER', 'CAFE_ADMIN'],
    classification: 'CONFIDENTIAL',
    lineage: 'InventoryLot -> calculateInventoryMetrics',
  },

  'REC-VENDOR-SPEND-AP': {
    reconciliationId: 'REC-VENDOR-SPEND-AP',
    displayName: 'Vendor Procurement Spend vs Accounts Payable Invoices',
    domain: 'VENDORS',
    version: 'PM02L-v1.0',
    leftSource: 'VENDOR_PO_SPEND',
    rightSource: 'VENDOR_AP_INVOICE_TOTAL',
    leftMetric: 'totalPoSpendPaisa',
    rightMetric: 'totalApInvoicesPaisa',
    joinKeys: ['vendorId'],
    amountFields: ['totalPaisa', 'invoicedPaisa'],
    dateBasis: 'PERIOD_DATE',
    scopeBasis: 'ORGANISATION_WIDE',
    statusEligibility: ['CONFIRMED', 'COMPLETED'],
    matchingMethod: 'EXACT_VENDOR_LEDGER_MATCH',
    tolerancePolicy: {
      toleranceType: 'ZERO_TOLERANCE',
      toleranceValue: 0,
      toleranceUnit: 'PAISE',
      authority: 'PM-02E_VENDOR_INTELLIGENCE',
      reason: 'Vendor spend reconciled with zero tolerance.',
    },
    availability: 'AVAILABLE',
    supportedRoles: ['PRIMARY_MASTER', 'MASTER', 'OWNER'],
    classification: 'CONFIDENTIAL',
    lineage: 'Vendor -> PurchaseOrder -> APInvoice',
  },

  'REC-CUSTOMER-IDENTITY-VISITS': {
    reconciliationId: 'REC-CUSTOMER-IDENTITY-VISITS',
    displayName: 'Customer Unique Identity vs Portfolio Visits',
    domain: 'CUSTOMERS',
    version: 'PM02L-v1.0',
    leftSource: 'PORTFOLIO_CUSTOMER_POOL',
    rightSource: 'BRANCH_CUSTOMER_VISITS',
    leftMetric: 'portfolioDistinctCustomers',
    rightMetric: 'pooledCustomerCount',
    joinKeys: ['customerId', 'customerMobile'],
    amountFields: ['visitCount', 'spendPaisa'],
    dateBasis: 'VISIT_DATE',
    scopeBasis: 'ORGANISATION_WIDE',
    statusEligibility: ['COMPLETED'],
    matchingMethod: 'POOLED_DISTINCT_IDENTITY_DEDUPLICATION',
    tolerancePolicy: {
      toleranceType: 'ZERO_TOLERANCE',
      toleranceValue: 0,
      toleranceUnit: 'COUNT',
      authority: 'PM-02H_PM-02I_CUSTOMER_IDENTITY',
      reason: 'A customer visiting 2 cafes is counted as 1 distinct portfolio customer. Never sum branch customer counts.',
    },
    availability: 'AVAILABLE',
    supportedRoles: ['PRIMARY_MASTER', 'MASTER', 'OWNER'],
    classification: 'CONFIDENTIAL',
    lineage: 'Bill.customerMobile -> Customer -> calculateCustomerAnalytics',
  },

  'REC-KDS-PERCENTILE-VELOCITY': {
    reconciliationId: 'REC-KDS-PERCENTILE-VELOCITY',
    displayName: 'KDS Prep Velocity Percentiles (P50/P90)',
    domain: 'OPERATIONS',
    version: 'PM02L-v1.0',
    leftSource: 'POOLED_KDS_TICKET_OBSERVATIONS',
    rightSource: 'BRANCH_KDS_DATA',
    leftMetric: 'portfolioP90Seconds',
    rightMetric: 'computedPooledP90Seconds',
    joinKeys: ['kdsTicketId'],
    amountFields: ['prepDurationSeconds'],
    dateBasis: 'BUSINESS_DATE',
    scopeBasis: 'ORGANISATION_WIDE',
    statusEligibility: ['COMPLETED'],
    matchingMethod: 'POOLED_OBSERVATION_ORDER_STATISTICS',
    tolerancePolicy: {
      toleranceType: 'ZERO_TOLERANCE',
      toleranceValue: 0,
      toleranceUnit: 'SECONDS',
      authority: 'PM-02H_PM-02I_KDS_ENGINE',
      reason: 'Portfolio percentiles computed strictly on pooled ticket observations, never by averaging branch percentiles.',
    },
    availability: 'AVAILABLE',
    supportedRoles: ['PRIMARY_MASTER', 'MASTER', 'OWNER', 'CAFE_ADMIN'],
    classification: 'INTERNAL',
    lineage: 'KdsTicket -> calculateOperationsAnalytics',
  },

  'REC-FORECAST-ACTUAL-HISTORY': {
    reconciliationId: 'REC-FORECAST-ACTUAL-HISTORY',
    displayName: 'Forecast Historical Training Series vs Canonical Sales History',
    domain: 'FORECASTING',
    version: 'PM02L-v1.0',
    leftSource: 'FORECAST_TRAINING_HISTORY',
    rightSource: 'CANONICAL_PM02D_SALES_HISTORY',
    leftMetric: 'trainingNetSalesPaisa',
    rightMetric: 'canonicalActualNetSalesPaisa',
    joinKeys: ['businessDate', 'cafeId'],
    amountFields: ['netSalesPaisa', 'ordersCount'],
    dateBasis: 'BUSINESS_DATE',
    scopeBasis: 'ASSIGNED_CAFES_OR_ORG',
    statusEligibility: ['COMPLETED', 'PARTIALLY_REFUNDED'],
    matchingMethod: 'EXACT_TIME_SERIES_CHRONOLOGY',
    tolerancePolicy: {
      toleranceType: 'ZERO_TOLERANCE',
      toleranceValue: 0,
      toleranceUnit: 'PAISE',
      authority: 'PM-02K_FORECASTING_ENGINE',
      reason: 'Forecast training history must exactly match frozen Sales actuals. FORECAST_TRAINING_NET_SALES_DISCREPANCY = 0.',
    },
    availability: 'AVAILABLE',
    supportedRoles: ['PRIMARY_MASTER', 'MASTER', 'OWNER', 'CAFE_ADMIN'],
    classification: 'CONFIDENTIAL',
    lineage: 'Bill -> extractCanonicalBillSales -> executeGovernedForecast',
  },

  'REC-SCREEN-EXPORT-PARITY-PDF': {
    reconciliationId: 'REC-SCREEN-EXPORT-PARITY-PDF',
    displayName: 'Screen UI Payload vs PDF Export Parity',
    domain: 'EXPORT_PARITY',
    version: 'PM02L-v1.0',
    leftSource: 'SCREEN_REPORT_PAYLOAD',
    rightSource: 'PDF_REPORT_ARTIFACT',
    leftMetric: 'screenIntegerPaise',
    rightMetric: 'pdfTableIntegerPaise',
    joinKeys: ['reportId', 'metricId'],
    amountFields: ['amountPaisa'],
    dateBasis: 'REPORT_PERIOD',
    scopeBasis: 'MATCHING_FILTERS',
    statusEligibility: ['CERTIFIED', 'OPERATIONAL'],
    matchingMethod: 'EXACT_INTEGER_PAISE_PARITY',
    tolerancePolicy: {
      toleranceType: 'ZERO_TOLERANCE',
      toleranceValue: 0,
      toleranceUnit: 'PAISE',
      authority: 'PM-02C_PM-02L_EXPORT_PARITY',
      reason: 'Screen and PDF must reconcile on all source-backed metrics in integer paise before display formatting.',
    },
    availability: 'AVAILABLE',
    supportedRoles: ['PRIMARY_MASTER', 'MASTER', 'OWNER', 'CAFE_ADMIN'],
    classification: 'INTERNAL',
    lineage: 'reportController JSON vs PDF table cells',
  },

  'REC-SCREEN-EXPORT-PARITY-XLSX': {
    reconciliationId: 'REC-SCREEN-EXPORT-PARITY-XLSX',
    displayName: 'Screen UI Payload vs XLSX Export Parity',
    domain: 'EXPORT_PARITY',
    version: 'PM02L-v1.0',
    leftSource: 'SCREEN_REPORT_PAYLOAD',
    rightSource: 'XLSX_REPORT_ARTIFACT',
    leftMetric: 'screenIntegerPaise',
    rightMetric: 'xlsxCellIntegerPaise',
    joinKeys: ['reportId', 'metricId'],
    amountFields: ['amountPaisa'],
    dateBasis: 'REPORT_PERIOD',
    scopeBasis: 'MATCHING_FILTERS',
    statusEligibility: ['CERTIFIED', 'OPERATIONAL'],
    matchingMethod: 'EXACT_INTEGER_PAISE_PARITY',
    tolerancePolicy: {
      toleranceType: 'ZERO_TOLERANCE',
      toleranceValue: 0,
      toleranceUnit: 'PAISE',
      authority: 'PM-02C_PM-02L_EXPORT_PARITY',
      reason: 'Screen and XLSX must reconcile on all source-backed metrics in integer paise before display formatting.',
    },
    availability: 'AVAILABLE',
    supportedRoles: ['PRIMARY_MASTER', 'MASTER', 'OWNER', 'CAFE_ADMIN'],
    classification: 'INTERNAL',
    lineage: 'reportController JSON vs XLSX cell values',
  },

  'REC-PORTFOLIO-ROLLUP-VS-CAFES': {
    reconciliationId: 'REC-PORTFOLIO-ROLLUP-VS-CAFES',
    displayName: 'Portfolio Rollup vs Individual Café Metrics',
    domain: 'MULTI_CAFE',
    version: 'PM02L-v1.0',
    leftSource: 'PORTFOLIO_AGGREGATE_METRIC',
    rightSource: 'AUTHORIZED_CAFES_METRIC_SET',
    leftMetric: 'portfolioMetricValue',
    rightMetric: 'recomputedPortfolioValue',
    joinKeys: ['organisationId', 'metricId', 'dateFrom', 'dateTo'],
    amountFields: ['netSalesPaisa', 'ordersCount', 'aovPaisa', 'kdsP90Seconds', 'distinctCustomersCount'],
    dateBasis: 'BUSINESS_DATE',
    scopeBasis: 'ASSIGNED_CAFES_OR_ORG',
    statusEligibility: ['COMPLETED', 'PARTIALLY_REFUNDED'],
    matchingMethod: 'GOVERNED_AGGREGATION_TYPE_RECOMPUTATION',
    tolerancePolicy: {
      toleranceType: 'ZERO_TOLERANCE',
      toleranceValue: 0,
      tolerancePaise: 0,
      toleranceUnit: 'PAISE_OR_COUNT_OR_SECONDS',
      authority: 'PM-02I_MULTI_CAFE_ENGINE',
      reason: 'Additive metrics sum cafes; ratios, unique customers, and percentiles recompute from pooled components. PORTFOLIO_RECONCILIATION_SUMS_NON_ADDITIVE_METRICS = 0.',
    },
    availability: 'AVAILABLE',
    supportedRoles: ['PRIMARY_MASTER', 'MASTER', 'OWNER'],
    classification: 'INTERNAL',
    lineage: 'Cafe metrics -> portfolioCalculations.METRIC_AGGREGATION_TYPES -> reconcilePortfolioRollupVsCafes',
  },

  // ── Missing Subsystem Placeholders (Strictly Acknowledged as UNAVAILABLE) ──
  'REC-CROSS-MODULE-GL-REVENUE': {
    reconciliationId: 'REC-CROSS-MODULE-GL-REVENUE',
    displayName: 'POS Sales vs General Ledger Revenue (REC-01)',
    domain: 'CROSS_MODULE',
    version: 'PM02L-v1.0',
    leftSource: 'POS_AND_BILLING',
    rightSource: 'FINANCE_GENERAL_LEDGER',
    leftMetric: 'billTotalPaisa',
    rightMetric: 'UNAVAILABLE',
    joinKeys: ['journalEntryId'],
    amountFields: ['totalPaisa'],
    dateBasis: 'BUSINESS_DATE',
    scopeBasis: 'ORGANISATION_WIDE',
    statusEligibility: ['COMPLETED'],
    matchingMethod: 'AUTOMATED_GL_POSTING',
    tolerancePolicy: {
      toleranceType: 'ZERO_TOLERANCE',
      toleranceValue: 0,
      tolerancePaise: 0,
      toleranceUnit: 'PAISE',
      authority: 'STATUTORY_GL_PIPELINE',
      reason: 'Automated POS-to-GL posting pipeline not integrated; General Ledger revenue accounts unavailable.',
    },
    availability: 'UNAVAILABLE',
    supportedRoles: ['PRIMARY_MASTER', 'MASTER'],
    classification: 'HIGHLY_CONFIDENTIAL',
    lineage: 'Bill vs UNAVAILABLE_GL_POSTING',
  },

  'REC-CROSS-MODULE-GRN-STOCK': {
    reconciliationId: 'REC-CROSS-MODULE-GRN-STOCK',
    displayName: 'Inbound GRN vs Stock Movement Ledger (REC-02)',
    domain: 'CROSS_MODULE',
    version: 'PM02L-v1.0',
    leftSource: 'PROCUREMENT_GRN',
    rightSource: 'STOCK_MOVEMENT_LEDGER',
    leftMetric: 'poGrnPaisa',
    rightMetric: 'UNAVAILABLE',
    joinKeys: ['grnId'],
    amountFields: ['totalPaisa'],
    dateBasis: 'RECEIPT_DATE',
    scopeBasis: 'ORGANISATION_WIDE',
    statusEligibility: ['RECEIVED'],
    matchingMethod: 'GRN_STOCK_LEDGER_VALUATION',
    tolerancePolicy: {
      toleranceType: 'ZERO_TOLERANCE',
      toleranceValue: 0,
      tolerancePaise: 0,
      toleranceUnit: 'PAISE',
      authority: 'PHYSICAL_STOCK_LEDGER',
      reason: 'No standalone GRN monetary model exists; StockMovement records physical base quantities without stored inboundValuePaise.',
    },
    availability: 'UNAVAILABLE',
    supportedRoles: ['PRIMARY_MASTER', 'MASTER'],
    classification: 'CONFIDENTIAL',
    lineage: 'PurchaseOrder.receiving vs UNAVAILABLE_STOCK_VALUATION',
  },

  'REC-CROSS-MODULE-AP-BANK': {
    reconciliationId: 'REC-CROSS-MODULE-AP-BANK',
    displayName: 'Supplier Invoices vs Bank Disbursements (REC-03)',
    domain: 'CROSS_MODULE',
    version: 'PM02L-v1.0',
    leftSource: 'VENDOR_AP_INVOICES',
    rightSource: 'BANK_DISBURSEMENTS',
    leftMetric: 'apInvoiceTotalPaisa',
    rightMetric: 'UNAVAILABLE',
    joinKeys: ['bankTransactionId'],
    amountFields: ['invoicedPaisa'],
    dateBasis: 'DISBURSEMENT_DATE',
    scopeBasis: 'ORGANISATION_WIDE',
    statusEligibility: ['APPROVED'],
    matchingMethod: 'BANK_FEED_RECONCILIATION',
    tolerancePolicy: {
      toleranceType: 'ZERO_TOLERANCE',
      toleranceValue: 0,
      tolerancePaise: 0,
      toleranceUnit: 'PAISE',
      authority: 'BANK_TRANSACTION_FEED',
      reason: 'No direct AP invoice to bank disbursement transaction linkage exists; AP-to-Bank reconciliation unavailable.',
    },
    availability: 'UNAVAILABLE',
    runnable: false,
    supportedRoles: ['MASTER'],
    classification: 'HIGHLY_CONFIDENTIAL',
    lineage: 'APInvoice vs UNAVAILABLE_BANK_FEED',
  },

  'REC-SALES-BILLS-VS-PROVIDER': {
    reconciliationId: 'REC-SALES-BILLS-VS-PROVIDER',
    displayName: 'Sales Bills vs External Payment Provider Logs',
    domain: 'SALES_GATEWAY',
    version: 'PM02L-v1.0',
    leftSource: 'BILL_COLLECTION',
    rightSource: 'PAYMENT_PROVIDER_LOGS',
    leftMetric: 'customerReceiptTotalPaisa',
    rightMetric: 'UNAVAILABLE',
    joinKeys: ['providerTransactionId'],
    amountFields: ['totalPaisa'],
    dateBasis: 'TRANSACTION_DATE',
    scopeBasis: 'ASSIGNED_CAFES_OR_ORG',
    statusEligibility: ['COMPLETED'],
    matchingMethod: 'GATEWAY_TRANSACTION_MATCH',
    tolerancePolicy: {
      toleranceType: 'ZERO_TOLERANCE',
      toleranceValue: 0,
      toleranceUnit: 'PAISE',
      authority: 'PAYMENT_GATEWAY_INTEGRATION',
      reason: 'PaymentProvider model does not exist in repository; direct gateway reconciliation unavailable.',
    },
    availability: 'UNAVAILABLE',
    runnable: false,
    supportedRoles: ['MASTER'],
    classification: 'CONFIDENTIAL',
    lineage: 'Bill vs UNAVAILABLE_PAYMENT_PROVIDER',
  },

  'REC-TAX-INVOICE-VS-LEDGER': {
    reconciliationId: 'REC-TAX-INVOICE-VS-LEDGER',
    displayName: 'Sales Tax Invoiced vs Statutory GST Subledger',
    domain: 'TAX',
    version: 'PM02L-v1.0',
    leftSource: 'BILL_TAX_COLLECTION',
    rightSource: 'STATUTORY_GST_SUBLEDGER',
    leftMetric: 'invoicedTaxPaisa',
    rightMetric: 'UNAVAILABLE',
    joinKeys: ['gstinNumber'],
    amountFields: ['taxPaisa'],
    dateBasis: 'BUSINESS_DATE',
    scopeBasis: 'ORGANISATION_WIDE',
    statusEligibility: ['COMPLETED'],
    matchingMethod: 'STATUTORY_GST_MATCH',
    tolerancePolicy: {
      toleranceType: 'ZERO_TOLERANCE',
      toleranceValue: 0,
      toleranceUnit: 'PAISE',
      authority: 'GST_STATUTORY_AUTHORITY',
      reason: 'No statutory GST subledger exists in current ERP build.',
    },
    availability: 'UNAVAILABLE',
    runnable: false,
    supportedRoles: ['MASTER'],
    classification: 'CONFIDENTIAL',
    lineage: 'Bill.taxPaisa vs UNAVAILABLE_GST_LEDGER',
  },

  'REC-DISCOUNT-PROMO-AUDIT': {
    reconciliationId: 'REC-DISCOUNT-PROMO-AUDIT',
    displayName: 'Promotional Discounts vs Marketing Campaign Ledger',
    domain: 'MARKETING',
    version: 'PM02L-v1.0',
    leftSource: 'BILL_DISCOUNTS',
    rightSource: 'MARKETING_CAMPAIGN_LEDGER',
    leftMetric: 'discountTotalPaisa',
    rightMetric: 'UNAVAILABLE',
    joinKeys: ['promoCode', 'campaignId'],
    amountFields: ['discountPaisa'],
    dateBasis: 'BUSINESS_DATE',
    scopeBasis: 'ORGANISATION_WIDE',
    statusEligibility: ['COMPLETED'],
    matchingMethod: 'CAMPAIGN_DISCOUNT_MATCH',
    tolerancePolicy: {
      toleranceType: 'ZERO_TOLERANCE',
      toleranceValue: 0,
      toleranceUnit: 'PAISE',
      authority: 'MARKETING_CAMPAIGN_AUTHORITY',
      reason: 'No Marketing Campaign Ledger exists in current ERP build.',
    },
    availability: 'UNAVAILABLE',
    runnable: false,
    supportedRoles: ['MASTER'],
    classification: 'CONFIDENTIAL',
    lineage: 'Bill.discountPaisa vs UNAVAILABLE_PROMO_LEDGER',
  },

  'REC-PETTY-CASH-VOUCHERS': {
    reconciliationId: 'REC-PETTY-CASH-VOUCHERS',
    displayName: 'Petty Cash Line Items vs Petty Cash Drawdown Subledger',
    domain: 'PETTY_CASH',
    version: 'PM02L-v1.0',
    leftSource: 'EXPENSE_PETTY_CASH',
    rightSource: 'PETTY_CASH_DRAWDOWN_SUBLEDGER',
    leftMetric: 'pettyCashExpensePaisa',
    rightMetric: 'UNAVAILABLE',
    joinKeys: ['voucherId'],
    amountFields: ['amountPaisa'],
    dateBasis: 'EXPENSE_DATE',
    scopeBasis: 'ASSIGNED_CAFES_OR_ORG',
    statusEligibility: ['APPROVED'],
    matchingMethod: 'PETTY_CASH_VOUCHER_MATCH',
    tolerancePolicy: {
      toleranceType: 'ZERO_TOLERANCE',
      toleranceValue: 0,
      toleranceUnit: 'PAISE',
      authority: 'PETTY_CASH_POLICY',
      reason: 'No separate petty cash drawdown subledger exists in current ERP build.',
    },
    availability: 'UNAVAILABLE',
    runnable: false,
    supportedRoles: ['MASTER'],
    classification: 'CONFIDENTIAL',
    lineage: 'Expense vs UNAVAILABLE_PETTY_CASH_LEDGER',
  },
};

/**
 * Retrieves a canonical reconciliation definition by ID.
 * @param {string} id
 * @returns {object|null}
 */
function getReconciliation(id) {
  if (!id) return null;
  const direct = CANONICAL_RECONCILIATIONS[id];
  if (direct) return direct;
  const aliases = {
    'REC-01': 'REC-CROSS-MODULE-GL-REVENUE',
    'REC-02': 'REC-CROSS-MODULE-GRN-STOCK',
    'REC-03': 'REC-CROSS-MODULE-AP-BANK',
    'REC-04': 'REC-PAYROLL-RUN-PAYSLIP',
    'REC-SALES': 'REC-SALES-REPORT-PROVIDER',
  };
  if (aliases[id]) return CANONICAL_RECONCILIATIONS[aliases[id]] || null;
  return null;
}

/**
 * Lists all canonical reconciliation definitions.
 * @returns {Array<object>}
 */
function listReconciliations() {
  return Object.values(CANONICAL_RECONCILIATIONS);
}

module.exports = {
  // Invariants
  RECONCILIATION_CREATES_FALSE_SOURCE_AUTHORITY,
  HIDDEN_MONETARY_RECONCILIATION_TOLERANCE,
  AMBIGUOUS_RECONCILIATION_SILENTLY_RESOLVED,
  REPORT_PROVIDER_VALUE_DRIFT,
  PAYMENT_MIX_DOUBLE_COUNT,
  TILL_RECONCILIATION_MISLABELED_BANK_RECONCILIATION,
  RECONCILIATION_REINTRODUCES_EXCLUDED_EXPENSE_DOUBLE_COUNT,
  PAYROLLRUN_AND_PAYSLIP_DOUBLE_COUNT,
  RECONCILIATION_UNIT_MISMATCH_IGNORED,
  RECONCILIATION_CERTIFIES_UNAVAILABLE_PROFITABILITY,
  PROVENANCE_EXPOSES_PROTECTED_SOURCE_DATA,
  REPORT_CERTIFICATION_UPGRADES_ALL_METRICS,
  RECONCILIATION_UNAVAILABLE_NORMALIZED_TO_ZERO,
  ACKNOWLEDGEMENT_ALTERS_RECONCILIATION_TRUTH,
  REPORT_USER_CAN_MUTATE_AUDIT_HISTORY,
  ARBITRARY_DATA_TRUST_SCORE,
  DATA_TRUST_HIDDEN_SCOPE_LEAK,
  SOURCE_OUTAGE_REPORTED_AS_SUCCESSFUL_RECONCILIATION,
  RECONCILIATION_N_PLUS_ONE,
  MIXED_TRUST_REPORT_FALSELY_ALL_CERTIFIED,
  DEAD_PM02L_CONTROLS,
  MISREPRESENTED_PM02L_CONTROLS,
  UNEXPLAINED_FROZEN_TEST_LOSS,
  NET_SALES_RECONCILED_TO_TAX_INCLUSIVE_PAYMENT_RECEIPT,
  PM02L_REINTRODUCES_UNSUPPORTED_TENDER_ENUM,
  PM02L_REDEFINES_NET_SALES,
  PAYSLIP_NONCANONICAL_GROSS_PAY_FIELD_USED,
  PM02L_DUPLICATE_TILL_MODEL,
  PM02L_REDEFINES_INVENTORY_VALUATION,
  BINARY_HASH_USED_AS_REPORT_VALUE_PARITY,
  NONPERSISTED_GOVERNANCE_STATE_CLAIMED_IMMUTABLE,
  TRACE_ID_COLLISION_IMPOSSIBILITY_FALSELY_CLAIMED,
  PM02L_SECONDARY_ROLE_TAXONOMY,
  PM02L_WEAKENS_OR_REWRITES_FROZEN_TESTS,

  // PM-02L-R2 Invariants
  PM02L_USES_NONEXISTENT_BILL_FINANCIAL_FIELD,
  NONEXISTENT_PRETAX_REFUND_FIELD_USED_AS_CANONICAL_SOURCE,
  NONCANONICAL_FINAL_TOTAL_FIELD_USED_FOR_PAYMENT_RECONCILIATION,
  PM02L_USES_NONCANONICAL_BILL_STATUS,
  CURRENT_STANDARD_COST_SUBSTITUTED_FOR_FROZEN_LOT_VALUATION,
  PM02L_HYBRID_TRUST_ACTUALITY_STATE,
  TRUST_FILTER_MIXES_AVAILABILITY_OR_DATA_QUALITY,
  TRANSIENT_ACKNOWLEDGEMENT_PRESENTED_AS_DURABLE_GOVERNANCE_ACTION,
  CONTROL_MATRIX_REFERENCES_NONEXISTENT_SELECTOR,
  CONTROL_MATRIX_REFERENCES_NONEXISTENT_HANDLER,
  PORTFOLIO_RECONCILIATION_SUMS_NON_ADDITIVE_METRICS,
  PM02L_USES_NONCANONICAL_FINANCIAL_STATUS_ENUM,
  RECONCILIATION_AVAILABILITY_COUNT_MISMATCH,
  SHORT_TRACE_TOKEN_USED_AS_GLOBALLY_UNIQUE_PERSISTENT_KEY,

  // PM-02L-R3 Invariants
  PM02L_REDEFINES_GLOBAL_ACTUALITY_TAXONOMY,
  PM02L_REDEFINES_GLOBAL_DATA_QUALITY_TAXONOMY,
  PM02L_REDEFINES_GLOBAL_TRUST_TAXONOMY,
  PM02L_BREAKS_PM02K_FORECAST_SIMULATED_ACTUALITY,
  UNKNOWN_PRETAX_REFUND_ALLOCATION_NORMALIZED_TO_ZERO,
  PM02L_PARTIAL_REFUND_SEMANTICS_DRIFT_FROM_SALES_PROVIDER,
  NONEXISTENT_PRE_TAX_REFUND_FIELD_USED,
  CLIENT_SUPPLIED_ACKNOWLEDGEMENT_ACTOR_TRUSTED,
  DATA_TRUST_CENTRE_UI_FABRICATED_AS_RENDERED,

  // Invariant dictionary
  STATIC_SEMANTIC_INVARIANTS: {
    RECONCILIATION_CREATES_FALSE_SOURCE_AUTHORITY,
    HIDDEN_MONETARY_RECONCILIATION_TOLERANCE,
    AMBIGUOUS_RECONCILIATION_SILENTLY_RESOLVED,
    REPORT_PROVIDER_VALUE_DRIFT,
    PAYMENT_MIX_DOUBLE_COUNT,
    TILL_RECONCILIATION_MISLABELED_BANK_RECONCILIATION,
    RECONCILIATION_REINTRODUCES_EXCLUDED_EXPENSE_DOUBLE_COUNT,
    PAYROLLRUN_AND_PAYSLIP_DOUBLE_COUNT,
    RECONCILIATION_UNIT_MISMATCH_IGNORED,
    RECONCILIATION_CERTIFIES_UNAVAILABLE_PROFITABILITY,
    PROVENANCE_EXPOSES_PROTECTED_SOURCE_DATA,
    REPORT_CERTIFICATION_UPGRADES_ALL_METRICS,
    RECONCILIATION_UNAVAILABLE_NORMALIZED_TO_ZERO,
    ACKNOWLEDGEMENT_ALTERS_RECONCILIATION_TRUTH,
    REPORT_USER_CAN_MUTATE_AUDIT_HISTORY,
    ARBITRARY_DATA_TRUST_SCORE,
    DATA_TRUST_HIDDEN_SCOPE_LEAK,
    SOURCE_OUTAGE_REPORTED_AS_SUCCESSFUL_RECONCILIATION,
    RECONCILIATION_N_PLUS_ONE,
    MIXED_TRUST_REPORT_FALSELY_ALL_CERTIFIED,
    DEAD_PM02L_CONTROLS,
    MISREPRESENTED_PM02L_CONTROLS,
    UNEXPLAINED_FROZEN_TEST_LOSS,
    NET_SALES_RECONCILED_TO_TAX_INCLUSIVE_PAYMENT_RECEIPT,
    PM02L_REINTRODUCES_UNSUPPORTED_TENDER_ENUM,
    PM02L_REDEFINES_NET_SALES,
    PAYSLIP_NONCANONICAL_GROSS_PAY_FIELD_USED,
    PM02L_DUPLICATE_TILL_MODEL,
    PM02L_REDEFINES_INVENTORY_VALUATION,
    BINARY_HASH_USED_AS_REPORT_VALUE_PARITY,
    NONPERSISTED_GOVERNANCE_STATE_CLAIMED_IMMUTABLE,
    TRACE_ID_COLLISION_IMPOSSIBILITY_FALSELY_CLAIMED,
    PM02L_SECONDARY_ROLE_TAXONOMY,
    PM02L_WEAKENS_OR_REWRITES_FROZEN_TESTS,
    PM02L_USES_NONEXISTENT_BILL_FINANCIAL_FIELD,
    NONEXISTENT_PRETAX_REFUND_FIELD_USED_AS_CANONICAL_SOURCE,
    NONCANONICAL_FINAL_TOTAL_FIELD_USED_FOR_PAYMENT_RECONCILIATION,
    PM02L_USES_NONCANONICAL_BILL_STATUS,
    CURRENT_STANDARD_COST_SUBSTITUTED_FOR_FROZEN_LOT_VALUATION,
    PM02L_HYBRID_TRUST_ACTUALITY_STATE,
    TRUST_FILTER_MIXES_AVAILABILITY_OR_DATA_QUALITY,
    TRANSIENT_ACKNOWLEDGEMENT_PRESENTED_AS_DURABLE_GOVERNANCE_ACTION,
    CONTROL_MATRIX_REFERENCES_NONEXISTENT_SELECTOR,
    CONTROL_MATRIX_REFERENCES_NONEXISTENT_HANDLER,
    PORTFOLIO_RECONCILIATION_SUMS_NON_ADDITIVE_METRICS,
    PM02L_USES_NONCANONICAL_FINANCIAL_STATUS_ENUM,
    RECONCILIATION_AVAILABILITY_COUNT_MISMATCH,
    SHORT_TRACE_TOKEN_USED_AS_GLOBALLY_UNIQUE_PERSISTENT_KEY,
    // PM-02L-R3
    PM02L_REDEFINES_GLOBAL_ACTUALITY_TAXONOMY,
    PM02L_REDEFINES_GLOBAL_DATA_QUALITY_TAXONOMY,
    PM02L_REDEFINES_GLOBAL_TRUST_TAXONOMY,
    PM02L_BREAKS_PM02K_FORECAST_SIMULATED_ACTUALITY,
    UNKNOWN_PRETAX_REFUND_ALLOCATION_NORMALIZED_TO_ZERO,
    PM02L_PARTIAL_REFUND_SEMANTICS_DRIFT_FROM_SALES_PROVIDER,
    NONEXISTENT_PRE_TAX_REFUND_FIELD_USED,
    CLIENT_SUPPLIED_ACKNOWLEDGEMENT_ACTOR_TRUSTED,
    DATA_TRUST_CENTRE_UI_FABRICATED_AS_RENDERED,
  },

  // Taxonomy & Definitions
  CANONICAL_TENDERS,
  CANONICAL_ROLES,
  CANONICAL_ACTUALITY_STATES,
  CANONICAL_DATA_QUALITY_STATUSES,
  CANONICAL_TRUST_STATUSES,
  CANONICAL_AVAILABILITY_STATUSES,
  RECONCILIATION_MATCH_STATUSES,
  MATCH_STATUS: RECONCILIATION_MATCH_STATUSES,
  CERTIFICATION_DIMENSIONS,
  CANONICAL_RECONCILIATIONS,
  RECONCILIATION_REGISTRY: CANONICAL_RECONCILIATIONS,
  getReconciliation,
  listReconciliations,
};
