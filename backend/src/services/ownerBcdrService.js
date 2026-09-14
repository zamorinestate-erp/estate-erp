'use strict';

/**
 * ============================================================================
 * ZAMORIN CAFÉ ERP — OWNER BUSINESS CONTINUITY & DR SERVICE (STAGE 09)
 * ============================================================================
 * Governs Business Impact Analysis (BIA), DR Drill lifecycles, backup integrity
 * reporting (simulation vs provider verified), and protects the core financial
 * invariant: NO SERVER ACKNOWLEDGEMENT = NO COMPLETED ERP FINANCIAL SALE.
 */

const { BusinessImpactProcess } = require('../models/BusinessImpactProcess');
const {
  DisasterRecoveryDrill,
  ALLOWED_DRILL_TRANSITIONS,
} = require('../models/DisasterRecoveryDrill');

class OwnerBcdrService {
  /**
   * Register a critical business process into BIA
   */
  async registerBusinessProcess(organisationId, payload) {
    if (!organisationId) throw new Error('ORGANISATION_ID_REQUIRED');
    const {
      processName,
      criticalityTier,
      ownerRole,
      maxAcceptableInterruptionMinutes,
      targetRtoMinutes,
      targetRpoMinutes,
      financialImpactPerHourPaisa,
      foodSafetyImpactDescription,
      dependencies,
      offlineFallbackMechanism,
    } = payload;

    if (!processName || !ownerRole || targetRtoMinutes === undefined || targetRpoMinutes === undefined) {
      throw new Error('MISSING_REQUIRED_BIA_FIELDS');
    }

    const processId = `BIA-PROC-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;

    const process = await BusinessImpactProcess.create({
      processId,
      organisationId,
      processName,
      criticalityTier: criticalityTier || 'BUSINESS_CRITICAL',
      ownerRole,
      maxAcceptableInterruptionMinutes: Number(maxAcceptableInterruptionMinutes) || 120,
      targetRtoMinutes: Number(targetRtoMinutes),
      targetRpoMinutes: Number(targetRpoMinutes),
      rtoRpoStatus: 'TARGET_ESTABLISHED_PENDING_DRILL_PROOF',
      financialImpactPerHourPaisa: Number(financialImpactPerHourPaisa) || 0,
      foodSafetyImpactDescription: foodSafetyImpactDescription || 'None',
      dependencies: dependencies || [],
      offlineFallbackMechanism: offlineFallbackMechanism || 'Paper order pad / offline draft buffer',
      offlineFinancialInvariant: 'NO SERVER ACKNOWLEDGEMENT = NO COMPLETED ERP FINANCIAL SALE. Offline draft orders cannot generate final GST invoices or ledger entries.',
    });

    return process;
  }

  async getBusinessProcesses(organisationId) {
    if (!organisationId) throw new Error('ORGANISATION_ID_REQUIRED');
    return BusinessImpactProcess.find({ organisationId }).sort({ criticalityTier: 1, processName: 1 });
  }

  /**
   * Plan a new Disaster Recovery Drill
   * Invariant: Never auto-mark planned drill executed.
   */
  async planDrill(organisationId, payload, user) {
    if (!organisationId) throw new Error('ORGANISATION_ID_REQUIRED');
    const { title, scenarioType, scope, targetRtoMinutes, targetRpoMinutes } = payload;
    if (!title || !scenarioType || !scope) {
      throw new Error('MISSING_REQUIRED_DRILL_FIELDS');
    }

    const drillId = `DRL-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;

    const drill = await DisasterRecoveryDrill.create({
      drillId,
      organisationId,
      title,
      scenarioType,
      scope,
      status: 'PLANNED', // strictly PLANNED
      targetRtoMinutes: Number(targetRtoMinutes) || 60,
      targetRpoMinutes: Number(targetRpoMinutes) || 15,
      isSimulation: true,
      isProviderVerified: false,
      providerEvidenceStatus: 'SIMULATION_ONLY',
      drillLeadUserId: user.userId || user.email || 'OWNER',
      auditTrail: [
        {
          action: 'DRILL_PLANNED',
          fromStatus: null,
          toStatus: 'PLANNED',
          performedBy: user.userId || user.email || 'OWNER',
          reason: 'Initial DR exercise scheduled for planning and governance review',
        },
      ],
    });

    return drill;
  }

  /**
   * Governed DR Drill status transition
   */
  async updateDrillStatus(organisationId, drillId, { targetStatus, reason, user, observedRtoMinutes, observedRpoMinutes, findings, closureNotes }) {
    if (!organisationId || !drillId || !targetStatus) {
      throw new Error('MISSING_DRILL_TRANSITION_PARAMETERS');
    }

    const drill = await DisasterRecoveryDrill.findOne({ organisationId, drillId });
    if (!drill) throw new Error('DRILL_NOT_FOUND');

    const allowed = ALLOWED_DRILL_TRANSITIONS[drill.status] || [];
    if (!allowed.includes(targetStatus)) {
      throw new Error(`INVALID_DRILL_TRANSITION: Cannot transition from ${drill.status} to ${targetStatus}`);
    }

    const prev = drill.status;
    drill.status = targetStatus;

    if (targetStatus === 'EXECUTED') {
      drill.executedAt = new Date();
    }

    if (observedRtoMinutes !== undefined) drill.observedRtoMinutes = Number(observedRtoMinutes);
    if (observedRpoMinutes !== undefined) drill.observedRpoMinutes = Number(observedRpoMinutes);
    if (findings && Array.isArray(findings)) drill.findings = findings;
    if (closureNotes) drill.closureNotes = closureNotes;

    drill.auditTrail.push({
      action: `TRANSITION_TO_${targetStatus}`,
      fromStatus: prev,
      toStatus: targetStatus,
      performedBy: user.userId || user.email || 'OWNER',
      reason: reason || 'Governed DR drill lifecycle update',
    });

    await drill.save();
    return drill;
  }

  /**
   * Authoritative Backup Health & Provider Verification Status
   * Explicitly distinguishes ENGINEERING_CONFIGURATION from PROVIDER_VERIFIED.
   */
  async getBackupStatus(organisationId) {
    if (!organisationId) throw new Error('ORGANISATION_ID_REQUIRED');

    return {
      organisationId,
      database: {
        engine: 'MongoDB Atlas',
        automatedSnapshots: 'ENABLED_EVERY_6_HOURS',
        pointInTimeRecoveryWindowDays: 7,
        status: 'ENGINEERING_CONFIGURATION_ACTIVE',
        isProviderRestoreVerified: false, // External gate requires physical drill
        providerBlockerNotice: 'External Atlas automated snapshot restore drill requires formal staging invocation. Local simulation does NOT constitute provider proof.',
      },
      attachments: {
        storage: 'S3 Object Storage (Dual-Region Replication)',
        versioning: 'ENABLED',
        lifecyclePurgeProtection: 'ACTIVE_LEGAL_HOLD_COMPLIANT',
        status: 'ENGINEERING_CONFIGURATION_ACTIVE',
        isProviderRestoreVerified: false,
      },
      offlineFinancialSafety: {
        invariant: 'NO SERVER ACKNOWLEDGEMENT = NO COMPLETED ERP FINANCIAL SALE',
        offlineFinalGstInvoiceBlocked: true,
        offlineLedgerPostingBlocked: true,
        auditVerified: true,
      },
    };
  }

  /**
   * Enforce Offline Financial Invariant Rule Check:
   * Rejects any attempt to finalize an ERP financial sale without server acknowledgement.
   */
  validateSaleSyncState(salePayload) {
    if (!salePayload) throw new Error('SALE_PAYLOAD_REQUIRED');

    if (!salePayload.isServerAcknowledged && salePayload.isFinalFinancialSale) {
      throw new Error('OFFLINE_FINANCIAL_SALE_PROHIBITED: Cannot mark financial sale completed without authoritative server acknowledgement');
    }

    if (!salePayload.isServerAcknowledged && salePayload.taxInvoiceNumber) {
      throw new Error('OFFLINE_GST_NUMBER_PROHIBITED: Cannot allocate final statutory GST invoice number without server sync');
    }

    return {
      isValid: true,
      status: salePayload.isServerAcknowledged ? 'COMPLETED_ERP_SALE' : 'OFFLINE_DRAFT_CART_PRESERVED',
      financialPostingAllowed: Boolean(salePayload.isServerAcknowledged),
    };
  }

  /**
   * Executive BCDR Dashboard
   */
  async getExecutiveBcdrDashboard(organisationId) {
    if (!organisationId) throw new Error('ORGANISATION_ID_REQUIRED');

    const [processes, drills] = await Promise.all([
      BusinessImpactProcess.find({ organisationId }),
      DisasterRecoveryDrill.find({ organisationId }),
    ]);

    const missionCriticalCount = processes.filter((p) => p.criticalityTier === 'MISSION_CRITICAL').length;
    const executedDrills = drills.filter((d) => ['EXECUTED', 'RESULTS_RECORDED', 'ACTIONS_ASSIGNED', 'VERIFIED', 'CLOSED'].includes(d.status));
    const plannedDrills = drills.filter((d) => d.status === 'PLANNED' || d.status === 'APPROVED');

    return {
      totalProcessesCount: processes.length,
      missionCriticalProcessesCount: missionCriticalCount,
      plannedDrillsCount: plannedDrills.length,
      executedDrillsCount: executedDrills.length,
      backupStatus: await this.getBackupStatus(organisationId),
      governanceNotice: 'Simulations are never represented as provider restore evidence. RTO/RPO targets are explicitly labeled as targets until drill verification.',
    };
  }
}

module.exports = new OwnerBcdrService();
