'use strict';

/**
 * INVENTORY ROUTES
 *
 * Mounted at: /api/v1/inventory (registered in routes/index.js)
 *
 * Permission model:
 *   Global item management: MASTER ONLY
 *   Café stock reads:       MASTER + CAFE_ADMIN (assigned café)
 *   Café stock configure:   MASTER + CAFE_ADMIN (assigned café)
 *   Stock movement record:  MASTER + CAFE_ADMIN (assigned café)
 *
 * The inventoryController's assertCafeAccess() provides the per-request
 * café scope enforcement as the data layer (third layer of the
 * three-layer permission model).
 */

const express = require('express');
const { authenticate } = require('../middleware/authenticate');
const { authorize } = require('../middleware/authorize');
const {
  listItems,
  getItem,
  createItem,
  updateItem,
  archiveItem,
  listCafeStock,
  getCafeStockItem,
  configureCafeStock,
  recordMovement,
  listMovements,
  getReorderAlerts,
} = require('../controllers/inventoryController');

const router = express.Router();

// All inventory routes require an authenticated session.
router.use(authenticate);

// ═══════════════════════════════════════════════════════════════════════════════
// GLOBAL INVENTORY ITEMS — MASTER ONLY
// ═══════════════════════════════════════════════════════════════════════════════

// List items
router.get(
  '/items',
  authorize('INVENTORY_READ', { allowedRoles: ['MASTER', 'OWNER', 'CAFE_ADMIN'] }),
  listItems
);

// Single item
router.get(
  '/items/:itemId',
  authorize('INVENTORY_READ', { allowedRoles: ['MASTER', 'OWNER', 'CAFE_ADMIN'] }),
  getItem
);

// Create item (MASTER ONLY — propagates to all cafés)
router.post(
  '/items',
  authorize('INVENTORY_WRITE', { allowedRoles: ['MASTER'] }),
  createItem
);

// Update item fields
router.patch(
  '/items/:itemId',
  authorize('INVENTORY_WRITE', { allowedRoles: ['MASTER'] }),
  updateItem
);

// Archive item
router.post(
  '/items/:itemId/archive',
  authorize('INVENTORY_WRITE', { allowedRoles: ['MASTER'] }),
  archiveItem
);

// ═══════════════════════════════════════════════════════════════════════════════
// CAFÉ STOCK — MASTER + CAFE_ADMIN (controller enforces café scope)
// ═══════════════════════════════════════════════════════════════════════════════

// List all stock for a café
router.get(
  '/cafes/:cafeId/stock',
  authorize('INVENTORY_READ', { allowedRoles: ['MASTER', 'OWNER', 'CAFE_ADMIN'] }),
  listCafeStock
);

// Single item stock at a café
router.get(
  '/cafes/:cafeId/stock/:itemId',
  authorize('INVENTORY_READ', { allowedRoles: ['MASTER', 'OWNER', 'CAFE_ADMIN'] }),
  getCafeStockItem
);

// Update thresholds / vendor / availability for a café+item
router.patch(
  '/cafes/:cafeId/stock/:itemId/configure',
  authorize('INVENTORY_WRITE', { allowedRoles: ['MASTER', 'CAFE_ADMIN'] }),
  configureCafeStock
);

// ═══════════════════════════════════════════════════════════════════════════════
// STOCK MOVEMENTS — MASTER + CAFE_ADMIN (controller enforces café scope)
// ═══════════════════════════════════════════════════════════════════════════════

// Record a movement
router.post(
  '/cafes/:cafeId/movements',
  authorize('INVENTORY_WRITE', { allowedRoles: ['MASTER', 'CAFE_ADMIN'] }),
  recordMovement
);

// List movements for a café
router.get(
  '/cafes/:cafeId/movements',
  authorize('INVENTORY_READ', { allowedRoles: ['MASTER', 'OWNER', 'CAFE_ADMIN'] }),
  listMovements
);

// ═══════════════════════════════════════════════════════════════════════════════
// REORDER ALERTS
// ═══════════════════════════════════════════════════════════════════════════════

router.get(
  '/cafes/:cafeId/reorder-alerts',
  authorize('INVENTORY_READ', { allowedRoles: ['MASTER', 'OWNER', 'CAFE_ADMIN'] }),
  getReorderAlerts
);

module.exports = router;
