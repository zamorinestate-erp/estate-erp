'use strict';

/**
 * SHIFT RESOLVER SERVICE (P1)
 * Resolves the effective Shift template for a given employee on a given date.
 * - Checks PUBLISHED ShiftRoster for the week
 * - Falls back to the café's default Shift
 * - Returns null if no shift is assigned (caller must handle gracefully)
 * Never fabricates times. Never trusts frontend-supplied shift data.
 */

const { ShiftRoster } = require('../models/ShiftRoster');
const { Shift } = require('../models/Shift');

/**
 * Returns the YYYY-MM-DD for the Monday of the week containing `dateStr`.
 * ShiftRosters use Monday as weekStartDate.
 */
function getWeekStartDate(dateStr) {
  const d = new Date(dateStr + 'T00:00:00.000Z');
  const day = d.getUTCDay(); // 0=Sun, 1=Mon
  const diff = (day === 0 ? -6 : 1 - day);
  d.setUTCDate(d.getUTCDate() + diff);
  return d.toISOString().slice(0, 10);
}

/**
 * Resolves the shift for an employee on a specific business date.
 * @param {object} params
 * @param {string} params.organisationId
 * @param {string} params.userId
 * @param {string} params.cafeId
 * @param {string} params.businessDate   YYYY-MM-DD
 * @returns {object|null} Shift snapshot or null
 */
async function resolveEmployeeShiftForDate({ organisationId, userId, cafeId, businessDate }) {
  const weekStartDate = getWeekStartDate(businessDate);

  // Step 1: Look for a PUBLISHED roster for the café+week
  const roster = await ShiftRoster.findOne({
    organisationId,
    cafeId,
    weekStartDate,
    status: 'PUBLISHED',
  }).lean();

  if (roster) {
    const assignment = (roster.assignments || []).find(
      (a) => a.userId === userId && a.date === businessDate
    );

    if (assignment) {
      const templateId = assignment.shiftTemplateId || assignment.shiftId;
      const shiftDoc = templateId
        ? await Shift.findOne({
            organisationId,
            shiftId: templateId,
            isActive: true,
          }).lean()
        : null;

      return {
        shiftId: shiftDoc?.shiftId || templateId || null,
        name: shiftDoc?.name || assignment.shiftName || 'Assigned Shift',
        shiftName: shiftDoc?.name || assignment.shiftName || 'Assigned Shift',
        startTime: shiftDoc?.startTime || assignment.startTime,
        endTime: shiftDoc?.endTime || assignment.endTime,
        graceMinutes: shiftDoc?.graceMinutes ?? 15,
        cafeId,
        source: 'ROSTER',
      };
    }
  }

  // Step 2: Fallback — find default Shift for this café
  const defaultShift = await Shift.findOne({
    organisationId,
    cafeId,
    isActive: true,
    isDefault: true,
  }).lean();

  if (defaultShift) {
    return {
      shiftId: defaultShift.shiftId,
      shiftName: defaultShift.name,
      startTime: defaultShift.startTime,
      endTime: defaultShift.endTime,
      graceMinutes: defaultShift.graceMinutes ?? 15,
      cafeId,
      source: 'DEFAULT_SHIFT',
    };
  }

  // Step 3: Fallback — find any active Shift for the org (not café-specific)
  const orgDefaultShift = await Shift.findOne({
    organisationId,
    isActive: true,
    isDefault: true,
  }).lean();

  if (orgDefaultShift) {
    return {
      shiftId: orgDefaultShift.shiftId,
      shiftName: orgDefaultShift.name,
      startTime: orgDefaultShift.startTime,
      endTime: orgDefaultShift.endTime,
      graceMinutes: orgDefaultShift.graceMinutes ?? 15,
      cafeId,
      source: 'ORG_DEFAULT_SHIFT',
    };
  }

  // No shift assigned
  return null;
}

/**
 * Builds Date objects for scheduledStartAt and scheduledEndAt in IST.
 * @param {string} businessDate  YYYY-MM-DD
 * @param {string} timeStr       HH:MM (IST)
 * @returns {Date}
 */
function buildShiftDateTime(businessDate, timeStr) {
  // IST = UTC+5:30 — construct ISO string accordingly
  return new Date(`${businessDate}T${timeStr}:00+05:30`);
}

module.exports = {
  resolveEmployeeShiftForDate,
  buildShiftDateTime,
  getWeekStartDate,
};
