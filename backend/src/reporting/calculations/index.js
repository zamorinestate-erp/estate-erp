'use strict';

/**
 * ZAMORIN CAFÉ ERP — REPORTING CALCULATION ENGINE
 * Central Index & Re-exports
 */

const { calculateSalesMetrics, extractCanonicalBillSales } = require('./salesCalculations');
const { calculateFinanceMetrics } = require('./financeCalculations');
const { calculateWorkforceMetrics } = require('./workforceCalculations');
const { calculateCustomerMetrics } = require('./customerCalculations');
const { calculateInventoryMetrics } = require('./inventoryCalculations');
const { calculateProcurementMetrics } = require('./procurementCalculations');
const { calculateMenuMetrics } = require('./menuCalculations');
const { calculateQualityMetrics } = require('./qualityCalculations');
const { calculateAssetMetrics } = require('./assetCalculations');
const { calculatePortfolioMetrics } = require('./portfolioCalculations');
const { calculateCrossModuleReconciliations } = require('./reconciliationCalculations');
const { calculateOverviewMetrics } = require('./overviewCalculations');
const { calculateDataQualityMetrics } = require('./dataQualityCalculations');
const diagnosticCalculations = require('./diagnosticCalculations');
const forecastCalculations = require('./forecastCalculations');

module.exports = {
  calculateSalesMetrics,
  extractCanonicalBillSales,
  calculateFinanceMetrics,
  calculateWorkforceMetrics,
  calculateCustomerMetrics,
  calculateInventoryMetrics,
  calculateProcurementMetrics,
  calculateMenuMetrics,
  calculateQualityMetrics,
  calculateAssetMetrics,
  calculatePortfolioMetrics,
  calculateCrossModuleReconciliations,
  reconcileSalesReportVsProvider: require('./reconciliationCalculations').reconcileSalesReportVsProvider,
  reconcilePaymentMixTenders: require('./reconciliationCalculations').reconcilePaymentMixTenders,
  reconcileCashMovementTill: require('./reconciliationCalculations').reconcileCashMovementTill,
  reconcileFinanceExpenses: require('./reconciliationCalculations').reconcileFinanceExpenses,
  reconcilePayrollRunVsPayslips: require('./reconciliationCalculations').reconcilePayrollRunVsPayslips,
  reconcileScreenExportParity: require('./reconciliationCalculations').reconcileScreenExportParity,
  reconcileForecastActualHistory: require('./reconciliationCalculations').reconcileForecastActualHistory,
  reconcileRecordsWithAmbiguityDetection: require('./reconciliationCalculations').reconcileRecordsWithAmbiguityDetection,
  reconcileSemanticExportParity: require('./reconciliationCalculations').reconcileSemanticExportParity,
  reconcilePortfolioRollupVsCafes: require('./reconciliationCalculations').reconcilePortfolioRollupVsCafes,
  runComprehensiveReconciliationAudit: require('./reconciliationCalculations').runComprehensiveReconciliationAudit,
  calculateOverviewMetrics,
  calculateDataQualityMetrics,
  explainMetricNumber: require('./dataQualityCalculations').explainMetricNumber,
  listDataQualityIssues: require('./dataQualityCalculations').listDataQualityIssues,
  recordIssueAcknowledgement: require('./dataQualityCalculations').recordIssueAcknowledgement,
  loadDurableAcknowledgements: require('./dataQualityCalculations').loadDurableAcknowledgements,
  resetAcknowledgementCache: require('./dataQualityCalculations').resetAcknowledgementCache,
  LINEAGE_LEDGER: require('./dataQualityCalculations').LINEAGE_LEDGER,
  ...require('./reconciliationCalculations').STATIC_SEMANTIC_INVARIANTS,
  ...diagnosticCalculations,
  ...forecastCalculations,
  applyCompetitionRanking: require('./portfolioCalculations').applyCompetitionRanking,
  calculateMedian: require('./portfolioCalculations').calculateMedian,
  OVERALL_CAFE_SCORE: require('./portfolioCalculations').OVERALL_CAFE_SCORE,
  METRIC_AGGREGATION_TYPES: require('./portfolioCalculations').METRIC_AGGREGATION_TYPES,
  CAFE_LEVEL_UNIQUE_COUNTS_SUMMED_AS_PORTFOLIO_UNIQUES: require('./portfolioCalculations').CAFE_LEVEL_UNIQUE_COUNTS_SUMMED_AS_PORTFOLIO_UNIQUES,
  PORTFOLIO_REPEAT_RATE_FROM_SUMMED_CAFE_UNIQUES: require('./portfolioCalculations').PORTFOLIO_REPEAT_RATE_FROM_SUMMED_CAFE_UNIQUES,
  HIDDEN_CAFE_CUSTOMER_HISTORY_IN_BENCHMARK: require('./portfolioCalculations').HIDDEN_CAFE_CUSTOMER_HISTORY_IN_BENCHMARK,
  REPORT_SIDE_ARBITRARY_12_MONTH_COMPARABILITY_RULE: require('./portfolioCalculations').REPORT_SIDE_ARBITRARY_12_MONTH_COMPARABILITY_RULE,
  NON_COMPARABLE_CAFE_RANKED_AS_COMPARABLE: require('./portfolioCalculations').NON_COMPARABLE_CAFE_RANKED_AS_COMPARABLE,
  EQUAL_METRIC_VALUES_RECEIVE_DIFFERENT_RANKS: require('./portfolioCalculations').EQUAL_METRIC_VALUES_RECEIVE_DIFFERENT_RANKS,
  INVENTED_PEER_GROUP_DIMENSION: require('./portfolioCalculations').INVENTED_PEER_GROUP_DIMENSION,
  HIDDEN_PEER_UNIVERSE_LEAK: require('./portfolioCalculations').HIDDEN_PEER_UNIVERSE_LEAK,
  AVERAGE_OF_RATIOS_USED_AS_PORTFOLIO_RATIO: require('./portfolioCalculations').AVERAGE_OF_RATIOS_USED_AS_PORTFOLIO_RATIO,
  AVERAGE_OF_CAFE_PERCENTILES_REPORTED_AS_PORTFOLIO_PERCENTILE: require('./portfolioCalculations').AVERAGE_OF_CAFE_PERCENTILES_REPORTED_AS_PORTFOLIO_PERCENTILE,
  FAKE_PROFITABILITY_BENCHMARK: require('./portfolioCalculations').FAKE_PROFITABILITY_BENCHMARK,
  DATABASE_OUTAGE_REPORTED_AS_ZERO: require('./portfolioCalculations').DATABASE_OUTAGE_REPORTED_AS_ZERO,
  DEAD_PM02I_CONTROLS: require('./portfolioCalculations').DEAD_PM02I_CONTROLS,
  MISREPRESENTED_PM02I_CONTROLS: require('./portfolioCalculations').MISREPRESENTED_PM02I_CONTROLS,
  PORTFOLIO_CUSTOMER_DOUBLE_COUNT: require('./portfolioCalculations').PORTFOLIO_CUSTOMER_DOUBLE_COUNT,
};

