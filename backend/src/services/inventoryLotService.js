'use strict';

/**
 * ============================================================================
 * ZAMORIN CAFÉ ERP — INVENTORY LOT & QUARANTINE SERVICE
 * ============================================================================
 * Manages lot lifecycle, quarantine isolation, releases, dispositions,
 * and delivery dock incoming inspections.
 */

const { InventoryLot } = require('../models/InventoryLot');
const { IncomingInspection } = require('../models/IncomingInspection');
const { StockMovement } = require('../models/StockMovement');
const { AuditEvent } = require('../models/AuditEvent');
const { ApiError } = require('../utils/ApiError');

class InventoryLotService {
  /**
   * Records an incoming material inspection at the receiving dock.
   */
  static async recordIncomingInspection({
    organisationId,
    cafeId,
    vendorId = null,
    vendorName = '',
    poReference = '',
    itemId,
    itemName = '',
    supplierLot = '',
    expiryDate = null,
    receivedQuantity,
    acceptedQuantity,
    rejectedQuantity = 0,
    unit = 'kg',
    temperatureCelsius = null,
    packagingCondition = 'INTACT',
    qualityCondition = 'ACCEPTABLE',
    decision = 'ACCEPT',
    rejectionReason = '',
    inspectedByUserId,
    remarks = '',
  }) {
    if (!organisationId || !cafeId || !itemId || receivedQuantity === undefined) {
      throw new ApiError(400, 'VALIDATION_ERROR', 'organisationId, cafeId, itemId, and receivedQuantity are required.');
    }

    const recQty = Number(receivedQuantity);
    const accQty = Number(acceptedQuantity !== undefined ? acceptedQuantity : recQty);
    const rejQty = Number(rejectedQuantity !== undefined ? rejectedQuantity : Math.max(0, recQty - accQty));

    const datePart = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const rand = Math.floor(1000 + Math.random() * 9000);
    const inspectionId = `INSP-${datePart}-${rand}`;

    let createdLotId = null;

    // If accepted quantity > 0, create an active InventoryLot
    if (accQty > 0 && decision !== 'REJECT') {
      createdLotId = `LOT-${datePart}-${rand}`;
      await InventoryLot.create({
        lotId: createdLotId,
        organisationId,
        cafeId,
        itemId,
        vendorId,
        supplierLot,
        procurementReference: poReference,
        receivingInspectionId: inspectionId,
        expiryDate: expiryDate || '2026-12-31',
        initialQuantity: accQty,
        quantityBase: accQty,
        remainingQuantity: accQty,
        unit,
        status: 'AVAILABLE',
      });

      // Record stock movement for accepted receiving
      await StockMovement.create({
        movementId: `MOV-${datePart}-${rand}`,
        organisationId,
        cafeId,
        itemId,
        movementType: 'GOODS_RECEIPT',
        quantityBase: accQty,
        sourceType: 'PURCHASE_ORDER',
        referenceId: poReference || inspectionId,
        balanceAfter: accQty,
        performedByUserId: inspectedByUserId,
        notes: `Accepted from ${vendorName || vendorId || 'Vendor'}. Supplier Lot: ${supplierLot}`,
      }).catch(() => {});
    }

    const inspection = await IncomingInspection.create({
      inspectionId,
      organisationId,
      cafeId,
      vendorId,
      vendorName,
      poReference,
      itemId,
      itemName,
      supplierLot,
      expiryDate,
      receivedQuantity: recQty,
      acceptedQuantity: accQty,
      rejectedQuantity: rejQty,
      unit,
      temperatureCelsius,
      packagingCondition,
      qualityCondition,
      decision,
      rejectionReason,
      inspectedByUserId,
      createdLotId,
      remarks,
    });

    await AuditEvent.create({
      auditEventId: `AUDIT-INSP-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      organisationId,
      cafeId,
      action: 'INCOMING_INSPECTION_RECORDED',
      targetResource: 'IncomingInspection',
      resourceId: inspectionId,
      actorUserId: inspectedByUserId,
      outcome: decision === 'REJECT' ? 'WARNING' : 'SUCCESS',
      metadata: {
        decision,
        receivedQuantity: recQty,
        acceptedQuantity: accQty,
        rejectedQuantity: rejQty,
        createdLotId,
      },
    }).catch(() => {});

    return inspection;
  }

  /**
   * Quarantines an inventory lot (Section 54).
   */
  static async quarantineLot({ organisationId, cafeId, lotId, reason, userId }) {
    const lot = await InventoryLot.findOne({ organisationId, cafeId, lotId });
    if (!lot) {
      throw new ApiError(404, 'LOT_NOT_FOUND', `Inventory lot ${lotId} not found.`);
    }

    if (lot.status === 'QUARANTINE') {
      throw new ApiError(400, 'ALREADY_QUARANTINED', `Lot ${lotId} is already in quarantine.`);
    }

    const previousStatus = lot.status;
    lot.status = 'QUARANTINE';
    lot.quarantineReason = reason || 'Quarantined for quality review';
    lot.quarantineDate = new Date();
    lot.quarantinedByUserId = userId;

    await lot.save();

    await AuditEvent.create({
      auditEventId: `AUDIT-QAR-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      organisationId,
      cafeId,
      action: 'INVENTORY_LOT_QUARANTINED',
      targetResource: 'InventoryLot',
      resourceId: lotId,
      actorUserId: userId,
      outcome: 'WARNING',
      severity: 'HIGH',
      metadata: {
        previousStatus,
        reason,
        quantityBase: lot.quantityBase,
        itemId: lot.itemId,
      },
    }).catch(() => {});

    return lot;
  }

  /**
   * Releases an inventory lot from quarantine (Section 55).
   */
  static async releaseLot({ organisationId, cafeId, lotId, releaseReason, userId }) {
    const lot = await InventoryLot.findOne({ organisationId, cafeId, lotId });
    if (!lot) {
      throw new ApiError(404, 'LOT_NOT_FOUND', `Inventory lot ${lotId} not found.`);
    }

    if (lot.status !== 'QUARANTINE') {
      throw new ApiError(400, 'NOT_QUARANTINED', `Lot ${lotId} is not in quarantine (status: ${lot.status}).`);
    }

    if (!releaseReason || !releaseReason.trim()) {
      throw new ApiError(400, 'REASON_REQUIRED', 'Formal release reason is required.');
    }

    lot.status = 'AVAILABLE';
    lot.releaseReason = releaseReason.trim();
    lot.releaseDate = new Date();
    lot.releasedByUserId = userId;

    await lot.save();

    await AuditEvent.create({
      auditEventId: `AUDIT-REL-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      organisationId,
      cafeId,
      action: 'INVENTORY_LOT_RELEASED',
      targetResource: 'InventoryLot',
      resourceId: lotId,
      actorUserId: userId,
      outcome: 'SUCCESS',
      metadata: {
        releaseReason,
        quantityBase: lot.quantityBase,
        itemId: lot.itemId,
      },
    }).catch(() => {});

    return lot;
  }

  /**
   * Disposes an inventory lot (Section 57).
   */
  static async disposeLot({ organisationId, cafeId, lotId, dispositionStatus, dispositionReason, userId }) {
    const lot = await InventoryLot.findOne({ organisationId, cafeId, lotId });
    if (!lot) {
      throw new ApiError(404, 'LOT_NOT_FOUND', `Inventory lot ${lotId} not found.`);
    }

    const allowedDispositions = ['RETURN_TO_VENDOR', 'DESTROY', 'RELEASE', 'OTHER_AUTHORISED_DISPOSITION'];
    if (!allowedDispositions.includes(dispositionStatus)) {
      throw new ApiError(400, 'INVALID_DISPOSITION', `dispositionStatus must be one of: ${allowedDispositions.join(', ')}`);
    }

    const disposedQty = lot.quantityBase;

    lot.dispositionStatus = dispositionStatus;
    lot.dispositionReason = dispositionReason || '';
    lot.dispositionDate = new Date();
    lot.dispositionByUserId = userId;
    lot.quantityBase = 0;
    lot.remainingQuantity = 0;
    lot.status = dispositionStatus === 'RETURN_TO_VENDOR' ? 'RETURNED' : 'DISPOSED';

    await lot.save();

    // Record stock movement for disposal / return
    const datePart = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const rand = Math.floor(1000 + Math.random() * 9000);
    await StockMovement.create({
      movementId: `MOV-${datePart}-${rand}`,
      organisationId,
      cafeId,
      itemId: lot.itemId,
      movementType: dispositionStatus === 'RETURN_TO_VENDOR' ? 'VENDOR_RETURN' : 'SPOILAGE_WRITE_OFF',
      quantityBase: -disposedQty,
      sourceType: 'LOT_DISPOSITION',
      referenceId: lotId,
      balanceAfter: 0,
      performedByUserId: userId,
      notes: `Lot ${lotId} disposed via ${dispositionStatus}: ${dispositionReason}`,
    }).catch(() => {});

    await AuditEvent.create({
      auditEventId: `AUDIT-DISP-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      organisationId,
      cafeId,
      action: 'INVENTORY_LOT_DISPOSED',
      targetResource: 'InventoryLot',
      resourceId: lotId,
      actorUserId: userId,
      outcome: 'SUCCESS',
      metadata: {
        dispositionStatus,
        dispositionReason,
        disposedQty,
        itemId: lot.itemId,
      },
    }).catch(() => {});

    return lot;
  }

  /**
   * Queries lots with filtering.
   */
  static async listLots({ organisationId, cafeId, itemId = null, status = null, limit = 50 }) {
    const query = { organisationId, cafeId };
    if (itemId) query.itemId = itemId;
    if (status) query.status = status;
    return InventoryLot.find(query).sort({ expiryDate: 1 }).limit(Number(limit)).lean();
  }
}

module.exports = {
  InventoryLotService,
};
