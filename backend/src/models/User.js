'use strict';

const mongoose = require('mongoose');

const {
  buildEmployeeSearchTerms,
  normalizeOptionalText,
  normalizePreviousNames,
} = require('../services/employeeReadService');

const USER_ROLES = ['MASTER', 'OWNER', 'CAFE_ADMIN', 'STAFF'];

const ACCOUNT_STATUSES = [
  'PENDING_ACTIVATION',
  'ACTIVE',
  'LOCKED',
  'SUSPENDED',
  'DISABLED',
  'ARCHIVED',
];

const addressSchema = new mongoose.Schema(
  {
    line1: {
      type: String,
      trim: true,
      maxlength: 200,
      default: '',
    },

    line2: {
      type: String,
      trim: true,
      maxlength: 200,
      default: '',
    },

    city: {
      type: String,
      trim: true,
      maxlength: 120,
      default: '',
    },

    state: {
      type: String,
      trim: true,
      maxlength: 120,
      default: '',
    },

    postalCode: {
      type: String,
      trim: true,
      maxlength: 20,
      default: '',
    },

    country: {
      type: String,
      trim: true,
      maxlength: 120,
      default: '',
    },
  },
  {
    _id: false,
  }
);

const emergencyContactSchema =
  new mongoose.Schema(
    {
      name: {
        type: String,
        trim: true,
        maxlength: 120,
        default: '',
      },

      relationship: {
        type: String,
        trim: true,
        maxlength: 80,
        default: '',
      },

      phone: {
        type: String,
        trim: true,
        maxlength: 20,
        default: '',
      },
    },
    {
      _id: false,
    }
  );

const roleHistoryEntrySchema = new mongoose.Schema(
  {
    fromRole: {
      type: String,
      enum: USER_ROLES,
      default: undefined,
    },

    toRole: {
      type: String,
      required: true,
      enum: USER_ROLES,
    },

    changedAt: {
      type: Date,
      required: true,
      default: Date.now,
    },

    changedBy: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
    },

    reason: {
      type: String,
      required: true,
      trim: true,
      maxlength: 2000,
    },

    correlationId: {
      type: String,
      trim: true,
      maxlength: 150,
      default: null,
    },

    sessionId: {
      type: String,
      trim: true,
      maxlength: 200,
      default: null,
    },
  },
  {
    _id: false,
  }
);

const cafeAssignmentHistoryEntrySchema =
  new mongoose.Schema(
    {
      previousAssignedCafeIds: {
        type: [String],
        default: [],
      },

      assignedCafeIds: {
        type: [String],
        default: [],
      },

      previousPrimaryCafeId: {
        type: String,
        trim: true,
        uppercase: true,
        default: null,
      },

      primaryCafeId: {
        type: String,
        trim: true,
        uppercase: true,
        default: null,
      },

      changedAt: {
        type: Date,
        required: true,
        default: Date.now,
      },

      changedBy: {
        type: String,
        required: true,
        trim: true,
        uppercase: true,
      },

      reason: {
        type: String,
        required: true,
        trim: true,
        maxlength: 2000,
      },

      correlationId: {
        type: String,
        trim: true,
        maxlength: 150,
        default: null,
      },

      sessionId: {
        type: String,
        trim: true,
        maxlength: 200,
        default: null,
      },
    },
    {
      _id: false,
    }
  );

const userSchema = new mongoose.Schema(
  {
    userId: {
      type: String,
      required: true,
      unique: true,
      immutable: true,
      trim: true,
      uppercase: true,
      match: /^(MU|OW|AD|ST)-\d{4,}$/,
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
      maxlength: 120,
    },

    preferredName: {
      type: String,
      trim: true,
      maxlength: 120,
      default: '',
    },

    previousNames: [
      {
        type: String,
        trim: true,
        maxlength: 120,
      },
    ],

    employeeSearchTerms: {
      type: [
        {
          type: String,
          maxlength: 120,
        },
      ],
      select: false,
      default: [],
    },

    joiningDate: {
      type: Date,
      default: null,
    },

    employmentType: {
      type: String,
      trim: true,
      maxlength: 80,
      default: '',
    },

    department: {
      type: String,
      trim: true,
      maxlength: 120,
      default: '',
    },

    designation: {
      type: String,
      trim: true,
      maxlength: 120,
      default: '',
    },

    address: {
      type: addressSchema,
      default: null,
    },

    emergencyContact: {
      type: emergencyContactSchema,
      default: null,
    },

    email: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
      maxlength: 254,
    },

    phone: {
      type: String,
      trim: true,
      maxlength: 20,
      default: '',
    },

    role: {
      type: String,
      required: true,
      enum: USER_ROLES,
      index: true,
    },

    accountStatus: {
      type: String,
      required: true,
      enum: ACCOUNT_STATUSES,
      default: 'PENDING_ACTIVATION',
      index: true,
    },

    primaryCafeId: {
      type: String,
      trim: true,
      uppercase: true,
      default: null,
    },

    assignedCafeIds: [
      {
        type: String,
        trim: true,
        uppercase: true,
      },
    ],

    workerType: {
      type: String,
      enum: ['PERMANENT', 'FIXED_TERM', 'TRAINEE', 'INTERN', 'CONTINGENT'],
      default: 'PERMANENT',
    },

    employmentStatus: {
      type: String,
      enum: ['PREBOARDING', 'PROBATION', 'ACTIVE', 'NOTICE_PERIOD', 'EXITED', 'ARCHIVED'],
      default: 'ACTIVE',
      index: true,
    },

    fte: {
      type: Number,
      default: 1.0,
    },

    standardWeeklyHours: {
      type: Number,
      default: 48,
    },

    positionId: {
      type: String,
      trim: true,
      uppercase: true,
      default: null,
    },

    managerUserId: {
      type: String,
      trim: true,
      uppercase: true,
      default: null,
    },

    probationStatus: {
      type: String,
      enum: ['PENDING', 'CONFIRMED', 'EXTENDED', 'NOT_APPLICABLE'],
      default: 'CONFIRMED',
    },

    probationEndDate: {
      type: String,
      default: null,
    },

    offboardingDetails: {
      noticeDate: { type: String, default: null },
      lastWorkingDay: { type: String, default: null },
      exitType: { type: String, default: null },
      reasonCategory: { type: String, default: null },
      handoverComplete: { type: Boolean, default: false },
      assetsReturned: { type: Boolean, default: false },
      accessRevoked: { type: Boolean, default: false },
      payrollNotified: { type: Boolean, default: false },
    },

    statutoryStatus: {
      epfUanStatus: { type: String, default: 'VERIFIED' },
      esiStatus: { type: String, default: 'REGISTERED' },
    },

    recordHold: {
      type: Boolean,
      default: false,
    },

    isPrimaryMaster: {
      type: Boolean,
      required: true,
      default: false,
      immutable: true,
      index: true,
    },

    primaryMasterDesignatedAt: {
      type: Date,
      immutable: true,
      default: null,
      required() {
        return this.isPrimaryMaster;
      },
    },

    primaryMasterDesignatedBy: {
      type: String,
      trim: true,
      uppercase: true,
      immutable: true,
      default: null,
      required() {
        return this.isPrimaryMaster;
      },
    },

    primaryMasterDesignationReason: {
      type: String,
      trim: true,
      maxlength: 2000,
      immutable: true,
      default: null,
      required() {
        return this.isPrimaryMaster;
      },
    },

    primaryMasterProtectionSuspension: {
      type: Boolean,
      default: false,
    },

    statusReason: {
      type: String,
      trim: true,
      maxlength: 1000,
      default: null,
    },

    passwordHash: {
      type: String,
      required: true,
      select: false,
    },

    mustChangePassword: {
      type: Boolean,
      default: true,
    },

    passwordChangedAt: {
      type: Date,
      default: null,
    },

    passwordExpiresAt: {
      type: Date,
      default: null,
    },

    passwordHistoryHashes: {
      type: [String],
      select: false,
      default: [],
    },

    mfaEnabled: {
      type: Boolean,
      default: false,
    },

    mfaMethod: {
      type: String,
      enum: ['NONE', 'TOTP', 'PASSKEY'],
      default: 'NONE',
    },

    mfaSecretEncrypted: {
      type: String,
      select: false,
      default: null,
    },

    pendingMfaSecretEncrypted: {
      type: String,
      select: false,
      default: null,
    },

    recoveryCodeHashes: {
      type: [String],
      select: false,
      default: [],
    },

    lastMfaCounter: {
      type: Number,
      min: 0,
      select: false,
      default: null,
    },

    failedLoginAttempts: {
      type: Number,
      min: 0,
      default: 0,
    },

    lockedUntil: {
      type: Date,
      default: null,
    },

    operatorPinHash: {
      type: String,
      select: false,
      default: null,
    },

    operatorPinFailedAttempts: {
      type: Number,
      min: 0,
      default: 0,
    },

    operatorPinLockedUntil: {
      type: Date,
      default: null,
    },

    operatorPinSetAt: {
      type: Date,
      default: null,
    },

    cafeOperatorAccess: {
      active: {
        type: Boolean,
        default: false,
      },
      assignedCafeId: {
        type: String,
        trim: true,
        uppercase: true,
        default: null,
      },
      validFrom: {
        type: Date,
        default: null,
      },
      validUntil: {
        type: Date,
        default: null,
      },
      assignedBy: {
        type: String,
        trim: true,
        uppercase: true,
        default: null,
      },
      assignmentReason: {
        type: String,
        trim: true,
        maxlength: 1000,
        default: null,
      },
    },

    lastLoginAt: {
      type: Date,
      default: null,
    },

    lastPasswordResetAt: {
      type: Date,
      default: null,
    },

    sessionVersion: {
      type: Number,
      min: 0,
      default: 0,
    },

    permissionsVersion: {
      type: Number,
      min: 0,
      default: 0,
    },

    roleHistory: {
      type: [roleHistoryEntrySchema],
      default: [],
    },

    cafeAssignmentHistory: {
      type: [cafeAssignmentHistoryEntrySchema],
      default: [],
    },

    preferredLanguage: {
      type: String,
      trim: true,
      default: 'en',
    },

    timezone: {
      type: String,
      immutable: true,
      default: 'Asia/Kolkata',
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
      maxlength: 500,
      default: null,
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

    // ── Custom Fields (Capability 26) ─────────────────────────────────────────
    // Arbitrary org-defined key→value metadata. Keys are set by CustomField
    // definitions (see CustomFieldDefinition model). Values are Mixed so they
    // can hold strings, numbers, booleans or ISO-date strings.
    // MASTER-only write; all roles may read (scope-filtered by the controller).
    // Keys are sanitised: alphanumeric + underscore, max 64 chars.
    // Total map size is capped at 50 keys in the controller before save.
    customFields: {
      type: Map,
      of: mongoose.Schema.Types.Mixed,
      default: () => new Map(),
    },
  },
  {
    timestamps: true,
    optimisticConcurrency: true,
    versionKey: 'version',
    collection: 'users',
  }
);

userSchema.index(
  { organisationId: 1, email: 1 },
  { unique: true, name: 'organisation_email_unique' }
);

userSchema.index(
  { organisationId: 1, userId: 1 },
  { unique: true, name: 'organisation_user_id_unique' }
);

userSchema.index(
  { organisationId: 1, role: 1, accountStatus: 1 },
  { name: 'organisation_role_status' }
);

userSchema.index(
  { organisationId: 1, assignedCafeIds: 1, accountStatus: 1 },
  { name: 'organisation_cafe_status' }
);

userSchema.index(
  {
    organisationId: 1,
    employeeSearchTerms: 1,
    accountStatus: 1,
  },
  {
    name:
      'organisation_employee_search_status',
  }
);

userSchema.index(
  {
    organisationId: 1,
    isPrimaryMaster: 1,
  },
  {
    unique: true,
    name: 'organisation_primary_master_unique',
    partialFilterExpression: {
      isPrimaryMaster: true,
    },
  }
);

userSchema.pre('validate', function normalizeUserFields() {
  if (this.email) {
    this.email = this.email.trim().toLowerCase();
  }

  if (this.userId) {
    this.userId = this.userId.trim().toUpperCase();
  }

  if (this.organisationId) {
    this.organisationId = this.organisationId.trim().toUpperCase();
  }

  this.name =
    normalizeOptionalText(this.name);

  this.preferredName =
    normalizeOptionalText(
      this.preferredName
    );

  this.previousNames =
    normalizePreviousNames(
      this.previousNames
    );

  this.employmentType =
    normalizeOptionalText(
      this.employmentType
    );

  this.department =
    normalizeOptionalText(
      this.department
    );

  this.designation =
    normalizeOptionalText(
      this.designation
    );

  if (this.address) {
    for (const field of [
      'line1',
      'line2',
      'city',
      'state',
      'postalCode',
      'country',
    ]) {
      this.address[field] =
        normalizeOptionalText(
          this.address[field]
        );
    }
  }

  if (this.emergencyContact) {
    for (const field of [
      'name',
      'relationship',
      'phone',
    ]) {
      this.emergencyContact[field] =
        normalizeOptionalText(
          this.emergencyContact[field]
        );
    }
  }

  this.employeeSearchTerms =
    buildEmployeeSearchTerms({
      name: this.name,
      preferredName:
        this.preferredName,
      previousNames:
        this.previousNames,
    });

  if (this.primaryCafeId) {
    this.primaryCafeId = this.primaryCafeId.trim().toUpperCase();
  }

  if (Array.isArray(this.assignedCafeIds)) {
    this.assignedCafeIds = [
      ...new Set(
        this.assignedCafeIds
          .filter(Boolean)
          .map((cafeId) => cafeId.trim().toUpperCase())
      ),
    ];
  }

  if (this.primaryMasterDesignatedBy) {
    this.primaryMasterDesignatedBy =
      this.primaryMasterDesignatedBy
        .trim()
        .toUpperCase();
  }

  if (Array.isArray(this.roleHistory)) {
    this.roleHistory.forEach((entry) => {
      if (entry.changedBy) {
        entry.changedBy =
          entry.changedBy
            .trim()
            .toUpperCase();
      }
    });
  }

  if (
    Array.isArray(
      this.cafeAssignmentHistory
    )
  ) {
    this.cafeAssignmentHistory.forEach(
      (entry) => {
        entry.previousAssignedCafeIds = [
          ...new Set(
            (
              entry.previousAssignedCafeIds ||
              []
            )
              .filter(Boolean)
              .map((cafeId) =>
                cafeId
                  .trim()
                  .toUpperCase()
              )
          ),
        ];

        entry.assignedCafeIds = [
          ...new Set(
            (entry.assignedCafeIds || [])
              .filter(Boolean)
              .map((cafeId) =>
                cafeId
                  .trim()
                  .toUpperCase()
              )
          ),
        ];

        if (entry.changedBy) {
          entry.changedBy =
            entry.changedBy
              .trim()
              .toUpperCase();
        }
      }
    );
  }

  if (this.isPrimaryMaster) {
    if (this.role !== 'MASTER') {
      this.invalidate(
        'role',
        'The Primary Master must retain the MASTER role.'
      );
    }

    if (this.accountStatus !== 'ACTIVE') {
      this.invalidate(
        'accountStatus',
        'The Primary Master account must remain active.'
      );
    }

    if (this.primaryCafeId) {
      this.invalidate(
        'primaryCafeId',
        'The Primary Master cannot be restricted to a primary café.'
      );
    }

    if (
      Array.isArray(this.assignedCafeIds) &&
      this.assignedCafeIds.length > 0
    ) {
      this.invalidate(
        'assignedCafeIds',
        'The Primary Master cannot be restricted to assigned cafés.'
      );
    }
  } else if (
    this.primaryMasterDesignatedAt ||
    this.primaryMasterDesignatedBy ||
    this.primaryMasterDesignationReason
  ) {
    this.invalidate(
      'isPrimaryMaster',
      'Primary Master designation metadata requires isPrimaryMaster to be true.'
    );
  }
});

userSchema.methods.canAccessCafe = function canAccessCafe(cafeId) {
  if (!cafeId) {
    return false;
  }

  if (this.role === 'MASTER') {
    return true;
  }

  const normalizedCafeId = cafeId.trim().toUpperCase();

  return this.assignedCafeIds.includes(normalizedCafeId);
};

userSchema.methods.incrementSessionVersion =
  function incrementSessionVersion() {
    this.sessionVersion += 1;
    return this.save();
  };

userSchema.methods.toJSON = function safeUserJSON() {
  const user = this.toObject();

  delete user.passwordHash;
  delete user.passwordHistoryHashes;
  delete user.mfaSecretEncrypted;
  delete user.pendingMfaSecretEncrypted;
  delete user.recoveryCodeHashes;
  delete user.employeeSearchTerms;

  return user;
};

userSchema.index({ organisationId: 1, primaryCafeId: 1, status: 1 });
userSchema.index({ organisationId: 1, role: 1, status: 1 });
userSchema.index({ organisationId: 1, employeeId: 1 });
userSchema.index({ organisationId: 1, status: 1, name: 1 });

const User =
  mongoose.models.User || mongoose.model('User', userSchema);

module.exports = {
  User,
  USER_ROLES,
  ACCOUNT_STATUSES,
};