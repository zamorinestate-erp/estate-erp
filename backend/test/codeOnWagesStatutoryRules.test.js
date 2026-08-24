'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const { LoanAdvanceService } = require('../src/services/loanAdvanceService');
const { User } = require('../src/models/User');

test('Code on Wages (Central) Rules 2026 - Wage Definition Section 2(y) Rule', () => {
  // Scenario 1: Excluded allowances (30k) are <= 50% of total remuneration (100k). No add-back.
  const normalCase = LoanAdvanceService.calculateStatutoryWages({
    basicPayPaise: 5000000, // 50,000 INR
    dearnessAllowancePaise: 2000000, // 20,000 INR
    retainingAllowancePaise: 0,
    excludedAllowancesPaise: 3000000, // 30,000 INR (HRA, Conveyance, Special Allowance)
  });

  assert.equal(normalCase.totalRemunerationPaise, 10000000); // 1,00,000 INR
  assert.equal(normalCase.coreWagesPaise, 7000000); // 70,000 INR
  assert.equal(normalCase.excludedThresholdPaise, 5000000); // 50% = 50,000 INR
  assert.equal(normalCase.excessExcludedPaise, 0); // Excluded (30k) <= 50k threshold
  assert.equal(normalCase.statutoryWagesPaise, 7000000); // Statutory wages = 70,000 INR
  assert.equal(normalCase.isExcessAddedBack, false);

  // Scenario 2: Excluded allowances (65k) exceed 50% of total remuneration (100k).
  // Gross Remuneration (100k) != Statutory Wages (65k).
  // 50% threshold is 50k. Excess is 15k.
  // Core wages (35k) + Excess (15k) = Statutory Wages (50k).
  const excessAllowanceCase = LoanAdvanceService.calculateStatutoryWages({
    basicPayPaise: 3000000, // 30,000 INR
    dearnessAllowancePaise: 500000, // 5,000 INR
    retainingAllowancePaise: 0,
    excludedAllowancesPaise: 6500000, // 65,000 INR (65% of total remuneration)
  });

  assert.equal(excessAllowanceCase.totalRemunerationPaise, 10000000); // 1,00,000 INR
  assert.equal(excessAllowanceCase.coreWagesPaise, 3500000); // 35,000 INR
  assert.equal(excessAllowanceCase.excludedThresholdPaise, 5000000); // 50% = 50,000 INR
  assert.equal(excessAllowanceCase.excessExcludedPaise, 1500000); // 65k - 50k = 15,000 INR excess
  assert.equal(excessAllowanceCase.statutoryWagesPaise, 5000000); // 35k + 15k = 50,000 INR
  assert.equal(excessAllowanceCase.isExcessAddedBack, true);
  // Verify Gross Remuneration != Statutory Wages
  assert.notEqual(excessAllowanceCase.totalRemunerationPaise, excessAllowanceCase.statutoryWagesPaise);
});

test('Code on Wages (Central) Rules 2026 - Wage-Deduction Ceiling Rule (Rule 19 & 20)', () => {
  // Total Remuneration = 100k, but Statutory Wages = 50k (due to 50% rule).
  // Statutory deduction ceiling must be 50% of STATUTORY WAGES (25k), NOT 50% of Gross Remuneration (50k).
  const statutoryWagesPaise = 5000000; // 50,000 INR

  const deductionCapCalc = LoanAdvanceService.calculateStatutoryDeductionCapacity({
    statutoryWagesPaise,
    grossWagesPaise: 10000000, // Gross remuneration is 1,00,000 INR
    otherDeductionsPaise: 1000000, // PF + ESI = 10,000 INR
    statutoryCapPercent: 50,
    recoveryType: 'EMPLOYEE_LOAN',
  });

  // 50% of 50,000 INR = 25,000 INR maximum total deductions
  assert.equal(deductionCapCalc.maxPermittedTotalDeductions, 2500000);
  assert.equal(deductionCapCalc.otherDeductionsPaise, 1000000);
  // Available for loan recovery = 25,000 - 10,000 = 15,000 INR
  assert.equal(deductionCapCalc.availableForLoanRecovery, 1500000);
  assert.equal(deductionCapCalc.availableForRecovery, 1500000);
});

test('Independence of Wage-Definition Rule (Rule A) and Wage-Deduction Ceiling (Rule B)', () => {
  // Compute Wage Definition Rule A independently
  const wageDef = LoanAdvanceService.calculateStatutoryWages({
    basicPayPaise: 4000000,
    dearnessAllowancePaise: 0,
    retainingAllowancePaise: 0,
    excludedAllowancesPaise: 6000000, // 60% excluded -> 10% excess added back
  });
  // Total = 100k, Core = 40k, Excess = 60k - 50k = 10k, Statutory Wages = 50k
  assert.equal(wageDef.statutoryWagesPaise, 5000000);

  // Feed result into Deduction Ceiling Rule B
  const ceiling = LoanAdvanceService.calculateStatutoryDeductionCapacity({
    statutoryWagesPaise: wageDef.statutoryWagesPaise,
    otherDeductionsPaise: 500000, // 5k PF
    statutoryCapPercent: 50,
    recoveryType: 'SALARY_ADVANCE', // Rule 19
  });
  // 50% of 50k = 25k cap. Available = 25k - 5k = 20k
  assert.equal(ceiling.maxPermittedTotalDeductions, 2500000);
  assert.equal(ceiling.availableForRecovery, 2000000);
  assert.equal(ceiling.recoveryType, 'SALARY_ADVANCE');
});

test('Code on Wages Section 2(y) - Comprehensive Remuneration Components & Provisos', () => {
  // Breakdown with all statutory components:
  // Core wages: Basic (40k) + DA (10k) + Retaining (0) = 50k
  // Excluded: HRA (20k) + Conveyance (10k) + Overtime (10k) + Bonus (10k) + Award (10k) = 60k
  // Total cash remuneration = 110k
  // Remuneration in kind = 10k (within 15% of 50k core wages = 7.5k recognized)
  // 50% threshold on total cash = 55k. Excess excluded = 60k - 55k = 5k.
  // Statutory wages = 50k (core) + 5k (excess) + 7.5k (in kind) = 62.5k
  const detailedCalc = LoanAdvanceService.calculateStatutoryWages({
    basicPayPaise: 4000000,
    dearnessAllowancePaise: 1000000,
    retainingAllowancePaise: 0,
    houseRentAllowancePaise: 2000000,
    conveyanceAllowancePaise: 1000000,
    overtimePayPaise: 1000000,
    statutoryBonusCommissionPaise: 1000000,
    awardSettlementRemunerationPaise: 1000000,
    remunerationInKindPaise: 1000000,
    remunerationInKindLimitPercent: 15,
  });

  assert.equal(detailedCalc.coreWagesPaise, 5000000);
  assert.equal(detailedCalc.totalExcludedAllowancesPaise, 6000000);
  assert.equal(detailedCalc.excessExcludedPaise, 500000); // 60k - 55k = 5,000 INR excess
  assert.equal(detailedCalc.recognizedInKindPaise, 750000); // 15% of 50k = 7,500 INR
  assert.equal(detailedCalc.statutoryWagesPaise, 6250000); // 50k + 5k + 7.5k = 62,500 INR
  assert.equal(detailedCalc.isExcessAddedBack, true);
  assert.equal(detailedCalc.proviso2ClausesApplied.conveyanceAllowancePaise, 1000000);
  assert.equal(detailedCalc.proviso2ClausesApplied.overtimePayPaise, 1000000);
  assert.equal(detailedCalc.proviso2ClausesApplied.awardSettlementRemunerationPaise, 1000000);
});

test('Jurisdiction-Aware Labour Rule Resolver - Central vs State vs Unconfigured', () => {
  // 1. Central Rules resolution
  const centralRule = LoanAdvanceService.resolveJurisdictionRuleSet({
    appropriateGovernment: 'CENTRAL',
    jurisdictionCode: 'IN-CENTRAL',
    ruleSetId: 'CENTRAL_RULES_2026',
  });
  assert.equal(centralRule.status, 'RESOLVED');
  assert.equal(centralRule.title, 'Code on Wages (Central) Rules, 2026');
  assert.equal(centralRule.statutoryCapPercent, 50);
  assert.equal(centralRule.requiresReview, false);

  // 2. Kerala State Rules resolution
  const keralaRule = LoanAdvanceService.resolveJurisdictionRuleSet({
    appropriateGovernment: 'STATE',
    jurisdictionCode: 'IN-KL',
    ruleSetId: 'KL_RULES_2026',
  });
  assert.equal(keralaRule.status, 'RESOLVED');
  assert.equal(keralaRule.title, 'Kerala Code on Wages Rules, 2026');
  assert.equal(keralaRule.requiresReview, false);

  // 3. Unconfigured Jurisdiction surfaces STATUTORY_RULESET_REVIEW_REQUIRED
  const unconfiguredRule = LoanAdvanceService.resolveJurisdictionRuleSet({
    appropriateGovernment: 'STATE',
    jurisdictionCode: 'IN-XX',
    ruleSetId: 'UNCONFIGURED_STATE_RULES',
  });
  assert.equal(unconfiguredRule.status, 'STATUTORY_RULESET_REVIEW_REQUIRED');
  assert.equal(unconfiguredRule.requiresReview, true);
});

test('Primary Master Unique Index Constraint is defined on User Schema', () => {
  const indexes = User.schema.indexes();
  const primaryMasterIndex = indexes.find(
    ([fields, options]) =>
      fields.organisationId === 1 &&
      fields.isPrimaryMaster === 1 &&
      options?.unique === true &&
      options?.partialFilterExpression?.isPrimaryMaster === true
  );

  assert.ok(primaryMasterIndex, 'User schema must have a partial unique index for organisation-level Primary Master.');
  assert.equal(primaryMasterIndex[1].name, 'organisation_primary_master_unique');
});
