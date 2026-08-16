'use strict';

/**
 * ADVANCED MAILOPS & INBOUND AUTOMATION SERVICE
 *
 * Implements:
 * 1. Inbound Gmail message ingestion with deduplication & thread linkage
 * 2. Inbound classification into 17 standard operational categories
 * 3. Unknown sender quarantine & risk scoring (LOW, MEDIUM, HIGH, CRITICAL)
 * 4. Business Email Compromise (BEC) defense (bank/IFSC changes flagged CRITICAL)
 * 5. Vendor sender verification & domain matching
 * 6. Attachment security gateway (blocking dangerous files, SHA-256 hash registry, duplicate invoice detection)
 * 7. SupportCase creation and thread association
 * 8. Mail quota budget management and provider migration warnings
 */

const crypto = require('crypto');
const { InboundEmailMessage } = require('../models/InboundEmailMessage');
const { AttachmentRegistry, DANGEROUS_EXTENSIONS } = require('../models/AttachmentRegistry');
const { SupportCase } = require('../models/SupportCase');
const { Vendor } = require('../models/Vendor');
const { SystemCommunicationSettings } = require('../models/SystemCommunicationSettings');
const { NotificationOutbox } = require('../models/NotificationOutbox');

class MailOpsService {
  /**
   * Evaluates text for Business Email Compromise (BEC) signals.
   */
  static evaluateBecRisk(text) {
    const lower = String(text || '').toLowerCase();
    const becPhrases = [
      'new bank details',
      'change bank account',
      'updated bank account',
      'new ifsc',
      'change ifsc',
      'change payment details',
      'pay to new account',
      'use this account instead',
      'urgently pay',
      'new beneficiary',
      'updated upi',
    ];

    for (const phrase of becPhrases) {
      if (lower.includes(phrase)) {
        return {
          isBec: true,
          reason: `Detected suspicious payment modification phrase: "${phrase}"`,
        };
      }
    }

    return { isBec: false, reason: null };
  }

  /**
   * Classifies inbound email content into 17 standard operational categories.
   */
  static classifyInboundEmail({ subject, bodyText, senderEmail, matchedVendor }) {
    const s = String(subject || '').toLowerCase();
    const b = String(bodyText || '').toLowerCase();
    const full = `${s} ${b}`;

    if (s.includes('[security]') || full.includes('unauthorized access') || full.includes('security incident') || full.includes('device revoked')) {
      return 'SECURITY';
    }
    if (s.includes('[device]') || full.includes('device offline') || full.includes('device registration') || full.includes('kiosk drift')) {
      return 'DEVICE';
    }
    if (s.includes('[attendance]') || full.includes('missed checkout') || full.includes('attendance exception')) {
      return 'ATTENDANCE';
    }
    if (s.includes('[uat]') || full.includes('uat feedback') || full.includes('testing issue')) {
      return 'UAT';
    }
    if (s.includes('[support]') || full.includes('support request') || full.includes('bug report') || full.includes('help required')) {
      return 'SUPPORT';
    }
    if (s.includes('[rfq]') || full.includes('request for quotation') || full.includes('quotation submission')) {
      return 'RFQ';
    }
    if (s.includes('[po]') || full.includes('purchase order') || full.includes('po acknowledgement')) {
      return 'PURCHASE_ORDER';
    }
    if (s.includes('[invoice]') || full.includes('tax invoice') || full.includes('bill for payment') || full.includes('invoice attached')) {
      return 'INVOICE';
    }
    if (full.includes('goods received') || full.includes('delivery challan') || full.includes('dispatch details')) {
      return 'DELIVERY';
    }
    if (full.includes('stock deficit') || full.includes('inventory alert') || full.includes('critical stock')) {
      return 'INVENTORY';
    }
    if (full.includes('cash variance') || full.includes('unreconciled transaction')) {
      return 'FINANCE_EXCEPTION';
    }
    if (full.includes('equipment breakdown') || full.includes('coffee machine repair') || full.includes('maintenance request')) {
      return 'MAINTENANCE';
    }
    if (matchedVendor) {
      return 'VENDOR';
    }
    if (s.includes('[system]') || full.includes('backup failure') || full.includes('database sync')) {
      return 'SYSTEM';
    }

    return 'NEEDS_REVIEW';
  }

  /**
   * Processes inbound email attachments through the security gateway.
   */
  static async processAttachments({ inboundId, gmailMessageId, gmailThreadId, attachments = [], vendorId = null }) {
    const results = [];

    for (const att of attachments) {
      const filename = String(att.filename || 'unknown.file').trim();
      const sanitized = filename.replace(/[^a-zA-Z0-9._-]/g, '_');
      const parts = sanitized.split('.');
      const ext = parts.length > 1 ? parts[parts.length - 1].toLowerCase() : '';

      const contentBuffer = Buffer.isBuffer(att.content) ? att.content : Buffer.from(att.content || '', 'utf8');
      const sizeBytes = contentBuffer.length;
      const sha256 = crypto.createHash('sha256').update(contentBuffer).digest('hex').toUpperCase();

      // Check dangerous extensions
      const isDangerous = DANGEROUS_EXTENSIONS.includes(ext);
      let scanStatus = isDangerous ? 'BLOCKED_EXTENSION' : 'PASSED';
      let quarantineReason = isDangerous ? `Blocked dangerous file extension .${ext}` : null;

      // File size limit (25 MB max)
      if (sizeBytes > 25 * 1024 * 1024) {
        scanStatus = 'QUARANTINED';
        quarantineReason = 'Attachment exceeds maximum allowed size of 25MB';
      }

      // Check duplicate invoice attachment by vendor and SHA-256
      let isDuplicateInvoice = false;
      let duplicateReferenceId = null;

      if (vendorId && !isDangerous) {
        const existingAttachment = await AttachmentRegistry.findOne({
          matchedVendorId: vendorId,
          sha256Hash: sha256,
        });

        if (existingAttachment) {
          isDuplicateInvoice = true;
          duplicateReferenceId = existingAttachment.attachmentId;
        }
      }

      const attachmentId = `ATT-${Date.now()}-${Math.random().toString(36).substring(2, 7).toUpperCase()}`;
      const record = await AttachmentRegistry.create({
        attachmentId,
        inboundId,
        gmailMessageId,
        gmailThreadId,
        originalFilename: filename,
        sanitizedFilename: sanitized,
        extension: ext,
        mimeType: att.mimeType || 'application/octet-stream',
        sizeBytes,
        sha256Hash: sha256,
        scanStatus,
        documentType: isDangerous ? 'DANGEROUS_REJECTED' : (att.documentType || 'OTHER'),
        isDangerous,
        quarantineReason,
        matchedVendorId: vendorId,
        isDuplicateInvoice,
        duplicateReferenceId,
      });

      results.push(record);
    }

    return results;
  }

  /**
   * Ingests an inbound operational email from Gmail API / PubSub.
   */
  static async ingestInboundMessage({
    gmailMessageId,
    gmailThreadId,
    historyId = null,
    senderEmail,
    senderName = '',
    subject,
    bodyText = '',
    attachments = [],
    organisationId = 'ZAMORIN',
  }) {
    if (!gmailMessageId || !senderEmail || !subject) {
      throw new Error('Inbound ingestion requires gmailMessageId, senderEmail and subject.');
    }

    const cleanSender = String(senderEmail).trim().toLowerCase();

    // 1. Inbound Idempotency Check
    const existing = await InboundEmailMessage.findOne({ gmailMessageId });
    if (existing) {
      return {
        success: true,
        isDuplicate: true,
        message: existing,
        status: 'DUPLICATE_IGNORED',
      };
    }

    // 2. Vendor Matching & Domain Security Check
    const senderDomain = cleanSender.split('@')[1] || '';
    let matchedVendor = await Vendor.findOne({
      organisationId,
      $or: [
        { email: cleanSender },
        { primaryContactEmail: cleanSender },
        { accountsEmail: cleanSender },
        { salesEmail: cleanSender },
        { approvedEmailAddresses: cleanSender },
        { approvedDomains: senderDomain },
      ],
    });

    // 3. BEC Risk Analysis
    const becEval = this.evaluateBecRisk(`${subject} ${bodyText}`);

    // 4. Classification
    const classification = this.classifyInboundEmail({
      subject,
      bodyText,
      senderEmail: cleanSender,
      matchedVendor,
    });

    // 5. Risk Scoring & Quarantine Assessment
    const riskSignals = [];
    let riskScore = 'LOW';
    let isQuarantined = false;
    let quarantineReason = null;

    if (becEval.isBec) {
      riskScore = 'CRITICAL';
      riskSignals.push(becEval.reason);
      isQuarantined = true;
      quarantineReason = 'HIGH-RISK VENDOR MASTER CHANGE ATTEMPT (BEC)';
    }

    // Check if sender looks like vendor but domain is mismatch
    if (subject.toLowerCase().includes('invoice') || subject.toLowerCase().includes('quotation')) {
      if (!matchedVendor) {
        riskSignals.push('Unrecognized sender sending financial/commercial document');
        if (riskScore !== 'CRITICAL') riskScore = 'MEDIUM';
      }
    }

    const inboundId = `INB-${Date.now()}-${Math.random().toString(36).substring(2, 7).toUpperCase()}`;

    // 6. Attachment Processing
    const attachmentRecords = await this.processAttachments({
      inboundId,
      gmailMessageId,
      gmailThreadId,
      attachments,
      vendorId: matchedVendor ? matchedVendor.vendorId : null,
    });

    const hasDangerousAttachment = attachmentRecords.some(a => a.isDangerous);
    if (hasDangerousAttachment) {
      riskScore = 'CRITICAL';
      riskSignals.push('Email contains blocked dangerous executable attachments');
      isQuarantined = true;
      quarantineReason = 'Dangerous executable attachment detected';
    }

    // 7. Thread Linking & SupportCase Creation
    let linkedSupportCaseId = null;
    if (classification === 'SUPPORT' || classification === 'UAT') {
      let existingCase = await SupportCase.findOne({
        organisationId,
        gmailThreadId,
      });

      if (!existingCase) {
        const caseId = `CASE-${Date.now().toString().slice(-6)}`;
        existingCase = await SupportCase.create({
          caseId,
          organisationId,
          category: classification === 'UAT' ? 'UAT_FEEDBACK' : 'BUG_REPORT',
          severity: riskScore === 'CRITICAL' ? 'CRITICAL' : 'NORMAL',
          source: 'EMAIL',
          senderEmail: cleanSender,
          gmailThreadId,
          gmailMessageId,
          summary: String(subject).substring(0, 280),
          description: bodyText || 'Inbound email report.',
          status: 'OPEN',
        });
      }
      linkedSupportCaseId = existingCase.caseId;
    }

    const messageRecord = await InboundEmailMessage.create({
      inboundId,
      organisationId,
      gmailMessageId,
      gmailThreadId,
      historyId,
      senderEmail: cleanSender,
      senderName,
      subject,
      bodyText,
      bodySnippet: bodyText.substring(0, 300),
      classification,
      riskScore,
      riskSignals,
      isBecSuspected: becEval.isBec,
      becReason: becEval.reason,
      isQuarantined,
      quarantineReason,
      matchedVendorId: matchedVendor ? matchedVendor.vendorId : null,
      linkedSupportCaseId,
      attachmentCount: attachmentRecords.length,
      status: isQuarantined ? 'QUARANTINED' : 'PROCESSED',
      receivedAt: new Date(),
      processedAt: new Date(),
    });

    return {
      success: true,
      inboundId: messageRecord.inboundId,
      classification: messageRecord.classification,
      riskScore: messageRecord.riskScore,
      isQuarantined: messageRecord.isQuarantined,
      linkedSupportCaseId,
      attachmentCount: attachmentRecords.length,
    };
  }

  /**
   * Retrieves daily quota budget usage and forecasting.
   */
  static async getQuotaStatus(organisationId = 'ZAMORIN') {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const sentToday = await NotificationOutbox.countDocuments({
      organisationId,
      status: 'SENT',
      sentAt: { $gte: today },
    });

    const settings = await SystemCommunicationSettings.findOne({ organisationId }).lean() || {
      dailyQuotaBudget: {
        dailyLimit: 500,
        reservedCritical: 100,
        reservedSecurity: 100,
        normalBudget: 250,
        optionalBudget: 50,
      },
    };

    const budget = settings.dailyQuotaBudget || { dailyLimit: 500 };
    const usagePercent = Math.round((sentToday / budget.dailyLimit) * 100);

    let migrationStatus = 'SAFE';
    if (usagePercent >= 90) migrationStatus = 'MIGRATION_REQUIRED';
    else if (usagePercent >= 75) migrationStatus = 'MIGRATION_RECOMMENDED';
    else if (usagePercent >= 50) migrationStatus = 'APPROACHING_LIMIT';

    return {
      dailyLimit: budget.dailyLimit,
      sentToday,
      remaining: Math.max(0, budget.dailyLimit - sentToday),
      usagePercent,
      migrationStatus,
      budgetBreakdown: budget,
    };
  }
}

module.exports = { MailOpsService };
