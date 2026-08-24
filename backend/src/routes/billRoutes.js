'use strict';

/**
 * BILL ROUTES (SCREEN 005)
 * Mounted at: /api/v1/bills (registered in routes/index.js)
 */

const express = require('express');
const { authenticate } = require('../middleware/authenticate');
const { authorize } = require('../middleware/authorize');
const {
  getBillsOverview,
  listBills,
  getBill,
  createBill,
  reprintBill,
  voidBill,
  refundBill,
  getGstRegister,
  getReconciliationStatus,
  closeBusinessDayBilling,
  getPastOrdersSummary,
  getSalesCalendar,
  holdBill,
  listOpenTickets,
  openRegisterSession,
  recordCashEvent,
  closeRegisterSession,
  getRegisterSession,
  splitBill,
} = require('../controllers/billController');

const router = express.Router();

router.use(authenticate);

// Overview & Registers
router.get('/overview', getBillsOverview);
router.get('/tax/gst-register', getGstRegister);
router.get('/reconciliation/status', getReconciliationStatus);
router.post('/eod/close', closeBusinessDayBilling);

// History, Stats & Calendar
router.get('/history/stats', getPastOrdersSummary);
router.get('/history/calendar', getSalesCalendar);

// Open Tickets & Holds
router.get('/tickets/open', listOpenTickets);
router.post('/tickets/hold', holdBill);

// Register Session & Cash Drawer
router.get('/register/session/current', getRegisterSession);
router.post('/register/session/open', openRegisterSession);
router.post('/register/session/event', recordCashEvent);
router.post('/register/session/close', closeRegisterSession);

// Bill Listing & Detail
router.get('/', listBills);
router.get('/:billId', getBill);

// POS Sale Creation & Settlement
router.post('/', createBill);
router.post('/:billId/split', splitBill);

// Post-Sale Adjustments
router.post('/:billId/reprint', reprintBill);
router.post('/:billId/void', authorize('POS_VOID', { allowedRoles: ['MASTER', 'OWNER'] }), voidBill);
router.post('/:billId/refund', refundBill);

module.exports = router;
