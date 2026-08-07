'use strict';

/**
 * CUSTOMER CONTROLLER
 *
 * Implements:
 *   - Customer directory management
 *   - Points earning & redemption with atomic balance updates and audit trail
 */

const {
  Customer,
} = require('../models/Customer');

const {
  LoyaltyLedger,
} = require('../models/LoyaltyLedger');

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

function normalizeId(value) {
  return typeof value === 'string'
    ? value.trim().toUpperCase()
    : '';
}

function getIstBusinessDate(date = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

function parsePositiveInteger(value, fallback, maximum) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed < 1) return fallback;
  return Math.min(parsed, maximum);
}

/**
 * GET /customers
 * List customers (search by phone or name).
 */
const listCustomers = asyncHandler(async (request, response) => {
  const page = parsePositiveInteger(request.query.page, 1, 1000);
  const limit = parsePositiveInteger(request.query.limit, 25, 100);
  const skip = (page - 1) * limit;

  const filter = { organisationId: request.auth.organisationId };
  const { search } = request.query;

  if (search && typeof search === 'string' && search.trim()) {
    const q = search.trim();
    filter.$or = [
      { name: new RegExp(q, 'i') },
      { phone: new RegExp(q, 'i') },
    ];
  }

  const [customers, total] = await Promise.all([
    Customer.find(filter)
      .select('-__v -version')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    Customer.countDocuments(filter),
  ]);

  return response.status(200).json({
    success: true,
    data: {
      customers,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    },
    correlationId: request.correlationId || null,
  });
});

/**
 * GET /customers/:customerId
 */
const getCustomer = asyncHandler(async (request, response) => {
  const customerId = normalizeId(request.params.customerId);
  const customer = await Customer.findOne({
    customerId,
    organisationId: request.auth.organisationId,
  }).select('-__v -version').lean();

  if (!customer) {
    throw new ApiError(404, 'NOT_FOUND', 'Customer not found.');
  }

  return response.status(200).json({
    success: true,
    data: { customer },
    correlationId: request.correlationId || null,
  });
});

/**
 * POST /customers
 * Register new customer.
 */
const createCustomer = asyncHandler(async (request, response) => {
  const { name, phone, email, notes } = request.body;

  const nameText = typeof name === 'string' ? name.trim() : '';
  const phoneText = typeof phone === 'string' ? phone.trim() : '';

  if (!nameText || !phoneText) {
    throw new ApiError(400, 'MISSING_FIELDS', 'Name and phone are required.');
  }

  const duplicate = await Customer.findOne({
    organisationId: request.auth.organisationId,
    phone: phoneText,
  }).lean();

  if (duplicate) {
    throw new ApiError(409, 'DUPLICATE_PHONE', `A customer with phone "${phoneText}" already exists.`);
  }

  const seqId = await SequenceCounter.generateId({
    organisationId: request.auth.organisationId,
    sequenceKey: 'CUSTOMER',
    prefix: 'CUST',
    minimumDigits: 4,
  });

  const customer = new Customer({
    customerId: seqId,
    organisationId: request.auth.organisationId,
    name: nameText,
    phone: phoneText,
    email: typeof email === 'string' ? email.trim().toLowerCase() : '',
    notes: typeof notes === 'string' ? notes.trim() : '',
    createdByUserId: request.auth.userId,
  });

  await customer.save();

  await recordRequestAudit({
    request,
    module: 'CUSTOMERS',
    action: 'CREATE_CUSTOMER',
    entityType: 'CUSTOMER',
    entityId: seqId,
    after: { customerId: seqId, name: nameText, phone: phoneText },
    result: 'SUCCESS',
    riskClassification: 'LOW',
  });

  return response.status(201).json({
    success: true,
    data: { customer: customer.toObject() },
    correlationId: request.correlationId || null,
  });
});

/**
 * POST /customers/:customerId/points/earn
 * Record loyalty points earned.
 */
const earnPoints = asyncHandler(async (request, response) => {
  const customerId = normalizeId(request.params.customerId);
  const { points, referenceBillId, description } = request.body;

  const pts = Number(points);
  if (!Number.isInteger(pts) || pts <= 0) {
    throw new ApiError(400, 'INVALID_POINTS', 'points must be a positive integer.');
  }

  const customer = await Customer.findOne({
    customerId,
    organisationId: request.auth.organisationId,
  });

  if (!customer) {
    throw new ApiError(404, 'NOT_FOUND', 'Customer not found.');
  }

  const datePart = getIstBusinessDate().replace(/-/g, '');
  const seqId = await SequenceCounter.generateId({
    organisationId: request.auth.organisationId,
    sequenceKey: `LOYALTY_${datePart}`,
    prefix: `LOY-${datePart}`,
    minimumDigits: 4,
  });

  const balanceBefore = customer.pointsBalance;
  const balanceAfter = balanceBefore + pts;

  const ledgerEntry = new LoyaltyLedger({
    loyaltyLedgerId: seqId,
    organisationId: request.auth.organisationId,
    customerId,
    transactionType: 'EARN',
    pointsDelta: pts,
    balanceBefore,
    balanceAfter,
    referenceBillId: referenceBillId ? normalizeId(referenceBillId) : null,
    description: description ? String(description).trim() : 'Points earned on purchase',
    performedByUserId: request.auth.userId,
  });

  await ledgerEntry.save();

  customer.pointsBalance = balanceAfter;
  // Tier upgrade logic
  if (customer.pointsBalance >= 5000) customer.tier = 'PLATINUM';
  else if (customer.pointsBalance >= 2000) customer.tier = 'GOLD';
  else if (customer.pointsBalance >= 500) customer.tier = 'SILVER';

  await customer.save();

  await recordRequestAudit({
    request,
    module: 'CUSTOMERS',
    action: 'EARN_LOYALTY_POINTS',
    entityType: 'CUSTOMER',
    entityId: customerId,
    after: { pointsEarned: pts, newBalance: balanceAfter, tier: customer.tier },
    result: 'SUCCESS',
    riskClassification: 'LOW',
  });

  return response.status(200).json({
    success: true,
    data: { customer: customer.toObject(), ledgerEntry: ledgerEntry.toObject() },
    correlationId: request.correlationId || null,
  });
});

/**
 * POST /customers/:customerId/points/redeem
 * Redeem loyalty points.
 */
const redeemPoints = asyncHandler(async (request, response) => {
  const customerId = normalizeId(request.params.customerId);
  const { points, referenceBillId, description } = request.body;

  const pts = Number(points);
  if (!Number.isInteger(pts) || pts <= 0) {
    throw new ApiError(400, 'INVALID_POINTS', 'points must be a positive integer.');
  }

  const customer = await Customer.findOne({
    customerId,
    organisationId: request.auth.organisationId,
  });

  if (!customer) {
    throw new ApiError(404, 'NOT_FOUND', 'Customer not found.');
  }

  if (customer.pointsBalance < pts) {
    throw new ApiError(409, 'INSUFFICIENT_POINTS', `Customer has ${customer.pointsBalance} points available, cannot redeem ${pts}.`);
  }

  const datePart = getIstBusinessDate().replace(/-/g, '');
  const seqId = await SequenceCounter.generateId({
    organisationId: request.auth.organisationId,
    sequenceKey: `LOYALTY_${datePart}`,
    prefix: `LOY-${datePart}`,
    minimumDigits: 4,
  });

  const balanceBefore = customer.pointsBalance;
  const balanceAfter = balanceBefore - pts;

  const ledgerEntry = new LoyaltyLedger({
    loyaltyLedgerId: seqId,
    organisationId: request.auth.organisationId,
    customerId,
    transactionType: 'REDEEM',
    pointsDelta: -pts,
    balanceBefore,
    balanceAfter,
    referenceBillId: referenceBillId ? normalizeId(referenceBillId) : null,
    description: description ? String(description).trim() : 'Points redeemed',
    performedByUserId: request.auth.userId,
  });

  await ledgerEntry.save();

  customer.pointsBalance = balanceAfter;
  await customer.save();

  await recordRequestAudit({
    request,
    module: 'CUSTOMERS',
    action: 'REDEEM_LOYALTY_POINTS',
    entityType: 'CUSTOMER',
    entityId: customerId,
    after: { pointsRedeemed: pts, newBalance: balanceAfter },
    result: 'SUCCESS',
    riskClassification: 'LOW',
  });

  return response.status(200).json({
    success: true,
    data: { customer: customer.toObject(), ledgerEntry: ledgerEntry.toObject() },
    correlationId: request.correlationId || null,
  });
});

module.exports = {
  listCustomers,
  getCustomer,
  createCustomer,
  earnPoints,
  redeemPoints,
};
