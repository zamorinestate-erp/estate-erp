'use strict';

const mongoose = require('mongoose');

const SKILL_CATEGORIES = ['BARISTA', 'KITCHEN', 'SERVICE', 'MANAGEMENT', 'COMPLIANCE', 'OPERATIONS'];
const PROFICIENCY_LEVELS = ['FOUNDATION', 'COMPETENT', 'ADVANCED', 'EXPERT'];

const employeeSkillSchema = new mongoose.Schema(
  {
    skillId: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      uppercase: true,
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
    skillName: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
    },
    category: {
      type: String,
      enum: SKILL_CATEGORIES,
      default: 'BARISTA',
    },
    proficiency: {
      type: String,
      enum: PROFICIENCY_LEVELS,
      default: 'COMPETENT',
    },
    verifiedBy: {
      type: String,
      trim: true,
      uppercase: true,
      default: null,
    },
    verifiedAt: {
      type: Date,
      default: null,
    },
    validUntil: {
      type: String,
      default: null,
    },
    evidenceUrl: {
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

employeeSkillSchema.index({ organisationId: 1, userId: 1, skillName: 1 });

const EmployeeSkill = mongoose.model('EmployeeSkill', employeeSkillSchema);

module.exports = {
  EmployeeSkill,
  SKILL_CATEGORIES,
  PROFICIENCY_LEVELS,
};
