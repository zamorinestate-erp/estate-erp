'use strict';

const mongoose = require('mongoose');

const USER_ROLES = ['MASTER', 'OWNER', 'CAFE_ADMIN', 'STAFF'];

const ACCOUNT_STATUSES = [
  'PENDING_ACTIVATION',
  'ACTIVE',
  'LOCKED',
  'SUSPENDED',
  'DISABLED',
  'ARCHIVED',
];

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

    recoveryCodeHashes: {
      type: [String],
      select: false,
      default: [],
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

  return user;
};

const User =
  mongoose.models.User || mongoose.model('User', userSchema);

module.exports = {
  User,
  USER_ROLES,
  ACCOUNT_STATUSES,
};