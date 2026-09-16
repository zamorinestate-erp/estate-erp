'use strict';

/**
 * VENDOR LEDGER SERVICE
 *
 * Core accounting & subledger management for Zamorin Café ERP:
 * - Receipt-based Accounts Payable bill generation
 * - 3-value financial preservation (Supplier Claimed, Approved Payable, Held/Disputed)
 * - Vendor payments, partial payments & invoice-level allocations
 * - Advances & credit note management
 * - Payment reversals and refunds
 * - Permanent immutable Vendor Ledger with running balances
 * - Accounts Payable aging and GST 180-day monitoring
 */

const { VendorLedgerEntry } = require('../models/VendorLedgerEntry');
const { APInvoice } = require('../models/APInvoice');
const { Vendor } = require('../models/Vendor');
const { PurchaseOrder } = require('../models/PurchaseOrder');
const { SequenceCounter } = require('../models/SequenceCounter');
const { ApiError } = require('../utils/ApiError');
const { recordRequestAudit } = require('./auditService');

function normalizeId(value) {
  return typeof value === 'string' ? value.trim().toUpperCase() : '';
}

function getIstBusinessDate(date = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

/**
 * Get current running balance for a vendor.
 */
async function getVendorRunningBalance(organisationId, vendorId) {
  const lastEntry = await VendorLedgerEntry.findOne({
    organisationId,
    vendorId: normalizeId(vendorId),
  })
    .sort({ entryTimestamp: -1, _id: -1 })
    .lean();

  return lastEntry ? Number(lastEntry.runningBalancePaisa || 0) : 0;
}

/**
 * Recompute and update Vendor financialSummary rollup.
 */
async function syncVendorFinancialSummary(organisationId, vendorId) {
  const normVendorId = normalizeId(vendorId);

  const [orders, invoices, ledgerEntries] = await Promise.all([
    PurchaseOrder.find({ organisationId, vendorId: normVendorId }).lean(),
    APInvoice.find({ organisationId, vendorId: normVendorId }).lean(),
    VendorLedgerEntry.find({ organisationId, vendorId: normVendorId, isReversed: false }).lean(),
  ]);

  let lifetimePoOrderedValuePaisa = 0;
  let lifetimeAcceptedReceivedValuePaisa = 0;

  for (const po of orders) {
    lifetimePoOrderedValuePaisa += Number(po.totalPaisa || 0);
    for (const li of po.lineItems || []) {
      const acceptedQty = Number(li.acceptedReceivedQty || li.receivedQuantityBase || 0);
      const unitPrice = Number(li.unitPricePaisa || 0);
      lifetimeAcceptedReceivedValuePaisa += acceptedQty * unitPrice;
    }
  }

  let lifetimeVendorInvoiceValuePaisa = 0;
  let lifetimeApprovedPayablePaisa = 0;
  let currentGrossPayablesPaisa = 0;
  let currentPaymentHoldsPaisa = 0;
  let currentApprovedPayablePaisa = 0;
  let currentOutstandingPayablePaisa = 0;
  let overdueAmountPaisa = 0;
  const today = getIstBusinessDate();

  for (const inv of invoices) {
    const claimed = Number(inv.supplierClaimedAmountPaisa || inv.totalPaisa || 0);
    const approved = Number(inv.approvedPayableAmountPaisa || inv.totalPaisa || 0);
    const held = Number(inv.heldDisputedAmountPaisa || 0);
    const outstanding = Number(inv.outstandingPayableAmountPaisa !== undefined ? inv.outstandingPayableAmountPaisa : (inv.outstandingPaisa || 0));

    lifetimeVendorInvoiceValuePaisa += claimed;
    lifetimeApprovedPayablePaisa += approved;
    currentGrossPayablesPaisa += claimed;
    currentPaymentHoldsPaisa += held;
    currentApprovedPayablePaisa += approved;
    currentOutstandingPayablePaisa += outstanding;

    if (outstanding > 0 && inv.dueDate && inv.dueDate < today) {
      overdueAmountPaisa += outstanding;
    }
  }

  let lifetimePaidPaisa = 0;
  let availableVendorAdvancePaisa = 0;
  let availableVendorCreditPaisa = 0;
  let lastPaymentDate = null;
  let lastPaymentAmountPaisa = 0;

  for (const entry of ledgerEntries) {
    if (entry.isReversed) {
      continue;
    }
    if (entry.entryType === 'PAYMENT' || entry.entryType === 'PARTIAL_PAYMENT') {
      lifetimePaidPaisa += Number(entry.debitPaisa || 0);
      if (!lastPaymentDate || new Date(entry.entryTimestamp) > new Date(lastPaymentDate)) {
        lastPaymentDate = entry.entryTimestamp;
        lastPaymentAmountPaisa = Number(entry.debitPaisa || 0);
      }
    } else if (entry.entryType === 'ADVANCE_PAYMENT') {
      availableVendorAdvancePaisa += Number(entry.debitPaisa || 0);
    } else if (entry.entryType === 'ADVANCE_APPLIED') {
      const appliedAmt = Number(entry.paidPaisa || (entry.metadata && entry.metadata.appliedPaisa) || entry.creditPaisa || entry.debitPaisa || 0);
      availableVendorAdvancePaisa = Math.max(0, availableVendorAdvancePaisa - appliedAmt);
    }
  }

  const financialSummary = {
    lifetimePoOrderedValuePaisa,
    lifetimeAcceptedReceivedValuePaisa,
    lifetimeVendorInvoiceValuePaisa,
    lifetimeApprovedPayablePaisa,
    lifetimePaidPaisa,
    currentGrossPayablesPaisa,
    currentPaymentHoldsPaisa,
    currentApprovedPayablePaisa,
    currentOutstandingPayablePaisa,
    availableVendorAdvancePaisa,
    availableVendorCreditPaisa,
    overdueAmountPaisa,
    lastPaymentDate,
    lastPaymentAmountPaisa,
    lastEvaluatedAt: new Date(),
  };

  await Vendor.findOneAndUpdate(
    { organisationId, vendorId: normVendorId },
    { $set: { financialSummary } }
  );

  return financialSummary;
}

/**
 * 1. Post Vendor Bill from PO Dock Receipt & Three-Way Match Handoff.
 * Preserves Supplier Claimed Amount independently from Approved Payable Amount.
 * Basis of merchandise payable = acceptedReceivedQty * unitPricePaisa.
 */
async function postVendorBillFromReceipt({
  organisationId,
  purchaseOrderId,
  supplierInvoiceNumber,
  invoiceDate,
  dueDate,
  claimedAmountPaisa,
  claimedTaxPaisa = 0,
  notes = '',
  auth,
}) {
  const po = await PurchaseOrder.findOne({
    organisationId,
    purchaseOrderId: normalizeId(purchaseOrderId),
  });

  if (!po) {
    throw new ApiError(404, 'PO_NOT_FOUND', `Purchase order ${purchaseOrderId} not found.`);
  }

  const vendorId = normalizeId(po.vendorId);
  const vendor = await Vendor.findOne({ organisationId, vendorId }).lean();
  const businessDate = getIstBusinessDate();
  const datePart = businessDate.replace(/-/g, '');

  // Calculate receipt-based merchandise payable basis: ONLY accepted received quantities
  let acceptedGoodsPaisa = 0;
  let lineItemsMatch = [];

  for (const li of po.lineItems || []) {
    const acceptedQty = Number(li.acceptedReceivedQty || li.receivedQuantityBase || 0);
    const orderedQty = Number(li.orderedQuantityBase || 0);
    const unitPrice = Number(li.unitPricePaisa || 0);
    const payableLinePaisa = acceptedQty * unitPrice;
    const orderedLinePaisa = orderedQty * unitPrice;

    acceptedGoodsPaisa += payableLinePaisa;

    lineItemsMatch.push({
      itemId: li.itemId,
      itemName: li.itemNameSnapshot || li.itemId,
      invoiceQuantity: orderedQty, // supplier invoiced as ordered
      acceptedQuantity: acceptedQty,
      rejectedQuantity: Number(li.rejectedQty || 0),
      unitPricePaisa: unitPrice,
      lineTotalPaisa: orderedLinePaisa,
      payableAmountPaisa: payableLinePaisa,
      disputeReason: acceptedQty < orderedQty ? `Quantity shortfall: received ${acceptedQty} of ${orderedQty}` : '',
    });
  }

  // Calculate tax proportion
  const taxRate = po.subtotalPaisa > 0 ? (po.taxPaisa / po.subtotalPaisa) : 0;
  const approvedTaxPaisa = Math.round(acceptedGoodsPaisa * taxRate);
  const approvedPayableAmountPaisa = acceptedGoodsPaisa + approvedTaxPaisa;

  const rawClaimedTotal = claimedAmountPaisa !== undefined
    ? Number(claimedAmountPaisa) + Number(claimedTaxPaisa || 0)
    : Number(po.totalPaisa || 0);

  const supplierClaimedAmountPaisa = rawClaimedTotal;
  const heldDisputedAmountPaisa = Math.max(0, supplierClaimedAmountPaisa - approvedPayableAmountPaisa);

  // Generate AP Invoice ID
  const apInvoiceSeq = await SequenceCounter.generateId({
    organisationId,
    sequenceKey: `AP_INV_${datePart}`,
    prefix: `AP-${datePart}`,
    minimumDigits: 4,
  });

  const normInvoiceNum = normalizeId(supplierInvoiceNumber || `INV-${po.purchaseOrderId}`);
  const finalDueDate = dueDate || po.expectedDeliveryDate || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  const grnIdList = (po.grnReceipts || []).map((g) => g.grnId).filter(Boolean);

  const holds = [];
  if (heldDisputedAmountPaisa > 0) {
    holds.push({
      holdCode: 'QUANTITY_VARIANCE',
      reason: `Disputed shortfall of ₹${(heldDisputedAmountPaisa / 100).toFixed(2)} between supplier claimed invoice and accepted dock receipt.`,
      placedAt: new Date(),
      placedBy: auth.userId,
    });
  }

  const apInvoice = new APInvoice({
    organisationId,
    invoiceId: apInvoiceSeq,
    vendorId,
    vendorName: vendor ? vendor.name : (po.vendorNameSnapshot || vendorId),
    supplierInvoiceNumber: normInvoiceNum,
    rawSupplierInvoiceNumber: supplierInvoiceNumber || normInvoiceNum,
    invoiceDate: invoiceDate || businessDate,
    dueDate: finalDueDate,
    amountPaisa: acceptedGoodsPaisa,
    taxPaisa: approvedTaxPaisa,
    totalPaisa: approvedPayableAmountPaisa,
    supplierClaimedAmountPaisa,
    approvedPayableAmountPaisa,
    heldDisputedAmountPaisa,
    paidPaisa: 0,
    outstandingPaisa: approvedPayableAmountPaisa,
    outstandingPayableAmountPaisa: approvedPayableAmountPaisa,
    cafeId: po.cafeId,
    poReferenceId: po.purchaseOrderId,
    grnIds: grnIdList,
    lineItems: lineItemsMatch,
    validationStatus: 'VALIDATED',
    approvalStatus: 'APPROVED',
    accountingStatus: 'POSTED',
    paymentStatus: heldDisputedAmountPaisa > 0 ? 'ON_HOLD' : 'DUE',
    holds,
  });

  await apInvoice.save();

  // Post VENDOR_BILL into VendorLedgerEntry
  const ledgerSeq = await SequenceCounter.generateId({
    organisationId,
    sequenceKey: `VLE_${datePart}`,
    prefix: `VLE-${datePart}`,
    minimumDigits: 5,
  });

  const currentBal = await getVendorRunningBalance(organisationId, vendorId);
  const newBal = currentBal + approvedPayableAmountPaisa;

  const ledgerEntry = new VendorLedgerEntry({
    organisationId,
    ledgerEntryId: ledgerSeq,
    vendorId,
    vendorNameSnapshot: vendor ? vendor.name : vendorId,
    cafeId: po.cafeId,
    entryDate: businessDate,
    entryTimestamp: new Date(),
    entryType: 'VENDOR_BILL',
    referenceType: 'AP_INVOICE',
    referenceId: apInvoice.invoiceId,
    purchaseOrderId: po.purchaseOrderId,
    grnId: grnIdList[0] || null,
    supplierInvoiceNumber: normInvoiceNum,
    debitPaisa: 0,
    creditPaisa: approvedPayableAmountPaisa, // Liability increases
    heldPaisa: heldDisputedAmountPaisa,
    paidPaisa: 0,
    runningBalancePaisa: newBal,
    notes: `Vendor Bill for PO ${po.purchaseOrderId} against ${grnIdList.length} GRN(s). ${notes}`.trim(),
    createdByUserId: auth.userId,
  });

  await ledgerEntry.save();

  // Sync vendor financial rollups
  await syncVendorFinancialSummary(organisationId, vendorId);

  return {
    apInvoice,
    ledgerEntry,
    threeWayDiscrepancy: {
      supplierClaimedPaisa: supplierClaimedAmountPaisa,
      approvedPayablePaisa: approvedPayableAmountPaisa,
      heldDisputedPaisa: heldDisputedAmountPaisa,
      hasDispute: heldDisputedAmountPaisa > 0,
    },
  };
}

/**
 * 2. Record Full or Partial Vendor Payment.
 * Allocates payment to specified open AP invoices.
 */
async function recordVendorPayment({
  organisationId,
  vendorId,
  paymentAmountPaisa,
  allocations = [],
  paymentMethod = 'BANK_TRANSFER',
  reference = '',
  bankAccountId = 'DEFAULT_BANK',
  notes = '',
  idempotencyKey = null,
  auth,
}) {
  const normVendorId = normalizeId(vendorId);
  const payAmount = Number(paymentAmountPaisa);

  if (!Number.isFinite(payAmount) || payAmount <= 0) {
    throw new ApiError(400, 'INVALID_AMOUNT', 'Payment amount must be greater than zero.');
  }

  // Idempotency check
  if (idempotencyKey) {
    const existing = await VendorLedgerEntry.findOne({
      organisationId,
      'metadata.idempotencyKey': idempotencyKey,
    }).lean();

    if (existing) {
      return {
        paymentId: existing.paymentId,
        isIdempotentReplay: true,
        ledgerEntry: existing,
      };
    }
  }

  const businessDate = getIstBusinessDate();
  const datePart = businessDate.replace(/-/g, '');

  // Fetch open invoices for vendor
  let openInvoices = await APInvoice.find({
    organisationId,
    vendorId: normVendorId,
    outstandingPayableAmountPaisa: { $gt: 0 },
  }).sort({ dueDate: 1 });

  const totalOutstanding = openInvoices.reduce((s, i) => s + (i.outstandingPayableAmountPaisa || 0), 0);

  if (payAmount > totalOutstanding) {
    throw new ApiError(
      400,
      'PAYMENT_EXCEEDS_APPROVED_PAYABLE',
      `Payment amount ₹${(payAmount / 100).toFixed(2)} exceeds total approved outstanding payable ₹${(totalOutstanding / 100).toFixed(2)}. Use Vendor Advance for overpayments.`
    );
  }

  const paymentSeq = await SequenceCounter.generateId({
    organisationId,
    sequenceKey: `VPAY_${datePart}`,
    prefix: `VPAY-${datePart}`,
    minimumDigits: 4,
  });

  // Distribute payment across invoices
  let remainingToDistribute = payAmount;
  const updatedInvoices = [];

  for (const inv of openInvoices) {
    if (remainingToDistribute <= 0) break;

    // Check if specific allocation specified
    const allocSpec = allocations.find((a) => a.invoiceId === inv.invoiceId);
    let allocPaisa = 0;

    if (allocSpec) {
      allocPaisa = Math.min(Number(allocSpec.amountPaisa), inv.outstandingPayableAmountPaisa, remainingToDistribute);
    } else if (allocations.length === 0) {
      // Automatic allocation: oldest due first
      allocPaisa = Math.min(inv.outstandingPayableAmountPaisa, remainingToDistribute);
    }

    if (allocPaisa > 0) {
      inv.paidPaisa = (inv.paidPaisa || 0) + allocPaisa;
      inv.outstandingPayableAmountPaisa = Math.max(0, inv.outstandingPayableAmountPaisa - allocPaisa);
      inv.outstandingPaisa = inv.outstandingPayableAmountPaisa;

      if (inv.outstandingPayableAmountPaisa === 0) {
        inv.paymentStatus = 'PAID';
      } else {
        inv.paymentStatus = 'PARTIALLY_PAID';
      }

      if (!inv.paymentHistory) inv.paymentHistory = [];
      inv.paymentHistory.push({
        paymentId: paymentSeq,
        paidPaisa: allocPaisa,
        paidAt: new Date(),
        paidByUserId: auth.userId,
        paymentMethod,
        reference: reference || '',
      });

      await inv.save();
      updatedInvoices.push({
        invoiceId: inv.invoiceId,
        allocatedPaisa: allocPaisa,
        newOutstandingPaisa: inv.outstandingPayableAmountPaisa,
        status: inv.paymentStatus,
      });

      remainingToDistribute -= allocPaisa;
    }
  }

  const entryType = payAmount < totalOutstanding ? 'PARTIAL_PAYMENT' : 'PAYMENT';

  const ledgerSeq = await SequenceCounter.generateId({
    organisationId,
    sequenceKey: `VLE_${datePart}`,
    prefix: `VLE-${datePart}`,
    minimumDigits: 5,
  });

  const currentBal = await getVendorRunningBalance(organisationId, normVendorId);
  const newBal = currentBal - payAmount;

  const vendor = await Vendor.findOne({ organisationId, vendorId: normVendorId }).lean();

  const ledgerEntry = new VendorLedgerEntry({
    organisationId,
    ledgerEntryId: ledgerSeq,
    vendorId: normVendorId,
    vendorNameSnapshot: vendor ? vendor.name : normVendorId,
    cafeId: openInvoices[0]?.cafeId || 'ORGANISATION_WIDE',
    entryDate: businessDate,
    entryTimestamp: new Date(),
    entryType,
    referenceType: 'PAYMENT',
    referenceId: paymentSeq,
    paymentId: paymentSeq,
    supplierInvoiceNumber: updatedInvoices[0]?.invoiceId || null,
    debitPaisa: payAmount, // Payment reduces liability
    creditPaisa: 0,
    paidPaisa: payAmount,
    runningBalancePaisa: newBal,
    notes: `Vendor payment via ${paymentMethod}. Ref: ${reference}. ${notes}`.trim(),
    createdByUserId: auth.userId,
    metadata: {
      idempotencyKey,
      bankAccountId,
      allocations: updatedInvoices,
    },
  });

  await ledgerEntry.save();
  await syncVendorFinancialSummary(organisationId, normVendorId);

  await recordRequestAudit({
    request: { auth, correlationId: ledgerSeq },
    module: 'FINANCE',
    action: 'RECORD_VENDOR_PAYMENT',
    entityType: 'VENDOR_PAYMENT',
    entityId: paymentSeq,
    after: {
      vendorId: normVendorId,
      paymentAmountPaisa: payAmount,
      entryType,
      updatedInvoicesCount: updatedInvoices.length,
    },
    result: 'SUCCESS',
    riskClassification: 'HIGH',
  });

  return {
    paymentId: paymentSeq,
    ledgerEntry,
    updatedInvoices,
    newRunningBalancePaisa: newBal,
  };
}

/**
 * 3. Record Vendor Advance Payment.
 */
async function recordVendorAdvance({
  organisationId,
  vendorId,
  amountPaisa,
  cafeId = 'ORGANISATION_WIDE',
  paymentMethod = 'BANK_TRANSFER',
  reference = '',
  notes = '',
  idempotencyKey = null,
  auth,
}) {
  const normVendorId = normalizeId(vendorId);
  const advAmount = Number(amountPaisa);

  if (!Number.isFinite(advAmount) || advAmount <= 0) {
    throw new ApiError(400, 'INVALID_AMOUNT', 'Advance amount must be greater than zero.');
  }

  const businessDate = getIstBusinessDate();
  const datePart = businessDate.replace(/-/g, '');

  const advanceSeq = await SequenceCounter.generateId({
    organisationId,
    sequenceKey: `VADV_${datePart}`,
    prefix: `VADV-${datePart}`,
    minimumDigits: 4,
  });

  const ledgerSeq = await SequenceCounter.generateId({
    organisationId,
    sequenceKey: `VLE_${datePart}`,
    prefix: `VLE-${datePart}`,
    minimumDigits: 5,
  });

  const currentBal = await getVendorRunningBalance(organisationId, normVendorId);
  const newBal = currentBal - advAmount;

  const vendor = await Vendor.findOne({ organisationId, vendorId: normVendorId }).lean();

  const ledgerEntry = new VendorLedgerEntry({
    organisationId,
    ledgerEntryId: ledgerSeq,
    vendorId: normVendorId,
    vendorNameSnapshot: vendor ? vendor.name : normVendorId,
    cafeId,
    entryDate: businessDate,
    entryTimestamp: new Date(),
    entryType: 'ADVANCE_PAYMENT',
    referenceType: 'ADVANCE',
    referenceId: advanceSeq,
    paymentId: advanceSeq,
    debitPaisa: advAmount, // Advance reduces net liability / creates debit balance
    creditPaisa: 0,
    paidPaisa: advAmount,
    runningBalancePaisa: newBal,
    notes: `Vendor advance payment via ${paymentMethod}. Ref: ${reference}. ${notes}`.trim(),
    createdByUserId: auth.userId,
    metadata: { idempotencyKey },
  });

  await ledgerEntry.save();
  await syncVendorFinancialSummary(organisationId, normVendorId);

  return {
    advanceId: advanceSeq,
    ledgerEntry,
    newRunningBalancePaisa: newBal,
  };
}

/**
 * 4. Apply Available Advance to an Approved Vendor Bill.
 */
async function applyVendorAdvance({
  organisationId,
  vendorId,
  invoiceId,
  amountToApplyPaisa,
  notes = '',
  auth,
}) {
  const normVendorId = normalizeId(vendorId);
  const applyAmount = Number(amountToApplyPaisa);

  const invoice = await APInvoice.findOne({
    organisationId,
    invoiceId,
    vendorId: normVendorId,
  });

  if (!invoice) {
    throw new ApiError(404, 'INVOICE_NOT_FOUND', `Invoice ${invoiceId} not found.`);
  }

  const vendor = await Vendor.findOne({ organisationId, vendorId: normVendorId }).lean();
  const availableAdvance = Number(vendor?.financialSummary?.availableVendorAdvancePaisa || 0);

  if (applyAmount > availableAdvance) {
    throw new ApiError(
      400,
      'INSUFFICIENT_ADVANCE',
      `Cannot apply ₹${(applyAmount / 100).toFixed(2)}; available advance is only ₹${(availableAdvance / 100).toFixed(2)}.`
    );
  }

  if (applyAmount > invoice.outstandingPayableAmountPaisa) {
    throw new ApiError(
      400,
      'AMOUNT_EXCEEDS_OUTSTANDING',
      `Applied advance cannot exceed invoice outstanding ₹${(invoice.outstandingPayableAmountPaisa / 100).toFixed(2)}.`
    );
  }

  invoice.appliedAdvancePaisa = (invoice.appliedAdvancePaisa || 0) + applyAmount;
  invoice.outstandingPayableAmountPaisa = Math.max(0, invoice.outstandingPayableAmountPaisa - applyAmount);
  invoice.outstandingPaisa = invoice.outstandingPayableAmountPaisa;

  if (invoice.outstandingPayableAmountPaisa === 0) {
    invoice.paymentStatus = 'PAID';
  } else {
    invoice.paymentStatus = 'PARTIALLY_PAID';
  }

  await invoice.save();

  const businessDate = getIstBusinessDate();
  const datePart = businessDate.replace(/-/g, '');

  const ledgerSeq = await SequenceCounter.generateId({
    organisationId,
    sequenceKey: `VLE_${datePart}`,
    prefix: `VLE-${datePart}`,
    minimumDigits: 5,
  });

  const currentBal = await getVendorRunningBalance(organisationId, normVendorId);

  const ledgerEntry = new VendorLedgerEntry({
    organisationId,
    ledgerEntryId: ledgerSeq,
    vendorId: normVendorId,
    vendorNameSnapshot: vendor ? vendor.name : normVendorId,
    cafeId: invoice.cafeId,
    entryDate: businessDate,
    entryTimestamp: new Date(),
    entryType: 'ADVANCE_APPLIED',
    referenceType: 'AP_INVOICE',
    referenceId: invoice.invoiceId,
    supplierInvoiceNumber: invoice.supplierInvoiceNumber,
    debitPaisa: 0,
    creditPaisa: 0, // Advance already debited when paid; applying it settles bill without changing overall net balance
    paidPaisa: applyAmount,
    runningBalancePaisa: currentBal,
    notes: `Applied ₹${(applyAmount / 100).toFixed(2)} advance to invoice ${invoice.invoiceId}. ${notes}`.trim(),
    createdByUserId: auth.userId,
    metadata: { appliedPaisa: applyAmount },
  });

  await ledgerEntry.save();
  await syncVendorFinancialSummary(organisationId, normVendorId);

  return {
    invoice,
    ledgerEntry,
    remainingAdvancePaisa: availableAdvance - applyAmount,
  };
}

/**
 * 5. Apply Credit Note to reduce Vendor Bill.
 */
async function applyVendorCreditNote({
  organisationId,
  vendorId,
  invoiceId,
  creditNoteId,
  amountPaisa,
  reason = '',
  auth,
}) {
  const normVendorId = normalizeId(vendorId);
  const creditAmount = Number(amountPaisa);

  const invoice = await APInvoice.findOne({
    organisationId,
    invoiceId,
    vendorId: normVendorId,
  });

  if (!invoice) {
    throw new ApiError(404, 'INVOICE_NOT_FOUND', `Invoice ${invoiceId} not found.`);
  }

  if (creditAmount > invoice.outstandingPayableAmountPaisa) {
    throw new ApiError(
      400,
      'CREDIT_EXCEEDS_OUTSTANDING',
      `Credit note amount ₹${(creditAmount / 100).toFixed(2)} exceeds invoice outstanding ₹${(invoice.outstandingPayableAmountPaisa / 100).toFixed(2)}.`
    );
  }

  invoice.appliedCreditPaisa = (invoice.appliedCreditPaisa || 0) + creditAmount;
  invoice.outstandingPayableAmountPaisa = Math.max(0, invoice.outstandingPayableAmountPaisa - creditAmount);
  invoice.outstandingPaisa = invoice.outstandingPayableAmountPaisa;

  if (invoice.outstandingPayableAmountPaisa === 0) {
    invoice.paymentStatus = 'PAID';
  } else {
    invoice.paymentStatus = 'PARTIALLY_PAID';
  }

  await invoice.save();

  const businessDate = getIstBusinessDate();
  const datePart = businessDate.replace(/-/g, '');

  const ledgerSeq = await SequenceCounter.generateId({
    organisationId,
    sequenceKey: `VLE_${datePart}`,
    prefix: `VLE-${datePart}`,
    minimumDigits: 5,
  });

  const currentBal = await getVendorRunningBalance(organisationId, normVendorId);
  const newBal = currentBal - creditAmount;

  const vendor = await Vendor.findOne({ organisationId, vendorId: normVendorId }).lean();

  const ledgerEntry = new VendorLedgerEntry({
    organisationId,
    ledgerEntryId: ledgerSeq,
    vendorId: normVendorId,
    vendorNameSnapshot: vendor ? vendor.name : normVendorId,
    cafeId: invoice.cafeId,
    entryDate: businessDate,
    entryTimestamp: new Date(),
    entryType: 'CREDIT_NOTE',
    referenceType: 'CREDIT_NOTE',
    referenceId: creditNoteId,
    supplierInvoiceNumber: invoice.supplierInvoiceNumber,
    debitPaisa: creditAmount, // Credit note reduces liability
    creditPaisa: 0,
    runningBalancePaisa: newBal,
    notes: `Vendor credit note ${creditNoteId} applied. Reason: ${reason}`.trim(),
    createdByUserId: auth.userId,
  });

  await ledgerEntry.save();
  await syncVendorFinancialSummary(organisationId, normVendorId);

  return {
    invoice,
    ledgerEntry,
    newRunningBalancePaisa: newBal,
  };
}

/**
 * 6. Payment Reversal.
 * Reverses a recorded vendor payment and restores the invoice liabilities.
 */
async function reversePayment({
  organisationId,
  paymentId,
  reason = 'Payment reversed by authorised financial officer',
  auth,
}) {
  const normPaymentId = normalizeId(paymentId);

  const originalEntry = await VendorLedgerEntry.findOne({
    organisationId,
    paymentId: normPaymentId,
    entryType: { $in: ['PAYMENT', 'PARTIAL_PAYMENT'] },
    isReversed: false,
  });

  if (!originalEntry) {
    throw new ApiError(404, 'PAYMENT_NOT_FOUND', `Active payment ${paymentId} not found or already reversed.`);
  }

  const payAmount = Number(originalEntry.debitPaisa || 0);
  const vendorId = originalEntry.vendorId;

  // Restore invoice balances
  const allocations = originalEntry.metadata?.allocations || [];
  for (const alloc of allocations) {
    const inv = await APInvoice.findOne({ organisationId, invoiceId: alloc.invoiceId });
    if (inv) {
      inv.paidPaisa = Math.max(0, (inv.paidPaisa || 0) - alloc.allocatedPaisa);
      inv.recalculateOutstanding();
      await inv.save();
    }
  }

  const businessDate = getIstBusinessDate();
  const datePart = businessDate.replace(/-/g, '');

  const reversalSeq = await SequenceCounter.generateId({
    organisationId,
    sequenceKey: `VREV_${datePart}`,
    prefix: `VREV-${datePart}`,
    minimumDigits: 4,
  });

  const ledgerSeq = await SequenceCounter.generateId({
    organisationId,
    sequenceKey: `VLE_${datePart}`,
    prefix: `VLE-${datePart}`,
    minimumDigits: 5,
  });

  const currentBal = await getVendorRunningBalance(organisationId, vendorId);
  const newBal = currentBal + payAmount; // Restores payable

  const reversalEntry = new VendorLedgerEntry({
    organisationId,
    ledgerEntryId: ledgerSeq,
    vendorId,
    vendorNameSnapshot: originalEntry.vendorNameSnapshot,
    cafeId: originalEntry.cafeId,
    entryDate: businessDate,
    entryTimestamp: new Date(),
    entryType: 'PAYMENT_REVERSAL',
    referenceType: 'PAYMENT',
    referenceId: originalEntry.paymentId,
    paymentId: reversalSeq,
    debitPaisa: 0,
    creditPaisa: payAmount, // Liability restored
    paidPaisa: 0,
    runningBalancePaisa: newBal,
    notes: `Reversal of payment ${originalEntry.paymentId}. Reason: ${reason}`.trim(),
    createdByUserId: auth.userId,
    reversalEntryId: originalEntry.ledgerEntryId,
  });

  // Mark original entry reversed via direct collection update to bypass pre-hook
  await VendorLedgerEntry.collection.updateOne(
    { _id: originalEntry._id },
    { $set: { isReversed: true, reversalEntryId: ledgerSeq } }
  );

  await reversalEntry.save();
  await syncVendorFinancialSummary(organisationId, vendorId);

  return {
    reversalEntry,
    restoredAmountPaisa: payAmount,
    newRunningBalancePaisa: newBal,
  };
}

/**
 * 7. Set Vendor Opening Balance.
 */
async function setOpeningBalance({
  organisationId,
  vendorId,
  amountPaisa,
  isCredit = true,
  effectiveDate,
  reason = 'Opening balance migration',
  auth,
}) {
  const normVendorId = normalizeId(vendorId);
  const amt = Number(amountPaisa);

  if (!Number.isFinite(amt) || amt < 0) {
    throw new ApiError(400, 'INVALID_AMOUNT', 'Opening balance amount must be non-negative.');
  }

  const existing = await VendorLedgerEntry.findOne({
    organisationId,
    vendorId: normVendorId,
    entryType: 'OPENING_BALANCE',
  }).lean();

  if (existing) {
    throw new ApiError(409, 'OPENING_BALANCE_EXISTS', 'Opening balance already recorded for this vendor.');
  }

  const businessDate = effectiveDate || getIstBusinessDate();
  const datePart = businessDate.replace(/-/g, '');

  const ledgerSeq = await SequenceCounter.generateId({
    organisationId,
    sequenceKey: `VLE_${datePart}`,
    prefix: `VLE-${datePart}`,
    minimumDigits: 5,
  });

  const runningBal = isCredit ? amt : -amt;
  const vendor = await Vendor.findOne({ organisationId, vendorId: normVendorId }).lean();

  const ledgerEntry = new VendorLedgerEntry({
    organisationId,
    ledgerEntryId: ledgerSeq,
    vendorId: normVendorId,
    vendorNameSnapshot: vendor ? vendor.name : normVendorId,
    cafeId: 'ORGANISATION_WIDE',
    entryDate: businessDate,
    entryTimestamp: new Date(),
    entryType: 'OPENING_BALANCE',
    referenceType: 'MANUAL',
    referenceId: 'OPENING_BAL',
    debitPaisa: isCredit ? 0 : amt,
    creditPaisa: isCredit ? amt : 0,
    runningBalancePaisa: runningBal,
    notes: `Vendor opening balance. Reason: ${reason}`.trim(),
    createdByUserId: auth.userId,
  });

  await ledgerEntry.save();
  await syncVendorFinancialSummary(organisationId, normVendorId);

  return ledgerEntry;
}

/**
 * 8. Query Vendor Ledger with optional café and date filters.
 */
async function getVendorLedger({
  organisationId,
  vendorId,
  cafeId = null,
  startDate = null,
  endDate = null,
  entryType = null,
  limit = 100,
  skip = 0,
}) {
  const normVendorId = normalizeId(vendorId);
  const filter = { organisationId, vendorId: normVendorId };

  if (cafeId && cafeId !== 'ORGANISATION_WIDE' && cafeId !== 'GLOBAL') {
    filter.$or = [{ cafeId: cafeId.trim().toUpperCase() }, { cafeId: 'ORGANISATION_WIDE' }];
  }

  if (startDate || endDate) {
    filter.entryDate = {};
    if (startDate) filter.entryDate.$gte = startDate;
    if (endDate) filter.entryDate.$lte = endDate;
  }

  if (entryType) {
    filter.entryType = entryType;
  }

  const [entries, totalCount] = await Promise.all([
    VendorLedgerEntry.find(filter)
      .sort({ entryDate: 1, entryTimestamp: 1, _id: 1 })
      .skip(Number(skip) || 0)
      .limit(Number(limit) || 100)
      .lean(),
    VendorLedgerEntry.countDocuments(filter),
  ]);

  const vendor = await Vendor.findOne({ organisationId, vendorId: normVendorId }).lean();

  return {
    vendorId: normVendorId,
    vendorName: vendor ? vendor.name : normVendorId,
    summary: vendor?.financialSummary || {},
    entries,
    totalCount,
  };
}

/**
 * 9. Accounts Payable Aging Report.
 */
async function getAccountsPayableAging({ organisationId, cafeId = null, asOfDate = null }) {
  const today = asOfDate || getIstBusinessDate();

  const filter = {
    organisationId,
    outstandingPayableAmountPaisa: { $gt: 0 },
  };

  if (cafeId && cafeId !== 'ORGANISATION_WIDE' && cafeId !== 'GLOBAL') {
    filter.cafeId = cafeId.trim().toUpperCase();
  }

  const invoices = await APInvoice.find(filter).lean();

  const agingBuckets = {
    current: 0,
    days1_30: 0,
    days31_60: 0,
    days61_90: 0,
    days91_180: 0,
    days180_plus: 0,
    totalOutstandingPaisa: 0,
  };

  const vendorBreakdown = {};

  const parseDaysDiff = (dueStr) => {
    if (!dueStr) return 0;
    const dueTime = new Date(dueStr).getTime();
    const curTime = new Date(today).getTime();
    return Math.floor((curTime - dueTime) / (1000 * 60 * 60 * 24));
  };

  for (const inv of invoices) {
    const outstanding = Number(inv.outstandingPayableAmountPaisa || inv.outstandingPaisa || 0);
    const daysOverdue = parseDaysDiff(inv.dueDate);
    const vId = inv.vendorId;

    if (!vendorBreakdown[vId]) {
      vendorBreakdown[vId] = {
        vendorId: vId,
        vendorName: inv.vendorName,
        current: 0,
        days1_30: 0,
        days31_60: 0,
        days61_90: 0,
        days91_180: 0,
        days180_plus: 0,
        totalOutstandingPaisa: 0,
      };
    }

    agingBuckets.totalOutstandingPaisa += outstanding;
    vendorBreakdown[vId].totalOutstandingPaisa += outstanding;

    if (daysOverdue <= 0) {
      agingBuckets.current += outstanding;
      vendorBreakdown[vId].current += outstanding;
    } else if (daysOverdue <= 30) {
      agingBuckets.days1_30 += outstanding;
      vendorBreakdown[vId].days1_30 += outstanding;
    } else if (daysOverdue <= 60) {
      agingBuckets.days31_60 += outstanding;
      vendorBreakdown[vId].days31_60 += outstanding;
    } else if (daysOverdue <= 90) {
      agingBuckets.days61_90 += outstanding;
      vendorBreakdown[vId].days61_90 += outstanding;
    } else if (daysOverdue <= 180) {
      agingBuckets.days91_180 += outstanding;
      vendorBreakdown[vId].days91_180 += outstanding;
    } else {
      agingBuckets.days180_plus += outstanding;
      vendorBreakdown[vId].days180_plus += outstanding;
    }
  }

  return {
    asOfDate: today,
    summary: agingBuckets,
    vendors: Object.values(vendorBreakdown),
  };
}

/**
 * 10. GST 180-Day Payment Risk Monitoring.
 */
async function getGst180DayMonitoring({ organisationId, asOfDate = null }) {
  const today = asOfDate || getIstBusinessDate();
  const todayTime = new Date(today).getTime();

  const invoices = await APInvoice.find({
    organisationId,
    outstandingPayableAmountPaisa: { $gt: 0 },
  }).lean();

  const flaggedInvoices = [];

  for (const inv of invoices) {
    if (!inv.invoiceDate) continue;
    const invTime = new Date(inv.invoiceDate).getTime();
    const daysSince = Math.floor((todayTime - invTime) / (1000 * 60 * 60 * 24));

    let riskCategory = 'NONE';
    let is180DayRisk = false;

    if (daysSince >= 180) {
      riskCategory = 'OVERDUE_180_DAYS';
      is180DayRisk = true;
    } else if (daysSince >= 175) {
      riskCategory = 'APPROACHING_175_DAYS';
      is180DayRisk = true;
    } else if (daysSince >= 165) {
      riskCategory = 'APPROACHING_165_DAYS';
      is180DayRisk = true;
    }

    if (is180DayRisk) {
      flaggedInvoices.push({
        invoiceId: inv.invoiceId,
        vendorId: inv.vendorId,
        vendorName: inv.vendorName,
        supplierInvoiceNumber: inv.supplierInvoiceNumber,
        invoiceDate: inv.invoiceDate,
        daysSinceInvoice: daysSince,
        totalPaisa: inv.totalPaisa,
        paidPaisa: inv.paidPaisa || 0,
        unpaidProportionPaisa: inv.outstandingPayableAmountPaisa || 0,
        riskCategory,
        complianceGuidance: 'CBIC section 16 180-day consideration review required. Flagged for Accounts/CA review.',
      });
    }
  }

  return {
    asOfDate: today,
    totalFlaggedCount: flaggedInvoices.length,
    flaggedInvoices,
  };
}

/**
 * 11. Release Payment Hold on Disputed Bill.
 */
async function releasePaymentHold({
  organisationId,
  invoiceId,
  holdCode = 'QUANTITY_VARIANCE',
  releaseReason = 'Dispute resolved with supplier',
  auth,
}) {
  const invoice = await APInvoice.findOne({
    organisationId,
    invoiceId,
  });

  if (!invoice) {
    throw new ApiError(404, 'INVOICE_NOT_FOUND', `Invoice ${invoiceId} not found.`);
  }

  const holdIdx = (invoice.holds || []).findIndex((h) => h.holdCode === holdCode);
  if (holdIdx === -1 && invoice.paymentStatus !== 'ON_HOLD') {
    throw new ApiError(400, 'NO_ACTIVE_HOLD', `No active hold with code ${holdCode} on invoice ${invoiceId}.`);
  }

  const releasedAmount = Number(invoice.heldDisputedAmountPaisa || 0);

  // Remove hold
  if (holdIdx !== -1) {
    invoice.holds.splice(holdIdx, 1);
  }
  invoice.heldDisputedAmountPaisa = 0;
  invoice.paymentStatus = invoice.outstandingPayableAmountPaisa === 0 ? 'PAID' : 'DUE';

  await invoice.save();

  const businessDate = getIstBusinessDate();
  const datePart = businessDate.replace(/-/g, '');

  const ledgerSeq = await SequenceCounter.generateId({
    organisationId,
    sequenceKey: `VLE_${datePart}`,
    prefix: `VLE-${datePart}`,
    minimumDigits: 5,
  });

  const currentBal = await getVendorRunningBalance(organisationId, invoice.vendorId);
  const vendor = await Vendor.findOne({ organisationId, vendorId: invoice.vendorId }).lean();

  const ledgerEntry = new VendorLedgerEntry({
    organisationId,
    ledgerEntryId: ledgerSeq,
    vendorId: invoice.vendorId,
    vendorNameSnapshot: vendor ? vendor.name : invoice.vendorId,
    cafeId: invoice.cafeId,
    entryDate: businessDate,
    entryTimestamp: new Date(),
    entryType: 'HOLD_RELEASE',
    referenceType: 'AP_INVOICE',
    referenceId: invoice.invoiceId,
    supplierInvoiceNumber: invoice.supplierInvoiceNumber,
    debitPaisa: 0,
    creditPaisa: 0,
    heldPaisa: 0,
    runningBalancePaisa: currentBal,
    notes: `Released hold on invoice ${invoice.invoiceId}. Reason: ${releaseReason}`.trim(),
    createdByUserId: auth.userId,
    metadata: { releasedHoldCode: holdCode, releasedAmountPaisa: releasedAmount },
  });

  await ledgerEntry.save();
  await syncVendorFinancialSummary(organisationId, invoice.vendorId);

  return {
    invoice,
    ledgerEntry,
  };
}

module.exports = {
  getVendorRunningBalance,
  syncVendorFinancialSummary,
  postVendorBillFromReceipt,
  recordVendorPayment,
  recordVendorAdvance,
  applyVendorAdvance,
  applyVendorCreditNote,
  reversePayment,
  setOpeningBalance,
  getVendorLedger,
  getAccountsPayableAging,
  getGst180DayMonitoring,
  releasePaymentHold,
};
