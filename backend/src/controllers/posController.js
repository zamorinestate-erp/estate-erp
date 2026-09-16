'use strict';

/**
 * POS CONTROLLER (SCREEN 005 / PRIMARY MASTER PROGRAMME STAGE 06)
 *
 * Exposes authoritative POS API endpoints:
 *  - POST /api/v1/pos/orders/commit (Save, Print, Save & Print with idempotency)
 *  - POST /api/v1/pos/orders/preview (Real-time calculations & receipt preview)
 *  - POST /api/v1/pos/orders/:billId/print (Print existing committed bill)
 *  - POST /api/v1/pos/orders/:billId/reprint (Reprint with copy counter & watermark)
 *  - GET  /api/v1/pos/orders/active/:cafeId (Fetch active open tickets)
 */

const { PosOrderService } = require('../services/posOrderService');
const { Bill } = require('../models/Bill');
const { asyncHandler } = require('../utils/asyncHandler');
const { ApiError } = require('../utils/ApiError');
const { assertResourceCafeOwnership, resolveEffectiveCafeScope } = require('../utils/cafeScope');

function normalizeId(value) {
  return typeof value === 'string' ? value.trim().toUpperCase() : '';
}

function assertCafeAccess(request, cafeId) {
  const normCafeId = normalizeId(cafeId);
  const effectiveCafe = resolveEffectiveCafeScope(request);
  if (effectiveCafe && normCafeId && normCafeId !== effectiveCafe) {
    throw new ApiError(
      403,
      'CROSS_CAFE_RESOURCE_DENIED',
      'Cross-café access is denied. You are not authorized for the requested café.'
    );
  }
  if (request.auth.role === 'MASTER' || request.auth.role === 'OWNER') return;
  if (!request.auth.assignedCafeIds || !request.auth.assignedCafeIds.map(normalizeId).includes(normCafeId)) {
    throw new ApiError(
      403,
      'CAFE_ACCESS_DENIED',
      'You do not have access to this café.'
    );
  }
}

/**
 * POST /api/v1/pos/orders/commit
 * Executes Save, Print, or Save & Print pipeline.
 */
const commitOrder = asyncHandler(async (request, response) => {
  const { action = 'SAVE_AND_PRINT', ...orderPayload } = request.body || {};
  const cafeId = normalizeId(orderPayload.cafeId || request.auth.primaryCafeId || request.auth.assignedCafeIds?.[0]);

  if (!cafeId) {
    throw new ApiError(400, 'CAFE_ID_REQUIRED', 'cafeId is required to process POS transactions.');
  }

  assertCafeAccess(request, cafeId);

  const idempotencyKey = request.body.idempotencyKey || request.headers['x-idempotency-key'] || null;

  const result = await PosOrderService.processOrder(
    { ...orderPayload, cafeId, idempotencyKey },
    request.auth,
    action,
    {
      idempotencyKey,
      simulatePrinterFailure: Boolean(request.body.simulatePrinterFailure),
    }
  );

  return response.status(200).json(result);
});

/**
 * POST /api/v1/pos/orders/preview
 * Returns computed taxes, totals, and receipt HTML markup without persisting to DB.
 */
const previewOrder = asyncHandler(async (request, response) => {
  const orderPayload = request.body || {};
  const cafeId = normalizeId(orderPayload.cafeId || request.auth.primaryCafeId || request.auth.assignedCafeIds?.[0]);

  if (cafeId) {
    assertCafeAccess(request, cafeId);
  }

  const result = await PosOrderService.previewReceipt(orderPayload, request.auth);
  return response.status(200).json(result);
});

/**
 * POST /api/v1/pos/orders/:billId/print
 * Generates thermal print buffer for an existing committed bill.
 */
const printOrder = asyncHandler(async (request, response) => {
  const billId = normalizeId(request.params.billId);
  const result = await PosOrderService.printCommittedBill(billId, request.auth);
  return response.status(200).json(result);
});

/**
 * POST /api/v1/pos/orders/:billId/reprint
 * Generates an authorized reprint with copy counter and watermark.
 */
const reprintOrder = asyncHandler(async (request, response) => {
  const billId = normalizeId(request.params.billId);
  const { reason = 'Customer Request' } = request.body || {};
  const result = await PosOrderService.reprintBill(billId, request.auth, reason);
  return response.status(200).json(result);
});

/**
 * GET /api/v1/pos/orders/active/:cafeId
 * Retrieves active/open bills/tickets for a café.
 */
const getActiveOrders = asyncHandler(async (request, response) => {
  const cafeId = normalizeId(request.params.cafeId);
  assertCafeAccess(request, cafeId);

  const bills = await Bill.find({
    organisationId: request.auth.organisationId,
    cafeId,
    status: { $in: ['OPEN', 'HELD'] },
  }).sort({ createdAt: -1 });

  return response.status(200).json({
    success: true,
    count: bills.length,
    data: bills,
  });
});

/**
 * GET /api/v1/pos/orders/last/:cafeId
 * Retrieves the most recent finalized bill for a café, enabling browser-refresh resilient reprint (CTL-05).
 */
const getLastCommittedBill = asyncHandler(async (request, response) => {
  const cafeId = normalizeId(request.params.cafeId || request.query.cafeId || request.auth.primaryCafeId || request.auth.assignedCafeIds?.[0]);
  if (!cafeId) {
    throw new ApiError(400, 'CAFE_ID_REQUIRED', 'cafeId is required to retrieve the last receipt.');
  }

  assertCafeAccess(request, cafeId);

  const bill = await Bill.findOne({
    organisationId: request.auth.organisationId,
    cafeId,
    status: { $in: ['COMPLETED', 'PARTIALLY_REFUNDED'] },
  }).sort({ createdAt: -1 });

  if (!bill) {
    throw new ApiError(404, 'NO_RECENT_BILLS', 'No recent finalized bill found for this café.');
  }

  const billData = typeof bill.toObject === 'function' ? bill.toObject() : bill;
  return response.status(200).json({
    success: true,
    data: billData,
    bill: billData,
  });
});

module.exports = {
  commitOrder,
  previewOrder,
  printOrder,
  reprintOrder,
  getActiveOrders,
  getLastCommittedBill,
};
