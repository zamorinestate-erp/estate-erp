'use strict';

/**
 * ============================================================================
 * ZAMORIN CAFÉ ERP — FOOD SAFETY & HYGIENE SERVICE
 * ============================================================================
 * Implements core HACCP, PRP, Temperature Logging, Sanitation Tasks,
 * Pest Control, Calibration, and Cooking Oil Quality management.
 *
 * Enforces automated out-of-range detection, immutable excursion records,
 * and double-entry corrective action tracking.
 */

const { TemperatureLog } = require('../models/TemperatureLog');
const { CleaningTask } = require('../models/CleaningTask');
const { PestControlRecord } = require('../models/PestControlRecord');
const { CalibrationRecord } = require('../models/CalibrationRecord');
const { AuditEvent } = require('../models/AuditEvent');
const { EmployeeTraining, FOSTAC_VERIFICATION_STATUSES } = require('../models/EmployeeTraining');
const { ApiError } = require('../utils/ApiError');
const { TemperatureRuleService } = require('./temperatureRuleService');
const { calculateNextQuarterlyDueDate } = require('../utils/trainingRecurrence');

class FoodSafetyService {
  /**
   * Records a temperature check with automated range evaluation and excursion tracking.
   */
  static async recordTemperature({
    organisationId,
    cafeId,
    monitoringPoint,
    monitoringPointName = '',
    equipmentId = null,
    equipmentName = '',
    readingCelsius,
    minimumAllowedCelsius,
    maximumAllowedCelsius,
    recordedByUserId,
    operatorSessionId = null,
    remarks = '',
    processType = null,
    foodCategory = 'ALL',
    durationSeconds = 0,
  }) {
    if (readingCelsius === undefined || (minimumAllowedCelsius === undefined && !processType) || (maximumAllowedCelsius === undefined && !processType)) {
      throw new ApiError(400, 'INVALID_READING', 'Temperature reading, thresholds or processType are required.');
    }

    const reading = Number(readingCelsius);
    let min = minimumAllowedCelsius !== undefined ? Number(minimumAllowedCelsius) : 0;
    let max = maximumAllowedCelsius !== undefined ? Number(maximumAllowedCelsius) : 100;

    let isExcursion = false;
    let status = 'WITHIN_RANGE';
    let ruleEvalStatus = 'NOT_EVALUATED';
    let matchedRuleId = null;
    let matchedRuleVersion = null;

    if (processType) {
      const evalResult = await TemperatureRuleService.evaluateTemperatureRule({
        organisationId,
        cafeId,
        foodCategory,
        processType,
        measuredTemperatureC: reading,
        durationSeconds,
      });

      ruleEvalStatus = evalResult.status;
      matchedRuleId = evalResult.matchedRuleId;
      matchedRuleVersion = evalResult.ruleVersion || null;

      if (evalResult.status === 'FAIL') {
        isExcursion = true;
        status = 'OUT_OF_RANGE';
      } else if (evalResult.status === 'PASS') {
        isExcursion = false;
        status = 'WITHIN_RANGE';
      } else if (evalResult.status === 'RULE_NOT_CONFIGURED') {
        // Strict safety: unconfigured rule requires manual verification
        isExcursion = true;
        status = 'OUT_OF_RANGE';
      }
    } else {
      isExcursion = reading < min || reading > max;
      status = isExcursion ? 'OUT_OF_RANGE' : 'WITHIN_RANGE';
    }

    const datePart = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const rand = Math.floor(1000 + Math.random() * 9000);
    const logId = `TEMP-${datePart}-${rand}`;

    const log = await TemperatureLog.create({
      logId,
      organisationId,
      cafeId,
      monitoringPoint,
      monitoringPointName,
      equipmentId,
      equipmentName,
      readingCelsius: reading,
      minimumAllowedCelsius: min,
      maximumAllowedCelsius: max,
      status,
      isExcursion,
      originalExcursionReading: isExcursion ? reading : null,
      recordedByUserId,
      operatorSessionId,
      remarks,
      processType,
      foodCategory,
      durationSeconds,
      ruleId: matchedRuleId,
      temperatureRuleId: matchedRuleId,
      ruleVersion: matchedRuleVersion,
      ruleEvaluationStatus: ruleEvalStatus,
    });

    // Record audit event for food safety excursion
    if (isExcursion) {
      await AuditEvent.create({
        auditEventId: `AUDIT-TEMP-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        organisationId,
        cafeId,
        action: 'TEMPERATURE_EXCURSION_DETECTED',
        targetResource: 'TemperatureLog',
        resourceId: logId,
        actorUserId: recordedByUserId,
        outcome: 'WARNING',
        severity: 'HIGH',
        metadata: {
          reading,
          min,
          max,
          monitoringPoint,
          equipmentId,
        },
      }).catch(() => {});
    }

    return log;
  }

  /**
   * Applies corrective action to an out-of-range temperature log without overwriting original.
   */
  static async applyCorrectiveAction({
    organisationId,
    cafeId,
    logId,
    correctiveAction,
    resolvedReadingCelsius,
    actionTakenByUserId,
    remarks = '',
  }) {
    const log = await TemperatureLog.findOne({ organisationId, cafeId, logId });
    if (!log) {
      throw new ApiError(404, 'TEMP_LOG_NOT_FOUND', `Temperature record ${logId} not found.`);
    }

    if (!log.isExcursion) {
      throw new ApiError(400, 'NO_EXCURSION', 'This temperature reading was within range and does not require corrective action.');
    }

    log.correctiveAction = correctiveAction;
    log.actionTakenByUserId = actionTakenByUserId;
    log.actionTakenAt = new Date();
    if (resolvedReadingCelsius !== undefined && resolvedReadingCelsius !== null) {
      log.resolvedReadingCelsius = Number(resolvedReadingCelsius);
    }
    log.status = 'CORRECTED';
    if (remarks) {
      log.remarks = `${log.remarks ? log.remarks + ' | ' : ''}${remarks}`;
    }

    await log.save();

    await AuditEvent.create({
      auditEventId: `AUDIT-CORR-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      organisationId,
      cafeId,
      action: 'TEMPERATURE_CORRECTIVE_ACTION_APPLIED',
      targetResource: 'TemperatureLog',
      resourceId: logId,
      actorUserId: actionTakenByUserId,
      outcome: 'SUCCESS',
      metadata: {
        originalReading: log.originalExcursionReading,
        resolvedReading: log.resolvedReadingCelsius,
        correctiveAction,
      },
    }).catch(() => {});

    return log;
  }

  /**
   * Queries temperature logs with filtering.
   */
  static async listTemperatures({ organisationId, cafeId, excursionsOnly = false, limit = 50 }) {
    const query = { organisationId, cafeId };
    if (excursionsOnly) {
      query.isExcursion = true;
    }
    return TemperatureLog.find(query).sort({ recordedAt: -1 }).limit(limit).lean();
  }

  /**
   * Creates a scheduled cleaning task.
   */
  static async createCleaningTask({
    organisationId,
    cafeId,
    areaOrEquipment,
    procedure,
    frequency = 'DAILY',
    assignedRole = 'OPERATOR',
    assignedUserId = null,
    dueDateTime,
    remarks = '',
  }) {
    const datePart = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const rand = Math.floor(1000 + Math.random() * 9000);
    const taskId = `CLN-${datePart}-${rand}`;

    return CleaningTask.create({
      taskId,
      organisationId,
      cafeId,
      areaOrEquipment,
      procedure,
      frequency,
      assignedRole,
      assignedUserId,
      dueDateTime: new Date(dueDateTime),
      remarks,
    });
  }

  /**
   * Marks a cleaning task as completed with optional verification.
   */
  static async completeCleaningTask({
    organisationId,
    cafeId,
    taskId,
    completedByUserId,
    verifiedByUserId = null,
    remarks = '',
  }) {
    const task = await CleaningTask.findOne({ organisationId, cafeId, taskId });
    if (!task) {
      throw new ApiError(404, 'CLEANING_TASK_NOT_FOUND', `Cleaning task ${taskId} not found.`);
    }

    task.completedDateTime = new Date();
    task.completedByUserId = completedByUserId;
    if (verifiedByUserId) {
      task.verifiedByUserId = verifiedByUserId;
      task.verificationDate = new Date();
      task.status = 'COMPLETED';
    } else {
      task.status = 'VERIFICATION_REQUIRED';
    }
    if (remarks) {
      task.remarks = `${task.remarks ? task.remarks + ' | ' : ''}${remarks}`;
    }

    await task.save();

    await AuditEvent.create({
      auditEventId: `AUDIT-CLN-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      organisationId,
      cafeId,
      action: 'CLEANING_TASK_COMPLETED',
      targetResource: 'CleaningTask',
      resourceId: taskId,
      actorUserId: completedByUserId,
      outcome: 'SUCCESS',
      metadata: {
        areaOrEquipment: task.areaOrEquipment,
        status: task.status,
      },
    }).catch(() => {});

    return task;
  }

  /**
   * Lists cleaning tasks, marking overdue uncompleted tasks as MISSED.
   */
  static async listCleaningTasks({ organisationId, cafeId, status = null, limit = 50 }) {
    const now = new Date();
    // Auto-update overdue tasks that are still DUE
    await CleaningTask.updateMany(
      {
        organisationId,
        cafeId,
        status: 'DUE',
        dueDateTime: { $lt: now },
      },
      { $set: { status: 'MISSED' } }
    ).catch(() => {});

    const query = { organisationId, cafeId };
    if (status) {
      query.status = status;
    }

    return CleaningTask.find(query).sort({ dueDateTime: 1 }).limit(limit).lean();
  }

  /**
   * Records a pest control service visit.
   */
  static async recordPestControl({
    organisationId,
    cafeId,
    serviceProvider,
    vendorId = null,
    serviceDate,
    areasTreated,
    treatmentAction,
    findings = '',
    followUpRequired = false,
    nextDueDate,
    certificateNumber = '',
    recordedByUserId,
    remarks = '',
  }) {
    const datePart = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const rand = Math.floor(1000 + Math.random() * 9000);
    const recordId = `PEST-${datePart}-${rand}`;

    return PestControlRecord.create({
      recordId,
      organisationId,
      cafeId,
      serviceProvider,
      vendorId,
      serviceDate: new Date(serviceDate),
      areasTreated: Array.isArray(areasTreated) ? areasTreated : [areasTreated],
      treatmentAction,
      findings,
      followUpRequired: Boolean(followUpRequired),
      nextDueDate: new Date(nextDueDate),
      certificateNumber,
      status: followUpRequired ? 'FOLLOW_UP_SCHEDULED' : 'COMPLETED',
      recordedByUserId,
      remarks,
    });
  }

  static async listPestControl({ organisationId, cafeId, limit = 50 }) {
    return PestControlRecord.find({ organisationId, cafeId }).sort({ serviceDate: -1 }).limit(limit).lean();
  }

  /**
   * Records an equipment calibration.
   */
  static async recordCalibration({
    organisationId,
    cafeId,
    assetId,
    assetName,
    equipmentType = 'PROBE_THERMOMETER',
    calibrationDate,
    result = 'PASS',
    certificateNumber = '',
    nextDueDate,
    performedBy,
    recordedByUserId,
    remarks = '',
  }) {
    const datePart = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const rand = Math.floor(1000 + Math.random() * 9000);
    const calibrationId = `CAL-${datePart}-${rand}`;

    return CalibrationRecord.create({
      calibrationId,
      organisationId,
      cafeId,
      assetId,
      assetName,
      equipmentType,
      calibrationDate: new Date(calibrationDate),
      result,
      certificateNumber,
      nextDueDate: new Date(nextDueDate),
      performedBy,
      status: result === 'FAIL' ? 'FAILED' : 'VALID',
      recordedByUserId,
      remarks,
    });
  }

  static async listCalibrations({ organisationId, cafeId, limit = 50 }) {
    return CalibrationRecord.find({ organisationId, cafeId }).sort({ nextDueDate: 1 }).limit(limit).lean();
  }

  /**
   * Records a quarterly onsite food safety training session conducted by a Food Safety Supervisor.
   * Calculates next quarterly recurrence and tracks attendees and topics.
   */
  static async recordQuarterlyTrainingSession({
    organisationId,
    cafeId,
    userId,
    trainingTitle = 'Quarterly Onsite Food-Handler Training',
    trainer = {},
    topics = [],
    attendance = [],
    dueDate = null,
    completedAt = null,
    evidence = '',
    notes = '',
  }) {
    if (!organisationId || !cafeId) {
      throw new ApiError(400, 'INVALID_TRAINING_PARAMS', 'OrganisationId and CafeId are required.');
    }

    const cleanOrg = organisationId.trim().toUpperCase();
    const cleanCafe = cafeId.trim().toUpperCase();
    const cleanUser = (userId || trainer.userId || 'TRAINER').trim().toUpperCase();

    const todayStr = new Date().toISOString().slice(0, 10);
    const resolvedDueDate = dueDate || todayStr;

    let status = 'DUE';
    if (completedAt) {
      status = 'COMPLETED';
    } else if (resolvedDueDate < todayStr) {
      status = 'OVERDUE';
    } else if (resolvedDueDate > todayStr) {
      status = 'UPCOMING';
    }

    const datePart = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const randPart = Math.floor(1000 + Math.random() * 9000);
    const trainingId = `TRN-ONSITE-${datePart}-${randPart}`;

    const training = await EmployeeTraining.create({
      trainingId,
      organisationId: cleanOrg,
      cafeId: cleanCafe,
      userId: cleanUser,
      trainingTitle,
      trainingType: 'FOOD_SAFETY_ONSITE',
      recurrence: 'QUARTERLY',
      status,
      dueDate: resolvedDueDate,
      completedAt: completedAt ? new Date(completedAt) : null,
      trainer: {
        userId: (trainer.userId || cleanUser).trim().toUpperCase(),
        name: trainer.name || 'Food Safety Supervisor',
        designation: trainer.designation || 'Food Safety Supervisor',
      },
      attendance: Array.isArray(attendance) ? attendance : [],
      topics: Array.isArray(topics) ? topics : [],
      evidence,
      notes,
    });

    // Calculate next quarterly due date using explicit 3 calendar months policy
    const baseDate = completedAt ? new Date(completedAt) : new Date(resolvedDueDate);
    const nextQuarterlyDueDate = calculateNextQuarterlyDueDate(baseDate);

    return {
      training,
      nextQuarterlyDueDate,
      isOverdue: status === 'OVERDUE',
    };
  }

  /**
   * Verifies a FoSTaC certificate with explicit audit trail and valid status semantics.
   * Prohibits unsupported claims of official confirmation without audit evidence.
   */
  static async verifyFostacCertificate({
    organisationId,
    trainingId,
    verifiedByUserId,
    verificationMethod = 'MANUAL_INSPECTION',
    reference = '',
    verificationStatus = 'MANUALLY_VERIFIED',
    result = 'VALID',
  }) {
    if (!organisationId || !trainingId || !verifiedByUserId) {
      throw new ApiError(400, 'INVALID_VERIFICATION_PARAMS', 'OrganisationId, trainingId, and verifiedByUserId are required.');
    }

    if (!FOSTAC_VERIFICATION_STATUSES.includes(verificationStatus)) {
      throw new ApiError(400, 'INVALID_STATUS', `Status must be one of: ${FOSTAC_VERIFICATION_STATUSES.join(', ')}`);
    }

    const cleanOrg = organisationId.trim().toUpperCase();
    const cleanTrainingId = trainingId.trim().toUpperCase();
    const cleanVerifier = verifiedByUserId.trim().toUpperCase();

    const training = await EmployeeTraining.findOne({
      organisationId: cleanOrg,
      trainingId: cleanTrainingId,
    });

    if (!training) {
      throw new ApiError(404, 'TRAINING_NOT_FOUND', `Training record ${cleanTrainingId} not found.`);
    }

    training.fostacVerificationStatus = verificationStatus;
    training.fostacVerificationAudit = {
      verifiedByUserId: cleanVerifier,
      verifiedAt: new Date(),
      verificationMethod: String(verificationMethod).trim(),
      reference: String(reference).trim(),
      result: String(result).trim(),
    };
    training.verifiedBy = cleanVerifier;

    await training.save();
    return training;
  }
}

module.exports = {
  FoodSafetyService,
};
