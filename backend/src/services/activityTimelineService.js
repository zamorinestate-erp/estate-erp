'use strict';

/**
 * ACTIVITY TIMELINE SERVICE
 * Aggregates chronological history for business records across:
 * - Direct record audit events (AuditEvent)
 * - Record milestones (e.g. PO milestones, Bill reprints)
 * - Linked attachments & version history (BusinessDocument)
 * - Approval decisions (Approval)
 */

const { AuditEvent } = require('../models/AuditEvent');
const { BusinessDocument } = require('../models/BusinessDocument');
const { PurchaseOrder } = require('../models/PurchaseOrder');
const { Approval } = require('../models/Approval');
const { ApiError } = require('../utils/ApiError');

class ActivityTimelineService {
  /**
   * Fetches full unified activity timeline for any entity.
   */
  static async getRecordTimeline({ organisationId, entityType, entityId, cafeId = null }) {
    const orgId = String(organisationId || '').trim().toUpperCase();
    const cleanType = String(entityType || '').trim().toUpperCase();
    const cleanId = String(entityId || '').trim().toUpperCase();

    if (!orgId || !cleanType || !cleanId) {
      throw new ApiError(400, 'INVALID_TIMELINE_QUERY', 'organisationId, entityType, and entityId are required.');
    }

    const timelineEvents = [];

    // 1. Audit events for this entity
    const auditEvents = await AuditEvent.find({
      organisationId: orgId,
      entityType: cleanType,
      entityId: cleanId,
    })
      .sort({ serverTimestamp: 1 })
      .lean();

    for (const ae of auditEvents) {
      timelineEvents.push({
        id: ae.auditEventId,
        source: 'AUDIT_LOG',
        action: ae.action,
        actor: ae.actorUserId,
        role: ae.actorRole,
        cafeId: ae.cafeId || cafeId,
        timestamp: ae.serverTimestamp,
        result: ae.result,
        reason: ae.reason || null,
        details: ae.after || ae.before || null,
      });
    }

    // 2. Attached documents & version replacements
    const docs = await BusinessDocument.find({
      organisationId: orgId,
      relatedRecordId: cleanId,
    }).lean();

    for (const d of docs) {
      timelineEvents.push({
        id: `DOC-ATT-${d.documentId}`,
        source: 'ATTACHMENT',
        action: 'ATTACHMENT_ADDED',
        actor: d.uploadedBy,
        role: 'USER',
        cafeId: d.cafeId || cafeId,
        timestamp: d.createdAt,
        result: d.status,
        reason: d.notes || null,
        details: {
          documentId: d.documentId,
          filename: d.originalFilename,
          version: d.currentVersion || 1,
        },
      });

      for (const ver of (d.versions || [])) {
        timelineEvents.push({
          id: `DOC-VER-${d.documentId}-V${ver.versionNumber || ver.version}`,
          source: 'ATTACHMENT_VERSION',
          action: 'ATTACHMENT_REPLACED',
          actor: ver.uploadedBy || d.uploadedBy,
          role: 'USER',
          cafeId: d.cafeId || cafeId,
          timestamp: ver.uploadedAt || ver.createdAt,
          result: 'SUPERSEDED',
          reason: ver.changeReason || null,
          details: {
            documentId: d.documentId,
            filename: ver.originalFilename,
            version: ver.versionNumber || ver.version,
          },
        });
      }
    }

    // 3. Purchase Order specific milestones & 3-way match events
    if (cleanType === 'PURCHASE_ORDER' || cleanType === 'PO') {
      const po = await PurchaseOrder.findOne({
        organisationId: orgId,
        purchaseOrderId: cleanId,
      }).lean();

      if (po) {
        // Milestones
        for (const m of (po.milestones || [])) {
          timelineEvents.push({
            id: `PO-MILE-${m._id || m.milestoneKey}`,
            source: 'PO_MILESTONE',
            action: m.milestoneKey,
            actor: m.actorUserId || 'SYSTEM',
            role: 'STAFF',
            cafeId: po.cafeId,
            timestamp: m.timestamp,
            result: 'COMPLETED',
            reason: m.details || m.label,
            details: { label: m.label },
          });
        }

        // Goods Receipts
        for (const g of (po.grns || [])) {
          timelineEvents.push({
            id: `GRN-${g.grnId}`,
            source: 'GOODS_RECEIPT',
            action: 'GOODS_RECEIVED',
            actor: g.receivedByUserId,
            role: 'OPERATIONAL',
            cafeId: po.cafeId,
            timestamp: g.receivedAt,
            result: g.status,
            reason: g.notes || null,
            details: {
              deliveryNoteNumber: g.deliveryNoteNumber,
              itemCount: (g.items || []).length,
            },
          });
        }

        // 3-Way Match
        if (po.threeWayMatch?.matchedAt) {
          timelineEvents.push({
            id: `TWM-${cleanId}`,
            source: 'THREE_WAY_MATCH',
            action: po.threeWayMatch.matchStatus === 'MATCHED' ? 'THREE_WAY_MATCH_PASSED' : 'VARIANCE_FLAGGED',
            actor: po.threeWayMatch.matchedByUserId || 'SYSTEM',
            role: 'SYSTEM',
            cafeId: po.cafeId,
            timestamp: po.threeWayMatch.matchedAt,
            result: po.threeWayMatch.matchStatus,
            reason: po.threeWayMatch.isExceptionApproved ? po.threeWayMatch.exceptionReason : null,
            details: {
              priceVariancePaisa: po.threeWayMatch.priceVariancePaisa,
              quantityVarianceBase: po.threeWayMatch.quantityVarianceBase,
              isExceptionApproved: po.threeWayMatch.isExceptionApproved,
            },
          });
        }
      }
    }

    // 4. Sort strictly chronologically
    timelineEvents.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

    return {
      success: true,
      entityType: cleanType,
      entityId: cleanId,
      eventCount: timelineEvents.length,
      timeline: timelineEvents,
    };
  }
}

module.exports = {
  ActivityTimelineService,
};
