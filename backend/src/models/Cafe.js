'use strict';

const mongoose = require('mongoose');

const CAFE_STATUSES = [
  'DRAFT',
  'PENDING_OPENING',
  'ACTIVE',
  'TEMPORARILY_CLOSED',
  'UNDER_REVIEW',
  'CLOSING',
  'CLOSED',
  'ARCHIVED',
];

const CAFE_TYPES = [
  'STANDARD_CAFE',
  'KIOSK',
  'FOOD_COURT',
  'CAMPUS_CAFE',
  'INSTITUTIONAL_CAFE',
  'OTHER',
];

const PAYMENT_METHODS = [
  'CASH',
  'CARD',
  'UPI',
  'BANK_TRANSFER',
  'WALLET',
  'CREDIT',
];

const SERVICE_TYPES = [
  'DINE_IN',
  'TAKEAWAY',
  'DELIVERY',
  'PICKUP',
  'COUNTER_SALE',
  'DEPARTMENT_ORDER',
];

const dayScheduleSchema = new mongoose.Schema(
  {
    isOpen: {
      type: Boolean,
      default: true,
    },

    openingTime: {
      type: String,
      trim: true,
      match: /^([01]\d|2[0-3]):([0-5]\d)$/,
      default: '09:00',
    },

    closingTime: {
      type: String,
      trim: true,
      match: /^([01]\d|2[0-3]):([0-5]\d)$/,
      default: '21:00',
    },
  },
  {
    _id: false,
  }
);

const holidaySchema = new mongoose.Schema(
  {
    date: {
      type: Date,
      required: true,
    },

    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120,
    },

    isClosed: {
      type: Boolean,
      default: true,
    },

    openingTime: {
      type: String,
      trim: true,
      match: /^([01]\d|2[0-3]):([0-5]\d)$/,
      default: null,
    },

    closingTime: {
      type: String,
      trim: true,
      match: /^([01]\d|2[0-3]):([0-5]\d)$/,
      default: null,
    },
  },
  {
    _id: true,
  }
);

const cafeAdminAssignmentSchema = new mongoose.Schema(
  {
    userId: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
    },

    assignmentType: {
      type: String,
      required: true,
      enum: ['PRIMARY', 'SECONDARY', 'TEMPORARY'],
    },

    effectiveFrom: {
      type: Date,
      required: true,
    },

    effectiveTo: {
      type: Date,
      default: null,
    },

    isActive: {
      type: Boolean,
      default: true,
    },

    assignedBy: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
    },

    assignmentReason: {
      type: String,
      trim: true,
      maxlength: 500,
      default: '',
    },
  },
  {
    _id: true,
    timestamps: true,
  }
);

const cafeSchema = new mongoose.Schema(
  {
    cafeId: {
      type: String,
      required: true,
      unique: true,
      immutable: true,
      trim: true,
      uppercase: true,
      match: /^ZC-\d{4,}$/,
    },

    organisationId: {
      type: String,
      required: true,
      immutable: true,
      trim: true,
      uppercase: true,
      index: true,
    },

    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 150,
    },

    displayName: {
      type: String,
      required: true,
      trim: true,
      maxlength: 150,
    },

    legalName: {
      type: String,
      trim: true,
      maxlength: 200,
      default: '',
    },

    cafeType: {
      type: String,
      required: true,
      enum: CAFE_TYPES,
      default: 'STANDARD_CAFE',
    },

    groupName: {
      type: String,
      trim: true,
      maxlength: 120,
      default: '',
    },

    status: {
      type: String,
      required: true,
      enum: CAFE_STATUSES,
      default: 'DRAFT',
      index: true,
    },

    openingDate: {
      type: Date,
      default: null,
    },

    businessDateCutoffTime: {
      type: String,
      trim: true,
      match: /^([01]\d|2[0-3]):([0-5]\d)$/,
      default: '23:59',
    },

    timezone: {
      type: String,
      immutable: true,
      default: 'Asia/Kolkata',
    },

    currency: {
      type: String,
      immutable: true,
      enum: ['INR'],
      default: 'INR',
    },

    address: {
      building: {
        type: String,
        trim: true,
        maxlength: 120,
        default: '',
      },

      unit: {
        type: String,
        trim: true,
        maxlength: 60,
        default: '',
      },

      floor: {
        type: String,
        trim: true,
        maxlength: 60,
        default: '',
      },

      street: {
        type: String,
        trim: true,
        maxlength: 200,
        default: '',
      },

      area: {
        type: String,
        trim: true,
        maxlength: 120,
        default: '',
      },

      city: {
        type: String,
        trim: true,
        maxlength: 100,
        default: '',
      },

      district: {
        type: String,
        trim: true,
        maxlength: 100,
        default: '',
      },

      state: {
        type: String,
        trim: true,
        maxlength: 100,
        default: 'Karnataka',
      },

      pinCode: {
        type: String,
        trim: true,
        match: /^[1-9][0-9]{5}$/,
        default: '',
      },

      landmark: {
        type: String,
        trim: true,
        maxlength: 200,
        default: '',
      },

      latitude: {
        type: Number,
        min: -90,
        max: 90,
        default: null,
      },

      longitude: {
        type: Number,
        min: -180,
        max: 180,
        default: null,
      },

      geofenceRadiusMetres: {
        type: Number,
        min: 0,
        max: 10000,
        default: 100,
      },
    },

    contacts: {
      primaryPhone: {
        type: String,
        trim: true,
        maxlength: 20,
        default: '',
      },

      alternatePhone: {
        type: String,
        trim: true,
        maxlength: 20,
        default: '',
      },

      email: {
        type: String,
        trim: true,
        lowercase: true,
        maxlength: 254,
        default: '',
      },
    },

    registrations: {
      gstin: {
        type: String,
        trim: true,
        uppercase: true,
        maxlength: 15,
        default: '',
      },

      pan: {
        type: String,
        trim: true,
        uppercase: true,
        maxlength: 10,
        default: '',
      },

      municipalId: {
        type: String,
        trim: true,
        uppercase: true,
        maxlength: 100,
        default: '',
      },

      fssai: {
        number: { type: String, trim: true, default: '' },
        licenseType: { type: String, trim: true, default: 'State Licence' },
        validFrom: { type: Date, default: null },
        validTill: { type: Date, default: null },
      },

      licenceNumbers: [
        {
          type: String,
          trim: true,
          uppercase: true,
        },
      ],
    },

    businessHours: {
      monday: {
        type: dayScheduleSchema,
        default: () => ({}),
      },

      tuesday: {
        type: dayScheduleSchema,
        default: () => ({}),
      },

      wednesday: {
        type: dayScheduleSchema,
        default: () => ({}),
      },

      thursday: {
        type: dayScheduleSchema,
        default: () => ({}),
      },

      friday: {
        type: dayScheduleSchema,
        default: () => ({}),
      },

      saturday: {
        type: dayScheduleSchema,
        default: () => ({}),
      },

      sunday: {
        type: dayScheduleSchema,
        default: () => ({}),
      },
    },

    holidays: {
      type: [holidaySchema],
      default: [],
    },

    weeklyOffDays: [
      {
        type: String,
        enum: [
          'MONDAY',
          'TUESDAY',
          'WEDNESDAY',
          'THURSDAY',
          'FRIDAY',
          'SATURDAY',
          'SUNDAY',
        ],
      },
    ],

    serviceTypes: [
      {
        type: String,
        enum: SERVICE_TYPES,
      },
    ],

    paymentMethods: [
      {
        type: String,
        enum: PAYMENT_METHODS,
      },
    ],

    operations: {
      seatingCapacity: {
        type: Number,
        min: 0,
        default: 0,
      },

      counterCount: {
        type: Number,
        min: 0,
        default: 1,
      },

      cashPointCount: {
        type: Number,
        min: 0,
        default: 1,
      },

      storageLocationCount: {
        type: Number,
        min: 0,
        default: 1,
      },
    },

    staffing: {
      minimumStaff: {
        type: Number,
        min: 0,
        default: 0,
      },

      maximumStaff: {
        type: Number,
        min: 0,
        default: 0,
      },

      plannedLabourBudget: {
        type: Number,
        min: 0,
        default: 0,
      },

      defaultShiftPattern: {
        type: String,
        trim: true,
        maxlength: 120,
        default: '',
      },
    },

    finance: {
      costCentreCode: {
        type: String,
        trim: true,
        uppercase: true,
        maxlength: 50,
        default: '',
      },

      profitCentreCode: {
        type: String,
        trim: true,
        uppercase: true,
        maxlength: 50,
        default: '',
      },

      monthlyBudget: {
        type: Number,
        min: 0,
        default: 0,
      },

      monthlySalesTarget: {
        type: Number,
        min: 0,
        default: 0,
      },

      monthlyLabourBudget: {
        type: Number,
        min: 0,
        default: 0,
      },

      monthlyRent: {
        type: Number,
        min: 0,
        default: 0,
      },

      openingCashRequired: {
        type: Boolean,
        default: true,
      },

      defaultOpeningCash: {
        type: Number,
        min: 0,
        default: 0,
      },
    },

    inventorySetup: {
      enabled: {
        type: Boolean,
        default: true,
      },

      globalMasterDataPublished: {
        type: Boolean,
        default: false,
      },

      openingStockCompleted: {
        type: Boolean,
        default: false,
      },
    },

    branding: {
      logoUrl: {
        type: String,
        trim: true,
        default: '',
      },

      receiptFooter: {
        type: String,
        trim: true,
        maxlength: 500,
        default: '',
      },

      reportFooter: {
        type: String,
        trim: true,
        maxlength: 500,
        default: '',
      },
    },

    cafeAdminAssignments: {
      type: [cafeAdminAssignmentSchema],
      default: [],
    },

    operationsPinHash: {
      type: String,
      select: false,
      default: null,
    },

    operationsPinSetAt: {
      type: Date,
      default: null,
    },

    operationsPinFailedAttempts: {
      type: Number,
      min: 0,
      default: 0,
    },

    operationsPinLockedUntil: {
      type: Date,
      default: null,
    },

    approvalThresholds: {
      expenseSubmissionWarningAmount: {
        type: Number,
        min: 0,
        default: 0,
      },

      cashVarianceWarningAmount: {
        type: Number,
        min: 0,
        default: 0,
      },

      departmentOrderCreditLimit: {
        type: Number,
        min: 0,
        default: 0,
      },

      stockAdjustmentWarningAmount: {
        type: Number,
        min: 0,
        default: 0,
      },
    },

    notificationRecipients: [
      {
        type: String,
        trim: true,
        uppercase: true,
      },
    ],

    closure: {
      closedAt: {
        type: Date,
        default: null,
      },

      closedBy: {
        type: String,
        trim: true,
        uppercase: true,
        default: null,
      },

      closureReason: {
        type: String,
        trim: true,
        maxlength: 1000,
        default: '',
      },
    },

    archivedAt: {
      type: Date,
      default: null,
    },

    archivedBy: {
      type: String,
      trim: true,
      uppercase: true,
      default: null,
    },

    archiveReason: {
      type: String,
      trim: true,
      maxlength: 1000,
      default: '',
    },

    createdBy: {
      type: String,
      required: true,
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
    collection: 'cafes',
  }
);

cafeSchema.index(
  {
    organisationId: 1,
    status: 1,
    name: 1,
  },
  {
    name: 'organisation_status_name',
  }
);

cafeSchema.index(
  {
    organisationId: 1,
    'address.city': 1,
    status: 1,
  },
  {
    name: 'organisation_city_status',
  }
);

cafeSchema.index(
  {
    organisationId: 1,
    'cafeAdminAssignments.userId': 1,
    status: 1,
  },
  {
    name: 'organisation_admin_status',
  }
);

cafeSchema.pre('validate', function normalizeCafeFields() {
  if (this.cafeId) {
    this.cafeId = this.cafeId.trim().toUpperCase();
  }

  if (this.organisationId) {
    this.organisationId =
      this.organisationId.trim().toUpperCase();
  }

  if (this.contacts?.email) {
    this.contacts.email =
      this.contacts.email.trim().toLowerCase();
  }

  if (this.registrations?.gstin) {
    this.registrations.gstin =
      this.registrations.gstin.trim().toUpperCase();
  }

  if (this.registrations?.pan) {
    this.registrations.pan =
      this.registrations.pan.trim().toUpperCase();
  }

  if (Array.isArray(this.serviceTypes)) {
    this.serviceTypes = [...new Set(this.serviceTypes)];
  }

  if (Array.isArray(this.paymentMethods)) {
    this.paymentMethods = [...new Set(this.paymentMethods)];
  }

  if (
    this.staffing.maximumStaff > 0 &&
    this.staffing.minimumStaff >
      this.staffing.maximumStaff
  ) {
    this.invalidate(
      'staffing.minimumStaff',
      'Minimum staff cannot exceed maximum staff.'
    );
  }
});

cafeSchema.methods.isOperational =
  function isOperational() {
    return this.status === 'ACTIVE';
  };

cafeSchema.methods.hasActiveAdmin =
  function hasActiveAdmin(userId) {
    const normalizedUserId =
      userId?.trim().toUpperCase();

    if (!normalizedUserId) {
      return false;
    }

    const now = new Date();

    return this.cafeAdminAssignments.some(
      (assignment) =>
        assignment.userId === normalizedUserId &&
        assignment.isActive &&
        assignment.effectiveFrom <= now &&
        (!assignment.effectiveTo ||
          assignment.effectiveTo >= now)
    );
  };

cafeSchema.methods.archive = function archive({
  userId,
  reason,
}) {
  if (!userId || !reason) {
    throw new Error(
      'Archiving requires a user ID and reason.'
    );
  }

  this.status = 'ARCHIVED';
  this.archivedAt = new Date();
  this.archivedBy = userId.trim().toUpperCase();
  this.archiveReason = reason.trim();

  return this.save();
};

const Cafe =
  mongoose.models.Cafe ||
  mongoose.model('Cafe', cafeSchema);

module.exports = {
  Cafe,
  CAFE_STATUSES,
  CAFE_TYPES,
  PAYMENT_METHODS,
  SERVICE_TYPES,
};