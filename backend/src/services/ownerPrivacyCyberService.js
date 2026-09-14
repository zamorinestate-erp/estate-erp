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

  async submitPrivacyRequest(organisationId, payload, authUser) {
    if (!organisationId) throw new Error('ORGANISATION_ID_REQUIRED');
    const { requestType, reason, dataCategory, proposedCorrection } = payload;
    if (!requestType || !reason) throw new Error('MISSING_PRIVACY_REQUEST_FIELDS');

    const requestId = `PRV-${Date.now().toString().slice(-6)}-${String(Math.floor(10000 + Math.random() * 90000))}`;
    const subjectUserId = authUser.userId || authUser.id;

    const request = await PrivacyRequest.create({
      requestId,
      organisationId,
      subjectUserId,
      requestType,
      reason,
      dataCategory: dataCategory || 'GENERAL_PERSONAL_DATA',
      proposedCorrection: proposedCorrection || '',
      status: 'SUBMITTED',
      auditHistory: [
        {
          action: 'SUBMITTED',
          performedByUserId: subjectUserId,
          note: reason,
          timestamp: new Date(),
        },
      ],
    });

    return request;
  }

  async getMyPrivacyRequests(organisationId, userId) {
    if (!organisationId || !userId) throw new Error('ORGANISATION_AND_USER_ID_REQUIRED');
    return PrivacyRequest.find({ organisationId, subjectUserId: userId }).sort({ createdAt: -1 }).lean();
  }

  async discoverPersonalDataForRequest(organisationId, requestId) {
    if (!organisationId || !requestId) throw new Error('ORGANISATION_AND_REQUEST_ID_REQUIRED');
    const req = await PrivacyRequest.findOne({ organisationId, requestId }).lean();
    if (!req) throw new Error('PRIVACY_REQUEST_NOT_FOUND');

    const userId = req.subjectUserId;
    const { User } = require('../models/User');
    const { EmployeeTraining } = require('../models/EmployeeTraining');
    const { EmployeeCompetency } = require('../models/EmployeeCompetency');
    const { SopAcknowledgement } = require('../models/SopAcknowledgement');
    const { Payslip } = require('../models/Payslip');
    const { maskEmail, maskPhone, maskAadhaar, maskPan } = require('../utils/dataClassifier');

    const [userDoc, trainings, competencies, sops, payslipCount] = await Promise.all([
      User.findOne({ organisationId, userId }).lean(),
      EmployeeTraining.find({ organisationId, userId }).lean(),
      EmployeeCompetency.find({ organisationId, userId }).lean(),
      SopAcknowledgement.find({ organisationId, userId }).lean(),
      Payslip.countDocuments({ organisationId, $or: [{ employeeUserId: userId }, { employeeId: userId }] }),
    ]);

    return {
      requestId,
      organisationId,
      subjectUserId: userId,
      requestType: req.requestType,
      eligiblePersonalData: {
        profile: userDoc
          ? {
              userId: userDoc.userId,
              name: userDoc.fullName || userDoc.name,
              emailMasked: userDoc.email ? maskEmail(userDoc.email) : '',
              phoneMasked: (userDoc.phone || userDoc.phoneNumber) ? maskPhone(userDoc.phone || userDoc.phoneNumber) : '',
              aadhaarMasked: userDoc.statutoryApplicability?.aadhaarMasked || (userDoc.aadhaarNumber ? maskAadhaar(userDoc.aadhaarNumber) : null),
              panMasked: userDoc.statutoryApplicability?.pan ? maskPan(userDoc.statutoryApplicability.pan) : (userDoc.panNumber ? maskPan(userDoc.panNumber) : null),
              role: userDoc.role,
              primaryCafeId: userDoc.primaryCafeId,
            }
          : null,
        trainingRecordsCount: trainings.length,
        competencyRecordsCount: competencies.length,
        sopAcknowledgementsCount: sops.length,
      },
      statutoryRetentionBoundaries: [
        {
          domain: 'PAYROLL_AND_STATUTORY_BENEFITS',
          recordsFoundCount: payslipCount,
          statutoryBasis:
            'Income Tax Act 1961 Section 44AA & Employees Provident Funds Act 1952',
          minimumMandatoryRetentionYears: 8,
          erasurePermitted: false,
          restrictionReason:
            'Statutory financial and payroll records cannot be erased before statutory limitation period expiration.',
        },
        {
          domain: 'SECURITY_INCIDENTS_AND_AUDIT_LOGS',
          statutoryBasis:
            'Information Technology Act Section 43A / 70B & CERT-In Cyber Security Directions',
          minimumMandatoryRetentionYears: 5,
          erasurePermitted: false,
          restrictionReason:
            'Security logs and audit events must be retained to demonstrate tamper-evident regulatory compliance.',
        },
      ],
    };
  }

  /**
   * Register Third Party Data Processor
   */
  async registerThirdPartyProcessor(organisationId, payload) {
    if (!organisationId) throw new Error('ORGANISATION_ID_REQUIRED');
    const {
      providerName,
      serviceDescription,
      dataCategoriesProcessed,
      purpose,
      contractReference,
      dataStorageGeography,
      processingCountry,
      storageCountry,
      transferDestination,
      isCrossBorder,
      applicableRestriction,
      sectoralLawRestriction,
      governmentOrderReference,
      effectiveDate,
      transferAssessment,
      contractGovernance,
      securityReview,
      approval,
      rule15ReadinessStatus,
      subProcessors,
      exitDeletionObligation,
    } = payload;

    if (!providerName || !serviceDescription || !purpose) {
      throw new Error('MISSING_PROCESSOR_FIELDS');
    }

    const processorId = `PRC-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;

    const storageGeo = storageCountry || dataStorageGeography || 'India';
    const isTransfer = isCrossBorder !== undefined ? Boolean(isCrossBorder) : (storageGeo !== 'India' && storageGeo !== 'India (MeitY empaneled cloud)');

    const processor = await ThirdPartyProcessor.create({
      processorId,
      organisationId,
      providerName,
      serviceDescription,
      dataCategoriesProcessed: dataCategoriesProcessed || [],
      purpose,
      contractReference: contractReference || '',
      dataStorageGeography: dataStorageGeography || storageGeo,
      processingCountry: processingCountry || 'India',
      storageCountry: storageCountry || storageGeo,
      transferDestination: transferDestination || (isTransfer ? storageGeo : ''),
      isCrossBorder: isTransfer,
      applicableRestriction: applicableRestriction || 'NONE',
      sectoralLawRestriction: sectoralLawRestriction || '',
      governmentOrderReference: governmentOrderReference || '',
      effectiveDate: effectiveDate || null,
      transferAssessment: transferAssessment || {
        assessed: isTransfer,
        assessmentDate: isTransfer ? new Date().toISOString().split('T')[0] : null,
        safeguards: isTransfer ? 'Standard Contractual Clauses & Encryption in Transit/At Rest' : '',
        riskLevel: isTransfer ? 'LOW' : 'UNASSESSED',
      },
      contractGovernance: contractGovernance || {
        hasDpa: true,
        contractRef: contractReference || '',
        auditRights: true,
      },
      securityReview: securityReview || {
        reviewed: true,
        reviewDate: new Date().toISOString().split('T')[0],
        reviewer: 'Enterprise Security Governance',
      },
      approval: approval || {
        status: 'APPROVED',
        approvedBy: 'Data Protection Officer',
      },
      rule15ReadinessStatus: rule15ReadinessStatus || 'FUTURE_COMPLIANCE_READINESS',
      subProcessors: subProcessors || [],
      securityReviewDate: new Date().toISOString().split('T')[0],
      exitDeletionObligation: exitDeletionObligation || 'Mandatory certificate of destruction within 30 days of contract termination',
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
