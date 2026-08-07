'use strict';

/**
 * VENDOR CONTROLLER
 *
 * Implements:
 *   - Vendor master catalogue management (MASTER)
 *   - Vendor lookup and search (MASTER, OWNER, CAFE_ADMIN)
 *   - Vendor status lifecycle (MASTER only)
 */

const {
  Vendor,
  VENDOR_STATUSES,
  VENDOR_CATEGORIES,
} = require('../models/Vendor');

const {
  SequenceCounter,
} = require('../models/SequenceCounter');

const {
  asyncHandler,
} = require('../utils/asyncHandler');

const {
  ApiError,
} = require('../utils/ApiError');

const {
  recordRequestAudit,
} = require('../services/auditService');

// ── Helpers ──────────────────────────────────────────────────────────────────

function normalizeId(value) {
  return typeof value === 'string'
    ? value.trim().toUpperCase()
    : '';
}

function parsePositiveInteger(value, fallback, maximum) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed < 1) return fallback;
  return Math.min(parsed, maximum);
}

// ── Handlers ─────────────────────────────────────────────────────────────────

/**
 * GET /vendors
 * List vendors with pagination, filtering, and search.
 */
const listVendors = asyncHandler(async (request, response) => {
  const page = parsePositiveInteger(request.query.page, 1, 1000);
  const limit = parsePositiveInteger(request.query.limit, 25, 100);
  const skip = (page - 1) * limit;

  const filter = { organisationId: request.auth.organisationId };
  const { category, status, search } = request.query;

  if (status && VENDOR_STATUSES.includes(status.toUpperCase())) {
    filter.status = status.toUpperCase();
  } else if (request.auth.role !== 'MASTER') {
    // Non-Master roles by default only see ACTIVE vendors for ordering.
    filter.status = 'ACTIVE';
  }

  if (category && VENDOR_CATEGORIES.includes(category.toUpperCase())) {
    filter.category = category.toUpperCase();
  }

  if (search && typeof search === 'string' && search.trim()) {
    filter.$text = { $search: search.trim() };
  }

  const [vendors, total] = await Promise.all([
    Vendor.find(filter)
      .select('-__v -version -nameLower')
      .sort({ name: 1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    Vendor.countDocuments(filter),
  ]);

  return response.status(200).json({
    success: true,
    data: {
      vendors,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    },
    correlationId: request.correlationId || null,
  });
});

/**
 * GET /vendors/:vendorId
 * Fetch single vendor details.
 */
const getVendor = asyncHandler(async (request, response) => {
  const vendorId = normalizeId(request.params.vendorId);
  if (!vendorId) {
    throw new ApiError(400, 'INVALID_ID', 'A valid vendor ID is required.');
  }

  const vendor = await Vendor.findOne({
    vendorId,
    organisationId: request.auth.organisationId,
  }).select('-__v -version -nameLower').lean();

  if (!vendor) {
    throw new ApiError(404, 'NOT_FOUND', 'Vendor not found.');
  }

  return response.status(200).json({
    success: true,
    data: { vendor },
    correlationId: request.correlationId || null,
  });
});

/**
 * POST /vendors
 * Create vendor (MASTER ONLY).
 */
const createVendor = asyncHandler(async (request, response) => {
  const {
    name,
    tradeName,
    category,
    gstNumber,
    panNumber,
    fssaiLicense,
    contactPersons,
    phone,
    email,
    website,
    address,
    paymentTerms,
    creditLimitInr,
    bankDetails,
    reliabilityRating,
    notes,
  } = request.body;

  const nameText = typeof name === 'string' ? name.trim() : '';
  if (!nameText) {
    throw new ApiError(400, 'NAME_REQUIRED', 'Vendor name is required.');
  }

  const normCategory = normalizeId(category);
  if (!VENDOR_CATEGORIES.includes(normCategory)) {
    throw new ApiError(400, 'INVALID_CATEGORY', `Category must be one of: ${VENDOR_CATEGORIES.join(', ')}.`);
  }

  // Duplicate name check
  const duplicate = await Vendor.findOne({
    organisationId: request.auth.organisationId,
    nameLower: nameText.toLowerCase(),
  }).lean();

  if (duplicate) {
    throw new ApiError(409, 'DUPLICATE_VENDOR_NAME', `A vendor named "${nameText}" already exists.`);
  }

  // Generate ID
  const seqId = await SequenceCounter.generateId({
    organisationId: request.auth.organisationId,
    sequenceKey: 'VENDOR_MASTER',
    prefix: 'VEN',
    minimumDigits: 4,
  });

  const vendor = new Vendor({
    vendorId: seqId,
    organisationId: request.auth.organisationId,
    name: nameText,
    nameLower: nameText.toLowerCase(),
    tradeName: typeof tradeName === 'string' ? tradeName.trim() : '',
    category: normCategory,
    gstNumber: typeof gstNumber === 'string' ? gstNumber.trim().toUpperCase() : '',
    panNumber: typeof panNumber === 'string' ? panNumber.trim().toUpperCase() : '',
    fssaiLicense: typeof fssaiLicense === 'string' ? fssaiLicense.trim() : '',
    contactPersons: Array.isArray(contactPersons) ? contactPersons : [],
    phone: typeof phone === 'string' ? phone.trim() : '',
    email: typeof email === 'string' ? email.trim().toLowerCase() : '',
    website: typeof website === 'string' ? website.trim() : '',
    address: typeof address === 'object' && address ? address : {},
    paymentTerms: paymentTerms ? normalizeId(paymentTerms) : 'NET_30',
    creditLimitInr: Number(creditLimitInr) || 0,
    bankDetails: typeof bankDetails === 'object' && bankDetails ? bankDetails : {},
    reliabilityRating: Number(reliabilityRating) || null,
    notes: typeof notes === 'string' ? notes.trim() : '',
    status: 'ACTIVE',
    createdByUserId: request.auth.userId,
  });

  await vendor.save();

  await recordRequestAudit({
    request,
    module: 'VENDORS',
    action: 'CREATE_VENDOR',
    entityType: 'VENDOR',
    entityId: seqId,
    after: { vendorId: seqId, name: nameText, category: normCategory },
    result: 'SUCCESS',
    riskClassification: 'LOW',
  });

  return response.status(201).json({
    success: true,
    data: { vendor: vendor.toObject() },
    correlationId: request.correlationId || null,
  });
});

/**
 * PATCH /vendors/:vendorId
 * Update vendor (MASTER ONLY).
 */
const updateVendor = asyncHandler(async (request, response) => {
  const vendorId = normalizeId(request.params.vendorId);
  if (!vendorId) {
    throw new ApiError(400, 'INVALID_ID', 'A valid vendor ID is required.');
  }

  const vendor = await Vendor.findOne({
    vendorId,
    organisationId: request.auth.organisationId,
  });

  if (!vendor) {
    throw new ApiError(404, 'NOT_FOUND', 'Vendor not found.');
  }

  const {
    name,
    tradeName,
    category,
    gstNumber,
    panNumber,
    fssaiLicense,
    contactPersons,
    phone,
    email,
    website,
    address,
    paymentTerms,
    creditLimitInr,
    bankDetails,
    reliabilityRating,
    notes,
  } = request.body;

  if (name !== undefined) {
    const nameText = String(name).trim();
    if (!nameText) {
      throw new ApiError(400, 'NAME_REQUIRED', 'Vendor name cannot be empty.');
    }
    if (nameText.toLowerCase() !== vendor.nameLower) {
      const duplicate = await Vendor.findOne({
        organisationId: request.auth.organisationId,
        nameLower: nameText.toLowerCase(),
        vendorId: { $ne: vendorId },
      }).lean();
      if (duplicate) {
        throw new ApiError(409, 'DUPLICATE_VENDOR_NAME', `A vendor named "${nameText}" already exists.`);
      }
      vendor.name = nameText;
      vendor.nameLower = nameText.toLowerCase();
    }
  }

  if (tradeName !== undefined) vendor.tradeName = String(tradeName).trim();
  if (category !== undefined) {
    const cat = normalizeId(category);
    if (!VENDOR_CATEGORIES.includes(cat)) {
      throw new ApiError(400, 'INVALID_CATEGORY', `Category must be one of: ${VENDOR_CATEGORIES.join(', ')}.`);
    }
    vendor.category = cat;
  }
  if (gstNumber !== undefined) vendor.gstNumber = String(gstNumber).trim().toUpperCase();
  if (panNumber !== undefined) vendor.panNumber = String(panNumber).trim().toUpperCase();
  if (fssaiLicense !== undefined) vendor.fssaiLicense = String(fssaiLicense).trim();
  if (contactPersons !== undefined && Array.isArray(contactPersons)) vendor.contactPersons = contactPersons;
  if (phone !== undefined) vendor.phone = String(phone).trim();
  if (email !== undefined) vendor.email = String(email).trim().toLowerCase();
  if (website !== undefined) vendor.website = String(website).trim();
  if (address !== undefined && typeof address === 'object') vendor.address = address;
  if (paymentTerms !== undefined) vendor.paymentTerms = normalizeId(paymentTerms);
  if (creditLimitInr !== undefined) vendor.creditLimitInr = Math.max(0, Number(creditLimitInr) || 0);
  if (bankDetails !== undefined && typeof bankDetails === 'object') vendor.bankDetails = bankDetails;
  if (reliabilityRating !== undefined) vendor.reliabilityRating = Number(reliabilityRating) || null;
  if (notes !== undefined) vendor.notes = String(notes).trim();

  vendor.lastModifiedByUserId = request.auth.userId;
  await vendor.save();

  await recordRequestAudit({
    request,
    module: 'VENDORS',
    action: 'UPDATE_VENDOR',
    entityType: 'VENDOR',
    entityId: vendorId,
    after: { vendorId, name: vendor.name, category: vendor.category },
    result: 'SUCCESS',
    riskClassification: 'LOW',
  });

  return response.status(200).json({
    success: true,
    data: { vendor: vendor.toObject() },
    correlationId: request.correlationId || null,
  });
});

/**
 * POST /vendors/:vendorId/status
 * Change vendor status (ACTIVE, SUSPENDED, BLACKLISTED, ARCHIVED). MASTER ONLY. Requires reason.
 */
const changeVendorStatus = asyncHandler(async (request, response) => {
  const vendorId = normalizeId(request.params.vendorId);
  if (!vendorId) {
    throw new ApiError(400, 'INVALID_ID', 'A valid vendor ID is required.');
  }

  const { status, reason } = request.body;
  const targetStatus = normalizeId(status);
  if (!VENDOR_STATUSES.includes(targetStatus)) {
    throw new ApiError(400, 'INVALID_STATUS', `Status must be one of: ${VENDOR_STATUSES.join(', ')}.`);
  }

  const reasonText = typeof reason === 'string' ? reason.trim() : '';
  if (reasonText.length < 5) {
    throw new ApiError(400, 'REASON_REQUIRED', 'A reason of at least 5 characters is required.');
  }

  const vendor = await Vendor.findOne({
    vendorId,
    organisationId: request.auth.organisationId,
  });

  if (!vendor) {
    throw new ApiError(404, 'NOT_FOUND', 'Vendor not found.');
  }

  const beforeStatus = vendor.status;
  vendor.status = targetStatus;
  vendor.statusChangedAt = new Date();
  vendor.statusChangeReason = reasonText;
  vendor.statusChangedByUserId = request.auth.userId;
  vendor.lastModifiedByUserId = request.auth.userId;

  await vendor.save();

  await recordRequestAudit({
    request,
    module: 'VENDORS',
    action: 'CHANGE_VENDOR_STATUS',
    entityType: 'VENDOR',
    entityId: vendorId,
    before: { status: beforeStatus },
    after: { status: targetStatus, reason: reasonText },
    reason: reasonText,
    result: 'SUCCESS',
    riskClassification: targetStatus === 'BLACKLISTED' ? 'HIGH' : 'MEDIUM',
  });

  return response.status(200).json({
    success: true,
    data: { vendor: vendor.toObject() },
    correlationId: request.correlationId || null,
  });
});

module.exports = {
  listVendors,
  getVendor,
  createVendor,
  updateVendor,
  changeVendorStatus,
};
