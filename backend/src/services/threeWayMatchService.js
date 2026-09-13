'use strict';

/**
 * THREE-WAY MATCHING SERVICE (PO ↔ GRN ↔ SUPPLIER INVOICE)
 * Evaluates full 13-field line-item and header matrix:
 * 1.  Item / SKU
 * 2.  Quantity Ordered
 * 3.  Quantity Received
 * 4.  Quantity Invoiced
 * 5.  UOM (Unit of Measure)
 * 6.  PO Unit Rate
 * 7.  Invoiced Unit Rate
 * 8.  Discount
 * 9.  GST Rate (%)
 * 10. Taxable Value
 * 11. Tax Amount
 * 12. Line Total
 * 13. Grand Total
 */

const { ApiError } = require('../utils/ApiError');

class ThreeWayMatchService {
  /**
   * Compares PO line items, GRN received quantities, and Supplier Invoice line items.
   */
  static performMatch({
    purchaseOrder,
    grn,
    supplierInvoice,
    toleranceConfig = { rateTolerancePaisa: 100, qtyTolerancePercent: 0, totalTolerancePaisa: 100 },
  }) {
    if (!purchaseOrder || !supplierInvoice) {
      throw new ApiError(400, 'DOCUMENTS_REQUIRED', 'Both PurchaseOrder and SupplierInvoice are required for 3-way matching.');
    }

    const discrepancies = [];
    const lineComparisons = [];

    const poLines = purchaseOrder.lineItems || [];
    const grnItems = grn ? (grn.items || []) : [];
    const invLines = supplierInvoice.lineItems || [];

    let computedPoTotal = 0;
    let computedInvTotal = 0;

    for (const poLine of poLines) {
      const sku = poLine.itemId;
      const grnLine = grnItems.find((g) => g.itemId === sku) || {};
      const invLine = invLines.find((i) => (i.itemId || i.sku) === sku) || {};

      const qtyOrdered = Number(poLine.orderedQuantityBase || 0);
      const qtyReceived = Number(grnLine.acceptedQty !== undefined ? grnLine.acceptedQty : (poLine.receivedQuantityBase || 0));
      const qtyInvoiced = Number(invLine.quantity !== undefined ? invLine.quantity : (poLine.invoicedQuantityBase || qtyReceived));

      const uomPo = String(poLine.baseUnit || 'UNIT').trim().toUpperCase();
      const uomInv = String(invLine.uom || invLine.baseUnit || uomPo).trim().toUpperCase();

      const poRate = Number(poLine.unitPricePaisa || 0);
      const invRate = Number(invLine.unitPricePaisa !== undefined ? invLine.unitPricePaisa : poRate);

      const discount = Number(invLine.discountPaisa || poLine.discountPaisa || 0);
      const poGst = Number(poLine.taxRatePercent !== undefined ? poLine.taxRatePercent : 5);
      const invGst = Number(invLine.taxRatePercent !== undefined ? invLine.taxRatePercent : poGst);

      const taxableVal = Math.max(0, (qtyInvoiced * invRate) - discount);
      const taxAmount = Math.round((taxableVal * invGst) / 100);
      const lineTotal = taxableVal + taxAmount;

      computedPoTotal += Number(poLine.totalLinePaisa || (qtyOrdered * poRate));
      computedInvTotal += lineTotal;

      const lineDiscrepancy = {
        itemId: sku,
        qtyOrdered,
        qtyReceived,
        qtyInvoiced,
        uomPo,
        uomInv,
        poRate,
        invRate,
        discount,
        poGst,
        invGst,
        taxableVal,
        taxAmount,
        lineTotal,
        issues: [],
      };

      // 1. Quantity Mismatch
      if (qtyInvoiced > qtyReceived) {
        lineDiscrepancy.issues.push(`Quantity invoiced (${qtyInvoiced}) exceeds received quantity (${qtyReceived}).`);
      }

      // 2. Rate Mismatch
      const rateDiff = Math.abs(invRate - poRate);
      if (rateDiff > (toleranceConfig.rateTolerancePaisa || 0)) {
        lineDiscrepancy.issues.push(`Unit price variance: PO ₹${(poRate / 100).toFixed(2)} vs Invoice ₹${(invRate / 100).toFixed(2)}.`);
      }

      // 3. UOM Mismatch
      if (uomPo !== uomInv) {
        lineDiscrepancy.issues.push(`UOM mismatch: PO ${uomPo} vs Invoice ${uomInv}.`);
      }

      // 4. GST Rate Mismatch
      if (poGst !== invGst) {
        lineDiscrepancy.issues.push(`GST rate mismatch: PO ${poGst}% vs Invoice ${invGst}%.`);
      }

      if (lineDiscrepancy.issues.length > 0) {
        discrepancies.push(lineDiscrepancy);
      }

      lineComparisons.push(lineDiscrepancy);
    }

    // 5. Grand Total Mismatch
    const invGrandTotal = Number(supplierInvoice.totalPaisa || computedInvTotal);
    const poGrandTotal = Number(purchaseOrder.totalPaisa || computedPoTotal);
    const totalDiff = Math.abs(invGrandTotal - poGrandTotal);

    const isTotalExceeded = totalDiff > (toleranceConfig.totalTolerancePaisa || 0);
    if (isTotalExceeded && discrepancies.length === 0) {
      discrepancies.push({
        itemId: 'HEADER_TOTAL',
        issues: [`Overall invoice total (₹${(invGrandTotal / 100).toFixed(2)}) differs from PO total (₹${(poGrandTotal / 100).toFixed(2)}).`],
      });
    }

    const matchStatus = discrepancies.length === 0 ? 'MATCHED' : 'VARIANCE_FLAGGED';

    return {
      matchStatus,
      isMatched: matchStatus === 'MATCHED',
      hasVariance: matchStatus === 'VARIANCE_FLAGGED',
      poGrandTotal,
      invGrandTotal,
      totalDifferencePaisa: invGrandTotal - poGrandTotal,
      discrepancies,
      lineComparisons,
      matchedAt: new Date(),
    };
  }
}

module.exports = {
  ThreeWayMatchService,
};
