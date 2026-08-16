'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

const { InboundEmailMessage } = require('../src/models/InboundEmailMessage');
const { AttachmentRegistry } = require('../src/models/AttachmentRegistry');
const { SupportCase } = require('../src/models/SupportCase');
const { Vendor } = require('../src/models/Vendor');
const { MailOpsService } = require('../src/services/MailOpsService');

test('Inbound MailOps, BEC Defense & Attachment Security Suite', async (t) => {
  let mongoServer;

  t.before(async () => {
    mongoServer = await MongoMemoryServer.create();
    await mongoose.connect(mongoServer.getUri());

    // Seed approved Vendor
    await Vendor.create({
      vendorId: 'VEN-0001',
      organisationId: 'ZAMORIN',
      name: 'Malabar Coffee Supplies',
      category: 'FOOD_BEVERAGE',
      email: 'orders@malabarcoffee.com',
      approvedEmailAddresses: ['orders@malabarcoffee.com', 'accounts@malabarcoffee.com'],
      approvedDomains: ['malabarcoffee.com'],
      status: 'ACTIVE',
      createdByUserId: 'MU-0001',
    });
  });

  t.after(async () => {
    await mongoose.disconnect();
    if (mongoServer) await mongoServer.stop();
  });

  await t.test('BEC Defense: Detects bank account modification request and flags CRITICAL quarantine', async () => {
    const result = await MailOpsService.ingestInboundMessage({
      gmailMessageId: 'GMAIL-MSG-BEC-001',
      gmailThreadId: 'THREAD-BEC-001',
      senderEmail: 'attacker@spoofed-domain.com',
      subject: 'URGENT: Updated Bank Account for Invoice Settlement',
      bodyText: 'Please change bank account details to our new beneficiary account immediately before paying overdue invoice.',
      organisationId: 'ZAMORIN',
    });

    assert.equal(result.success, true);
    assert.equal(result.riskScore, 'CRITICAL');
    assert.equal(result.isQuarantined, true);

    const saved = await InboundEmailMessage.findOne({ gmailMessageId: 'GMAIL-MSG-BEC-001' });
    assert.ok(saved);
    assert.equal(saved.isBecSuspected, true);
    assert.equal(saved.status, 'QUARANTINED');
    assert.ok(saved.becReason.includes('Detected suspicious payment modification phrase'));
  });

  await t.test('Attachment Security Gateway: Blocks dangerous extensions (.exe, .bat, .cmd, etc.)', async () => {
    const result = await MailOpsService.ingestInboundMessage({
      gmailMessageId: 'GMAIL-MSG-MAL-001',
      gmailThreadId: 'THREAD-MAL-001',
      senderEmail: 'hacker@phishing.net',
      subject: 'Updated Quotation Document',
      bodyText: 'Please find attached quotation invoice.',
      attachments: [
        {
          filename: 'quotation_invoice.pdf.exe',
          content: Buffer.from('MZ_DANGEROUS_PAYLOAD'),
          mimeType: 'application/x-msdownload',
        },
      ],
      organisationId: 'ZAMORIN',
    });

    assert.equal(result.success, true);
    assert.equal(result.riskScore, 'CRITICAL');
    assert.equal(result.isQuarantined, true);

    const att = await AttachmentRegistry.findOne({ originalFilename: 'quotation_invoice.pdf.exe' });
    assert.ok(att);
    assert.equal(att.scanStatus, 'BLOCKED_EXTENSION');
    assert.equal(att.isDangerous, true);
    assert.equal(att.documentType, 'DANGEROUS_REJECTED');
  });

  await t.test('Duplicate Invoice Detection: Identifies duplicate attachment hash from vendor', async () => {
    const invoicePayload = Buffer.from('TAX_INVOICE_CONTENT_ABC_12345');

    // First legitimate invoice
    await MailOpsService.ingestInboundMessage({
      gmailMessageId: 'GMAIL-MSG-INV-001',
      gmailThreadId: 'THREAD-INV-001',
      senderEmail: 'orders@malabarcoffee.com',
      subject: 'Tax Invoice #MC-2026-081',
      bodyText: 'Please find attached invoice for payment.',
      attachments: [
        {
          filename: 'invoice_MC_081.pdf',
          content: invoicePayload,
          mimeType: 'application/pdf',
          documentType: 'INVOICE',
        },
      ],
      organisationId: 'ZAMORIN',
    });

    // Duplicate resend of exact same invoice payload
    const duplicateRes = await MailOpsService.ingestInboundMessage({
      gmailMessageId: 'GMAIL-MSG-INV-002',
      gmailThreadId: 'THREAD-INV-002',
      senderEmail: 'orders@malabarcoffee.com',
      subject: 'Resending Tax Invoice #MC-2026-081',
      bodyText: 'Resending previous invoice.',
      attachments: [
        {
          filename: 'invoice_MC_081_copy.pdf',
          content: invoicePayload,
          mimeType: 'application/pdf',
          documentType: 'INVOICE',
        },
      ],
      organisationId: 'ZAMORIN',
    });

    assert.equal(duplicateRes.success, true);

    const dupAtt = await AttachmentRegistry.findOne({ originalFilename: 'invoice_MC_081_copy.pdf' });
    assert.ok(dupAtt);
    assert.equal(dupAtt.isDuplicateInvoice, true);
    assert.ok(dupAtt.duplicateReferenceId);
  });

  await t.test('Support Case Generation & Thread Linkage: Inbound UAT creates and links cases', async () => {
    // Message 1: Initial feedback
    const res1 = await MailOpsService.ingestInboundMessage({
      gmailMessageId: 'GMAIL-UAT-001',
      gmailThreadId: 'GMAIL-THREAD-UAT-888',
      senderEmail: 'tester@zamorin.com',
      subject: '[UAT] POS Print Alignment in Calicut',
      bodyText: 'Thermal print width needs 2mm left margin adjustment.',
      organisationId: 'ZAMORIN',
    });

    assert.equal(res1.success, true);
    assert.ok(res1.linkedSupportCaseId);

    const caseObj = await SupportCase.findOne({ caseId: res1.linkedSupportCaseId });
    assert.ok(caseObj);
    assert.equal(caseObj.category, 'UAT_FEEDBACK');
    assert.equal(caseObj.status, 'OPEN');

    // Message 2: Follow up reply in same thread
    const res2 = await MailOpsService.ingestInboundMessage({
      gmailMessageId: 'GMAIL-UAT-002',
      gmailThreadId: 'GMAIL-THREAD-UAT-888',
      senderEmail: 'tester@zamorin.com',
      subject: 'Re: [UAT] POS Print Alignment in Calicut',
      bodyText: 'Verified on Epson TM-T82II printer.',
      organisationId: 'ZAMORIN',
    });

    assert.equal(res2.success, true);
    assert.equal(res2.linkedSupportCaseId, caseObj.caseId, 'Reply in same thread must link to existing SupportCase');
  });
});
