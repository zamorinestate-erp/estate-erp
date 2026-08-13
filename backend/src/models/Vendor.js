'use strict';

/**
 * VENDOR — MONGOOSE MODEL
 *
 * Organisation-wide canonical vendor master.
 * Vendors are created and maintained by MASTER only.
 * CAFE_ADMIN may read vendors to choose a preferred vendor in their café's
 * CafeInventoryConfig, but cannot create or modify them.
 *
 * A vendor can supply to multiple cafés; the preferred-vendor relationship
 * lives on CafeInventoryConfig.preferredVendorId.
 *
 * Lifecycle: ACTIVE → SUSPENDED → BLACKLISTED / ARCHIVED
 * Archived vendors are read-only and excluded from procurement dropdowns.
 */

const mongoose = require('mongoose');

const VENDOR_STATUSES = [
  'ACTIVE',
  'SUSPENDED',
  'BLACKLISTED',
  'ARCHIVED',
];

const VENDOR_CATEGORIES = [
  'FOOD_BEVERAGE',
  'PACKAGING',
  'CLEANING_SUPPLIES',
  'EQUIPMENT',
  'STATIONERY',
  'SERVICES',
  'TECHNOLOGY',
  'OTHER',
];

const PAYMENT_TERMS = [
  'COD',           // Cash on delivery
  'NET_7',
  'NET_15',
  'NET_30',
  'NET_45',
  'NET_60',
  'ADVANCE',
  'CREDIT',
];

const bankDetailsSchema = new mongoose.Schema(
  {
    accountHolderName: { type: String, trim: true, maxlength: 200, default: '' },
    bankName: { type: String, trim: true, maxlength: 200, default: '' },
    accountNumber: { type: String, trim: true, maxlength: 50, default: '' },
    ifscCode: { type: String, trim: true, uppercase: true, maxlength: 20, default: '' },
    branchName: { type: String, trim: true, maxlength: 200, default: '' },
    upiId: { type: String, trim: true, maxlength: 100, default: '' },
  },
  { _id: false }
);

const contactPersonSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 200 },
    role: { type: String, trim: true, maxlength: 100, default: '' },
    phone: { type: String, trim: true, maxlength: 20, default: '' },
    email: { type: String, trim: true, lowercase: true, maxlength: 200, default: '' },
    isPrimary: { type: Boolean, default: false },
  },
  { _id: true }
);

const addressSchema = new mongoose.Schema(
  {
    line1: { type: String, trim: true, maxlength: 300, default: '' },
    line2: { type: String, trim: true, maxlength: 300, default: '' },
    city: { type: String, trim: true, maxlength: 100, default: '' },
    state: { type: String, trim: true, maxlength: 100, default: '' },
    pincode: { type: String, trim: true, maxlength: 20, default: '' },
    country: { type: String, trim: true, maxlength: 100, default: 'India' },
  },
  { _id: false }
);

const vendorSchema = new mongoose.Schema(
  {
    // ── Business identifier ──────────────────────────────────────────────────
    vendorId: {
      type: String,
      required: true,
      unique: true,
      immutable: true,
      trim: true,
      uppercase: true,
      match: /^VEN-\d{4,}$/,
      index: true,
    },

    // ── Scope ────────────────────────────────────────────────────────────────
    organisationId: {
      type: String,
      required: true,
      immutable: true,
      trim: true,
      uppercase: true,
      index: true,
    },

    // ── Identity ─────────────────────────────────────────────────────────────
    name: {
      type: String,
      required: true,
      trim: true,
      minlength: 1,
      maxlength: 300,
    },

    nameLower: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      index: true,
    },

    tradeName: {
      type: String,
      trim: true,
      maxlength: 300,
      default: '',
    },

    category: {
      type: String,
      required: true,
      enum: VENDOR_CATEGORIES,
    },

    // ── Tax identifiers ───────────────────────────────────────────────────────
    gstNumber: {
      type: String,
      trim: true,
      uppercase: true,
      maxlength: 20,
      default: '',
    },

    panNumber: {
      type: String,
      trim: true,
      uppercase: true,
      maxlength: 15,
      default: '',
    },

    fssaiLicense: {
      type: String,
      trim: true,
      maxlength: 30,
      default: '',
    },

    // ── Contact ───────────────────────────────────────────────────────────────
    contactPersons: {
      type: [contactPersonSchema],
      default: [],
    },

    phone: {
      type: String,
      trim: true,
      maxlength: 20,
      default: '',
    },

    email: {
      type: String,
      trim: true,
      lowercase: true,
      maxlength: 200,
      default: '',
    },

    website: {
      type: String,
      trim: true,
      maxlength: 300,
      default: '',
    },

    // ── Address ───────────────────────────────────────────────────────────────
    address: {
      type: addressSchema,
      default: () => ({}),
    },

    // ── Financial ────────────────────────────────────────────────────────────
    paymentTerms: {
      type: String,
      enum: PAYMENT_TERMS,
      default: 'NET_30',
    },

    creditLimitInr: {
      type: Number,
      min: 0,
      default: 0,
    },

    bankDetails: {
      type: bankDetailsSchema,
      default: () => ({}),
    },

    // ── Rating / performance ──────────────────────────────────────────────────
    // 1–5 scale, set manually or computed from order history.
    reliabilityRating: {
      type: Number,
      min: 1,
      max: 5,
      default: null,
    },

    // ── Status lifecycle ──────────────────────────────────────────────────────
    status: {
      type: String,
      required: true,
      enum: VENDOR_STATUSES,
      default: 'ACTIVE',
      index: true,
    },

    statusChangedAt: {
      type: Date,
      default: null,
    },

    statusChangeReason: {
      type: String,
      trim: true,
      maxlength: 2000,
      default: '',
    },

    statusChangedByUserId: {
      type: String,
      trim: true,
      uppercase: true,
      default: null,
    },

    // ── Contract & Renewal (Capability 02) ────────────────────────────────────
    contractExpiryDate: {
      type: Date,
      default: null,
      index: true,
    },

    // Days before expiry to raise a renewal alert notification.
    contractRenewalAlertDays: {
      type: Number,
      min: 0,
      max: 365,
      default: 30,
    },

    contractNotes: {
      type: String,
      trim: true,
      maxlength: 2000,
      default: '',
    },

    // ── Insurance & Claims (Capability 16) ────────────────────────────────────
    insurancePolicyNumber: {
      type: String,
      trim: true,
      maxlength: 100,
      default: '',
    },

    insuranceProvider: {
      type: String,
      trim: true,
      maxlength: 200,
      default: '',
    },

    insuranceExpiryDate: {
      type: Date,
      default: null,
      index: true,
    },

    insuranceRenewalAlertDays: {
      type: Number,
      min: 0,
      max: 365,
      default: 30,
    },

    // ── Notes ────────────────────────────────────────────────────────────────
    notes: {
      type: String,
      trim: true,
      maxlength: 3000,
      default: '',
    },

    // ── Governance ───────────────────────────────────────────────────────────
    createdByUserId: {
      type: String,
      required: true,
      immutable: true,
      trim: true,
      uppercase: true,
    },

    lastModifiedByUserId: {
      type: String,
      trim: true,
      uppercase: true,
      default: null,
    },
  },
  {
    timestamps: true,
    versionKey: 'version',
    optimisticConcurrency: true,
    collection: 'vendors',
  }
);

// ── Compound indexes ─────────────────────────────────────────────────────────

vendorSchema.index(
  { organisationId: 1, nameLower: 1 },
  { unique: true, name: 'org_name_unique' }
);

vendorSchema.index(
  { organisationId: 1, status: 1, category: 1 },
  { name: 'org_status_category' }
);

vendorSchema.index(
  { name: 'text', tradeName: 'text', gstNumber: 'text', notes: 'text' },
  { name: 'vendor_text_search' }
);

// ── Normalisation ────────────────────────────────────────────────────────────

vendorSchema.pre('validate', function normaliseVendorFields() {
  if (this.name) {
    this.nameLower = this.name.trim().toLowerCase();
  }
  if (this.category) {
    this.category = this.category.trim().toUpperCase();
  }
  if (this.status) {
    this.status = this.status.trim().toUpperCase();
  }
  if (this.paymentTerms) {
    this.paymentTerms = this.paymentTerms.trim().toUpperCase();
  }

  const upperFields = [
    'vendorId', 'organisationId', 'createdByUserId',
    'lastModifiedByUserId', 'statusChangedByUserId',
    'gstNumber', 'panNumber',
  ];
  for (const field of upperFields) {
    if (this[field] && typeof this[field] === 'string') {
      this[field] = this[field].trim().toUpperCase();
    }
  }
});

const Vendor =
  mongoose.models.Vendor ||
  mongoose.model('Vendor', vendorSchema);

module.exports = {
  Vendor,
  VENDOR_STATUSES,
  VENDOR_CATEGORIES,
  PAYMENT_TERMS,
};
