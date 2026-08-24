'use strict';

/**
 * DASHBOARD TARGET — MONGOOSE MODEL
 *
 * Stores periodic sales and operational targets for a café.
 * Used by the Command Centre to calculate Target Achievement % KPIs
 * and the Budget Baseline series in trend charts.
 *
 * Target granularity:
 *   - DAILY   : one record per café per date
 *   - MONTHLY : one record per café per YYYY-MM period
 *
 * Currency: INR paisa (integer) — matches Bill and Expense conventions.
 */

const mongoose = require('mongoose');

const TARGET_GRANULARITIES = ['DAILY', 'MONTHLY'];

const dashboardTargetSchema = new mongoose.Schema(
  {
    targetId: {
      type: String,
      required: true,
      unique: true,
      immutable: true,
      trim: true,
      uppercase: true,
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

    granularity: {
      type: String,
      required: true,
      enum: TARGET_GRANULARITIES,
      immutable: true,
    },

    /**
     * For DAILY granularity: 'YYYY-MM-DD'
     * For MONTHLY granularity: 'YYYY-MM'
     */
    periodKey: {
      type: String,
      required: true,
      immutable: true,
      trim: true,
      index: true,
    },

    // Sales target in paisa
    salesTargetPaisa: {
      type: Number,
      required: true,
      min: 0,
      validate: {
        validator: Number.isInteger,
        message: 'salesTargetPaisa must be an integer.',
      },
    },

    // Orders target (count of completed bills)
    ordersTarget: {
      type: Number,
      min: 0,
      default: 0,
      validate: {
        validator: Number.isInteger,
        message: 'ordersTarget must be an integer.',
      },
    },

    // Average Order Value target in paisa
    aovTargetPaisa: {
      type: Number,
      min: 0,
      default: 0,
      validate: {
        validator: Number.isInteger,
        message: 'aovTargetPaisa must be an integer.',
      },
    },

    // Operating expense budget ceiling in paisa
    expenseBudgetPaisa: {
      type: Number,
      min: 0,
      default: 0,
      validate: {
        validator: Number.isInteger,
        message: 'expenseBudgetPaisa must be an integer.',
      },
    },

    setByUserId: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
    },

    notes: {
      type: String,
      trim: true,
      maxlength: 1000,
      default: '',
    },
  },
  {
    timestamps: true,
    versionKey: 'version',
    collection: 'dashboard_targets',
  }
);

// One target per café per granularity per period
dashboardTargetSchema.index(
  {
    organisationId: 1,
    cafeId: 1,
    granularity: 1,
    periodKey: 1,
  },
  {
    unique: true,
    name: 'cafe_granularity_period_unique',
  }
);

dashboardTargetSchema.pre('validate', function normaliseDashboardTargetFields() {
  const upperFields = ['targetId', 'organisationId', 'cafeId', 'setByUserId'];
  for (const field of upperFields) {
    if (this[field] && typeof this[field] === 'string') {
      this[field] = this[field].trim().toUpperCase();
    }
  }
  if (this.granularity) this.granularity = this.granularity.trim().toUpperCase();
});

const DashboardTarget =
  mongoose.models.DashboardTarget ||
  mongoose.model('DashboardTarget', dashboardTargetSchema);

module.exports = {
  DashboardTarget,
  TARGET_GRANULARITIES,
};
