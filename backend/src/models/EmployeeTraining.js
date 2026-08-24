'use strict';

const mongoose = require('mongoose');

const TRAINING_RECURRENCES = ['ONE_TIME', 'ANNUAL', 'SEMI_ANNUAL', 'ROLE_CHANGE', 'POLICY_REVISION'];
const TRAINING_STATUSES = ['ASSIGNED', 'IN_PROGRESS', 'COMPLETED', 'OVERDUE', 'EXPIRED'];

const employeeTrainingSchema = new mongoose.Schema(
  {
    trainingId: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      uppercase: true,
      match: /^TRN-\d{4}-\d{4}$/,
    },
    organisationId: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
      index: true,
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
};
