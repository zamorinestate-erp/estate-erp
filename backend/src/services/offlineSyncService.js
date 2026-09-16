'use strict';

/**
 * ============================================================================
 * ZAMORIN CAFÉ ERP — OFFLINE SYNC RECONCILIATION SERVICE (REC-13 / R02-09)
 * ============================================================================
 * Ingests offline transactions generated during network outages or degraded
 * operating mode. Guarantees:
 * - Deterministic idempotency via client-generated saleAttemptId & idempotencyKey
 * - High-risk operation detection (large offline refunds, extreme discounts)
 * - Safe replay strictly through canonical PosOrderService (REC-04B pipeline)
 * - Strict café governance (suspended/closed cafés routed to CONFLICT_REVIEW_REQUIRED)
 * - Server catalog pricing authority (tampered local prices recomputed canonically)
 * - Zero KDS (Kitchen Display System is removed / NOT_APPLICABLE)
 * - Audit logging with IS_OFFLINE_REPLAY flag
 */

const { Bill } = require('../models/Bill');
const { Cafe } = require('../models/Cafe');
const { DeviceRegistration } = require('../models/DeviceRegistration');
const { OperatorSession } = require('../models/OperatorSession');
const { OfflineRiskConfigService } = require('./offlineRiskConfigService');
const PosOrderService = require('./posOrderService');

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
   * Strictly uses PosOrderService (REC-04B) for canonical single-commit execution.
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

    // Check Café operational status for governance compliance
    let cafeDoc = null;
    try {
      cafeDoc = await Cafe.findOne({ organisationId: cleanOrg, cafeId: cleanCafe }).lean();
    } catch (_) {}

    const isCafeSuspendedOrClosed =
      cafeDoc && ['TEMPORARILY_CLOSED', 'CLOSED', 'SUSPENDED', 'UNDER_REVIEW', 'ARCHIVED'].includes(cafeDoc.status);

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
    let isSessionExpiredOrEnded = false;
    if (operatorSessionId) {
      const session = await OperatorSession.findOne({
        organisationId: cleanOrg,
        operatorSessionId: operatorSessionId.trim(),
      }).lean();

      if (!session) {
        throw new Error(`Operator session ${operatorSessionId} not found.`);
      }
      if (session.status === 'EXPIRED' || session.status === 'ENDED' || session.endedAt) {
        isSessionExpiredOrEnded = true;
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
      conflictCount: 0,
      items: [],
    };

    for (const tx of transactions) {
      const clientOfflineId = tx.clientOfflineId || tx.saleAttemptId || tx.offlineId || tx.id;
      if (!clientOfflineId) {
        results.rejectedCount++;
        results.items.push({
          clientOfflineId: null,
          status: 'REJECTED',
          reason: 'Missing clientOfflineId for idempotency tracking.',
        });
        continue;
      }

      // Cross-café verification: transaction must match destination cafe
      const txCafe = (tx.cafeId || cleanCafe).trim().toUpperCase();
      if (txCafe !== cleanCafe) {
        results.rejectedCount++;
        results.items.push({
          clientOfflineId,
          status: 'REJECTED',
          reason: `Cross-café isolation violation: transaction belongs to ${txCafe}, not ${cleanCafe}.`,
        });
        continue;
      }

      // Governance: Café suspended before sync
      if (isCafeSuspendedOrClosed) {
        results.conflictCount++;
        results.items.push({
          clientOfflineId,
          status: 'CONFLICT_REVIEW_REQUIRED',
          reason: `Café ${cleanCafe} is ${cafeDoc.status}. Offline sales cannot finalize into a suspended café. Evidence preserved for review.`,
          capturedAt: tx.capturedAtClient || tx.offlineCreatedAt,
        });
        continue;
      }

      // 3. Idempotency Verification: has this offline bill already been replayed?
      const duplicateConditions = [{ clientOfflineId }];
      if (tx.saleAttemptId) {
        duplicateConditions.push({ saleAttemptId: tx.saleAttemptId });
      }
      if (tx.idempotencyKey) {
        duplicateConditions.push({ correlationId: tx.idempotencyKey });
      }
      if (tx.billId) {
        duplicateConditions.push({ billId: tx.billId });
      }
      const existing = await Bill.findOne({
        organisationId: cleanOrg,
        $or: duplicateConditions,
      }).lean();

      if (existing) {
        results.duplicateCount++;
        results.items.push({
          clientOfflineId,
          billId: existing.billId,
          invoiceNumber: existing.invoiceNumber,
          status: 'ALREADY_SYNCED',
          totalPaisa: existing.totalPaisa,
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

      // 5. Safe Queue Processing (SAFE_QUEUE_ALLOWED) via PosOrderService (REC-04B)
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

      // Format line items for PosOrderService
      const mappedLineItems = (Array.isArray(tx.lineItems) && tx.lineItems.length > 0
        ? tx.lineItems
        : [{ menuItemId: 'ITEM-OFFLINE', itemNameSnapshot: 'Offline Sale Item', quantity: 1, unitPricePaisa: totalPaisa }]
      ).map((item, idx) => {
        const qty = Math.max(1, Math.floor(Number(item.quantity) || 1));
        const price = Math.max(0, Math.round(Number(item.unitPricePaisa ?? item.pricePaisa ?? (item.price != null ? item.price * 100 : 0))));
        return {
          menuItemId: item.menuItemId || item.itemId || item.id || `ITEM-OFFLINE-${idx + 1}`,
          itemNameSnapshot: item.itemNameSnapshot || item.name || 'Offline Sale Item',
          quantity: qty,
          unitPricePaisa: price,
          modifiers: item.modifiers || {},
          itemNotes: item.itemNotes || item.notes || (isSessionExpiredOrEnded ? 'LATE_OFFLINE_SYNC' : ''),
          taxRatePercent: typeof item.taxRatePercent === 'number' ? item.taxRatePercent : 5,
          taxClassification: item.taxClassification || 'GST_5',
          discountPaisa: Math.max(0, Math.round(Number(item.discountPaisa || 0))),
        };
      });

      const idempotencyKey = tx.idempotencyKey || `OFFLINE-IDEM-${clientOfflineId}`;
      const saleAttemptId = tx.saleAttemptId || clientOfflineId;

      const orderPayload = {
        action: 'SAVE',
        cafeId: cleanCafe,
        orderType: tx.orderType || 'QUICK_SALE',
        serviceMode: tx.serviceMode || tx.orderType || 'QUICK_SALE',
        tableNumber: tx.tableNumber || '',
        tableToken: tx.tableToken || '',
        guestCovers: Math.max(1, Number(tx.guestCovers) || 1),
        discountPaisa,
        paymentMethod: tx.paymentMethod || tx.paymentMode || 'CASH',
        registerId: tx.registerId || 'REG-01',
        registerSessionId: tx.registerSessionId || operatorSessionId || '',
        idempotencyKey,
        saleAttemptId,
        clientOfflineId,
        offlineCreatedAt: tx.offlineCreatedAt ? new Date(tx.offlineCreatedAt) : (tx.capturedAtClient ? new Date(tx.capturedAtClient) : new Date()),
        catalogVersion: tx.catalogVersion || null,
        lineItems: mappedLineItems,
        tenders: tx.tenders || [
          {
            paymentMethod: tx.paymentMethod || 'CASH',
            amountPaisa: totalPaisa,
            provider: 'CASH_REGISTER',
            paymentReference: tx.paymentReference || `CASH-${clientOfflineId}`,
          },
        ],
        isImmediateCompletion: true,
        isOfflineReplay: true,
      };

      const authContext = {
        organisationId: cleanOrg,
        cafeId: cleanCafe,
        userId: tx.originatingUserId || tx.cashierUserId || userId || 'OFFLINE_CASHIER',
        role: 'STAFF',
      };

      try {
        const orderResult = await PosOrderService.processOrder(orderPayload, authContext, 'SAVE', {
          isOfflineReplay: true,
          clientOfflineId,
        });

        const finalizedBill = orderResult.bill || orderResult.data;
        const finalBillId = finalizedBill?.billId || orderResult.billId;
        const finalInvoice = finalizedBill?.invoiceNumber || orderResult.invoiceNumber;
        const finalTotal = finalizedBill?.totalPaisa || orderResult.totalPaisa || totalPaisa;

        if (orderResult.isIdempotentReplay) {
          results.duplicateCount++;
          results.items.push({
            clientOfflineId,
            billId: finalBillId,
            invoiceNumber: finalInvoice,
            status: 'ALREADY_SYNCED',
            totalPaisa: finalTotal,
            isIdempotentReplay: true,
          });
        } else {
          results.syncedCount++;
          if (syncFlag === 'FLAGGED_FOR_AUDIT') {
            results.flaggedCount++;
          }

          results.items.push({
            clientOfflineId,
            billId: finalBillId,
            invoiceNumber: finalInvoice,
            status: syncFlag === 'FLAGGED_FOR_AUDIT' ? 'SYNCED_WITH_FLAG' : 'SYNCED',
            syncFlag,
            flagReason,
            totalPaisa: finalTotal,
            bomDepletionStatus: finalizedBill?.bomDepletionStatus || 'DEPLETED',
          });
        }
      } catch (err) {
        if (err.statusCode === 409) {
          results.conflictCount++;
          results.items.push({
            clientOfflineId,
            status: 'CONFLICT_REVIEW_REQUIRED',
            reason: err.message,
            errorCode: err.errorCode || 'CONFLICT',
          });
        } else {
          results.rejectedCount++;
          results.items.push({
            clientOfflineId,
            status: 'RETRYABLE_FAILURE',
            reason: err.message,
            errorCode: err.errorCode || 'SYNC_ERROR',
          });
        }
      }
    }

    return results;
  }
}

OfflineSyncService.OFFLINE_POLICY_CLASSES = OFFLINE_POLICY_CLASSES;

module.exports = OfflineSyncService;
module.exports.OFFLINE_POLICY_CLASSES = OFFLINE_POLICY_CLASSES;

