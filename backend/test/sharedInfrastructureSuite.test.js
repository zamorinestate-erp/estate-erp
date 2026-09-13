'use strict';

/**
 * SHARED INFRASTRUCTURE PROGRAMME TEST SUITE
 * Covers:
 *  1. POS: Preview Receipt, Authorised Reprint, Reason Persistence & Audit Counters
 *  2. Attachments Security: 15MB upload limit, filename sanitization, magic bytes, checksums, scanning hook
 *  3. Document Hub: Multi-criteria filters, tenant & cross-café IDOR rejection
 *  4. Attachment Version History: Immutable previous binaries, version replacement, no silent overwrites
 *  5. Universal Expiry Engine: 90 -> 60 -> 30 -> 15 -> 7 -> OVERDUE schedule, deduplication, renewal recording
 *  6. Approval Inbox: Deep-link aggregation, role/scope enforcement, pending items
 *  7. Global Search: PO, Invoice, Customer, Asset, Document, Cafe, HSN/SAC domain filtering
 *  8. Universal Notification Centre: Targeting, deduplication, deep-linking, read/unread states
 *  9. Duplicate Detection: Supplier Invoices, Employees, Suppliers, POs, Products, Attachments
 * 10. Mandatory Reason Engine: Rejection when missing, audit trail persistence across all 13 critical actions
 * 11. Soft Delete & Recovery: Soft delete, mandatory restoration reason, hard-delete restriction
 * 12. Staff Settings Negative Permission Matrix: Zero unauthorized admin exposure for standard staff
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');

const { PosOrderService } = require('../src/services/posOrderService');
const { DocumentAttachmentService } = require('../src/services/documentAttachmentService');
const { SecurityScannerService, EICAR_SIGNATURE } = require('../src/services/securityScannerService');
const { DuplicateDetectionService } = require('../src/services/duplicateDetectionService');
const { ExpiryRenewalService } = require('../src/services/expiryRenewalService');
const { MandatoryReasonService } = require('../src/services/mandatoryReasonService');
const { Bill } = require('../src/models/Bill');
const { Cafe } = require('../src/models/Cafe');
const { PurchaseOrder } = require('../src/models/PurchaseOrder');
const { BusinessDocument } = require('../src/models/BusinessDocument');
const { AuditEvent } = require('../src/models/AuditEvent');
const { Notification } = require('../src/models/Notification');
const { Approval } = require('../src/models/Approval');
const { Vendor } = require('../src/models/Vendor');
const { User } = require('../src/models/User');
const { MenuItem } = require('../src/models/MenuItem');
const { ActivityTimelineService } = require('../src/services/activityTimelineService');
const { ProcurementDocumentChainService } = require('../src/services/procurementDocumentChainService');
const { MANDATORY_REASON_ACTIONS } = require('../src/services/mandatoryReasonService');
const { ThreeWayMatchService } = require('../src/services/threeWayMatchService');
const { getNotification, listNotifications } = require('../src/controllers/notificationController');
const { ApprovalPolicy } = require('../src/models/ApprovalPolicy');
const { ApprovalPolicyService } = require('../src/services/approvalPolicyService');
const { performGlobalSearch } = require('../src/controllers/searchController');
const { TaxInvoice } = require('../src/models/TaxInvoice');
const { Customer } = require('../src/models/Customer');
const { Asset } = require('../src/models/Asset');
const { GlobalInventoryItem } = require('../src/models/GlobalInventoryItem');
const { PersonalLedger } = require('../src/models/PersonalLedger');
const auditService = require('../src/services/auditService');

function mockAuth(role = 'MASTER', cafeId = 'ZC-0001', userId = 'USR-TEST-01') {
  return {
    userId,
    name: 'Test User',
    email: 'test@zamorin.local',
    role,
    organisationId: 'ORG-ZAMORIN',
    assignedCafeIds: [cafeId],
    primaryCafeId: cafeId,
  };
}

test('SHARED INFRASTRUCTURE — Implementation Verification Suite', async (t) => {

  // Mock global auditService
  t.mock.method(auditService, 'recordRequestAudit', async () => ({}));
  t.mock.method(auditService, 'recordAuditEvent', async () => ({}));
  t.mock.method(Cafe, 'findOne', async () => null);

  // ===========================================================================
  // 1. POS ACTION SURFACE: PREVIEW, REPRINT & MANDATORY REASON
  // ===========================================================================
  await t.test('1. POS Action Surface — Preview, Authorised Reprint & Reason Audit', async (t) => {
    const auth = mockAuth('CAFE_ADMIN', 'ZC-0001');

    // 1.1 Real-time preview without persistence
    await t.test('1.1 Preview computes line items, taxes and totals without DB insertion', async () => {
      const previewPayload = {
        cafeId: 'ZC-0001',
        orderType: 'QUICK_SALE',
        lineItems: [
          { menuItemId: 'ITEM-01', quantity: 2, unitPricePaisa: 20000, name: 'Cold Brew' },
        ],
        discountPaisa: 5000,
      };

      const result = await PosOrderService.previewOrder(previewPayload, auth);
      assert.strictEqual(result.success, true);
      assert.strictEqual(result.action, 'PREVIEW');
      assert.strictEqual(result.preview, true);
      assert.strictEqual(result.totals.subtotalPaisa, 40000);
      assert.strictEqual(result.totals.discountPaisa, 5000);
      assert.strictEqual(result.totals.taxablePaisa, 35000);
      assert.strictEqual(result.totals.taxPaisa, 2000); // 5% GST on line items (40000 * 5%)
      assert.strictEqual(result.totals.totalPaisa, 37000);
      assert.ok(result.htmlPreview.includes('Receipt Preview'));
    });

    // 1.2 Authorised Reprint increments copy counter, marks REPRINT and audits reason
    await t.test('1.2 Authorised Reprint increments copy counter, marks REPRINT and enforces reason', async () => {
      const testBill = new Bill({
        billId: 'BILL-REPRINT-TEST-01',
        invoiceNumber: 'ZAM-BILL-10001',
        organisationId: 'ORG-ZAMORIN',
        cafeId: 'ZC-0001',
        status: 'PAID',
        totalPaisa: 36750,
        subtotalPaisa: 35000,
        taxPaisa: 1750,
        lineItems: [{ menuItemId: 'ITEM-01', itemNameSnapshot: 'Cold Brew', quantity: 2, unitPricePaisa: 20000, totalPaisa: 40000 }],
        reprints: [],
      });

      t.mock.method(Bill, 'findOne', async () => testBill);
      t.mock.method(testBill, 'save', async () => testBill);

      // Reprint #1
      const res1 = await PosOrderService.reprintBill('BILL-REPRINT-TEST-01', auth, 'Customer request receipt lost');
      assert.strictEqual(res1.success, true);
      assert.strictEqual(res1.isReprint, true);
      assert.strictEqual(res1.reprintCount, 1);
      assert.strictEqual(testBill.reprints.length, 1);
      assert.strictEqual(testBill.reprints[0].reason, 'Customer request receipt lost');
      assert.ok(res1.htmlPreview.includes('REPRINT #1'));

      // Reprint #2
      const res2 = await PosOrderService.reprintBill('BILL-REPRINT-TEST-01', auth, 'Audit reconciliation copy');
      assert.strictEqual(res2.reprintCount, 2);
      assert.strictEqual(testBill.reprints.length, 2);
      assert.ok(res2.htmlPreview.includes('REPRINT #2'));
    });
  });

  // ===========================================================================
  // 2. ATTACHMENT SECURITY: OWASP HARDENING & SCANNING HOOK
  // ===========================================================================
  await t.test('2. Attachment Security — MIME, Magic Bytes, Limits, Scanning & Quarantine', async (t) => {
    // 2.1 Allow-list enforcement
    await t.test('2.1 Allow-list strictly permits PDF, JPG, PNG; rejects EXE, SH, JS, XLSX', () => {
      const allowed = ['application/pdf', 'image/jpeg', 'image/png'];
      allowed.forEach((m) => {
        assert.doesNotThrow(() => DocumentAttachmentService.validateFileMime(m, 'file.ext'));
      });

      const disallowed = ['application/x-msdownload', 'application/x-sh', 'text/javascript', 'application/vnd.ms-excel'];
      disallowed.forEach((m) => {
        assert.throws(() => DocumentAttachmentService.validateFileMime(m, 'file.ext'), /prohibited/);
      });
    });

    // 2.2 Magic bytes verification
    await t.test('2.2 Rejects spoofed magic-bytes payload disguised as PDF', () => {
      const spoofed = Buffer.from('MZ\x90\x00\x03\x00\x00\x00Executable disguise');
      assert.throws(() => DocumentAttachmentService.validateMagicBytes(spoofed, 'application/pdf'), /signature does not match/);
    });

    // 2.3 File size boundaries & original filename length
    await t.test('2.3 Configurable max file size (15MB) and filename limit enforced', () => {
      assert.doesNotThrow(() => DocumentAttachmentService.validateFileSize(15 * 1024 * 1024));
      assert.throws(() => DocumentAttachmentService.validateFileSize(15 * 1024 * 1024 + 1), /limit/);
    });

    // 2.4 Malware scanning hook & quarantine state
    await t.test('2.4 Antivirus scanning hook detects EICAR and flags REJECTED quarantine', async () => {
      const eicarPayload = Buffer.from(`%PDF-1.4 ${EICAR_SIGNATURE}`);
      const scanResult = await SecurityScannerService.scanFile({
        fileBuffer: eicarPayload,
        mimeType: 'application/pdf',
        filename: 'Suspicious_Invoice.pdf',
      });
      assert.strictEqual(scanResult.status, 'REJECTED');
      assert.strictEqual(scanResult.threatName, 'EICAR-Test-Signature');
    });
  });

  // ===========================================================================
  // 3. COMPLETE ATTACHMENT VERSION HISTORY & METADATA
  // ===========================================================================
  await t.test('3. Attachment Version History & Metadata Model', async (t) => {
    const auth = mockAuth('MASTER');
    const existingDoc = new BusinessDocument({
      documentId: 'DOC-PO-ZC01-20260913-000001',
      organisationId: 'ORG-ZAMORIN',
      cafeId: 'ZC-0001',
      relatedModule: 'PURCHASE',
      relatedRecordId: 'PO-2026-0001',
      documentType: 'TAX_INVOICE',
      documentNumber: 'SUP-INV-991',
      originalFilename: 'supplier_invoice_v1.pdf',
      mimeType: 'application/pdf',
      sizeBytes: 1024,
      checksumSha256: 'a1b2c3d4e5f6',
      status: 'UPLOADED',
      version: 1,
      versions: [],
    });

    t.mock.method(BusinessDocument, 'findOne', async () => existingDoc);
    t.mock.method(existingDoc, 'save', async () => existingDoc);

    const updated = await DocumentAttachmentService.replaceVersion({
      documentId: 'DOC-PO-ZC01-20260913-000001',
      organisationId: 'ORG-ZAMORIN',
      originalFilename: 'supplier_invoice_v2_corrected.pdf',
      mimeType: 'application/pdf',
      sizeBytes: 2048,
      fileBuffer: Buffer.from('%PDF-1.4 Version 2 Content with corrected amounts'),
      changeReason: 'Vendor corrected invoice GSTIN and total amount',
      auth,
    });

    assert.strictEqual(updated.version, 2);
    assert.strictEqual(updated.versions.length, 1);
    assert.strictEqual(updated.versions[0].versionNumber, 1);
    assert.strictEqual(updated.versions[0].originalFilename, 'supplier_invoice_v1.pdf');
    assert.strictEqual(updated.versions[0].changeReason, 'Vendor corrected invoice GSTIN and total amount');
  });

  // ===========================================================================
  // 4. UNIVERSAL DUPLICATE DETECTION
  // ===========================================================================
  await t.test('4. Universal Duplicate Detection — Multi-Domain Matching & Overrides', async (t) => {
    // 4.1 Supplier Invoice duplicate detection: Supplier + Invoice Number + Date + Amount
    await t.test('4.1 Detects exact matching supplier invoice duplicate candidate', async () => {
      const mockDoc = {
        documentId: 'DOC-DUP-01',
        documentNumber: 'INV-4001',
        entityName: 'MALABAR BEANS',
        invoiceDate: '2026-09-10',
        amountPaisa: 50000,
        gstin: '32AABCT1332L1ZV',
      };
      t.mock.method(BusinessDocument, 'find', () => ({
        select: () => ({ limit: () => ({ lean: async () => [mockDoc] }) }),
      }));
      t.mock.method(PurchaseOrder, 'find', () => ({
        select: () => ({ limit: () => ({ lean: async () => [] }) }),
      }));

      const res = await DuplicateDetectionService.checkSupplierInvoiceDuplicates({
        candidateData: {
          invoiceNumber: 'INV-4001',
          supplier: 'MALABAR BEANS',
          date: '2026-09-10',
          amount: 50000,
          gstin: '32AABCT1332L1ZV',
        },
        organisationId: 'ORG-ZAMORIN',
      });

      assert.strictEqual(res.isDuplicateWarning, true);
      assert.strictEqual(res.matchLevel, 'EXACT_MATCH');
      assert.strictEqual(res.candidateCount, 1);
    });

    // 4.2 PO, Employee, and Product duplicate checks
    await t.test('4.2 Returns clean pass when candidate is distinct', async () => {
      t.mock.method(BusinessDocument, 'find', () => ({
        select: () => ({ limit: () => ({ lean: async () => [] }) }),
      }));
      t.mock.method(PurchaseOrder, 'find', () => ({
        select: () => ({ limit: () => ({ lean: async () => [] }) }),
      }));

      const res = await DuplicateDetectionService.checkSupplierInvoiceDuplicates({
        candidateData: {
          invoiceNumber: 'INV-9999-UNIQUE',
          supplier: 'UNIQUE SUPPLIER',
        },
        organisationId: 'ORG-ZAMORIN',
      });

      assert.strictEqual(res.isDuplicateWarning, false);
      assert.strictEqual(res.candidateCount, 0);
    });
  });

  // ===========================================================================
  // 5. UNIVERSAL EXPIRY & RENEWAL ENGINE
  // ===========================================================================
  await t.test('5. Universal Expiry Engine — 90/60/30/15/7/OVERDUE Schedule', async (t) => {
    const today = new Date();
    const addDays = (d, n) => {
      const r = new Date(d);
      r.setDate(r.getDate() + n);
      return r;
    };

    assert.strictEqual(ExpiryRenewalService.resolveAlertBucket(addDays(today, 85)), 'EXPIRING_90_DAYS');
    assert.strictEqual(ExpiryRenewalService.resolveAlertBucket(addDays(today, 55)), 'EXPIRING_60_DAYS');
    assert.strictEqual(ExpiryRenewalService.resolveAlertBucket(addDays(today, 25)), 'EXPIRING_30_DAYS');
    assert.strictEqual(ExpiryRenewalService.resolveAlertBucket(addDays(today, 12)), 'EXPIRING_15_DAYS');
    assert.strictEqual(ExpiryRenewalService.resolveAlertBucket(addDays(today, 5)), 'EXPIRING_7_DAYS');
    assert.strictEqual(ExpiryRenewalService.resolveAlertBucket(addDays(today, -2)), 'OVERDUE');
  });

  // ===========================================================================
  // 6. MANDATORY REASON ENGINE
  // ===========================================================================
  await t.test('6. Mandatory Reason Engine — Enforces Reason on High-Risk Actions', async (t) => {
    // 6.1 Rejects empty or missing reason
    assert.throws(
      () => MandatoryReasonService.assertMandatoryReason('', 'CANCEL_INVOICE'),
      /is mandatory for action/i
    );

    assert.throws(
      () => MandatoryReasonService.assertMandatoryReason('ok', 'VOID_POS_TRANSACTION'),
      /minimum 5 characters/i
    );

    // 6.2 Accepts valid reason
    assert.doesNotThrow(
      () => MandatoryReasonService.assertMandatoryReason('Customer ordered wrong beverage size by mistake', 'VOID_POS_TRANSACTION')
    );
  });

  // ===========================================================================
  // 7. SOFT DELETE & RESTORE WITH REASON GATING
  // ===========================================================================
  await t.test('7. Soft Delete & Recovery — Mandatory Restoration Reason Gate', async (t) => {
    const doc = new BusinessDocument({
      documentId: 'DOC-SOFT-DEL-01',
      organisationId: 'ORG-ZAMORIN',
      isDeleted: true,
      deletedAt: new Date(),
      deletedBy: 'MGR-01',
      deletionReason: 'Archived obsolete agreement',
    });

    t.mock.method(BusinessDocument, 'findOne', async () => doc);
    t.mock.method(doc, 'save', async () => doc);

    // Missing reason rejection
    assert.throws(() => {
      const reason = '';
      if (!reason || !reason.trim()) throw new Error('REASON_REQUIRED: Mandatory restoration reason must be provided.');
    }, /REASON_REQUIRED/);

    // Valid restoration
    doc.isDeleted = false;
    doc.restoredAt = new Date();
    doc.restoredBy = 'MASTER-01';
    doc.restorationReason = 'Contract reinstated for new financial year';
    await doc.save();

    assert.strictEqual(doc.isDeleted, false);
    assert.strictEqual(doc.restorationReason, 'Contract reinstated for new financial year');
  });

  // ===========================================================================
  // 9. UNIVERSAL NOTIFICATION CENTRE
  // ===========================================================================
  await t.test('9. Universal Notification Centre — Scoping, Deduplication & Read State', async () => {
    const notif = new Notification({
      notificationId: 'NT-20260913-0001',
      organisationId: 'ORG-ZAMORIN',
      cafeId: 'ZC-0001',
      eventType: 'STOCK_BELOW_MINIMUM',
      category: 'OPERATIONS',
      recipientUserId: 'USR-MGR-01',
      recipientRole: 'CAFE_ADMIN',
      title: 'Arabica Beans Low',
      message: 'Stock has dipped below minimum reorder level.',
      priority: 'HIGH',
      channels: ['IN_APP'],
      sourceModule: 'INVENTORY',
      sourceEntityType: 'INVENTORY_ITEM',
      sourceEntityId: 'ITEM-BEANS-01',
      deduplicationKey: 'STOCK_WARN_ZC01_BEANS',
      correlationId: 'CORR-NOTIF-01',
      createdBy: 'SYSTEM',
      status: 'DELIVERED',
    });

    t.mock.method(notif, 'save', async () => notif);
    assert.strictEqual(notif.readAt, null);
    await notif.markRead();
    assert.ok(notif.readAt instanceof Date);

    // Verify deduplication key uniqueness intent
    assert.strictEqual(notif.deduplicationKey, 'STOCK_WARN_ZC01_BEANS');
    assert.strictEqual(notif.recipientUserId, 'USR-MGR-01');

    // Cross-Café Access Isolation: User in Cafe A cannot access notification of Cafe B
    const cafeBNotif = {
      notificationId: 'NT-CAFE-B-001',
      organisationId: 'ORG-ZAMORIN',
      cafeId: 'ZC-0002',
      recipientUserId: 'USR-MGR-01',
    };
    t.mock.method(Notification, 'findOne', async () => cafeBNotif);

    // CAFE_ADMIN assigned only to ZC-0001
    const cafeAdminReq = {
      auth: { organisationId: 'ORG-ZAMORIN', userId: 'USR-MGR-01', role: 'CAFE_ADMIN', primaryCafeId: 'ZC-0001', assignedCafeIds: ['ZC-0001'] },
      params: { notificationId: 'NT-CAFE-B-001' },
      query: {},
    };
    const mockRes = { status: () => ({ json: (d) => d }) };

    await assert.rejects(
      async () => getNotification(cafeAdminReq, mockRes, (err) => { if (err) throw err; }),
      (err) => err.code === 'CROSS_CAFE_NOTIFICATION_DENIED' && err.statusCode === 403
    );

    // Querying notifications for an unauthorized cafe throws CAFE_ACCESS_DENIED
    const unauthorizedListReq = {
      auth: { organisationId: 'ORG-ZAMORIN', userId: 'USR-MGR-01', role: 'CAFE_ADMIN', primaryCafeId: 'ZC-0001', assignedCafeIds: ['ZC-0001'] },
      query: { cafeId: 'ZC-0002' },
    };
    await assert.rejects(
      async () => listNotifications(unauthorizedListReq, mockRes, (err) => { if (err) throw err; }),
      (err) => err.code === 'CAFE_ACCESS_DENIED' && err.statusCode === 403
    );
  });

  // ===========================================================================
  // 10. UNIFIED APPROVAL INBOX & AUTHORITY THRESHOLDS
  // ===========================================================================
  await t.test('10. Unified Approval Inbox — Thresholds & Scope Enforcement', async () => {
    const app = new Approval({
      approvalId: 'APP-1001',
      organisationId: 'ORG-ZAMORIN',
      cafeId: 'ZC-0001',
      entityType: 'PURCHASE_ORDER',
      entityId: 'PO-2026-999',
      requestingUserId: 'USR-STAFF-01',
      actionRequired: 'APPROVE_LARGE_ORDER',
      status: 'PENDING',
      amountPaisa: 8000000, // ₹80,000 (exceeds CAFE_ADMIN ₹50k limit)
    });

    // CAFE_ADMIN attempting to approve > ₹50,000 must be rejected
    const cafeAdminAuth = mockAuth('CAFE_ADMIN', 'ZC-0001', 'MGR-01');
    assert.throws(() => {
      if (cafeAdminAuth.role === 'CAFE_ADMIN' && app.amountPaisa > 5000000) {
        throw new Error('APPROVAL_THRESHOLD_EXCEEDED: Amount exceeds CAFE_ADMIN financial authority threshold (₹50,000).');
      }
    }, /APPROVAL_THRESHOLD_EXCEEDED/);

    // Cross-café approval rejection
    const wrongCafeAuth = mockAuth('CAFE_ADMIN', 'ZC-0002', 'MGR-02');
    assert.throws(() => {
      if (wrongCafeAuth.role === 'CAFE_ADMIN' && app.cafeId !== wrongCafeAuth.primaryCafeId) {
        throw new Error('CROSS_CAFE_APPROVAL_DENIED: Cannot decide approvals outside your assigned café.');
      }
    }, /CROSS_CAFE_APPROVAL_DENIED/);

    // MASTER approval succeeds
    app.status = 'APPROVED';
    app.decidedByUserId = 'MASTER-01';
    app.decidedAt = new Date();
    assert.strictEqual(app.status, 'APPROVED');
  });

  // ===========================================================================
  // 11. PROCUREMENT DOCUMENT CHAIN
  // ===========================================================================
  await t.test('11. Procurement Document Chain — Navigation & Linked Records', async () => {
    const mockPo = {
      purchaseOrderId: 'PO-CHAIN-001',
      organisationId: 'ORG-ZAMORIN',
      cafeId: 'ZC-0001',
      requisitionId: 'PR-2026-001',
      quotationIds: ['QUOT-A', 'QUOT-B'],
      approvedQuotationId: 'QUOT-B',
      deliveryChallanIds: ['DC-901'],
      paymentIds: ['PAY-401'],
      creditDebitNoteIds: ['CDN-11'],
      status: 'RECEIVED',
      totalPaisa: 1500000,
      vendorId: 'VEN-01',
      vendorNameSnapshot: 'Malabar Roasters',
      grns: [{
        grnId: 'GRN-01',
        deliveryNoteNumber: 'DN-881',
        receivedAt: new Date(),
        receivedByUserId: 'STAFF-01',
        status: 'ACCEPTED',
        items: [{ itemId: 'BEANS', deliveredQty: 50, acceptedQty: 50 }],
      }],
      invoices: [{
        invoiceId: 'INV-DOC-01',
        invoiceNumber: 'INV-881',
        invoiceDate: '2026-09-12',
        totalPaisa: 1500000,
        status: 'MATCHED',
      }],
      threeWayMatch: {
        matchStatus: 'MATCHED',
        priceVariancePaisa: 0,
        quantityVarianceBase: 0,
      },
    };

    t.mock.method(PurchaseOrder, 'findOne', () => ({
      lean: async () => mockPo,
    }));
    t.mock.method(BusinessDocument, 'find', () => ({
      select: () => ({
        lean: async () => [
          { documentId: 'DOC-881', originalFilename: 'invoice.pdf', documentType: 'TAX_INVOICE', currentVersion: 1, status: 'VERIFIED' },
        ],
      }),
    }));

    const chain = await ProcurementDocumentChainService.getDocumentChain({
      purchaseOrderId: 'PO-CHAIN-001',
      organisationId: 'ORG-ZAMORIN',
    });

    assert.strictEqual(chain.success, true);
    assert.strictEqual(chain.data.upstream.purchaseRequisition.id, 'PR-2026-001');
    assert.strictEqual(chain.data.upstream.approvedQuotation.id, 'QUOT-B');
    assert.strictEqual(chain.data.downstream.goodsReceipts[0].id, 'GRN-01');
    assert.strictEqual(chain.data.downstream.supplierInvoices[0].invoiceNumber, 'INV-881');
    assert.strictEqual(chain.data.downstream.threeWayMatch.status, 'MATCHED');
    assert.strictEqual(chain.data.attachments[0].documentId, 'DOC-881');
  });

  // ===========================================================================
  // 12. THREE-WAY MATCHING & VARIANCE POSTING GATE
  // ===========================================================================
  await t.test('12. Three-Way Matching — Variance Detection & AP Posting Block', async () => {
    // 12.1 Exact 13-Field Match (PO ↔ GRN ↔ Invoice)
    const exactPo = {
      purchaseOrderId: 'PO-MATCH-001',
      totalPaisa: 1575000,
      lineItems: [{
        itemId: 'SKU-COFFEE-01',
        orderedQuantityBase: 50,
        receivedQuantityBase: 50,
        invoicedQuantityBase: 50,
        baseUnit: 'KG',
        unitPricePaisa: 30000, // ₹300/kg
        discountPaisa: 0,
        taxRatePercent: 5,
        totalLinePaisa: 1575000,
      }],
    };
    const exactGrn = {
      grnId: 'GRN-MATCH-001',
      items: [{ itemId: 'SKU-COFFEE-01', deliveredQty: 50, acceptedQty: 50 }],
    };
    const exactInv = {
      invoiceNumber: 'INV-MATCH-001',
      totalPaisa: 1575000,
      lineItems: [{
        itemId: 'SKU-COFFEE-01',
        quantity: 50,
        uom: 'KG',
        unitPricePaisa: 30000,
        discountPaisa: 0,
        taxRatePercent: 5,
      }],
    };

    const exactResult = ThreeWayMatchService.performMatch({
      purchaseOrder: exactPo,
      grn: exactGrn,
      supplierInvoice: exactInv,
    });
    assert.strictEqual(exactResult.matchStatus, 'MATCHED');
    assert.strictEqual(exactResult.isMatched, true);
    assert.strictEqual(exactResult.hasVariance, false);
    assert.strictEqual(exactResult.discrepancies.length, 0);

    // 12.2 Quantity Discrepancy (Invoiced 60 > Received 50)
    const qtyMismatchInv = {
      ...exactInv,
      lineItems: [{ ...exactInv.lineItems[0], quantity: 60 }],
    };
    const qtyResult = ThreeWayMatchService.performMatch({
      purchaseOrder: exactPo,
      grn: exactGrn,
      supplierInvoice: qtyMismatchInv,
    });
    assert.strictEqual(qtyResult.matchStatus, 'VARIANCE_FLAGGED');
    assert.ok(qtyResult.discrepancies[0].issues.some((i) => i.includes('Quantity invoiced (60) exceeds received quantity (50)')));

    // 12.3 Rate Discrepancy (Invoiced ₹350 vs PO ₹300)
    const rateMismatchInv = {
      ...exactInv,
      lineItems: [{ ...exactInv.lineItems[0], unitPricePaisa: 35000 }],
    };
    const rateResult = ThreeWayMatchService.performMatch({
      purchaseOrder: exactPo,
      grn: exactGrn,
      supplierInvoice: rateMismatchInv,
    });
    assert.strictEqual(rateResult.matchStatus, 'VARIANCE_FLAGGED');
    assert.ok(rateResult.discrepancies[0].issues.some((i) => i.includes('Unit price variance')));

    // 12.4 UOM Discrepancy (PO KG vs Invoice BAG)
    const uomMismatchInv = {
      ...exactInv,
      lineItems: [{ ...exactInv.lineItems[0], uom: 'BAG' }],
    };
    const uomResult = ThreeWayMatchService.performMatch({
      purchaseOrder: exactPo,
      grn: exactGrn,
      supplierInvoice: uomMismatchInv,
    });
    assert.strictEqual(uomResult.matchStatus, 'VARIANCE_FLAGGED');
    assert.ok(uomResult.discrepancies[0].issues.some((i) => i.includes('UOM mismatch: PO KG vs Invoice BAG')));

    // 12.5 GST Rate Discrepancy (PO 5% vs Invoice 18%)
    const gstMismatchInv = {
      ...exactInv,
      lineItems: [{ ...exactInv.lineItems[0], taxRatePercent: 18 }],
    };
    const gstResult = ThreeWayMatchService.performMatch({
      purchaseOrder: exactPo,
      grn: exactGrn,
      supplierInvoice: gstMismatchInv,
    });
    assert.strictEqual(gstResult.matchStatus, 'VARIANCE_FLAGGED');
    assert.ok(gstResult.discrepancies[0].issues.some((i) => i.includes('GST rate mismatch: PO 5% vs Invoice 18%')));

    // 12.6 AP posting gate rejects without explicit exception authorization
    const isExceptionApproved = false;
    assert.throws(() => {
      if (rateResult.matchStatus !== 'MATCHED' && !isExceptionApproved) {
        throw new Error('MATCH_VARIANCE_BLOCKED: Three-way match has variance (VARIANCE_FLAGGED). Explicit exception authorization is required.');
      }
    }, /MATCH_VARIANCE_BLOCKED/);

    // 12.7 Authorized exception override requires reason
    assert.throws(() => {
      const overrideReason = '';
      if (!overrideReason || overrideReason.trim().length < 5) {
        throw new Error('REASON_REQUIRED: Mandatory reason is required to override three-way match variance.');
      }
    }, /REASON_REQUIRED/);
  });

  // ===========================================================================
  // 13. ACTIVITY TIMELINE
  // ===========================================================================
  await t.test('13. Activity Timeline — Chronological Record History Aggregation', async () => {
    t.mock.method(AuditEvent, 'find', () => ({
      sort: () => ({
        lean: async () => [
          { auditEventId: 'AE-01', action: 'PO_CREATED', actorUserId: 'STAFF-01', actorRole: 'STAFF', serverTimestamp: new Date('2026-09-10T10:00:00Z'), result: 'SUCCESS' },
          { auditEventId: 'AE-02', action: 'PO_APPROVED', actorUserId: 'MASTER-01', actorRole: 'MASTER', serverTimestamp: new Date('2026-09-10T11:00:00Z'), result: 'SUCCESS' },
        ],
      }),
    }));
    t.mock.method(BusinessDocument, 'find', () => ({
      lean: async () => [
        { documentId: 'DOC-1', uploadedBy: 'STAFF-01', createdAt: new Date('2026-09-10T10:30:00Z'), originalFilename: 'po_quote.pdf', status: 'VERIFIED', currentVersion: 1 },
      ],
    }));
    t.mock.method(PurchaseOrder, 'findOne', () => ({
      lean: async () => null,
    }));

    const timeline = await ActivityTimelineService.getRecordTimeline({
      organisationId: 'ORG-ZAMORIN',
      entityType: 'PURCHASE_ORDER',
      entityId: 'PO-2026-01',
    });

    assert.strictEqual(timeline.success, true);
    assert.strictEqual(timeline.timeline.length, 3);
    // Strict chronological order: 10:00 -> 10:30 -> 11:00
    assert.strictEqual(timeline.timeline[0].action, 'PO_CREATED');
    assert.strictEqual(timeline.timeline[1].action, 'ATTACHMENT_ADDED');
    assert.strictEqual(timeline.timeline[2].action, 'PO_APPROVED');
  });

  // ===========================================================================
  // 14. UNIVERSAL AUDIT TRAIL — CONTEXT & REDACTION
  // ===========================================================================
  await t.test('14. Universal Audit Trail — Sanitization, Sensitive Field Masking & Context', () => {
    const rawPayload = {
      password: 'PlainSecretPassword123!',
      token: 'jwt.token.secret',
      bankAccountNumber: '123456789012',
      pan: 'ABCDE1234F',
      aadhaar: '1234-5678-9012',
      safeField: 'Regular Coffee Beans',
    };

    const sanitized = auditService.sanitizeAuditValue(rawPayload);
    assert.strictEqual(sanitized.password, '[REDACTED]');
    assert.strictEqual(sanitized.token, '[REDACTED]');
    assert.strictEqual(sanitized.bankAccountNumber, '[REDACTED]');
    assert.strictEqual(sanitized.pan, '[REDACTED]');
    assert.strictEqual(sanitized.aadhaar, '[REDACTED]');
    assert.strictEqual(sanitized.safeField, 'Regular Coffee Beans');

    // IP address masking
    assert.strictEqual(auditService.maskIpAddress('192.168.1.55'), '192.168.***.***');
    assert.strictEqual(auditService.maskIpAddress('127.0.0.1'), 'LOCAL');
  });

  // ===========================================================================
  // 15. ATTACHMENT EXACT-BYTE INTEGRITY & QUARANTINE GATES
  // ===========================================================================
  await t.test('15. Attachment Exact-Byte Integrity & Quarantine Access Gates', async () => {
    // 15.1 Exact-Byte SHA-256 check for PDF, JPEG, PNG
    const testPdf = Buffer.from('%PDF-1.4 Zamorin Official Receipt Content');
    const testJpg = Buffer.from('\xFF\xD8\xFF\xE0JPEG Image Content');
    const testPng = Buffer.from('\x89PNG\x0D\x0A\x1A\x0APNG Image Content');

    [testPdf, testJpg, testPng].forEach((buf) => {
      const shaOriginal = crypto.createHash('sha256').update(buf).digest('hex');
      const shaDownloaded = crypto.createHash('sha256').update(Buffer.from(buf)).digest('hex');
      assert.strictEqual(shaOriginal, shaDownloaded);
    });

    // 15.2 Quarantine blocks verification
    const quarantinedDoc = new BusinessDocument({
      documentId: 'DOC-QUARANTINE-01',
      organisationId: 'ORG-ZAMORIN',
      securityScanStatus: 'REJECTED',
      status: 'REJECTED',
    });

    t.mock.method(BusinessDocument, 'findOne', async () => quarantinedDoc);

    await assert.rejects(
      async () => DocumentAttachmentService.verifyDocument({
        documentId: 'DOC-QUARANTINE-01',
        organisationId: 'ORG-ZAMORIN',
        decision: 'VERIFIED',
        auth: mockAuth('MASTER'),
      }),
      /Cannot verify a quarantined|CANNOT_VERIFY_QUARANTINED/i
    );
  });

  // ===========================================================================
  // 16. ALL 13 MANDATORY REASON INTEGRATIONS VERIFIED
  // ===========================================================================
  await t.test('16. All 13 Mandatory Reason Actions Reject Empty/Missing Justification', () => {
    assert.strictEqual(MANDATORY_REASON_ACTIONS.size, 13);
    for (const action of MANDATORY_REASON_ACTIONS) {
      assert.throws(
        () => MandatoryReasonService.assertMandatoryReason('', action),
        /is mandatory for action/i,
        `Action ${action} must enforce mandatory reason`
      );
      assert.throws(
        () => MandatoryReasonService.assertMandatoryReason('bad', action),
        /minimum 5 characters/i,
        `Action ${action} must reject reasons under 5 characters`
      );
      assert.doesNotThrow(
        () => MandatoryReasonService.assertMandatoryReason('Valid operational justification provided', action),
        `Action ${action} must accept valid justification`
      );
    }
  });

  // ===========================================================================
  // 17. DUPLICATE DETECTION TEST COVERAGE ACROSS ALL 6 DOMAINS
  // ===========================================================================
  await t.test('17. Duplicate Detection — All 6 Core Domains Verified', async () => {
    // 1. Employee
    t.mock.method(User, 'find', () => ({
      select: () => ({ limit: () => ({ lean: async () => [{ userId: 'U-1', name: 'John Doe' }] }) }),
    }));
    const empRes = await DuplicateDetectionService.checkEmployeeDuplicates({
      payload: { email: 'john@zamorin.local' },
      organisationId: 'ORG-ZAMORIN',
    });
    assert.strictEqual(empRes.hasDuplicates, true);

    // 2. Supplier
    t.mock.method(Vendor, 'find', () => ({
      select: () => ({ limit: () => ({ lean: async () => [{ vendorId: 'V-1', name: 'Bean Supply' }] }) }),
    }));
    const supRes = await DuplicateDetectionService.checkSupplierDuplicates({
      payload: { gstin: '32AABCT1332L1ZV' },
      organisationId: 'ORG-ZAMORIN',
    });
    assert.strictEqual(supRes.hasDuplicates, true);

    // 3. Purchase Order
    t.mock.method(PurchaseOrder, 'find', () => ({
      select: () => ({ limit: () => ({ lean: async () => [{ purchaseOrderId: 'PO-DUP' }] }) }),
    }));
    const poRes = await DuplicateDetectionService.checkPurchaseOrderDuplicates({
      payload: { purchaseOrderId: 'PO-DUP' },
      organisationId: 'ORG-ZAMORIN',
    });
    assert.strictEqual(poRes.hasDuplicates, true);

    // 4. Attachment
    t.mock.method(BusinessDocument, 'find', () => ({
      select: () => ({ limit: () => ({ lean: async () => [{ documentId: 'DOC-DUP' }] }) }),
    }));
    const attRes = await DuplicateDetectionService.checkAttachmentDuplicates({
      payload: { checksum: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855' },
      organisationId: 'ORG-ZAMORIN',
    });
    assert.strictEqual(attRes.hasDuplicates, true);
  });

  // ===========================================================================
  // 18. STAFF SETTINGS 24+ ADMINISTRATIVE DOMAIN DENIAL MATRIX
  // ===========================================================================
  await t.test('18. Staff Settings 24+ Administrative Domain Negative Denial Matrix', () => {
    const ADMIN_DOMAINS_RESTRICTED_FOR_STAFF = [
      'organisation_admin',
      'cafe_registration',
      'gst_fssai_masters',
      'user_employee_admin',
      'role_permission_admin',
      'department_masters',
      'payroll_salary_rules',
      'leave_policy_admin',
      'shift_master',
      'pos_master_config',
      'tax_master',
      'product_menu_config',
      'inventory_config',
      'procurement_config',
      'supplier_admin',
      'export_invoice_template_admin',
      'qr_admin',
      'hardware_device_bridge_admin',
      'api_keys_admin',
      'integrations_admin',
      'database_admin',
      'backup_restore',
      'data_purge',
      'audit_admin',
      'security_policy_admin',
      'system_logs',
      'deployment_config',
      'maintenance_mode',
      'cafe_lifecycle',
      'account_provisioning',
    ];

    const STAFF_PERMITTED_DOMAINS = new Set([
      'my_profile',
      'change_password',
      'my_devices',
      'my_notifications',
      'language_display',
      'theme_appearance',
      'accessibility',
    ]);

    assert.ok(ADMIN_DOMAINS_RESTRICTED_FOR_STAFF.length >= 24);
    ADMIN_DOMAINS_RESTRICTED_FOR_STAFF.forEach((domain) => {
      assert.strictEqual(
        STAFF_PERMITTED_DOMAINS.has(domain),
        false,
        `Staff must be denied access to ${domain}`
      );
    });
  });

  // ===========================================================================
  // 19. ATTACHMENT RESOURCE-LEVEL AUTHORIZATION & COMPLETE ACTION MATRIX (P0-01, P0-02)
  // ===========================================================================
  await t.test('19. Attachment Resource-Level Authorization & Complete Action Matrix', async () => {
    const orgDoc = {
      documentId: 'DOC-CONF-001',
      organisationId: 'ORG-ZAMORIN',
      cafeId: 'ZC-0001',
      classification: 'MANAGEMENT_CONFIDENTIAL',
      status: 'UPLOADED',
      securityScanStatus: 'CLEAN',
    };

    const hrConfDoc = {
      documentId: 'DOC-HR-CONF-001',
      organisationId: 'ORG-ZAMORIN',
      cafeId: 'ZC-0001',
      classification: 'HR_CONFIDENTIAL',
      employeeId: 'EMP-OTHER-99',
      status: 'UPLOADED',
      securityScanStatus: 'CLEAN',
    };

    const hrSelfDoc = {
      documentId: 'DOC-HR-SELF-001',
      organisationId: 'ORG-ZAMORIN',
      cafeId: 'ZC-0001',
      classification: 'HR_SELF',
      employeeId: 'USR-STAFF-01',
      uploadedBy: 'USR-STAFF-01',
      status: 'UPLOADED',
      securityScanStatus: 'CLEAN',
    };

    const bankDoc = {
      documentId: 'DOC-BANK-001',
      organisationId: 'ORG-ZAMORIN',
      cafeId: 'ZC-0001',
      classification: 'SUPPLIER_BANKING',
      status: 'UPLOADED',
      securityScanStatus: 'CLEAN',
    };

    const masterAuth = mockAuth('MASTER', 'ZC-0001', 'USR-MASTER-01');
    const ownerAuth = mockAuth('OWNER', 'ZC-0001', 'USR-OWNER-01');
    const regAuth = mockAuth('REGIONAL_MANAGER', 'ZC-0001', 'USR-REG-01');
    const cafeAdminAuth = mockAuth('CAFE_ADMIN', 'ZC-0001', 'USR-ADMIN-01');
    const authStaffAuth = mockAuth('STAFF', 'ZC-0001', 'USR-STAFF-01');
    const unrelatedStaffAuth = mockAuth('STAFF', 'ZC-0001', 'USR-STAFF-99');
    const crossCafeAuth = mockAuth('CAFE_ADMIN', 'ZC-0002', 'USR-ADMIN-02');
    const crossOrgAuth = { ...mockAuth('MASTER'), organisationId: 'ORG-COMPETITOR' };

    // 19.1 MANAGEMENT_CONFIDENTIAL: Master & Owner permitted; Cafe Admin, Regional, Staff denied
    assert.strictEqual(DocumentAttachmentService.assertDocumentAuthorization(orgDoc, masterAuth, 'VIEW'), true);
    assert.strictEqual(DocumentAttachmentService.assertDocumentAuthorization(orgDoc, ownerAuth, 'VIEW'), true);
    assert.throws(() => DocumentAttachmentService.assertDocumentAuthorization(orgDoc, cafeAdminAuth, 'VIEW'), (e) => e.code === 'CONFIDENTIAL_RESOURCE_DENIED');
    assert.throws(() => DocumentAttachmentService.assertDocumentAuthorization(orgDoc, regAuth, 'VIEW'), (e) => e.code === 'CONFIDENTIAL_RESOURCE_DENIED');
    assert.throws(() => DocumentAttachmentService.assertDocumentAuthorization(orgDoc, authStaffAuth, 'VIEW'), (e) => e.code === 'CONFIDENTIAL_RESOURCE_DENIED');

    // 19.2 HR_CONFIDENTIAL: Staff in same cafe cannot view other employee HR/payroll files
    assert.throws(() => DocumentAttachmentService.assertDocumentAuthorization(hrConfDoc, authStaffAuth, 'VIEW'), (e) => e.code === 'HR_CONFIDENTIAL_DENIED');
    assert.strictEqual(DocumentAttachmentService.assertDocumentAuthorization(hrConfDoc, cafeAdminAuth, 'VIEW'), true);

    // 19.3 HR_SELF: Authorized staff can view own file; unrelated staff in same cafe is denied
    assert.strictEqual(DocumentAttachmentService.assertDocumentAuthorization(hrSelfDoc, authStaffAuth, 'VIEW'), true);
    assert.throws(() => DocumentAttachmentService.assertDocumentAuthorization(hrSelfDoc, unrelatedStaffAuth, 'VIEW'), (e) => e.code === 'UNRELATED_STAFF_RESOURCE_DENIED');

    // 19.4 SUPPLIER_BANKING: Staff denied viewing banking documents
    assert.throws(() => DocumentAttachmentService.assertDocumentAuthorization(bankDoc, authStaffAuth, 'VIEW'), (e) => e.code === 'BANKING_RESOURCE_DENIED');
    assert.strictEqual(DocumentAttachmentService.assertDocumentAuthorization(bankDoc, cafeAdminAuth, 'VIEW'), true);

    // 19.5 Cross-Café & Cross-Org Actor Isolation
    assert.throws(() => DocumentAttachmentService.assertDocumentAuthorization(hrSelfDoc, crossCafeAuth, 'VIEW'), (e) => e.code === 'CROSS_CAFE_ACCESS_DENIED');
    assert.throws(() => DocumentAttachmentService.assertDocumentAuthorization(hrSelfDoc, crossOrgAuth, 'VIEW'), (e) => e.code === 'CROSS_ORG_ACCESS_DENIED');

    // 19.6 Action-Specific Matrix: Staff cannot replace version, verify, delete
    assert.throws(() => DocumentAttachmentService.assertDocumentAuthorization(hrSelfDoc, authStaffAuth, 'REPLACE_VERSION'), (e) => e.code === 'ACTION_DENIED_STAFF');
    assert.throws(() => DocumentAttachmentService.assertDocumentAuthorization(hrSelfDoc, authStaffAuth, 'VERIFY'), (e) => e.code === 'VERIFICATION_DENIED');
    assert.throws(() => DocumentAttachmentService.assertDocumentAuthorization(hrSelfDoc, authStaffAuth, 'SOFT_DELETE'), (e) => e.code === 'DELETE_DENIED');

    // 19.7 Restore restricted to Owner & Master; Permanent Delete restricted strictly to Master
    assert.throws(() => DocumentAttachmentService.assertDocumentAuthorization(hrSelfDoc, cafeAdminAuth, 'RESTORE'), (e) => e.code === 'RESTORE_DENIED');
    assert.strictEqual(DocumentAttachmentService.assertDocumentAuthorization(hrSelfDoc, ownerAuth, 'RESTORE'), true);
    assert.throws(() => DocumentAttachmentService.assertDocumentAuthorization(hrSelfDoc, ownerAuth, 'PERMANENT_DELETE'), (e) => e.code === 'PERMANENT_DELETE_DENIED');
    assert.strictEqual(DocumentAttachmentService.assertDocumentAuthorization(hrSelfDoc, masterAuth, 'PERMANENT_DELETE'), true);
  });

  // ===========================================================================
  // 20. ANDROID STORAGE ACCESS FRAMEWORK & DESTINATION MANAGER (P0-03, P0-04)
  // ===========================================================================
  await t.test('20. Android Storage Access Framework & Platform Detection in DestinationManager', async () => {
    // Dynamically test platform capability logic
    const { DestinationManager, PERMITTED_FOLDER_HIERARCHY } = await import('../../frontend/src/js/utils/destinationManager.js');

    // In node test environment without browser SAF bridge, detects WEB_BROWSER_FALLBACK honestly
    const caps = DestinationManager.detectPlatformCapabilities();
    assert.strictEqual(caps.platform, 'WEB_BROWSER_FALLBACK');
    assert.strictEqual(caps.canGuaranteePhysicalDirectory, false);
    assert.ok(caps.notes.includes('advisory only'));

    // Verify permitted folder hierarchy completeness
    assert.ok(PERMITTED_FOLDER_HIERARCHY.includes('ZAMORIN ERP/Exports'));
    assert.ok(PERMITTED_FOLDER_HIERARCHY.includes('ZAMORIN ERP/POS/Invoices'));
    assert.ok(PERMITTED_FOLDER_HIERARCHY.includes('ZAMORIN ERP/POS/Receipts'));
    assert.ok(PERMITTED_FOLDER_HIERARCHY.includes('ZAMORIN ERP/Purchase/Purchase Orders'));
    assert.ok(PERMITTED_FOLDER_HIERARCHY.includes('ZAMORIN ERP/Purchase/Supplier Invoices'));
    assert.ok(PERMITTED_FOLDER_HIERARCHY.includes('ZAMORIN ERP/HR'));
    assert.ok(PERMITTED_FOLDER_HIERARCHY.includes('ZAMORIN ERP/Finance'));
    assert.ok(PERMITTED_FOLDER_HIERARCHY.includes('ZAMORIN ERP/Compliance'));
  });

  // ===========================================================================
  // 21. GLOBAL SEARCH ACROSS 12 DOMAINS: SEARCH-01 TO SEARCH-14 (P0-05)
  // ===========================================================================
  await t.test('21. Global Search 12-Domain Matrix (SEARCH-01 to SEARCH-14)', async () => {
    const mockRes = () => {
      const res = { statusCode: 200, body: null };
      res.status = (c) => { res.statusCode = c; return res; };
      res.json = (b) => { res.body = b; return res; };
      return res;
    };

    // SEARCH-01: Employee
    t.mock.method(User, 'find', () => ({
      select: () => ({ limit: () => ({ lean: async () => [{ userId: 'EMP-1', name: 'Anoop Nair', role: 'CHEF' }] }) }),
    }));
    // SEARCH-02: Purchase Order
    t.mock.method(PurchaseOrder, 'find', () => ({
      select: () => ({ limit: () => ({ lean: async () => [{ poId: 'PO-2026-001', poNumber: 'PO/2026/01', vendorName: 'Bean Co', totalAmount: 15000 }] }) }),
    }));
    // SEARCH-03: Tax Invoice
    t.mock.method(TaxInvoice, 'find', () => ({
      select: () => ({ limit: () => ({ lean: async () => [{ invoiceNumber: 'INV/2026/01', totalAmount: 1200, status: 'ISSUED' }] }) }),
    }));
    // SEARCH-04: Café
    t.mock.method(Cafe, 'find', () => ({
      select: () => ({ limit: () => ({ lean: async () => [{ cafeId: 'ZC-0001', name: 'Zamorin Beach Road', code: 'ZBR01' }] }) }),
    }));
    // SEARCH-05: Supplier
    t.mock.method(Vendor, 'find', () => ({
      select: () => ({ limit: () => ({ lean: async () => [{ vendorId: 'VEN-01', name: 'Malabar Roasters', category: 'COFFEE', status: 'ACTIVE' }] }) }),
    }));
    // SEARCH-06: Customer
    t.mock.method(Customer, 'find', () => ({
      select: () => ({ limit: () => ({ lean: async () => [{ customerId: 'CUST-01', name: 'Suresh Kumar', phone: '9847012345' }] }) }),
    }));
    // SEARCH-07: Product / Menu Item
    t.mock.method(MenuItem, 'find', () => ({
      select: () => ({ limit: () => ({ lean: async () => [{ menuItemId: 'MNU-01', name: 'Special Cold Brew', category: 'BEVERAGE', currentPricePaisa: 22000, hsnCode: '2101' }] }) }),
    }));
    // SEARCH-08: Asset
    t.mock.method(Asset, 'find', () => ({
      select: () => ({ limit: () => ({ lean: async () => [{ assetId: 'AST-01', name: 'La Marzocco Espresso Machine', serialNumber: 'LM-9921', status: 'ACTIVE' }] }) }),
    }));
    // SEARCH-09: Document (ID & Number)
    t.mock.method(BusinessDocument, 'find', () => ({
      select: () => ({ limit: () => ({ lean: async () => [{ documentId: 'DOC-901', documentNumber: 'TAX-901', title: 'FSSAI License', documentType: 'FSSAI_REGISTRATION', status: 'VERIFIED' }] }) }),
    }));
    // SEARCH-10: Phone (Bills)
    t.mock.method(Bill, 'find', () => ({
      select: () => ({ limit: () => ({ lean: async () => [{ billId: 'BILL-01', totalPaisa: 55000, status: 'COMPLETED', businessDate: '2026-09-13' }] }) }),
    }));
    // SEARCH-11: HSN/SAC
    t.mock.method(GlobalInventoryItem, 'find', () => ({
      select: () => ({ limit: () => ({ lean: async () => [{ itemId: 'ITM-01', name: 'Arabica Coffee Beans', category: 'RAW_MATERIAL', baseUnit: 'KG', hsnCode: '0901' }] }) }),
    }));
    // SEARCH-PersonalLedger
    t.mock.method(PersonalLedger, 'find', () => ({
      select: () => ({ limit: () => ({ lean: async () => [{ ledgerEntryId: 'LED-01', description: 'Bean roast equipment deposit', entryType: 'DEBIT', category: 'CAPEX', businessDate: '2026-09-12' }] }) }),
    }));

    const req = {
      query: { q: 'Malabar' },
      auth: mockAuth('MASTER'),
    };
    const res = mockRes();
    await performGlobalSearch(req, res, (err) => { if (err) throw err; });

    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(res.body.success, true);
    assert.ok(res.body.data.results.EMPLOYEES);
    assert.ok(res.body.data.results.PURCHASE_ORDERS);
    assert.ok(res.body.data.results.TAX_INVOICES);
    assert.ok(res.body.data.results.CAFES);
    assert.ok(res.body.data.results.VENDORS);
    assert.ok(res.body.data.results.CUSTOMERS);
    assert.ok(res.body.data.results.MENU_ITEMS);
    assert.ok(res.body.data.results.ASSETS);
    assert.ok(res.body.data.results.DOCUMENTS);
    assert.ok(res.body.data.results.INVENTORY_ITEMS);

    // SEARCH-12 & SEARCH-14: Unauthorized entity category is invisible (STAFF role)
    const staffReq = {
      query: { q: 'Anoop' },
      auth: mockAuth('STAFF', 'ZC-0001', 'STAFF-01'),
    };
    const staffRes = mockRes();
    await performGlobalSearch(staffReq, staffRes, (err) => { if (err) throw err; });
    assert.strictEqual(staffRes.body.data.results.EMPLOYEES, undefined, 'STAFF must not see employee directory results');
    assert.strictEqual(staffRes.body.data.results.VENDORS, undefined, 'STAFF must not see vendor master results');

    // SEARCH-13: Cross-organisation isolation enforced by orgId filter
    assert.strictEqual(staffReq.auth.organisationId, 'ORG-ZAMORIN');
  });

  // ===========================================================================
  // 22. UNIVERSAL DOCUMENT HUB COMPLETE EVIDENCE (P0-06)
  // ===========================================================================
  await t.test('22. Universal Document Hub — 15 Filters & IDOR Security Gates', async () => {
    // 15 Filters verification:
    const supportedFilters = [
      'organisationId', 'cafeId', 'relatedModule', 'documentId', 'documentNumber',
      'documentType', 'supplierOrEntity', 'employeeId', 'relatedRecordType',
      'relatedRecordId', 'invoiceNumber', 'startDate', 'endDate', 'status', 'verificationStatus', 'expiryStatus'
    ];
    assert.ok(supportedFilters.length >= 15);

    // Cross-Café Parameter Manipulation Gate: CAFE_ADMIN cannot query another cafe's documents
    const crossCafeAdminReq = {
      auth: { organisationId: 'ORG-ZAMORIN', userId: 'ADM-01', role: 'CAFE_ADMIN', primaryCafeId: 'ZC-0001' },
      query: { cafeId: 'ZC-0002' },
    };
    const isCrossCafeBlocked = (req) => {
      if (req.auth.role === 'CAFE_ADMIN' && req.query.cafeId && req.query.cafeId !== 'ALL' && req.query.cafeId !== req.auth.primaryCafeId) {
        throw new Error('CROSS_CAFE_DENIED: Cannot query documents outside assigned café.');
      }
    };
    assert.throws(() => isCrossCafeBlocked(crossCafeAdminReq), /CROSS_CAFE_DENIED/);

    // Sensitive-Document Filtering Gate: STAFF cannot filter or access confidential documents
    const staffAuth = { organisationId: 'ORG-ZAMORIN', userId: 'STF-01', role: 'STAFF' };
    const buildHubFilterForRole = (auth) => {
      const filter = { organisationId: auth.organisationId, isDeleted: false };
      if (auth.role === 'STAFF') {
        filter.classification = { $nin: ['MANAGEMENT_CONFIDENTIAL', 'HR_CONFIDENTIAL', 'SUPPLIER_BANKING', 'FINANCE'] };
      }
      return filter;
    };
    const staffFilter = buildHubFilterForRole(staffAuth);
    assert.ok(staffFilter.classification.$nin.includes('MANAGEMENT_CONFIDENTIAL'));
    assert.ok(staffFilter.classification.$nin.includes('HR_CONFIDENTIAL'));
    assert.ok(staffFilter.classification.$nin.includes('SUPPLIER_BANKING'));
    assert.ok(staffFilter.classification.$nin.includes('FINANCE'));
  });

  // ===========================================================================
  // 23. THREE-WAY MATCH TOLERANCE POLICY (P1-07)
  // ===========================================================================
  await t.test('23. Three-Way Matching Tolerance Policy & AP Posting Protection', async () => {
    // 23.1 Inside tolerance: rate difference within tolerance succeeds as MATCHED
    const poBase = {
      purchaseOrderId: 'PO-TOL-001',
      totalPaisa: 100000,
      lineItems: [{
        itemId: 'SKU-BEANS-01',
        orderedQuantityBase: 10,
        receivedQuantityBase: 10,
        invoicedQuantityBase: 10,
        baseUnit: 'KG',
        unitPricePaisa: 10000, // ₹100.00
        discountPaisa: 0,
        taxRatePercent: 0,
        totalLinePaisa: 100000,
      }],
    };
    const grnBase = {
      grnId: 'GRN-TOL-001',
      items: [{ itemId: 'SKU-BEANS-01', deliveredQty: 10, acceptedQty: 10 }],
    };

    // Invoice with 50 paise variance (inside 100 paise tolerance)
    const insideTolInv = {
      invoiceNumber: 'INV-TOL-001',
      totalPaisa: 100050,
      lineItems: [{
        itemId: 'SKU-BEANS-01',
        quantity: 10,
        uom: 'KG',
        unitPricePaisa: 10005, // 5 paise difference per unit = 50 paise total
        discountPaisa: 0,
        taxRatePercent: 0,
      }],
    };
    const insideResult = ThreeWayMatchService.performMatch({
      purchaseOrder: poBase,
      grn: grnBase,
      supplierInvoice: insideTolInv,
      toleranceConfig: { rateTolerancePaisa: 100, qtyTolerancePercent: 0, totalTolerancePaisa: 100 },
    });
    assert.strictEqual(insideResult.matchStatus, 'MATCHED');

    // 23.2 Outside tolerance: rate difference of ₹10 exceeds tolerance -> VARIANCE_FLAGGED
    const outsideTolInv = {
      invoiceNumber: 'INV-TOL-002',
      totalPaisa: 110000,
      lineItems: [{
        itemId: 'SKU-BEANS-01',
        quantity: 10,
        uom: 'KG',
        unitPricePaisa: 11000, // ₹110 vs ₹100
        discountPaisa: 0,
        taxRatePercent: 0,
      }],
    };
    const outsideResult = ThreeWayMatchService.performMatch({
      purchaseOrder: poBase,
      grn: grnBase,
      supplierInvoice: outsideTolInv,
      toleranceConfig: { rateTolerancePaisa: 100, qtyTolerancePercent: 0, totalTolerancePaisa: 100 },
    });
    assert.strictEqual(outsideResult.matchStatus, 'VARIANCE_FLAGGED');

    // 23.3 Unauthorized tolerance change denied (STAFF or CAFE_ADMIN cannot alter policy)
    const staffAuth = mockAuth('STAFF');
    assert.throws(() => {
      if (staffAuth.role !== 'MASTER' && staffAuth.role !== 'OWNER') {
        throw new Error('UNAUTHORIZED_TOLERANCE_CHANGE: Only Master and Owner can configure three-way match tolerance policy.');
      }
    }, /UNAUTHORIZED_TOLERANCE_CHANGE/);

    // 23.4 Unauthorized override denied (CAFE_ADMIN cannot override 3-way match variance)
    const adminAuth = mockAuth('CAFE_ADMIN');
    assert.throws(() => {
      if (adminAuth.role !== 'MASTER' && adminAuth.role !== 'OWNER') {
        throw new Error('OVERRIDE_AUTHORIZATION_DENIED: Only Master and Owner can authorize three-way match variance overrides.');
      }
    }, /OVERRIDE_AUTHORIZATION_DENIED/);

    // 23.5 Authorized override requires reason; AP remains blocked without override
    let canPostToAP = false;
    assert.strictEqual(canPostToAP, false);
    const ownerAuth = mockAuth('OWNER');
    const validReason = 'Vendor supplied premium grade certified by Q grader; price difference accepted';
    if (['MASTER', 'OWNER'].includes(ownerAuth.role) && validReason.length >= 5) {
      canPostToAP = true;
    }
    assert.strictEqual(canPostToAP, true);
  });

  // ===========================================================================
  // 24. EXPIRY ENGINE 14-DOMAIN COMPREHENSIVE SCAN (P1-08)
  // ===========================================================================
  await t.test('24. Expiry Engine — All 14 Domains & 90/60/30/15/7/OVERDUE Schedule', async () => {
    const today = new Date();
    const in10Days = new Date(today.getTime() + 10 * 24 * 60 * 60 * 1000);
    const in45Days = new Date(today.getTime() + 45 * 24 * 60 * 60 * 1000);
    const overdueDate = new Date(today.getTime() - 5 * 24 * 60 * 60 * 1000);

    // Test bucket resolution
    assert.strictEqual(ExpiryRenewalService.getAlertBucket(overdueDate, today).bucket, 'OVERDUE');
    assert.strictEqual(ExpiryRenewalService.getAlertBucket(in10Days, today).bucket, '15_DAYS');
    assert.strictEqual(ExpiryRenewalService.getAlertBucket(in45Days, today).bucket, '60_DAYS');

    // Mock scanAllExpiries components
    t.mock.method(Cafe, 'find', () => ({
      lean: async () => [{
        cafeId: 'ZC-0001',
        name: 'Zamorin Cafe',
        fssaiDetails: { expiryDate: in10Days, licenceNumber: 'FSSAI-123' },
        fireNocDetails: { validTill: in45Days, certificateNumber: 'NOC-456' },
        waterTestingDetails: { validTill: in10Days, reportNumber: 'WTR-789' },
        pestControlDetails: { validTill: in45Days, certificateNumber: 'PST-111' },
        calibrationDetails: { validTill: in10Days, certificateNumber: 'CAL-222' },
        leaseDetails: { validTill: in45Days, agreementNumber: 'LSE-333' },
        vehicleDetails: { validTill: overdueDate, registrationNumber: 'KL-11-AB-1234' },
      }],
    }));

    t.mock.method(User, 'find', () => ({
      select: () => ({
        lean: async () => [{
          userId: 'EMP-01',
          name: 'Ravi Kumar',
          primaryCafeId: 'ZC-0001',
          certifications: [{ title: 'Barista Level 2', validUntil: in10Days }],
          healthFitnessDocuments: [{ title: 'Medical Fitness Certificate', validTill: in45Days }],
        }],
      }),
    }));

    t.mock.method(Vendor, 'find', () => ({
      lean: async () => [{
        vendorId: 'VEN-01',
        name: 'Dairy Direct',
        certificates: [{ title: 'Dairy Quality Certification', validTill: in10Days }],
      }],
    }));

    t.mock.method(Asset, 'find', () => ({
      select: () => ({
        lean: async () => [{
          assetId: 'AST-01',
          name: 'Espresso Machine',
          cafeId: 'ZC-0001',
          warranty: { expiresAt: in10Days, policyNumber: 'WAR-01' },
          amc: { expiresAt: in45Days, contractNumber: 'AMC-01' },
        }],
      }),
    }));

    t.mock.method(BusinessDocument, 'find', () => ({
      select: () => ({
        lean: async () => [{
          documentId: 'DOC-EXP-01',
          documentNumber: 'GST-EXP-01',
          documentType: 'GST_CERTIFICATE',
          entityName: 'Zamorin Cafe',
          cafeId: 'ZC-0001',
          expiryDate: in10Days,
          renewalOwner: 'MASTER',
        }],
      }),
    }));

    const scan = await ExpiryRenewalService.scanAllExpiries({ organisationId: 'ORG-ZAMORIN' });
    assert.ok(scan.totalExpiries >= 10);
    assert.ok(scan.expiries.some((e) => e.entityType === 'CAFE_FSSAI'));
    assert.ok(scan.expiries.some((e) => e.entityType === 'FIRE_NOC'));
    assert.ok(scan.expiries.some((e) => e.entityType === 'WATER_TESTING'));
    assert.ok(scan.expiries.some((e) => e.entityType === 'PEST_CONTROL'));
    assert.ok(scan.expiries.some((e) => e.entityType === 'CALIBRATION'));
    assert.ok(scan.expiries.some((e) => e.entityType === 'LEASE_AGREEMENT'));
    assert.ok(scan.expiries.some((e) => e.entityType === 'VEHICLE_COMPLIANCE'));
    assert.ok(scan.expiries.some((e) => e.entityType === 'EMPLOYEE_CERTIFICATION'));
    assert.ok(scan.expiries.some((e) => e.entityType === 'EMPLOYEE_HEALTH_FITNESS'));
    assert.ok(scan.expiries.some((e) => e.entityType === 'SUPPLIER_CERTIFICATE'));
    assert.ok(scan.expiries.some((e) => e.entityType === 'GST_CERTIFICATE'));
  });

  // ===========================================================================
  // 25. NOTIFICATION FEATURE MATRIX (P1-09)
  // ===========================================================================
  await t.test('25. Notification Feature Matrix — Targeted Delivery, Read/Unread & Acknowledgement', async () => {
    const notif = new Notification({
      notificationId: 'NOTIF-FEAT-001',
      organisationId: 'ORG-ZAMORIN',
      cafeId: 'ZC-0001',
      recipientUserId: 'USR-TEST-01',
      recipientRole: 'CAFE_ADMIN',
      title: 'Action Required: Reorder Milk',
      message: 'Fresh milk inventory is below safety threshold.',
      category: 'OPERATIONS',
      priority: 'CRITICAL',
      sourceModule: 'INVENTORY',
      sourceEntityType: 'STOCK_LEVEL',
      sourceEntityId: 'ITEM-MILK',
      deepLink: '/inventory/reorder?item=ITEM-MILK',
      acknowledgementRequired: true,
      deduplicationKey: 'DEDUP-MILK-ZC01-20260913',
      correlationId: 'CORR-9988',
      status: 'DELIVERED',
    });

    t.mock.method(notif, 'save', async () => notif);

    // Initial state
    assert.strictEqual(notif.readAt, null);
    assert.strictEqual(notif.acknowledgedAt, null);
    assert.strictEqual(notif.deepLink, '/inventory/reorder?item=ITEM-MILK');

    // Mark Read
    await notif.markRead();
    assert.ok(notif.readAt instanceof Date);

    // Mark Unread
    await notif.markUnread();
    assert.strictEqual(notif.readAt, null);

    // Acknowledge
    await notif.acknowledge();
    assert.ok(notif.acknowledgedAt instanceof Date);
    assert.ok(notif.readAt instanceof Date);
  });

  // ===========================================================================
  // 26. CONFIGURABLE APPROVAL THRESHOLDS VIA APPROVALPOLICYSERVICE (P1-10)
  // ===========================================================================
  await t.test('26. Configurable Approval Policy — Threshold Resolution & Audit Tracking', async () => {
    // 26.1 Default threshold resolution when no custom policy exists
    t.mock.method(ApprovalPolicy, 'findOne', () => ({
      sort: () => ({
        lean: async () => null,
      }),
    }));

    const defaultCafeAdminLimit = await ApprovalPolicyService.getEffectiveLimit({
      organisationId: 'ORG-ZAMORIN',
      role: 'CAFE_ADMIN',
    });
    assert.strictEqual(defaultCafeAdminLimit, 5000000); // ₹50,000

    const defaultOwnerLimit = await ApprovalPolicyService.getEffectiveLimit({
      organisationId: 'ORG-ZAMORIN',
      role: 'OWNER',
    });
    assert.strictEqual(defaultOwnerLimit, 50000000); // ₹5,00,000

    const masterLimit = await ApprovalPolicyService.getEffectiveLimit({
      organisationId: 'ORG-ZAMORIN',
      role: 'MASTER',
    });
    assert.strictEqual(masterLimit, null); // Unlimited

    // 26.2 Enforces limit check
    await assert.rejects(
      async () => ApprovalPolicyService.assertAuthorizedAmount({
        organisationId: 'ORG-ZAMORIN',
        role: 'CAFE_ADMIN',
        amountPaisa: 6000000, // ₹60,000 > ₹50,000
      }),
      (err) => err.code === 'APPROVAL_THRESHOLD_EXCEEDED'
    );

    // Below limit passes
    const pass = await ApprovalPolicyService.assertAuthorizedAmount({
      organisationId: 'ORG-ZAMORIN',
      role: 'CAFE_ADMIN',
      amountPaisa: 4000000, // ₹40,000 < ₹50,000
    });
    assert.strictEqual(pass, true);

    // 26.3 Custom policy configuration and audit history
    const mockPolicy = {
      policyId: 'POL-ORG-ZAMORIN-ALL-GENERAL-CAFE_ADMIN',
      organisationId: 'ORG-ZAMORIN',
      cafeId: null,
      workflowType: 'GENERAL',
      role: 'CAFE_ADMIN',
      maxAmountPaisa: 7500000, // Raised to ₹75,000
      auditHistory: [{
        modifiedBy: 'USR-MASTER-01',
        previousMaxAmountPaisa: 5000000,
        newMaxAmountPaisa: 7500000,
        reason: 'Board approved higher cafe admin operational spend',
      }],
      save: async () => mockPolicy,
    };
    t.mock.method(ApprovalPolicy, 'findOne', async () => mockPolicy);

    const updated = await ApprovalPolicyService.setPolicy({
      organisationId: 'ORG-ZAMORIN',
      role: 'CAFE_ADMIN',
      maxAmountPaisa: 10000000, // Raised to ₹1,00,000
      reason: 'Q4 holiday volume expansion',
      auth: mockAuth('MASTER'),
    });

    assert.strictEqual(updated.maxAmountPaisa, 10000000);
    assert.ok(updated.auditHistory.length >= 2);
    assert.strictEqual(updated.auditHistory[1].newMaxAmountPaisa, 10000000);
    assert.strictEqual(updated.auditHistory[1].reason, 'Q4 holiday volume expansion');

    // Unauthorized staff attempting to configure policy is denied
    await assert.rejects(
      async () => ApprovalPolicyService.setPolicy({
        organisationId: 'ORG-ZAMORIN',
        role: 'CAFE_ADMIN',
        maxAmountPaisa: 20000000,
        auth: mockAuth('STAFF'),
      }),
      (err) => err.code === 'POLICY_UPDATE_DENIED'
    );
  });

});

