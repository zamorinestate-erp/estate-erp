'use strict';

const express = require('express');
const router = express.Router();

const {
  listHolidays,
  getHoliday,
  createHoliday,
  updateHoliday,
  deleteHoliday,
} = require('../controllers/holidayController');

const { authenticate } = require('../middleware/authenticate');

router.use(authenticate);

router.get('/', listHolidays);
router.get('/:holidayId', getHoliday);
router.post('/', createHoliday);
router.patch('/:holidayId', updateHoliday);
router.delete('/:holidayId', deleteHoliday);

module.exports = router;
