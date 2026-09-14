'use strict';

/**
 * PROCUREMENT ROUTES
 * Mounted at: /api/v1/procurement (registered in routes/index.js)
 */

const express = require('express');
const { authenticate } = require('../middleware/authenticate');
const { authorize } = require('../middleware/authorize');
const { attachDeviceContext } = require('../middleware/deviceContext');
const {
  listOrders,
  getOrder,
  createOrder,
  submitOrder,
  approveOrder,
  orderSent,
  receiveOrder,
  cancelOrder,
  getProcurementOverview,
  getCatalogue,
  listPurchaseRequisitions,
  createPurchaseRequisition,
  convertRequisitionToPo,
  listRfqs,
  createRfq,
  listAsns,
  getAsn,
  createAsn,
  updateAsnStatus,
  cancelAsn,
  listGoodsReceipts,
  createGoodsReceipt,
  getMatchingSummary,
  getProcurementIntegrity,
  getOrderDocuments,
  attachOrderDocument,
  downloadOrderDocument,
  getSupplierContextualIntelligence,
} = require('../controllers/procurementController');

const router = express.Router();

router.use(authenticate);
router.use(attachDeviceContext);

// Overview & Integrity
router.get(
  '/overview',
  authorize('PROCUREMENT_READ', { allowedRoles: ['MASTER', 'OWNER', 'CAFE_ADMIN'] }),
  getProcurementOverview
);

router.get(
  '/integrity',
  authorize('PROCUREMENT_READ', { allowedRoles: ['MASTER', 'OWNER'] }),
  getProcurementIntegrity
);

// Stage 05 Contextual: Supplier Intelligence in Procurement Workspace
router.get(
  '/suppliers/:vendorId/intelligence',
  authorize('PROCUREMENT_READ', { allowedRoles: ['MASTER', 'OWNER', 'CAFE_ADMIN'] }),
  getSupplierContextualIntelligence
);

// Catalogue / Guided Buying
router.get(
  '/catalogue',
  authorize('PROCUREMENT_READ', { allowedRoles: ['MASTER', 'OWNER', 'CAFE_ADMIN'] }),
  getCatalogue
);

// Requisitions / PRQs
router.get(
  '/requisitions',
  authorize('PROCUREMENT_READ', { allowedRoles: ['MASTER', 'OWNER', 'CAFE_ADMIN'] }),
  listPurchaseRequisitions
);

router.post(
  '/requisitions',
  authorize('PROCUREMENT_WRITE', { allowedRoles: ['MASTER', 'CAFE_ADMIN'] }),
  createPurchaseRequisition
);

router.post(
  '/requisitions/:requisitionId/convert-to-po',
  authorize('PROCUREMENT_WRITE', { allowedRoles: ['MASTER', 'CAFE_ADMIN'] }),
  convertRequisitionToPo
);

// Advance Shipping Notices (ASN)
router.get(
  '/asns',
  authorize('PROCUREMENT_READ', { allowedRoles: ['MASTER', 'OWNER', 'CAFE_ADMIN'] }),
  listAsns
);

router.get(
  '/asns/:asnNumber',
  authorize('PROCUREMENT_READ', { allowedRoles: ['MASTER', 'OWNER', 'CAFE_ADMIN'] }),
  getAsn
);

router.post(
  '/asns',
  authorize('PROCUREMENT_WRITE', { allowedRoles: ['MASTER', 'CAFE_ADMIN'] }),
  createAsn
);

router.post(
  '/asns/:asnNumber/status',
  authorize('PROCUREMENT_WRITE', { allowedRoles: ['MASTER', 'CAFE_ADMIN'] }),
  updateAsnStatus
);

router.post(
  '/asns/:asnNumber/cancel',
  authorize('PROCUREMENT_WRITE', { allowedRoles: ['MASTER', 'OWNER', 'CAFE_ADMIN'] }),
  cancelAsn
);

// Sourcing & RFQs
router.get(
  '/rfqs',
  authorize('PROCUREMENT_READ', { allowedRoles: ['MASTER', 'OWNER', 'CAFE_ADMIN'] }),
  listRfqs
);

router.post(
  '/rfqs',
  authorize('PROCUREMENT_WRITE', { allowedRoles: ['MASTER', 'CAFE_ADMIN'] }),
  createRfq
);

// Goods Receipts & GRNs
router.get(
  '/grns',
  authorize('PROCUREMENT_READ', { allowedRoles: ['MASTER', 'OWNER', 'CAFE_ADMIN'] }),
  listGoodsReceipts
);

router.post(
  '/grns',
  authorize('PROCUREMENT_RECEIVE', { allowedRoles: ['MASTER', 'CAFE_ADMIN'] }),
  createGoodsReceipt
);

// Invoices & 3-Way Matching
router.get(
  '/matching',
  authorize('PROCUREMENT_READ', { allowedRoles: ['MASTER', 'OWNER', 'CAFE_ADMIN'] }),
  getMatchingSummary
);

// Orders Reads: MASTER, OWNER, CAFE_ADMIN
router.get(
  '/orders',
  authorize('PROCUREMENT_READ', { allowedRoles: ['MASTER', 'OWNER', 'CAFE_ADMIN'] }),
  listOrders
);

router.get(
  '/orders/:purchaseOrderId',
  authorize('PROCUREMENT_READ', { allowedRoles: ['MASTER', 'OWNER', 'CAFE_ADMIN'] }),
  getOrder
);

// PO Document Attachments Pipeline
router.get(
  '/orders/:purchaseOrderId/documents',
  authorize('PROCUREMENT_READ', { allowedRoles: ['MASTER', 'OWNER', 'CAFE_ADMIN'] }),
  getOrderDocuments
);

router.post(
  '/orders/:purchaseOrderId/documents',
  authorize('PROCUREMENT_WRITE', { allowedRoles: ['MASTER', 'OWNER', 'CAFE_ADMIN'] }),
  attachOrderDocument
);

router.get(
  '/orders/:purchaseOrderId/documents/:documentId/download',
  authorize('PROCUREMENT_READ', { allowedRoles: ['MASTER', 'OWNER', 'CAFE_ADMIN'] }),
  downloadOrderDocument
);

// Writes: MASTER, CAFE_ADMIN
router.post(
  '/orders',
  authorize('PROCUREMENT_WRITE', { allowedRoles: ['MASTER', 'CAFE_ADMIN'] }),
  createOrder
);

router.post(
  '/orders/:purchaseOrderId/submit',
  authorize('PROCUREMENT_WRITE', { allowedRoles: ['MASTER', 'CAFE_ADMIN'] }),
  submitOrder
);

router.post(
  '/orders/:purchaseOrderId/approve',
  authorize('PROCUREMENT_APPROVE', { allowedRoles: ['MASTER', 'OWNER', 'CAFE_ADMIN'] }),
  approveOrder
);

router.post(
  '/orders/:purchaseOrderId/order',
  authorize('PROCUREMENT_WRITE', { allowedRoles: ['MASTER', 'CAFE_ADMIN'] }),
  orderSent
);

router.post(
  '/orders/:purchaseOrderId/receive',
  authorize('PROCUREMENT_RECEIVE', { allowedRoles: ['MASTER', 'CAFE_ADMIN'] }),
  receiveOrder
);

router.post(
  '/orders/:purchaseOrderId/cancel',
  authorize('PROCUREMENT_WRITE', { allowedRoles: ['MASTER', 'OWNER', 'CAFE_ADMIN'] }),
  cancelOrder
);

module.exports = router;
