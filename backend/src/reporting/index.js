'use strict';

/**
 * ZAMORIN CAFÉ ERP — REPORTING FOUNDATION
 * Module: index.js
 * 
 * Aggregates and exports all central canonical reporting architecture modules:
 * - metricRegistry: Canonical metric definitions & semantic versions
 * - dimensionRegistry: Standard dimensions & daypart engine
 * - reportRegistry: Report definitions, categories, classifications & trust
 * - reportingTime: Period engine & IST date validation
 * - reportingMoney: Integer paise representation & Indian currency formatting
 * - reportingScope: Centralized tenant isolation & role café authority
 * - reportingDataQuality: Data quality & actuality semantics
 * - reportingContract: Request parsing, response envelopes, provenance & lineage
 */

const reportingMoney = require('./reportingMoney');
const reportingTime = require('./reportingTime');
const dimensionRegistry = require('./dimensionRegistry');
const reportingDataQuality = require('./reportingDataQuality');
const reportingScope = require('./reportingScope');
const metricRegistry = require('./metricRegistry');
const reportRegistry = require('./reportRegistry');
const forecastRegistry = require('./forecastRegistry');
const reconciliationRegistry = require('./reconciliationRegistry');
const reportingContract = require('./reportingContract');
const calculations = require('./calculations');

module.exports = {
  ...reportingMoney,
  ...reportingTime,
  ...dimensionRegistry,
  ...reportingDataQuality,
  ...reportingScope,
  ...metricRegistry,
  ...reportRegistry,
  ...forecastRegistry,
  ...reconciliationRegistry,
  ...reportingContract,
  ...calculations,
};
