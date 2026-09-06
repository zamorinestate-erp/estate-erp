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

const {
  createSelfShiftChangeRequest,
  listSelfShiftChangeRequests,
  getMyShiftsSchedule,
  listOrgShiftChangeRequests,
  reviewShiftChangeRequest,
} = require('../controllers/shiftChangeController');

const { authenticate } = require('../middleware/authenticate');

router.use(authenticate);

// Self-service schedule & requests (must precede /:shiftId)
router.get('/me/requests', listSelfShiftChangeRequests);
router.post('/me/requests', createSelfShiftChangeRequest);
router.get('/me/schedule', getMyShiftsSchedule);

// Manager/Org shift change requests
router.get('/requests', listOrgShiftChangeRequests);
router.patch('/requests/:requestId', reviewShiftChangeRequest);

router.get('/', listShifts);
router.get('/:shiftId', getShift);
router.post('/', createShift);
router.patch('/:shiftId', updateShift);
router.patch('/:shiftId/deactivate', deactivateShift);
router.patch('/:shiftId/activate', activateShift);

module.exports = router;
