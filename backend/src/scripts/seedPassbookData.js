'use strict';

const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });
const { connectDatabase, disconnectDatabase } = require('../config/database');
const { PassbookAccount } = require('../models/PassbookAccount');
const { PassbookTransaction } = require('../models/PassbookTransaction');
const { PassbookTransfer } = require('../models/PassbookTransfer');
const { PassbookReconciliation } = require('../models/PassbookReconciliation');
const { PassbookStatementImport } = require('../models/PassbookStatementImport');
const { PassbookReservation } = require('../models/PassbookReservation');
const { PassbookMapping } = require('../models/PassbookMapping');

async function seedPassbookData() {
  await connectDatabase({ uri: process.env.MONGODB_URI });
  console.log('Seeding Passbook & Treasury initial dataset...');

  const org = 'ZAMORIN';

  // Check if accounts already exist
  const existingCount = await PassbookAccount.countDocuments({ organisationId: org });
  if (existingCount > 0) {
    console.log(`Passbook accounts already seeded (${existingCount} found). Skipping creation.`);
    await disconnectDatabase();
    return;
  }

  // 1. Create Core Treasury Accounts
  const accountsData = [
    {
      accountId: 'PBK-ACC-202608-0001',
      accountCode: 'ACC-HDFC-MAIN',
      accountName: 'HDFC Bank — Main Treasury Current Account',
      nickname: 'HDFC Main',
      accountType: 'BANK_OPERATING',
      bankSubtype: 'CURRENT',
      scopeType: 'ORGANISATION_GLOBAL',
      assignedCafeIds: ['CF-INDIRANAGAR', 'CF-KORAMANGALA'],
      primaryCafeId: null,
      institutionName: 'HDFC Bank Ltd.',
      branchName: 'Koramangala 5th Block',
      maskedAccountNumber: '••••4821',
      ifscCode: 'HDFC0000287',
      bookBalancePaisa: 284500000, // ₹28,45,000.00
      verifiedStatementBalancePaisa: 284500000,
      reservedPaisa: 50000000, // ₹5,00,000.00
      freeBalancePaisa: 234500000, // ₹23,45,000.00
      openingDate: '2026-04-01',
      openingBalancePaisa: 250000000,
      purpose: 'CENTRAL_TREASURY',
      isPinned: true,
      lastReconciledDate: '2026-08-15',
      createdBy: 'PRIMARY_MASTER',
    },
    {
      accountId: 'PBK-ACC-202608-0002',
      accountCode: 'ACC-ICICI-OPS',
      accountName: 'ICICI Bank — Indiranagar Operating Account',
      nickname: 'ICICI Indiranagar',
      accountType: 'BANK_OPERATING',
      bankSubtype: 'CURRENT',
      scopeType: 'CAFE_SPECIFIC',
      assignedCafeIds: ['CF-INDIRANAGAR'],
      primaryCafeId: 'CF-INDIRANAGAR',
      institutionName: 'ICICI Bank',
      branchName: '100ft Road, Indiranagar',
      maskedAccountNumber: '••••7912',
      ifscCode: 'ICIC0001048',
      bookBalancePaisa: 62000000, // ₹6,20,000.00
      verifiedStatementBalancePaisa: 61850000, // ₹6,18,500.00 (₹1,500 diff)
      reservedPaisa: 12000000, // ₹1,20,000.00
      freeBalancePaisa: 50000000,
      openingDate: '2026-04-01',
      openingBalancePaisa: 50000000,
      purpose: 'OPERATING',
      isPinned: true,
      lastReconciledDate: '2026-08-10',
      createdBy: 'PRIMARY_MASTER',
    },
    {
      accountId: 'PBK-ACC-202608-0003',
      accountCode: 'ACC-AXIS-KORM',
      accountName: 'Axis Bank — Koramangala Operating Account',
      nickname: 'Axis Koramangala',
      accountType: 'BANK_OPERATING',
      bankSubtype: 'CURRENT',
      scopeType: 'CAFE_SPECIFIC',
      assignedCafeIds: ['CF-KORAMANGALA'],
      primaryCafeId: 'CF-KORAMANGALA',
      institutionName: 'Axis Bank',
      branchName: '80ft Road, Koramangala',
      maskedAccountNumber: '••••3390',
      ifscCode: 'UTIB0000452',
      bookBalancePaisa: 41500000, // ₹4,15,000.00
      verifiedStatementBalancePaisa: 41500000,
      reservedPaisa: 0,
      freeBalancePaisa: 41500000,
      openingDate: '2026-04-01',
      openingBalancePaisa: 30000000,
      purpose: 'OPERATING',
      isPinned: false,
      lastReconciledDate: '2026-08-18',
      createdBy: 'PRIMARY_MASTER',
    },
    {
      accountId: 'PBK-ACC-202608-0004',
      accountCode: 'ACC-CASH-IND',
      accountName: 'Physical Cash Drawer — Indiranagar Café',
      nickname: 'Indiranagar Till Float',
      accountType: 'CASH_IN_HAND',
      bankSubtype: 'NOT_APPLICABLE',
      scopeType: 'CAFE_SPECIFIC',
      assignedCafeIds: ['CF-INDIRANAGAR'],
      primaryCafeId: 'CF-INDIRANAGAR',
      institutionName: 'In-Café Vault',
      maskedAccountNumber: 'VAULT-IND',
      bookBalancePaisa: 3500000, // ₹35,000.00
      verifiedStatementBalancePaisa: 3500000,
      reservedPaisa: 0,
      freeBalancePaisa: 3500000,
      openingDate: '2026-04-01',
      openingBalancePaisa: 2500000,
      purpose: 'TILL_FLOAT',
      imprestLimitPaisa: 5000000,
      lastReconciledDate: '2026-08-24',
      createdBy: 'PRIMARY_MASTER',
    },
    {
      accountId: 'PBK-ACC-202608-0005',
      accountCode: 'ACC-PETTY-KORM',
      accountName: 'Petty Cash Float — Koramangala Café',
      nickname: 'Koramangala Petty Cash',
      accountType: 'PETTY_CASH',
      bankSubtype: 'NOT_APPLICABLE',
      scopeType: 'CAFE_SPECIFIC',
      assignedCafeIds: ['CF-KORAMANGALA'],
      primaryCafeId: 'CF-KORAMANGALA',
      institutionName: 'In-Café Safe',
      maskedAccountNumber: 'PETTY-KORM',
      bookBalancePaisa: 1500000, // ₹15,000.00
      verifiedStatementBalancePaisa: 1500000,
      reservedPaisa: 0,
      freeBalancePaisa: 1500000,
      openingDate: '2026-04-01',
      openingBalancePaisa: 2000000,
      purpose: 'PETTY_CASH',
      imprestLimitPaisa: 2000000,
      lastReconciledDate: '2026-08-20',
      createdBy: 'PRIMARY_MASTER',
    },
  ];

  await PassbookAccount.insertMany(accountsData);
  console.log(`Seeded ${accountsData.length} Passbook accounts.`);

  // 2. Create Sample Authoritative Transactions
  const txns = [
    {
      transactionId: 'PBK-202608-0001',
      organisationId: org,
      accountId: 'PBK-ACC-202608-0001',
      postingSequence: 1,
      businessDate: '2026-08-01',
      postingDate: '2026-08-01',
      valueDate: '2026-08-01',
      type: 'OPENING_BALANCE',
      direction: 'CREDIT',
      amountPaisa: 250000000,
      runningBalancePaisa: 250000000,
      currency: 'INR',
      paymentMode: 'BANK_TRANSFER',
      narration: 'Opening balance FY 2026-27 carry forward',
      category: 'OPENING_POSITION',
      sourceType: 'MIGRATED',
      economicCafeId: 'ALL',
      reconciliationStatus: 'CONFIRMED',
      status: 'POSTED',
      createdBy: 'PRIMARY_MASTER',
    },
    {
      transactionId: 'PBK-202608-0002',
      organisationId: org,
      accountId: 'PBK-ACC-202608-0001',
      postingSequence: 2,
      businessDate: '2026-08-05',
      postingDate: '2026-08-05',
      valueDate: '2026-08-05',
      type: 'EXTERNAL_INCOME',
      direction: 'CREDIT',
      amountPaisa: 45000000, // ₹4,50,000.00
      runningBalancePaisa: 295000000,
      currency: 'INR',
      paymentMode: 'NEFT',
      remitter: 'Pine Labs Merchant Settlement',
      externalReference: 'UTR-PINELABS-98124',
      narration: 'Consolidated POS Card Settlement for July W4',
      category: 'MERCHANT_SETTLEMENT',
      sourceType: 'MANUAL',
      economicCafeId: 'ALL',
      allocations: [
        { cafeId: 'CF-INDIRANAGAR', amountPaisa: 25000000, percentage: 55.56 },
        { cafeId: 'CF-KORAMANGALA', amountPaisa: 20000000, percentage: 44.44 },
      ],
      reconciliationStatus: 'MATCHED',
      status: 'POSTED',
      createdBy: 'PRIMARY_MASTER',
    },
    {
      transactionId: 'PBK-202608-0003',
      organisationId: org,
      accountId: 'PBK-ACC-202608-0001',
      postingSequence: 3,
      businessDate: '2026-08-10',
      postingDate: '2026-08-10',
      valueDate: '2026-08-10',
      type: 'EXTERNAL_EXPENSE',
      direction: 'DEBIT',
      amountPaisa: 10500000, // ₹1,05,000.00
      runningBalancePaisa: 284500000,
      currency: 'INR',
      paymentMode: 'RTGS',
      beneficiary: 'Blue Tokai Coffee Roasters Supply Co.',
      externalReference: 'RTGS-BT-20260810-09',
      narration: 'Speciality Green Bean Procurement Batch #489',
      category: 'SUPPLIER_PAYMENT',
      sourceType: 'BILL',
      economicCafeId: 'ALL',
      reconciliationStatus: 'MATCHED',
      status: 'POSTED',
      createdBy: 'PRIMARY_MASTER',
    },
  ];

  await PassbookTransaction.insertMany(txns);
  console.log(`Seeded ${txns.length} Passbook transactions.`);

  // 3. Create Sample Reservations
  await PassbookReservation.create({
    reservationId: 'RES-202608-0001',
    organisationId: org,
    accountId: 'PBK-ACC-202608-0001',
    cafeId: 'ALL',
    title: 'August 2026 Staff Payroll Commitment',
    purpose: 'PAYROLL',
    amountPaisa: 50000000, // ₹5,00,000.00
    effectiveDate: '2026-08-01',
    expiryDate: '2026-08-31',
    status: 'ACTIVE',
    notes: 'Committed liquidity for month-end payroll batch release.',
    createdBy: 'PRIMARY_MASTER',
  });

  // 4. Create Sample Café Mappings
  const mappings = [
    {
      mappingId: 'MAP-001',
      organisationId: org,
      cafeId: 'CF-INDIRANAGAR',
      channel: 'POS_CASH',
      accountId: 'PBK-ACC-202608-0004',
      isDefault: true,
      effectiveFrom: '2026-04-01',
    },
    {
      mappingId: 'MAP-002',
      organisationId: org,
      cafeId: 'CF-INDIRANAGAR',
      channel: 'UPI_SETTLEMENT',
      accountId: 'PBK-ACC-202608-0002',
      isDefault: true,
      effectiveFrom: '2026-04-01',
    },
    {
      mappingId: 'MAP-003',
      organisationId: org,
      cafeId: 'CF-KORAMANGALA',
      channel: 'POS_CASH',
      accountId: 'PBK-ACC-202608-0005',
      isDefault: true,
      effectiveFrom: '2026-04-01',
    },
    {
      mappingId: 'MAP-004',
      organisationId: org,
      cafeId: 'CF-KORAMANGALA',
      channel: 'UPI_SETTLEMENT',
      accountId: 'PBK-ACC-202608-0003',
      isDefault: true,
      effectiveFrom: '2026-04-01',
    },
  ];

  await PassbookMapping.insertMany(mappings);
  console.log(`Seeded ${mappings.length} Passbook café mappings.`);

  await disconnectDatabase();
  console.log('Passbook seeding completed successfully!');
}

if (require.main === module) {
  seedPassbookData().catch(console.error);
}

module.exports = { seedPassbookData };
