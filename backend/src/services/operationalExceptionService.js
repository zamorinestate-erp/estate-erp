'use strict';

/**
 * ============================================================================
 * ZAMORIN CAFÉ ERP — OPERATIONAL EXCEPTION CENTRE SERVICE (R02-08)
 * ============================================================================
 * Aggregates live exceptions across all operational domains without shadow records:
 * - Temperature excursions requiring corrective action
 * - Expired or critically near-expiry inventory lots
 * - Disputed shift handovers or excessive cash variances
 * - Unresolved food safety complaints / foreign object incidents
 * - Overdue KDS tickets past prep SLA
 *
 * Scoped strictly by organisationId and cafeId.
 */

const { TemperatureLog } = require('../models/TemperatureLog');
const { InventoryLot } = require('../models/InventoryLot');
const { ShiftHandover } = require('../models/ShiftHandover');
const { FoodSafetyIncident } = require('../models/FoodSafetyIncident');
const { KdsTicket } = require('../models/KdsTicket');
const { EmployeeTraining } = require('../models/EmployeeTraining');
const { isTrainingOverdue } = require('../utils/trainingRecurrence');

class OperationalExceptionService {
  /**
   * Aggregates live operational exceptions for a specific café
   */
  static async getCafeExceptions({ organisationId, cafeId }) {
    if (!organisationId || !cafeId) {
      throw new Error('OrganisationId and CafeId are required for operational exceptions.');
    }

    const cleanOrg = organisationId.trim().toUpperCase();
    const cleanCafe = cafeId.trim().toUpperCase();

    const exceptions = [];
    const now = new Date();
    const nowTime = now.getTime();
    const todayStr = now.toISOString().slice(0, 10);

    // 1. Temperature Excursions (out of range or requiring action)
    try {
      const tempExcursions = await TemperatureLog.find({
        organisationId: cleanOrg,
        cafeId: cleanCafe,
        status: { $in: ['OUT_OF_RANGE', 'CORRECTIVE_ACTION_REQUIRED'] },
      })
        .sort({ recordedAt: -1 })
        .limit(20)
        .lean();

      for (const t of tempExcursions) {
        exceptions.push({
          exceptionId: `EXC-TEMP-${t.logId}`,
          domain: 'FOOD_SAFETY',
          category: 'TEMPERATURE_EXCURSION',
          severity: 'HIGH',
          title: `Temperature Excursion: ${t.monitoringPoint}`,
          details: `${t.equipmentName || t.monitoringPoint} logged ${t.temperatureCelsius}°C (Allowed: ${t.minAllowedCelsius}°C to ${t.maxAllowedCelsius}°C)`,
          entityId: t.logId,
          entityType: 'TemperatureLog',
          status: t.status,
          occurredAt: t.recordedAt || t.createdAt,
          actionRequired: 'Apply corrective action & verify unit temperature.',
        });
      }
    } catch (_) {}

    // 2. Expired and Near-Expiry Inventory Lots (within 48 hours)
    try {
      const twoDaysFromNow = new Date(nowTime + 48 * 3600 * 1000).toISOString().slice(0, 10);
      const riskyLots = await InventoryLot.find({
        organisationId: cleanOrg,
        cafeId: cleanCafe,
        status: { $in: ['AVAILABLE', 'EXPIRED', 'NEAR_EXPIRY', 'QUARANTINE'] },
        expiryDate: { $lte: twoDaysFromNow },
      })
        .sort({ expiryDate: 1 })
        .limit(25)
        .lean();

      for (const lot of riskyLots) {
        const isExpired = lot.expiryDate < todayStr;
        exceptions.push({
          exceptionId: `EXC-LOT-${lot.lotId}`,
          domain: 'INVENTORY_FEFO',
          category: isExpired ? 'LOT_EXPIRED' : 'LOT_NEAR_EXPIRY',
          severity: isExpired ? 'CRITICAL' : 'MEDIUM',
          title: isExpired ? `Expired Lot: ${lot.lotId}` : `Lot Expiring Soon: ${lot.lotId}`,
          details: `Item ${lot.itemId} (${lot.remainingQuantity || lot.quantityBase} ${lot.unit}) expires ${lot.expiryDate}`,
          entityId: lot.lotId,
          entityType: 'InventoryLot',
          status: lot.status,
          occurredAt: lot.expiryDate,
          actionRequired: isExpired ? 'Quarantine & dispose immediately; do not issue to line.' : 'FEFO priority usage or discount.',
        });
      }
    } catch (_) {}

    // 3. Disputed Shift Handovers or Large Cash Variances (> ₹200 / 20000 paisa)
    try {
      const handovers = await ShiftHandover.find({
        organisationId: cleanOrg,
        cafeId: cleanCafe,
      })
        .sort({ createdAt: -1 })
        .limit(10)
        .lean();

      for (const h of handovers) {
        const isDisputed = h.acknowledgementStatus === 'DISPUTED';
        const variance = Math.abs(h.cashDrawer?.variancePaisa || 0);
        const hasVariance = variance >= 20000; // ₹200+

        if (isDisputed || hasVariance) {
          exceptions.push({
            exceptionId: `EXC-HND-${h.handoverId}`,
            domain: 'SHIFT_CONTINUITY',
            category: isDisputed ? 'HANDOVER_DISPUTED' : 'CASH_VARIANCE',
            severity: isDisputed ? 'HIGH' : 'MEDIUM',
            title: isDisputed ? `Shift Handover Disputed: ${h.handoverId}` : `Cash Variance: ₹${(variance / 100).toFixed(2)}`,
            details: isDisputed
              ? `Incoming supervisor flagged handover: ${h.disputeReason || 'No reason provided'}`
              : `Handover on ${h.handoverDate} had variance of ₹${(variance / 100).toFixed(2)}`,
            entityId: h.handoverId,
            entityType: 'ShiftHandover',
            status: h.acknowledgementStatus,
            occurredAt: h.createdAt,
            actionRequired: 'Audit cash drawer transactions and resolve supervisor dispute.',
          });
        }
      }
    } catch (_) {}

    // 4. Open Food Safety Incidents & Complaints
    try {
      const incidents = await FoodSafetyIncident.find({
        organisationId: cleanOrg,
        cafeId: cleanCafe,
        status: { $in: ['REPORTED', 'INVESTIGATING'] },
      })
        .sort({ createdAt: -1 })
        .limit(15)
        .lean();

      for (const inc of incidents) {
        exceptions.push({
          exceptionId: `EXC-FSI-${inc.incidentId}`,
          domain: 'FOOD_SAFETY',
          category: 'FOOD_SAFETY_INCIDENT',
          severity: inc.severity === 'CRITICAL' ? 'CRITICAL' : 'HIGH',
          title: `Food Safety Complaint: ${inc.incidentType}`,
          details: `${inc.customerName ? `Guest: ${inc.customerName} - ` : ''}${inc.description}`,
          entityId: inc.incidentId,
          entityType: 'FoodSafetyIncident',
          status: inc.status,
          occurredAt: inc.reportedAt || inc.createdAt,
          actionRequired: 'Investigate sample, lot traceability, and implement corrective actions.',
        });
      }
    } catch (_) {}

    // 5. Overdue KDS Tickets (> targetPrepTimeMinutes)
    try {
      const activeTickets = await KdsTicket.find({
        organisationId: cleanOrg,
        cafeId: cleanCafe,
        status: { $in: ['RECEIVED', 'PREPARING'] },
      })
        .sort({ receivedAt: 1 })
        .limit(20)
        .lean();

      for (const ticket of activeTickets) {
        const start = ticket.receivedAt ? new Date(ticket.receivedAt).getTime() : new Date(ticket.createdAt).getTime();
        const ageSec = Math.max(0, Math.floor((nowTime - start) / 1000));
        const targetSec = (ticket.targetPrepTimeMinutes || 15) * 60;

        if (ageSec > targetSec) {
          exceptions.push({
            exceptionId: `EXC-KDS-${ticket.ticketId}`,
            domain: 'KDS_FULFILLMENT',
            category: 'TICKET_OVERDUE',
            severity: ageSec > targetSec * 2 ? 'HIGH' : 'MEDIUM',
            title: `KDS Ticket Overdue: ${ticket.ticketId}`,
            details: `Station: ${ticket.prepStation} - Age: ${Math.floor(ageSec / 60)} mins (Target: ${ticket.targetPrepTimeMinutes} mins)`,
            entityId: ticket.ticketId,
            entityType: 'KdsTicket',
            status: ticket.status,
            occurredAt: ticket.receivedAt || ticket.createdAt,
            actionRequired: 'Line cook escalation / expediter assist needed.',
          });
        }
      }
    } catch (_) {}

    // 6. Overdue Food Safety Training (Quarterly Onsite & FoSTaC)
    try {
      const overdueTrainings = await EmployeeTraining.find({
        organisationId: cleanOrg,
        $or: [
          { cafeId: cleanCafe },
          { cafeId: '' },
          { cafeId: null },
        ],
        trainingType: { $in: ['FOOD_SAFETY_ONSITE', 'FOSTAC', 'FOOD_SAFETY_BASIC'] },
        status: { $in: ['ASSIGNED', 'IN_PROGRESS', 'OVERDUE', 'DUE'] },
        dueDate: { $lt: todayStr },
      })
        .limit(15)
        .lean();

      for (const trn of overdueTrainings) {
        if (!isTrainingOverdue(trn.dueDate, todayStr)) continue;
        exceptions.push({
          exceptionId: `EXC-TRN-${trn.trainingId}`,
          domain: 'FOOD_SAFETY',
          category: 'TRAINING_OVERDUE',
          severity: 'HIGH',
          title: `Overdue Food Safety Training: ${trn.trainingTitle}`,
          details: `Mandatory training for ${trn.userId} was due on ${trn.dueDate} and is overdue.`,
          entityId: trn.trainingId,
          entityType: 'EmployeeTraining',
          status: 'OVERDUE',
          occurredAt: trn.dueDate,
          actionRequired: 'Conduct onsite food-handler session and log attendance records.',
        });
      }
    } catch (_) {}

    // Sort exceptions by severity and occurrence time
    const severityWeight = { CRITICAL: 4, HIGH: 3, MEDIUM: 2, LOW: 1 };
    exceptions.sort((a, b) => {
      const wDiff = (severityWeight[b.severity] || 0) - (severityWeight[a.severity] || 0);
      if (wDiff !== 0) return wDiff;
      return new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime();
    });

    const summary = {
      totalExceptions: exceptions.length,
      criticalCount: exceptions.filter((e) => e.severity === 'CRITICAL').length,
      highCount: exceptions.filter((e) => e.severity === 'HIGH').length,
      mediumCount: exceptions.filter((e) => e.severity === 'MEDIUM').length,
      byDomain: {
        FOOD_SAFETY: exceptions.filter((e) => e.domain === 'FOOD_SAFETY').length,
        INVENTORY_FEFO: exceptions.filter((e) => e.domain === 'INVENTORY_FEFO').length,
        SHIFT_CONTINUITY: exceptions.filter((e) => e.domain === 'SHIFT_CONTINUITY').length,
        KDS_FULFILLMENT: exceptions.filter((e) => e.domain === 'KDS_FULFILLMENT').length,
      },
    };

    return {
      organisationId: cleanOrg,
      cafeId: cleanCafe,
      summary,
      exceptions,
    };
  }
}

module.exports = OperationalExceptionService;
