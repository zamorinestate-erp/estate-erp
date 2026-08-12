'use strict';

/**
 * DEPARTMENT ORDER CONTROLLER
 */

const {
  DepartmentOrder,
  DEPARTMENTS,
  ORDER_STATUSES,
} = require('../models/DepartmentOrder');

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

function assertCafeAccess(request, cafeId) {
  if (request.auth.role === 'MASTER' || request.auth.role === 'OWNER') return;
  if (!request.auth.assignedCafeIds.includes(cafeId)) {
    throw new ApiError(
      403,
      'CAFE_ACCESS_DENIED',
      'You do not have access to this café.'
    );
  }
}

const listDepartmentOrders = asyncHandler(async (request, response) => {
  const page = parsePositiveInteger(request.query.page, 1, 1000);
  const limit = parsePositiveInteger(request.query.limit, 25, 100);
  const skip = (page - 1) * limit;

  const filter = { organisationId: request.auth.organisationId };
  const { cafeId, status, targetDepartment } = request.query;

  if (cafeId) {
    const normCafeId = normalizeId(cafeId);
    assertCafeAccess(request, normCafeId);
    filter.cafeId = normCafeId;
  } else if (!['MASTER', 'OWNER'].includes(request.auth.role)) {
    filter.cafeId = { $in: request.auth.assignedCafeIds };
  }

  if (status && ORDER_STATUSES.includes(status.toUpperCase())) filter.status = status.toUpperCase();
  if (targetDepartment && DEPARTMENTS.includes(targetDepartment.toUpperCase())) filter.targetDepartment = targetDepartment.toUpperCase();

  const [orders, total] = await Promise.all([
    DepartmentOrder.find(filter)
      .select('-__v -version')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    DepartmentOrder.countDocuments(filter),
  ]);

  return response.status(200).json({
    success: true,
    data: {
      orders,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    },
    correlationId: request.correlationId || null,
  });
});

const createDepartmentOrder = asyncHandler(async (request, response) => {
  const { cafeId: rawCafeId, targetDepartment, items, notes } = request.body;

  const cafeId = normalizeId(rawCafeId);
  if (!cafeId) throw new ApiError(400, 'CAFE_ID_REQUIRED', 'cafeId is required.');
  assertCafeAccess(request, cafeId);

  const normDept = normalizeId(targetDepartment);
  if (!DEPARTMENTS.includes(normDept)) {
    throw new ApiError(400, 'INVALID_DEPARTMENT', `targetDepartment must be one of: ${DEPARTMENTS.join(', ')}.`);
  }

  if (!Array.isArray(items) || items.length === 0) {
    throw new ApiError(400, 'ITEMS_REQUIRED', 'Order items are required.');
  }

  const seqId = await SequenceCounter.generateId({
    organisationId: request.auth.organisationId,
    sequenceKey: 'DEPARTMENT_ORDER',
    prefix: 'DO',
    minimumDigits: 4,
  });

  const order = new DepartmentOrder({
    orderId: seqId,
    organisationId: request.auth.organisationId,
    cafeId,
    targetDepartment: normDept,
    items,
    status: 'PENDING',
    orderDate: getIstBusinessDate(),
    requestedByUserId: request.auth.userId,
    notes: typeof notes === 'string' ? notes.trim() : '',
  });

  await order.save();

  await recordRequestAudit({
    request,
    module: 'DEPARTMENT_ORDERS',
    action: 'CREATE_DEPARTMENT_ORDER',
    entityType: 'DEPARTMENT_ORDER',
    entityId: seqId,
    after: { orderId: seqId, cafeId, targetDepartment: normDept },
    result: 'SUCCESS',
    riskClassification: 'LOW',
  });

  return response.status(201).json({
    success: true,
    data: { order: order.toObject() },
    correlationId: request.correlationId || null,
  });
});

const updateOrderStatus = asyncHandler(async (request, response) => {
  const orderId = normalizeId(request.params.orderId);
  const { status } = request.body;

  const targetStatus = normalizeId(status);
  if (!ORDER_STATUSES.includes(targetStatus)) {
    throw new ApiError(400, 'INVALID_STATUS', 'Invalid order status.');
  }

  const order = await DepartmentOrder.findOne({
    orderId,
    organisationId: request.auth.organisationId,
  });

  if (!order) throw new ApiError(404, 'NOT_FOUND', 'Department order not found.');
  assertCafeAccess(request, order.cafeId);

  order.status = targetStatus;
  await order.save();

  await recordRequestAudit({
    request,
    module: 'DEPARTMENT_ORDERS',
    action: 'UPDATE_DEPARTMENT_ORDER_STATUS',
    entityType: 'DEPARTMENT_ORDER',
    entityId: orderId,
    after: { status: targetStatus },
    result: 'SUCCESS',
    riskClassification: 'LOW',
  });

  return response.status(200).json({
    success: true,
    data: { order: order.toObject() },
    correlationId: request.correlationId || null,
  });
});

module.exports = {
  listDepartmentOrders,
  createDepartmentOrder,
  updateOrderStatus,
};
