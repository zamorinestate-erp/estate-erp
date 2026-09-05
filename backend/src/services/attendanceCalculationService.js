'use strict';

/**
 * ATTENDANCE CALCULATION SERVICE
 * Authoritative, deterministic calculation engine for presence, breaks,
 * regular hours, shift-aware overtime, late arrival, and early departure.
 */

function calculateAttendanceMetrics({
  checkInAt = null,
  checkOutAt = null,
  breaks = [],
  scheduledStartAt = null,
  scheduledEndAt = null,
  scheduledDurationMinutes = null,
  gracePeriodMinutes = 15,
  approvedOvertimeMinutes = 0,
} = {}) {
  // Normalize break minutes
  let breakMinutes = 0;
  if (Array.isArray(breaks)) {
    for (const b of breaks) {
      if (typeof b.durationMinutes === 'number' && b.durationMinutes > 0) {
        breakMinutes += b.durationMinutes;
      } else if (b.startedAt && (b.endedAt || checkOutAt)) {
        const effectiveEnd = b.endedAt || checkOutAt;
        const bStart = new Date(b.startedAt).getTime();
        const bEnd = new Date(effectiveEnd).getTime();
        if (!isNaN(bStart) && !isNaN(bEnd) && bEnd > bStart) {
          const dur = Math.floor((bEnd - bStart) / 60000);
          breakMinutes += dur;
          if (!b.endedAt) {
            b.endedAt = typeof effectiveEnd === 'string' ? effectiveEnd : new Date(effectiveEnd).toISOString();
            b.durationMinutes = dur;
          }
        }
      }
    }
  }

  // Determine scheduled duration
  let scheduledMinutes = typeof scheduledDurationMinutes === 'number' && scheduledDurationMinutes > 0
    ? scheduledDurationMinutes
    : null;

  if (!scheduledMinutes && scheduledStartAt && scheduledEndAt) {
    const sStart = new Date(scheduledStartAt).getTime();
    const sEnd = new Date(scheduledEndAt).getTime();
    if (!isNaN(sStart) && !isNaN(sEnd) && sEnd > sStart) {
      scheduledMinutes = Math.floor((sEnd - sStart) / 60000);
    }
  }

  if (!scheduledMinutes || scheduledMinutes <= 0) {
    scheduledMinutes = 8 * 60; // Standard 480 minutes (8h) default
  }

  const effectiveGrace = typeof gracePeriodMinutes === 'number' && gracePeriodMinutes >= 0
    ? gracePeriodMinutes
    : 15;

  let isLate = false;
  let lateMinutes = 0;
  if (checkInAt && scheduledStartAt) {
    const inTime = new Date(checkInAt).getTime();
    const schedStart = new Date(scheduledStartAt).getTime();
    if (!isNaN(inTime) && !isNaN(schedStart)) {
      const diff = Math.floor((inTime - schedStart) / 60000);
      if (diff > effectiveGrace) {
        isLate = true;
        lateMinutes = Math.max(0, diff);
      }
    }
  }

  let isEarlyExit = false;
  let earlyDepartureMinutes = 0;
  if (checkOutAt && scheduledEndAt) {
    const outTime = new Date(checkOutAt).getTime();
    const schedEnd = new Date(scheduledEndAt).getTime();
    if (!isNaN(outTime) && !isNaN(schedEnd)) {
      const diff = Math.floor((schedEnd - outTime) / 60000);
      if (diff > effectiveGrace) {
        isEarlyExit = true;
        earlyDepartureMinutes = Math.max(0, diff);
      }
    }
  }

  if (!checkInAt || !checkOutAt) {
    return {
      grossMinutes: 0,
      breakMinutes,
      totalWorkedMinutes: 0,
      regularMinutes: 0,
      detectedOvertimeMinutes: 0,
      approvedOvertimeMinutes: Number(approvedOvertimeMinutes) || 0,
      overtimeMinutes: Number(approvedOvertimeMinutes) || 0,
      isOvertime: false,
      isLate,
      lateMinutes,
      isEarlyExit,
      earlyDepartureMinutes,
      payableMinutes: 0,
      scheduledMinutes,
    };
  }

  const inTime = new Date(checkInAt).getTime();
  const outTime = new Date(checkOutAt).getTime();

  if (isNaN(inTime) || isNaN(outTime) || outTime <= inTime) {
    return {
      grossMinutes: 0,
      breakMinutes,
      totalWorkedMinutes: 0,
      regularMinutes: 0,
      detectedOvertimeMinutes: 0,
      approvedOvertimeMinutes: Number(approvedOvertimeMinutes) || 0,
      overtimeMinutes: Number(approvedOvertimeMinutes) || 0,
      isOvertime: false,
      isLate,
      lateMinutes,
      isEarlyExit,
      earlyDepartureMinutes,
      payableMinutes: 0,
      scheduledMinutes,
    };
  }

  const grossMinutes = Math.max(0, Math.floor((outTime - inTime) / 60000));
  const totalWorkedMinutes = Math.max(0, grossMinutes - breakMinutes);
  const regularMinutes = Math.min(totalWorkedMinutes, scheduledMinutes);
  const detectedOvertimeMinutes = Math.max(0, totalWorkedMinutes - scheduledMinutes);
  const approvedOT = Number(approvedOvertimeMinutes) || 0;

  return {
    grossMinutes,
    breakMinutes,
    breaks,
    totalWorkedMinutes,
    workedMinutes: totalWorkedMinutes,
    regularMinutes,
    detectedOvertimeMinutes,
    approvedOvertimeMinutes: approvedOT,
    overtimeMinutes: approvedOT || detectedOvertimeMinutes,
    overtimeStatus: detectedOvertimeMinutes > 0 ? 'PENDING_REVIEW' : 'NONE',
    isOvertime: detectedOvertimeMinutes > 0,
    isLate,
    lateMinutes,
    isEarlyExit,
    earlyDepartureMinutes,
    payableMinutes: totalWorkedMinutes,
    scheduledMinutes,
    status: 'COMPLETED',
  };
}

module.exports = {
  calculateAttendanceMetrics,
};
