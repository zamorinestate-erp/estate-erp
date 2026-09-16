'use strict';

const express = require('express');
const { authenticate } = require('../middleware/authenticate');
const { authorize } = require('../middleware/authorize');

const {
  getVendorLedger,
  getVendorStatement,
  setOpeningBalance,
  postBillFromPo,
  getApQueue,
  recordPayment,
  reversePayment,
  recordAdvance,
  applyAdvance,
  applyCreditNote,
  releasePaymentHold,
  getApAgingReport,
  getGstMonitoringReport,
} = require('../controllers/vendorLedgerController');

const router = express.Router();

router.use(authenticate);

// 1. Vendor Ledger Queries & Statements
router.get(
  '/vendors/:vendorId',
  authorize('FINANCE:READ', { allowedRoles: ['MASTER', 'OWNER', 'CAFE_ADMIN'] }),
  getVendorLedger
);

router.get(
  '/vendors/:vendorId/statement',
  authorize('FINANCE:READ', { allowedRoles: ['MASTER', 'OWNER', 'CAFE_ADMIN'] }),
  getVendorStatement
);

router.post(
  '/vendors/:vendorId/opening-balance',
  authorize('FINANCE:ADMIN', { allowedRoles: ['MASTER'] }),
  setOpeningBalance
);

// 2. AP Handoff from PO / GRN
router.post(
  '/bills/from-po/:purchaseOrderId',
  authorize('FINANCE:WRITE', { allowedRoles: ['MASTER', 'CAFE_ADMIN'] }),
  postBillFromPo
);

// 3. AP Work Queue
router.get(
  '/ap/queue',
  authorize('FINANCE:READ', { allowedRoles: ['MASTER', 'OWNER', 'CAFE_ADMIN'] }),
  getApQueue
);

// 4. Payments, Partial Payments & Reversals
router.post(
  '/payments',
  authorize('FINANCE:POST', { allowedRoles: ['MASTER'] }),
  recordPayment
);

router.post(
  '/payments/:paymentId/reverse',
  authorize('FINANCE:POST', { allowedRoles: ['MASTER'] }),
  reversePayment
);

// 5. Advances & Credit Notes
router.post(
  '/advances',
  authorize('FINANCE:POST', { allowedRoles: ['MASTER'] }),
  recordAdvance
);

router.post(
  '/advances/apply',
  authorize('FINANCE:POST', { allowedRoles: ['MASTER'] }),
  applyAdvance
);

router.post(
  '/credits/apply',
  authorize('FINANCE:WRITE', { allowedRoles: ['MASTER', 'CAFE_ADMIN'] }),
  applyCreditNote
);

// 6. Payment Holds
router.post(
  '/bills/:invoiceId/holds/release',
  authorize('FINANCE:POST', { allowedRoles: ['MASTER'] }),
  releasePaymentHold
);

// 7. AP Aging & GST 180-Day Monitoring
router.get(
  '/reports/aging',
  authorize('FINANCE:READ', { allowedRoles: ['MASTER', 'OWNER', 'CAFE_ADMIN'] }),
  getApAgingReport
);

router.get(
  '/reports/gst-180-days',
  authorize('FINANCE:READ', { allowedRoles: ['MASTER', 'OWNER'] }),
  getGstMonitoringReport
);

module.exports = router;
