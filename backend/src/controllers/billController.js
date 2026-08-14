'use strict';

/**
 * BILL CONTROLLER
 *
 * Implements POS Billing & Receipts:
 *   - Create bill / order
 *   - Complete bill (collect payment & finalise)
 *   - Void bill (requires reason & audit)
 *   - List bills per café
 */

const {
  Bill,
  BILL_STATUSES,
  PAYMENT_METHODS,
} = require('../models/Bill');

const {
  CashTransaction,
} = require('../models/CashTransaction');

const {
  MenuItem,
} = require('../models/MenuItem');

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

/**
 * GET /bills
 * List bills (filtered by cafeId, status, businessDate).
 */
const listBills = asyncHandler(async (request, response) => {
  const page = parsePositiveInteger(request.query.page, 1, 1000);
  const limit = parsePositiveInteger(request.query.limit, 50, 200);
  const skip = (page - 1) * limit;

  const filter = { organisationId: request.auth.organisationId };
  const { cafeId, status, date } = request.query;

  if (cafeId) {
    const normCafeId = normalizeId(cafeId);
    assertCafeAccess(request, normCafeId);
    filter.cafeId = normCafeId;
  } else if (!['MASTER', 'OWNER'].includes(request.auth.role)) {
    filter.cafeId = { $in: request.auth.assignedCafeIds };
  }

  if (status && BILL_STATUSES.includes(status.toUpperCase())) {
    filter.status = status.toUpperCase();
  }
  if (date && /^\d{4}-\d{2}-\d{2}$/.test(date)) {
    filter.businessDate = date;
  } else {
    filter.businessDate = getIstBusinessDate();
  }

  const [bills, total] = await Promise.all([
    Bill.find(filter)
      .select('-__v -version')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    Bill.countDocuments(filter),
  ]);

  return response.status(200).json({
    success: true,
    data: {
      bills,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    },
    correlationId: request.correlationId || null,
  });
});

/**
 * GET /bills/:billId
 */
const getBill = asyncHandler(async (request, response) => {
  const billId = normalizeId(request.params.billId);
  const bill = await Bill.findOne({
    billId,
    organisationId: request.auth.organisationId,
  }).select('-__v -version').lean();

  if (!bill) {
    throw new ApiError(404, 'NOT_FOUND', 'Bill not found.');
  }
  assertCafeAccess(request, bill.cafeId);

  return response.status(200).json({
    success: true,
    data: { bill },
    correlationId: request.correlationId || null,
  });
});

/**
 * POST /bills
 * Create & finalise a bill from POS.
 */
const createBill = asyncHandler(async (request, response) => {
  const {
    cafeId: rawCafeId,
    orderType,
    tableNumber,
    customerName,
    customerPhone,
    lineItems,
    discountPaisa,
    paymentMethod,
    isImmediateCompletion,
  } = request.body;

  const cafeId = normalizeId(rawCafeId);
  if (!cafeId) {
    throw new ApiError(400, 'CAFE_ID_REQUIRED', 'cafeId is required.');
  }
  assertCafeAccess(request, cafeId);

  if (!Array.isArray(lineItems) || lineItems.length === 0) {
    throw new ApiError(400, 'LINE_ITEMS_REQUIRED', 'At least one line item is required.');
  }

  // Fetch items to snapshot prices
  const itemIds = lineItems.map((li) => normalizeId(li.menuItemId));
  const menuItems = await MenuItem.find({
    organisationId: request.auth.organisationId,
    menuItemId: { $in: itemIds },
  }).lean();

  const itemMap = {};
  for (const m of menuItems) {
    itemMap[m.menuItemId] = m;
  }

  let subtotalPaisa = 0;
  let taxPaisa = 0;
  const processedLineItems = [];

  for (const li of lineItems) {
    const mId = normalizeId(li.menuItemId);
    const mItem = itemMap[mId];
    if (!mItem) {
      throw new ApiError(400, 'MENU_ITEM_NOT_FOUND', `Menu item ${mId} not found.`);
    }

    const qty = Math.max(1, Number(li.quantity) || 1);
    const unitPrice = mItem.currentPricePaisa;
    const lineSubtotal = qty * unitPrice;
    const taxRate = mItem.taxRatePercent || 5;

    subtotalPaisa += lineSubtotal;
    taxPaisa += Math.round(lineSubtotal * (taxRate / 100));

    processedLineItems.push({
      menuItemId: mId,
      itemNameSnapshot: mItem.name,
      quantity: qty,
      unitPricePaisa: unitPrice,
      taxRatePercent: taxRate,
      lineSubtotalPaisa: lineSubtotal,
    });
  }

  const discount = Math.max(0, Number(discountPaisa) || 0);
  const totalPaisa = Math.max(0, subtotalPaisa + taxPaisa - discount);

  const businessDate = getIstBusinessDate();
  const datePart = businessDate.replace(/-/g, '');
  const seqId = await SequenceCounter.generateId({
    organisationId: request.auth.organisationId,
    sequenceKey: `BILL_${datePart}`,
    prefix: `BILL-${datePart}`,
    minimumDigits: 4,
  });

  const shouldComplete = isImmediateCompletion !== false; // default true for POS quick sale
  const payMethod = PAYMENT_METHODS.includes(normalizeId(paymentMethod))
    ? normalizeId(paymentMethod)
    : 'CASH';

  const bill = new Bill({
    billId: seqId,
    organisationId: request.auth.organisationId,
    cafeId,
    orderType: orderType ? normalizeId(orderType) : 'DINE_IN',
    tableNumber: typeof tableNumber === 'string' ? tableNumber.trim() : '',
    customerName: typeof customerName === 'string' ? customerName.trim() : '',
    customerPhone: typeof customerPhone === 'string' ? customerPhone.trim() : '',
    lineItems: processedLineItems,
    subtotalPaisa,
    taxPaisa,
    discountPaisa: discount,
    totalPaisa,
    paymentStatus: shouldComplete ? 'PAID' : 'UNPAID',
    paymentMethod: payMethod,
    businessDate,
    status: shouldComplete ? 'COMPLETED' : 'OPEN',
    cashierUserId: request.auth.userId,
    correlationId: request.correlationId || null,
  });

  await bill.save();

  // If paid in CASH and completed, automatically record in Cash Book
  if (shouldComplete && payMethod === 'CASH') {
    try {
      const ctSeqId = await SequenceCounter.generateId({
        organisationId: request.auth.organisationId,
        sequenceKey: `CASH_TX_${datePart}`,
        prefix: `CT-${datePart}`,
        minimumDigits: 4,
      });

      const cashTx = new CashTransaction({
        cashTransactionId: ctSeqId,
        organisationId: request.auth.organisationId,
        cafeId,
        businessDate,
        transactionType: 'CASH_IN',
        direction: 'IN',
        category: 'POS_SALE',
        amount: Math.max(0.01, totalPaisa / 100),
        paymentMethod: 'CASH',
        status: 'POSTED',
        description: `POS Sale Receipt #${seqId}`,
        referenceType: 'BILL',
        referenceId: seqId,
        recordedBy: request.auth.userId,
        createdBy: request.auth.userId,
      });

      await cashTx.save();
    } catch (err) {
      console.error('Failed to auto-post cash transaction for bill', seqId, err);
    }
  }

  await recordRequestAudit({
    request,
    module: 'POS_BILLING',
    action: 'CREATE_BILL',
    entityType: 'BILL',
    entityId: seqId,
    after: { billId: seqId, cafeId, totalPaisa, status: bill.status, paymentMethod: payMethod },
    result: 'SUCCESS',
    riskClassification: 'LOW',
  });

  return response.status(201).json({
    success: true,
    data: { bill: bill.toObject() },
    correlationId: request.correlationId || null,
  });
});

/**
 * POST /bills/:billId/void
 * Void a bill. Requires reason (minimum 5 chars).
 */
const voidBill = asyncHandler(async (request, response) => {
  const billId = normalizeId(request.params.billId);
  const { reason } = request.body;

  const reasonText = typeof reason === 'string' ? reason.trim() : '';
  if (reasonText.length < 5) {
    throw new ApiError(400, 'REASON_REQUIRED', 'A reason of at least 5 characters is required to void a bill.');
  }

  const bill = await Bill.findOne({
    billId,
    organisationId: request.auth.organisationId,
  });

  if (!bill) {
    throw new ApiError(404, 'NOT_FOUND', 'Bill not found.');
  }
  assertCafeAccess(request, bill.cafeId);

  if (bill.status === 'VOIDED') {
    throw new ApiError(409, 'ALREADY_VOIDED', 'This bill is already voided.');
  }

  const prevStatus = bill.status;
  bill.status = 'VOIDED';
  bill.paymentStatus = 'REFUNDED';
  bill.voidedByUserId = request.auth.userId;
  bill.voidReason = reasonText;
  bill.voidedAt = new Date();

  await bill.save();

  await recordRequestAudit({
    request,
    module: 'POS_BILLING',
    action: 'VOID_BILL',
    entityType: 'BILL',
    entityId: billId,
    before: { status: prevStatus },
    after: { status: 'VOIDED', reason: reasonText },
    reason: reasonText,
    result: 'SUCCESS',
    riskClassification: 'MEDIUM',
  });

  return response.status(200).json({
    success: true,
    data: { bill: bill.toObject() },
    correlationId: request.correlationId || null,
  });
});

module.exports = {
  listBills,
  getBill,
  createBill,
  voidBill,
};
