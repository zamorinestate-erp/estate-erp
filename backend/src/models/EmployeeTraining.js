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

const EmployeeTraining = mongoose.model('EmployeeTraining', employeeTrainingSchema);

module.exports = {
  EmployeeTraining,
  TRAINING_RECURRENCES,
  TRAINING_STATUSES,
  TRAINING_TYPES,
  MEDICAL_FITNESS_STATUSES,
  FOSTAC_VERIFICATION_STATUSES,
};
