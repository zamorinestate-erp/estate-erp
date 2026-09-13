'use strict';

/**
 * ZAMORIN CAFÉ ERP — REPORTING FOUNDATION
 * Module: reportingTime.js
 * 
 * Canonical date and time basis:
 * - Timezone: Asia/Kolkata (IST, UTC+05:30)
 * - Date basis: businessDate (YYYY-MM-DD)
 * - Standard period definitions & comparison period engine
 * - Server-side validation against malformed dates & inverted ranges
 */

const TIMEZONE = 'Asia/Kolkata';
const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Returns the current date in IST.
 * @param {Date} [baseDate=new Date()]
 * @returns {Date}
 */
function getIstDate(baseDate = new Date()) {
  const utc = baseDate.getTime() + baseDate.getTimezoneOffset() * 60000;
  return new Date(utc + 3600000 * 5.5);
}

/**
 * Returns current IST date as YYYY-MM-DD strictly in Asia/Kolkata timezone.
 * Host-timezone agnostic (works identically on UTC, EST, or local server).
 * @param {Date} [baseDate=new Date()]
 * @returns {string}
 */
function getIstTodayDateString(baseDate = new Date()) {
  const d = baseDate instanceof Date ? baseDate : new Date(baseDate);
  if (Number.isNaN(d.getTime())) return '1970-01-01';
  try {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: TIMEZONE,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(d);
  } catch {
    const utc = d.getTime() + d.getTimezoneOffset() * 60000;
    const ist = new Date(utc + 3600000 * 5.5);
    const year = ist.getFullYear();
    const month = String(ist.getMonth() + 1).padStart(2, '0');
    const day = String(ist.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
}

/**
 * Formats a Date object or timestamp to YYYY-MM-DD in IST.
 * @param {Date|string|number} d
 * @returns {string}
 */
function formatDateToIst(d) {
  if (!d) return getIstTodayDateString();
  const dateObj = typeof d === 'string' || typeof d === 'number' ? new Date(d) : d;
  if (Number.isNaN(dateObj.getTime())) return getIstTodayDateString();
  return getIstTodayDateString(dateObj);
}

/**
 * Validates a YYYY-MM-DD date range string pair.
 * @param {string} from
 * @param {string} to
 * @returns {{ valid: boolean, error?: string }}
 */
function validateDateRange(from, to) {
  if (!from || !to) {
    return { valid: false, error: 'Both from and to dates are required.' };
  }
  if (!DATE_REGEX.test(from) || !DATE_REGEX.test(to)) {
    return { valid: false, error: 'Date must adhere to YYYY-MM-DD format.' };
  }
  if (from > to) {
    return { valid: false, error: 'Start date (from) cannot be after end date (to).' };
  }
  return { valid: true };
}

/**
 * Adds or subtracts days from a YYYY-MM-DD string in IST.
 * @param {string} dateStr
 * @param {number} days
 * @returns {string}
 */
function shiftDays(dateStr, days) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

/**
 * Resolves standard period name into canonical date boundaries { dateFrom, dateTo, periodId }.
 * @param {string} periodName
 * @param {object} [customRange={}]
 * @returns {{ periodId: string, dateFrom: string, dateTo: string, label: string }}
 */
function _resolveReportPeriodRaw(periodName = 'MTD', customRange = {}) {
  const todayStr = getIstTodayDateString();
  const [currentYear, currentMonth, currentDay] = todayStr.split('-').map(Number);

  const normalizedPeriod = String(periodName || 'MTD').trim().toUpperCase();

  switch (normalizedPeriod) {
    case 'TODAY':
      return {
        periodId: 'TODAY',
        dateFrom: todayStr,
        dateTo: todayStr,
        label: 'Today',
      };

    case 'YESTERDAY': {
      const yest = shiftDays(todayStr, -1);
      return {
        periodId: 'YESTERDAY',
        dateFrom: yest,
        dateTo: yest,
        label: 'Yesterday',
      };
    }

    case 'THIS_WEEK': {
      const istDate = getIstDate();
      const dayOfWeek = (istDate.getDay() + 6) % 7; // Monday = 0, Sunday = 6
      const mondayStr = shiftDays(todayStr, -dayOfWeek);
      const sundayStr = shiftDays(mondayStr, 6);
      return {
        periodId: 'THIS_WEEK',
        dateFrom: mondayStr,
        dateTo: sundayStr,
        label: 'This Week',
      };
    }

    case 'LAST_WEEK': {
      const istDate = getIstDate();
      const dayOfWeek = (istDate.getDay() + 6) % 7;
      const thisMonday = shiftDays(todayStr, -dayOfWeek);
      const lastMonday = shiftDays(thisMonday, -7);
      const lastSunday = shiftDays(lastMonday, 6);
      return {
        periodId: 'LAST_WEEK',
        dateFrom: lastMonday,
        dateTo: lastSunday,
        label: 'Last Week',
      };
    }

    case 'THIS_MONTH': {
      const firstDay = `${currentYear}-${String(currentMonth).padStart(2, '0')}-01`;
      const lastDayObj = new Date(Date.UTC(currentYear, currentMonth, 0));
      const lastDay = lastDayObj.toISOString().slice(0, 10);
      return {
        periodId: 'THIS_MONTH',
        dateFrom: firstDay,
        dateTo: lastDay,
        label: 'This Month',
      };
    }

    case 'LAST_MONTH': {
      const targetYear = currentMonth === 1 ? currentYear - 1 : currentYear;
      const targetMonth = currentMonth === 1 ? 12 : currentMonth - 1;
      const firstDay = `${targetYear}-${String(targetMonth).padStart(2, '0')}-01`;
      const lastDayObj = new Date(Date.UTC(targetYear, targetMonth, 0));
      const lastDay = lastDayObj.toISOString().slice(0, 10);
      return {
        periodId: 'LAST_MONTH',
        dateFrom: firstDay,
        dateTo: lastDay,
        label: 'Last Month',
      };
    }

    case 'MTD': {
      const firstDay = `${currentYear}-${String(currentMonth).padStart(2, '0')}-01`;
      return {
        periodId: 'MTD',
        dateFrom: firstDay,
        dateTo: todayStr,
        label: 'Month to Date',
      };
    }

    case 'PREVIOUS_MTD': {
      const targetYear = currentMonth === 1 ? currentYear - 1 : currentYear;
      const targetMonth = currentMonth === 1 ? 12 : currentMonth - 1;
      const firstDay = `${targetYear}-${String(targetMonth).padStart(2, '0')}-01`;
      const lastDayOfPrevMonth = new Date(Date.UTC(targetYear, targetMonth, 0)).getUTCDate();
      const clampedDay = Math.min(currentDay, lastDayOfPrevMonth);
      const toDay = `${targetYear}-${String(targetMonth).padStart(2, '0')}-${String(clampedDay).padStart(2, '0')}`;
      return {
        periodId: 'PREVIOUS_MTD',
        dateFrom: firstDay,
        dateTo: toDay,
        label: 'Previous Month to Date',
      };
    }

    case 'THIS_QUARTER': {
      const qIndex = Math.floor((currentMonth - 1) / 3);
      const startMonth = qIndex * 3 + 1;
      const endMonth = startMonth + 2;
      const firstDay = `${currentYear}-${String(startMonth).padStart(2, '0')}-01`;
      const lastDayObj = new Date(Date.UTC(currentYear, endMonth, 0));
      const lastDay = lastDayObj.toISOString().slice(0, 10);
      return {
        periodId: 'THIS_QUARTER',
        dateFrom: firstDay,
        dateTo: lastDay,
        label: `Q${qIndex + 1} ${currentYear}`,
      };
    }

    case 'LAST_QUARTER': {
      const qIndex = Math.floor((currentMonth - 1) / 3);
      const prevQIndex = qIndex === 0 ? 3 : qIndex - 1;
      const targetYear = qIndex === 0 ? currentYear - 1 : currentYear;
      const startMonth = prevQIndex * 3 + 1;
      const endMonth = startMonth + 2;
      const firstDay = `${targetYear}-${String(startMonth).padStart(2, '0')}-01`;
      const lastDayObj = new Date(Date.UTC(targetYear, endMonth, 0));
      const lastDay = lastDayObj.toISOString().slice(0, 10);
      return {
        periodId: 'LAST_QUARTER',
        dateFrom: firstDay,
        dateTo: lastDay,
        label: `Q${prevQIndex + 1} ${targetYear}`,
      };
    }

    case 'YTD': {
      const firstDay = `${currentYear}-01-01`;
      return {
        periodId: 'YTD',
        dateFrom: firstDay,
        dateTo: todayStr,
        label: 'Year to Date',
      };
    }

    case 'PREVIOUS_YTD': {
      const prevYear = currentYear - 1;
      const firstDay = `${prevYear}-01-01`;
      const toDay = `${prevYear}-${String(currentMonth).padStart(2, '0')}-${String(currentDay).padStart(2, '0')}`;
      return {
        periodId: 'PREVIOUS_YTD',
        dateFrom: firstDay,
        dateTo: toDay,
        label: 'Previous Year to Date',
      };
    }

    case 'CUSTOM':
    default: {
      const rawFrom = customRange.dateFrom || customRange.from || customRange.startDate;
      const rawTo = customRange.dateTo || customRange.to || customRange.endDate;
      if (rawFrom && rawTo) {
        const validation = validateDateRange(rawFrom, rawTo);
        if (!validation.valid) {
          const err = new Error(validation.error);
          err.statusCode = 400;
          err.code = 'INVALID_DATE_RANGE';
          throw err;
        }
        return {
          periodId: 'CUSTOM',
          dateFrom: rawFrom,
          dateTo: rawTo,
          label: `${rawFrom} to ${rawTo}`,
        };
      }
      // Default to MTD if not custom range provided
      const firstDay = `${currentYear}-${String(currentMonth).padStart(2, '0')}-01`;
      return {
        periodId: 'MTD',
        dateFrom: firstDay,
        dateTo: todayStr,
        label: 'Month to Date',
      };
    }
  }
}

/**
 * Resolves standard period name into canonical date boundaries { dateFrom, dateTo, periodId, daysInPeriod }.
 * @param {string} periodName
 * @param {object} [customRange={}]
 * @returns {{ periodId: string, dateFrom: string, dateTo: string, daysInPeriod: number, label: string }}
 */
function resolveReportPeriod(periodName = 'MTD', customRange = {}) {
  const period = _resolveReportPeriodRaw(periodName, customRange);
  if (period && period.dateFrom && period.dateTo) {
    const fromMs = new Date(Date.UTC(...period.dateFrom.split('-').map(Number).map((v, i) => i === 1 ? v - 1 : v))).getTime();
    const toMs = new Date(Date.UTC(...period.dateTo.split('-').map(Number).map((v, i) => i === 1 ? v - 1 : v))).getTime();
    period.daysInPeriod = Math.round((toMs - fromMs) / (1000 * 60 * 60 * 24)) + 1;
  }
  return period;
}

/**
 * Resolves comparison period for an active report period.
 * @param {{ dateFrom: string, dateTo: string }} currentPeriod
 * @param {'PRIOR_PERIOD'|'PRIOR_YEAR'|'BUDGET'|'FORECAST'} [comparisonType='PRIOR_PERIOD']
 * @returns {{ comparisonType: string, dateFrom: string, dateTo: string, daysInPeriod: number, label: string }}
 */
function resolveComparisonPeriod(currentPeriod, comparisonType = 'PRIOR_PERIOD') {
  const { dateFrom, dateTo } = currentPeriod;
  const fromMs = new Date(Date.UTC(...dateFrom.split('-').map(Number).map((v, i) => i === 1 ? v - 1 : v))).getTime();
  const toMs = new Date(Date.UTC(...dateTo.split('-').map(Number).map((v, i) => i === 1 ? v - 1 : v))).getTime();
  const durationDays = Math.round((toMs - fromMs) / (1000 * 60 * 60 * 24)) + 1;

  if (comparisonType === 'PRIOR_YEAR') {
    const [fy, fm, fd] = dateFrom.split('-').map(Number);
    const [ty, tm, td] = dateTo.split('-').map(Number);
    const isLeap = (y) => (y % 4 === 0 && y % 100 !== 0) || (y % 400 === 0);
    const adjFd = (!isLeap(fy - 1) && fm === 2 && fd === 29) ? 28 : fd;
    const adjTd = (!isLeap(ty - 1) && tm === 2 && td === 29) ? 28 : td;
    const compFrom = `${fy - 1}-${String(fm).padStart(2, '0')}-${String(adjFd).padStart(2, '0')}`;
    const compTo = `${ty - 1}-${String(tm).padStart(2, '0')}-${String(adjTd).padStart(2, '0')}`;
    const compFromMs = new Date(Date.UTC(fy - 1, fm - 1, adjFd)).getTime();
    const compToMs = new Date(Date.UTC(ty - 1, tm - 1, adjTd)).getTime();
    const compDays = Math.round((compToMs - compFromMs) / (1000 * 60 * 60 * 24)) + 1;
    return {
      comparisonType: 'PRIOR_YEAR',
      dateFrom: compFrom,
      dateTo: compTo,
      daysInPeriod: compDays,
      label: `Prior Year (${compFrom} to ${compTo})`,
    };
  }

  if (comparisonType === 'BUDGET' || comparisonType === 'FORECAST') {
    return {
      comparisonType,
      dateFrom,
      dateTo,
      daysInPeriod: durationDays,
      label: `${comparisonType} Target (${dateFrom} to ${dateTo})`,
      isBenchmark: true,
    };
  }

  // Default: PRIOR_PERIOD
  const compTo = shiftDays(dateFrom, -1);
  const compFrom = shiftDays(compTo, -(durationDays - 1));
  return {
    comparisonType: 'PRIOR_PERIOD',
    dateFrom: compFrom,
    dateTo: compTo,
    daysInPeriod: durationDays,
    label: `Prior Period (${compFrom} to ${compTo})`,
  };
}

module.exports = {
  TIMEZONE,
  getIstDate,
  getIstTodayDateString,
  formatDateToIst,
  validateDateRange,
  shiftDays,
  resolveReportPeriod,
  resolveComparisonPeriod,
};
