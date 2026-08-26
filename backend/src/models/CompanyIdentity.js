'use strict';

const mongoose = require('mongoose');

const gstinItemSchema = new mongoose.Schema(
  {
    state: { type: String, required: true, trim: true },
    stateCode: { type: String, required: true, trim: true, match: /^\d{2}$/ },
    number: { type: String, required: true, trim: true, uppercase: true },
    isPrimary: { type: Boolean, default: false },
  },
  { _id: false }
);

const licenceItemSchema = new mongoose.Schema(
  {
    type: { type: String, required: true, trim: true },
    number: { type: String, required: true, trim: true },
    validFrom: { type: Date, default: null },
    validTill: { type: Date, default: null },
  },
  { _id: false }
);

const companyIdentitySchema = new mongoose.Schema(
  {
    organisationId: {
      type: String,
      required: true,
      trim: true,
      index: true,
      default: 'ORG-ZAMORIN-01',
    },

    legalName: {
      type: String,
      required: true,
      trim: true,
      default: 'Zamorin Speciality Coffee & Kitchens Pvt. Ltd.',
    },

    brandName: {
      type: String,
      required: true,
      trim: true,
      default: 'Zamorin Café',
    },

    tagline: {
      type: String,
      trim: true,
      default: 'Speciality Coffee & Estate Kitchens',
    },

    logo: {
      primarySvg: { type: String, default: '' },
      monochromeSvg: { type: String, default: '' },
      primaryPngUrl: { type: String, default: '/assets/zamorin-estate-logo.png' },
      monochromePngUrl: { type: String, default: '/assets/zamorin-estate-mark.png' },
      ingestedAt: { type: Date, default: Date.now },
    },

    pan: {
      type: String,
      trim: true,
      uppercase: true,
      default: 'AABCT1332L',
    },

    cin: {
      type: String,
      trim: true,
      uppercase: true,
      default: 'U55101KA2024PTC189201',
    },

    udyamNumber: {
      type: String,
      trim: true,
      default: 'UDYAM-KR-03-0019284',
    },

    registeredAddress: {
      line1: { type: String, trim: true, default: '12th Main Road, 5th Block' },
      line2: { type: String, trim: true, default: 'Koramangala' },
      city: { type: String, trim: true, default: 'Bengaluru' },
      state: { type: String, trim: true, default: 'Karnataka' },
      stateCode: { type: String, trim: true, default: '29' },
      pincode: { type: String, trim: true, default: '560095' },
      country: { type: String, trim: true, default: 'India' },
    },

    gstin: {
      type: [gstinItemSchema],
      default: [
        {
          state: 'Karnataka',
          stateCode: '29',
          number: '29AABCT1332L1ZV',
          isPrimary: true,
        },
        {
          state: 'Kerala',
          stateCode: '32',
          number: '32AABCZ1234M1Z8',
          isPrimary: false,
        },
      ],
    },

    licences: {
      type: [licenceItemSchema],
      default: [
        {
          type: 'FSSAI Central Head Office',
          number: '10024043000192',
          validFrom: new Date('2024-01-01'),
          validTill: new Date('2029-12-31'),
        },
      ],
    },

    contact: {
      phone: { type: String, trim: true, default: '+91 80 4123 9876' },
      supportPhone: { type: String, trim: true, default: '+91 80 4123 9800' },
      email: { type: String, trim: true, lowercase: true, default: 'corporate@zamorin.cafe' },
      supportEmail: { type: String, trim: true, lowercase: true, default: 'support@zamorin.cafe' },
      website: { type: String, trim: true, default: 'https://zamorin.cafe' },
      whatsapp: { type: String, trim: true, default: '+91 98450 12345' },
    },

    banking: {
      accountName: { type: String, trim: true, default: 'Zamorin Estate Pvt. Ltd.' },
      bankName: { type: String, trim: true, default: 'HDFC Bank Ltd.' },
      accountNumberMasked: { type: String, trim: true, default: 'XXXX-XXXX-8921' },
      ifsc: { type: String, trim: true, uppercase: true, default: 'HDFC0001742' },
    },

    authorisedSignatory: {
      name: { type: String, trim: true, default: 'Managing Director' },
      designation: { type: String, trim: true, default: 'Authorised Signatory' },
    },

    financialYearStartMonth: {
      type: Number,
      default: 4, // April
    },

    defaultCurrency: {
      type: String,
      default: 'INR',
      trim: true,
    },

    version: {
      type: Number,
      required: true,
      default: 1,
    },

    status: {
      type: String,
      enum: ['CURRENT', 'SUPERSEDED'],
      default: 'CURRENT',
      index: true,
    },

    effectiveFrom: {
      type: Date,
      default: Date.now,
    },

    createdBy: {
      type: String,
      default: 'System Provisioner',
    },

    changeReason: {
      type: String,
      default: 'Initial Canonical Company Identity Provisioning',
    },

    supersedesId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'CompanyIdentity',
      default: null,
    },

    supersededById: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'CompanyIdentity',
      default: null,
    },
  },
  {
    timestamps: true,
    collection: 'company_identities',
  }
);

companyIdentitySchema.index({ organisationId: 1, status: 1 });
companyIdentitySchema.index({ organisationId: 1, version: -1 });

const CompanyIdentity = mongoose.model('CompanyIdentity', companyIdentitySchema);

module.exports = {
  CompanyIdentity,
};
