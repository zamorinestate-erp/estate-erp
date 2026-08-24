'use strict';

/**
 * ASSET — MONGOOSE MODEL (SCREEN 003: EQUIPMENT & ASSET MANAGEMENT)
 */

const mongoose = require('mongoose');

const ASSET_CATEGORIES = [
  'BREWING_EQUIPMENT',
  'GRINDERS_MILLS',
  'REFRIGERATION',
  'WATER_TREATMENT',
  'ELECTRICAL_EQUIPMENT',
  'POS_HARDWARE',
  'HVAC',
  'SAFETY_EQUIPMENT',
  'CLEANING_EQUIPMENT',
  'STORAGE_EQUIPMENT',
  'FURNITURE_FIXTURES',
  'MEASUREMENT_CALIBRATION',
  'KITCHEN_EQUIPMENT',
  'COFFEE_MACHINE',
  'FURNITURE',
  'OTHER',
];

const ASSET_CONDITIONS = [
  'EXCELLENT',
  'GOOD',
  'FAIR',
  'POOR',
  'CRITICAL',
];

const ASSET_OPERATIONAL_STATUSES = [
  'SETUP',
  'IN_SERVICE',
  'UNDER_MAINTENANCE',
  'OUT_OF_SERVICE',
  'TEMPORARILY_UNAVAILABLE',
  'RETIRED',
  'OPERATIONAL',
  'REPAIRED',
  'DISCARDED',
];

const ASSET_CRITICALITIES = [
  'CRITICAL',
  'HIGH',
  'MEDIUM',
  'LOW',
];

const ASSET_ACQUISITION_TYPES = [
  'PURCHASED',
  'LEASED',
  'RENTED',
  'OTHER',
];

const ASSET_MAINTENANCE_STRATEGIES = [
  'PREVENTIVE_TIME_BASED',
  'PREVENTIVE_USAGE_BASED',
  'CONDITION_BASED',
  'INSPECTION_BASED',
  'REACTIVE_ONLY',
];

const CALIBRATION_STATUSES = [
  'CURRENT',
  'DUE_SOON',
  'DUE',
  'OVERDUE',
  'NOT_REQUIRED',
];

const locationHistoryEntrySchema = new mongoose.Schema(
  {
    fromCafeId: { type: String, trim: true, uppercase: true },
    toCafeId: { type: String, required: true, trim: true, uppercase: true },
    transferredAt: { type: Date, default: Date.now },
    transferredByUserId: { type: String, required: true, trim: true, uppercase: true },
    reason: { type: String, trim: true, default: '' },
    conditionAtTransfer: { type: String, enum: ASSET_CONDITIONS, default: 'GOOD' },
    notes: { type: String, trim: true, default: '' },
  },
  { _id: false }
);

const assetDocumentSchema = new mongoose.Schema(
  {
    documentType: {
      type: String,
      enum: [
        'PURCHASE_INVOICE',
        'WARRANTY_DOC',
        'USER_MANUAL',
        'SERVICE_MANUAL',
        'INSTALLATION_MANUAL',
        'SERVICE_CONTRACT',
        'CALIBRATION_CERT',
        'ASSET_PHOTO',
        'RETIREMENT_DOC',
        'OTHER',
      ],
      default: 'OTHER',
    },
    name: { type: String, required: true, trim: true },
    url: { type: String, required: true, trim: true },
    uploadedByUserId: { type: String, trim: true, uppercase: true },
    uploadedAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const assetSchema = new mongoose.Schema(
  {
    assetId: {
      type: String,
      required: true,
      unique: true,
      immutable: true,
      trim: true,
      uppercase: true,
      match: /^AST-\d{3,}$/,
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
      required: true,
      trim: true,
      uppercase: true,
      index: true,
    },

    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200,
    },

    category: {
      type: String,
      enum: ASSET_CATEGORIES,
      default: 'BREWING_EQUIPMENT',
      index: true,
    },

    manufacturer: {
      type: String,
      trim: true,
      maxlength: 100,
      default: '',
    },

    model: {
      type: String,
      trim: true,
      maxlength: 100,
      default: '',
    },

    serialNumber: {
      type: String,
      trim: true,
      maxlength: 100,
      default: '',
    },

    placementArea: {
      type: String,
      trim: true,
      maxlength: 100,
      default: 'Main Counter',
    },

    condition: {
      type: String,
      enum: ASSET_CONDITIONS,
      default: 'GOOD',
      index: true,
    },

    operationalStatus: {
      type: String,
      enum: ASSET_OPERATIONAL_STATUSES,
      default: 'IN_SERVICE',
      index: true,
    },

    status: {
      type: String,
      default: 'OPERATIONAL',
      index: true,
    },

    criticality: {
      type: String,
      enum: ASSET_CRITICALITIES,
      default: 'MEDIUM',
      index: true,
    },

    acquisitionType: {
      type: String,
      enum: ASSET_ACQUISITION_TYPES,
      default: 'PURCHASED',
    },

    purchaseDate: {
      type: String,
      trim: true,
      match: /^\d{4}-\d{2}-\d{2}$/,
      default: null,
    },

    purchaseVendorId: {
      type: String,
      trim: true,
      default: '',
    },

    invoiceReference: {
      type: String,
      trim: true,
      default: '',
    },

    installationDate: {
      type: String,
      trim: true,
      match: /^\d{4}-\d{2}-\d{2}$/,
      default: null,
    },

    commissioningDate: {
      type: String,
      trim: true,
      match: /^\d{4}-\d{2}-\d{2}$/,
      default: null,
    },

    commissioningChecklist: {
      isInstallationComplete: { type: Boolean, default: true },
      isPowerUtilitiesChecked: { type: Boolean, default: true },
      isInitialInspectionPassed: { type: Boolean, default: true },
      isTestRunPassed: { type: Boolean, default: true },
      commissionedByUserId: { type: String, trim: true, uppercase: true, default: null },
      commissionedAt: { type: Date, default: null },
    },

    acquisitionCostPaisa: {
      type: Number,
      min: 0,
      default: 0,
    },

    warrantyProvider: {
      type: String,
      trim: true,
      default: '',
    },

    warrantyStartDate: {
      type: String,
      trim: true,
      match: /^\d{4}-\d{2}-\d{2}$/,
      default: null,
    },

    warrantyExpiryDate: {
      type: String,
      trim: true,
      match: /^\d{4}-\d{2}-\d{2}$/,
      default: null,
    },

    warrantyReference: {
      type: String,
      trim: true,
      default: '',
    },

    serviceProviderId: {
      type: String,
      trim: true,
      default: '',
    },

    serviceContractId: {
      type: String,
      trim: true,
      default: '',
    },

    amcStartDate: {
      type: String,
      trim: true,
      match: /^\d{4}-\d{2}-\d{2}$/,
      default: null,
    },

    amcEndDate: {
      type: String,
      trim: true,
      match: /^\d{4}-\d{2}-\d{2}$/,
      default: null,
    },

    serviceFrequency: {
      type: String,
      trim: true,
      default: 'Quarterly',
    },

    maintenanceStrategy: {
      type: String,
      enum: ASSET_MAINTENANCE_STRATEGIES,
      default: 'PREVENTIVE_TIME_BASED',
    },

    lastServiceDate: {
      type: String,
      trim: true,
      match: /^\d{4}-\d{2}-\d{2}$/,
      default: null,
    },

    nextMaintenanceDue: {
      type: String,
      trim: true,
      match: /^\d{4}-\d{2}-\d{2}$/,
      default: null,
    },

    safetyHold: {
      isSafetyHoldActive: { type: Boolean, default: false },
      holdReason: { type: String, trim: true, default: '' },
      holdReportedByUserId: { type: String, trim: true, uppercase: true, default: null },
      holdReportedAt: { type: Date, default: null },
      relatedWorkOrderId: { type: String, trim: true, default: null },
    },

    calibrationRequired: {
      type: Boolean,
      default: false,
    },

    calibrationFrequency: {
      type: String,
      trim: true,
      default: 'Annually',
    },

    lastCalibrationDate: {
      type: String,
      trim: true,
      match: /^\d{4}-\d{2}-\d{2}$/,
      default: null,
    },

    nextCalibrationDue: {
      type: String,
      trim: true,
      match: /^\d{4}-\d{2}-\d{2}$/,
      default: null,
    },

    calibrationStatus: {
      type: String,
      enum: CALIBRATION_STATUSES,
      default: 'NOT_REQUIRED',
    },

    locationHistory: [locationHistoryEntrySchema],

    documents: [assetDocumentSchema],

    notes: {
      type: String,
      trim: true,
      maxlength: 2000,
      default: '',
    },

    replacementLineage: {
      replacesAssetId: { type: String, trim: true, uppercase: true, default: null },
      replacedByAssetId: { type: String, trim: true, uppercase: true, default: null },
      replacementProposedAt: { type: Date, default: null },
      replacementReason: { type: String, trim: true, default: null },
    },

    retirementRecord: {
      retiredAt: { type: Date, default: null },
      retiredByUserId: { type: String, trim: true, uppercase: true, default: null },
      reason: { type: String, trim: true, default: '' },
      disposalMethod: { type: String, trim: true, default: '' },
      notes: { type: String, trim: true, default: '' },
      isPrimaryAuthorized: { type: Boolean, default: false },
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
    collection: 'assets',
  }
);

assetSchema.index(
  { organisationId: 1, cafeId: 1, operationalStatus: 1 },
  { name: 'org_cafe_operational_status' }
);

assetSchema.index(
  { organisationId: 1, nextMaintenanceDue: 1 },
  { name: 'org_next_maintenance' }
);

assetSchema.pre('validate', function normaliseAssetFields() {
  const upperFields = ['assetId', 'organisationId', 'cafeId', 'createdByUserId'];
  for (const field of upperFields) {
    if (this[field] && typeof this[field] === 'string') {
      this[field] = this[field].trim().toUpperCase();
    }
  }
  if (this.category) this.category = this.category.trim().toUpperCase();
  if (this.condition) this.condition = this.condition.trim().toUpperCase();
  if (this.operationalStatus) this.operationalStatus = this.operationalStatus.trim().toUpperCase();
  if (this.status) this.status = this.status.trim().toUpperCase();
  if (this.criticality) this.criticality = this.criticality.trim().toUpperCase();
});

const Asset =
  mongoose.models.Asset ||
  mongoose.model('Asset', assetSchema);

module.exports = {
  Asset,
  ASSET_CATEGORIES,
  ASSET_CONDITIONS,
  ASSET_OPERATIONAL_STATUSES,
  ASSET_CRITICALITIES,
  ASSET_ACQUISITION_TYPES,
  ASSET_MAINTENANCE_STRATEGIES,
  CALIBRATION_STATUSES,
};
