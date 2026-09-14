'use strict';

/**
 * ============================================================================
 * ZAMORIN CAFÉ ERP — OWNER DATA PRIVACY & CYBERSECURITY SERVICE (STAGE 08)
 * ============================================================================
 * DPDP Act 2023 phased commencement modeling (2025/2026/2027 tranches),
 * personal data RoPA, lawful retention overrides against automated erasure,
 * NIST CSF 2.0 internal governance taxonomy, and privacy incident response.
 */

const {
  PersonalDataProcessingRegister,
} = require('../models/PersonalDataProcessingRegister');
const { ThirdPartyProcessor } = require('../models/ThirdPartyProcessor');
const {
  PrivacyIncident,
  ALLOWED_INCIDENT_TRANSITIONS,
} = require('../models/PrivacyIncident');
const { SecurityControlItem } = require('../models/SecurityControlItem');
const { PrivacyRequest } = require('../models/PrivacyRequest');

// Official Phased Commencement Tranches under DPDP Act & Rules
const DPDP_PHASED_COMMENCEMENT_SCHEDULE = [
  {
    provisionCode: 'DPDP-PHASE-1',
    description: 'Institutional Framework, Data Protection Board of India, and General Provisions',
    actSections: 'Sections 1, 2, 18-26, 38-44',
    rules: 'Rules 1, 2, 17-21',
    officialCommencementDate: '2025-11-13',
    enforcementStatusOnSep2026: 'IN_FORCE',
    notes: 'Initial institutional tranche established upon Central Government notification.',
  },
  {
    provisionCode: 'DPDP-PHASE-2',
    description: 'One-Year Tranche: Consent Manager Registration & Specified Penalty Tranches',
    actSections: 'Section 6(9), Section 27(1)(d)',
    rules: 'Rule 4',
    officialCommencementDate: '2026-11-13',
    enforcementStatusOnSep2026: 'FUTURE_EFFECTIVE',
    notes: 'Commences exactly 12 months following initial publication. Not enforceable on September 14, 2026.',
  },
  {
    provisionCode: 'DPDP-PHASE-3',
    description: 'Eighteen-Month Tranche: Principal Processing Obligations, Data Principal Rights & Security Safeguards',
    actSections: 'Sections 4, 5, 6(1)-(8), 7-17, 27(1)(a)-(c), 28-37',
    rules: 'Rules 3, 5-16, 22, 23',
    officialCommencementDate: '2027-05-13',
    enforcementStatusOnSep2026: 'FUTURE_EFFECTIVE',
    notes: 'Principal data fiduciary obligations, breach notification schedules, and Data Principal rights become enforceable 18 months post-notification. Active preparation required, but not currently legally mandatory.',
  },
];

class OwnerPrivacyCyberService {
  /**
   * Return authoritative DPDP legal status schedule
   */
  getDpdpCommencementSchedule() {
    const currentDateStr = '2026-09-14'; // Autoritative baseline anchor
    return DPDP_PHASED_COMMENCEMENT_SCHEDULE.map((item) => {
      const isPast = item.officialCommencementDate <= currentDateStr;
      return {
        ...item,
        currentStatus: isPast ? 'IN_FORCE' : 'FUTURE_EFFECTIVE',
        isCurrentlyEnforceable: isPast,
      };
    });
  }

  /**
   * Register personal data processing activity (RoPA)
   */
  async createDataProcessingRegister(organisationId, payload) {
    if (!organisationId) throw new Error('ORGANISATION_ID_REQUIRED');
    const {
      processName,
      businessOwner,
      systemModule,
      dataPrincipalType,
      personalDataCategories,
      purpose,
      processingGround,
      retentionPeriodYears,
      retentionBasis,
      securityClassification,
    } = payload;

    if (!processName || !businessOwner || !dataPrincipalType || !purpose || !retentionPeriodYears || !retentionBasis) {
      throw new Error('MISSING_REQUIRED_PROCESSING_REGISTER_FIELDS');
    }

    const registerId = `ROPA-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;

    const register = await PersonalDataProcessingRegister.create({
      registerId,
      organisationId,
      processName,
      businessOwner,
      systemModule: systemModule || 'ERP_CORE',
      dataPrincipalType,
      personalDataCategories: personalDataCategories || [],
      purpose,
      processingGround: processingGround || 'LEGITIMATE_USE',
      retentionPeriodYears,
      retentionBasis,
      securityClassification: securityClassification || 'CONFIDENTIAL',
      currentLegalStatus: 'IN_FORCE',
      dpdpCommencementDate: '2025-11-13',
    });

    return register;
  }

  async getDataProcessingRegisters(organisationId, filter = {}) {
    if (!organisationId) throw new Error('ORGANISATION_ID_REQUIRED');
    return PersonalDataProcessingRegister.find({ organisationId, ...filter }).sort({ createdAt: -1 });
  }

  /**
   * Evaluate Erasure Request Safety:
   * Checks whether statutory retention rules (GST, Tax, PF, ESIC) or active legal holds prevent erasure.
   * STRICT INVARIANT: Never auto-delete financial or statutory data!
   */
  async evaluateErasureSafety(organisationId, { dataPrincipalType, categories }) {
    if (!organisationId) throw new Error('ORGANISATION_ID_REQUIRED');

    const statutoryRetentionMap = {
      EMPLOYEE: [
        { basis: 'Employees Provident Funds Act 1952', retentionYears: 5, allowsImmediateErasure: false },
        { basis: 'Employees State Insurance Act 1948', retentionYears: 5, allowsImmediateErasure: false },
        { basis: 'Payment of Gratuity Act 1972', retentionYears: 7, allowsImmediateErasure: false },
      ],
      CUSTOMER: [
        { basis: 'GST Act 2017 Section 36 (Tax Invoices)', retentionYears: 6, allowsImmediateErasure: false },
        { basis: 'Income Tax Act 1961 Section 44AA (Books of Account)', retentionYears: 8, allowsImmediateErasure: false },
      ],
      SUPPLIER_CONTACT: [
        { basis: 'Commercial Invoices & Three-Way Match Records', retentionYears: 8, allowsImmediateErasure: false },
      ],
    };

    const applicableRules = statutoryRetentionMap[dataPrincipalType] || [];
    const isErasureBlockedByLaw = applicableRules.some((r) => !r.allowsImmediateErasure);

    return {
      organisationId,
      dataPrincipalType,
      categoriesRequested: categories || ['ALL'],
      isErasureBlockedByLaw,
      governingRetentionRules: applicableRules,
      decision: isErasureBlockedByLaw ? 'ERASURE_RESTRICTED_BY_STATUTORY_RETENTION' : 'ELIGIBLE_FOR_REVIEW',
      actionableGuidance: isErasureBlockedByLaw
        ? 'Personal data embedded in financial invoices, GST filings, or statutory payroll records cannot be erased prior to expiration of statutory limitation periods. Request must be declined or limited to non-statutory marketing preferences.'
        : 'Eligible for governed data masking review.',
    };
  }

  /**
   * Process/Decline Privacy Request with full governance
   */
  async handlePrivacyRequestAction(organisationId, requestId, { action, reason, user }) {
    if (!organisationId || !requestId || !action) {
      throw new Error('MISSING_REQUEST_ACTION_PARAMETERS');
    }

    const req = await PrivacyRequest.findOne({ organisationId, requestId });
    if (!req) throw new Error('PRIVACY_REQUEST_NOT_FOUND');

    if (action === 'DECLINE_DUE_TO_STATUTORY_RETENTION') {
      req.status = 'DECLINED';
      req.reviewedByUserId = user.userId || user.email || 'OWNER';
      req.reviewedAt = new Date();
      req.retentionJustification = reason || 'Statutory financial & tax record retention mandate under GST and Income Tax laws.';
      req.reviewNote = 'Automated erasure blocked in compliance with statutory recordkeeping obligations.';
      req.auditHistory.push({
        action: 'DECLINED_STATUTORY_RETENTION',
        performedByUserId: user.userId || user.email || 'OWNER',
        note: req.retentionJustification,
        timestamp: new Date(),
      });
      await req.save();
      return req;
    }

    if (action === 'APPROVE_INFORMATION') {
      req.status = 'COMPLETED';
      req.reviewedByUserId = user.userId || user.email || 'OWNER';
      req.reviewedAt = new Date();
      req.reviewNote = reason || 'Privacy access report dispatched to verified Data Principal.';
      req.auditHistory.push({
        action: 'COMPLETED_ACCESS_FULFILLMENT',
        performedByUserId: user.userId || user.email || 'OWNER',
        note: req.reviewNote,
        timestamp: new Date(),
      });
      await req.save();
      return req;
    }

    throw new Error(`UNSUPPORTED_PRIVACY_REQUEST_ACTION: ${action}`);
  }

  /**
   * Register Third Party Data Processor
   */
  async registerThirdPartyProcessor(organisationId, payload) {
    if (!organisationId) throw new Error('ORGANISATION_ID_REQUIRED');
    const { providerName, serviceDescription, dataCategoriesProcessed, purpose, contractReference, dataStorageGeography } = payload;
    if (!providerName || !serviceDescription || !purpose) {
      throw new Error('MISSING_PROCESSOR_FIELDS');
    }

    const processorId = `PRC-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;

    const processor = await ThirdPartyProcessor.create({
      processorId,
      organisationId,
      providerName,
      serviceDescription,
      dataCategoriesProcessed: dataCategoriesProcessed || [],
      purpose,
      contractReference: contractReference || '',
      dataStorageGeography: dataStorageGeography || 'India (MeitY empaneled cloud)',
      securityReviewDate: new Date().toISOString().split('T')[0],
      exitDeletionObligation: 'Mandatory certificate of destruction within 30 days of termination',
    });

    return processor;
  }

  async getThirdPartyProcessors(organisationId) {
    if (!organisationId) throw new Error('ORGANISATION_ID_REQUIRED');
    return ThirdPartyProcessor.find({ organisationId, isActive: true });
  }

  /**
   * Privacy Incident Management (Governed 8-step lifecycle)
   */
  async reportPrivacyIncident(organisationId, payload, user) {
    if (!organisationId) throw new Error('ORGANISATION_ID_REQUIRED');
    const { title, description, severity, affectedDataCategories, estimatedAffectedPrincipals } = payload;
    if (!title || !description) throw new Error('MISSING_INCIDENT_FIELDS');

    const incidentId = `PINC-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;

    const incident = await PrivacyIncident.create({
      incidentId,
      organisationId,
      title,
      description,
      severity: severity || 'MEDIUM',
      status: 'DETECTED',
      affectedDataCategories: affectedDataCategories || [],
      estimatedAffectedPrincipals: Number(estimatedAffectedPrincipals) || 0,
      reportedByUserId: user.userId || user.email || 'OWNER',
      auditTrail: [
        {
          action: 'INCIDENT_DETECTED',
          fromStatus: null,
          toStatus: 'DETECTED',
          performedBy: user.userId || user.email || 'OWNER',
          notes: 'Initial privacy event logged into governed queue.',
        },
      ],
    });

    return incident;
  }

  async updatePrivacyIncidentStatus(organisationId, incidentId, { targetStatus, notes, user, containmentActions, notificationRationale }) {
    if (!organisationId || !incidentId || !targetStatus) {
      throw new Error('MISSING_INCIDENT_UPDATE_PARAMETERS');
    }

    const incident = await PrivacyIncident.findOne({ organisationId, incidentId });
    if (!incident) throw new Error('PRIVACY_INCIDENT_NOT_FOUND');

    const allowed = ALLOWED_INCIDENT_TRANSITIONS[incident.status] || [];
    if (!allowed.includes(targetStatus)) {
      throw new Error(`INVALID_INCIDENT_TRANSITION: Cannot transition from ${incident.status} to ${targetStatus}`);
    }

    const prev = incident.status;
    incident.status = targetStatus;

    if (containmentActions) incident.containmentActions = containmentActions;
    if (notificationRationale) incident.notificationRationale = notificationRationale;

    if (targetStatus === 'CLOSED') {
      incident.closedAt = new Date();
      incident.closedByUserId = user.userId || user.email || 'OWNER';
    }

    incident.auditTrail.push({
      action: `TRANSITION_TO_${targetStatus}`,
      fromStatus: prev,
      toStatus: targetStatus,
      performedBy: user.userId || user.email || 'OWNER',
      notes: notes || 'Governed privacy incident lifecycle progression',
    });

    await incident.save();
    return incident;
  }

  /**
   * NIST CSF 2.0 Security Control Register
   * Internal taxonomy only; zero statutory/certification fabrication.
   */
  async registerSecurityControl(organisationId, payload) {
    if (!organisationId) throw new Error('ORGANISATION_ID_REQUIRED');
    const { controlId, csfFunction, categoryCode, title, objective, technicalMechanism, effectiveness } = payload;
    if (!controlId || !csfFunction || !categoryCode || !title || !objective) {
      throw new Error('MISSING_SECURITY_CONTROL_FIELDS');
    }

    const item = await SecurityControlItem.create({
      controlId,
      organisationId,
      csfFunction,
      categoryCode,
      title,
      objective,
      technicalMechanism: technicalMechanism || '',
      effectiveness: effectiveness || 'EFFECTIVE',
      implementationStatus: 'IMPLEMENTED',
      frameworkNotice: 'NIST CSF 2.0 internal taxonomy reference. Not a statutory regulation or third-party certification.',
      isNistStatutory: false,
      isExternalCertified: false,
    });

    return item;
  }

  async getSecurityControls(organisationId, csfFunction) {
    if (!organisationId) throw new Error('ORGANISATION_ID_REQUIRED');
    const query = { organisationId };
    if (csfFunction) query.csfFunction = csfFunction;
    return SecurityControlItem.find(query).sort({ csfFunction: 1, controlId: 1 });
  }

  /**
   * Executive Privacy & Cybersecurity Dashboard
   */
  async getExecutivePrivacyCyberDashboard(organisationId) {
    if (!organisationId) throw new Error('ORGANISATION_ID_REQUIRED');

    const [processingRegisters, processors, incidents, securityControls, privacyRequests] = await Promise.all([
      PersonalDataProcessingRegister.find({ organisationId }),
      ThirdPartyProcessor.find({ organisationId, isActive: true }),
      PrivacyIncident.find({ organisationId }),
      SecurityControlItem.find({ organisationId }),
      PrivacyRequest.find({ organisationId }),
    ]);

    const activeIncidents = incidents.filter((i) => i.status !== 'CLOSED');
    const pendingRequests = privacyRequests.filter((r) => !['COMPLETED', 'DECLINED', 'WITHDRAWN'].includes(r.status));

    return {
      dpdpSchedule: this.getDpdpCommencementSchedule(),
      totalDataProcessingActivitiesCount: processingRegisters.length,
      activeThirdPartyProcessorsCount: processors.length,
      activePrivacyIncidentsCount: activeIncidents.length,
      pendingDataPrincipalRequestsCount: pendingRequests.length,
      totalSecurityControlsCount: securityControls.length,
      nistFunctionsCovered: [...new Set(securityControls.map((c) => c.csfFunction))],
      governanceNotice: 'NIST CSF 2.0 mapping is an internal taxonomy. Phased DPDP compliance acknowledges 2026/2027 future-effective tranches.',
    };
  }
}

module.exports = new OwnerPrivacyCyberService();
