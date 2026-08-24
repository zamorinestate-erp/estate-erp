'use strict';

const express = require('express');
const { authenticate } = require('../middleware/authenticate');
const { authorize } = require('../middleware/authorize');

const {
  getInventoryOverview,
  listGlobalItems,
  getItem,
  createGlobalItem,
  updateGlobalItem,
  archiveItem,
  listCafeStock,
  getCafeStockItem,
  configureCafeStock,
  recordMovement,
  listMovements,
  receiveStock,
  listTransfers,
  createTransfer,
  dispatchTransfer,
  receiveTransfer,
  listLots,
  getExpirySchedule,
  listRecalls,
  createRecall,
  getReplenishmentRecommendations,
  listCycleCounts,
  submitCycleCount,
  approveCycleCount,
  recordWastage,
  getInventoryIntegrity,
  listReservations,
  createReservation,
  releaseReservation,
  recordInternalLocationTransfer,
  getItem360,
  getConsumptionRecipeVariance,
  getInventoryValuationReport,
} = require('../controllers/inventoryController');

const router = express.Router();

router.use(authenticate);

// 1. Overview & Multi-Café Command Centre
router.get(
  '/overview',
  authorize('INVENTORY_READ', { allowedRoles: ['MASTER', 'OWNER', 'CAFE_ADMIN'] }),
  getInventoryOverview
);

// 2. Global Item Master
router.get(
  '/items',
  authorize('INVENTORY_READ', { allowedRoles: ['MASTER', 'OWNER', 'CAFE_ADMIN'] }),
  listGlobalItems
);

router.get(
  '/items/:itemId',
  authorize('INVENTORY_READ', { allowedRoles: ['MASTER', 'OWNER', 'CAFE_ADMIN'] }),
  getItem
);

router.post(
  '/items',
  authorize('INVENTORY_WRITE', { allowedRoles: ['MASTER'] }),
  createGlobalItem
);

router.patch(
  '/items/:itemId',
  authorize('INVENTORY_WRITE', { allowedRoles: ['MASTER'] }),
  updateGlobalItem
);

router.post(
  '/items/:itemId/archive',
  authorize('INVENTORY_WRITE', { allowedRoles: ['MASTER'] }),
  archiveItem
);

// 3. Café Stock Management
router.get(
  '/cafes/:cafeId/stock',
  authorize('INVENTORY_READ', { allowedRoles: ['MASTER', 'OWNER', 'CAFE_ADMIN'] }),
  listCafeStock
);

router.get(
  '/cafes/:cafeId/stock/:itemId',
  authorize('INVENTORY_READ', { allowedRoles: ['MASTER', 'OWNER', 'CAFE_ADMIN'] }),
  getCafeStockItem
);

router.patch(
  '/cafes/:cafeId/stock/:itemId/configure',
  authorize('INVENTORY_WRITE', { allowedRoles: ['MASTER', 'CAFE_ADMIN'] }),
  configureCafeStock
);

// 4. Stock Movement Ledger & Mutations
router.post(
  '/movements',
  authorize('INVENTORY_WRITE', { allowedRoles: ['MASTER', 'CAFE_ADMIN'] }),
  recordMovement
);

router.get(
  '/movements',
  authorize('INVENTORY_READ', { allowedRoles: ['MASTER', 'OWNER', 'CAFE_ADMIN'] }),
  listMovements
);

router.post(
  '/receipts',
  authorize('INVENTORY_WRITE', { allowedRoles: ['MASTER', 'CAFE_ADMIN'] }),
  receiveStock
);

// 5. Inter-Café Transfers
router.get(
  '/transfers',
  authorize('INVENTORY_READ', { allowedRoles: ['MASTER', 'OWNER', 'CAFE_ADMIN'] }),
  listTransfers
);

router.post(
  '/transfers',
  authorize('INVENTORY_WRITE', { allowedRoles: ['MASTER', 'CAFE_ADMIN'] }),
  createTransfer
);

router.post(
  '/transfers/:transferId/dispatch',
  authorize('INVENTORY_WRITE', { allowedRoles: ['MASTER', 'CAFE_ADMIN'] }),
  dispatchTransfer
);

router.post(
  '/transfers/:transferId/receive',
  authorize('INVENTORY_WRITE', { allowedRoles: ['MASTER', 'CAFE_ADMIN'] }),
  receiveTransfer
);

// 6. Lots, Expiry & FEFO
router.get(
  '/lots',
  authorize('INVENTORY_READ', { allowedRoles: ['MASTER', 'OWNER', 'CAFE_ADMIN'] }),
  listLots
);

router.get(
  '/expiry-schedule',
  authorize('INVENTORY_READ', { allowedRoles: ['MASTER', 'OWNER', 'CAFE_ADMIN'] }),
  getExpirySchedule
);

// 7. Recall & Traceability
router.get(
  '/recalls',
  authorize('INVENTORY_READ', { allowedRoles: ['MASTER', 'OWNER', 'CAFE_ADMIN'] }),
  listRecalls
);

router.post(
  '/recalls',
  authorize('INVENTORY_ADMIN', { allowedRoles: ['MASTER'] }),
  createRecall
);

// 8. Replenishment & PAR
router.get(
  '/replenishment/recommendations',
  authorize('INVENTORY_READ', { allowedRoles: ['MASTER', 'OWNER', 'CAFE_ADMIN'] }),
  getReplenishmentRecommendations
);

// 9. Cycle Counts & Stocktake
router.get(
  '/counts',
  authorize('INVENTORY_READ', { allowedRoles: ['MASTER', 'OWNER', 'CAFE_ADMIN'] }),
  listCycleCounts
);

router.get(
  '/cycle-counts',
  authorize('INVENTORY_READ', { allowedRoles: ['MASTER', 'OWNER', 'CAFE_ADMIN'] }),
  listCycleCounts
);

router.post(
  '/counts',
  authorize('INVENTORY_WRITE', { allowedRoles: ['MASTER', 'CAFE_ADMIN'] }),
  submitCycleCount
);

router.post(
  '/cycle-counts',
  authorize('INVENTORY_WRITE', { allowedRoles: ['MASTER', 'CAFE_ADMIN'] }),
  submitCycleCount
);

router.post(
  '/counts/:countId/approve',
  authorize('INVENTORY_WRITE', { allowedRoles: ['MASTER'] }),
  approveCycleCount
);

router.post(
  '/cycle-counts/:countId/approve',
  authorize('INVENTORY_WRITE', { allowedRoles: ['MASTER'] }),
  approveCycleCount
);

// 10. Wastage & Adjustments
router.post(
  '/wastage',
  authorize('INVENTORY_WRITE', { allowedRoles: ['MASTER', 'CAFE_ADMIN'] }),
  recordWastage
);

// 11. Inventory Reservations (Stages 151-158)
router.get(
  '/reservations',
  authorize('INVENTORY_READ', { allowedRoles: ['MASTER', 'OWNER', 'CAFE_ADMIN'] }),
  listReservations
);

router.post(
  '/reservations',
  authorize('INVENTORY_WRITE', { allowedRoles: ['MASTER', 'CAFE_ADMIN'] }),
  createReservation
);

router.post(
  '/reservations/:reservationId/release',
  authorize('INVENTORY_WRITE', { allowedRoles: ['MASTER', 'CAFE_ADMIN'] }),
  releaseReservation
);

// 12. Internal Location Transfers (Stages 076-084)
router.post(
  '/internal-transfers',
  authorize('INVENTORY_WRITE', { allowedRoles: ['MASTER', 'CAFE_ADMIN'] }),
  recordInternalLocationTransfer
);

// 13. Item 360 Drilldown (Stages 268-270)
router.get(
  '/items/:itemId/360',
  authorize('INVENTORY_READ', { allowedRoles: ['MASTER', 'OWNER', 'CAFE_ADMIN'] }),
  getItem360
);

// 14. Consumption & Recipe Variance (Stages 162-166)
router.get(
  '/consumption/variance',
  authorize('INVENTORY_READ', { allowedRoles: ['MASTER', 'OWNER', 'CAFE_ADMIN'] }),
  getConsumptionRecipeVariance
);

router.get(
  '/reports/recipe-variance',
  authorize('INVENTORY_READ', { allowedRoles: ['MASTER', 'OWNER', 'CAFE_ADMIN'] }),
  getConsumptionRecipeVariance
);

// 15. Inventory Valuation Report (Stages 213-217, 278-291)
router.get(
  '/reports/valuation',
  authorize('INVENTORY_READ', { allowedRoles: ['MASTER', 'OWNER', 'CAFE_ADMIN'] }),
  getInventoryValuationReport
);

// 16. Inventory Integrity Audit
router.get(
  '/integrity',
  authorize('INVENTORY_READ', { allowedRoles: ['MASTER', 'OWNER'] }),
  getInventoryIntegrity
);

module.exports = router;
