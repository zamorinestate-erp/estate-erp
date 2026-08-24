'use strict';

/**
 * AccessRequest — personal access-request workflow record.
 *
 * Allows authenticated users to request access to a Café, Module, Permission
 * Set, or Report Domain without directly granting themselves any access.
 *
 * A submitted AccessRequest creates a governed workflow record only.
 * It never directly modifies User.assignedCafeIds, User.role, or
 * RolePermission records. Approval is performed by authorised administrators
 * through the Approvals module.
 *
 * Escalation safeguards (enforced in controller):
 *   - Users cannot request a role higher than their current canonical role.
 *   - Users cannot request arbitrary café access beyond their scope.
 *   - Self-granting is architecturally impossible through this model.
 */

const mongoose = require('mongoose');

const ACCESS_REQUEST_TYPES = [
  'CAFE_ACCESS',         // Access to a specific Café
  'MODULE_ACCESS',       // Access to a functional module
  'PERMISSION_SET',      // Access to a named permission bundle
  'REPORT_DOMAIN',       // Access to a specific reporting domain
  'TEMPORARY_EXTENSION', // Extend an expiring temporary grant
  'ACCESS_REMOVAL',      // Request removal of access no longer needed
];

const ACCESS_REQUEST_STATUSES = [
  'DRAFT',
  'SUBMITTED',
  'UNDER_REVIEW',
  'MORE_INFORMATION_REQUIRED',
  'APPROVED',
  'CONDITIONALLY_APPROVED',
  'DENIED',
  'WITHDRAWN',
  'EXPIRED',
];

const ACCESS_DURATION_TYPES = ['PERMANENT', 'TEMPORARY'];

const accessRequestSchema = new mongoose.Schema(
  {
    requestId: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      uppercase: true,
      index: true,
      match: /^AREQ-\d{6}-\d{5}$/,
    },

    organisationId: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
      index: true,
    },

    // The user making the request (resolved from auth context, never from client body)
    requestedByUserId: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
      index: true,
    },

    requestType: {
      type: String,
      required: true,
      enum: ACCESS_REQUEST_TYPES,
      index: true,
    },

    status: {
      type: String,
      required: true,
      enum: ACCESS_REQUEST_STATUSES,
      default: 'SUBMITTED',
      index: true,
    },

    // What is being requested
    requestedScope: {
      cafeId: { type: String, trim: true, uppercase: true, default: null },
      moduleCode: { type: String, trim: true, uppercase: true, default: null },
      permissionCode: { type: String, trim: true, uppercase: true, default: null },
      reportDomain: { type: String, trim: true, uppercase: true, default: null },
      description: { type: String, trim: true, maxlength: 500, default: '' },
    },

    // Duration
    durationType: {
      type: String,
      enum: ACCESS_DURATION_TYPES,
      default: 'PERMANENT',
    },

    temporaryAccessStartAt: { type: Date, default: null },
    temporaryAccessEndAt: { type: Date, default: null },

    // Justification
    reason: {
      type: String,
      required: true,
      trim: true,
      maxlength: 1000,
    },

    businessJustification: {
      type: String,
      trim: true,
      maxlength: 2000,
      default: '',
    },

    // Reviewer (populated when status changes)
    reviewedByUserId: { type: String, trim: true, uppercase: true, default: null },
    reviewedAt: { type: Date, default: null },
    reviewNote: { type: String, trim: true, maxlength: 1000, default: '' },

    // Idempotency key — prevents duplicate submissions from double-click
    idempotencyKey: {
      type: String,
      trim: true,
      index: true,
      default: null,
      sparse: true,
    },

    // Audit trail
    auditHistory: [
      {
        action: { type: String, required: true },
        performedByUserId: { type: String, required: true },
        note: { type: String, default: '' },
        timestamp: { type: Date, default: Date.now },
        _id: false,
      },
    ],
  },
  {
    timestamps: true,
    collection: 'access_requests',
  }
);

accessRequestSchema.index({ requestedByUserId: 1, status: 1 });
accessRequestSchema.index({ organisationId: 1, status: 1 });

const AccessRequest = mongoose.model('AccessRequest', accessRequestSchema);

module.exports = { AccessRequest, ACCESS_REQUEST_TYPES, ACCESS_REQUEST_STATUSES };
