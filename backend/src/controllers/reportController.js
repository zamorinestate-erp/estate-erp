'use strict';

const { Attendance } = require('../models/Attendance');
const { CashTransaction } = require('../models/CashTransaction');
const { Expense } = require('../models/Expense');
const { Cafe } = require('../models/Cafe');
const { asyncHandler } = require('../utils/asyncHandler');
const { ApiError } = require('../utils/ApiError');

// ─── Helpers ───────────────────────────────────────────────────────────────────

function getIstBusinessDate(date = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

function parseDateString(dateStr) {
  const [year, month, day] = dateStr.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

function validateAndParseDateFilters(request) {
  const { businessDate, dateFrom, dateTo, cafeId } = request.query;

  const rawCafeId = typeof cafeId === 'string' ? cafeId.trim().toUpperCase() : null;

  const rawBusinessDate = typeof businessDate === 'string' ? businessDate.trim() : '';
  const rawDateFrom = typeof dateFrom === 'string' ? dateFrom.trim() : '';
  const rawDateTo = typeof dateTo === 'string' ? dateTo.trim() : '';

  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;

  let finalBusinessDate = null;
  let finalDateFrom = null;
  let finalDateTo = null;

  if (rawBusinessDate) {
    if (!dateRegex.test(rawBusinessDate)) {
      throw new ApiError(400, 'INVALID_BUSINESS_DATE', 'businessDate must use YYYY-MM-DD format.');
    }
    finalBusinessDate = rawBusinessDate;
  } else if (rawDateFrom || rawDateTo) {
    if (rawDateFrom && !dateRegex.test(rawDateFrom)) {
      throw new ApiError(400, 'INVALID_DATE_FROM', 'dateFrom must use YYYY-MM-DD format.');
    }
    if (rawDateTo && !dateRegex.test(rawDateTo)) {
      throw new ApiError(400, 'INVALID_DATE_TO', 'dateTo must use YYYY-MM-DD format.');
    }

    if (rawDateFrom && rawDateTo) {
      const dFrom = parseDateString(rawDateFrom);
      const dTo = parseDateString(rawDateTo);

      if (dFrom > dTo) {
        throw new ApiError(400, 'INVALID_DATE_RANGE', 'dateFrom cannot be later than dateTo.');
      }

      const diffMs = dTo.getTime() - dFrom.getTime();
      const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
      if (diffDays > 366) {
        throw new ApiError(400, 'DATE_RANGE_EXCEEDED', 'Date range cannot exceed 366 days.');
      }
    }

    finalDateFrom = rawDateFrom || null;
    finalDateTo = rawDateTo || null;
  } else {
    finalBusinessDate = getIstBusinessDate();
  }

  return {
    cafeId: rawCafeId,
    businessDate: finalBusinessDate,
    dateFrom: finalDateFrom,
    dateTo: finalDateTo,
  };
}

function buildBaseFilter(request, dateFilters) {
  const { role, organisationId, assignedCafeIds } = request.auth;

  if (role === 'STAFF') {
    throw new ApiError(
      403,
      'REPORT_ACCESS_DENIED',
      'Staff users cannot access management reports.'
    );
  }

  const filter = { organisationId };

  if (dateFilters.cafeId) {
    if (role === 'CAFE_ADMIN' && !(assignedCafeIds || []).includes(dateFilters.cafeId)) {
      throw new ApiError(
        403,
        'CAFE_ACCESS_DENIED',
        'You do not have access to this cafe.'
      );
    }
    filter.cafeId = dateFilters.cafeId;
  } else if (role === 'CAFE_ADMIN') {
    filter.cafeId = { $in: assignedCafeIds || [] };
  }

  if (dateFilters.businessDate) {
    filter.businessDate = dateFilters.businessDate;
  } else if (dateFilters.dateFrom || dateFilters.dateTo) {
    const range = {};
    if (dateFilters.dateFrom) range.$gte = dateFilters.dateFrom;
    if (dateFilters.dateTo) range.$lte = dateFilters.dateTo;
    filter.businessDate = range;
  }

  return filter;
}

async function getCafeCountInScope(request, dateFilters) {
  const { role, organisationId, assignedCafeIds } = request.auth;
  const cafeQuery = { organisationId, archivedAt: null };

  if (dateFilters.cafeId) {
    cafeQuery.cafeId = dateFilters.cafeId;
  } else if (role === 'CAFE_ADMIN') {
    cafeQuery.cafeId = { $in: assignedCafeIds || [] };
  }

  return Cafe.countDocuments(cafeQuery);
}

// ─── 1. GET /reports/dashboard ─────────────────────────────────────────────────

const getDashboardReport = asyncHandler(async (request, response) => {
  const dateFilters = validateAndParseDateFilters(request);
  const baseFilter = buildBaseFilter(request, dateFilters);

  const [numberOfCafes, cashAgg, expenseAgg, attendanceAgg, dailyCash, dailyExpenses, dailyAttendance] =
    await Promise.all([
      getCafeCountInScope(request, dateFilters),

      // Cash transaction aggregations
      CashTransaction.aggregate([
        { $match: baseFilter },
        {
          $group: {
            _id: null,
            totalCount: { $sum: 1 },
            postedCount: {
              $sum: { $cond: [{ $eq: ['$status', 'POSTED'] }, 1, 0] },
            },
            inflow: {
              $sum: {
                $cond: [
                  {
                    $and: [
                      { $eq: ['$status', 'POSTED'] },
                      { $eq: ['$direction', 'IN'] },
                    ],
                  },
                  '$amount',
                  0,
                ],
              },
            },
            outflow: {
              $sum: {
                $cond: [
                  {
                    $and: [
                      { $eq: ['$status', 'POSTED'] },
                      { $eq: ['$direction', 'OUT'] },
                    ],
                  },
                  '$amount',
                  0,
                ],
              },
            },
            reversedAmount: {
              $sum: {
                $cond: [{ $eq: ['$status', 'REVERSED'] }, '$amount', 0],
              },
            },
          },
        },
      ]),

      // Expense aggregations
      Expense.aggregate([
        { $match: baseFilter },
        {
          $group: {
            _id: null,
            totalCount: { $sum: 1 },
            totalAmount: { $sum: '$amount' },
            approvedAmount: {
              $sum: {
                $cond: [{ $eq: ['$status', 'APPROVED'] }, '$amount', 0],
              },
            },
            paidAmount: {
              $sum: {
                $cond: [{ $eq: ['$status', 'PAID'] }, '$amount', 0],
              },
            },
            submittedAmount: {
              $sum: {
                $cond: [{ $eq: ['$status', 'SUBMITTED'] }, '$amount', 0],
              },
            },
            reversedAmount: {
              $sum: {
                $cond: [{ $eq: ['$status', 'REVERSED'] }, '$amount', 0],
              },
            },
          },
        },
      ]),

      // Attendance aggregations
      Attendance.aggregate([
        { $match: baseFilter },
        {
          $group: {
            _id: null,
            totalRecords: { $sum: 1 },
            checkedInCount: {
              $sum: {
                $cond: [{ $eq: ['$status', 'CHECKED_IN'] }, 1, 0],
              },
            },
            checkedOutCount: {
              $sum: {
                $cond: [{ $eq: ['$status', 'CHECKED_OUT'] }, 1, 0],
              },
            },
            absentCount: {
              $sum: {
                $cond: [{ $eq: ['$status', 'ABSENT'] }, 1, 0],
              },
            },
          },
        },
      ]),

      // Cash breakdown by date
      CashTransaction.aggregate([
        { $match: { ...baseFilter, status: 'POSTED' } },
        {
          $group: {
            _id: '$businessDate',
            inflow: {
              $sum: { $cond: [{ $eq: ['$direction', 'IN'] }, '$amount', 0] },
            },
            outflow: {
              $sum: { $cond: [{ $eq: ['$direction', 'OUT'] }, '$amount', 0] },
            },
            transactionCount: { $sum: 1 },
          },
        },
        { $sort: { _id: 1 } },
      ]),

      // Expense breakdown by date
      Expense.aggregate([
        { $match: baseFilter },
        {
          $group: {
            _id: '$businessDate',
            expenseAmount: { $sum: '$amount' },
            expenseCount: { $sum: 1 },
          },
        },
        { $sort: { _id: 1 } },
      ]),

      // Attendance breakdown by date
      Attendance.aggregate([
        { $match: baseFilter },
        {
          $group: {
            _id: '$businessDate',
            attendanceCount: { $sum: 1 },
          },
        },
        { $sort: { _id: 1 } },
      ]),
    ]);

  const [cashByDirection, cashByPaymentMethod, expenseByStatus, attendanceByStatus] =
    await Promise.all([
      CashTransaction.aggregate([
        { $match: { ...baseFilter, status: 'POSTED' } },
        {
          $group: {
            _id: '$direction',
            count: { $sum: 1 },
            totalAmount: { $sum: '$amount' },
          },
        },
        { $sort: { _id: 1 } },
      ]),

      CashTransaction.aggregate([
        { $match: { ...baseFilter, status: 'POSTED' } },
        {
          $group: {
            _id: '$paymentMethod',
            count: { $sum: 1 },
            totalAmount: { $sum: '$amount' },
          },
        },
        { $sort: { totalAmount: -1 } },
      ]),

      Expense.aggregate([
        { $match: baseFilter },
        {
          $group: {
            _id: '$status',
            count: { $sum: 1 },
            totalAmount: { $sum: '$amount' },
          },
        },
        { $sort: { _id: 1 } },
      ]),

      Attendance.aggregate([
        { $match: baseFilter },
        {
          $group: {
            _id: '$status',
            count: { $sum: 1 },
          },
        },
        { $sort: { _id: 1 } },
      ]),
    ]);

  const cashRes = cashAgg[0] || {};
  const expRes = expenseAgg[0] || {};
  const attRes = attendanceAgg[0] || {};

  const totalCashInflow = cashRes.inflow || 0;
  const totalCashOutflow = cashRes.outflow || 0;
  const netCashFlow = totalCashInflow - totalCashOutflow;

  // Combine daily totals
  const datesMap = new Map();

  dailyCash.forEach((item) => {
    datesMap.set(item._id, {
      businessDate: item._id,
      cashInflow: item.inflow,
      cashOutflow: item.outflow,
      netCashFlow: item.inflow - item.outflow,
      expenseAmount: 0,
      attendanceCount: 0,
    });
  });

  dailyExpenses.forEach((item) => {
    const existing = datesMap.get(item._id) || {
      businessDate: item._id,
      cashInflow: 0,
      cashOutflow: 0,
      netCashFlow: 0,
      expenseAmount: 0,
      attendanceCount: 0,
    };
    existing.expenseAmount = item.expenseAmount;
    datesMap.set(item._id, existing);
  });

  dailyAttendance.forEach((item) => {
    const existing = datesMap.get(item._id) || {
      businessDate: item._id,
      cashInflow: 0,
      cashOutflow: 0,
      netCashFlow: 0,
      expenseAmount: 0,
      attendanceCount: 0,
    };
    existing.attendanceCount = item.attendanceCount;
    datesMap.set(item._id, existing);
  });

  const totalsByBusinessDate = Array.from(datesMap.values()).sort((a, b) =>
    a.businessDate.localeCompare(b.businessDate)
  );

  return response.status(200).json({
    success: true,
    data: {
      currency: 'INR',
      selectedFilters: dateFilters,
      numberOfCafes,

      // Cash summary
      totalCashTransactionCount: cashRes.postedCount || 0,
      totalCashInflow,
      totalCashOutflow,
      netCashFlow,

      // Expense summary
      totalExpenseCount: expRes.totalCount || 0,
      totalExpenseAmount: expRes.totalAmount || 0,
      approvedExpenseAmount: expRes.approvedAmount || 0,
      paidExpenseAmount: expRes.paidAmount || 0,
      submittedExpenseAmount: expRes.submittedAmount || 0,
      reversedExpenseAmount: expRes.reversedAmount || 0,

      // Attendance summary
      attendanceRecordCount: attRes.totalRecords || 0,
      checkedInCount: attRes.checkedInCount || 0,
      completedAttendanceCount: attRes.checkedOutCount || 0,
      absentCount: attRes.absentCount || 0,

      // Breakdowns
      breakdowns: {
        cashByDirection,
        cashByPaymentMethod,
        expenseByStatus,
        attendanceByStatus,
        totalsByBusinessDate,
      },
    },
    correlationId: request.correlationId || null,
  });
});

// ─── 2. GET /reports/cash-flow ─────────────────────────────────────────────────

const getCashFlowReport = asyncHandler(async (request, response) => {
  const dateFilters = validateAndParseDateFilters(request);
  const baseFilter = buildBaseFilter(request, dateFilters);

  const [
    numberOfCafes,
    totalsAgg,
    byBusinessDate,
    byCafe,
    byTransactionType,
    byDirection,
    byPaymentMethod,
    byCategory,
    recentTransactions,
  ] = await Promise.all([
    getCafeCountInScope(request, dateFilters),

    CashTransaction.aggregate([
      { $match: baseFilter },
      {
        $group: {
          _id: null,
          totalCount: {
            $sum: { $cond: [{ $eq: ['$status', 'POSTED'] }, 1, 0] },
          },
          inflow: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $eq: ['$status', 'POSTED'] },
                    { $eq: ['$direction', 'IN'] },
                  ],
                },
                '$amount',
                0,
              ],
            },
          },
          outflow: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $eq: ['$status', 'POSTED'] },
                    { $eq: ['$direction', 'OUT'] },
                  ],
                },
                '$amount',
                0,
              ],
            },
          },
          reversedCount: {
            $sum: { $cond: [{ $eq: ['$status', 'REVERSED'] }, 1, 0] },
          },
          reversedAmount: {
            $sum: {
              $cond: [{ $eq: ['$status', 'REVERSED'] }, '$amount', 0],
            },
          },
        },
      },
    ]),

    CashTransaction.aggregate([
      { $match: { ...baseFilter, status: 'POSTED' } },
      {
        $group: {
          _id: '$businessDate',
          inflow: {
            $sum: { $cond: [{ $eq: ['$direction', 'IN'] }, '$amount', 0] },
          },
          outflow: {
            $sum: { $cond: [{ $eq: ['$direction', 'OUT'] }, '$amount', 0] },
          },
          transactionCount: { $sum: 1 },
        },
      },
      {
        $project: {
          businessDate: '$_id',
          _id: 0,
          inflow: 1,
          outflow: 1,
          netCashFlow: { $subtract: ['$inflow', '$outflow'] },
          transactionCount: 1,
        },
      },
      { $sort: { businessDate: 1 } },
    ]),

    CashTransaction.aggregate([
      { $match: { ...baseFilter, status: 'POSTED' } },
      {
        $group: {
          _id: '$cafeId',
          inflow: {
            $sum: { $cond: [{ $eq: ['$direction', 'IN'] }, '$amount', 0] },
          },
          outflow: {
            $sum: { $cond: [{ $eq: ['$direction', 'OUT'] }, '$amount', 0] },
          },
          transactionCount: { $sum: 1 },
        },
      },
      {
        $project: {
          cafeId: '$_id',
          _id: 0,
          inflow: 1,
          outflow: 1,
          netCashFlow: { $subtract: ['$inflow', '$outflow'] },
          transactionCount: 1,
        },
      },
      { $sort: { cafeId: 1 } },
    ]),

    CashTransaction.aggregate([
      { $match: { ...baseFilter, status: 'POSTED' } },
      {
        $group: {
          _id: '$transactionType',
          direction: { $first: '$direction' },
          count: { $sum: 1 },
          totalAmount: { $sum: '$amount' },
        },
      },
      { $sort: { totalAmount: -1 } },
    ]),

    CashTransaction.aggregate([
      { $match: { ...baseFilter, status: 'POSTED' } },
      {
        $group: {
          _id: '$direction',
          count: { $sum: 1 },
          totalAmount: { $sum: '$amount' },
        },
      },
      { $sort: { _id: 1 } },
    ]),

    CashTransaction.aggregate([
      { $match: { ...baseFilter, status: 'POSTED' } },
      {
        $group: {
          _id: '$paymentMethod',
          count: { $sum: 1 },
          totalAmount: { $sum: '$amount' },
        },
      },
      { $sort: { totalAmount: -1 } },
    ]),

    CashTransaction.aggregate([
      { $match: { ...baseFilter, status: 'POSTED' } },
      {
        $group: {
          _id: '$category',
          count: { $sum: 1 },
          totalAmount: { $sum: '$amount' },
        },
      },
      { $sort: { totalAmount: -1 } },
    ]),

    CashTransaction.find(baseFilter)
      .sort({ recordedAt: -1, cashTransactionId: -1 })
      .limit(50)
      .lean(),
  ]);

  const res = totalsAgg[0] || {};
  const totalInflow = res.inflow || 0;
  const totalOutflow = res.outflow || 0;

  return response.status(200).json({
    success: true,
    data: {
      currency: 'INR',
      selectedFilters: dateFilters,
      numberOfCafes,
      totalTransactionCount: res.totalCount || 0,
      totalInflow,
      totalOutflow,
      netCashFlow: totalInflow - totalOutflow,
      reversedTransactionCount: res.reversedCount || 0,
      reversedAmount: res.reversedAmount || 0,

      byBusinessDate,
      byCafe,
      byTransactionType,
      byDirection,
      byPaymentMethod,
      byCategory,
      recentTransactions,
    },
    correlationId: request.correlationId || null,
  });
});

// ─── 3. GET /reports/expenses ──────────────────────────────────────────────────

const getExpensesReport = asyncHandler(async (request, response) => {
  const dateFilters = validateAndParseDateFilters(request);
  const baseFilter = buildBaseFilter(request, dateFilters);

  const [
    numberOfCafes,
    totalsAgg,
    byBusinessDate,
    byCafe,
    byStatus,
    byCategory,
    byPaymentMethod,
    recentExpenses,
  ] = await Promise.all([
    getCafeCountInScope(request, dateFilters),

    Expense.aggregate([
      { $match: baseFilter },
      {
        $group: {
          _id: null,
          totalExpenseCount: { $sum: 1 },
          totalAmount: { $sum: '$amount' },
          approvedAmount: {
            $sum: {
              $cond: [{ $eq: ['$status', 'APPROVED'] }, '$amount', 0],
            },
          },
          paidAmount: {
            $sum: {
              $cond: [{ $eq: ['$status', 'PAID'] }, '$amount', 0],
            },
          },
          submittedAmount: {
            $sum: {
              $cond: [{ $eq: ['$status', 'SUBMITTED'] }, '$amount', 0],
            },
          },
          rejectedAmount: {
            $sum: {
              $cond: [{ $eq: ['$status', 'REJECTED'] }, '$amount', 0],
            },
          },
          returnedAmount: {
            $sum: {
              $cond: [{ $eq: ['$status', 'RETURNED'] }, '$amount', 0],
            },
          },
          reversedAmount: {
            $sum: {
              $cond: [{ $eq: ['$status', 'REVERSED'] }, '$amount', 0],
            },
          },
        },
      },
    ]),

    Expense.aggregate([
      { $match: baseFilter },
      {
        $group: {
          _id: '$businessDate',
          totalAmount: { $sum: '$amount' },
          count: { $sum: 1 },
          paidAmount: {
            $sum: { $cond: [{ $eq: ['$status', 'PAID'] }, '$amount', 0] },
          },
          approvedAmount: {
            $sum: { $cond: [{ $eq: ['$status', 'APPROVED'] }, '$amount', 0] },
          },
        },
      },
      {
        $project: {
          businessDate: '$_id',
          _id: 0,
          totalAmount: 1,
          count: 1,
          paidAmount: 1,
          approvedAmount: 1,
        },
      },
      { $sort: { businessDate: 1 } },
    ]),

    Expense.aggregate([
      { $match: baseFilter },
      {
        $group: {
          _id: '$cafeId',
          totalAmount: { $sum: '$amount' },
          count: { $sum: 1 },
          paidAmount: {
            $sum: { $cond: [{ $eq: ['$status', 'PAID'] }, '$amount', 0] },
          },
          approvedAmount: {
            $sum: { $cond: [{ $eq: ['$status', 'APPROVED'] }, '$amount', 0] },
          },
        },
      },
      {
        $project: {
          cafeId: '$_id',
          _id: 0,
          totalAmount: 1,
          count: 1,
          paidAmount: 1,
          approvedAmount: 1,
        },
      },
      { $sort: { cafeId: 1 } },
    ]),

    Expense.aggregate([
      { $match: baseFilter },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
          totalAmount: { $sum: '$amount' },
        },
      },
      { $sort: { _id: 1 } },
    ]),

    Expense.aggregate([
      { $match: baseFilter },
      {
        $group: {
          _id: '$category',
          count: { $sum: 1 },
          totalAmount: { $sum: '$amount' },
        },
      },
      { $sort: { totalAmount: -1 } },
    ]),

    Expense.aggregate([
      { $match: baseFilter },
      {
        $group: {
          _id: '$paymentMethod',
          count: { $sum: 1 },
          totalAmount: { $sum: '$amount' },
        },
      },
      { $sort: { totalAmount: -1 } },
    ]),

    Expense.find(baseFilter)
      .sort({ createdAt: -1, expenseId: -1 })
      .limit(50)
      .lean(),
  ]);

  const res = totalsAgg[0] || {};

  return response.status(200).json({
    success: true,
    data: {
      currency: 'INR',
      selectedFilters: dateFilters,
      numberOfCafes,
      totalExpenseCount: res.totalExpenseCount || 0,
      totalAmount: res.totalAmount || 0,
      approvedAmount: res.approvedAmount || 0,
      paidAmount: res.paidAmount || 0,
      submittedAmount: res.submittedAmount || 0,
      rejectedAmount: res.rejectedAmount || 0,
      returnedAmount: res.returnedAmount || 0,
      reversedAmount: res.reversedAmount || 0,

      byBusinessDate,
      byCafe,
      byStatus,
      byCategory,
      byPaymentMethod,
      recentExpenses,
    },
    correlationId: request.correlationId || null,
  });
});

// ─── 4. GET /reports/attendance ────────────────────────────────────────────────

const getAttendanceReport = asyncHandler(async (request, response) => {
  const dateFilters = validateAndParseDateFilters(request);
  const baseFilter = buildBaseFilter(request, dateFilters);

  const [
    numberOfCafes,
    totalsAgg,
    byBusinessDate,
    byCafe,
    byStatus,
    byUser,
    recentAttendance,
  ] = await Promise.all([
    getCafeCountInScope(request, dateFilters),

    Attendance.aggregate([
      { $match: baseFilter },
      {
        $group: {
          _id: null,
          totalRecords: { $sum: 1 },
          checkedInCount: {
            $sum: { $cond: [{ $eq: ['$status', 'CHECKED_IN'] }, 1, 0] },
          },
          checkedOutCount: {
            $sum: { $cond: [{ $eq: ['$status', 'CHECKED_OUT'] }, 1, 0] },
          },
          totalWorkedMinutes: { $sum: '$totalWorkedMinutes' },
        },
      },
    ]),

    Attendance.aggregate([
      { $match: baseFilter },
      {
        $group: {
          _id: '$businessDate',
          recordCount: { $sum: 1 },
          checkedInCount: {
            $sum: { $cond: [{ $eq: ['$status', 'CHECKED_IN'] }, 1, 0] },
          },
          checkedOutCount: {
            $sum: { $cond: [{ $eq: ['$status', 'CHECKED_OUT'] }, 1, 0] },
          },
          totalWorkedMinutes: { $sum: '$totalWorkedMinutes' },
        },
      },
      {
        $project: {
          businessDate: '$_id',
          _id: 0,
          recordCount: 1,
          checkedInCount: 1,
          checkedOutCount: 1,
          totalWorkedMinutes: 1,
        },
      },
      { $sort: { businessDate: 1 } },
    ]),

    Attendance.aggregate([
      { $match: baseFilter },
      {
        $group: {
          _id: '$cafeId',
          recordCount: { $sum: 1 },
          checkedInCount: {
            $sum: { $cond: [{ $eq: ['$status', 'CHECKED_IN'] }, 1, 0] },
          },
          checkedOutCount: {
            $sum: { $cond: [{ $eq: ['$status', 'CHECKED_OUT'] }, 1, 0] },
          },
          totalWorkedMinutes: { $sum: '$totalWorkedMinutes' },
        },
      },
      {
        $project: {
          cafeId: '$_id',
          _id: 0,
          recordCount: 1,
          checkedInCount: 1,
          checkedOutCount: 1,
          totalWorkedMinutes: 1,
        },
      },
      { $sort: { cafeId: 1 } },
    ]),

    Attendance.aggregate([
      { $match: baseFilter },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]),

    Attendance.aggregate([
      { $match: baseFilter },
      {
        $group: {
          _id: '$userId',
          recordCount: { $sum: 1 },
          checkedInCount: {
            $sum: { $cond: [{ $eq: ['$status', 'CHECKED_IN'] }, 1, 0] },
          },
          checkedOutCount: {
            $sum: { $cond: [{ $eq: ['$status', 'CHECKED_OUT'] }, 1, 0] },
          },
          totalWorkedMinutes: { $sum: '$totalWorkedMinutes' },
        },
      },
      {
        $project: {
          userId: '$_id',
          _id: 0,
          recordCount: 1,
          checkedInCount: 1,
          checkedOutCount: 1,
          totalWorkedMinutes: 1,
        },
      },
      { $sort: { totalWorkedMinutes: -1 } },
    ]),

    Attendance.find(baseFilter)
      .sort({ businessDate: -1, checkInAt: -1 })
      .limit(50)
      .lean(),
  ]);

  const res = totalsAgg[0] || {};
  const totalWorkedMinutes = res.totalWorkedMinutes || 0;
  const totalWorkedHours = Math.round((totalWorkedMinutes / 60) * 100) / 100;

  return response.status(200).json({
    success: true,
    data: {
      selectedFilters: dateFilters,
      numberOfCafes,
      totalAttendanceRecords: res.totalRecords || 0,
      checkedInCount: res.checkedInCount || 0,
      checkedOutCount: res.checkedOutCount || 0,
      openShifts: res.checkedInCount || 0,
      totalWorkedMinutes,
      totalWorkedHours,

      byBusinessDate,
      byCafe,
      byStatus,
      byUser,
      recentAttendance,
    },
    correlationId: request.correlationId || null,
  });
});

// ─── 5. GET /reports/daily-summary ─────────────────────────────────────────────

const getDailySummaryReport = asyncHandler(async (request, response) => {
  const targetBusinessDate =
    typeof request.query.businessDate === 'string' && request.query.businessDate.trim()
      ? request.query.businessDate.trim()
      : getIstBusinessDate();

  if (!/^\d{4}-\d{2}-\d{2}$/.test(targetBusinessDate)) {
    throw new ApiError(400, 'INVALID_BUSINESS_DATE', 'businessDate must use YYYY-MM-DD format.');
  }

  const dateFilters = {
    cafeId: typeof request.query.cafeId === 'string' ? request.query.cafeId.trim().toUpperCase() : null,
    businessDate: targetBusinessDate,
    dateFrom: null,
    dateTo: null,
  };

  const baseFilter = buildBaseFilter(request, dateFilters);

  const [
    numberOfCafes,
    cashAgg,
    expenseAgg,
    attendanceAgg,
    openAttendanceShifts,
    submittedExpensesAwaitingDecision,
    approvedExpensesNotPaid,
    reversedCashTransactions,
    reversedExpenses,
  ] = await Promise.all([
    getCafeCountInScope(request, dateFilters),

    // Cash Summary for the day
    CashTransaction.aggregate([
      { $match: baseFilter },
      {
        $group: {
          _id: null,
          postedCount: {
            $sum: { $cond: [{ $eq: ['$status', 'POSTED'] }, 1, 0] },
          },
          inflow: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $eq: ['$status', 'POSTED'] },
                    { $eq: ['$direction', 'IN'] },
                  ],
                },
                '$amount',
                0,
              ],
            },
          },
          outflow: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $eq: ['$status', 'POSTED'] },
                    { $eq: ['$direction', 'OUT'] },
                  ],
                },
                '$amount',
                0,
              ],
            },
          },
          reversedCount: {
            $sum: { $cond: [{ $eq: ['$status', 'REVERSED'] }, 1, 0] },
          },
          reversedAmount: {
            $sum: {
              $cond: [{ $eq: ['$status', 'REVERSED'] }, '$amount', 0],
            },
          },
        },
      },
    ]),

    // Expense Summary for the day
    Expense.aggregate([
      { $match: baseFilter },
      {
        $group: {
          _id: null,
          totalCount: { $sum: 1 },
          totalAmount: { $sum: '$amount' },
          approvedAmount: {
            $sum: {
              $cond: [{ $eq: ['$status', 'APPROVED'] }, '$amount', 0],
            },
          },
          paidAmount: {
            $sum: {
              $cond: [{ $eq: ['$status', 'PAID'] }, '$amount', 0],
            },
          },
          submittedAmount: {
            $sum: {
              $cond: [{ $eq: ['$status', 'SUBMITTED'] }, '$amount', 0],
            },
          },
          rejectedAmount: {
            $sum: {
              $cond: [{ $eq: ['$status', 'REJECTED'] }, '$amount', 0],
            },
          },
          returnedAmount: {
            $sum: {
              $cond: [{ $eq: ['$status', 'RETURNED'] }, '$amount', 0],
            },
          },
          reversedAmount: {
            $sum: {
              $cond: [{ $eq: ['$status', 'REVERSED'] }, '$amount', 0],
            },
          },
        },
      },
    ]),

    // Attendance Summary for the day
    Attendance.aggregate([
      { $match: baseFilter },
      {
        $group: {
          _id: null,
          totalRecords: { $sum: 1 },
          checkedInCount: {
            $sum: { $cond: [{ $eq: ['$status', 'CHECKED_IN'] }, 1, 0] },
          },
          checkedOutCount: {
            $sum: { $cond: [{ $eq: ['$status', 'CHECKED_OUT'] }, 1, 0] },
          },
          absentCount: {
            $sum: { $cond: [{ $eq: ['$status', 'ABSENT'] }, 1, 0] },
          },
          totalWorkedMinutes: { $sum: '$totalWorkedMinutes' },
        },
      },
    ]),

    // Exception 1: Open attendance shifts (CHECKED_IN)
    Attendance.find({ ...baseFilter, status: 'CHECKED_IN' })
      .select('attendanceId userId cafeId checkInAt')
      .limit(50)
      .lean(),

    // Exception 2: Submitted expenses awaiting decision
    Expense.find({ ...baseFilter, status: 'SUBMITTED' })
      .select('expenseId cafeId amount category submittedAt submittedBy description')
      .limit(50)
      .lean(),

    // Exception 3: Approved expenses not yet marked paid
    Expense.find({ ...baseFilter, status: 'APPROVED' })
      .select('expenseId cafeId amount category decisionAt decisionBy description')
      .limit(50)
      .lean(),

    // Exception 4a: Reversed cash transactions
    CashTransaction.find({ ...baseFilter, status: 'REVERSED' })
      .select('cashTransactionId cafeId amount reversedAt reversedBy reversalReason')
      .limit(50)
      .lean(),

    // Exception 4b: Reversed expenses
    Expense.find({ ...baseFilter, status: 'REVERSED' })
      .select('expenseId cafeId amount reversedAt reversedBy reversalReason')
      .limit(50)
      .lean(),
  ]);

  const cashRes = cashAgg[0] || {};
  const expRes = expenseAgg[0] || {};
  const attRes = attendanceAgg[0] || {};

  const totalInflow = cashRes.inflow || 0;
  const totalOutflow = cashRes.outflow || 0;

  return response.status(200).json({
    success: true,
    data: {
      businessDate: targetBusinessDate,
      selectedFilters: dateFilters,
      numberOfCafes,

      cashSummary: {
        currency: 'INR',
        transactionCount: cashRes.postedCount || 0,
        totalInflow,
        totalOutflow,
        netCashFlow: totalInflow - totalOutflow,
        reversedCount: cashRes.reversedCount || 0,
        reversedAmount: cashRes.reversedAmount || 0,
      },

      expenseSummary: {
        currency: 'INR',
        totalCount: expRes.totalCount || 0,
        totalAmount: expRes.totalAmount || 0,
        approvedAmount: expRes.approvedAmount || 0,
        paidAmount: expRes.paidAmount || 0,
        submittedAmount: expRes.submittedAmount || 0,
        rejectedAmount: expRes.rejectedAmount || 0,
        returnedAmount: expRes.returnedAmount || 0,
        reversedAmount: expRes.reversedAmount || 0,
      },

      attendanceSummary: {
        totalRecords: attRes.totalRecords || 0,
        checkedInCount: attRes.checkedInCount || 0,
        checkedOutCount: attRes.checkedOutCount || 0,
        absentCount: attRes.absentCount || 0,
        openShifts: attRes.checkedInCount || 0,
        totalWorkedMinutes: attRes.totalWorkedMinutes || 0,
      },

      exceptions: {
        openAttendanceShifts,
        submittedExpensesAwaitingDecision,
        approvedExpensesNotPaid,
        reversedTransactions: {
          reversedCashTransactions,
          reversedExpenses,
        },
      },
    },
    correlationId: request.correlationId || null,
  });
});

// ─── Exports ───────────────────────────────────────────────────────────────────

module.exports = {
  getDashboardReport,
  getCashFlowReport,
  getExpensesReport,
  getAttendanceReport,
  getDailySummaryReport,
};
