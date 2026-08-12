'use strict';

/**
 * MENU ROUTES
 * Mounted at: /api/v1/menu (registered in routes/index.js)
 */

const express = require('express');
const { authenticate } = require('../middleware/authenticate');
const { authorize } = require('../middleware/authorize');
const {
  listMenuItems,
  getMenuItem,
  createMenuItem,
  updateMenuItem,
} = require('../controllers/menuController');

const router = express.Router();

router.use(authenticate);

router.get(
  '/items',
  authorize('MENU_READ', { allowedRoles: ['MASTER', 'OWNER', 'CAFE_ADMIN'] }),
  listMenuItems
);

router.get(
  '/items/:menuItemId',
  authorize('MENU_READ', { allowedRoles: ['MASTER', 'OWNER', 'CAFE_ADMIN'] }),
  getMenuItem
);

router.post(
  '/items',
  authorize('MENU_WRITE', { allowedRoles: ['MASTER'] }),
  createMenuItem
);

router.patch(
  '/:menuItemId',
  authorize('MENU_WRITE', { allowedRoles: ['MASTER'] }),
  updateMenuItem
);

module.exports = router;
