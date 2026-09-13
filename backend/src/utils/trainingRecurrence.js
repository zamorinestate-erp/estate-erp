'use strict';

/**
 * ============================================================================
 * ZAMORIN CAFÉ ERP — TRAINING RECURRENCE ENGINE (R02B-03)
 * ============================================================================
 * Canonical recurrence engine for statutory and operational employee training.
 * Enforces explicit recurrence policies, calendar-month addition with month-end
 * clamping, leap-year safety, and unified overdue status determination.
 */

const TRAINING_RECURRENCE_POLICIES = Object.freeze({
  QUARTERLY: {
    frequency: 'QUARTERLY',
    recurrenceMode: 'CALENDAR_MONTHS',
    recurrenceInterval: 3,
    description: 'Every 3 calendar months, clamped to month-end',
  },
  ANNUAL: {
    frequency: 'ANNUAL',
    recurrenceMode: 'CALENDAR_MONTHS',
    recurrenceInterval: 12,
    description: 'Every 12 calendar months',
  },
  BI_ANNUAL: {
    frequency: 'BI_ANNUAL',
    recurrenceMode: 'CALENDAR_MONTHS',
    recurrenceInterval: 6,
    description: 'Every 6 calendar months',
  },
  ONE_TIME: {
    frequency: 'ONE_TIME',
    recurrenceMode: 'NONE',
    recurrenceInterval: 0,
    description: 'Non-recurring single session',
  },
});

/**
 * Adds calendar months to a given date safely, clamping day-of-month to the target
 * month's last valid day (e.g. Jan 31 + 3 months -> Apr 30; Nov 30 + 3 months -> Feb 28 or Feb 29 in leap year).
 *
 * @param {Date|string} inputDate - Base session or due date (Date object or YYYY-MM-DD string)
 * @param {number} monthsToAdd - Number of calendar months to advance (default 3)
 * @returns {Date} Resulting Date object
 */
function addCalendarMonthsClamped(inputDate, monthsToAdd = 3) {
  const d = typeof inputDate === 'string' ? new Date(inputDate) : new Date(inputDate);
  if (isNaN(d.getTime())) {
    throw new Error(`Invalid input date for recurrence calculation: ${inputDate}`);
  }

  const origYear = d.getFullYear();
  const origMonth = d.getMonth(); // 0-indexed
  const origDay = d.getDate();

  const targetMonthIndex = origMonth + monthsToAdd;
  const targetYear = origYear + Math.floor(targetMonthIndex / 12);
  const targetMonth = ((targetMonthIndex % 12) + 12) % 12;

  // Find max days in target month
  // Day 0 of targetMonth + 1 gives the last day of targetMonth
  const maxDaysInTargetMonth = new Date(targetYear, targetMonth + 1, 0).getDate();
  const clampedDay = Math.min(origDay, maxDaysInTargetMonth);

  const result = new Date(targetYear, targetMonth, clampedDay, d.getHours(), d.getMinutes(), d.getSeconds(), d.getMilliseconds());
  return result;
}

/**
 * Calculates the next quarterly due date string (YYYY-MM-DD) according to explicit
 * quarterly calendar policy (sessionDate + 3 calendar months).
 *
 * @param {Date|string} sessionDate - Date the training was completed or base scheduled date
 * @param {object} options - Policy options
 * @returns {string} Next due date formatted as YYYY-MM-DD
 */
function calculateNextQuarterlyDueDate(sessionDate, options = {}) {
  const recurrenceInterval = options.recurrenceInterval !== undefined ? options.recurrenceInterval : 3;
  const nextDate = addCalendarMonthsClamped(sessionDate, recurrenceInterval);
  return nextDate.toISOString().slice(0, 10);
}

/**
 * Determines whether a training record is overdue relative to an evaluation date.
 *
 * @param {string|Date} dueDate - The training due date (YYYY-MM-DD or Date)
 * @param {string|Date} asOfDate - The reference date (defaults to current date)
 * @returns {boolean} True if asOfDate is strictly past dueDate
 */
function isTrainingOverdue(dueDate, asOfDate = new Date()) {
  if (!dueDate) return false;
  const dueStr = typeof dueDate === 'string' ? dueDate.slice(0, 10) : new Date(dueDate).toISOString().slice(0, 10);
  const asOfStr = typeof asOfDate === 'string' ? asOfDate.slice(0, 10) : new Date(asOfDate).toISOString().slice(0, 10);
  return asOfStr > dueStr;
}

module.exports = {
  TRAINING_RECURRENCE_POLICIES,
  addCalendarMonthsClamped,
  calculateNextQuarterlyDueDate,
  isTrainingOverdue,
};
