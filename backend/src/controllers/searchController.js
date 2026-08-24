'use strict';

/**
 * SEARCH CONTROLLER
 *
 * Permission-aware search across system entities.
 * Personal Ledger results are restricted to MASTER and OWNER and scoped to the authenticated owner.
 */

const { User } = require('../models/User');
const { MenuItem } = require('../models/MenuItem');
const { GlobalInventoryItem } = require('../models/GlobalInventoryItem');
const { Vendor } = require('../models/Vendor');
const { Bill } = require('../models/Bill');
const { PersonalLedger } = require('../models/PersonalLedger');

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

  // 1. Employees (MASTER and OWNER directory search only)
  if (['MASTER', 'OWNER'].includes(role)) {
    const empFilter = { organisationId: orgId, $or: [{ fullName: regex }, { email: regex }, { permanentEmployeeId: regex }] };
    

    promises.push(
      User.find(empFilter).select('userId fullName role permanentEmployeeId primaryCafeId').limit(5).lean()
        .then((res) => ({ type: 'EMPLOYEES', items: res.map((e) => ({ id: e.userId, title: e.fullName, subtitle: `${e.role} (${e.permanentEmployeeId || 'No ID'})`, route: 'employees' })) }))
    );
  }

  // 2. Menu Items (MASTER, OWNER and CAFE_ADMIN only)
  if (['MASTER', 'OWNER', 'CAFE_ADMIN'].includes(role)) {
    const menuRoute = role === 'MASTER' ? 'menu' : role === 'OWNER' ? 'reports' : 'pos';
    promises.push(
      MenuItem.find({ organisationId: orgId, name: regex }).select('menuItemId name category currentPricePaisa').limit(5).lean()
        .then((res) => ({ type: 'MENU_ITEMS', items: res.map((m) => ({ id: m.menuItemId, title: m.name, subtitle: `${m.category} • ₹${m.currentPricePaisa / 100}`, route: menuRoute })) }))
    );
  }
  // 3. Inventory Items (MASTER, OWNER and CAFE_ADMIN only)
  if (['MASTER', 'OWNER', 'CAFE_ADMIN'].includes(role)) {
    const invRoute = role === 'OWNER' ? 'finance' : 'inventory';
    promises.push(
      GlobalInventoryItem.find({ organisationId: orgId, name: regex }).select('itemId name category baseUnit').limit(5).lean()
        .then((res) => ({ type: 'INVENTORY_ITEMS', items: res.map((i) => ({ id: i.itemId, title: i.name, subtitle: `${i.category} (${i.baseUnit})`, route: invRoute })) }))
    );
  }
  // 4. Vendors (MASTER and OWNER only)
  if (['MASTER', 'OWNER'].includes(role)) {
    const vendorRoute = role === 'MASTER' ? 'vendors' : 'reports';
    promises.push(
      Vendor.find({ organisationId: orgId, name: regex }).select('vendorId name category status').limit(5).lean()
        .then((res) => ({ type: 'VENDORS', items: res.map((v) => ({ id: v.vendorId, title: v.name, subtitle: `${v.category} (${v.status})`, route: vendorRoute })) }))
    );
  }

  // 5. Bills / Receipts (MASTER, OWNER and CAFE_ADMIN only)
  if (['MASTER', 'OWNER', 'CAFE_ADMIN'].includes(role)) {
    const billFilter = { organisationId: orgId, $or: [{ billId: regex }, { tableNumber: regex }, { customerPhone: regex }] };
    if (role === 'CAFE_ADMIN') {
      billFilter.cafeId = request.auth.primaryCafeId || { $in: request.auth.assignedCafeIds || [] };
    } else if (role !== 'MASTER' && role !== 'OWNER') {
      billFilter.cafeId = { $in: request.auth.assignedCafeIds || [] };
    }

    const billRoute = ['MASTER', 'OWNER'].includes(role) ? 'bills' : 'pos';

    promises.push(
      Bill.find(billFilter).select('billId totalPaisa status businessDate orderType').limit(5).lean()
        .then((res) => ({ type: 'BILLS', items: res.map((b) => ({ id: b.billId, title: b.billId, subtitle: `₹${b.totalPaisa / 100} • ${b.status} • ${b.businessDate}`, route: billRoute })) }))
    );
  }
  // 6. Personal Ledger (MASTER only; always scoped to the authenticated Master owner)
  if (role === 'MASTER') {
  const ledgerFilter = {
    organisationId: orgId,
    ownerUserId: request.auth.userId,
    $or: [
      { ledgerEntryId: regex },
      { description: regex },
      { counterparty: regex },
      { externalReference: regex },
      { category: regex },
      { entryType: regex },
    ],
  };

  promises.push(
    PersonalLedger.find(ledgerFilter)
      .select('ledgerEntryId entryType category amountPaisa businessDate description counterparty externalReference')
      .limit(5)
      .lean()
      .then((res) => ({
        type: 'PERSONAL_LEDGER',
        items: res.map((entry) => ({
          id: entry.ledgerEntryId,
          title: entry.description || entry.ledgerEntryId,
          subtitle: [entry.entryType, entry.category, entry.businessDate].filter(Boolean).join(' | '),
          route: 'ledger',
        })),
      }))
  );
}
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
