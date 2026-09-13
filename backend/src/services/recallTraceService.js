'use strict';

/**
 * ============================================================================
 * ZAMORIN CAFÉ ERP — RECALL & QUARANTINE TRACEABILITY SERVICE (R02-10)
 * ============================================================================
 * End-to-end forward and backward lot traceability:
 * - Forward trace: Supplier Lot / PO -> Café Stock Lots -> Recipes -> Guest Bills
 * - Backward trace: Guest Bill / Complaint -> Item -> Recipe Lots -> Supplier PO & Dock Inspection
 * - Multi-café quarantine locking and disposition tracking
 */

const { InventoryLot } = require('../models/InventoryLot');
const { StockMovement } = require('../models/StockMovement');
const { RecallNotice } = require('../models/RecallNotice');
const { IncomingInspection } = require('../models/IncomingInspection');
const { Bill } = require('../models/Bill');

class RecallTraceService {
  /**
   * Forward trace: Given a supplier lot or internal lotId, locate all stock
   * locations, movements, and downstream bills/orders across the entire estate.
   */
  static async traceForward({ organisationId, lotId, supplierLot, itemId }) {
    if (!organisationId) throw new Error('OrganisationId is required for forward trace.');

    const cleanOrg = organisationId.trim().toUpperCase();
    const lotFilter = { organisationId: cleanOrg };

    if (lotId) lotFilter.lotId = lotId.trim().toUpperCase();
    if (supplierLot) lotFilter.supplierLot = supplierLot.trim();
    if (itemId) lotFilter.itemId = itemId.trim().toUpperCase();

    // 1. Locate all matching inventory lots across cafes
    const matchingLots = await InventoryLot.find(lotFilter).lean();

    // 2. Find dock incoming inspections for these lots
    const foundLotsList = matchingLots.map((l) => l.lotId);
    const foundSuppLots = matchingLots.map((l) => l.supplierLot).filter(Boolean);

    const inspections = await IncomingInspection.find({
      organisationId: cleanOrg,
      $or: [
        { supplierLot: { $in: foundSuppLots } },
        { itemId: lotFilter.itemId || { $exists: true } },
      ],
    }).lean();

    // 3. Find stock movements involving these lots
    const movements = await StockMovement.find({
      organisationId: cleanOrg,
      lotId: { $in: foundLotsList },
    })
      .sort({ createdAt: -1 })
      .limit(100)
      .lean();

    // 4. Find affected customer bills that actually consumed these lots via persisted linkages
    let affectedBills = [];
    if (foundLotsList.length > 0) {
      // Trace Method A: Directly recorded in Bill.lineItems.consumedLots.lotId
      const directBills = await Bill.find({
        organisationId: cleanOrg,
        'lineItems.consumedLots.lotId': { $in: foundLotsList },
      })
        .select('billId invoiceNumber cafeId customerName customerPhone createdAt totalPaisa lineItems')
        .lean();

      // Trace Method B: Recorded in StockMovement as CONSUMPTION with referenceId = billId
      const consumptionMovements = await StockMovement.find({
        organisationId: cleanOrg,
        lotId: { $in: foundLotsList },
        movementType: 'CONSUMPTION',
        referenceId: { $exists: true, $ne: null },
      }).lean();

      const movementBillIds = consumptionMovements.map((m) => m.referenceId).filter(Boolean);
      const movementBills =
        movementBillIds.length > 0
          ? await Bill.find({
              organisationId: cleanOrg,
              billId: { $in: movementBillIds },
            })
              .select('billId invoiceNumber cafeId customerName customerPhone createdAt totalPaisa lineItems')
              .lean()
          : [];

      // Combine and deduplicate by billId
      const billMap = new Map();
      for (const b of directBills) billMap.set(b.billId, b);
      for (const b of movementBills) billMap.set(b.billId, b);
      affectedBills = Array.from(billMap.values());
    }

    const totalRemainingQty = matchingLots.reduce((sum, l) => sum + (l.remainingQuantity || l.quantityBase || 0), 0);
    const totalQuarantinedQty = matchingLots
      .filter((l) => l.status === 'QUARANTINE' || l.status === 'RECALL_HOLD')
      .reduce((sum, l) => sum + (l.remainingQuantity || l.quantityBase || 0), 0);

    return {
      organisationId: cleanOrg,
      query: { lotId, supplierLot, itemId },
      summary: {
        totalLotsLocated: matchingLots.length,
        cafesAffectedCount: new Set(matchingLots.map((l) => l.cafeId)).size,
        totalRemainingQuantity: totalRemainingQty,
        totalQuarantinedQuantity: totalQuarantinedQty,
        movementsRecorded: movements.length,
        potentialGuestBillsImpacted: affectedBills.length,
      },
      lots: matchingLots,
      inspections,
      movements,
      affectedBills,
    };
  }

  /**
   * Backward trace: Given a customer complaint or bill, traces backwards
   * strictly through persisted lot consumption and movement linkages to locate
   * the exact incoming inspection, supplier PO, and vendor.
   */
  static async traceBackward({ organisationId, billId, menuItemId, cafeId }) {
    if (!organisationId) throw new Error('OrganisationId is required for backward trace.');

    const cleanOrg = organisationId.trim().toUpperCase();
    const result = {
      bill: null,
      suspectItems: [],
      lotsIdentified: [],
      inspections: [],
      procurementTrace: [],
    };

    if (billId) {
      const bill = await Bill.findOne({
        organisationId: cleanOrg,
        billId: billId.trim().toUpperCase(),
      }).lean();

      if (bill) {
        result.bill = {
          billId: bill.billId,
          cafeId: bill.cafeId,
          customerName: bill.customerName,
          customerPhone: bill.customerPhone,
          createdAt: bill.createdAt,
          lineItems: bill.lineItems,
        };

        // 1. Identify EXACT lotIds consumed by this bill via persisted allocations
        const consumedLotIds = [];

        // Check lineItems.consumedLots
        for (const li of bill.lineItems || []) {
          for (const cl of li.consumedLots || []) {
            if (cl.lotId) consumedLotIds.push(cl.lotId);
          }
        }

        // Check StockMovement consumption records referencing this bill
        const relatedMovements = await StockMovement.find({
          organisationId: cleanOrg,
          referenceId: bill.billId,
          movementType: 'CONSUMPTION',
        }).lean();

        for (const mv of relatedMovements) {
          if (mv.lotId) consumedLotIds.push(mv.lotId);
        }

        const uniqueLotIds = [...new Set(consumedLotIds)];

        let identifiedLots = [];
        if (uniqueLotIds.length > 0) {
          identifiedLots = await InventoryLot.find({
            organisationId: cleanOrg,
            lotId: { $in: uniqueLotIds },
          }).lean();
        }

        result.lotsIdentified = identifiedLots;

        // 2. Trace back to IncomingInspection, Procurement PO, and Vendor
        const suppLots = identifiedLots.map((l) => l.supplierLot).filter(Boolean);
        const inspectionIds = identifiedLots.map((l) => l.receivingInspectionId).filter(Boolean);

        if (suppLots.length > 0 || inspectionIds.length > 0) {
          result.inspections = await IncomingInspection.find({
            organisationId: cleanOrg,
            $or: [
              { supplierLot: { $in: suppLots } },
              { inspectionId: { $in: inspectionIds } },
            ],
          }).lean();
        }

        // 3. Populate vendor, PO, and delivery traceability chain
        result.procurementTrace = identifiedLots.map((l) => ({
          lotId: l.lotId,
          supplierLot: l.supplierLot,
          vendorId: l.vendorId,
          procurementReference: l.procurementReference,
          receivingInspectionId: l.receivingInspectionId,
          mfgDate: l.mfgDate,
          expiryDate: l.expiryDate,
        }));
      }
    }

    return result;
  }

  /**
   * Executes estate-wide immediate quarantine lock for all lots matching criteria
   */
  static async executeMultiCafeQuarantine({
    organisationId,
    itemId,
    supplierLot,
    lotId,
    reason,
    userId = '',
  }) {
    const cleanOrg = organisationId.trim().toUpperCase();
    const filter = { organisationId: cleanOrg };

    if (itemId) filter.itemId = itemId.trim().toUpperCase();
    if (supplierLot) filter.supplierLot = supplierLot.trim();
    if (lotId) filter.lotId = lotId.trim().toUpperCase();

    const lots = await InventoryLot.find(filter);
    const affectedMap = new Map();

    for (const lot of lots) {
      lot.status = 'QUARANTINE';
      lot.dispositionNotes = `Emergency Recall Quarantine: ${reason}`;
      await lot.save();

      const curr = affectedMap.get(lot.cafeId) || 0;
      affectedMap.set(lot.cafeId, curr + (lot.remainingQuantity || lot.quantityBase || 0));

      // Record movement audit
      await StockMovement.create({
        organisationId: cleanOrg,
        movementId: `MVT-QUAR-${Date.now().toString().slice(-6)}`,
        cafeId: lot.cafeId,
        itemId: lot.itemId,
        movementType: 'QUARANTINE_LOCK',
        quantityBase: -(lot.remainingQuantity || lot.quantityBase || 0),
        balanceBeforeBase: lot.remainingQuantity || lot.quantityBase || 0,
        balanceAfterBase: 0,
        lotId: lot.lotId,
        reason: `Emergency Recall Quarantine: ${reason}`,
        performedByUserId: userId,
      });
    }

    const affectedCafes = Array.from(affectedMap.entries()).map(([cafeId, qty]) => ({
      cafeId,
      locatedQty: qty,
      quarantinedQty: qty,
      disposition: 'QUARANTINED',
    }));

    const count = await RecallNotice.countDocuments({ organisationId: cleanOrg });
    const recallId = `RCL-2026-${String(count + 1).padStart(4, '0')}`;

    const recall = await RecallNotice.create({
      organisationId: cleanOrg,
      recallId,
      itemId: itemId || (lots[0]?.itemId || 'ESTATE-WIDE'),
      supplierLot: supplierLot || '',
      zamorinLot: lotId || '',
      reason,
      affectedCafes,
      status: 'ACTIVE',
      initiatedByUserId: userId,
    });

    return {
      recall,
      quarantinedLotsCount: lots.length,
      affectedCafes,
    };
  }
}

module.exports = RecallTraceService;
