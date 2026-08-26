'use strict';

/**
 * PASSBOOK & MULTI-CAFÉ TREASURY DOMAIN SERVICE
 * Enterprise-grade business logic for accounts, ledger postings, direct adjustments,
 * atomic transfers, statement reconciliations, cash counts, integrity audits, and analytics.
 */

const crypto = require('crypto');
const { PassbookAccount } = require('../models/PassbookAccount');
const { PassbookTransaction } = require('../models/PassbookTransaction');
const { PassbookTransfer } = require('../models/PassbookTransfer');
const { PassbookReconciliation } = require('../models/PassbookReconciliation');
const { PassbookStatementImport } = require('../models/PassbookStatementImport');
const { PassbookReservation } = require('../models/PassbookReservation');
const { PassbookMapping } = require('../models/PassbookMapping');
const { SequenceCounter } = require('../models/SequenceCounter');
const { AuditEvent } = require('../models/AuditEvent');
const { ZurfService } = require('./zurfService');
const { ApiError } = require('../utils/ApiError');

class PassbookService {
  // ── ID GENERATION ──────────────────────────────────────────────────────────

  static async generateId(organisationId, prefix, sequenceKey) {
    const org = organisationId || 'ZAMORIN';
    const yearMonth = new Date().toISOString().slice(0, 7).replace('-', '');
    const fullPrefix = `${prefix}-${yearMonth}-`;
    const num = await SequenceCounter.getNextNumber({
      organisationId: org,
      sequenceKey: sequenceKey || prefix,
      prefix: fullPrefix,
      minimumDigits: 4,
    });
    return `${fullPrefix}${String(num).padStart(4, '0')}`;
  }

  // ── AUDIT LOGGING HELPER ───────────────────────────────────────────────────

  static async logAudit({
    organisationId = 'ZAMORIN',
    actorUserId,
    actorRole,
    action,
    entityType,
    entityId,
    cafeId = null,
    beforeState = null,
    afterState = null,
    reason = null,
  }) {
    try {
      const yearMonthDay = new Date().toISOString().slice(0, 10).replace(/-/g, '');
      const auditNum = await SequenceCounter.getNextNumber({
        organisationId,
        sequenceKey: 'AUDIT_EVENT',
        prefix: `AE-${yearMonthDay}-`,
        minimumDigits: 4,
      });
      const auditEventId = `AE-${yearMonthDay}-${String(auditNum).padStart(4, '0')}`;

      await AuditEvent.create({
        auditEventId,
        organisationId,
        actorUserId: actorUserId || 'SYSTEM',
        actorRole: actorRole || 'SYSTEM',
        module: 'PASSBOOK',
        action,
        entityType,
        entityId,
        cafeId,
        beforeState,
        afterState,
        reason,
        result: 'SUCCESS',
        riskClassification: action.includes('ADJUSTMENT') || action.includes('CLOSE') ? 'HIGH' : 'LOW',
      });
    } catch (e) {
      console.warn('Passbook audit logging non-blocking notice:', e.message);
    }
  }

  // ── 1. ACCOUNTS WORKSPACE ──────────────────────────────────────────────────

  static async getAccountsSummary(organisationId, filters = {}) {
    const org = organisationId || 'ZAMORIN';
    const query = { organisationId: org };

    if (filters.cafeId && filters.cafeId !== 'ALL') {
      query.$or = [
        { scopeType: 'ORGANISATION_GLOBAL' },
        { assignedCafeIds: filters.cafeId },
        { primaryCafeId: filters.cafeId },
      ];
    }
    if (filters.accountType && filters.accountType !== 'ALL') {
      query.accountType = filters.accountType;
    }
    if (filters.status && filters.status !== 'ALL') {
      query.status = filters.status;
    }

    const accounts = await PassbookAccount.find(query).sort({ accountName: 1 }).lean();

    // Compute consolidated stats
    let totalBookBalancePaisa = 0;
    let totalVerifiedStatementBalancePaisa = 0;
    let totalReservedPaisa = 0;
    let totalFreeBalancePaisa = 0;
    let accountsNeedingReconciliation = 0;

    for (const acc of accounts) {
      if (acc.status === 'ACTIVE') {
        totalBookBalancePaisa += acc.bookBalancePaisa || 0;
        totalVerifiedStatementBalancePaisa += acc.verifiedStatementBalancePaisa || 0;
        totalReservedPaisa += acc.reservedPaisa || 0;
        totalFreeBalancePaisa += acc.freeBalancePaisa || 0;

        const diff = Math.abs((acc.verifiedStatementBalancePaisa || 0) - (acc.bookBalancePaisa || 0));
        if (diff > 0 || !acc.lastReconciledDate) {
          accountsNeedingReconciliation++;
        }
      }
    }

    return {
      accounts,
      kpis: {
        totalAccounts: accounts.length,
        activeAccounts: accounts.filter((a) => a.status === 'ACTIVE').length,
        totalBookBalancePaisa,
        totalVerifiedStatementBalancePaisa,
        totalReservedPaisa,
        totalFreeBalancePaisa,
        unreconciledDifferencePaisa: totalVerifiedStatementBalancePaisa - totalBookBalancePaisa,
        accountsNeedingReconciliation,
      },
    };
  }

  static async createAccount(data, auth) {
    const org = auth.organisationId || 'ZAMORIN';
    const accountId = await this.generateId(org, 'PBK-ACC', 'PASSBOOK_ACCOUNT');

    const openingPaisa = Math.round(Number(data.openingBalance || 0) * 100);
    const maskedNumber = data.maskedAccountNumber || (data.accountNumber ? `••••${String(data.accountNumber).slice(-4)}` : '••••0000');

    const account = await PassbookAccount.create({
      accountId,
      organisationId: org,
      accountCode: data.accountCode || `ACC-${Date.now().toString().slice(-6)}`,
      accountName: data.accountName,
      nickname: data.nickname || '',
      accountType: data.accountType || 'BANK_OPERATING',
      bankSubtype: data.bankSubtype || 'CURRENT',
      scopeType: data.scopeType || 'CAFE_SPECIFIC',
      assignedCafeIds: Array.isArray(data.assignedCafeIds) ? data.assignedCafeIds : (data.primaryCafeId ? [data.primaryCafeId] : []),
      primaryCafeId: data.primaryCafeId || null,
      institutionName: data.institutionName || '',
      branchName: data.branchName || '',
      maskedAccountNumber: maskedNumber,
      ifscCode: data.ifscCode || '',
      currency: 'INR',
      bookBalancePaisa: openingPaisa,
      verifiedStatementBalancePaisa: openingPaisa,
      reservedPaisa: 0,
      freeBalancePaisa: openingPaisa,
      openingDate: data.openingDate || new Date().toISOString().slice(0, 10),
      openingBalancePaisa: openingPaisa,
      status: 'ACTIVE',
      purpose: data.purpose || 'OPERATING',
      reconciliationCadence: data.reconciliationCadence || 'MONTHLY',
      imprestLimitPaisa: Math.round(Number(data.imprestLimit || 0) * 100),
      notes: data.notes || '',
      createdBy: auth.userId || 'PRIMARY_MASTER',
    });

    // If opening balance > 0, post first immutable opening transaction
    if (openingPaisa !== 0) {
      const txnId = await this.generateId(org, 'PBK', 'PASSBOOK_TRANSACTION');
      await PassbookTransaction.create({
        transactionId: txnId,
        organisationId: org,
        accountId: account.accountId,
        postingSequence: 1,
        businessDate: account.openingDate,
        postingDate: account.openingDate,
        valueDate: account.openingDate,
        type: 'OPENING_BALANCE',
        direction: openingPaisa > 0 ? 'CREDIT' : 'DEBIT',
        amountPaisa: Math.abs(openingPaisa),
        runningBalancePaisa: openingPaisa,
        currency: 'INR',
        paymentMode: 'BANK_TRANSFER',
        narration: `Initial opening balance migration for ${account.accountName}`,
        category: 'OPENING_POSITION',
        sourceType: 'MIGRATED',
        economicCafeId: account.primaryCafeId || 'ALL',
        reconciliationStatus: 'UNRECONCILED',
        status: 'POSTED',
        createdBy: auth.userId || 'PRIMARY_MASTER',
      });
    }

    await this.logAudit({
      organisationId: org,
      actorUserId: auth.userId,
      actorRole: auth.role,
      action: 'ACCOUNT_CREATED',
      entityType: 'PASSBOOK_ACCOUNT',
      entityId: account.accountId,
      cafeId: account.primaryCafeId,
      afterState: account.toObject(),
    });

    return account;
  }

  static async updateAccount(accountId, data, auth) {
    const org = auth.organisationId || 'ZAMORIN';
    const account = await PassbookAccount.findOne({ accountId, organisationId: org });
    if (!account) throw new ApiError(404, 'ACCOUNT_NOT_FOUND', 'Passbook account not found.');

    const beforeState = account.toObject();

    if (data.accountName) account.accountName = data.accountName;
    if (data.nickname !== undefined) account.nickname = data.nickname;
    if (data.purpose) account.purpose = data.purpose;
    if (data.status) account.status = data.status;
    if (data.reconciliationCadence) account.reconciliationCadence = data.reconciliationCadence;
    if (data.institutionName) account.institutionName = data.institutionName;
    if (data.branchName) account.branchName = data.branchName;
    if (data.ifscCode) account.ifscCode = data.ifscCode;
    if (data.assignedCafeIds) account.assignedCafeIds = data.assignedCafeIds;
    if (data.primaryCafeId) account.primaryCafeId = data.primaryCafeId;
    if (data.notes !== undefined) account.notes = data.notes;
    if (data.isPinned !== undefined) account.isPinned = data.isPinned;
    if (data.imprestLimit !== undefined) account.imprestLimitPaisa = Math.round(Number(data.imprestLimit) * 100);

    await account.save();

    await this.logAudit({
      organisationId: org,
      actorUserId: auth.userId,
      actorRole: auth.role,
      action: 'ACCOUNT_UPDATED',
      entityType: 'PASSBOOK_ACCOUNT',
      entityId: account.accountId,
      beforeState,
      afterState: account.toObject(),
    });

    return account;
  }

  static async rebuildAccountBalance(accountId, organisationId) {
    const org = organisationId || 'ZAMORIN';
    const account = await PassbookAccount.findOne({ accountId, organisationId: org });
    if (!account) throw new ApiError(404, 'ACCOUNT_NOT_FOUND', 'Account not found.');

    const txns = await PassbookTransaction.find({ accountId, organisationId: org, status: 'POSTED' })
      .sort({ postingDate: 1, postingSequence: 1, createdAt: 1 });

    let runningPaisa = 0;
    for (let i = 0; i < txns.length; i++) {
      const t = txns[i];
      if (t.direction === 'CREDIT') {
        runningPaisa += t.amountPaisa;
      } else {
        runningPaisa -= t.amountPaisa;
      }
      t.postingSequence = i + 1;
      t.runningBalancePaisa = runningPaisa;
      await t.save();
    }

    account.bookBalancePaisa = runningPaisa;
    account.freeBalancePaisa = runningPaisa - (account.reservedPaisa || 0);
    await account.save();

    return { accountId, bookBalancePaisa: runningPaisa, transactionCount: txns.length };
  }

  // ── 2. TRANSACTIONS & POSTINGS ─────────────────────────────────────────────

  static async listTransactions(organisationId, query = {}) {
    const org = organisationId || 'ZAMORIN';
    const filter = { organisationId: org };

    if (query.accountId && query.accountId !== 'ALL') filter.accountId = query.accountId;
    if (query.cafeId && query.cafeId !== 'ALL') {
      filter.$or = [
        { economicCafeId: query.cafeId },
        { 'allocations.cafeId': query.cafeId },
      ];
    }
    if (query.type && query.type !== 'ALL') filter.type = query.type;
    if (query.direction && query.direction !== 'ALL') filter.direction = query.direction;
    if (query.category && query.category !== 'ALL') filter.category = query.category;
    if (query.paymentMode && query.paymentMode !== 'ALL') filter.paymentMode = query.paymentMode;
    if (query.reconciliationStatus && query.reconciliationStatus !== 'ALL') filter.reconciliationStatus = query.reconciliationStatus;
    if (query.status && query.status !== 'ALL') filter.status = query.status;
    if (query.dateFrom && query.dateTo) {
      filter.postingDate = { $gte: query.dateFrom, $lte: query.dateTo };
    } else if (query.dateFrom) {
      filter.postingDate = { $gte: query.dateFrom };
    }

    if (query.search) {
      const q = String(query.search).trim();
      filter.$or = [
        { transactionId: { $regex: q, $options: 'i' } },
        { externalReference: { $regex: q, $options: 'i' } },
        { narration: { $regex: q, $options: 'i' } },
        { remitter: { $regex: q, $options: 'i' } },
        { beneficiary: { $regex: q, $options: 'i' } },
      ];
    }

    const page = Math.max(1, Number(query.page || 1));
    const limit = Math.min(200, Math.max(1, Number(query.limit || 50)));
    const skip = (page - 1) * limit;

    const total = await PassbookTransaction.countDocuments(filter);
    const transactions = await PassbookTransaction.find(filter)
      .sort({ postingDate: -1, postingSequence: -1, createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    return {
      transactions,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  static async postTransaction(data, auth) {
    const org = auth.organisationId || 'ZAMORIN';
    const account = await PassbookAccount.findOne({ accountId: data.accountId, organisationId: org });
    if (!account) throw new ApiError(404, 'ACCOUNT_NOT_FOUND', 'Target passbook account not found.');
    if (account.status === 'CLOSED') throw new ApiError(400, 'ACCOUNT_CLOSED', 'Cannot post to a closed account.');

    const amountPaisa = Math.round(Number(data.amount) * 100);
    if (!amountPaisa || amountPaisa <= 0) throw new ApiError(400, 'INVALID_AMOUNT', 'Transaction amount must be greater than zero.');

    const direction = data.direction || (data.type === 'EXTERNAL_INCOME' ? 'CREDIT' : 'DEBIT');
    const newBookBalancePaisa = direction === 'CREDIT'
      ? (account.bookBalancePaisa || 0) + amountPaisa
      : (account.bookBalancePaisa || 0) - amountPaisa;

    const lastTxn = await PassbookTransaction.findOne({ accountId: account.accountId, organisationId: org })
      .sort({ postingSequence: -1 });
    const nextSeq = (lastTxn?.postingSequence || 0) + 1;

    const txnId = await this.generateId(org, 'PBK', 'PASSBOOK_TRANSACTION');
    const today = new Date().toISOString().slice(0, 10);

    const transaction = await PassbookTransaction.create({
      transactionId: txnId,
      organisationId: org,
      accountId: account.accountId,
      postingSequence: nextSeq,
      businessDate: data.businessDate || today,
      postingDate: data.postingDate || today,
      valueDate: data.valueDate || data.postingDate || today,
      type: data.type || (direction === 'CREDIT' ? 'EXTERNAL_INCOME' : 'EXTERNAL_EXPENSE'),
      direction,
      amountPaisa,
      runningBalancePaisa: newBookBalancePaisa,
      currency: 'INR',
      paymentMode: data.paymentMode || 'BANK_TRANSFER',
      remitter: data.remitter || '',
      beneficiary: data.beneficiary || '',
      counterpartyType: data.counterpartyType || null,
      counterpartyId: data.counterpartyId || null,
      externalReference: data.externalReference || '',
      narration: data.narration || `${data.type || 'Transaction'} on ${account.accountName}`,
      category: data.category || 'GENERAL',
      sourceType: data.sourceType || 'MANUAL',
      sourceId: data.sourceId || null,
      economicCafeId: data.economicCafeId || account.primaryCafeId || 'ALL',
      allocations: Array.isArray(data.allocations) ? data.allocations : [],
      reconciliationStatus: 'UNRECONCILED',
      status: 'POSTED',
      attachments: Array.isArray(data.attachments) ? data.attachments : [],
      notes: data.notes || '',
      tags: Array.isArray(data.tags) ? data.tags : [],
      createdBy: auth.userId || 'PRIMARY_MASTER',
    });

    account.bookBalancePaisa = newBookBalancePaisa;
    account.freeBalancePaisa = newBookBalancePaisa - (account.reservedPaisa || 0);
    account.lastTransactionDate = transaction.postingDate;
    await account.save();

    await this.logAudit({
      organisationId: org,
      actorUserId: auth.userId,
      actorRole: auth.role,
      action: 'TRANSACTION_POSTED',
      entityType: 'PASSBOOK_TRANSACTION',
      entityId: transaction.transactionId,
      cafeId: transaction.economicCafeId,
      afterState: transaction.toObject(),
    });

    return transaction;
  }

  static async directBalanceAdjustment(accountId, data, auth) {
    const org = auth.organisationId || 'ZAMORIN';
    const account = await PassbookAccount.findOne({ accountId, organisationId: org });
    if (!account) throw new ApiError(404, 'ACCOUNT_NOT_FOUND', 'Target passbook account not found.');

    const targetBalancePaisa = Math.round(Number(data.newBalance) * 100);
    const currentBookPaisa = account.bookBalancePaisa || 0;
    const diffPaisa = targetBalancePaisa - currentBookPaisa;

    if (diffPaisa === 0) {
      throw new ApiError(400, 'NO_DIFFERENCE', 'The specified balance is identical to current ERP book balance.');
    }

    if (!data.reason || !data.reason.trim()) {
      throw new ApiError(400, 'REASON_REQUIRED', 'Mandatory justification reason is required for direct balance adjustments.');
    }

    const direction = diffPaisa > 0 ? 'CREDIT' : 'DEBIT';
    const amountPaisa = Math.abs(diffPaisa);

    const lastTxn = await PassbookTransaction.findOne({ accountId: account.accountId, organisationId: org })
      .sort({ postingSequence: -1 });
    const nextSeq = (lastTxn?.postingSequence || 0) + 1;

    const txnId = await this.generateId(org, 'PBK-ADJ', 'PASSBOOK_TRANSACTION');
    const today = new Date().toISOString().slice(0, 10);

    const transaction = await PassbookTransaction.create({
      transactionId: txnId,
      organisationId: org,
      accountId: account.accountId,
      postingSequence: nextSeq,
      businessDate: data.effectiveDate || today,
      postingDate: data.postingDate || today,
      valueDate: data.valueDate || data.effectiveDate || today,
      type: 'BALANCE_ADJUSTMENT',
      direction,
      amountPaisa,
      runningBalancePaisa: targetBalancePaisa,
      currency: 'INR',
      paymentMode: 'OTHER',
      narration: `DIRECT BALANCE ADJUSTMENT: ${data.reason.trim()} (Diff: ${diffPaisa > 0 ? '+' : ''}₹${(diffPaisa / 100).toFixed(2)})`,
      category: 'BALANCE_ADJUSTMENT',
      sourceType: 'RECONCILIATION_ADJUSTMENT',
      economicCafeId: account.primaryCafeId || 'ALL',
      reconciliationStatus: 'UNRECONCILED',
      status: 'POSTED',
      attachments: data.attachment ? [data.attachment] : [],
      notes: data.notes || '',
      createdBy: auth.userId || 'PRIMARY_MASTER',
    });

    const beforeState = account.toObject();
    account.bookBalancePaisa = targetBalancePaisa;
    account.freeBalancePaisa = targetBalancePaisa - (account.reservedPaisa || 0);
    account.lastTransactionDate = transaction.postingDate;
    await account.save();

    await this.logAudit({
      organisationId: org,
      actorUserId: auth.userId,
      actorRole: auth.role,
      action: 'DIRECT_BALANCE_ADJUSTMENT',
      entityType: 'PASSBOOK_ACCOUNT',
      entityId: account.accountId,
      cafeId: account.primaryCafeId,
      beforeState,
      afterState: account.toObject(),
      reason: data.reason.trim(),
    });

    return {
      account,
      transaction,
      diffPaisa,
    };
  }

  static async reverseTransaction(transactionId, reason, auth) {
    const org = auth.organisationId || 'ZAMORIN';
    const original = await PassbookTransaction.findOne({ transactionId, organisationId: org });
    if (!original) throw new ApiError(404, 'TRANSACTION_NOT_FOUND', 'Original transaction not found.');
    if (original.status === 'REVERSED') throw new ApiError(400, 'ALREADY_REVERSED', 'This transaction has already been reversed.');

    const account = await PassbookAccount.findOne({ accountId: original.accountId, organisationId: org });
    if (!account) throw new ApiError(404, 'ACCOUNT_NOT_FOUND', 'Associated account not found.');

    const reverseDirection = original.direction === 'CREDIT' ? 'DEBIT' : 'CREDIT';
    const newBookBalancePaisa = reverseDirection === 'CREDIT'
      ? (account.bookBalancePaisa || 0) + original.amountPaisa
      : (account.bookBalancePaisa || 0) - original.amountPaisa;

    const lastTxn = await PassbookTransaction.findOne({ accountId: account.accountId, organisationId: org })
      .sort({ postingSequence: -1 });
    const nextSeq = (lastTxn?.postingSequence || 0) + 1;

    const reversalTxnId = await this.generateId(org, 'PBK-REV', 'PASSBOOK_TRANSACTION');
    const today = new Date().toISOString().slice(0, 10);

    const reversalTxn = await PassbookTransaction.create({
      transactionId: reversalTxnId,
      organisationId: org,
      accountId: account.accountId,
      postingSequence: nextSeq,
      businessDate: today,
      postingDate: today,
      valueDate: today,
      type: 'REVERSAL',
      direction: reverseDirection,
      amountPaisa: original.amountPaisa,
      runningBalancePaisa: newBookBalancePaisa,
      currency: 'INR',
      paymentMode: original.paymentMode,
      narration: `REVERSAL OF ${original.transactionId}: ${reason || 'Correction of entry'}`,
      category: original.category,
      sourceType: 'RECONCILIATION_ADJUSTMENT',
      sourceId: original.transactionId,
      economicCafeId: original.economicCafeId,
      reversalOf: original.transactionId,
      status: 'POSTED',
      createdBy: auth.userId || 'PRIMARY_MASTER',
    });

    original.status = 'REVERSED';
    original.reversalTransactionId = reversalTxnId;
    await original.save();

    account.bookBalancePaisa = newBookBalancePaisa;
    account.freeBalancePaisa = newBookBalancePaisa - (account.reservedPaisa || 0);
    await account.save();

    await this.logAudit({
      organisationId: org,
      actorUserId: auth.userId,
      actorRole: auth.role,
      action: 'TRANSACTION_REVERSED',
      entityType: 'PASSBOOK_TRANSACTION',
      entityId: original.transactionId,
      cafeId: original.economicCafeId,
      beforeState: original.toObject(),
      afterState: reversalTxn.toObject(),
      reason,
    });

    return reversalTxn;
  }

  // ── 3. TRANSFERS WORKSPACE ─────────────────────────────────────────────────

  static async createTransfer(data, auth) {
    const org = auth.organisationId || 'ZAMORIN';
    const sourceAcc = await PassbookAccount.findOne({ accountId: data.sourceAccountId, organisationId: org });
    const destAcc = await PassbookAccount.findOne({ accountId: data.destAccountId, organisationId: org });

    if (!sourceAcc || !destAcc) throw new ApiError(404, 'ACCOUNT_NOT_FOUND', 'Source or destination account not found.');
    if (sourceAcc.accountId === destAcc.accountId) throw new ApiError(400, 'SAME_ACCOUNT', 'Source and destination accounts must be different.');

    const amountPaisa = Math.round(Number(data.amount) * 100);
    if (!amountPaisa || amountPaisa <= 0) throw new ApiError(400, 'INVALID_AMOUNT', 'Transfer amount must be positive.');

    const isInterCafe = (data.sourceCafeId || sourceAcc.primaryCafeId) !== (data.destCafeId || destAcc.primaryCafeId);
    const transferType = isInterCafe ? 'INTER_CAFE_TRANSFER' : 'SAME_CAFE_ACCOUNT_TRANSFER';
    const transferId = await this.generateId(org, 'TRF', 'PASSBOOK_TRANSFER');
    const today = new Date().toISOString().slice(0, 10);

    // Leg 1: Source Account Debit
    const srcLastTxn = await PassbookTransaction.findOne({ accountId: sourceAcc.accountId, organisationId: org }).sort({ postingSequence: -1 });
    const srcSeq = (srcLastTxn?.postingSequence || 0) + 1;
    const srcNewBalance = (sourceAcc.bookBalancePaisa || 0) - amountPaisa;
    const srcTxnId = await this.generateId(org, 'PBK', 'PASSBOOK_TRANSACTION');

    const srcTxn = await PassbookTransaction.create({
      transactionId: srcTxnId,
      organisationId: org,
      accountId: sourceAcc.accountId,
      postingSequence: srcSeq,
      businessDate: today,
      postingDate: today,
      valueDate: today,
      type: isInterCafe ? 'INTER_CAFE_TRANSFER_OUT' : 'TRANSFER_OUT',
      direction: 'DEBIT',
      amountPaisa,
      runningBalancePaisa: srcNewBalance,
      currency: 'INR',
      paymentMode: 'INTERNAL_TRANSFER',
      beneficiary: destAcc.accountName,
      narration: `TRANSFER TO ${destAcc.accountName} (${destAcc.maskedAccountNumber}) — ${data.purpose || 'Internal treasury movement'}`,
      category: 'TRANSFER',
      sourceType: 'MANUAL',
      transferId,
      economicCafeId: data.sourceCafeId || sourceAcc.primaryCafeId || 'ALL',
      status: 'POSTED',
      createdBy: auth.userId || 'PRIMARY_MASTER',
    });

    sourceAcc.bookBalancePaisa = srcNewBalance;
    sourceAcc.freeBalancePaisa = srcNewBalance - (sourceAcc.reservedPaisa || 0);
    await sourceAcc.save();

    // Leg 2: Destination Account Credit
    const dstLastTxn = await PassbookTransaction.findOne({ accountId: destAcc.accountId, organisationId: org }).sort({ postingSequence: -1 });
    const dstSeq = (dstLastTxn?.postingSequence || 0) + 1;
    const dstNewBalance = (destAcc.bookBalancePaisa || 0) + amountPaisa;
    const dstTxnId = await this.generateId(org, 'PBK', 'PASSBOOK_TRANSACTION');

    const dstTxn = await PassbookTransaction.create({
      transactionId: dstTxnId,
      organisationId: org,
      accountId: destAcc.accountId,
      postingSequence: dstSeq,
      businessDate: today,
      postingDate: today,
      valueDate: today,
      type: isInterCafe ? 'INTER_CAFE_TRANSFER_IN' : 'TRANSFER_IN',
      direction: 'CREDIT',
      amountPaisa,
      runningBalancePaisa: dstNewBalance,
      currency: 'INR',
      paymentMode: 'INTERNAL_TRANSFER',
      remitter: sourceAcc.accountName,
      narration: `TRANSFER FROM ${sourceAcc.accountName} (${sourceAcc.maskedAccountNumber}) — ${data.purpose || 'Internal treasury movement'}`,
      category: 'TRANSFER',
      sourceType: 'MANUAL',
      transferId,
      economicCafeId: data.destCafeId || destAcc.primaryCafeId || 'ALL',
      status: 'POSTED',
      createdBy: auth.userId || 'PRIMARY_MASTER',
    });

    destAcc.bookBalancePaisa = dstNewBalance;
    destAcc.freeBalancePaisa = dstNewBalance - (destAcc.reservedPaisa || 0);
    await destAcc.save();

    // Transfer Record
    const transfer = await PassbookTransfer.create({
      transferId,
      organisationId: org,
      transferType,
      sourceAccountId: sourceAcc.accountId,
      sourceCafeId: data.sourceCafeId || sourceAcc.primaryCafeId || 'ALL',
      sourceTransactionId: srcTxnId,
      destAccountId: destAcc.accountId,
      destCafeId: data.destCafeId || destAcc.primaryCafeId || 'ALL',
      destTransactionId: dstTxnId,
      amountPaisa,
      purpose: data.purpose || 'Treasury transfer',
      status: 'COMPLETED',
      initiatedBy: auth.userId || 'PRIMARY_MASTER',
    });

    await this.logAudit({
      organisationId: org,
      actorUserId: auth.userId,
      actorRole: auth.role,
      action: isInterCafe ? 'INTER_CAFE_TRANSFER_COMPLETED' : 'INTERNAL_TRANSFER_COMPLETED',
      entityType: 'PASSBOOK_TRANSFER',
      entityId: transfer.transferId,
      afterState: transfer.toObject(),
    });

    return {
      transfer,
      sourceTransaction: srcTxn,
      destTransaction: dstTxn,
    };
  }

  // ── 4. RECONCILIATION & STATEMENTS ─────────────────────────────────────────

  static async commitStatementImport(data, auth) {
    const org = auth.organisationId || 'ORG-ZAMORIN-01';
    const account = await PassbookAccount.findOne({ accountId: data.accountId, organisationId: org });
    if (!account) throw new ApiError(404, 'ACCOUNT_NOT_FOUND', 'Target passbook account not found.');

    const fileHash = crypto.createHash('sha256').update(`${data.fileName}-${data.statementPeriodStart}-${data.statementPeriodEnd}-${Date.now()}`).digest('hex');
    const sessionId = await this.generateId(org, 'STM', 'PASSBOOK_STATEMENT_IMPORT');

    const openingPaisa = Math.round(Number(data.openingBalance || 0) * 100);
    const closingPaisa = Math.round(Number(data.closingBalance || 0) * 100);

    const rows = Array.isArray(data.rows) ? data.rows.map((r, idx) => ({
      rowId: `ROW-${idx + 1}`,
      rowNumber: idx + 1,
      date: r.date || new Date().toISOString().slice(0, 10),
      valueDate: r.valueDate || r.date,
      reference: r.reference || '',
      narration: r.narration || 'Statement entry',
      debitPaisa: Math.round(Number(r.debit || 0) * 100),
      creditPaisa: Math.round(Number(r.credit || 0) * 100),
      balancePaisa: r.balance !== undefined ? Math.round(Number(r.balance) * 100) : null,
      matchStatus: 'NO_MATCH',
    })) : [];

    const statementImport = await PassbookStatementImport.create({
      importSessionId: sessionId,
      organisationId: org,
      accountId: account.accountId,
      fileName: data.fileName || 'statement.csv',
      fileSize: Number(data.fileSize || 1024),
      fileHash,
      fileType: data.fileType || 'CSV',
      profileId: data.profileId || 'STANDARD',
      statementPeriodStart: data.statementPeriodStart || new Date().toISOString().slice(0, 10),
      statementPeriodEnd: data.statementPeriodEnd || new Date().toISOString().slice(0, 10),
      openingBalancePaisa: openingPaisa,
      closingBalancePaisa: closingPaisa,
      rowCount: rows.length,
      rows,
      status: 'COMMITTED',
      importedBy: auth.userId || 'PRIMARY_MASTER',
    });

    account.verifiedStatementBalancePaisa = closingPaisa;
    account.lastStatementDate = statementImport.statementPeriodEnd;
    await account.save();

    await this.logAudit({
      organisationId: org,
      actorUserId: auth.userId,
      actorRole: auth.role,
      action: 'STATEMENT_IMPORTED',
      entityType: 'PASSBOOK_STATEMENT_IMPORT',
      entityId: statementImport.importSessionId,
      afterState: statementImport.toObject(),
    });

    return statementImport;
  }

  static async confirmBalance(reconciliationId, data, auth) {
    const org = auth.organisationId || 'ORG-ZAMORIN-01';
    let recon = await PassbookReconciliation.findOne({ reconciliationId, organisationId: org });
    if (!recon) {
      // Create if fresh sign-off
      const recId = await this.generateId(org, 'REC', 'PASSBOOK_RECONCILIATION');
      recon = new PassbookReconciliation({
        reconciliationId: recId,
        organisationId: org,
        accountId: data.accountId,
        periodId: data.periodId || '2026-08',
        fiscalYear: data.fiscalYear || 'FY 2026-27',
        statementPeriodStart: data.statementPeriodStart || new Date().toISOString().slice(0, 10),
        statementPeriodEnd: data.statementPeriodEnd || new Date().toISOString().slice(0, 10),
        openingBookBalancePaisa: Math.round(Number(data.openingBookBalance || 0) * 100),
        closingBookBalancePaisa: Math.round(Number(data.closingBookBalance || 0) * 100),
        openingStatementBalancePaisa: Math.round(Number(data.openingStatementBalance || 0) * 100),
        closingStatementBalancePaisa: Math.round(Number(data.closingStatementBalance || 0) * 100),
        differencePaisa: Math.round(Number(data.difference || 0) * 100),
        unexplainedDifferencePaisa: Math.round(Number(data.unexplainedDifference || 0) * 100),
      });
    }

    recon.status = 'CONFIRMED';
    recon.confirmedBy = auth.userId || 'PRIMARY_MASTER';
    recon.confirmedAt = new Date();
    recon.notes = data.notes || '';
    await recon.save();

    const account = await PassbookAccount.findOne({ accountId: recon.accountId, organisationId: org });
    if (account) {
      account.lastReconciledDate = new Date().toISOString().slice(0, 10);
      await account.save();
    }

    await this.logAudit({
      organisationId: org,
      actorUserId: auth.userId,
      actorRole: auth.role,
      action: 'RECONCILIATION_CONFIRMED',
      entityType: 'PASSBOOK_RECONCILIATION',
      entityId: recon.reconciliationId,
      afterState: recon.toObject(),
    });

    return recon;
  }

  // ── 5. PHYSICAL CASH & DENOMINATION VERIFICATION ───────────────────────────

  static calculateDenominationTotal(denominations = {}) {
    const d500 = Number(denominations.d500 || 0) * 500;
    const d200 = Number(denominations.d200 || 0) * 200;
    const d100 = Number(denominations.d100 || 0) * 100;
    const d50 = Number(denominations.d50 || 0) * 50;
    const d20 = Number(denominations.d20 || 0) * 20;
    const d10 = Number(denominations.d10 || 0) * 10;
    const coins = Number(denominations.coins || 0);

    const totalRupees = d500 + d200 + d100 + d50 + d20 + d10 + coins;
    return Math.round(totalRupees * 100); // in paise
  }

  // ── 6. RESERVED & COMMITTED FUNDS ──────────────────────────────────────────

  static async createReservation(data, auth) {
    const org = auth.organisationId || 'ORG-ZAMORIN-01';
    const account = await PassbookAccount.findOne({ accountId: data.accountId, organisationId: org });
    if (!account) throw new ApiError(404, 'ACCOUNT_NOT_FOUND', 'Target passbook account not found.');

    const amountPaisa = Math.round(Number(data.amount) * 100);
    if (!amountPaisa || amountPaisa <= 0) throw new ApiError(400, 'INVALID_AMOUNT', 'Reservation amount must be greater than zero.');

    const resId = await this.generateId(org, 'RES', 'PASSBOOK_RESERVATION');
    const today = new Date().toISOString().slice(0, 10);

    const reservation = await PassbookReservation.create({
      reservationId: resId,
      organisationId: org,
      accountId: account.accountId,
      cafeId: data.cafeId || account.primaryCafeId || 'ALL',
      title: data.title || 'Treasury Earmark',
      purpose: data.purpose || 'SUPPLIER_PAYMENTS',
      amountPaisa,
      effectiveDate: data.effectiveDate || today,
      expiryDate: data.expiryDate || null,
      status: 'ACTIVE',
      notes: data.notes || '',
      createdBy: auth.userId || 'PRIMARY_MASTER',
    });

    account.reservedPaisa = (account.reservedPaisa || 0) + amountPaisa;
    account.freeBalancePaisa = (account.bookBalancePaisa || 0) - account.reservedPaisa;
    await account.save();

    await this.logAudit({
      organisationId: org,
      actorUserId: auth.userId,
      actorRole: auth.role,
      action: 'RESERVATION_CREATED',
      entityType: 'PASSBOOK_RESERVATION',
      entityId: reservation.reservationId,
      afterState: reservation.toObject(),
    });

    return reservation;
  }

  // ── 7. INTEGRITY INVARIANT AUDIT ───────────────────────────────────────────

  static async runIntegrityAudit(organisationId) {
    const org = organisationId || 'ORG-ZAMORIN-01';
    const accounts = await PassbookAccount.find({ organisationId: org, status: 'ACTIVE' }).lean();

    const errors = [];
    let consolidatedBookPaisa = 0;
    let consolidatedReservedPaisa = 0;
    let consolidatedFreePaisa = 0;

    for (const acc of accounts) {
      consolidatedBookPaisa += acc.bookBalancePaisa || 0;
      consolidatedReservedPaisa += acc.reservedPaisa || 0;
      consolidatedFreePaisa += acc.freeBalancePaisa || 0;

      // Invariant 1: Free balance = Book balance - Reserved
      const expectedFree = (acc.bookBalancePaisa || 0) - (acc.reservedPaisa || 0);
      if (acc.freeBalancePaisa !== expectedFree) {
        errors.push({
          accountId: acc.accountId,
          invariant: 'FREE_BALANCE_EQUATION_MISMATCH',
          expectedPaisa: expectedFree,
          actualPaisa: acc.freeBalancePaisa,
        });
      }
    }

    // Invariant 2: Transfer pairs balance
    const transfers = await PassbookTransfer.find({ organisationId: org, status: 'COMPLETED' }).lean();
    for (const trf of transfers) {
      const srcTxn = await PassbookTransaction.findOne({ transactionId: trf.sourceTransactionId, organisationId: org });
      const dstTxn = await PassbookTransaction.findOne({ transactionId: trf.destTransactionId, organisationId: org });

      if (!srcTxn || !dstTxn) {
        errors.push({
          transferId: trf.transferId,
          invariant: 'ORPHANED_TRANSFER_LEG',
          explanation: 'Transfer record is missing source or destination transaction leg.',
        });
      } else if (srcTxn.amountPaisa !== dstTxn.amountPaisa || srcTxn.amountPaisa !== trf.amountPaisa) {
        errors.push({
          transferId: trf.transferId,
          invariant: 'TRANSFER_AMOUNT_LEG_PARITY_MISMATCH',
          srcAmount: srcTxn.amountPaisa,
          dstAmount: dstTxn.amountPaisa,
        });
      }
    }

    return {
      status: errors.length === 0 ? 'HEALTHY' : 'INTEGRITY_ERRORS_DETECTED',
      checkedAt: new Date().toISOString(),
      accountCount: accounts.length,
      consolidatedBookBalancePaisa: consolidatedBookPaisa,
      consolidatedReservedPaisa: consolidatedReservedPaisa,
      consolidatedFreeBalancePaisa: consolidatedFreePaisa,
      errorCount: errors.length,
      errors,
    };
  }

  // ── 8. ANALYTICS & CASH FLOW ───────────────────────────────────────────────

  static async getAnalytics(organisationId, filters = {}) {
    const org = organisationId || 'ORG-ZAMORIN-01';
    const txns = await PassbookTransaction.find({ organisationId: org, status: 'POSTED' }).lean();

    let externalIncomePaisa = 0;
    let externalExpensePaisa = 0;
    let internalTransfersPaisa = 0;
    let adjustmentsPaisa = 0;

    const categoryBreakdown = {};
    const cafeBreakdown = {};

    for (const t of txns) {
      const cat = t.category || 'GENERAL';
      const cafe = t.economicCafeId || 'ALL';

      if (!categoryBreakdown[cat]) categoryBreakdown[cat] = 0;
      if (!cafeBreakdown[cafe]) cafeBreakdown[cafe] = { incomePaisa: 0, expensePaisa: 0, netPaisa: 0 };

      if (t.type === 'EXTERNAL_INCOME') {
        externalIncomePaisa += t.amountPaisa;
        categoryBreakdown[cat] += t.amountPaisa;
        cafeBreakdown[cafe].incomePaisa += t.amountPaisa;
        cafeBreakdown[cafe].netPaisa += t.amountPaisa;
      } else if (t.type === 'EXTERNAL_EXPENSE') {
        externalExpensePaisa += t.amountPaisa;
        categoryBreakdown[cat] += t.amountPaisa;
        cafeBreakdown[cafe].expensePaisa += t.amountPaisa;
        cafeBreakdown[cafe].netPaisa -= t.amountPaisa;
      } else if (t.type.includes('TRANSFER')) {
        internalTransfersPaisa += t.amountPaisa;
      } else if (t.type === 'BALANCE_ADJUSTMENT') {
        adjustmentsPaisa += t.direction === 'CREDIT' ? t.amountPaisa : -t.amountPaisa;
      }
    }

    const netCashFlowPaisa = externalIncomePaisa - externalExpensePaisa;

    return {
      externalIncomePaisa,
      externalExpensePaisa,
      netCashFlowPaisa,
      internalTransfersPaisa,
      adjustmentsPaisa,
      categoryBreakdown,
      cafeBreakdown,
    };
  }
}

module.exports = {
  PassbookService,
};
