'use strict';

const express = require('express');
const router = express.Router();

const {
  listShifts,
  getShift,
  createShift,
  updateShift,
  deactivateShift,
  activateShift,
} = require('../controllers/shiftController');

const { authenticate } = require('../middleware/authenticate');

router.use(authenticate);

router.get('/', listShifts);
router.get('/:shiftId', getShift);
router.post('/', createShift);
router.patch('/:shiftId', updateShift);
router.patch('/:shiftId/deactivate', deactivateShift);
router.patch('/:shiftId/activate', activateShift);

module.exports = router;
