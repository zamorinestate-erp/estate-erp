'use strict';

/**
 * ATTENDANCE — MONGOOSE MODEL (SCREEN 004: ATTENDANCE & SHIFTS)
 */

const mongoose = require('mongoose');

const ATTENDANCE_STATUSES = [
  'CHECKED_IN',
  'CHECKED_OUT',
  'ON_BREAK',
  'MISSED_PUNCH',
  'ABSENT',
  'ON_LEAVE',
  'HOLIDAY',
  'WEEKLY_OFF',
  'NOT_SCHEDULED',
  'SCHEDULED',
];

const ATTENDANCE_SOURCES = [
  'SELF',
  'CAFE_ADMIN',
  'MASTER',
  'SYSTEM',
  'OFFLINE_SYNC',
];

const rawTimeEventSchema = new mongoose.Schema(
  {
    eventType: {
      type: String,
      enum: ['CHECK_IN', 'BREAK_START', 'BREAK_END', 'CHECK_OUT'],
      required: true,
    },
    timestamp: {
      type: Date,
      required: true,
      default: Date.now,
    },
    source: {
      type: String,
      enum: ATTENDANCE_SOURCES,
      default: 'SELF',
    },
    recordedByUserId: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
    },
    isGeofenceVerified: {
      type: Boolean,
      default: true,
    },
    isQrVerified: {
      type: Boolean,
      default: true,
    },
    isSelfieVerified: {
      type: Boolean,
      default: true,
    },
    selfieFileId: {
      type: String,
      default: null,
    },
    isOfflineSync: {
      type: Boolean,
      default: false,
    },
    notes: {
      type: String,
      trim: true,
      default: '',
    },
  },
  { _id: false }
);

const attendanceSchema = new mongoose.Schema(
  {
    attendanceId: {
      type: String,
      required: true,
      unique: true,
      immutable: true,
      trim: true,
      uppercase: true,
      match: /^AT-\d{8}-\d{3,}$/,
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
      required: true,
      trim: true,
      uppercase: true,
      index: true,
    },

    userId: {
      type: String,
      required: true,
      immutable: true,
      trim: true,
      uppercase: true,
      index: true,
    },

    businessDate: {
      type: String,
      required: true,
      immutable: true,
      match: /^\d{4}-\d{2}-\d{2}$/,
      index: true,
    },

    status: {
      type: String,
      required: true,
      enum: ATTENDANCE_STATUSES,
      default: 'CHECKED_IN',
      index: true,
    },

    shiftId: {
      type: String,
      default: null,
    },

    shiftName: {
      type: String,
      default: 'Regular Shift',
    },

    scheduledStart: {
      type: String,
      default: '07:00',
    },

    scheduledEnd: {
      type: String,
      default: '15:30',
    },

    checkInAt: {
      type: Date,
      default: null,
    },

    checkOutAt: {
      type: Date,
      default: null,
    },

    checkInSource: {
      type: String,
      enum: ATTENDANCE_SOURCES,
      default: 'SELF',
    },

    checkOutSource: {
      type: String,
      enum: ATTENDANCE_SOURCES,
      default: null,
    },

    checkInRecordedBy: {
      type: String,
      trim: true,
      uppercase: true,
      default: null,
    },

    checkOutRecordedBy: {
      type: String,
      trim: true,
      uppercase: true,
      default: null,
    },

    regularMinutes: {
      type: Number,
      min: 0,
      default: 0,
    },

    breakMinutes: {
      type: Number,
      min: 0,
      default: 0,
    },

    detectedOvertimeMinutes: {
      type: Number,
      min: 0,
      default: 0,
    },

    approvedOvertimeMinutes: {
      type: Number,
      min: 0,
      default: 0,
    },

    overtimeMinutes: {
      type: Number,
      min: 0,
      default: 0,
    },

    overtimeStatus: {
      type: String,
      enum: ['NOT_APPLICABLE', 'PENDING_REVIEW', 'VERIFIED_BY_ADMIN', 'APPROVED_BY_PRIMARY', 'REJECTED'],
      default: 'NOT_APPLICABLE',
    },

    overtimeDecidedByUserId: {
      type: String,
      trim: true,
      uppercase: true,
      default: null,
    },

    overtimeDecidedAt: {
      type: Date,
      default: null,
    },

    overtimeReason: {
      type: String,
      trim: true,
      default: '',
    },

    totalWorkedMinutes: {
      type: Number,
      min: 0,
      default: 0,
    },

    // Secondary Condition Markers
    isLate: { type: Boolean, default: false },
    isEarlyExit: { type: Boolean, default: false },
    isOvertime: { type: Boolean, default: false },
    isManualEntry: { type: Boolean, default: false },
    isCorrection: { type: Boolean, default: false },
    geofenceException: { type: Boolean, default: false },
    qrException: { type: Boolean, default: false },
    deviceException: { type: Boolean, default: false },

    // Evidence & Privacy
    selfieFileId: { type: String, default: null },
    isEvidenceHold: { type: Boolean, default: false },
    evidenceHoldReason: { type: String, default: '' },
    isSelfiePurged: { type: Boolean, default: false },
    selfiePurgedAt: { type: Date, default: null },

    // Attestation & Closure
    isEmployeeAttested: { type: Boolean, default: false },
    attestedAt: { type: Date, default: null },
    isLocked: { type: Boolean, default: false },

    // Raw Ledger
    rawTimeEvents: [rawTimeEventSchema],

    notes: {
      type: String,
      trim: true,
      maxlength: 1000,
      default: '',
    },

    correctionRequired: {
      type: Boolean,
      default: false,
    },

    correctionReason: {
      type: String,
      trim: true,
      maxlength: 1000,
      default: '',
    },

    timezone: {
      type: String,
      immutable: true,
      default: 'Asia/Kolkata',
    },

    createdBy: {
      type: String,
      required: true,
      immutable: true,
      trim: true,
      uppercase: true,
    },

    updatedBy: {
      type: String,
      trim: true,
      uppercase: true,
      default: null,
    },
  },
  {
    timestamps: true,
    optimisticConcurrency: true,
    versionKey: 'version',
    collection: 'attendance',
  }
);

attendanceSchema.index(
  {
    organisationId: 1,
    userId: 1,
    businessDate: 1,
  },
  {
    unique: true,
    name: 'user_business_date_unique',
  }
);

attendanceSchema.index(
  {
    organisationId: 1,
    cafeId: 1,
    businessDate: 1,
    status: 1,
  },
  {
    name: 'cafe_date_status',
  }
);

attendanceSchema.pre(
  'validate',
  function normalizeAttendanceFields() {
    if (this.attendanceId) {
      this.attendanceId =
        this.attendanceId.trim().toUpperCase();
    }

    if (this.organisationId) {
      this.organisationId =
        this.organisationId.trim().toUpperCase();
    }

    if (this.cafeId) {
      this.cafeId =
        this.cafeId.trim().toUpperCase();
    }

    if (this.userId) {
      this.userId =
        this.userId.trim().toUpperCase();
    }
  }
);

attendanceSchema.methods.calculateWorkedMinutes =
  function calculateWorkedMinutes() {
    if (!this.checkInAt || !this.checkOutAt) {
      this.totalWorkedMinutes = 0;
      this.regularMinutes = 0;
      this.overtimeMinutes = 0;

      return;
    }

    const elapsedMinutes = Math.max(
      0,
      Math.floor(
        (this.checkOutAt.getTime() -
          this.checkInAt.getTime()) /
          60000
      ) - (this.breakMinutes || 0)
    );

    const regularMinuteLimit = 8 * 60;

    this.totalWorkedMinutes = elapsedMinutes;

    this.regularMinutes = Math.min(
      elapsedMinutes,
      regularMinuteLimit
    );

    this.detectedOvertimeMinutes = Math.max(
      0,
      elapsedMinutes - regularMinuteLimit
    );

    this.overtimeMinutes = this.approvedOvertimeMinutes || 0;
    this.isOvertime = this.detectedOvertimeMinutes > 0;
  };

attendanceSchema.pre(
  'save',
  function calculateAttendanceTotals() {
    this.calculateWorkedMinutes();
  }
);

const Attendance =
  mongoose.models.Attendance ||
  mongoose.model(
    'Attendance',
    attendanceSchema
  );

module.exports = {
  Attendance,
  ATTENDANCE_STATUSES,
  ATTENDANCE_SOURCES,
};