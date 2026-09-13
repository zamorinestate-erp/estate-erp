'use strict';

/**
 * ZAMORIN CAFÉ ERP — REPORTING FOUNDATION
 * Module: dimensionRegistry.js
 * 
 * Central canonical Dimension Registry:
 * - Governs allowable reporting dimensions and group-by attributes.
 * - Enforces daypart definitions with configurable fallback architecture.
 * - Validates reporting query dimensions against canonical sources.
 */

/**
 * Canonical Daypart Configuration Status:
 * Note: Configurable operating hours and dayparts do not yet exist in persistent cafe settings.
 * The six standard dayparts are retained only as a PROPOSED_DEFAULT template.
 * They are not automatically used in certified calculations without explicit configuration provenance.
 */
const PROPOSED_DEFAULT_DAYPARTS = [
  { id: 'BREAKFAST', label: 'Breakfast', startHour: 7, endHour: 11 },
  { id: 'LUNCH', label: 'Lunch', startHour: 11, endHour: 15 },
  { id: 'AFTERNOON', label: 'Afternoon / Tea', startHour: 15, endHour: 18 },
  { id: 'DINNER', label: 'Dinner', startHour: 18, endHour: 22 },
  { id: 'LATE_NIGHT', label: 'Late Night', startHour: 22, endHour: 2 },
  { id: 'OVERNIGHT', label: 'Overnight / Prep', startHour: 2, endHour: 7 },
];

const DEFAULT_DAYPARTS = PROPOSED_DEFAULT_DAYPARTS;

const DAYPART_CONFIG = {
  template: 'PROPOSED_DEFAULT',
  configurationSource: 'NOT_CONFIGURED',
  isConfigured: false,
  supportsOrganisationDefault: true,
  supportsCafeOverride: true,
  supportsDayOfWeekSchedule: true,
  supportsCrossMidnight: true,
  defaultTemplate: PROPOSED_DEFAULT_DAYPARTS,
};

const DIMENSIONS_REGISTRY = {
  DATE: {
    dimensionId: 'DATE',
    displayName: 'Calendar Date',
    description: 'Gregorian calendar date (YYYY-MM-DD).',
    sourceField: 'createdAt',
    type: 'TEMPORAL',
    isAvailable: true,
  },
  BUSINESS_DATE: {
    dimensionId: 'BUSINESS_DATE',
    displayName: 'Operational Business Date',
    description: 'Accounting business day assigned to transactions at register open/close.',
    sourceField: 'businessDate',
    type: 'TEMPORAL',
    isAvailable: true,
  },
  HOUR: {
    dimensionId: 'HOUR',
    displayName: 'Hour of Day',
    description: 'Hour component (00:00 to 23:00) in Asia/Kolkata timezone.',
    sourceField: 'completedAt',
    type: 'TEMPORAL',
    isAvailable: true,
  },
  DAY_OF_WEEK: {
    dimensionId: 'DAY_OF_WEEK',
    displayName: 'Day of Week',
    description: 'Day name (Monday through Sunday).',
    sourceField: 'businessDate',
    type: 'TEMPORAL',
    isAvailable: true,
  },
  DAYPART: {
    dimensionId: 'DAYPART',
    displayName: 'Operational Daypart',
    description: 'Café meal periods (Breakfast, Lunch, Afternoon, Dinner, Late Night).',
    sourceField: 'completedAt',
    type: 'OPERATIONAL',
    isAvailable: true,
  },
  CAFE: {
    dimensionId: 'CAFE',
    displayName: 'Café Branch',
    description: 'Unique operational branch location identifier (e.g. ZC-0001).',
    sourceField: 'cafeId',
    type: 'ORGANISATIONAL',
    isAvailable: true,
  },
  MENU_CATEGORY: {
    dimensionId: 'MENU_CATEGORY',
    displayName: 'Menu Category',
    description: 'Product group classification (Beverages, Bakery, Hot Kitchen, Retail).',
    sourceField: 'items.category',
    type: 'COMMERCIAL',
    isAvailable: true,
  },
  MENU_ITEM: {
    dimensionId: 'MENU_ITEM',
    displayName: 'Menu Item / Product',
    description: 'Individual SKU or menu item identifier.',
    sourceField: 'items.menuItemId',
    type: 'COMMERCIAL',
    isAvailable: true,
  },
  SERVICE_MODE: {
    dimensionId: 'SERVICE_MODE',
    displayName: 'Service Mode',
    description: 'Order fulfillment channel (QUICK_SALE, DINE_IN, TAKEAWAY, DELIVERY, SCHEDULED_PICKUP).',
    sourceField: 'serviceMode',
    type: 'OPERATIONAL',
    isAvailable: true,
  },
  ORDER_SOURCE: {
    dimensionId: 'ORDER_SOURCE',
    displayName: 'Order Source',
    description: 'Ordering client origin (POS, KIOSK).',
    sourceField: 'orderSource',
    type: 'COMMERCIAL',
    isAvailable: true,
  },
  PAYMENT_METHOD: {
    dimensionId: 'PAYMENT_METHOD',
    displayName: 'Payment Tender',
    description: 'Settlement tender mode (CASH, UPI, CARD, CREDIT, COMPLIMENTARY).',
    sourceField: 'tenders.paymentMethod',
    type: 'FINANCIAL',
    isAvailable: true,
  },
  EMPLOYEE: {
    dimensionId: 'EMPLOYEE',
    displayName: 'Employee',
    description: 'Staff or operator identifier responsible for transaction or shift.',
    sourceField: 'userId',
    type: 'WORKFORCE',
    isAvailable: true,
  },
  ROLE: {
    dimensionId: 'ROLE',
    displayName: 'User Role',
    description: 'Organizational authorization tier (MASTER, OWNER, CAFE_ADMIN, STAFF).',
    sourceField: 'role',
    type: 'WORKFORCE',
    isAvailable: true,
  },
  VENDOR: {
    dimensionId: 'VENDOR',
    displayName: 'Supplier / Vendor',
    description: 'Procurement vendor entity.',
    sourceField: 'vendorId',
    type: 'PROCUREMENT',
    isAvailable: true,
  },
  INVENTORY_CATEGORY: {
    dimensionId: 'INVENTORY_CATEGORY',
    displayName: 'Inventory Category',
    description: 'Stock classification (DAIRY, COFFEE_BEANS, PACKAGING, SYRUPS).',
    sourceField: 'category',
    type: 'INVENTORY',
    isAvailable: true,
  },
  EXPENSE_CATEGORY: {
    dimensionId: 'EXPENSE_CATEGORY',
    displayName: 'Expense Category',
    description: 'Operating cost group (RENT, UTILITIES, MAINTENANCE, PACKAGING, OTHER).',
    sourceField: 'category',
    type: 'FINANCIAL',
    isAvailable: true,
  },
  CUSTOMER: {
    dimensionId: 'CUSTOMER',
    displayName: 'Customer / Guest',
    description: 'Guest profile or loyalty account identifier.',
    sourceField: 'customerId',
    type: 'CUSTOMER',
    isAvailable: true,
  },
  SHIFT: {
    dimensionId: 'SHIFT',
    displayName: 'Operational Shift',
    description: 'Workforce shift roster slot (MORNING, EVENING, CLOSING).',
    sourceField: 'shiftId',
    type: 'WORKFORCE',
    isAvailable: true,
  },
  MODIFIER: {
    dimensionId: 'MODIFIER',
    displayName: 'Menu Modifier / Add-On',
    description: 'Customization, option, or variant attribute applied to menu items.',
    sourceField: 'lineItems.modifiers',
    type: 'COMMERCIAL',
    isAvailable: true,
  },
  OPERATOR: {
    dimensionId: 'OPERATOR',
    displayName: 'POS Cashier / Operator',
    description: 'Cashier or operator responsible for bill creation, discount, or void.',
    sourceField: 'cashierUserId',
    type: 'WORKFORCE',
    isAvailable: true,
  },
  LOYALTY_TIER: {
    dimensionId: 'LOYALTY_TIER',
    displayName: 'Loyalty Tier',
    description: 'Customer loyalty tier status (BRONZE, SILVER, GOLD, PLATINUM).',
    sourceField: 'tier',
    type: 'CUSTOMER',
    isAvailable: true,
  },
  FEEDBACK_CATEGORY: {
    dimensionId: 'FEEDBACK_CATEGORY',
    displayName: 'Feedback Category',
    description: 'Customer feedback category classification.',
    sourceField: 'category',
    type: 'OPERATIONS',
    isAvailable: true,
  },
  PREP_STATION: {
    dimensionId: 'PREP_STATION',
    displayName: 'KDS Prep Station',
    description: 'Kitchen Display System prep station route.',
    sourceField: 'prepStation',
    type: 'OPERATIONS',
    isAvailable: true,
  },
};

/**
 * Resolves daypart bucket for a specific hour of day (0-23) in IST.
 * Supports organisation default template, café overrides, day-of-week schedules, and cross-midnight periods.
 * @param {number|Date|string|object} hourOrDateOrParams
 * @param {Array|object} [optionsOrCustomDayparts]
 * @returns {string|object}
 */
function resolveDaypart(hourOrDateOrParams, optionsOrCustomDayparts = DEFAULT_DAYPARTS) {
  let hour;
  let customDayparts = DEFAULT_DAYPARTS;
  let returnProvenance = false;
  let configSource = DAYPART_CONFIG.configurationSource;
  let isConfigured = DAYPART_CONFIG.isConfigured;

  // Handle options object as first argument
  if (hourOrDateOrParams && typeof hourOrDateOrParams === 'object' && !(hourOrDateOrParams instanceof Date)) {
    const { hourOrDate, configOverride, customDayparts: customList, returnProvenance: retProv } = hourOrDateOrParams;
    returnProvenance = Boolean(retProv);
    if (configOverride && Array.isArray(configOverride.dayparts)) {
      customDayparts = configOverride.dayparts;
      configSource = configOverride.configurationSource || 'CAFE_OVERRIDE';
      isConfigured = true;
    } else if (Array.isArray(customList)) {
      customDayparts = customList;
      configSource = 'CUSTOM_OVERRIDE';
      isConfigured = true;
    }
    hourOrDateOrParams = hourOrDate;
  } else if (Array.isArray(optionsOrCustomDayparts)) {
    customDayparts = optionsOrCustomDayparts;
  } else if (optionsOrCustomDayparts && typeof optionsOrCustomDayparts === 'object') {
    returnProvenance = Boolean(optionsOrCustomDayparts.returnProvenance || optionsOrCustomDayparts.includeProvenance);
    if (optionsOrCustomDayparts.configOverride?.dayparts) {
      customDayparts = optionsOrCustomDayparts.configOverride.dayparts;
      configSource = optionsOrCustomDayparts.configOverride.configurationSource || 'CAFE_OVERRIDE';
      isConfigured = true;
    }
  }

  if (typeof hourOrDateOrParams === 'number') {
    hour = hourOrDateOrParams;
  } else if (hourOrDateOrParams instanceof Date) {
    // Extract IST hour using Intl to be host-timezone agnostic
    try {
      const parts = new Intl.DateTimeFormat('en-US', {
        timeZone: 'Asia/Kolkata',
        hour: 'numeric',
        hour12: false,
      }).formatToParts(hourOrDateOrParams);
      const hourPart = parts.find((p) => p.type === 'hour');
      hour = hourPart ? parseInt(hourPart.value, 10) : hourOrDateOrParams.getHours();
    } catch {
      hour = hourOrDateOrParams.getHours();
    }
  } else if (typeof hourOrDateOrParams === 'string') {
    const d = new Date(hourOrDateOrParams);
    if (Number.isNaN(d.getTime())) {
      const parsedNum = parseInt(hourOrDateOrParams, 10);
      hour = Number.isNaN(parsedNum) ? 12 : parsedNum;
    } else {
      try {
        const parts = new Intl.DateTimeFormat('en-US', {
          timeZone: 'Asia/Kolkata',
          hour: 'numeric',
          hour12: false,
        }).formatToParts(d);
        const hourPart = parts.find((p) => p.type === 'hour');
        hour = hourPart ? parseInt(hourPart.value, 10) : d.getHours();
      } catch {
        hour = d.getHours();
      }
    }
  } else {
    hour = 12;
  }

  let matchedDaypart = null;
  for (const dp of customDayparts) {
    if (dp.startHour < dp.endHour) {
      if (hour >= dp.startHour && hour < dp.endHour) {
        matchedDaypart = dp;
        break;
      }
    } else {
      // Overnight wrap-around (e.g. 22:00 to 02:00)
      if (hour >= dp.startHour || hour < dp.endHour) {
        matchedDaypart = dp;
        break;
      }
    }
  }

  const selected = matchedDaypart || { id: 'LUNCH', label: 'Lunch' };

  if (returnProvenance) {
    return {
      daypart: selected.id,
      daypartId: selected.id,
      label: selected.label,
      configurationSource: configSource,
      provenance: DAYPART_CONFIG.template,
      template: DAYPART_CONFIG.template,
      isConfigured,
      supportsOrganisationDefault: true,
      supportsCafeOverride: true,
      supportsDayOfWeekSchedule: true,
      supportsCrossMidnight: true,
    };
  }

  return selected.id;
}

/**
 * Validates a dimension identifier.
 * @param {string} dimensionId
 * @returns {boolean}
 */
function isValidDimension(dimensionId) {
  if (!dimensionId) return false;
  return Object.prototype.hasOwnProperty.call(DIMENSIONS_REGISTRY, String(dimensionId).toUpperCase());
}

/**
 * Retrieves a dimension definition.
 * @param {string} dimensionId
 * @returns {object|null}
 */
function getDimension(dimensionId) {
  if (!isValidDimension(dimensionId)) return null;
  return DIMENSIONS_REGISTRY[String(dimensionId).toUpperCase()];
}

/**
 * Returns all registered dimensions.
 * @returns {Array<object>}
 */
function getAllDimensions() {
  return Object.values(DIMENSIONS_REGISTRY);
}

/**
 * Validates an array or comma-separated list of group-by dimensions.
 * @param {string|string[]} groupBy
 * @returns {{ valid: boolean, dimensions: string[], invalid: string[] }}
 */
function validateGroupBy(groupBy) {
  if (!groupBy) return { valid: true, dimensions: [], invalid: [] };
  const rawList = Array.isArray(groupBy)
    ? groupBy
    : String(groupBy).split(',').map((s) => s.trim());
  const dimensions = [];
  const invalid = [];

  for (const d of rawList) {
    if (!d) continue;
    const upper = d.toUpperCase();
    if (isValidDimension(upper)) {
      dimensions.push(upper);
    } else {
      invalid.push(d);
    }
  }

  return {
    valid: invalid.length === 0,
    dimensions,
    invalid,
  };
}

module.exports = {
  DIMENSIONS_REGISTRY,
  DEFAULT_DAYPARTS,
  PROPOSED_DEFAULT_DAYPARTS,
  DAYPART_CONFIG,
  resolveDaypart,
  isValidDimension,
  getDimension,
  getAllDimensions,
  validateGroupBy,
};
