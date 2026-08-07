'use strict';

/**
 * SEARCH CONTROLLER
 *
 * Permission-aware search across system entities.
 * NOTE: Personal Ledger is explicitly EXCLUDED to preserve undiscoverability.
 */

const { User } = require('../models/User');
const { MenuItem } = require('../models/MenuItem');
const { GlobalInventoryItem } = require('../models/GlobalInventoryItem');
const { Vendor } = require('../models/Vendor');
const { Bill } = require('../models/Bill');

const { asyncHandler } = require('../utils/asyncHandler');
const { ApiError } = require('../utils/ApiError');

function escapeRegExp(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

const performGlobalSearch = asyncHandler(async (request, response) => {
  const query = request.query.q || request.query.query;
  const qText = typeof query === 'string' ? query.trim() : '';

  if (qText.length < 2) {
    return response.status(200).json({
      success: true,
      data: { results: {} },
      correlationId: request.correlationId || null,
    });
  }

  const orgId = request.auth.organisationId;
  const role = request.auth.role;
  const regex = new RegExp(escapeRegExp(qText), 'i');

  const promises = [];

  // 1. Employees (Master, Owner, Cafe Admin)
  if (['MASTER', 'OWNER', 'CAFE_ADMIN'].includes(role)) {
    const empFilter = { organisationId: orgId, $or: [{ fullName: regex }, { email: regex }, { permanentEmployeeId: regex }] };
    if (role === 'CAFE_ADMIN') empFilter.assignedCafeIds = { $in: request.auth.assignedCafeIds };

    promises.push(
      User.find(empFilter).select('userId fullName role permanentEmployeeId primaryCafeId').limit(5).lean()
        .then((res) => ({ type: 'EMPLOYEES', items: res.map((e) => ({ id: e.userId, title: e.fullName, subtitle: `${e.role} (${e.permanentEmployeeId || 'No ID'})`, route: 'employees' })) }))
    );
  }

  // 2. Menu Items
  promises.push(
    MenuItem.find({ organisationId: orgId, name: regex }).select('menuItemId name category currentPricePaisa').limit(5).lean()
      .then((res) => ({ type: 'MENU_ITEMS', items: res.map((m) => ({ id: m.menuItemId, title: m.name, subtitle: `${m.category} • ₹${m.currentPricePaisa / 100}`, route: 'pos' })) }))
  );

  // 3. Inventory Items
  promises.push(
    GlobalInventoryItem.find({ organisationId: orgId, name: regex }).select('itemId name category baseUnit').limit(5).lean()
      .then((res) => ({ type: 'INVENTORY_ITEMS', items: res.map((i) => ({ id: i.itemId, title: i.name, subtitle: `${i.category} (${i.baseUnit})`, route: 'inventory' })) }))
  );

  // 4. Vendors (Master, Owner, Cafe Admin)
  if (['MASTER', 'OWNER', 'CAFE_ADMIN'].includes(role)) {
    promises.push(
      Vendor.find({ organisationId: orgId, name: regex }).select('vendorId name category status').limit(5).lean()
        .then((res) => ({ type: 'VENDORS', items: res.map((v) => ({ id: v.vendorId, title: v.name, subtitle: `${v.category} (${v.status})`, route: 'inventory' })) }))
    );
  }

  // 5. Bills / Receipts
  const billFilter = { organisationId: orgId, $or: [{ billId: regex }, { tableNumber: regex }, { customerPhone: regex }] };
  if (role !== 'MASTER' && role !== 'OWNER') billFilter.cafeId = { $in: request.auth.assignedCafeIds };

  promises.push(
    Bill.find(billFilter).select('billId totalPaisa status businessDate orderType').limit(5).lean()
      .then((res) => ({ type: 'BILLS', items: res.map((b) => ({ id: b.billId, title: b.billId, subtitle: `₹${b.totalPaisa / 100} • ${b.status} • ${b.businessDate}`, route: 'pos' })) }))
  );

  const rawResults = await Promise.all(promises);

  const results = {};
  for (const group of rawResults) {
    if (group.items.length > 0) {
      results[group.type] = group.items;
    }
  }

  return response.status(200).json({
    success: true,
    data: { query: qText, results },
    correlationId: request.correlationId || null,
  });
});

module.exports = {
  performGlobalSearch,
};
