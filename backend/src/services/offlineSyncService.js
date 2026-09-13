'use strict';

/**
 * ============================================================================
 * ZAMORIN CAFÉ ERP — OFFLINE SYNC RECONCILIATION SERVICE (R02-09)
 * ============================================================================
 * Ingests offline transactions generated during network outages or degraded
 * operating mode. Guarantees:
 * - Deterministic idempotency via client-generated offline UUIDs / IDs
 * - High-risk operation detection (large offline refunds, extreme discounts)
 * - Safe replay into Bill and KdsTicket pipelines
 * - Audit logging with IS_OFFLINE_REPLAY flag
 */

const { Bill } = require('../models/Bill');
const { SequenceCounter } = require('../models/SequenceCounter');
const { DeviceRegistration } = require('../models/DeviceRegistration');
const { OperatorSession } = require('../models/OperatorSession');
const KdsService = require('./kdsService');
const { OfflineRiskConfigService } = require('./offlineRiskConfigService');

const OFFLINE_POLICY_CLASSES = {
  ONLINE_REQUIRED: 'ONLINE_REQUIRED',
  LOCAL_DRAFT_ALLOWED: 'LOCAL_DRAFT_ALLOWED',
  SAFE_QUEUE_ALLOWED: 'SAFE_QUEUE_ALLOWED',
  PAYMENT_PROVIDER_DEPENDENT: 'PAYMENT_PROVIDER_DEPENDENT',
};

class OfflineSyncService {
  /**
   * Resolves the offline risk policy class for a given operational mutation.
   * Enforces that high-risk financial operations and electronic provider payments
   * strictly require active online connectivity.
   */
  static resolveOperationPolicy(operation = {}) {
    const opType = String(operation.operationType || operation.type || '').toUpperCase();
    const status = String(operation.status || '').toUpperCase();
    const paymentMethod = String(operation.paymentMethod || operation.paymentMode || '').toUpperCase();
    const orderType = String(operation.orderType || operation.serviceMode || '').toUpperCase();

    // 1. High-risk financial and administrative mutations strictly require online server confirmation
    const isHighRiskMutation =
      operation.isRefund === true ||
      ['REFUND', 'CASH_REVERSAL', 'REVERSAL', 'DEVICE_REVOCATION', 'PERMISSION_MUTATION', 'APPROVAL', 'STOCK_CORRECTION'].includes(opType) ||
      ['REFUNDED', 'PARTIALLY_REFUNDED', 'VOIDED', 'PAYMENT_REVERSED'].includes(status) ||
      orderType === 'REVERSAL';

    if (isHighRiskMutation) {
      return OFFLINE_POLICY_CLASSES.ONLINE_REQUIRED;
    }

    // 2. Electronic payments depend on third-party payment providers.
    // In Zamorin ERP's current implementation, electronic provider-dependent payment = ONLINE_REQUIRED.
    if (['CARD', 'UPI', 'PAYMENT_GATEWAY', 'NETBANKING', 'WALLET'].includes(paymentMethod)) {
      return OFFLINE_POLICY_CLASSES.PAYMENT_PROVIDER_DEPENDENT;
    }

    // 3. Local drafts (saved carts, offline inspection drafts)
    if (operation.isDraft === true || status === 'DRAFT' || opType === 'LOCAL_DRAFT') {
      return OFFLINE_POLICY_CLASSES.LOCAL_DRAFT_ALLOWED;
    }

    // 4. Safe offline POS sales (CASH or standard orders)
    if (paymentMethod === 'CASH' || ['QUICK_SALE', 'DINE_IN', 'TAKEAWAY'].includes(orderType)) {
      return OFFLINE_POLICY_CLASSES.SAFE_QUEUE_ALLOWED;
    }

    // Default: No fallback to queue-all. Unknown operations require online.
    return OFFLINE_POLICY_CLASSES.ONLINE_REQUIRED;
  }

  /**
   * Replays a batch of offline transactions collected on a POS or terminal device.
   * Performs DeviceRegistration check, OperatorSession validation, actor authorization,
   * idempotency deduplication, and risk policy enforcement before persistence.
   */
  static async syncBatch({
    organisationId,
    cafeId,
    deviceId = '',
    userId = '',
    operatorSessionId = '',
    transactions = [],
  }) {
    if (!organisationId || !cafeId) {
      throw new Error('OrganisationId and CafeId are required for offline sync replay.');
    }

    const cleanOrg = organisationId.trim().toUpperCase();
    const cleanCafe = cafeId.trim().toUpperCase();

    // 1. Device Registration Validation
    if (deviceId) {
      const device = await DeviceRegistration.findOne({
        organisationId: cleanOrg,
        deviceId: deviceId.trim(),
      }).lean();

      if (device) {
        if (['REVOKED', 'SUSPENDED', 'LOST', 'RETIRED'].includes(device.status)) {
          throw new Error(`Device ${deviceId} registration is ${device.status}. Offline replay denied.`);
        }
        if (device.assignedCafeId && device.assignedCafeId !== cleanCafe) {
          throw new Error(`Device ${deviceId} is assigned to café ${device.assignedCafeId}, cannot replay for café ${cleanCafe}.`);
        }
      }
    }

    // 2. Operator Session Validation
    if (operatorSessionId) {
      const session = await OperatorSession.findOne({
        organisationId: cleanOrg,
        operatorSessionId: operatorSessionId.trim(),
      }).lean();

      if (!session) {
        throw new Error(`Operator session ${operatorSessionId} not found.`);
      }
      if (session.status === 'EXPIRED' || session.status === 'ENDED' || session.endedAt) {
        throw new Error(`Operator session ${operatorSessionId} has expired or ended. Offline replay denied.`);
      }
      if (session.cafeId && session.cafeId !== cleanCafe) {
        throw new Error(`Operator session ${operatorSessionId} belongs to café ${session.cafeId}, not authorized for ${cleanCafe}.`);
      }
      if (userId && session.operatorUserId && session.operatorUserId !== userId) {
        throw new Error(`Operator mismatch: session belongs to ${session.operatorUserId}, replay attempted by ${userId}.`);
      }
    }

    const riskConfig = await OfflineRiskConfigService.getEffectiveRiskConfig({
      organisationId: cleanOrg,
      cafeId: cleanCafe,
    });
    const maxDiscountPercent = riskConfig.maxDiscountPercent;
    const highValueAmountPaise = riskConfig.highValueAmountPaise;

    const results = {
      totalReceived: transactions.length,
      syncedCount: 0,
      duplicateCount: 0,
      flaggedCount: 0,
      rejectedCount: 0,
      items: [],
    };

    for (const tx of transactions) {
      const clientOfflineId = tx.clientOfflineId || tx.offlineId || tx.id;
      if (!clientOfflineId) {
        results.rejectedCount++;
        results.items.push({
          clientOfflineId: null,
          status: 'REJECTED',
          reason: 'Missing clientOfflineId for idempotency tracking.',
        });
        continue;
      }

      // 3. Idempotency Verification: has this offline bill already been replayed?
      const duplicateConditions = [{ clientOfflineId }];
      if (tx.billId) {
        duplicateConditions.push({ billId: tx.billId });
      }
      const existing = await Bill.findOne({
        organisationId: cleanOrg,
        $or: duplicateConditions,
      });

      if (existing) {
        results.duplicateCount++;
        results.items.push({
          clientOfflineId,
          billId: existing.billId,
          status: 'ALREADY_SYNCED',
          replayedAt: existing.createdAt,
        });
        continue;
      }

      // 4. Offline Risk Policy Resolution
      const policy = this.resolveOperationPolicy(tx);

      if (policy === OFFLINE_POLICY_CLASSES.ONLINE_REQUIRED) {
        results.rejectedCount++;
        results.items.push({
          clientOfflineId,
          status: 'REJECTED',
          policy,
          reason: `High-risk operation (${tx.operationType || tx.status || 'FINANCIAL_MUTATION'}) requires online server authorization. Offline queueing and replay prohibited.`,
        });
        continue;
      }

      if (policy === OFFLINE_POLICY_CLASSES.PAYMENT_PROVIDER_DEPENDENT) {
        results.rejectedCount++;
        results.items.push({
          clientOfflineId,
          status: 'REJECTED',
          policy,
          reason: `Electronic payment method (${tx.paymentMethod}) requires online payment provider authorization. Offline processing is prohibited.`,
        });
        continue;
      }

      if (policy === OFFLINE_POLICY_CLASSES.LOCAL_DRAFT_ALLOWED) {
        results.items.push({
          clientOfflineId,
          status: 'DRAFT_SAVED',
          policy,
          reason: 'Local draft stored without financial posting.',
        });
        continue;
      }

      // 5. Safe Queue Processing (SAFE_QUEUE_ALLOWED)
      const totalPaisa = Number(tx.totalPaisa) || 0;
      const discountPaisa = Number(tx.discountPaisa) || 0;
      const subtotalPaisa = Number(tx.subtotalPaisa) || totalPaisa;
      const isExtremeDiscount = subtotalPaisa > 0 && ((discountPaisa / subtotalPaisa) * 100 > maxDiscountPercent);
      const isLargeOfflineAmount = totalPaisa > highValueAmountPaise;

      let syncFlag = 'CLEAN';
      let flagReason = '';

      if (isExtremeDiscount) {
        syncFlag = 'FLAGGED_FOR_AUDIT';
        flagReason = `Offline discount exceeded configured ${maxDiscountPercent}% threshold.`;
      } else if (isLargeOfflineAmount) {
        syncFlag = 'FLAGGED_FOR_AUDIT';
        flagReason = `Offline bill total exceeded configured ₹${(highValueAmountPaise / 100).toLocaleString('en-IN')} ceiling.`;
      }

      // Generate server Bill ID if not provided
      const datePart = new Date().toISOString().slice(0, 10).replace(/-/g, '');
      const billId = tx.billId && /^BILL-\d{8}-\d{4,}$/.test(tx.billId)
        ? tx.billId
        : `BILL-${datePart}-${Math.floor(1000 + Math.random() * 9000)}`;

      const businessDate = tx.businessDate || new Date().toISOString().slice(0, 10);

      // Normalize line items and status for Bill schema conformance
      const mappedLineItems = (Array.isArray(tx.lineItems) && tx.lineItems.length > 0
        ? tx.lineItems
        : [{ menuItemId: 'ITEM-OFFLINE', itemNameSnapshot: 'Offline Sale Item', quantity: 1, unitPricePaisa: totalPaisa }]
      ).map((item, idx) => {
        const qty = Math.max(1, Number(item.quantity) || 1);
        const price = Math.max(0, Number(item.unitPricePaisa) || 0);
        const subtotal = Number(item.lineSubtotalPaisa) || (qty * price);
        return {
          menuItemId: item.menuItemId || item.itemId || `ITEM-OFFLINE-${idx + 1}`,
          itemNameSnapshot: item.itemNameSnapshot || item.name || 'Offline Sale Item',
          quantity: qty,
          unitPricePaisa: price,
          lineSubtotalPaisa: subtotal,
          lineTotalPaisa: Number(item.lineTotalPaisa) || subtotal,
          modifiers: item.modifiers || {},
          itemNotes: item.itemNotes || '',
        };
      });

      const validStatuses = ['OPEN', 'COMPLETED', 'PARTIALLY_REFUNDED', 'REFUNDED', 'VOIDED', 'PAYMENT_REVERSED'];
      let billStatus = tx.status || 'COMPLETED';
      if (billStatus === 'PAID') billStatus = 'COMPLETED';
      if (!validStatuses.includes(billStatus)) billStatus = 'COMPLETED';

      // Create new Bill with replay tags
      const createdBill = await Bill.create({
        billId,
        invoiceNumber: tx.invoiceNumber || `INV-${billId.slice(-6)}`,
        organisationId: cleanOrg,
        cafeId: cleanCafe,
        orderType: tx.orderType || 'QUICK_SALE',
        serviceMode: tx.serviceMode || 'QUICK_SALE',
        tableNumber: tx.tableNumber || '',
        customerName: tx.customerName || '',
        customerPhone: tx.customerPhone || '',
        lineItems: mappedLineItems,
        subtotalPaisa,
        taxPaisa: Number(tx.taxPaisa) || 0,
        discountPaisa,
        totalPaisa,
        paymentStatus: tx.paymentStatus || 'PAID',
        paymentMethod: tx.paymentMethod || tx.paymentMode || 'CASH',
        businessDate,
        status: billStatus,
        cashierUserId: tx.cashierUserId || userId || 'OFFLINE_CASHIER',
        isOfflineReplay: true,
        clientOfflineId,
        offlineCreatedAt: tx.offlineCreatedAt ? new Date(tx.offlineCreatedAt) : new Date(),
      });

      // Route to KDS if order items exist
      try {
        if (Array.isArray(createdBill.lineItems) && createdBill.lineItems.length > 0) {
          await KdsService.createTicketsFromOrder({
            organisationId: cleanOrg,
            cafeId: cleanCafe,
            billId: createdBill.billId,
            tableNumber: createdBill.tableNumber,
            diningOption: createdBill.serviceMode === 'DINE_IN' ? 'DINE_IN' : 'TAKEAWAY',
            items: createdBill.lineItems.map((li) => ({
              itemId: li.menuItemId,
              name: li.name,
              quantity: li.quantity,
              notes: 'Replayed from offline queue',
            })),
            specialInstructions: 'OFFLINE_REPLAY',
          });
        }
      } catch (_) {}

      results.syncedCount++;
      if (syncFlag === 'FLAGGED_FOR_AUDIT') {
        results.flaggedCount++;
      }

      results.items.push({
        clientOfflineId,
        billId: createdBill.billId,
        status: syncFlag === 'FLAGGED_FOR_AUDIT' ? 'SYNCED_WITH_FLAG' : 'SYNCED',
        syncFlag,
        flagReason,
        totalPaisa: createdBill.totalPaisa,
      });
    }

    return results;
  }
}

OfflineSyncService.OFFLINE_POLICY_CLASSES = OFFLINE_POLICY_CLASSES;

module.exports = OfflineSyncService;
module.exports.OFFLINE_POLICY_CLASSES = OFFLINE_POLICY_CLASSES;
