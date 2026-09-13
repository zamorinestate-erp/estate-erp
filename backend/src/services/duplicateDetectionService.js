'use strict';

const mongoose = require('mongoose');
const { User } = require('../models/User');
const { Vendor } = require('../models/Vendor');
const { PurchaseOrder } = require('../models/PurchaseOrder');
const { MenuItem } = require('../models/MenuItem');
const { GlobalInventoryItem } = require('../models/GlobalInventoryItem');
const { BusinessDocument } = require('../models/BusinessDocument');

class DuplicateDetectionService {
  /**
   * Universal duplicate check dispatcher.
   * Checks domain-specific rules and returns warning signals and candidate records.
   */
  static async checkDuplicates({ entityType, payload = {}, organisationId, cafeId = null }) {
    const orgId = String(organisationId || '').trim().toUpperCase();
    const cleanType = String(entityType || '').trim().toUpperCase();

    switch (cleanType) {
      case 'EMPLOYEE':
        return this.checkEmployeeDuplicates({ payload, organisationId: orgId });
      case 'SUPPLIER':
      case 'VENDOR':
        return this.checkSupplierDuplicates({ payload, organisationId: orgId });
      case 'SUPPLIER_INVOICE':
        return this.checkSupplierInvoiceDuplicates({ payload, organisationId: orgId, cafeId });
      case 'PURCHASE_ORDER':
      case 'PO':
        return this.checkPurchaseOrderDuplicates({ payload, organisationId: orgId, cafeId });
      case 'PRODUCT':
      case 'MENU_ITEM':
        return this.checkProductDuplicates({ payload, organisationId: orgId });
      case 'ATTACHMENT':
      case 'DOCUMENT':
        return this.checkAttachmentDuplicates({ payload, organisationId: orgId, cafeId });
      default:
        return { hasDuplicates: false, candidates: [], warnings: [] };
    }
  }

  /**
   * Employee duplicate detection:
   * Checks matching email, phone, or name similarity.
   */
  static async checkEmployeeDuplicates({ payload, organisationId }) {
    const { email, phone, name } = payload;
    const conditions = [];

    if (email && typeof email === 'string' && email.trim()) {
      conditions.push({ email: email.trim().toLowerCase() });
    }
    if (phone && typeof phone === 'string' && phone.trim()) {
      conditions.push({ phone: phone.trim() });
    }
    if (name && typeof name === 'string' && name.trim().length >= 3) {
      conditions.push({ name: new RegExp(`^${name.trim()}$`, 'i') });
    }

    if (conditions.length === 0) {
      return { hasDuplicates: false, candidates: [], warnings: [] };
    }

    const matches = await User.find({
      organisationId,
      accountStatus: { $ne: 'DELETED' },
      $or: conditions,
    })
      .select('userId name email phone role primaryCafeId')
      .limit(5)
      .lean();

    const warnings = [];
    if (matches.length > 0) {
      warnings.push(`Found ${matches.length} existing employee record(s) matching contact or name details.`);
    }

    return {
      hasDuplicates: matches.length > 0,
      candidates: matches.map((m) => ({
        id: m.userId,
        name: m.name,
        email: m.email,
        phone: m.phone,
        role: m.role,
        cafeId: m.primaryCafeId,
      })),
      warnings,
      requiresOverride: matches.length > 0,
    };
  }

  /**
   * Supplier / Vendor duplicate detection:
   * Checks matching GSTIN, PAN, Bank Account Number, or Name.
   */
  static async checkSupplierDuplicates({ payload, organisationId }) {
    const { gstin, pan, name, bankDetails } = payload;
    const conditions = [];

    if (gstin && typeof gstin === 'string' && gstin.trim()) {
      conditions.push({ gstin: gstin.trim().toUpperCase() });
    }
    if (pan && typeof pan === 'string' && pan.trim()) {
      conditions.push({ pan: pan.trim().toUpperCase() });
    }
    if (name && typeof name === 'string' && name.trim().length >= 3) {
      conditions.push({ name: new RegExp(`^${name.trim()}$`, 'i') });
    }
    if (bankDetails?.accountNumber) {
      conditions.push({ 'bankDetails.accountNumber': String(bankDetails.accountNumber).trim() });
    }

    if (conditions.length === 0) {
      return { hasDuplicates: false, candidates: [], warnings: [] };
    }

    const matches = await Vendor.find({
      organisationId,
      status: { $ne: 'DELETED' },
      $or: conditions,
    })
      .select('vendorId name gstin pan category status')
      .limit(5)
      .lean();

    const warnings = [];
    if (matches.length > 0) {
      warnings.push(`Found ${matches.length} existing supplier(s) with matching GSTIN, PAN, or Name.`);
    }

    return {
      hasDuplicates: matches.length > 0,
      candidates: matches.map((v) => ({
        id: v.vendorId,
        name: v.name,
        gstin: v.gstin,
        pan: v.pan,
        category: v.category,
      })),
      warnings,
      requiresOverride: matches.length > 0,
    };
  }

  /**
   * Supplier Invoice duplicate detection:
   * Exact matching on Supplier + Invoice Number + Date + Amount.
   * Also checks BusinessDocument checksum and TaxInvoice records where available.
   */
  static async checkSupplierInvoiceDuplicates({ payload, candidateData, organisationId, cafeId }) {
    const data = candidateData || payload || {};
    const { vendorId, supplier, supplierName, invoiceNumber, date, invoiceDate, amount, totalPaisa, amountPaisa, gstin } = data;
    const effectiveSupplier = supplierName || supplier || '';
    const effectiveDate = date || invoiceDate || '';
    const amt = amount !== undefined ? amount : (amountPaisa !== undefined ? amountPaisa : totalPaisa);
    const invNum = invoiceNumber ? String(invoiceNumber).trim() : '';

    if (!invNum) {
      return { isDuplicateWarning: false, hasDuplicates: false, candidates: [], warnings: [], candidateCount: 0 };
    }

    const filter = {
      organisationId,
      relatedModule: 'PROCUREMENT',
      documentNumber: new RegExp(`^${invNum}$`, 'i'),
      isDeleted: false,
    };

    if (cafeId && cafeId !== 'ALL') {
      filter.cafeId = cafeId;
    }

    const docMatches = await BusinessDocument.find(filter)
      .select('documentId documentNumber entityName invoiceDate amountPaisa gstin status currentVersion')
      .limit(5)
      .lean();

    // Also check inside PurchaseOrder invoices sub-ledger
    const poMatches = await PurchaseOrder.find({
      organisationId,
      'invoices.invoiceNumber': new RegExp(`^${invNum}$`, 'i'),
    })
      .select('purchaseOrderId vendorId status invoices')
      .limit(5)
      .lean();

    const candidates = [];
    const warnings = [];

    for (const d of docMatches) {
      const isExactMatch =
        (amt !== undefined && d.amountPaisa === amt) ||
        (vendorId && d.entityName?.toUpperCase() === String(vendorId).toUpperCase());

      candidates.push({
        type: 'BUSINESS_DOCUMENT',
        id: d.documentId,
        documentNumber: d.documentNumber,
        supplier: d.entityName,
        invoiceDate: d.invoiceDate,
        amountPaisa: d.amountPaisa,
        isExactMatch,
      });

      if (isExactMatch) {
        warnings.push(`Exact match warning: Invoice ${invNum} already recorded with matching amount (₹${(d.amountPaisa / 100).toFixed(2)}) for supplier ${d.entityName}.`);
      } else {
        warnings.push(`Potential duplicate: Invoice number ${invNum} is already on file for ${d.entityName}.`);
      }
    }

    for (const po of poMatches) {
      candidates.push({
        type: 'PURCHASE_ORDER_INVOICE',
        id: po.purchaseOrderId,
        supplier: po.vendorId,
        status: po.status,
      });
      warnings.push(`Invoice ${invNum} already attached to Purchase Order ${po.purchaseOrderId}.`);
    }

    const hasExact = candidates.some((c) => c.isExactMatch);

    return {
      hasDuplicates: candidates.length > 0,
      isDuplicateWarning: candidates.length > 0,
      candidateCount: candidates.length,
      matchLevel: hasExact ? 'EXACT_MATCH' : (candidates.length > 0 ? 'POTENTIAL_MATCH' : 'NONE'),
      candidates,
      warnings,
      requiresOverride: candidates.length > 0,
    };
  }

  /**
   * Purchase Order duplicate detection:
   * Checks matching PO Number or duplicate identical order for same vendor on same date.
   */
  static async checkPurchaseOrderDuplicates({ payload, organisationId, cafeId }) {
    const { purchaseOrderId, poNumber, vendorId, orderDate, totalPaisa } = payload;
    const targetPo = poNumber || purchaseOrderId;
    const conditions = [];

    if (targetPo) {
      conditions.push({ purchaseOrderId: String(targetPo).trim().toUpperCase() });
    }
    if (vendorId && orderDate && totalPaisa) {
      conditions.push({
        vendorId: String(vendorId).trim().toUpperCase(),
        orderDate: new Date(orderDate),
        totalPaisa: Number(totalPaisa),
      });
    }

    if (conditions.length === 0) {
      return { hasDuplicates: false, candidates: [], warnings: [] };
    }

    const matches = await PurchaseOrder.find({
      organisationId,
      $or: conditions,
    })
      .select('purchaseOrderId vendorId orderDate totalPaisa status cafeId')
      .limit(5)
      .lean();

    const warnings = [];
    if (matches.length > 0) {
      warnings.push(`Found ${matches.length} matching or similar Purchase Order(s).`);
    }

    return {
      hasDuplicates: matches.length > 0,
      candidates: matches.map((p) => ({
        id: p.purchaseOrderId,
        vendorId: p.vendorId,
        orderDate: p.orderDate,
        totalPaisa: p.totalPaisa,
        status: p.status,
      })),
      warnings,
      requiresOverride: matches.length > 0,
    };
  }

  /**
   * Product / Menu Item duplicate detection:
   * Checks matching product name or item code.
   */
  static async checkProductDuplicates({ payload, organisationId }) {
    const { name, menuItemId, itemCode, barcode } = payload;
    const conditions = [];

    if (name && typeof name === 'string' && name.trim()) {
      conditions.push({ name: new RegExp(`^${name.trim()}$`, 'i') });
    }
    if (menuItemId) {
      conditions.push({ menuItemId: String(menuItemId).trim().toUpperCase() });
    }

    if (conditions.length === 0) {
      return { hasDuplicates: false, candidates: [], warnings: [] };
    }

    const [menuMatches, invMatches] = await Promise.all([
      MenuItem.find({ organisationId, $or: conditions })
        .select('menuItemId name category currentPricePaisa')
        .limit(5)
        .lean(),
      GlobalInventoryItem.find({ organisationId, name: new RegExp(`^${name?.trim()}$`, 'i') })
        .select('itemId name category baseUnit')
        .limit(5)
        .lean(),
    ]);

    const candidates = [
      ...menuMatches.map((m) => ({ type: 'MENU_ITEM', id: m.menuItemId, name: m.name, category: m.category })),
      ...invMatches.map((i) => ({ type: 'INVENTORY_ITEM', id: i.itemId, name: i.name, category: i.category })),
    ];

    const warnings = [];
    if (candidates.length > 0) {
      warnings.push(`Item name or code already exists in catalog (${candidates.length} candidate(s)).`);
    }

    return {
      hasDuplicates: candidates.length > 0,
      candidates,
      warnings,
      requiresOverride: candidates.length > 0,
    };
  }

  /**
   * Attachment duplicate detection:
   * Checks matching SHA-256 checksum or identical filename under the same parent record.
   */
  static async checkAttachmentDuplicates({ payload, organisationId, cafeId }) {
    const { checksum, originalFilename, relatedRecordId } = payload;
    const conditions = [];

    if (checksum) {
      conditions.push({ checksum: String(checksum).trim() });
    }
    if (originalFilename && relatedRecordId) {
      conditions.push({
        relatedRecordId: String(relatedRecordId).trim().toUpperCase(),
        originalFilename: String(originalFilename).trim(),
      });
    }

    if (conditions.length === 0) {
      return { hasDuplicates: false, candidates: [], warnings: [] };
    }

    const matches = await BusinessDocument.find({
      organisationId,
      isDeleted: false,
      $or: conditions,
    })
      .select('documentId originalFilename documentType relatedRecordId checksum status currentVersion')
      .limit(5)
      .lean();

    const warnings = [];
    if (matches.length > 0) {
      warnings.push(`Identical file content (checksum match) or filename already attached (${matches.length} match(es)).`);
    }

    return {
      hasDuplicates: matches.length > 0,
      candidates: matches.map((d) => ({
        id: d.documentId,
        originalFilename: d.originalFilename,
        documentType: d.documentType,
        relatedRecordId: d.relatedRecordId,
        version: d.currentVersion,
      })),
      warnings,
      requiresOverride: matches.length > 0,
    };
  }
}

module.exports = {
  DuplicateDetectionService,
};
