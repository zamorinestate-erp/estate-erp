'use strict';

/**
 * ============================================================================
 * ZAMORIN CAFÉ ERP — FOOD SAFETY TEMPERATURE RULE EVALUATION SERVICE (R02A-01)
 * ============================================================================
 * Central statutory FSSAI food-safety rule evaluator.
 *
 * Implements multi-criteria time/temperature evaluation, versioned governance,
 * and distinct process type rules (COOKING, REHEATING, HOT_HOLDING, COLD_HOLDING,
 * COOLING, RECEIVING, STORAGE).
 *
 * Eliminates universal '>= 75°C' shortcuts and strictly adheres to FSSAI Schedule 4.
 */

const { FoodSafetyTemperatureRule } = require('../models/FoodSafetyTemperatureRule');
const { ApiError } = require('../utils/ApiError');

class TemperatureRuleService {
  /**
   * Evaluates measured temperature and duration against statutory FSSAI rules
   */
  static async evaluateTemperatureRule({
    organisationId,
    cafeId = null,
    foodCategory = 'ALL',
    processType,
    measuredTemperatureC,
    durationSeconds = 0,
    timestamp = new Date(),
  }) {
    if (!organisationId || !processType || measuredTemperatureC === undefined || measuredTemperatureC === null) {
      throw new ApiError(400, 'INVALID_EVALUATION_INPUT', 'organisationId, processType, and measuredTemperatureC are required.');
    }

    const cleanOrg = organisationId.trim().toUpperCase();
    const cleanCafe = cafeId ? cafeId.trim().toUpperCase() : null;
    const cleanProcess = processType.trim().toUpperCase();
    const cleanCategory = (foodCategory || 'ALL').trim().toUpperCase();
    const temp = Number(measuredTemperatureC);
    const duration = Number(durationSeconds) || 0;
    const checkTime = new Date(timestamp);

    // Helper to find applicable active rule with exact category or fallback to 'ALL'
    async function findActiveRule(category, targetCafe) {
      const query = {
        organisationId: cleanOrg,
        processType: cleanProcess,
        foodCategory: category,
        active: true,
        effectiveFrom: { $lte: checkTime },
        $or: [{ effectiveTo: null }, { effectiveTo: { $gte: checkTime } }],
      };
      if (targetCafe) {
        query.cafeId = targetCafe;
      } else {
        query.$and = [{ $or: [{ cafeId: null }, { cafeId: '' }] }];
      }
      return FoodSafetyTemperatureRule.findOne(query).sort({ version: -1 }).lean();
    }

    // 1. Locate the applicable active rule:
    // Try café-specific exact category -> café-specific 'ALL' -> org-level exact category -> org-level 'ALL'
    let rule = null;
    if (cleanCafe) {
      rule = await findActiveRule(cleanCategory, cleanCafe);
      if (!rule && cleanCategory !== 'ALL') {
        rule = await findActiveRule('ALL', cleanCafe);
      }
    }

    if (!rule) {
      rule = await findActiveRule(cleanCategory, null);
      if (!rule && cleanCategory !== 'ALL') {
        rule = await findActiveRule('ALL', null);
      }
    }

    // 2. If no rule is configured, do NOT assume compliance
    if (!rule) {
      return {
        status: 'RULE_NOT_CONFIGURED',
        matchedRuleId: null,
        ruleVersion: null,
        details: `No statutory temperature rule configured for process '${cleanProcess}' and category '${cleanCategory}'.`,
        reason: 'RULE_NOT_CONFIGURED',
        evaluatedTemperatureC: temp,
        evaluatedDurationSeconds: duration,
      };
    }

    // 3. Evaluate criteria combinations
    // Any valid combination satisfying the requirements results in a PASS
    let matchedCriterion = null;

    for (const crit of rule.criteria) {
      const minTempOk = temp >= crit.minimumTemperatureC;
      const maxTempOk = crit.maximumTemperatureC === null || crit.maximumTemperatureC === undefined || temp <= crit.maximumTemperatureC;
      const durationOk = duration >= (crit.minimumDurationSeconds || 0);

      if (minTempOk && maxTempOk && durationOk) {
        matchedCriterion = crit;
        break;
      }
    }

    if (matchedCriterion) {
      return {
        status: 'PASS',
        matchedRuleId: rule.ruleId,
        ruleVersion: rule.version,
        ruleName: rule.name,
        foodCategory: rule.foodCategory,
        processType: rule.processType,
        matchedCriterion,
        details: `Compliant with ${rule.name} (v${rule.version}): ${matchedCriterion.description || `${temp}°C for ${duration}s`}`,
        evaluatedTemperatureC: temp,
        evaluatedDurationSeconds: duration,
      };
    }

    return {
      status: 'FAIL',
      matchedRuleId: rule.ruleId,
      ruleVersion: rule.version,
      ruleName: rule.name,
      foodCategory: rule.foodCategory,
      processType: rule.processType,
      reason: 'CRITERIA_NOT_SATISFIED',
      details: `Measured ${temp}°C for ${duration}s failed all criteria for ${rule.name} (v${rule.version}).`,
      requiredCriteria: rule.criteria,
      evaluatedTemperatureC: temp,
      evaluatedDurationSeconds: duration,
    };
  }

  /**
   * Creates a new versioned statutory temperature rule.
   * If a previous active rule exists for the same scope, it is superseded.
   */
  static async createVersionedRule({
    organisationId,
    cafeId = null,
    name,
    foodCategory = 'ALL',
    processType,
    criteria = [],
    version = 1,
    sourceReference = 'FSSAI Schedule 4',
    effectiveFrom = new Date(),
    effectiveTo = null,
    createdByUserId = 'SYSTEM',
  }) {
    if (!organisationId || !processType || !name || !criteria || criteria.length === 0) {
      throw new ApiError(400, 'INVALID_RULE_SPECIFICATION', 'organisationId, processType, name, and criteria are required.');
    }

    const cleanOrg = organisationId.trim().toUpperCase();
    const cleanCafe = cafeId ? cafeId.trim().toUpperCase() : null;
    const cleanProcess = processType.trim().toUpperCase();
    const cleanCategory = (foodCategory || 'ALL').trim().toUpperCase();
    const ruleVersion = Number(version) || 1;

    // Check for duplicate version in same scope
    const existingSameVersion = await FoodSafetyTemperatureRule.findOne({
      organisationId: cleanOrg,
      cafeId: cleanCafe,
      processType: cleanProcess,
      foodCategory: cleanCategory,
      version: ruleVersion,
    });

    if (existingSameVersion) {
      throw new ApiError(409, 'DUPLICATE_RULE_VERSION', `Rule for ${cleanOrg}/${cleanCafe || 'GLOBAL'}/${cleanProcess}/${cleanCategory} version ${ruleVersion} already exists.`);
    }

    // Supersede any active rule in the same scope
    const scopeQuery = {
      organisationId: cleanOrg,
      cafeId: cleanCafe,
      processType: cleanProcess,
      foodCategory: cleanCategory,
      active: true,
    };

    await FoodSafetyTemperatureRule.updateMany(scopeQuery, {
      $set: {
        active: false,
        status: 'SUPERSEDED',
        effectiveTo: new Date(),
      },
    });

    const ruleId = `TRULE-${cleanOrg}-${cleanCafe ? `${cleanCafe}-` : ''}${cleanProcess.slice(0, 4)}-${cleanCategory.slice(0, 3)}-V${ruleVersion}`;

    const newRule = await FoodSafetyTemperatureRule.create({
      ruleId,
      organisationId: cleanOrg,
      cafeId: cleanCafe,
      name,
      foodCategory: cleanCategory,
      processType: cleanProcess,
      criteria,
      version: ruleVersion,
      status: 'ACTIVE',
      active: true,
      sourceReference,
      effectiveFrom,
      effectiveTo,
      createdByUserId: createdByUserId.trim().toUpperCase(),
    });

    return newRule;
  }

  /**
   * Seeds standard statutory FSSAI Schedule 4 rules for an organisation
   */
  static async seedDefaultFssaiRules(options = {}) {
    const org = typeof options === 'string' ? options : options.organisationId;
    const actorUserId = (typeof options === 'object' && options.actorUserId) || 'SYSTEM_SEED';
    if (!org) throw new Error('organisationId is required to seed default rules.');
    const cleanOrg = org.trim().toUpperCase();

    const defaultRules = [
      {
        ruleId: `TRULE-FSSAI-COOK-VEG-${cleanOrg}`,
        organisationId: cleanOrg,
        name: 'FSSAI Vegetarian Cooking Time/Temp Combination',
        foodCategory: 'VEGETARIAN',
        processType: 'COOKING',
        criteria: [
          { minimumTemperatureC: 60, minimumDurationSeconds: 600, description: '60°C core temperature held for 10 minutes' },
          { minimumTemperatureC: 65, minimumDurationSeconds: 120, description: '65°C core temperature held for 2 minutes' },
        ],
        sourceReference: 'FSSAI Schedule 4 (Section 5.3 Cooking & Heat Treatment)',
        createdByUserId: actorUserId,
      },
      {
        ruleId: `TRULE-FSSAI-COOK-NONVEG-${cleanOrg}`,
        organisationId: cleanOrg,
        name: 'FSSAI Non-Vegetarian Cooking Time/Temp Combination',
        foodCategory: 'NON_VEGETARIAN',
        processType: 'COOKING',
        criteria: [
          { minimumTemperatureC: 65, minimumDurationSeconds: 600, description: '65°C core temperature held for 10 minutes' },
          { minimumTemperatureC: 70, minimumDurationSeconds: 120, description: '70°C core temperature held for 2 minutes' },
          { minimumTemperatureC: 75, minimumDurationSeconds: 15, description: '75°C core temperature held for 15 seconds' },
        ],
        sourceReference: 'FSSAI Schedule 4 (Section 5.3 Cooking & Heat Treatment)',
        createdByUserId: actorUserId,
      },
      {
        ruleId: `TRULE-FSSAI-REHEAT-${cleanOrg}`,
        organisationId: cleanOrg,
        name: 'FSSAI Rapid Reheating Standard',
        foodCategory: 'ALL',
        processType: 'REHEATING',
        criteria: [
          { minimumTemperatureC: 74, minimumDurationSeconds: 0, description: 'Reheat rapidly to minimum 74°C core temperature' },
        ],
        sourceReference: 'FSSAI Schedule 4 (Section 5.5 Reheating)',
        createdByUserId: actorUserId,
      },
      {
        ruleId: `TRULE-FSSAI-HOTHOLD-${cleanOrg}`,
        organisationId: cleanOrg,
        name: 'FSSAI Hot Holding Standard',
        foodCategory: 'ALL',
        processType: 'HOT_HOLDING',
        criteria: [
          { minimumTemperatureC: 63, minimumDurationSeconds: 0, description: 'Hold hot at minimum 63°C continuously until service' },
        ],
        sourceReference: 'FSSAI Schedule 4 (Section 5.6 Holding & Display)',
        createdByUserId: actorUserId,
      },
      {
        ruleId: `TRULE-FSSAI-COLDHOLD-${cleanOrg}`,
        organisationId: cleanOrg,
        name: 'FSSAI Cold Holding Standard',
        foodCategory: 'ALL',
        processType: 'COLD_HOLDING',
        criteria: [
          { minimumTemperatureC: -2, maximumTemperatureC: 5, minimumDurationSeconds: 0, description: 'Hold cold between 0°C and 5°C' },
        ],
        sourceReference: 'FSSAI Schedule 4 (Section 5.6 Holding & Display)',
        createdByUserId: actorUserId,
      },
      {
        ruleId: `TRULE-FSSAI-COOLING-${cleanOrg}`,
        organisationId: cleanOrg,
        name: 'FSSAI Two-Stage Rapid Cooling Standard',
        foodCategory: 'ALL',
        processType: 'COOLING',
        criteria: [
          { minimumTemperatureC: 0, maximumTemperatureC: 21, minimumDurationSeconds: 7200, description: 'Cool from 60°C to 21°C within 2 hours, then to 5°C within further 4 hours' },
        ],
        sourceReference: 'FSSAI Schedule 4 (Section 5.4 Cooling)',
        createdByUserId: actorUserId,
      },
      {
        ruleId: `TRULE-FSSAI-RECEIVING-CHILLED-${cleanOrg}`,
        organisationId: cleanOrg,
        name: 'FSSAI Chilled Food Receiving Standard',
        foodCategory: 'ALL',
        processType: 'RECEIVING',
        criteria: [
          { minimumTemperatureC: -2, maximumTemperatureC: 5, minimumDurationSeconds: 0, description: 'Chilled delivery vehicle and core temperature <= 5°C' },
        ],
        sourceReference: 'FSSAI Schedule 4 (Section 4.1 Receipt of Raw Materials)',
        createdByUserId: actorUserId,
      },
    ];

    const seeded = [];
    for (const def of defaultRules) {
      const existing = await FoodSafetyTemperatureRule.findOne({ ruleId: def.ruleId });
      if (!existing) {
        const created = await FoodSafetyTemperatureRule.create(def);
        seeded.push(created);
      } else {
        seeded.push(existing);
      }
    }

    return seeded;
  }
}

module.exports = {
  TemperatureRuleService,
};
