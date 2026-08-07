'use strict';

/**
 * DASHBOARD CONTROLLER
 *
 * Role-aware aggregations for Command Centre.
 * Computes live metrics from Bill, CafeInventoryConfig, Task, Approval, Expense.
 */

const { Bill } = require('../models/Bill');
const { CafeInventoryConfig } = require('../models/CafeInventoryConfig');
const { Task } = require('../models/Task');
const { Approval } = require('../models/Approval');
const { Expense } = require('../models/Expense');
const { Cafe } = require('../models/Cafe');

const { asyncHandler } = require('../utils/asyncHandler');

function getIstBusinessDate(date = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

const getDashboardMetrics = asyncHandler(async (request, response) => {
  const orgId = request.auth.organisationId;
  const role = request.auth.role;
  const today = getIstBusinessDate();

  let cafeFilter = {};
  if (role !== 'MASTER' && role !== 'OWNER') {
    cafeFilter = { cafeId: { $in: request.auth.assignedCafeIds } };
  }

  // 1. Sales & Bills today
  const billMatch = {
    organisationId: orgId,
    businessDate: today,
    status: 'COMPLETED',
    ...cafeFilter,
  };

  const salesAggr = await Bill.aggregate([
    { $match: billMatch },
    {
      $group: {
        _id: null,
        totalSalesPaisa: { $sum: '$totalPaisa' },
        totalBillsCount: { $sum: 1 },
      },
    },
  ]);

  const totalSalesPaisa = salesAggr[0]?.totalSalesPaisa || 0;
  const totalBillsCount = salesAggr[0]?.totalBillsCount || 0;

  // 2. Low Stock Alerts count
  const stockMatch = {
    organisationId: orgId,
    status: 'ACTIVE',
    reorderLevelBase: { $gt: 0 },
    $expr: { $lte: ['$currentQuantityBase', '$reorderLevelBase'] },
    ...cafeFilter,
  };
  const lowStockCount = await CafeInventoryConfig.countDocuments(stockMatch);

  // 3. Pending Tasks count
  const taskMatch = {
    organisationId: orgId,
    status: { $in: ['PENDING', 'IN_PROGRESS'] },
    ...cafeFilter,
  };
  const pendingTasksCount = await Task.countDocuments(taskMatch);

  // 4. Pending Approvals count
  const pendingApprovalsCount = await Approval.countDocuments({
    organisationId: orgId,
    status: 'PENDING',
    ...cafeFilter,
  });

  // 5. Active Cafes count (Master/Owner view)
  let activeCafesCount = 0;
  if (role === 'MASTER' || role === 'OWNER') {
    activeCafesCount = await Cafe.countDocuments({
      organisationId: orgId,
      status: 'ACTIVE',
    });
  }

  return response.status(200).json({
    success: true,
    data: {
      role,
      businessDate: today,
      metrics: {
        totalSalesPaisa,
        totalBillsCount,
        lowStockCount,
        pendingTasksCount,
        pendingApprovalsCount,
        activeCafesCount,
      },
    },
    correlationId: request.correlationId || null,
  });
});

module.exports = {
  getDashboardMetrics,
};
