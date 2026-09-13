'use strict';

/**
 * PROCUREMENT DOCUMENT CHAIN SERVICE
 * Implements linked record navigation across:
 * Purchase Requisition -> Quotations -> Approved Quotation -> Purchase Order
 * -> Delivery Challans -> Goods Receipts (GRN) -> Supplier Invoices -> Payments -> Credit/Debit Notes
 */

const { PurchaseOrder } = require('../models/PurchaseOrder');
const { BusinessDocument } = require('../models/BusinessDocument');
const { ApiError } = require('../utils/ApiError');

class ProcurementDocumentChainService {
  /**
   * Resolves the entire document chain for a given Purchase Order ID.
   */
  static async getDocumentChain({ purchaseOrderId, organisationId, cafeId = null }) {
    const orgId = String(organisationId || '').trim().toUpperCase();
    const poId = String(purchaseOrderId || '').trim().toUpperCase();

    const po = await PurchaseOrder.findOne({
      organisationId: orgId,
      purchaseOrderId: poId,
    }).lean();

    if (!po) {
      throw new ApiError(404, 'PO_NOT_FOUND', `Purchase order ${poId} not found.`);
    }

    if (cafeId && po.cafeId !== cafeId) {
      throw new ApiError(403, 'CROSS_CAFE_DENIED', 'Unauthorized cross-café procurement document access.');
    }

    // Retrieve all attachments linked to this PO or related records
    const linkedDocuments = await BusinessDocument.find({
      organisationId: orgId,
      relatedRecordId: poId,
      isDeleted: false,
    }).select('documentId originalFilename documentType currentVersion status uploadedAt sizeBytes checksum').lean();

    // Construct the structured document chain
    const chain = {
      purchaseOrder: {
        id: po.purchaseOrderId,
        status: po.status,
        orderDate: po.orderDate,
        totalPaisa: po.totalPaisa,
        vendorId: po.vendorId,
        vendorName: po.vendorNameSnapshot,
        cafeId: po.cafeId,
      },
      upstream: {
        purchaseRequisition: po.requisitionId ? {
          id: po.requisitionId,
          type: 'PURCHASE_REQUISITION',
          status: 'CONVERTED_TO_PO',
        } : null,
        quotations: (po.quotationIds || []).map((qid) => ({
          id: qid,
          type: 'SUPPLIER_QUOTATION',
          isApproved: qid === po.approvedQuotationId,
        })),
        approvedQuotation: po.approvedQuotationId ? {
          id: po.approvedQuotationId,
          type: 'APPROVED_QUOTATION',
        } : null,
      },
      downstream: {
        deliveryChallans: (po.deliveryChallanIds || []).map((dcId) => ({
          id: dcId,
          type: 'DELIVERY_CHALLAN',
        })),
        goodsReceipts: (po.grns || []).map((g) => ({
          id: g.grnId,
          type: 'GOODS_RECEIPT_NOTE',
          deliveryNoteNumber: g.deliveryNoteNumber,
          receivedAt: g.receivedAt,
          receivedBy: g.receivedByUserId,
          status: g.status,
          itemCount: (g.items || []).length,
        })),
        supplierInvoices: (po.invoices || []).map((inv) => ({
          id: inv.invoiceId,
          invoiceNumber: inv.invoiceNumber,
          invoiceDate: inv.invoiceDate,
          totalPaisa: inv.totalPaisa,
          status: inv.status,
          irn: inv.irn || null,
        })),
        threeWayMatch: po.threeWayMatch ? {
          status: po.threeWayMatch.matchStatus || 'PENDING',
          matchedAt: po.threeWayMatch.matchedAt,
          matchedBy: po.threeWayMatch.matchedByUserId,
          priceVariancePaisa: po.threeWayMatch.priceVariancePaisa || 0,
          quantityVarianceBase: po.threeWayMatch.quantityVarianceBase || 0,
          isExceptionApproved: Boolean(po.threeWayMatch.isExceptionApproved),
          exceptionReason: po.threeWayMatch.exceptionReason || null,
        } : null,
        payments: (po.paymentIds || []).map((payId) => ({
          id: payId,
          type: 'PAYMENT_RECORD',
        })),
        creditDebitNotes: (po.creditDebitNoteIds || []).map((cdnId) => ({
          id: cdnId,
          type: 'CREDIT_DEBIT_NOTE',
        })),
      },
      attachments: linkedDocuments.map((d) => ({
        documentId: d.documentId,
        filename: d.originalFilename,
        type: d.documentType,
        version: d.currentVersion,
        status: d.status,
        sizeBytes: d.sizeBytes,
        uploadedAt: d.uploadedAt,
      })),
    };

    return {
      success: true,
      data: chain,
    };
  }
}

module.exports = {
  ProcurementDocumentChainService,
};
