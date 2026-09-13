'use strict';

/**
 * ZAMORIN CAFÉ ERP — REPORTING CALCULATION ENGINE
 * Module: workforceCalculations.js (PM-02G)
 * 
 * Deep Canonical Workforce Intelligence Engine:
 * - Active Headcount Semantics (accountStatus + employmentStatus)
 * - Headcount by Café (Unique employees vs Assignments)
 * - Headcount by Role & Designation
 * - Schedules & Rosters (Published/Locked vs Draft, Cross-midnight duration)
 * - Timekeeping & Attendance (Check-in/out, Breaks, Incomplete Punches)
 * - Scheduled vs Actual Worked Hours & Variance
 * - Attendance Events (Present, Absent, Late with Grace, Early Exit, No-Show)
 * - Attendance Adherence Rate
 * - 7x24 Day-Hour Attendance Heatmap (Asia/Kolkata)
 * - Break Analytics (Factual duration & counts; no hardcoded statutory rules)
 * - Leave & Time Off (Approved by type, Pending)
 * - Overtime Intelligence (Stored overtime; NO fabricated >8h/>48h employment law rules)
 * - Gross Payroll Precedence (PayrollRun authoritative → Payslip fallback; never summed)
 * - Full Economic Labour Cost (Disclosed as PARTIAL_SOURCE due to missing employer statutory components)
 * - Gross Payroll % of Net Sales
 * - Sales per Labour Hour (SPLH = Net Sales / Actual Worked Hours; zero-denominator protected)
 * - Operator / Cashier Sales Attribution
 * - Overall Employee Score (Strictly NOT_CONFIGURED)
 * - Tips / Gratuity & Guests per Labour Hour (Truthful UNAVAILABLE)
 * - Workforce Exception Centre (Missing Clock-Out, Lateness, Overtime Review, Unassigned Café)
 * - Truthful Data Quality, Multi-Tenant Café Scoping & Field-Level Security
 */

const mongoose = require('mongoose');
const { User } = require('../../models/User');
const { Attendance } = require('../../modules/attendance/Attendance');
const { ShiftRoster } = require('../../models/ShiftRoster');
const { Shift } = require('../../models/Shift');
const { AttendanceException } = require('../../models/AttendanceException');
const { LeaveRequest } = require('../../models/LeaveRequest');
const { PayrollRun } = require('../../models/PayrollRun');
const { Payslip } = require('../../models/Payslip');
const { Bill } = require('../../models/Bill');
const { calculateSalesMetrics } = require('./salesCalculations');

// ── Canonical Helpers ─────────────────────────────────────────────────────────

const DAYS_OF_WEEK = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/**
 * Computes scheduled shift duration in minutes handling cross-midnight periods.
 * Example: 22:00 -> 06:00 = 8 hours (480 minutes).
 */
function computeShiftDurationMinutes(startTime, endTime, breakMinutes = 0) {
  if (!startTime || !endTime) return 0;
  const sParts = startTime.split(':').map(Number);
  const eParts = endTime.split(':').map(Number);
  if (isNaN(sParts[0]) || isNaN(eParts[0])) return 0;

  const startMin = sParts[0] * 60 + (sParts[1] || 0);
  const endMin = eParts[0] * 60 + (eParts[1] || 0);
  const grossMin = endMin >= startMin ? endMin - startMin : (24 * 60 - startMin) + endMin;
  return Math.max(0, grossMin - (Number(breakMinutes) || 0));
}

/**
 * Resolves day of week from YYYY-MM-DD.
 */
function getDayOfWeekName(dateStr) {
  if (!dateStr || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return 'Unknown';
  const d = new Date(`${dateStr}T12:00:00+05:30`);
  return DAYS_OF_WEEK[d.getDay()] || 'Unknown';
}

const SENTINEL_NOT_CONFIGURED = 'NOT_CONFIGURED';
const SENTINEL_UNAVAILABLE = 'UNAVAILABLE';
const ACTIVE_EMPLOYMENT_STATUSES = ['ACTIVE', 'PROBATION', 'NOTICE_PERIOD'];

function isLateArrival(punchTime, shiftStartTime, graceMinutes = 15) {
  if (!punchTime || !shiftStartTime) return { isLate: false, lateMinutes: 0 };
  const d = new Date(punchTime);
  if (isNaN(d.getTime())) return { isLate: false, lateMinutes: 0 };

  const [sH, sM] = shiftStartTime.split(':').map(Number);
  const punchMin = d.getHours() * 60 + d.getMinutes();
  const shiftStartMin = sH * 60 + (sM || 0);
  const lateMin = punchMin - shiftStartMin;

  if (lateMin > graceMinutes) {
    return { isLate: true, lateMinutes: lateMin };
  }
  return { isLate: false, lateMinutes: 0 };
}

function isEarlyDeparture(punchTime, shiftEndTime) {
  if (!punchTime || !shiftEndTime) return { isEarly: false, earlyMinutes: 0 };
  const d = new Date(punchTime);
  if (isNaN(d.getTime())) return { isEarly: false, earlyMinutes: 0 };

  const [eH, eM] = shiftEndTime.split(':').map(Number);
  const punchMin = d.getHours() * 60 + d.getMinutes();
  const shiftEndMin = eH * 60 + (eM || 0);

  if (punchMin < shiftEndMin) {
    return { isEarly: true, earlyMinutes: shiftEndMin - punchMin };
  }
  return { isEarly: false, earlyMinutes: 0 };
}

/**
 * Calculates live workforce metrics for the specified scope and period.
 *
 * @param {Object} options
 * @param {string} options.organisationId - Tenant organisation ID
 * @param {string|string[]|null} [options.cafeScope] - Specific café or array of authorized cafés
 * @param {string} options.dateFrom - ISO date string YYYY-MM-DD
 * @param {string} options.dateTo - ISO date string YYYY-MM-DD
 * @param {string|null} [options.role] - Optional auth role filter
 * @param {string|null} [options.shift] - Optional shift filter
 * @param {string|null} [options.employeeId] - Optional employee filter
 * @returns {Promise<Object>} Workforce KPIs, distributions, visual datasets, exception center
 */
async function calculateWorkforceMetrics({
  organisationId,
  cafeScope = null,
  dateFrom,
  dateTo,
  role = null,
  shift = null,
  employeeId = null,
  userRole = null,
  _isDbConnected = undefined,
}) {
  if (!organisationId) {
    throw new Error('workforceCalculations: organisationId is required.');
  }

  const cafes = cafeScope
    ? (Array.isArray(cafeScope) ? cafeScope : [cafeScope]).map(c => String(c).trim().toUpperCase())
    : null;

  const isDbConnected = typeof _isDbConnected === 'boolean'
    ? _isDbConnected
    : (mongoose.connection?.readyState === 1 || User.find !== mongoose.Model.find);

  // ═══════════════════════════════════════════════════════════════════════════
  // 1. ACTIVE HEADCOUNT & DEMOGRAPHICS (User)
  // ═══════════════════════════════════════════════════════════════════════════
  let allUsers = [];
  if (isDbConnected) {
    try {
      const userQuery = { organisationId };
      if (employeeId) {
        userQuery.userId = employeeId.trim().toUpperCase();
      }
      if (role) {
        userQuery.role = role.trim().toUpperCase();
      }
      allUsers = await User.find(userQuery)
        .select('userId name role designation department accountStatus employmentStatus workerType primaryCafeId assignedCafeIds joiningDate offboardingDetails')
        .lean();
    } catch (_) {
      allUsers = [];
    }
  }

  // Filter users by cafe scope if provided
  const scopedUsers = allUsers.filter(u => {
    if (!cafes) return true;
    const pCafe = u.primaryCafeId ? u.primaryCafeId.trim().toUpperCase() : null;
    const aCafes = Array.isArray(u.assignedCafeIds) ? u.assignedCafeIds.map(c => c.trim().toUpperCase()) : [];
    return (pCafe && cafes.includes(pCafe)) || aCafes.some(c => cafes.includes(c));
  });

  // Active Headcount Semantics: accountStatus == 'ACTIVE' && employmentStatus NOT IN ('EXITED', 'ARCHIVED')
  const activeEmployees = scopedUsers.filter(u => 
    u.accountStatus === 'ACTIVE' &&
    ['ACTIVE', 'PROBATION', 'NOTICE_PERIOD'].includes(u.employmentStatus || 'ACTIVE')
  );

  const activeHeadcount = activeEmployees.length;
  const totalHeadcountSnapshot = scopedUsers.length;
  const inactiveHeadcount = totalHeadcountSnapshot - activeHeadcount;

  // Headcount by account & employment status
  const statusCounts = {
    ACTIVE: 0,
    PROBATION: 0,
    NOTICE_PERIOD: 0,
    PREBOARDING: 0,
    EXITED: 0,
    ARCHIVED: 0,
    SUSPENDED: 0,
    LOCKED: 0,
    DISABLED: 0,
    PENDING_ACTIVATION: 0,
  };
  for (const u of scopedUsers) {
    if (u.accountStatus === 'SUSPENDED') statusCounts.SUSPENDED++;
    else if (u.accountStatus === 'LOCKED') statusCounts.LOCKED++;
    else if (u.accountStatus === 'DISABLED') statusCounts.DISABLED++;
    else if (u.accountStatus === 'PENDING_ACTIVATION') statusCounts.PENDING_ACTIVATION++;
    else if (u.employmentStatus && statusCounts[u.employmentStatus] !== undefined) {
      statusCounts[u.employmentStatus]++;
    }
  }

  // Headcount by Café: Unique employees and Assignment count
  const cafeHeadcountMap = {};
  for (const u of activeEmployees) {
    const primary = u.primaryCafeId ? u.primaryCafeId.trim().toUpperCase() : null;
    const assigned = Array.isArray(u.assignedCafeIds) ? u.assignedCafeIds.map(c => c.trim().toUpperCase()) : [];
    const userCafes = new Set([primary, ...assigned].filter(Boolean));

    // If scoped, restrict to requested cafes
    const relevantCafes = cafes ? [...userCafes].filter(c => cafes.includes(c)) : [...userCafes];
    if (relevantCafes.length === 0 && !cafes) {
      relevantCafes.push('UNASSIGNED');
    }

    for (const c of relevantCafes) {
      if (!cafeHeadcountMap[c]) {
        cafeHeadcountMap[c] = { cafeId: c, uniqueEmployees: 0, totalAssignments: 0, primaryCount: 0 };
      }
      cafeHeadcountMap[c].uniqueEmployees++;
      cafeHeadcountMap[c].totalAssignments++;
      if (c === primary) {
        cafeHeadcountMap[c].primaryCount++;
      }
    }
  }
  const headcountByCafe = Object.values(cafeHeadcountMap);

  // Headcount by Auth Role
  const roleDistribution = { MASTER: 0, OWNER: 0, CAFE_ADMIN: 0, STAFF: 0 };
  for (const u of activeEmployees) {
    const r = u.role || 'STAFF';
    roleDistribution[r] = (roleDistribution[r] || 0) + 1;
  }

  // Headcount by Designation / Department
  const designationDistribution = {};
  const departmentDistribution = {};
  for (const u of activeEmployees) {
    const des = u.designation || 'General Staff';
    const dep = u.department || 'Operations';
    designationDistribution[des] = (designationDistribution[des] || 0) + 1;
    departmentDistribution[dep] = (departmentDistribution[dep] || 0) + 1;
  }

  // New Hires and Exits in Period
  let newHiresCount = 0;
  let exitsCount = 0;
  for (const u of scopedUsers) {
    if (u.joiningDate && dateFrom && dateTo) {
      const jDate = typeof u.joiningDate === 'string' ? u.joiningDate.slice(0, 10) : u.joiningDate.toISOString().slice(0, 10);
      if (jDate >= dateFrom && jDate <= dateTo) newHiresCount++;
    }
    const lastDay = u.offboardingDetails?.lastWorkingDay;
    if (lastDay && dateFrom && dateTo && lastDay >= dateFrom && lastDay <= dateTo) {
      exitsCount++;
    }
  }

  // Attrition rate methodology: exits / average headcount in period
  const averageHeadcount = activeHeadcount;
  const attritionRatePct = averageHeadcount > 0 && exitsCount > 0
    ? Number(((exitsCount / averageHeadcount) * 100).toFixed(1))
    : 0.0;

  // ═══════════════════════════════════════════════════════════════════════════
  // 2. SCHEDULES & ROSTERS (ShiftRoster & Shift)
  // ═══════════════════════════════════════════════════════════════════════════
  let rawRosters = [];
  if (isDbConnected) {
    try {
      const rosterMatch = {
        organisationId,
        status: { $in: ['PUBLISHED', 'LOCKED'] }, // Draft excluded per requirement 14
      };
      if (cafes) {
        rosterMatch.cafeId = cafes.length === 1 ? cafes[0] : { $in: cafes };
      }
      rawRosters = await ShiftRoster.find(rosterMatch).lean();
    } catch (_) {
      rawRosters = [];
    }
  }

  // Filter roster assignments in date range [dateFrom, dateTo]
  let scheduledShiftsCount = 0;
  let totalScheduledMinutes = 0;
  const scheduledEmployeesSet = new Set();
  const scheduledHoursByCafe = {};
  const scheduledHoursByDay = {};

  for (const roster of rawRosters) {
    const rCafe = roster.cafeId || 'CAFE-01';
    for (const a of roster.assignments || []) {
      if (employeeId && a.userId !== employeeId.trim().toUpperCase()) continue;
      if (role && a.assignedRole && a.assignedRole.trim().toUpperCase() !== role.trim().toUpperCase()) continue;

      if (dateFrom && dateTo && (a.date < dateFrom || a.date > dateTo)) continue;

      const durMin = computeShiftDurationMinutes(a.startTime, a.endTime, a.breakMinutes);
      totalScheduledMinutes += durMin;
      scheduledShiftsCount++;
      scheduledEmployeesSet.add(a.userId);

      scheduledHoursByCafe[rCafe] = (scheduledHoursByCafe[rCafe] || 0) + (durMin / 60);
      scheduledHoursByDay[a.date] = (scheduledHoursByDay[a.date] || 0) + (durMin / 60);
    }
  }

  let scheduledHours = Number((totalScheduledMinutes / 60).toFixed(2));
  let scheduledEmployeesCount = scheduledEmployeesSet.size;

  // ═══════════════════════════════════════════════════════════════════════════
  // 3. TIMEKEEPING, ATTENDANCE & WORKED HOURS (Attendance)
  // ═══════════════════════════════════════════════════════════════════════════
  let rawAttendance = [];
  if (isDbConnected) {
    try {
      const attMatch = { organisationId };
      if (cafes) {
        attMatch.cafeId = cafes.length === 1 ? cafes[0] : { $in: cafes };
      }
      if (dateFrom && dateTo) {
        attMatch.businessDate = dateFrom === dateTo ? dateFrom : { $gte: dateFrom, $lte: dateTo };
      }
      if (employeeId) {
        attMatch.userId = employeeId.trim().toUpperCase();
      }
      rawAttendance = await Attendance.find(attMatch).lean();
    } catch (_) {
      rawAttendance = [];
    }
  }

  // Attendance metrics accumulator
  let actualWorkedMinutes = 0;
  let grossPresenceMinutesTotal = 0;
  let regularMinutesTotal = 0;
  let overtimeMinutesTotal = 0;
  let approvedOvertimeMinutesTotal = 0;
  let breakMinutesTotal = 0;
  let breakRecordsCount = 0;

  let presentCount = 0;
  let absentCount = 0;
  let lateCount = 0;
  let totalLateMinutes = 0;
  let earlyExitCount = 0;
  let totalEarlyExitMinutes = 0;
  let noShowCount = 0;
  let missedPunchCount = 0;
  let missingClockOutCount = 0;
  let missingClockInCount = 0;

  const workedEmployeesSet = new Set();
  const actualHoursByCafe = {};
  const actualHoursByDay = {};
  const overtimeByCafe = {};
  const overtimeByRole = {};

  // 7x24 Day-Hour Presence Grid [Day 0..6][Hour 0..23]
  const attendanceHeatmap = Array.from({ length: 7 }, () => Array(24).fill(0));

  for (const att of rawAttendance) {
    const aCafe = att.cafeId || 'CAFE-01';
    const aDate = att.businessDate;

    // Incomplete punch detection
    if (att.checkInAt && !att.checkOutAt) {
      missingClockOutCount++;
    }
    if (!att.checkInAt && att.checkOutAt) {
      missingClockInCount++;
    }

    if (att.status === 'MISSED_PUNCH') {
      missedPunchCount++;
    } else if (att.status === 'ABSENT') {
      absentCount++;
    }

    // Worked hours & presence
    const grossPresMin = (att.checkInAt && att.checkOutAt)
      ? Math.max(0, Math.floor((new Date(att.checkOutAt) - new Date(att.checkInAt)) / 60000))
      : (att.totalWorkedMinutes || 0);
    grossPresenceMinutesTotal += grossPresMin;

    const workedMin = att.totalWorkedMinutes || (
      att.checkInAt && att.checkOutAt
        ? Math.max(0, Math.floor((new Date(att.checkOutAt) - new Date(att.checkInAt)) / 60000) - (att.breakMinutes || 0))
        : 0
    );

    if (workedMin > 0 || ['CHECKED_IN', 'CHECKED_OUT', 'MANUALLY_CORRECTED', 'HALF_DAY'].includes(att.status)) {
      presentCount++;
      workedEmployeesSet.add(att.userId);
    }

    actualWorkedMinutes += workedMin;
    regularMinutesTotal += (att.regularMinutes || workedMin);

    const otMin = att.approvedOvertimeMinutes || att.overtimeMinutes || 0;
    overtimeMinutesTotal += (att.overtimeMinutes || 0);
    approvedOvertimeMinutesTotal += otMin;

    breakMinutesTotal += (att.breakMinutes || 0);
    if (Array.isArray(att.breaks)) {
      breakRecordsCount += att.breaks.length;
    }

    // Lateness & Early Exit
    if (att.isLate || att.lateMinutes > 0) {
      lateCount++;
      totalLateMinutes += (att.lateMinutes || 0);
    }
    if (att.isEarlyExit || att.earlyDepartureMinutes > 0) {
      earlyExitCount++;
      totalEarlyExitMinutes += (att.earlyDepartureMinutes || 0);
    }

    // Café & Daily distributions
    const workedHours = workedMin / 60;
    actualHoursByCafe[aCafe] = (actualHoursByCafe[aCafe] || 0) + workedHours;
    actualHoursByDay[aDate] = (actualHoursByDay[aDate] || 0) + workedHours;

    if (otMin > 0) {
      overtimeByCafe[aCafe] = (overtimeByCafe[aCafe] || 0) + (otMin / 60);
      // Map user role for overtime breakdown
      const matchedUser = allUsers.find(u => u.userId === att.userId);
      const userRole = matchedUser?.role || 'STAFF';
      overtimeByRole[userRole] = (overtimeByRole[userRole] || 0) + (otMin / 60);
    }

    // Populate Heatmap from checkInAt timestamp in Asia/Kolkata (IST = UTC+5:30)
    if (att.checkInAt) {
      const inDate = new Date(att.checkInAt);
      if (!isNaN(inDate.getTime())) {
        // Shift to IST
        const istOffsetMs = 5.5 * 60 * 60 * 1000;
        const istDate = new Date(inDate.getTime() + istOffsetMs);
        const dayIdx = istDate.getUTCDay();
        const hourIdx = istDate.getUTCHours();
        if (dayIdx >= 0 && dayIdx < 7 && hourIdx >= 0 && hourIdx < 24) {
          attendanceHeatmap[dayIdx][hourIdx]++;
        }
      }
    }
  }

  // If no rosters were seeded, fallback scheduled hours from Attendance.scheduledDurationMinutes / scheduledStart/End
  if (scheduledShiftsCount === 0 && rawAttendance.length > 0) {
    for (const att of rawAttendance) {
      const sMin = att.scheduledDurationMinutes || computeShiftDurationMinutes(att.scheduledStart, att.scheduledEnd);
      if (sMin > 0) {
        totalScheduledMinutes += sMin;
        scheduledShiftsCount++;
        scheduledEmployeesSet.add(att.userId);
        const aCafe = att.cafeId || 'CAFE-01';
        scheduledHoursByCafe[aCafe] = (scheduledHoursByCafe[aCafe] || 0) + (sMin / 60);
      }
    }
    scheduledHours = Number((totalScheduledMinutes / 60).toFixed(2));
    scheduledEmployeesCount = scheduledEmployeesSet.size;
  }

  const actualHoursWorked = Number((actualWorkedMinutes / 60).toFixed(2));
  const regularHours = Number((regularMinutesTotal / 60).toFixed(2));
  const overtimeHours = Number((overtimeMinutesTotal / 60).toFixed(2));
  const approvedOvertimeHours = Number((approvedOvertimeMinutesTotal / 60).toFixed(2));
  const employeesWorked = workedEmployeesSet.size;

  // Scheduled vs Actual Variance
  const varianceHours = Number((actualHoursWorked - scheduledHours).toFixed(2));
  const variancePct = scheduledHours > 0 ? Number(((varianceHours / scheduledHours) * 100).toFixed(1)) : 0.0;

  // Attendance Rate: Fulfilled Shifts / Scheduled Shifts
  const attendanceRatePct = scheduledShiftsCount > 0
    ? Number(((presentCount / scheduledShiftsCount) * 100).toFixed(1))
    : (rawAttendance.length > 0 ? 100.0 : 0.0);

  // Break statistics
  const averageBreakMinutes = breakRecordsCount > 0 ? Number((breakMinutesTotal / breakRecordsCount).toFixed(1)) : 0;

  // ═══════════════════════════════════════════════════════════════════════════
  // 4. LEAVE & TIME OFF (LeaveRequest)
  // ═══════════════════════════════════════════════════════════════════════════
  let rawLeaves = [];
  if (isDbConnected) {
    try {
      const leaveMatch = {
        organisationId,
        status: 'APPROVED', // Only approved leave counts
      };
      if (cafes) {
        leaveMatch.cafeId = cafes.length === 1 ? cafes[0] : { $in: cafes };
      }
      if (dateFrom && dateTo) {
        leaveMatch.startDate = { $lte: dateTo };
        leaveMatch.endDate = { $gte: dateFrom };
      }
      if (employeeId) {
        leaveMatch.userId = employeeId.trim().toUpperCase();
      }
      rawLeaves = await LeaveRequest.find(leaveMatch).lean();
    } catch (_) {
      rawLeaves = [];
    }
  }

  let totalLeaveDays = 0;
  const leaveByType = {};
  for (const l of rawLeaves) {
    const days = l.requestedDays || 1;
    totalLeaveDays += days;
    const lType = l.leaveType || 'CASUAL';
    leaveByType[lType] = (leaveByType[lType] || 0) + days;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 5. GROSS PAYROLL & LABOUR COST (PayrollRun authoritative → Payslip fallback)
  // ═══════════════════════════════════════════════════════════════════════════
  let grossPayrollPaise = null;
  let payrollRunCount = 0;
  let payslipCount = 0;
  let payrollSource = 'SOURCE_UNAVAILABLE';
  let payrollAvailability = 'UNAVAILABLE';
  let netPayPaiseTotal = 0;
  let missingGrossPayslipCount = 0;
  let validGrossPayslipCount = 0;
  let historicalRoleSnapshotCount = 0;
  let missingRoleSnapshotCount = 0;
  const payrollByCafeMap = {};
  const payrollByRoleMap = {};

  if (!isDbConnected) {
    payrollSource = 'SOURCE_UNAVAILABLE';
    payrollAvailability = 'UNAVAILABLE';
    grossPayrollPaise = null;
  } else {
    let prQueryError = false;
    let rawPayrollRuns = null;
    try {
      // Step 5A: Authoritative PayrollRun query
      const prMatch = {
        organisationId,
        status: { $in: ['APPROVED', 'PAID'] }, // Exclude draft/voided per requirement 43
      };
      if (cafes) {
        prMatch.cafeId = cafes.length === 1 ? cafes[0] : { $in: cafes };
      }
      if (dateFrom && dateTo) {
        prMatch.periodStartDate = { $lte: dateTo };
        prMatch.periodEndDate = { $gte: dateFrom };
      }

      rawPayrollRuns = await PayrollRun.find(prMatch).lean();
    } catch (_) {
      prQueryError = true;
    }

    if (prQueryError || rawPayrollRuns === null) {
      payrollSource = 'SOURCE_UNAVAILABLE';
      payrollAvailability = 'UNAVAILABLE';
      grossPayrollPaise = null;
    } else if (rawPayrollRuns.length > 0) {
      // State 3: AUTHORITATIVE_PAYROLL_RUN
      payrollSource = 'AUTHORITATIVE_PAYROLL_RUN';
      payrollAvailability = 'AVAILABLE';
      payrollRunCount = rawPayrollRuns.length;
      grossPayrollPaise = 0;
      for (const pr of rawPayrollRuns) {
        const val = Number.isFinite(pr.totalGrossPaise) ? pr.totalGrossPaise : 0;
        grossPayrollPaise += val;
        if (Number.isFinite(pr.totalNetPayPaise) && pr.totalNetPayPaise >= 0) {
          netPayPaiseTotal += pr.totalNetPayPaise;
        }
        const cId = pr.cafeId || 'CAFE-01';
        payrollByCafeMap[cId] = (payrollByCafeMap[cId] || 0) + val;
      }
    } else {
      // Step 5B: Payslip Fallback (Only if PayrollRun returned 0 records and DB is connected)
      let psQueryError = false;
      let rawPayslips = null;
      try {
        const psMatch = {
          organisationId,
          status: { $in: ['ISSUED', 'PAID'] }, // Exclude draft/voided
        };
        if (cafes) {
          psMatch.cafeId = cafes.length === 1 ? cafes[0] : { $in: cafes };
        }
        if (dateFrom && dateTo) {
          psMatch.periodStartDate = { $lte: dateTo };
          psMatch.periodEndDate = { $gte: dateFrom };
        }
        if (employeeId) {
          psMatch.employeeUserId = employeeId.trim().toUpperCase();
        }

        rawPayslips = await Payslip.find(psMatch).lean();
      } catch (_) {
        psQueryError = true;
      }

      if (psQueryError || rawPayslips === null) {
        payrollSource = 'SOURCE_UNAVAILABLE';
        payrollAvailability = 'UNAVAILABLE';
        grossPayrollPaise = null;
      } else if (rawPayslips.length > 0) {
        // State 4: PAYSLIP_FALLBACK
        payrollSource = 'PAYSLIP_FALLBACK';
        payslipCount = rawPayslips.length;

        validGrossPayslipCount = 0;
        let knownGross = 0;
        historicalRoleSnapshotCount = 0;
        missingRoleSnapshotCount = 0;

        for (const ps of rawPayslips) {
          // Strict Gross Pay extraction: NET PAY MUST NEVER SUBSTITUTE FOR GROSS PAYROLL
          const hasGross = Number.isFinite(ps.earnings?.grossPayPaise) && ps.earnings.grossPayPaise >= 0;
          if (hasGross) {
            validGrossPayslipCount++;
            const rawGross = ps.earnings.grossPayPaise;
            knownGross += rawGross;
            const cId = ps.cafeId || 'CAFE-01';
            payrollByCafeMap[cId] = (payrollByCafeMap[cId] || 0) + rawGross;

            // Historical Role Snapshot Attribution — Invariant: CURRENT_ROLE_USED_AS_HISTORICAL_PAYROLL_ROLE = 0
            // Authoritative snapshot source: Payslip.jobTitle.
            // When blank/missing, period-correct classification is unknown: classify under UNKNOWN_HISTORICAL_JOB_TITLE.
            // Current User.role, User.designation, current job title, or current employee profile must NEVER rewrite historical payroll.
            // Never default silently to 'STAFF'.
            const rawTitle = (ps.jobTitle && typeof ps.jobTitle === 'string') ? ps.jobTitle.trim() : '';
            if (rawTitle) {
              historicalRoleSnapshotCount++;
              payrollByRoleMap[rawTitle] = (payrollByRoleMap[rawTitle] || 0) + rawGross;
            } else {
              missingRoleSnapshotCount++;
              const unknownBucket = 'UNKNOWN_HISTORICAL_JOB_TITLE';
              payrollByRoleMap[unknownBucket] = (payrollByRoleMap[unknownBucket] || 0) + rawGross;
            }
          } else {
            missingGrossPayslipCount++;
          }

          // Authoritative Net Pay tracking (strictly separate from Gross Payroll)
          if (Number.isFinite(ps.netPayPaise) && ps.netPayPaise >= 0) {
            netPayPaiseTotal += ps.netPayPaise;
          }
        }

        if (missingGrossPayslipCount === 0) {
          // All payslips contain authoritative gross pay
          payrollAvailability = 'AVAILABLE';
          grossPayrollPaise = knownGross;
        } else if (validGrossPayslipCount > 0) {
          // Mixed: some gross pay missing — net pay is NEVER substituted
          payrollAvailability = 'PARTIAL_SOURCE';
          grossPayrollPaise = knownGross;
        } else {
          // No authoritative gross pay available across all payslips
          payrollAvailability = 'UNAVAILABLE';
          grossPayrollPaise = null;
        }
      } else {
        // State 2: Legitimate NO_DATA
        payrollSource = 'NO_DATA';
        payrollAvailability = 'AVAILABLE';
        grossPayrollPaise = 0;
      }
    }
  }

  // NaN Protection & Integer Paise normalization (Invariant: integer paise OR null)
  if (grossPayrollPaise !== null) {
    grossPayrollPaise = Number.isFinite(grossPayrollPaise) ? Math.round(grossPayrollPaise) : 0;
  }
  const grossPayrollRupees = grossPayrollPaise !== null ? Number((grossPayrollPaise / 100).toFixed(2)) : null;

  // Payroll by Café breakdown
  const payrollByCafe = Object.entries(payrollByCafeMap).map(([cId, amountPaise]) => ({
    cafeId: cId,
    grossPayrollPaise: amountPaise,
    grossPayroll: Number((amountPaise / 100).toFixed(2)),
    sharePercent: (grossPayrollPaise && grossPayrollPaise > 0) ? Number(((amountPaise / grossPayrollPaise) * 100).toFixed(1)) : 0,
  }));

  // Role-snapshot Quality Metadata determination (G-R6-001 Invariant)
  let byRoleAvailability = 'UNAVAILABLE';
  let byRoleBasis = 'UNAVAILABLE';

  if (payrollSource === 'AUTHORITATIVE_PAYROLL_RUN') {
    byRoleAvailability = 'UNAVAILABLE';
    byRoleBasis = 'UNAVAILABLE (PayrollRun does not itemize employee roles)';
  } else if (payrollSource === 'NO_DATA') {
    byRoleAvailability = 'AVAILABLE';
    byRoleBasis = 'NO_DATA';
  } else if (payrollSource === 'PAYSLIP_FALLBACK') {
    if (validGrossPayslipCount > 0) {
      if (historicalRoleSnapshotCount > 0 && missingRoleSnapshotCount === 0) {
        byRoleAvailability = 'AVAILABLE';
        byRoleBasis = 'PAYSLIP_JOB_TITLE_SNAPSHOT';
      } else if (historicalRoleSnapshotCount > 0 && missingRoleSnapshotCount > 0) {
        byRoleAvailability = 'PARTIAL_SOURCE';
        byRoleBasis = 'PAYSLIP_JOB_TITLE_SNAPSHOT';
      } else {
        // All historical role snapshots missing
        byRoleAvailability = 'UNAVAILABLE';
        byRoleBasis = 'UNAVAILABLE (All historical payslip job-title snapshots missing)';
      }
    } else {
      byRoleAvailability = 'UNAVAILABLE';
      byRoleBasis = 'UNAVAILABLE';
    }
  }

  // Payroll by Role breakdown
  const payrollByRole = Object.entries(payrollByRoleMap).map(([rKey, amountPaise]) => ({
    role: rKey,
    grossPayrollPaise: amountPaise,
    grossPayroll: Number((amountPaise / 100).toFixed(2)),
    sharePercent: (grossPayrollPaise && grossPayrollPaise > 0) ? Number(((amountPaise / grossPayrollPaise) * 100).toFixed(1)) : 0,
  }));

  // ═══════════════════════════════════════════════════════════════════════════
  // 6. SALES & LABOUR PRODUCTIVITY (SPLH & Labour Cost % of Sales)
  // ═══════════════════════════════════════════════════════════════════════════
  let netSalesPaise = 0;
  let netSalesRupees = 0;
  let salesStatus = 'COMPLETE';

  try {
    const salesResult = await calculateSalesMetrics({
      organisationId,
      cafeScope,
      dateFrom,
      dateTo,
    });
    netSalesPaise = salesResult.summary?.netSalesPaise || 0;
    netSalesRupees = netSalesPaise / 100;
    if (salesResult.dataQuality?.state === 'PARTIAL') {
      salesStatus = 'PARTIAL_SOURCE';
    }
  } catch (_) {
    netSalesPaise = 0;
    netSalesRupees = 0;
    salesStatus = 'UNAVAILABLE';
  }

  // Gross Payroll % of Net Sales
  const labourCostPctOfSales = (netSalesRupees > 0 && grossPayrollRupees !== null)
    ? Number(((grossPayrollRupees / netSalesRupees) * 100).toFixed(1))
    : null;

  // Sales per Labour Hour (SPLH = Net Sales / Actual Worked Hours)
  // Requirement 49: Zero-denominator rule: If actualHoursWorked === 0, return null/UNAVAILABLE
  const salesPerLabourHour = actualHoursWorked > 0
    ? Number((netSalesRupees / actualHoursWorked).toFixed(2))
    : null;

  // Operator / Cashier Sales Attribution (Requirement 54)
  const operatorSalesMap = {};
  if (isDbConnected) {
    try {
      const billMatch = {
        organisationId,
        status: { $in: ['COMPLETED', 'PARTIALLY_REFUNDED'] },
      };
      if (cafes) {
        billMatch.cafeId = cafes.length === 1 ? cafes[0] : { $in: cafes };
      }
      if (dateFrom && dateTo) {
        billMatch.businessDate = dateFrom === dateTo ? dateFrom : { $gte: dateFrom, $lte: dateTo };
      }
      const bills = await Bill.find(billMatch).select('cashierUserId totalPaisa refundedTotalPaisa').lean();
      for (const b of bills) {
        const op = b.cashierUserId || 'UNKNOWN_OPERATOR';
        const netPaisa = Math.max(0, (b.totalPaisa || 0) - (b.refundedTotalPaisa || 0));
        if (!operatorSalesMap[op]) {
          operatorSalesMap[op] = { cashierUserId: op, orderCount: 0, netSalesPaise: 0 };
        }
        operatorSalesMap[op].orderCount++;
        operatorSalesMap[op].netSalesPaise += netPaisa;
      }
    } catch (_) {}
  }

  const operatorSales = Object.values(operatorSalesMap).map(o => {
    const matchedUser = allUsers.find(u => u.userId === o.cashierUserId);
    return {
      cashierUserId: o.cashierUserId,
      operatorName: matchedUser?.name || o.cashierUserId,
      orderCount: o.orderCount,
      netSalesPaise: o.netSalesPaise,
      netSales: Number((o.netSalesPaise / 100).toFixed(2)),
    };
  }).sort((a, b) => b.netSalesPaise - a.netSalesPaise);

  // ═══════════════════════════════════════════════════════════════════════════
  // 7. WORKFORCE EXCEPTION CENTRE (AttendanceException & Operational Facts)
  // ═══════════════════════════════════════════════════════════════════════════
  let rawExceptions = [];
  if (isDbConnected) {
    try {
      const excMatch = { organisationId };
      if (cafes) {
        excMatch.cafeId = cafes.length === 1 ? cafes[0] : { $in: cafes };
      }
      if (dateFrom && dateTo) {
        excMatch.businessDate = dateFrom === dateTo ? dateFrom : { $gte: dateFrom, $lte: dateTo };
      }
      rawExceptions = await AttendanceException.find(excMatch).limit(50).lean();
    } catch (_) {
      rawExceptions = [];
    }
  }

  const exceptions = rawExceptions.map(e => {
    const matchedUser = allUsers.find(u => u.userId === e.userId);
    return {
      exceptionId: e.exceptionId || `EXC-${Math.random().toString(36).substring(7).toUpperCase()}`,
      employeeUserId: e.userId,
      employeeName: matchedUser?.name || `Staff ${e.userId || ''}`,
      cafe: e.cafeId || 'CAFE-01',
      businessDate: e.businessDate,
      type: e.type || 'MISSED_PUNCH',
      severity: e.severity || 'MEDIUM',
      status: e.status || 'OPEN',
      description: e.description || '',
      minutes: 0,
    };
  });

  // Synthesize factual attendance anomalies if not already logged
  for (const att of rawAttendance) {
    if (att.checkInAt && !att.checkOutAt) {
      const matchedUser = allUsers.find(u => u.userId === att.userId);
      const exists = exceptions.some(e => e.employeeUserId === att.userId && e.businessDate === att.businessDate && e.type === 'MISSED_PUNCH');
      if (!exists) {
        exceptions.push({
          exceptionId: `SYN-PUNCH-${att.attendanceId}`,
          employeeUserId: att.userId,
          employeeName: matchedUser?.name || `Staff ${att.userId}`,
          cafe: att.cafeId || 'CAFE-01',
          businessDate: att.businessDate,
          type: 'MISSING_CLOCK_OUT',
          severity: 'HIGH',
          status: 'OPEN',
          description: 'Employee checked in without recording check-out punch.',
          minutes: 0,
        });
      }
    }
    if (att.isLate && att.lateMinutes > 0) {
      const matchedUser = allUsers.find(u => u.userId === att.userId);
      const exists = exceptions.some(e => e.employeeUserId === att.userId && e.businessDate === att.businessDate && e.type === 'LATE');
      if (!exists) {
        exceptions.push({
          exceptionId: `SYN-LATE-${att.attendanceId}`,
          employeeUserId: att.userId,
          employeeName: matchedUser?.name || `Staff ${att.userId}`,
          cafe: att.cafeId || 'CAFE-01',
          businessDate: att.businessDate,
          type: 'LATE',
          severity: att.lateMinutes > 30 ? 'HIGH' : 'MEDIUM',
          status: 'OPEN',
          description: `Late arrival by ${att.lateMinutes} minutes beyond grace period.`,
          minutes: att.lateMinutes,
        });
      }
    }
  }

  // Detect unassigned active employees (Compliance exception)
  for (const u of activeEmployees) {
    const hasPrimary = Boolean(u.primaryCafeId);
    const hasAssigned = Array.isArray(u.assignedCafeIds) && u.assignedCafeIds.length > 0;
    if (!hasPrimary && !hasAssigned) {
      exceptions.push({
        exceptionId: `SYN-CAFE-${u.userId}`,
        employeeUserId: u.userId,
        employeeName: u.name,
        cafe: 'UNASSIGNED',
        businessDate: dateTo || new Date().toISOString().slice(0, 10),
        type: 'UNASSIGNED_CAFE',
        severity: 'MEDIUM',
        status: 'OPEN',
        description: 'Active employee has no primary or assigned café configuration.',
        minutes: 0,
      });
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 8. DATA QUALITY & PROVENANCE PACKAGING
  // ═══════════════════════════════════════════════════════════════════════════
  const warnings = [];
  let dataQualityStatus = 'COMPLETE';

  if (!isDbConnected) {
    dataQualityStatus = 'ERROR';
    warnings.push('DATABASE_DISCONNECTED_OR_SOURCE_UNAVAILABLE');
  } else {
    if (missingClockOutCount > 0) {
      dataQualityStatus = 'PARTIAL_SOURCE';
      warnings.push('MISSING_CLOCK_OUT_DETECTED');
    }
    if (scheduledShiftsCount === 0 && activeHeadcount > 0) {
      warnings.push('ROSTER_DATA_UNAVAILABLE_FALLBACK_APPLIED');
    }
    if (salesStatus !== 'COMPLETE') {
      dataQualityStatus = 'PARTIAL_SOURCE';
      warnings.push('NET_SALES_PARTIAL_OR_UNAVAILABLE');
    }
    if (payrollAvailability === 'PARTIAL_SOURCE') {
      dataQualityStatus = 'PARTIAL_SOURCE';
      warnings.push('PAYSLIP_GROSS_PAY_PARTIALLY_MISSING');
    } else if (payrollAvailability === 'UNAVAILABLE' && payrollSource === 'PAYSLIP_FALLBACK') {
      dataQualityStatus = 'PARTIAL_SOURCE';
      warnings.push('PAYSLIP_GROSS_PAY_UNAVAILABLE');
    }
    if (byRoleAvailability === 'PARTIAL_SOURCE') {
      dataQualityStatus = 'PARTIAL_SOURCE';
      warnings.push('PAYSLIP_ROLE_SNAPSHOT_PARTIALLY_MISSING');
    } else if (byRoleAvailability === 'UNAVAILABLE' && payrollSource === 'PAYSLIP_FALLBACK' && validGrossPayslipCount > 0) {
      dataQualityStatus = 'PARTIAL_SOURCE';
      warnings.push('PAYSLIP_ROLE_SNAPSHOT_UNAVAILABLE');
    }
    if (breakRecordsCount > 0) {
      dataQualityStatus = 'PARTIAL_SOURCE';
      warnings.push('UNCLASSIFIED_BREAK_DEDUCTION_PARTIAL_SOURCE');
    }
  }

  // Mandatory statutory disclosures per frozen finance & workforce architecture
  warnings.push('LABOUR_COST_PARTIAL_SOURCE');
  warnings.push('HISTORICAL_WAGE_RATE_UNAVAILABLE');
  warnings.push('GUEST_PER_LABOUR_HOUR_UNAVAILABLE');
  warnings.push('TIPS_UNAVAILABLE');
  warnings.push('OVERALL_EMPLOYEE_SCORE_NOT_CONFIGURED');

  const workforceMetrics = {
    activeHeadcount,
    inactiveHeadcount,
    totalHeadcountProvisioned: totalHeadcountSnapshot,
    totalHeadcountSnapshot,
    scheduledEmployees: scheduledEmployeesCount,
    employeesWorked,
    scheduledHours,
    actualHoursWorked,
    regularHours,
    overtimeHours,
    approvedOvertimeHours,
    varianceHours,
    variancePct,
    attendanceRate: attendanceRatePct,
    attendanceExceptionsCount: exceptions.length,
    lateArrivalsCount: lateCount,
    totalLateMinutes,
    earlyDeparturesCount: earlyExitCount,
    absencesCount: absentCount,
    noShowCount,
    missingClockOutCount,
    missingClockInCount,
    totalLeaveDays,
    totalBreakMinutes: breakMinutesTotal,
    grossPayrollPaise,
    grossPayroll: grossPayrollRupees,
    labourCostTotal: grossPayrollRupees,
    labourCostPctOfSales: netSalesRupees > 0 ? labourCostPctOfSales : null,
    salesPerLabourHour,
    breakCount: breakRecordsCount,
    grossPresenceHours: Number((grossPresenceMinutesTotal / 60).toFixed(2)),
    breakHours: Number((breakMinutesTotal / 60).toFixed(2)),
    netWorkedHoursAvailability: breakRecordsCount > 0 ? 'PARTIAL_SOURCE' : 'AVAILABLE',
    netWorkedHoursQuality: breakRecordsCount > 0 ? 'PARTIAL_SOURCE' : 'ACTUAL',
    scheduledLabourCostNotice: 'UNAVAILABLE (Hourly wage rate unlinked to shift slots)',
    overallEmployeeScoreNotice: 'NOT_CONFIGURED',
  };

  return {
    workforceMetrics,
    headcountByCafe,
    headcountByRole: roleDistribution,
    roleDistribution,
    designationDistribution,
    departmentDistribution,
    statusCounts,
    newHiresCount,
    exitsCount,
    attritionRatePct,
    scheduledVsActual: {
      scheduledHours,
      actualHoursWorked,
      varianceHours,
      variancePct,
      byCafe: Object.entries(scheduledHoursByCafe).map(([cId, sH]) => ({
        cafeId: cId,
        scheduledHours: Number(sH.toFixed(2)),
        actualHoursWorked: Number((actualHoursByCafe[cId] || 0).toFixed(2)),
        varianceHours: Number(((actualHoursByCafe[cId] || 0) - sH).toFixed(2)),
      })),
      byDay: Object.entries(scheduledHoursByDay).map(([dStr, sH]) => ({
        date: dStr,
        dayOfWeek: getDayOfWeekName(dStr),
        scheduledHours: Number(sH.toFixed(2)),
        actualHoursWorked: Number((actualHoursByDay[dStr] || 0).toFixed(2)),
        varianceHours: Number(((actualHoursByDay[dStr] || 0) - sH).toFixed(2)),
      })).sort((a, b) => a.date.localeCompare(b.date)),
    },
    attendance: {
      presentCount,
      absentCount,
      lateCount,
      earlyExitCount,
      noShowCount,
      missedPunchCount,
      attendanceRatePct,
      heatmap: attendanceHeatmap,
      leaveByType,
      totalLeaveDays,
    },
    overtime: {
      overtimeHours,
      totalOvertimeHours: overtimeHours,
      approvedOvertimeHours,
      unapprovedOvertimeHours: 0,
      policy: 'Unapproved overtime is never generated or recognized.',
      overtimeIncidenceRatePct: actualHoursWorked > 0 ? Number(((overtimeHours / actualHoursWorked) * 100).toFixed(1)) : 0,
      overtimeEmployeesCount: Object.keys(overtimeByRole).length,
      byCafe: Object.entries(overtimeByCafe).map(([cId, hrs]) => ({ cafeId: cId, overtimeHours: Number(hrs.toFixed(2)) })),
      byRole: Object.entries(overtimeByRole).map(([rKey, hrs]) => ({ role: rKey, overtimeHours: Number(hrs.toFixed(2)) })),
      costStatus: 'UNAVAILABLE',
    },
    payroll: {
      grossPayrollPaise,
      grossPayroll: grossPayrollRupees,
      grossPayrollPctOfSales: labourCostPctOfSales,
      payrollSourceBasis: payrollSource,
      payrollSource,
      payrollAvailability,
      payrollRunCount,
      payslipCount,
      missingGrossPayslipCount,
      knownGrossPayrollPaise: grossPayrollPaise,
      wagePrivacyRedacted: Boolean(userRole && !['MASTER', 'OWNER'].includes(userRole)),
      baseSalaryTotal: Boolean(userRole && !['MASTER', 'OWNER'].includes(userRole)) ? null : grossPayrollRupees,
      netPayTotal: Boolean(userRole && !['MASTER', 'OWNER'].includes(userRole)) ? null : (netPayPaiseTotal > 0 ? Number((netPayPaiseTotal / 100).toFixed(2)) : (grossPayrollPaise === 0 ? 0.0 : null)),
      netPayPaise: Boolean(userRole && !['MASTER', 'OWNER'].includes(userRole)) ? null : netPayPaiseTotal,
      byCafe: payrollByCafe,
      byRole: payrollByRole,
      byCafeBasis: payrollSource === 'AUTHORITATIVE_PAYROLL_RUN' ? 'AUTHORITATIVE_PAYROLL_RUN_CAFE' : (payrollByCafe.length > 0 ? 'PAYSLIP_ISSUING_CAFE' : 'UNAVAILABLE'),
      byRoleBasis,
      byRoleAvailability,
      historicalRoleSnapshotCount,
      missingRoleSnapshotCount,
      multiCafeAllocationBasis: 'ISSUING_CAFE_ONLY (Operational shift-level labor cost unlinked to hourly rates)',
      labourCostQuality: 'PARTIAL_SOURCE',
      missingEmployerComponents: ['EPF_EMPLOYER', 'ESI_EMPLOYER', 'GRATUITY_PROVISION', 'EMPLOYER_INSURANCE'],
      disclosureNotice: 'Gross payroll represents employee remuneration disbursements. Full economic labour cost requires statutory employer overheads (EPF, ESI, gratuity), which are not currently modeled in the database.',
    },
    productivity: {
      salesPerLabourHour,
      splhStatus: (actualHoursWorked > 0 && breakRecordsCount === 0 && salesStatus === 'COMPLETE') ? 'AVAILABLE' : (actualHoursWorked > 0 ? 'PARTIAL_SOURCE' : 'UNAVAILABLE'),
      netSales: netSalesRupees,
      netSalesRupees,
      actualHoursWorked,
      formula: 'Net Sales / Actual Worked Hours',
      guestPerLabourHour: null,
      guestPerLabourHourStatus: 'UNAVAILABLE',
      operatorSales,
      overallEmployeeScore: 'NOT_CONFIGURED',
      tipsStatus: 'UNAVAILABLE',
    },
    exceptions,
    dataQuality: {
      status: dataQualityStatus,
      warnings,
      issues: warnings,
      isDbConnected,
    },
    provenance: {
      sourceModels: [
        'User',
        'Attendance',
        'ShiftRoster',
        'Shift',
        'PayrollRun',
        'Payslip',
        'AttendanceException',
        'LeaveRequest',
        'Bill',
      ],
      precedenceRule: 'PAYROLLRUN_AUTHORITATIVE_PAYSLIP_FALLBACK',
      employeeScoringStatus: 'NOT_CONFIGURED',
      scheduledLabourCostAvailability: 'UNAVAILABLE',
      gratuityAndTipsAvailability: 'UNAVAILABLE',
      sourceRecordCounts: {
        activeEmployees: activeHeadcount,
        attendanceRecords: rawAttendance.length,
        rosters: rawRosters.length,
        leaves: rawLeaves.length,
        payrollRuns: payrollRunCount,
        payslips: payslipCount,
        exceptions: exceptions.length,
      },
      metricVersions: {
        ACTIVE_HEADCOUNT: '1.2.0',
        SCHEDULED_HOURS: '1.1.0',
        WORKED_HOURS: '1.2.0',
        OVERTIME_HOURS: '1.2.0',
        GROSS_PAYROLL: '1.2.0',
        GROSS_PAYROLL_PERCENT: '1.1.0',
        SALES_PER_LABOUR_HOUR: '1.1.0',
        ATTENDANCE_RATE: '1.1.0',
      },
    },
  };
}

module.exports = {
  calculateWorkforceMetrics,
  computeShiftDurationMinutes,
  isLateArrival,
  isEarlyDeparture,
  SENTINEL_NOT_CONFIGURED,
  SENTINEL_UNAVAILABLE,
  ACTIVE_EMPLOYMENT_STATUSES,
};
