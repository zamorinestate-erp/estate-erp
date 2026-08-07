'use strict';

/**
 * PROCUREMENT CONTROLLER
 *
 * Implements Purchase Order lifecycle:
 *   DRAFT → SUBMITTED → APPROVED → ORDERED → PARTIALLY_RECEIVED / RECEIVED → CLOSED
 *
 * Chained Stock Update on Receive:
 *   When goods are received against a PurchaseOrder, the receivePO handler:
 *   1. Updates received quantities on line items.
 *   2. For each line item received delta:
 *      - Creates an immutable StockMovement (RECEIPT type).
 *      - Atomically increments CafeInventoryConfig.currentQuantityBase.
 *   3. Audits the receipt action.
 */

const {
  PurchaseOrder,
  PO_STATUSES,
} = require('../models/PurchaseOrder');

const {
  Vendor,
} = require('../models/Vendor');

const {
  GlobalInventoryItem,
} = require('../models/GlobalInventoryItem');

const {
  CafeInventoryConfig,
} = require('../models/CafeInventoryConfig');

const {
  StockMovement,
} = require('../models/StockMovement');

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
  if (request.auth.role === 'MASTER') return;
  if (!request.auth.assignedCafeIds.includes(cafeId)) {
    throw new ApiError(
      403,
      'CAFE_ACCESS_DENIED',
      'You do not have access to this café.'
    );
  }
}

// ── Handlers ─────────────────────────────────────────────────────────────────

/**
 * GET /procurement/orders
 * List purchase orders with filters (cafeId, vendorId, status, date range).
 */
const listOrders = asyncHandler(async (request, response) => {
  const page = parsePositiveInteger(request.query.page, 1, 1000);
  const limit = parsePositiveInteger(request.query.limit, 25, 100);
  const skip = (page - 1) * limit;

  const filter = { organisationId: request.auth.organisationId };
  const { cafeId, vendorId, status, from, to } = request.query;

  if (cafeId) {
    const normCafeId = normalizeId(cafeId);
    assertCafeAccess(request, normCafeId);
    filter.cafeId = normCafeId;
  } else if (request.auth.role !== 'MASTER') {
    filter.cafeId = { $in: request.auth.assignedCafeIds };
  }

  if (vendorId) filter.vendorId = normalizeId(vendorId);
  if (status && PO_STATUSES.includes(status.toUpperCase())) {
    filter.status = status.toUpperCase();
  }

  if (from && /^\d{4}-\d{2}-\d{2}$/.test(from)) {
    filter.orderDate = { ...filter.orderDate, $gte: from };
  }
  if (to && /^\d{4}-\d{2}-\d{2}$/.test(to)) {
    filter.orderDate = { ...filter.orderDate, $lte: to };
  }

  const [orders, total] = await Promise.all([
    PurchaseOrder.find(filter)
      .select('-__v -version')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    PurchaseOrder.countDocuments(filter),
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

/**
 * GET /procurement/orders/:purchaseOrderId
 * Get single PO detail.
 */
const getOrder = asyncHandler(async (request, response) => {
  const purchaseOrderId = normalizeId(request.params.purchaseOrderId);
  if (!purchaseOrderId) {
    throw new ApiError(400, 'INVALID_ID', 'Valid purchaseOrderId is required.');
  }

  const order = await PurchaseOrder.findOne({
    purchaseOrderId,
    organisationId: request.auth.organisationId,
  }).select('-__v -version').lean();

  if (!order) {
    throw new ApiError(404, 'NOT_FOUND', 'Purchase order not found.');
  }

  assertCafeAccess(request, order.cafeId);

  return response.status(200).json({
    success: true,
    data: { order },
    correlationId: request.correlationId || null,
  });
});

/**
 * POST /procurement/orders
 * Create a new Purchase Order (starts in DRAFT status).
 */
const createOrder = asyncHandler(async (request, response) => {
  const {
    cafeId: rawCafeId,
    vendorId: rawVendorId,
    lineItems,
    taxPaisa,
    discountPaisa,
    expectedDeliveryDate,
    terms,
    notes,
  } = request.body;

  const cafeId = normalizeId(rawCafeId);
  const vendorId = normalizeId(rawVendorId);

  if (!cafeId || !vendorId) {
    throw new ApiError(400, 'MISSING_FIELDS', 'cafeId and vendorId are required.');
  }
  assertCafeAccess(request, cafeId);

  // Validate vendor existence
  const vendor = await Vendor.findOne({
    vendorId,
    organisationId: request.auth.organisationId,
    status: 'ACTIVE',
  }).lean();

  if (!vendor) {
    throw new ApiError(404, 'VENDOR_NOT_FOUND', 'Active vendor not found.');
  }

  if (!Array.isArray(lineItems) || lineItems.length === 0) {
    throw new ApiError(400, 'LINE_ITEMS_REQUIRED', 'At least one line item is required.');
  }

  // Validate items and calculate lines
  const itemIds = lineItems.map((li) => normalizeId(li.itemId));
  const items = await GlobalInventoryItem.find({
    organisationId: request.auth.organisationId,
    itemId: { $in: itemIds },
    status: 'ACTIVE',
  }).lean();

  const itemMap = {};
  for (const item of items) {
    itemMap[item.itemId] = item;
  }

  let subtotalPaisa = 0;
  const processedLineItems = [];

  for (const li of lineItems) {
    const iId = normalizeId(li.itemId);
    const item = itemMap[iId];
    if (!item) {
      throw new ApiError(400, 'ITEM_NOT_FOUND', `Active item ${iId} not found.`);
    }

    const qty = Number(li.orderedQuantityBase);
    const unitPrice = Number(li.unitPricePaisa);

    if (!Number.isFinite(qty) || qty <= 0) {
      throw new ApiError(400, 'INVALID_QUANTITY', `Ordered quantity for item ${iId} must be positive.`);
    }
    if (!Number.isInteger(unitPrice) || unitPrice < 0) {
      throw new ApiError(400, 'INVALID_PRICE', `Unit price for item ${iId} must be a non-negative integer (paisa).`);
    }

    const totalLinePaisa = Math.round(qty * unitPrice);
    subtotalPaisa += totalLinePaisa;

    processedLineItems.push({
      itemId: iId,
      itemNameSnapshot: item.name,
      baseUnit: item.baseUnit,
      orderedQuantityBase: qty,
      receivedQuantityBase: 0,
      unitPricePaisa: unitPrice,
      totalLinePaisa,
      lineNotes: typeof li.lineNotes === 'string' ? li.lineNotes.trim() : '',
    });
  }

  const tax = Math.max(0, Number(taxPaisa) || 0);
  const discount = Math.max(0, Number(discountPaisa) || 0);
  const totalPaisa = Math.max(0, subtotalPaisa + tax - discount);

  const datePart = getIstBusinessDate().replace(/-/g, '');
  const seqId = await SequenceCounter.generateId({
    organisationId: request.auth.organisationId,
    sequenceKey: `PO_${datePart}`,
    prefix: `PO-${datePart}`,
    minimumDigits: 4,
  });

  const order = new PurchaseOrder({
    purchaseOrderId: seqId,
    organisationId: request.auth.organisationId,
    cafeId,
    vendorId,
    vendorNameSnapshot: vendor.name,
    lineItems: processedLineItems,
    subtotalPaisa,
    taxPaisa: tax,
    discountPaisa: discount,
    totalPaisa,
    status: 'DRAFT',
    orderDate: getIstBusinessDate(),
    expectedDeliveryDate: expectedDeliveryDate && /^\d{4}-\d{2}-\d{2}$/.test(expectedDeliveryDate) ? expectedDeliveryDate : null,
    terms: typeof terms === 'string' ? terms.trim() : '',
    notes: typeof notes === 'string' ? notes.trim() : '',
    createdByUserId: request.auth.userId,
    correlationId: request.correlationId || null,
  });

  await order.save();

  await recordRequestAudit({
    request,
    module: 'PROCUREMENT',
    action: 'CREATE_PURCHASE_ORDER',
    entityType: 'PURCHASE_ORDER',
    entityId: seqId,
    after: { purchaseOrderId: seqId, cafeId, vendorId, totalPaisa, lineItemCount: processedLineItems.length },
    result: 'SUCCESS',
    riskClassification: 'LOW',
  });

  return response.status(201).json({
    success: true,
    data: { order: order.toObject() },
    correlationId: request.correlationId || null,
  });
});

/**
 * POST /procurement/orders/:purchaseOrderId/submit
 * Move DRAFT → SUBMITTED.
 */
const submitOrder = asyncHandler(async (request, response) => {
  const purchaseOrderId = normalizeId(request.params.purchaseOrderId);
  const order = await PurchaseOrder.findOne({
    purchaseOrderId,
    organisationId: request.auth.organisationId,
  });

  if (!order) {
    throw new ApiError(404, 'NOT_FOUND', 'Purchase order not found.');
  }
  assertCafeAccess(request, order.cafeId);

  if (order.status !== 'DRAFT') {
    throw new ApiError(409, 'INVALID_STATUS_TRANSITION', `Cannot submit a purchase order in ${order.status} status.`);
  }

  order.status = 'SUBMITTED';
  order.submittedByUserId = request.auth.userId;
  order.submittedAt = new Date();
  order.lastModifiedByUserId = request.auth.userId;

  await order.save();

  await recordRequestAudit({
    request,
    module: 'PROCUREMENT',
    action: 'SUBMIT_PURCHASE_ORDER',
    entityType: 'PURCHASE_ORDER',
    entityId: purchaseOrderId,
    before: { status: 'DRAFT' },
    after: { status: 'SUBMITTED' },
    result: 'SUCCESS',
    riskClassification: 'LOW',
  });

  return response.status(200).json({
    success: true,
    data: { order: order.toObject() },
    correlationId: request.correlationId || null,
  });
});

/**
 * POST /procurement/orders/:purchaseOrderId/approve
 * Move SUBMITTED → APPROVED.
 */
const approveOrder = asyncHandler(async (request, response) => {
  const purchaseOrderId = normalizeId(request.params.purchaseOrderId);
  const { notes } = request.body;

  const order = await PurchaseOrder.findOne({
    purchaseOrderId,
    organisationId: request.auth.organisationId,
  });

  if (!order) {
    throw new ApiError(404, 'NOT_FOUND', 'Purchase order not found.');
  }
  assertCafeAccess(request, order.cafeId);

  if (order.status !== 'SUBMITTED') {
    throw new ApiError(409, 'INVALID_STATUS_TRANSITION', `Cannot approve a purchase order in ${order.status} status.`);
  }

  order.status = 'APPROVED';
  order.approvedByUserId = request.auth.userId;
  order.approvedAt = new Date();
  if (notes) order.approvalNotes = String(notes).trim();
  order.lastModifiedByUserId = request.auth.userId;

  await order.save();

  await recordRequestAudit({
    request,
    module: 'PROCUREMENT',
    action: 'APPROVE_PURCHASE_ORDER',
    entityType: 'PURCHASE_ORDER',
    entityId: purchaseOrderId,
    before: { status: 'SUBMITTED' },
    after: { status: 'APPROVED' },
    result: 'SUCCESS',
    riskClassification: 'MEDIUM',
  });

  return response.status(200).json({
    success: true,
    data: { order: order.toObject() },
    correlationId: request.correlationId || null,
  });
});

/**
 * POST /procurement/orders/:purchaseOrderId/order
 * Move APPROVED → ORDERED (sent to vendor).
 */
const orderSent = asyncHandler(async (request, response) => {
  const purchaseOrderId = normalizeId(request.params.purchaseOrderId);
  const order = await PurchaseOrder.findOne({
    purchaseOrderId,
    organisationId: request.auth.organisationId,
  });

  if (!order) {
    throw new ApiError(404, 'NOT_FOUND', 'Purchase order not found.');
  }
  assertCafeAccess(request, order.cafeId);

  if (order.status !== 'APPROVED') {
    throw new ApiError(409, 'INVALID_STATUS_TRANSITION', `Cannot mark as ORDERED from ${order.status} status.`);
  }

  order.status = 'ORDERED';
  order.lastModifiedByUserId = request.auth.userId;

  await order.save();

  await recordRequestAudit({
    request,
    module: 'PROCUREMENT',
    action: 'SEND_PURCHASE_ORDER',
    entityType: 'PURCHASE_ORDER',
    entityId: purchaseOrderId,
    before: { status: 'APPROVED' },
    after: { status: 'ORDERED' },
    result: 'SUCCESS',
    riskClassification: 'LOW',
  });

  return response.status(200).json({
    success: true,
    data: { order: order.toObject() },
    correlationId: request.correlationId || null,
  });
});

/**
 * POST /procurement/orders/:purchaseOrderId/receive
 * Receive delivery against a PO.
 * Body:
 *   deliveries: [ { itemId, quantityReceived } ]
 *   vendorInvoiceNumber (optional)
 *   vendorInvoiceDate (optional)
 *
 * Chained effect:
 *   For each line item:
 *   1. Increment receivedQuantityBase on PO.
 *   2. Create StockMovement (type: RECEIPT).
 *   3. Atomically increment CafeInventoryConfig.currentQuantityBase.
 *   4. Update PO status to PARTIALLY_RECEIVED or RECEIVED.
 */
const receiveOrder = asyncHandler(async (request, response) => {
  const purchaseOrderId = normalizeId(request.params.purchaseOrderId);
  const { deliveries, vendorInvoiceNumber, vendorInvoiceDate } = request.body;

  if (!Array.isArray(deliveries) || deliveries.length === 0) {
    throw new ApiError(400, 'DELIVERIES_REQUIRED', 'At least one item delivery quantity is required.');
  }

  const order = await PurchaseOrder.findOne({
    purchaseOrderId,
    organisationId: request.auth.organisationId,
  });

  if (!order) {
    throw new ApiError(404, 'NOT_FOUND', 'Purchase order not found.');
  }
  assertCafeAccess(request, order.cafeId);

  if (!['ORDERED', 'PARTIALLY_RECEIVED'].includes(order.status)) {
    throw new ApiError(409, 'INVALID_STATUS', `Cannot receive goods for a purchase order in ${order.status} status.`);
  }

  const businessDate = getIstBusinessDate();
  const datePart = businessDate.replace(/-/g, '');
  const movementsCreated = [];

  for (const del of deliveries) {
    const iId = normalizeId(del.itemId);
    const qtyReceived = Number(del.quantityReceived);

    if (!Number.isFinite(qtyReceived) || qtyReceived <= 0) {
      continue; // Skip zero or invalid received entries
    }

    const lineItem = order.lineItems.find((li) => li.itemId === iId);
    if (!lineItem) {
      throw new ApiError(400, 'INVALID_LINE_ITEM', `Item ${iId} is not in this purchase order.`);
    }

    // Check cafe stock config exists
    const stockConfig = await CafeInventoryConfig.findOne({
      organisationId: request.auth.organisationId,
      cafeId: order.cafeId,
      itemId: iId,
    });

    if (!stockConfig) {
      throw new ApiError(404, 'STOCK_CONFIG_NOT_FOUND', `Stock config for item ${iId} at café ${order.cafeId} not found.`);
    }

    const balanceBefore = stockConfig.currentQuantityBase;
    const balanceAfter = balanceBefore + qtyReceived;

    // Generate movement ID
    const movId = await SequenceCounter.generateId({
      organisationId: request.auth.organisationId,
      sequenceKey: `STOCK_MOVEMENT_${datePart}`,
      prefix: `SMOV-${datePart}`,
      minimumDigits: 4,
    });

    // Create StockMovement record
    const movement = new StockMovement({
      movementId: movId,
      organisationId: request.auth.organisationId,
      cafeId: order.cafeId,
      itemId: iId,
      movementType: 'RECEIPT',
      quantityDelta: qtyReceived,
      balanceBefore,
      balanceAfter,
      businessDate,
      serverTimestamp: new Date(),
      status: 'ACTIVE',
      sourceModule: 'PROCUREMENT',
      sourceRecordId: purchaseOrderId,
      description: `Goods receipt for PO ${purchaseOrderId}`,
      createdByUserId: request.auth.userId,
      createdByRole: request.auth.role,
      correlationId: request.correlationId || null,
    });

    await movement.save();
    movementsCreated.push(movId);

    // Atomic update to cafe inventory
    await CafeInventoryConfig.findOneAndUpdate(
      {
        organisationId: request.auth.organisationId,
        cafeId: order.cafeId,
        itemId: iId,
      },
      {
        $inc: { currentQuantityBase: qtyReceived },
        $set: { lastModifiedByUserId: request.auth.userId },
      }
    );

    // Update PO line item
    lineItem.receivedQuantityBase += qtyReceived;
  }

  // Determine overall status
  let allCompleted = true;
  let anyReceived = false;

  for (const li of order.lineItems) {
    if (li.receivedQuantityBase >= li.orderedQuantityBase) {
      anyReceived = true;
    } else if (li.receivedQuantityBase > 0) {
      anyReceived = true;
      allCompleted = false;
    } else {
      allCompleted = false;
    }
  }

  order.status = allCompleted ? 'RECEIVED' : (anyReceived ? 'PARTIALLY_RECEIVED' : order.status);
  order.receivedDate = businessDate;
  if (vendorInvoiceNumber) order.vendorInvoiceNumber = String(vendorInvoiceNumber).trim();
  if (vendorInvoiceDate && /^\d{4}-\d{2}-\d{2}$/.test(vendorInvoiceDate)) order.vendorInvoiceDate = vendorInvoiceDate;
  order.lastModifiedByUserId = request.auth.userId;

  await order.save();

  await recordRequestAudit({
    request,
    module: 'PROCUREMENT',
    action: 'RECEIVE_PURCHASE_ORDER',
    entityType: 'PURCHASE_ORDER',
    entityId: purchaseOrderId,
    after: { status: order.status, movementsCreatedCount: movementsCreated.length },
    result: 'SUCCESS',
    riskClassification: 'MEDIUM',
  });

  return response.status(200).json({
    success: true,
    data: { order: order.toObject(), movementsCreated },
    correlationId: request.correlationId || null,
  });
});

/**
 * POST /procurement/orders/:purchaseOrderId/cancel
 * Cancel PO (DRAFT, SUBMITTED, or APPROVED). Requires reason.
 */
const cancelOrder = asyncHandler(async (request, response) => {
  const purchaseOrderId = normalizeId(request.params.purchaseOrderId);
  const { reason } = request.body;

  const reasonText = typeof reason === 'string' ? reason.trim() : '';
  if (reasonText.length < 5) {
    throw new ApiError(400, 'REASON_REQUIRED', 'A reason of at least 5 characters is required.');
  }

  const order = await PurchaseOrder.findOne({
    purchaseOrderId,
    organisationId: request.auth.organisationId,
  });

  if (!order) {
    throw new ApiError(404, 'NOT_FOUND', 'Purchase order not found.');
  }
  assertCafeAccess(request, order.cafeId);

  if (['RECEIVED', 'CLOSED', 'CANCELLED'].includes(order.status)) {
    throw new ApiError(409, 'CANNOT_CANCEL', `Cannot cancel purchase order in ${order.status} status.`);
  }

  order.status = 'CANCELLED';
  order.cancelledByUserId = request.auth.userId;
  order.cancelledAt = new Date();
  order.cancellationReason = reasonText;
  order.lastModifiedByUserId = request.auth.userId;

  await order.save();

  await recordRequestAudit({
    request,
    module: 'PROCUREMENT',
    action: 'CANCEL_PURCHASE_ORDER',
    entityType: 'PURCHASE_ORDER',
    entityId: purchaseOrderId,
    reason: reasonText,
    result: 'SUCCESS',
    riskClassification: 'MEDIUM',
  });

  return response.status(200).json({
    success: true,
    data: { order: order.toObject() },
    correlationId: request.correlationId || null,
  });
});

module.exports = {
  listOrders,
  getOrder,
  createOrder,
  submitOrder,
  approveOrder,
  orderSent,
  receiveOrder,
  cancelOrder,
};
