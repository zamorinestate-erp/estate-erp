'use strict';

const { Cafe } = require('../models/Cafe');
const { User } = require('../models/User');
const { Vendor } = require('../models/Vendor');
const { Asset } = require('../models/Asset');
const { BusinessDocument } = require('../models/BusinessDocument');
const { Notification } = require('../models/Notification');

const ALERT_BUCKETS_DAYS = [90, 60, 30, 15, 7, 0]; // 0 or negative = OVERDUE

class ExpiryRenewalService {
  /**
   * Evaluates days remaining and assigns the exact alert bucket:
   * '90_DAYS', '60_DAYS', '30_DAYS', '15_DAYS', '7_DAYS', 'OVERDUE'
   */
  static getAlertBucket(expiryDate, referenceDate = new Date()) {
    if (!expiryDate) return null;
    const exp = new Date(expiryDate);
    if (isNaN(exp.getTime())) return null;

    const diffMs = exp.getTime() - referenceDate.getTime();
    const daysRemaining = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

    if (daysRemaining < 0) {
      return { bucket: 'OVERDUE', daysRemaining, severity: 'CRITICAL' };
    }
    if (daysRemaining <= 7) {
      return { bucket: '7_DAYS', daysRemaining, severity: 'HIGH' };
    }
    if (daysRemaining <= 15) {
      return { bucket: '15_DAYS', daysRemaining, severity: 'HIGH' };
    }
    if (daysRemaining <= 30) {
      return { bucket: '30_DAYS', daysRemaining, severity: 'MEDIUM' };
    }
    if (daysRemaining <= 60) {
      return { bucket: '60_DAYS', daysRemaining, severity: 'LOW' };
    }
    if (daysRemaining <= 90) {
      return { bucket: '90_DAYS', daysRemaining, severity: 'INFO' };
    }
    return null; // More than 90 days away
  }

  static resolveAlertBucket(expiryDate, referenceDate = new Date()) {
    const res = this.getAlertBucket(expiryDate, referenceDate);
    if (!res) return null;
    return res.bucket === 'OVERDUE' ? 'OVERDUE' : `EXPIRING_${res.bucket}`;
  }

  /**
   * Scans all compliance, asset, vendor, employee, and business document records
   * for upcoming or overdue expiries.
   */
  static async scanAllExpiries({ organisationId, cafeId = null }) {
    const orgId = String(organisationId || '').trim().toUpperCase();
    const expiries = [];
    const now = new Date();

    // 1. Café FSSAI & Trade Licences
    const cafeQuery = { organisationId: orgId, status: { $ne: 'ARCHIVED' } };
    if (cafeId && cafeId !== 'ALL') cafeQuery.cafeId = cafeId;
    const cafes = await Cafe.find(cafeQuery).lean();

    // 1. Café Statutory: FSSAI, Trade Licences, Fire NOC, Water Testing, Pest Control, Calibration, Lease, Vehicle
    for (const c of cafes) {
      const checkExpiryItem = (date, entityType, title, docNum, owner = 'CAFE_ADMIN') => {
        if (!date) return;
        const bucket = this.getAlertBucket(date, now);
        if (bucket) {
          expiries.push({
            domain: 'COMPLIANCE',
            entityType,
            entityId: c.cafeId,
            title: `${title} — ${c.name}`,
            documentNumber: docNum || 'N/A',
            expiryDate: date,
            daysRemaining: bucket.daysRemaining,
            bucket: bucket.bucket,
            severity: bucket.severity,
            renewalOwner: owner,
            cafeId: c.cafeId,
          });
        }
      };

      if (c.fssaiDetails?.expiryDate) {
        checkExpiryItem(c.fssaiDetails.expiryDate, 'CAFE_FSSAI', 'FSSAI Food Licence Expiry', c.fssaiDetails.licenceNumber);
      }
      if (c.fireNocDetails?.validTill) {
        checkExpiryItem(c.fireNocDetails.validTill, 'FIRE_NOC', 'Fire NOC Expiry', c.fireNocDetails.certificateNumber);
      }
      if (c.waterTestingDetails?.validTill) {
        checkExpiryItem(c.waterTestingDetails.validTill, 'WATER_TESTING', 'Water Testing Lab Report Expiry', c.waterTestingDetails.reportNumber);
      }
      if (c.pestControlDetails?.validTill) {
        checkExpiryItem(c.pestControlDetails.validTill, 'PEST_CONTROL', 'Pest Control Certificate Expiry', c.pestControlDetails.certificateNumber);
      }
      if (c.calibrationDetails?.validTill) {
        checkExpiryItem(c.calibrationDetails.validTill, 'CALIBRATION', 'Equipment Calibration Certificate Expiry', c.calibrationDetails.certificateNumber);
      }
      if (c.leaseDetails?.validTill) {
        checkExpiryItem(c.leaseDetails.validTill, 'LEASE_AGREEMENT', 'Commercial Lease Agreement Expiry', c.leaseDetails.agreementNumber, 'OWNER');
      }
      if (c.vehicleDetails?.validTill) {
        checkExpiryItem(c.vehicleDetails.validTill, 'VEHICLE_COMPLIANCE', 'Delivery Vehicle Fitness & Insurance Expiry', c.vehicleDetails.registrationNumber);
      }

      if (Array.isArray(c.tradeLicences)) {
        for (const lic of c.tradeLicences) {
          if (lic.validTill) {
            checkExpiryItem(lic.validTill, 'TRADE_LICENCE', `${lic.licenceType || 'Trade Licence'} Expiry`, lic.licenceNumber);
          }
        }
      }
    }

    // 2. Employee Certifications & Health/Fitness
    const empQuery = { organisationId: orgId, accountStatus: 'ACTIVE' };
    if (cafeId && cafeId !== 'ALL') {
      empQuery.$or = [{ primaryCafeId: cafeId }, { assignedCafeIds: cafeId }];
    }
    const employees = await User.find(empQuery).select('userId name primaryCafeId complianceDocs certifications healthFitnessDocuments').lean();

    for (const emp of employees) {
      if (Array.isArray(emp.certifications)) {
        for (const cert of emp.certifications) {
          if (cert.validUntil) {
            const bucket = this.getAlertBucket(cert.validUntil, now);
            if (bucket) {
              expiries.push({
                domain: 'EMPLOYEE',
                entityType: 'EMPLOYEE_CERTIFICATION',
                entityId: emp.userId,
                title: `Staff Certification: ${cert.title || 'Certificate'} — ${emp.name}`,
                documentNumber: cert.certificateNumber || 'CERT-N/A',
                expiryDate: cert.validUntil,
                daysRemaining: bucket.daysRemaining,
                bucket: bucket.bucket,
                severity: bucket.severity,
                renewalOwner: emp.userId,
                cafeId: emp.primaryCafeId,
              });
            }
          }
        }
      }

      const healthDocs = emp.healthFitnessDocuments || emp.complianceDocs || [];
      if (Array.isArray(healthDocs)) {
        for (const doc of healthDocs) {
          const expDate = doc.validTill || doc.expiresAt;
          if (expDate) {
            const bucket = this.getAlertBucket(expDate, now);
            if (bucket) {
              expiries.push({
                domain: 'EMPLOYEE',
                entityType: 'EMPLOYEE_HEALTH_FITNESS',
                entityId: emp.userId,
                title: `Staff Medical/Fitness Fitness: ${doc.title || 'Health Cert'} — ${emp.name}`,
                documentNumber: doc.documentNumber || 'MED-N/A',
                expiryDate: expDate,
                daysRemaining: bucket.daysRemaining,
                bucket: bucket.bucket,
                severity: bucket.severity,
                renewalOwner: emp.userId,
                cafeId: emp.primaryCafeId,
              });
            }
          }
        }
      }
    }

    // 3. Asset Warranties & AMCs
    try {
      const assetQuery = { organisationId: orgId, status: { $ne: 'DISPOSED' } };
      if (cafeId && cafeId !== 'ALL') assetQuery.cafeId = cafeId;
      const assets = await Asset.find(assetQuery).select('assetId name cafeId warranty amc').lean();

      for (const a of assets) {
        if (a.warranty?.expiresAt) {
          const bucket = this.getAlertBucket(a.warranty.expiresAt, now);
          if (bucket) {
            expiries.push({
              domain: 'ASSET',
              entityType: 'ASSET_WARRANTY',
              entityId: a.assetId,
              title: `Warranty Expiry — ${a.name} (${a.assetId})`,
              documentNumber: a.warranty.policyNumber || 'WAR-N/A',
              expiryDate: a.warranty.expiresAt,
              daysRemaining: bucket.daysRemaining,
              bucket: bucket.bucket,
              severity: bucket.severity,
              renewalOwner: 'OPERATIONS',
              cafeId: a.cafeId,
            });
          }
        }
        if (a.amc?.expiresAt) {
          const bucket = this.getAlertBucket(a.amc.expiresAt, now);
          if (bucket) {
            expiries.push({
              domain: 'ASSET',
              entityType: 'ASSET_AMC',
              entityId: a.assetId,
              title: `AMC Maintenance Contract Expiry — ${a.name}`,
              documentNumber: a.amc.contractNumber || 'AMC-N/A',
              expiryDate: a.amc.expiresAt,
              daysRemaining: bucket.daysRemaining,
              bucket: bucket.bucket,
              severity: bucket.severity,
              renewalOwner: 'OPERATIONS',
              cafeId: a.cafeId,
            });
          }
        }
      }
    } catch {}

    // 4. Supplier Licences & Certificates
    try {
      const vendors = await Vendor.find({ organisationId: orgId, status: { $ne: 'ARCHIVED' } }).lean();
      for (const v of vendors) {
        if (Array.isArray(v.certificates)) {
          for (const cert of v.certificates) {
            if (cert.validTill) {
              const bucket = this.getAlertBucket(cert.validTill, now);
              if (bucket) {
                expiries.push({
                  domain: 'SUPPLIER',
                  entityType: 'SUPPLIER_CERTIFICATE',
                  entityId: v.vendorId,
                  title: `Supplier Certificate: ${cert.title || 'Licence'} — ${v.name}`,
                  documentNumber: cert.number || 'CERT-N/A',
                  expiryDate: cert.validTill,
                  daysRemaining: bucket.daysRemaining,
                  bucket: bucket.bucket,
                  severity: bucket.severity,
                  renewalOwner: 'PROCUREMENT',
                  cafeId: null,
                });
              }
            }
          }
        }
      }
    } catch {}

    // 5. Generic & Compliance Business Documents with recorded expiration
    const docQuery = {
      organisationId: orgId,
      isDeleted: false,
      $or: [
        { expiryDate: { $ne: null } },
        { invoiceDate: { $ne: null } },
      ],
    };
    if (cafeId && cafeId !== 'ALL') docQuery.cafeId = cafeId;
    const docs = await BusinessDocument.find(docQuery)
      .select('documentId documentNumber documentType entityName cafeId relatedModule invoiceDate expiryDate renewalOwner supersededBy')
      .lean();

    for (const doc of docs) {
      if (doc.supersededBy) continue; // Superseded documents are ignored
      const effectiveExpiry = doc.expiryDate || doc.invoiceDate;
      if (effectiveExpiry) {
        const bucket = this.getAlertBucket(effectiveExpiry, now);
        if (bucket) {
          expiries.push({
            domain: doc.relatedModule || 'COMPLIANCE',
            entityType: doc.documentType || 'BUSINESS_DOCUMENT',
            entityId: doc.documentId,
            title: `${doc.documentType}: ${doc.documentNumber || doc.documentId} (${doc.entityName || 'Entity'})`,
            documentNumber: doc.documentNumber || doc.documentId,
            expiryDate: effectiveExpiry,
            daysRemaining: bucket.daysRemaining,
            bucket: bucket.bucket,
            severity: bucket.severity,
            renewalOwner: doc.renewalOwner || 'MASTER',
            cafeId: doc.cafeId,
          });
        }
      }
    }

    // Sort by most urgent / overdue first
    expiries.sort((a, b) => a.daysRemaining - b.daysRemaining);

    return {
      organisationId: orgId,
      scannedAt: now,
      totalExpiries: expiries.length,
      overdueCount: expiries.filter((e) => e.daysRemaining < 0).length,
      criticalCount: expiries.filter((e) => e.severity === 'CRITICAL').length,
      highCount: expiries.filter((e) => e.severity === 'HIGH').length,
      expiries,
    };
  }

  /**
   * Dispatches notifications for upcoming expiries without duplicate alert spam.
   */
  static async dispatchExpiryNotifications({ organisationId, expiries = [] }) {
    let created = 0;
    const now = new Date();

    for (const item of expiries) {
      const alertKey = `EXPIRY-${item.entityId}-${item.bucket}-${now.toISOString().slice(0, 10)}`;

      // Check if notification already dispatched today for this entity & bucket
      const existing = await Notification.findOne({
        organisationId,
        $or: [
          { 'metadata.alertKey': alertKey },
          {
            entityId: item.entityId,
            category: 'COMPLIANCE_EXPIRY',
            priority: item.severity === 'CRITICAL' ? 'CRITICAL' : 'HIGH',
            createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
          },
        ],
      });

      if (!existing) {
        await Notification.create({
          notificationId: `NOTIF-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
          organisationId,
          cafeId: item.cafeId || null,
          title: item.daysRemaining < 0 ? `🚨 OVERDUE: ${item.title}` : `⚠️ Expiry Warning: ${item.title}`,
          message: item.daysRemaining < 0
            ? `Expired ${Math.abs(item.daysRemaining)} days ago on ${new Date(item.expiryDate).toLocaleDateString()}. Immediate renewal required.`
            : `Expires in ${item.daysRemaining} days (${new Date(item.expiryDate).toLocaleDateString()}). Schedule renewal promptly.`,
          category: 'COMPLIANCE_EXPIRY',
          priority: item.severity === 'CRITICAL' ? 'CRITICAL' : item.severity === 'HIGH' ? 'HIGH' : 'MEDIUM',
          entityType: item.entityType,
          entityId: item.entityId,
          deepLink: `/compliance`,
          metadata: { alertKey, bucket: item.bucket, daysRemaining: item.daysRemaining },
          recipientRoles: ['MASTER', 'OWNER', 'CAFE_ADMIN'],
        }).catch(() => {});
        created++;
      }
    }

    return { dispatchedCount: created };
  }
}

module.exports = {
  ExpiryRenewalService,
  ALERT_BUCKETS_DAYS,
};
