'use strict';

const express = require('express');

const {
  authenticate,
} = require('../middleware/authenticate');

const {
  listCafes,
  getCafe,
  createCafe,
  updateCafe,
  changeCafeStatus,
  archiveCafe,
} = require('../controllers/cafeController');

const router = express.Router();

router.use(authenticate);

router
  .route('/')
  .get(listCafes)
  .post(createCafe);

router
  .route('/:cafeId')
  .get(getCafe)
  .patch(updateCafe);

router.patch(
  '/:cafeId/status',
  changeCafeStatus
);

router.post(
  '/:cafeId/archive',
  archiveCafe
);

module.exports = router;