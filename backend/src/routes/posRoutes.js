'use strict';

/**
 * POS ROUTES (SCREEN 005 / PRIMARY MASTER PROGRAMME STAGE 06)
 * Mounted at: /api/v1/pos
 */

const express = require('express');
const { authenticate } = require('../middleware/authenticate');
const { attachDeviceContext } = require('../middleware/deviceContext');
const {
  commitOrder,
  previewOrder,
  printOrder,
  reprintOrder,
  getActiveOrders,
  getLastCommittedBill,
} = require('../controllers/posController');

const router = express.Router();

router.use(authenticate);
router.use(attachDeviceContext);

// POS Order pipeline actions
router.post('/orders/commit', commitOrder);
router.post('/orders/preview', previewOrder);
router.post('/orders/:billId/print', printOrder);
router.post('/orders/:billId/reprint', reprintOrder);
router.get('/orders/active/:cafeId', getActiveOrders);
router.get('/orders/last/:cafeId', getLastCommittedBill);

module.exports = router;
