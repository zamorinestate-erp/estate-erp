'use strict';

/**
 * DEPARTMENT ORDER — MONGOOSE MODEL
 */

const mongoose = require('mongoose');

const DEPARTMENTS = ['KITCHEN', 'BAKERY', 'BARISTA', 'STORE', 'MANAGEMENT'];
const ORDER_STATUSES = ['PENDING', 'PREPARING', 'READY', 'DELIVERED', 'CANCELLED'];

const deptOrderItemSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    quantity: { type: Number, required: true, min: 0.001 },
    unit: { type: String, trim: true, lowercase: true, default: 'units' },
    notes: { type: String, trim: true, maxlength: 500, default: '' },
  },
  { _id: true }
);

const departmentOrderSchema = new mongoose.Schema(
  {
    orderId: {
      type: String,
      required: true,
      unique: true,
      immutable: true,
      trim: true,
      uppercase: true,
      match: /^DO-\d{4,}$/,
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
      immutable: true,
      trim: true,
      uppercase: true,
      index: true,
    },

    targetDepartment: {
      type: String,
      enum: DEPARTMENTS,
      required: true,
    },

    items: {
      type: [deptOrderItemSchema],
      required: true,
      validate: {
        validator: (v) => Array.isArray(v) && v.length > 0,
        message: 'Order must contain at least one item.',
      },
    },

    status: {
      type: String,
      enum: ORDER_STATUSES,
      default: 'PENDING',
      index: true,
    },

    orderDate: {
      type: String,
      required: true,
      trim: true,
      match: /^\d{4}-\d{2}-\d{2}$/,
      index: true,
    },

    requestedByUserId: {
      type: String,
      required: true,
      immutable: true,
      trim: true,
      uppercase: true,
    },

    notes: {
      type: String,
      trim: true,
      maxlength: 2000,
      default: '',
    },
  },
  {
    timestamps: true,
    versionKey: 'version',
    collection: 'department_orders',
  }
);

departmentOrderSchema.index(
  { organisationId: 1, cafeId: 1, status: 1 },
  { name: 'org_cafe_status' }
);

departmentOrderSchema.pre('validate', function normaliseDOFields() {
  const upperFields = ['orderId', 'organisationId', 'cafeId', 'requestedByUserId'];
  for (const field of upperFields) {
    if (this[field] && typeof this[field] === 'string') {
      this[field] = this[field].trim().toUpperCase();
    }
  }
  if (this.targetDepartment) this.targetDepartment = this.targetDepartment.trim().toUpperCase();
  if (this.status) this.status = this.status.trim().toUpperCase();
});

const DepartmentOrder =
  mongoose.models.DepartmentOrder ||
  mongoose.model('DepartmentOrder', departmentOrderSchema);

module.exports = {
  DepartmentOrder,
  DEPARTMENTS,
  ORDER_STATUSES,
};
