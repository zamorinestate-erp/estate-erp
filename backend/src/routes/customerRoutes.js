'use strict';

/**
 * CUSTOMER & LOYALTY ROUTES (SCREEN 006)
 * Mounted at: /api/v1/customers (registered in routes/index.js)
 */

const express = require('express');
const { authenticate } = require('../middleware/authenticate');
const { authorize } = require('../middleware/authorize');
const {
  getCustomersOverview,
  listCustomers,
  getCustomer,
  createCustomer,
  adjustCustomerPoints,
  mergeCustomers,
  getRewardCatalogue,
  listCustomerFeedback,
  createFeedback,
  getProgrammeStatus,
  publishProgrammeVersion,
  getIntegrityStatus,
} = require('../controllers/customerController');

const router = express.Router();

router.use(authenticate);

// Overview & Catalogs
router.get('/overview', authorize('CUSTOMERS_READ', { allowedRoles: ['MASTER', 'OWNER', 'CAFE_ADMIN'] }), getCustomersOverview);
router.get('/rewards/catalogue', authorize('CUSTOMERS_READ', { allowedRoles: ['MASTER', 'OWNER', 'CAFE_ADMIN'] }), getRewardCatalogue);
router.get('/programme/current', authorize('CUSTOMERS_READ', { allowedRoles: ['MASTER', 'OWNER', 'CAFE_ADMIN'] }), getProgrammeStatus);
router.post('/programme/publish', authorize('CUSTOMERS_WRITE', { allowedRoles: ['MASTER', 'CAFE_ADMIN'] }), publishProgrammeVersion);
router.get('/integrity/status', authorize('CUSTOMERS_READ', { allowedRoles: ['MASTER', 'OWNER', 'CAFE_ADMIN'] }), getIntegrityStatus);
router.get('/feedback', authorize('CUSTOMERS_READ', { allowedRoles: ['MASTER', 'OWNER', 'CAFE_ADMIN'] }), listCustomerFeedback);
router.post('/feedback', authorize('CUSTOMERS_WRITE', { allowedRoles: ['MASTER', 'CAFE_ADMIN'] }), createFeedback);

// Customer Directory CRUD & Actions
router.get('/', authorize('CUSTOMERS_READ', { allowedRoles: ['MASTER', 'OWNER', 'CAFE_ADMIN'] }), listCustomers);
router.post('/', authorize('CUSTOMERS_WRITE', { allowedRoles: ['MASTER', 'CAFE_ADMIN'] }), createCustomer);
router.post('/merge', authorize('CUSTOMERS_WRITE', { allowedRoles: ['MASTER', 'CAFE_ADMIN'] }), mergeCustomers);
router.get('/:customerId', authorize('CUSTOMERS_READ', { allowedRoles: ['MASTER', 'OWNER', 'CAFE_ADMIN'] }), getCustomer);
router.post('/:customerId/loyalty/adjust', authorize('CUSTOMERS_WRITE', { allowedRoles: ['MASTER', 'CAFE_ADMIN'] }), adjustCustomerPoints);

module.exports = router;
