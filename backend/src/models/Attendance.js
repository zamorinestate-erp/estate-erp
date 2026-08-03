'use strict';

const mongoose = require('mongoose');

const ATTENDANCE_STATUSES = [
  'CHECKED_IN',
  'CHECKED_OUT',
  'MISSED_PUNCH',
  'ABSENT',
  'ON_LEAVE',
  'HOLIDAY',
  'WEEKLY_OFF',
];

const ATTENDANCE_SOURCES = [
  'SELF',
  'CAFE_ADMIN',
  'MASTER',
  'SYSTEM',
];

const attendanceSchema = new mongoose.Schema(
  {
    attendanceId: {
      type: String,
      required: true,
      unique: true,
      immutable: true,
      trim: true,
      uppercase: true,
      match: /^AT-\d{8}-\d{4,}$/,
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
      immutable: true,
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

    overtimeMinutes: {
      type: Number,
      min: 0,
      default: 0,
    },

    totalWorkedMinutes: {
      type: Number,
      min: 0,
      default: 0,
    },

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

    if (
      this.checkInAt &&
      this.checkOutAt &&
      this.checkOutAt <= this.checkInAt
    ) {
      this.invalidate(
        'checkOutAt',
        'Check-out time must be after check-in time.'
      );
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
      ) - this.breakMinutes
    );

    const regularMinuteLimit = 8 * 60;

    this.totalWorkedMinutes = elapsedMinutes;

    this.regularMinutes = Math.min(
      elapsedMinutes,
      regularMinuteLimit
    );

    this.overtimeMinutes = Math.max(
      0,
      elapsedMinutes - regularMinuteLimit
    );
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