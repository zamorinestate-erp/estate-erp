'use strict';

const mongoose = require('mongoose');

const TRAINING_RECURRENCES = ['ONE_TIME', 'ANNUAL', 'SEMI_ANNUAL', 'ROLE_CHANGE', 'POLICY_REVISION', 'FOSTAC_RENEWAL', 'QUARTERLY'];
const TRAINING_STATUSES = ['ASSIGNED', 'IN_PROGRESS', 'COMPLETED', 'OVERDUE', 'EXPIRED', 'UPCOMING', 'DUE'];
const TRAINING_TYPES = ['GENERAL', 'FOOD_SAFETY_BASIC', 'FOOD_SAFETY_ADVANCED', 'FOSTAC', 'HACCP', 'HYGIENE', 'FOOD_SAFETY_ONSITE'];
const MEDICAL_FITNESS_STATUSES = ['FIT', 'UNFIT', 'PENDING_EXAMINATION'];
const FOSTAC_VERIFICATION_STATUSES = [
  'RECORDED',
  'PENDING_MANUAL_VERIFICATION',
  'MANUALLY_VERIFIED',
  'OFFICIAL_VERIFICATION_CONFIRMED',
  'INVALID',
  'EXPIRED',
];

const employeeTrainingSchema = new mongoose.Schema(
  {
    trainingId: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      uppercase: true,
      match: /^TRN-[\w-]+$/,
    },
    organisationId: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
      index: true,
    },
    cafeId: {
      type: String,
      trim: true,
      uppercase: true,
      index: true,
      default: '',
    },
    userId: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
      index: true,
    },
    trainingTitle: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120,
    },
    trainingType: {
      type: String,
      enum: TRAINING_TYPES,
      default: 'GENERAL',
      index: true,
    },
    fostacCertificateNumber: {
      type: String,
      trim: true,
      default: '',
    },
    certificateValidityStatus: {
      type: String,
      enum: ['VALID', 'TIME_BOUND', 'CONDITIONALLY_VALID', 'REVOKED', 'EXPIRED', 'PERPETUAL'],
      default: 'VALID', // FSSAI Notice 1 Feb 2024 / 5 Aug 2026 procedure: 2-year validity period (perpetual default revoked)
    },
    certificateIssuedDate: {
      type: Date,
      default: null,
    },
    certificateExpiryDate: {
      type: Date,
      default: null,
    },
    applicableFoSTaCRuleVersion: {
      type: String,
      default: 'FOSTAC_PROCEDURE_2026_08_05',
    },
    refresherRequired: {
      type: Boolean,
      default: true,
    },
    refresherDueDate: {
      type: Date,
      default: null,
    },
    refresherCompletedDate: {
      type: Date,
      default: null,
    },
    renewedCertificateReference: {
      type: String,
      trim: true,
      default: '',
    },
    kob: {
      type: String,
      trim: true,
      default: 'CATERING',
    },
    certificateEvidence: {
      type: String,
      trim: true,
      default: '',
    },
    refresherRequirement: {
      required: { type: Boolean, default: true },
      frequency: { type: String, default: 'BIENNIAL' }, // Refresher required every 2 years for renewal
      lastCompletedDate: { type: Date, default: null },
      nextDueDate: { type: Date, default: null },
    },
    fostacVerificationStatus: {
      type: String,
      enum: FOSTAC_VERIFICATION_STATUSES,
      default: 'RECORDED',
      index: true,
    },
    fostacVerificationAudit: {
      verifiedByUserId: { type: String, trim: true, default: '' },
      verifiedAt: { type: Date, default: null },
      verificationMethod: { type: String, trim: true, default: '' },
      reference: { type: String, trim: true, default: '' },
      result: { type: String, trim: true, default: '' },
    },
    trainer: {
      userId: { type: String, trim: true, default: '' },
      name: { type: String, trim: true, default: '' },
      designation: { type: String, trim: true, default: '' },
    },
    attendance: [
      {
        employeeUserId: { type: String, trim: true },
        name: { type: String, trim: true, default: '' },
        attended: { type: Boolean, default: true },
      },
    ],
    topics: [
      {
        type: String,
        trim: true,
      },
    ],
    evidence: {
      type: String,
      trim: true,
      default: '',
    },
    isFoodSafetySupervisor: {
      type: Boolean,
      default: false,
    },
    medicalFitnessStatus: {
      type: String,
      enum: MEDICAL_FITNESS_STATUSES,
      default: 'FIT',
    },
    medicalCertificateExpiry: {
      type: String,
      default: null,
    },
    typhoidVaccinationDate: {
      type: String,
      default: null,
    },
    dewormingDate: {
      type: String,
      default: null,
    },
    provider: {
      type: String,
      trim: true,
      default: 'Zamorin Academy',
    },
    recurrence: {
      type: String,
      enum: TRAINING_RECURRENCES,
      default: 'ONE_TIME',
    },
    status: {
      type: String,
      enum: TRAINING_STATUSES,
      default: 'ASSIGNED',
      index: true,
    },
    assignedDate: {
      type: String,
      default: () => new Date().toISOString().split('T')[0],
    },
    dueDate: {
      type: String,
      required: true,
    },
    completedAt: {
      type: Date,
      default: null,
    },
    verifiedBy: {
      type: String,
      trim: true,
      uppercase: true,
      default: null,
    },
    validUntil: {
      type: String,
      default: null,
    },
    certificateRef: {
      type: String,
      trim: true,
      default: '',
    },
    notes: {
      type: String,
      trim: true,
      default: '',
    },
  },
  {
    timestamps: true,
  }
);

employeeTrainingSchema.index({ organisationId: 1, userId: 1, status: 1 });

/**
 * Authoritative FoSTaC Food Safety Supervisor Certificate Validity Engine
 * Resolves FSSAI 1 Feb 2024 Notice & 5 August 2026 Standardized Procedure:
 * - 2-year validity period (perpetual default revoked)
 * - Refresher training mandatory for renewal
 * - Kind of Business (KoB) mismatch invalidation
 * - Historical grandfathered rule support only if explicitly configured
 */
employeeTrainingSchema.statics.evaluateFoSTaCCertificateValidity = function ({
  issuedDate,
  ruleVersion = 'FOSTAC_PROCEDURE_2026_08_05',
  kob = 'CATERING',
  operationalKob = 'CATERING',
  refresherCompletedDate = null,
  asOfDate = new Date(),
  historicalGrandfathered = false,
}) {
  const issue = new Date(issuedDate);
  const now = new Date(asOfDate);

  // Check if historical grandfathered under superseded 16 June 2023 clarification
  if (historicalGrandfathered && ruleVersion === 'FSSAI_CLARIFICATION_2023_06_16') {
    const isKobMatch = String(kob).toUpperCase() === String(operationalKob).toUpperCase();
    return {
      certificateStatus: isKobMatch ? 'PERPETUAL' : 'INVALID_KOB_MISMATCH',
      isCurrentlyValid: isKobMatch,
      certificateExpiryDate: null,
      refresherRequired: true,
      refresherDueDate: new Date(issue.getTime() + 2 * 365 * 86400000),
      applicableRule: 'FSSAI Clarification dated 16 June 2023 (Historical Perpetual — Superseded)',
      validityYears: Infinity,
      retrainingRequired: !isKobMatch,
    };
  }

  // FSSAI Notice 1 Feb 2024 & 5 August 2026 Standardized Procedure: Strict 2-Year Validity
  const expiry = new Date(issue.getTime() + 2 * 365 * 86400000);
  const isKobMatch = String(kob).toUpperCase() === String(operationalKob).toUpperCase();

  if (!isKobMatch) {
    return {
      certificateStatus: 'INVALID_KOB_MISMATCH',
      isCurrentlyValid: false,
      certificateExpiryDate: expiry,
      refresherRequired: true,
      refresherDueDate: expiry,
      applicableRule: 'FoSTaC Standardized Procedure 5 August 2026 (KoB stream mismatch invalidates certificate)',
      validityYears: 2,
      retrainingRequired: true,
    };
  }

  if (now > expiry) {
    if (refresherCompletedDate) {
      const refreshedDate = new Date(refresherCompletedDate);
      const newExpiry = new Date(refreshedDate.getTime() + 2 * 365 * 86400000);
      const isStillValid = now <= newExpiry;
      return {
        certificateStatus: isStillValid ? 'VALID' : 'EXPIRED',
        isCurrentlyValid: isStillValid,
        certificateExpiryDate: newExpiry,
        refresherRequired: true,
        refresherDueDate: newExpiry,
        applicableRule: 'FoSTaC Standardized Procedure 5 August 2026 (Refresher Completed - Renewed 2-Year Validity)',
        validityYears: 2,
        retrainingRequired: !isStillValid,
        isRenewed: true,
      };
    }

    return {
      certificateStatus: 'EXPIRED',
      isCurrentlyValid: false,
      certificateExpiryDate: expiry,
      refresherRequired: true,
      refresherDueDate: expiry,
      applicableRule: 'FSSAI Notice 1 Feb 2024 / FoSTaC Procedure 5 Aug 2026 (2-Year Expiry Reached)',
      validityYears: 2,
      retrainingRequired: true,
    };
  }

  return {
    certificateStatus: 'VALID',
    isCurrentlyValid: true,
    certificateExpiryDate: expiry,
    refresherRequired: true,
    refresherDueDate: expiry,
    applicableRule: 'FoSTaC Standardized Procedure 5 August 2026 & FSSAI Notice 1 Feb 2024 (2-Year Validity)',
    validityYears: 2,
    retrainingRequired: false,
  };
};

const EmployeeTraining = mongoose.model('EmployeeTraining', employeeTrainingSchema);

module.exports = {
  EmployeeTraining,
  TRAINING_RECURRENCES,
  TRAINING_STATUSES,
  TRAINING_TYPES,
  MEDICAL_FITNESS_STATUSES,
  FOSTAC_VERIFICATION_STATUSES,
};
