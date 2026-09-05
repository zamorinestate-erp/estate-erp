'use strict';

/**
 * ZAMORIN CAFÉ ERP — IDEMPOTENT CAFÉ ACCESS BACKFILL SCRIPT
 *
 * Scans all existing Cafés in MongoDB and ensures each has an authoritative
 * CafeAccess credential record and CafePinReservation tombstone.
 *
 * Safe for repeated runs (idempotent).
 * Supports --dry-run to preview actions without committing changes.
 *
 * Usage:
 *   node src/scripts/backfillCafeAccess.js [--dry-run]
 */

const dns = require('dns');
dns.setDefaultResultOrder('ipv4first');

const mongoose = require('mongoose');
const { connectDatabase } = require('../config/database');
const { Cafe } = require('../models/Cafe');
const { CafeAccess } = require('../models/CafeAccess');
const { CafePinReservation } = require('../models/CafePinReservation');
const cafeAccessCryptoService = require('../services/cafeAccessCryptoService');

async function main() {
  const isDryRun = process.argv.includes('--dry-run');
  console.log(`[BACKFILL] Starting CafeAccess Migration & Backfill (Dry Run: ${isDryRun})...`);

  // Ensure fail-fast crypto keys are validated
  cafeAccessCryptoService.verifySecretKeys();

  const uri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/zamorin_cafe_erp';
  await connectDatabase({ uri });
  console.log('[BACKFILL] Connected to MongoDB.');

  const allCafes = await Cafe.find({}).lean();
  console.log(`[BACKFILL] Found ${allCafes.length} total cafés in database.`);

  let provisionedCount = 0;
  let alreadyPresentCount = 0;
  let skippedCount = 0;

  for (const cafe of allCafes) {
    const orgId = (cafe.organisationId || 'ZAMORIN').toUpperCase();
    const cafeId = cafe.cafeId;

    if (!cafeId) {
      console.warn(`[BACKFILL] Skipping cafe document with missing cafeId (_id: ${cafe._id})`);
      skippedCount++;
      continue;
    }

    // Check if CafeAccess record already exists
    const existing = await CafeAccess.findOne({ organisationId: orgId, cafeId });
    if (existing) {
      alreadyPresentCount++;
      continue;
    }

    console.log(`[BACKFILL] Provisioning CafeAccess for ${cafeId} (${cafe.name || 'Unnamed'})...`);

    // Generate unique permanent PIN
    let permanentPin = '';
    let pinLookupHash = '';
    let attempts = 0;

    while (attempts < 50) {
      attempts++;
      permanentPin = cafeAccessCryptoService.generateRandom6DigitPin();
      pinLookupHash = cafeAccessCryptoService.computePinLookupHash(permanentPin);

      // Check reservation
      const reserved = await CafePinReservation.findOne({ pinLookupHash });
      if (!reserved) break;
    }

    if (attempts >= 50) {
      throw new Error(`Failed to generate unique permanent PIN for ${cafeId} after 50 attempts.`);
    }

    const permanentCafePinEncrypted = cafeAccessCryptoService.encryptPin(permanentPin);
    const qrToken = cafeAccessCryptoService.generateHighEntropyToken(32);
    const qrCredentialHash = cafeAccessCryptoService.computeTokenHash(qrToken);
    const qrCredentialPrefix = qrToken.slice(0, 8);

    const linkToken = cafeAccessCryptoService.generateHighEntropyToken(32);
    const linkCredentialHash = cafeAccessCryptoService.computeTokenHash(linkToken);
    const linkCredentialPrefix = linkToken.slice(0, 8);

    const maskedPin = `***${permanentPin.slice(-3)}`;

    if (isDryRun) {
      console.log(`  [DRY RUN] Would provision ${cafeId}: Masked PIN: ${maskedPin}, QR Prefix: ${qrCredentialPrefix}, Link Prefix: ${linkCredentialPrefix}`);
      provisionedCount++;
    } else {
      // Create reservation first (defense against collision)
      await CafePinReservation.create({
        pinLookupHash,
        organisationId: orgId,
        cafeId,
        reservedAt: new Date(),
        status: 'ACTIVE',
      });

      // Create CafeAccess
      await CafeAccess.create({
        organisationId: orgId,
        cafeId,
        permanentCafePinEncrypted,
        permanentCafePinLookupHash: pinLookupHash,
        permanentCafePinCreatedBy: 'MIGRATION_BACKFILL',
        permanentCafePinCreatedAt: new Date(),
        qrCredentialHash,
        qrCredentialPrefix,
        qrCredentialRotatedAt: new Date(),
        linkCredentialHash,
        linkCredentialPrefix,
        linkCredentialRotatedAt: new Date(),
        provisioningStatus: 'READY',
        emergencyLock: { isLocked: false },
      });

      console.log(`  [LIVE] Successfully provisioned ${cafeId}: Masked PIN: ${maskedPin}, QR Prefix: ${qrCredentialPrefix}, Link Prefix: ${linkCredentialPrefix}`);
      provisionedCount++;
    }
  }

  console.log('\n============================================================');
  console.log('CAFÉ ACCESS BACKFILL SUMMARY');
  console.log('============================================================');
  console.log(`Total Cafés Scanned   : ${allCafes.length}`);
  console.log(`Already Provisioned   : ${alreadyPresentCount}`);
  console.log(`Newly Provisioned     : ${provisionedCount} ${isDryRun ? '(DRY RUN)' : ''}`);
  console.log(`Skipped / Invalid     : ${skippedCount}`);
  console.log('============================================================\n');

  await mongoose.disconnect();
  console.log('[BACKFILL] Completed successfully.');
}

if (require.main === module) {
  main().catch((err) => {
    console.error('[BACKFILL FATAL ERROR]', err);
    process.exit(1);
  });
}

module.exports = { main };
