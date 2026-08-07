'use strict';

/**
 * TASK — MONGOOSE MODEL
 */

const mongoose = require('mongoose');

const TASK_PRIORITIES = ['LOW', 'NORMAL', 'HIGH', 'URGENT'];
const TASK_STATUSES = ['PENDING', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'];

const taskSchema = new mongoose.Schema(
  {
    taskId: {
      type: String,
      required: true,
      unique: true,
      immutable: true,
      trim: true,
      uppercase: true,
      match: /^TSK-\d{4,}$/,
      index: true,
    },

    organisationId: {
      type: String,
      required: true,
      immutable: true,
      trim: true,
      uppercase: true,
      index: true,
    },

    cafeId: {
      type: String,
      trim: true,
      uppercase: true,
      default: null,
      index: true,
    },

    title: {
      type: String,
      required: true,
      trim: true,
      minlength: 1,
      maxlength: 300,
    },

    description: {
      type: String,
      trim: true,
      maxlength: 2000,
      default: '',
    },

    assignedRole: {
      type: String,
      enum: ['MASTER', 'OWNER', 'CAFE_ADMIN', 'STAFF'],
      default: 'CAFE_ADMIN',
    },

    assignedUserId: {
      type: String,
      trim: true,
      uppercase: true,
      default: null,
    },

    priority: {
      type: String,
      enum: TASK_PRIORITIES,
      default: 'NORMAL',
    },

    status: {
      type: String,
      enum: TASK_STATUSES,
      default: 'PENDING',
      index: true,
    },

    dueDate: {
      type: String,
      trim: true,
      match: /^\d{4}-\d{2}-\d{2}$/,
      default: null,
    },

    completedByUserId: {
      type: String,
      trim: true,
      uppercase: true,
      default: null,
    },

    completedAt: {
      type: Date,
      default: null,
    },

    createdByUserId: {
      type: String,
      required: true,
      immutable: true,
      trim: true,
      uppercase: true,
    },
  },
  {
    timestamps: true,
    versionKey: 'version',
    collection: 'tasks',
  }
);

taskSchema.index(
  { organisationId: 1, status: 1, assignedRole: 1 },
  { name: 'org_status_role' }
);

taskSchema.pre('validate', function normaliseTaskFields() {
  const upperFields = ['taskId', 'organisationId', 'cafeId', 'assignedUserId', 'completedByUserId', 'createdByUserId'];
  for (const field of upperFields) {
    if (this[field] && typeof this[field] === 'string') {
      this[field] = this[field].trim().toUpperCase();
    }
  }
  if (this.priority) this.priority = this.priority.trim().toUpperCase();
  if (this.status) this.status = this.status.trim().toUpperCase();
  if (this.assignedRole) this.assignedRole = this.assignedRole.trim().toUpperCase();
});

const Task =
  mongoose.models.Task ||
  mongoose.model('Task', taskSchema);

module.exports = {
  Task,
  TASK_PRIORITIES,
  TASK_STATUSES,
};
