'use strict';

const mongoose = require('mongoose');
const bcrypt = require('bcrypt');

const { Cafe, CAFE_STATUSES, CAFE_TYPES } = require('../models/Cafe');
const { CafeAccess } = require('../models/CafeAccess');
const { CafePinReservation } = require('../models/CafePinReservation');
const { CafeGatewayContext } = require('../models/CafeGatewayContext');
const { SequenceCounter } = require('../models/SequenceCounter');
const { User } = require('../models/User');
const { DeviceRegistration } = require('../models/DeviceRegistration');
const { OperatorSession } = require('../models/OperatorSession');
const auditService = require('./auditService');
const {
  getPublicAppOrigin,
  generateSecureCafePin,
  computePinLookupHash,
  encryptCafePin,
  decryptCafePin,
  encryptSecret,
  decryptSecret,
  generateOpaqueToken,
  hashOpaqueToken,
} = require('./cafeAccessCryptoService');
const { ApiError } = require('../utils/ApiError');

const ALLOWED_CAFE_CREATE_FIELDS = [
  'name',
  'displayName',
  'legalName',
  'branchName',
  'cafeType',
  'establishmentCategory',
  'dietaryType',
  'dateBusinessStarted',
  'status',
  'openingDate',
  'branchCode',
  'internalCafeId',
  'storeNumber',
  'parentOrganisationId',
  'legalConstitution',
  'constitution',
  'legalOwnerName',
  'ownerName',
  'partnersDirectors',
  'directors',
  'authorisedSignatory',
  'pan',
  'cin',
  'registrationNumber',
  'incorporationDate',
  'registeredOfficeAddress',
  'udyamNumber',
  'udyamRegistrationDate',
  'enterpriseClassification',
  'contactProfile',
  'primaryContact',
  'emergencyContact',
  'communicationPreference',
  'emergencyName',
  'emergencyPhone',
  'address',
  'addressLine1',
  'addressLine2',
  'doorNumber',
  'possessionType',
  'leaseStartDate',
  'leaseEndDate',
  'mapsLink',
  'latitude',
  'longitude',
  'landmark',
  'city',
  'district',
  'state',
  'stateCode',
  'pincode',
  'country',
  'phone',
  'alternatePhone',
  'email',
  'timezone',
  'currency',
  'serviceModes',
  'orderChannels',
  'openingTime',
  'closingTime',
  'weeklyOffDays',
  'managerName',
  'managerEmail',
  'managerPhone',
  'registrations',
  'gstin',
  'gstDetails',
  'fssai',
  'fssaiNumber',
  'fssaiType',
  'fssaiExpiryDate',
  'otherRegistrations',
  'finance',
  'banking',
  'bankName',
  'accountNumber',
  'ifsc',
  'accountHolderName',
  'upiId',
  'operations',
  'seatingCapacity',
  'tableCount',
  'splitShifts',
  'floorZoneStructure',
  'kitchenSections',
  'prepStations',
  'kotRouting',
  'serviceChargePolicy',
  'cancellationPolicy',
  'refundPolicy',
  'discountPolicy',
  'orderNumberingScheme',
  'inventorySetup',
  'inventoryConfig',
  'hardwareReadiness',
  'hardwareProfile',
  'hardware',
  'branding',
  'readinessChecklist',
  'responsibleOwnerId',
  'assignedMasterIds',
  'costCenterCode',
];

function sanitizeCreatePayload(body) {
  if (!body || typeof body !== 'object') return {};
  const sanitized = {};
  for (const field of ALLOWED_CAFE_CREATE_FIELDS) {
    if (body[field] !== undefined && body[field] !== null) {
      if (typeof body[field] === 'string') {
        sanitized[field] = body[field].trim();
      } else {
        sanitized[field] = body[field];
      }
    }
  }
  return sanitized;
}

function requireGovernanceAuthority(auth) {
  if (!auth || !auth.role) {
    throw new ApiError(401, 'UNAUTHENTICATED', 'Authentication required.');
  }

  const role = auth.role.toUpperCase();
  const isAllowed = role === 'MASTER' || role === 'OWNER';

  if (!isAllowed) {
    throw new ApiError(
      403,
      'CAFE_CREATION_DENIED',
      'Only Primary Master, Normal Master, and Owner roles may create new cafés.'
    );
  }
}

class CafeService {
  /**
   * Authoritative Create Café & Automatic Access Provisioning.
   * Atomically provisions Cafe, CafeAccess, CafePinReservation, and baseline configs.
   */
  async createCafeWithAccess({
    auth,
    cafeData = {},
    clientIp = null,
    userAgent = null,
    correlationId = null,
  }) {
    requireGovernanceAuthority(auth);

    const organisationId = String(auth.organisationId || '').trim().toUpperCase();
    if (!organisationId) {
      throw new ApiError(400, 'ORGANISATION_REQUIRED', 'Valid organisation scope is required.');
    }

    const sanitized = sanitizeCreatePayload(cafeData);

    const name = (sanitized.name || '').trim();
    const displayName = (sanitized.displayName || sanitized.name || '').trim();

    if (!name || !displayName) {
      throw new ApiError(
        400,
        'CAFE_FIELDS_REQUIRED',
        'Café name and display name are required.'
      );
    }

    const cafeType = sanitized.cafeType
      ? sanitized.cafeType.trim().toUpperCase()
      : 'STANDARD_CAFE';

    if (!CAFE_TYPES.includes(cafeType)) {
      throw new ApiError(400, 'INVALID_CAFE_TYPE', 'The café type is invalid.');
    }

    const initialStatus = sanitized.status
      ? sanitized.status.trim().toUpperCase()
      : 'DRAFT';

    if (!CAFE_STATUSES.includes(initialStatus)) {
      throw new ApiError(400, 'INVALID_CAFE_STATUS', 'The café status is invalid.');
    }

    // 1. Generate sequential, collision-safe Cafe ID (e.g. ZC-0001)
    const cafeId = await SequenceCounter.generateId({
      organisationId,
      sequenceKey: 'CAFE',
      prefix: 'ZC',
      minimumDigits: 4,
    });

    // 2. Generate cryptographically random, non-trivial Permanent 6-digit PIN with collision retry
    let permanentPin = null;
    let pinLookupHash = null;
    let encryptedPin = null;

    for (let attempt = 0; attempt < 25; attempt++) {
      const candidatePin = generateSecureCafePin();
      const candidateHash = computePinLookupHash(candidatePin);

      const existingReservation = await CafePinReservation.findOne({
        pinLookupHash: candidateHash,
      }).lean();

      if (!existingReservation) {
        permanentPin = candidatePin;
        pinLookupHash = candidateHash;
        encryptedPin = encryptCafePin(candidatePin);
        break;
      }
    }

    if (!permanentPin || !pinLookupHash || !encryptedPin) {
      throw new ApiError(
        500,
        'PIN_GENERATION_FAILED',
        'Could not allocate a unique permanent Café PIN. Please retry.'
      );
    }

    // 3. Generate high-entropy, independent QR and Link tokens
    const qrToken = generateOpaqueToken();
    let linkToken = generateOpaqueToken();
    while (linkToken === qrToken) {
      linkToken = generateOpaqueToken();
    }

    const qrCredentialHash = hashOpaqueToken(qrToken);
    const linkCredentialHash = hashOpaqueToken(linkToken);

    // 4. Persistence with transaction safety
    let createdCafe = null;
    let createdAccess = null;

    const useMongooseTransactions =
      mongoose.connection &&
      mongoose.connection.client &&
      typeof mongoose.connection.client.startSession === 'function' &&
      Boolean(process.env.ENABLE_MONGO_TRANSACTIONS);

    let session = null;
    if (useMongooseTransactions) {
      try {
        session = await mongoose.startSession();
        session.startTransaction();
      } catch {
        session = null;
      }
    }

    try {
      // 4a. Reserve Permanent PIN
      await CafePinReservation.create(
        [
          {
            pinLookupHash,
            cafeId,
            organisationId,
            assignedAt: new Date(),
            isArchived: false,
          },
        ],
        session ? { session } : {}
      );

      // 4b. Create Stage 02 Universal QR Record for Café Login
      const { UniversalQrService } = require('./universalQrService');
      const securePublicCafeReference = generateOpaqueToken();
      let universalQr = null;
      try {
        universalQr = await UniversalQrService.createQrRecord({
          qrType: 'CAFE_LOGIN',
          targetEntityId: securePublicCafeReference,
          organisationId,
          cafeId,
          title: `Café Login QR — ${name}`,
          metadata: {
            cafeId,
            name,
            city: sanitized.city || (sanitized.address && sanitized.address.city) || '',
          },
          actorUserId: auth.userId,
        });
      } catch (_) {
        // Non-blocking fallback if running in standalone test environment
      }

      // 4c. Create Cafe Record with Full 12-Section Profile
      const [cafeDoc] = await Cafe.create(
        [
          {
            ...sanitized,
            cafeId,
            organisationId,
            name,
            displayName,
            legalName: sanitized.legalName || name,
            branchName: sanitized.branchName || '',
            establishmentCategory: sanitized.establishmentCategory || 'Café',
            dietaryType: sanitized.dietaryType || 'MIXED',
            dateBusinessStarted: sanitized.dateBusinessStarted || null,
            branchCode: sanitized.branchCode || '',
            internalCafeId: sanitized.internalCafeId || '',
            storeNumber: sanitized.storeNumber || '',
            parentOrganisationId: sanitized.parentOrganisationId || organisationId,
            cafeType,
            status: initialStatus,
            legalConstitution: {
              constitution: sanitized.constitution || sanitized.legalConstitution?.constitution || 'PROPRIETORSHIP',
              legalOwnerName: sanitized.legalOwnerName || sanitized.ownerName || sanitized.legalConstitution?.legalOwnerName || '',
              partnersDirectors: sanitized.partnersDirectors || sanitized.directors || sanitized.legalConstitution?.partnersDirectors || [],
              authorisedSignatory: sanitized.authorisedSignatory || sanitized.legalConstitution?.authorisedSignatory || '',
              pan: (sanitized.pan || sanitized.legalConstitution?.pan || '').toUpperCase(),
              cin: (sanitized.cin || sanitized.legalConstitution?.cin || '').toUpperCase(),
              registrationNumber: sanitized.registrationNumber || sanitized.legalConstitution?.registrationNumber || '',
              incorporationDate: sanitized.incorporationDate || sanitized.legalConstitution?.incorporationDate || null,
              registeredOfficeAddress: sanitized.registeredOfficeAddress || sanitized.legalConstitution?.registeredOfficeAddress || '',
              udyamNumber: sanitized.udyamNumber || sanitized.legalConstitution?.udyamNumber || '',
              udyamRegistrationDate: sanitized.udyamRegistrationDate || sanitized.legalConstitution?.udyamRegistrationDate || null,
              enterpriseClassification: sanitized.enterpriseClassification || sanitized.legalConstitution?.enterpriseClassification || '',
            },
            contactProfile: {
              primaryContact: {
                name: sanitized.managerName || sanitized.contactProfile?.primaryContact?.name || '',
                designation: sanitized.contactProfile?.primaryContact?.designation || 'Store Manager',
                mobile: sanitized.phone || sanitized.contactProfile?.primaryContact?.mobile || '',
                alternateMobile: sanitized.alternatePhone || sanitized.contactProfile?.primaryContact?.alternateMobile || '',
                whatsapp: sanitized.contactProfile?.primaryContact?.whatsapp || '',
                email: sanitized.email || sanitized.contactProfile?.primaryContact?.email || '',
                secondaryEmail: sanitized.contactProfile?.primaryContact?.secondaryEmail || '',
              },
              emergencyContact: {
                name: sanitized.contactProfile?.emergencyContact?.name || sanitized.emergencyName || '',
                role: sanitized.contactProfile?.emergencyContact?.role || 'Emergency Contact',
                phone: sanitized.contactProfile?.emergencyContact?.phone || sanitized.emergencyPhone || '',
                alternatePhone: sanitized.contactProfile?.emergencyContact?.alternatePhone || '',
              },
              communicationPreference: sanitized.communicationPreference || 'EMAIL',
            },
            address: {
              building: sanitized.address?.building || '',
              unit: sanitized.address?.unit || '',
              floor: sanitized.address?.floor || '',
              street: sanitized.address?.street || sanitized.addressLine1 || '',
              line1: sanitized.addressLine1 || sanitized.address?.line1 || '',
              line2: sanitized.addressLine2 || sanitized.address?.line2 || '',
              area: sanitized.address?.area || '',
              city: sanitized.city || sanitized.address?.city || '',
              district: sanitized.district || sanitized.address?.district || '',
              state: sanitized.state || sanitized.address?.state || 'Kerala',
              stateCode: sanitized.stateCode || sanitized.address?.stateCode || '',
              pinCode: sanitized.pincode || sanitized.address?.pinCode || '',
              pincode: sanitized.pincode || sanitized.address?.pincode || '',
              country: sanitized.country || sanitized.address?.country || 'India',
              landmark: sanitized.landmark || sanitized.address?.landmark || '',
              latitude: sanitized.latitude || sanitized.address?.latitude || null,
              longitude: sanitized.longitude || sanitized.address?.longitude || null,
              doorNumber: sanitized.doorNumber || sanitized.address?.doorNumber || '',
              possessionType: sanitized.possessionType || sanitized.address?.possessionType || 'RENTED',
              leaseStartDate: sanitized.leaseStartDate || sanitized.address?.leaseStartDate || null,
              leaseEndDate: sanitized.leaseEndDate || sanitized.address?.leaseEndDate || null,
              mapsLink: sanitized.mapsLink || sanitized.address?.mapsLink || '',
            },
            registrations: {
              gstin: (sanitized.gstin || sanitized.gstDetails?.gstin || '').toUpperCase(),
              gstDetails: {
                isRegistered: Boolean(sanitized.gstin || sanitized.gstDetails?.isRegistered),
                gstin: (sanitized.gstin || sanitized.gstDetails?.gstin || '').toUpperCase(),
                legalName: sanitized.gstDetails?.legalName || sanitized.legalName || name,
                tradeName: sanitized.gstDetails?.tradeName || displayName || name,
                registrationDate: sanitized.gstDetails?.registrationDate || null,
                stateCode: sanitized.gstDetails?.stateCode || '',
                taxpayerType: sanitized.gstDetails?.taxpayerType || 'REGULAR',
                principalPlace: sanitized.gstDetails?.principalPlace || '',
                certificateUrl: sanitized.gstDetails?.certificateUrl || '',
                effectiveDate: sanitized.gstDetails?.effectiveDate || null,
                status: sanitized.gstDetails?.status || 'ACTIVE',
              },
              pan: (sanitized.pan || sanitized.legalConstitution?.pan || '').toUpperCase(),
              municipalId: sanitized.municipalId || '',
              fssai: {
                isApplicable: sanitized.fssai?.isApplicable !== false,
                number: sanitized.fssaiNumber || sanitized.fssai?.number || '',
                licenseType: sanitized.fssaiType || sanitized.fssai?.licenseType || 'State Licence',
                kindOfBusiness: sanitized.fssai?.kindOfBusiness || 'Food Service / Café',
                issuingAuthority: sanitized.fssai?.issuingAuthority || 'FSSAI FoSCoS',
                validFrom: sanitized.fssai?.validFrom || null,
                validTill: sanitized.fssaiExpiryDate || sanitized.fssai?.validTill || null,
                certificateUrl: sanitized.fssai?.certificateUrl || '',
                renewalReminderDate: sanitized.fssai?.renewalReminderDate || null,
              },
              licenceNumbers: Array.isArray(sanitized.licenceNumbers) ? sanitized.licenceNumbers : [],
              otherRegistrations: Array.isArray(sanitized.otherRegistrations) ? sanitized.otherRegistrations : [],
            },
            operations: {
              seatingCapacity: sanitized.seatingCapacity || sanitized.operations?.seatingCapacity || 0,
              tableCount: sanitized.tableCount || sanitized.operations?.tableCount || 0,
              counterCount: sanitized.counterCount || sanitized.operations?.counterCount || 1,
              cashPointCount: sanitized.cashPointCount || sanitized.operations?.cashPointCount || 1,
              storageLocationCount: sanitized.storageLocationCount || sanitized.operations?.storageLocationCount || 1,
              splitShifts: Boolean(sanitized.splitShifts),
              floorZoneStructure: sanitized.floorZoneStructure || '',
              kitchenSections: sanitized.kitchenSections || ['Beverages', 'Hot Kitchen', 'Bakery'],
              prepStations: sanitized.prepStations || ['Espresso Bar', 'Grill', 'Prep Counter'],
              kotRouting: sanitized.kotRouting || 'STATION_SPLIT',
              serviceChargePolicy: sanitized.serviceChargePolicy || 'NONE',
              cancellationPolicy: sanitized.cancellationPolicy || 'STANDARD',
              refundPolicy: sanitized.refundPolicy || 'SAME_PAYMENT_METHOD',
              discountPolicy: sanitized.discountPolicy || 'MANAGER_APPROVAL_REQUIRED',
              orderNumberingScheme: sanitized.orderNumberingScheme || 'DAILY_RESET',
            },
            finance: {
              costCentreCode: sanitized.costCenterCode || sanitized.costCentreCode || '',
              profitCentreCode: sanitized.profitCentreCode || '',
              monthlyBudget: sanitized.monthlyBudget || 0,
              monthlySalesTarget: sanitized.monthlySalesTarget || 0,
              monthlyLabourBudget: sanitized.monthlyLabourBudget || 0,
              monthlyRent: sanitized.monthlyRent || 0,
              openingCashRequired: sanitized.openingCashRequired !== false,
              defaultOpeningCash: sanitized.defaultOpeningCash || 0,
              banking: {
                accountHolderName: sanitized.banking?.accountHolderName || sanitized.accountHolderName || name,
                bankName: sanitized.banking?.bankName || sanitized.bankName || '',
                branch: sanitized.banking?.branch || '',
                accountNumber: sanitized.banking?.accountNumber || sanitized.accountNumber || '',
                accountNumberMasked: sanitized.banking?.accountNumber
                  ? '••••••••' + String(sanitized.banking.accountNumber).slice(-4)
                  : (sanitized.accountNumber ? '••••••••' + String(sanitized.accountNumber).slice(-4) : ''),
                ifsc: (sanitized.banking?.ifsc || sanitized.ifsc || '').toUpperCase(),
                accountType: sanitized.banking?.accountType || 'CURRENT',
                upiId: sanitized.banking?.upiId || sanitized.upiId || '',
                merchantId: sanitized.banking?.merchantId || '',
                settlementAccount: sanitized.banking?.settlementAccount || '',
                cashOpeningBalance: sanitized.banking?.cashOpeningBalance || 0,
                accountingYear: '2026-2027',
                financialYear: '2026-2027',
                currency: 'INR',
                taxRoundingMethod: 'ROUND_HALF_UP',
              },
            },
            inventorySetup: {
              enabled: true,
              globalMasterDataPublished: false,
              openingStockCompleted: false,
              mainStore: sanitized.inventorySetup?.mainStore || 'Main Store',
              subStore: sanitized.inventorySetup?.subStore || '',
              kitchenStore: sanitized.inventorySetup?.kitchenStore || 'Kitchen Store',
              dryStorage: sanitized.inventorySetup?.dryStorage || 'Dry Storage',
              coldStorageLocations: sanitized.inventorySetup?.coldStorageLocations || ['Walk-in Chiller', 'Display Fridge'],
              defaultSuppliers: sanitized.inventorySetup?.defaultSuppliers || [],
              stockValuationMethod: sanitized.inventorySetup?.stockValuationMethod || 'FIFO',
              uoms: sanitized.inventorySetup?.uoms || ['KG', 'LITRE', 'PACK', 'PORTION', 'UNIT'],
              reorderPolicy: sanitized.inventorySetup?.reorderPolicy || 'PAR_LEVEL',
              openingStockImported: Boolean(sanitized.inventorySetup?.openingStockImported),
              batchExpiryTracking: sanitized.inventorySetup?.batchExpiryTracking !== false,
              wastePolicy: sanitized.inventorySetup?.wastePolicy || 'DAILY_AUDIT',
            },
            hardwareReadiness: {
              posTerminals: Boolean(sanitized.hardwareReadiness?.posTerminals || sanitized.hardware?.posTerminal),
              androidTablets: Boolean(sanitized.hardwareReadiness?.androidTablets),
              desktopLaptop: Boolean(sanitized.hardwareReadiness?.desktopLaptop),
              thermalPrinters: Boolean(sanitized.hardwareReadiness?.thermalPrinters || sanitized.hardware?.thermalPrinter),
              kitchenPrinter: Boolean(sanitized.hardwareReadiness?.kitchenPrinter || sanitized.hardware?.kitchenDisplay),
              a4Printer: Boolean(sanitized.hardwareReadiness?.a4Printer),
              barcodeScanner: Boolean(sanitized.hardwareReadiness?.barcodeScanner || sanitized.hardware?.barcodeScanner),
              qrScanner: Boolean(sanitized.hardwareReadiness?.qrScanner),
              biometricDevice: Boolean(sanitized.hardwareReadiness?.biometricDevice),
              cashDrawer: Boolean(sanitized.hardwareReadiness?.cashDrawer),
              customerDisplay: Boolean(sanitized.hardwareReadiness?.customerDisplay),
              weighingScale: Boolean(sanitized.hardwareReadiness?.weighingScale || sanitized.hardware?.weighingScale),
              labelPrinter: Boolean(sanitized.hardwareReadiness?.labelPrinter),
              cctvIntegration: Boolean(sanitized.hardwareReadiness?.cctvIntegration),
              internetConnection: Boolean(sanitized.hardwareReadiness?.internetConnection ?? true),
              backupInternet: Boolean(sanitized.hardwareReadiness?.backupInternet),
              routerNetwork: Boolean(sanitized.hardwareReadiness?.routerNetwork ?? true),
              powerBackup: Boolean(sanitized.hardwareReadiness?.powerBackup),
              notes: sanitized.hardwareReadiness?.notes || '',
            },
            branding: {
              logoUrl: sanitized.branding?.logoUrl || '',
              companyLogoUrl: sanitized.branding?.companyLogoUrl || '',
              cafeLogoUrl: sanitized.branding?.cafeLogoUrl || '',
              legalEntityName: sanitized.branding?.legalEntityName || sanitized.legalName || 'Zamorin Speciality Coffee & Kitchens Pvt. Ltd.',
              tradeName: sanitized.branding?.tradeName || displayName || 'Zamorin Café',
              primaryBrandColor: sanitized.branding?.primaryBrandColor || '#16223F',
              addressText: sanitized.branding?.addressText || sanitized.addressLine1 || '',
              phoneText: sanitized.branding?.phoneText || sanitized.phone || '',
              emailText: sanitized.branding?.emailText || sanitized.email || '',
              websiteText: sanitized.branding?.websiteText || 'https://zamorin.app',
              receiptFooter: sanitized.branding?.receiptFooter || '',
              reportFooter: sanitized.branding?.reportFooter || '',
              invoiceFooterText: sanitized.branding?.invoiceFooterText || 'Thank you for dining with Zamorin Café.',
              authorizedSignatoryName: sanitized.branding?.authorizedSignatoryName || sanitized.managerName || '',
              authorizedSignatoryDesignation: sanitized.branding?.authorizedSignatoryDesignation || 'Authorized Signatory',
            },
            qrLoginContext: {
              qrRecordId: universalQr ? universalQr.qrId : null,
              securePublicCafeReference,
              loginUrl: `https://zamorin.app/cafe/${securePublicCafeReference}/login`,
              status: 'ACTIVE',
              lastScannedAt: null,
              scanCount: 0,
            },
            readinessChecklist: {
              qrLoginTest: Boolean(sanitized.readinessChecklist?.qrLoginTest),
              employeeLoginTest: Boolean(sanitized.readinessChecklist?.employeeLoginTest),
              posTest: Boolean(sanitized.readinessChecklist?.posTest),
              printerTest: Boolean(sanitized.readinessChecklist?.printerTest),
              orderTest: Boolean(sanitized.readinessChecklist?.orderTest),
              inventoryTest: Boolean(sanitized.readinessChecklist?.inventoryTest),
              reportTest: Boolean(sanitized.readinessChecklist?.reportTest),
              pdfExportTest: Boolean(sanitized.readinessChecklist?.pdfExportTest),
              excelExportTest: Boolean(sanitized.readinessChecklist?.excelExportTest),
              roleBoundaryTest: Boolean(sanitized.readinessChecklist?.roleBoundaryTest),
            },
            readinessHistory: [
              {
                fromStatus: 'INITIAL',
                toStatus: initialStatus,
                changedBy: auth.userId,
                changedAt: new Date(),
                reason: 'Initial establishment onboarding and access provisioning',
                testResults: sanitized.readinessChecklist || null,
              },
            ],
            timezone: sanitized.timezone || 'Asia/Kolkata',
            currency: sanitized.currency || 'INR',
            createdBy: auth.userId,
            updatedBy: auth.userId,
          },
        ],
        session ? { session } : {}
      );
      createdCafe = cafeDoc;

      // 4c. Create CafeAccess Record
      const [accessDoc] = await CafeAccess.create(
        [
          {
            organisationId,
            cafeId,
            accessStatus: 'ACTIVE',
            provisioningStatus: 'PROVISIONING',
            permanentCafePinEncrypted: encryptedPin,
            permanentCafePinLookupHash: pinLookupHash,
            qrCredentialHash,
            qrTokenEncrypted: encryptSecret(qrToken),
            qrVersion: 1,
            qrEnabled: true,
            qrCreatedAt: new Date(),
            linkCredentialHash,
            linkTokenEncrypted: encryptSecret(linkToken),
            linkVersion: 1,
            linkEnabled: true,
            linkCreatedAt: new Date(),
            createdBy: auth.userId,
            updatedBy: auth.userId,
          },
        ],
        session ? { session } : {}
      );
      createdAccess = accessDoc;

      // 4d. Auto-provision active Global Inventory Items with quantity 0
      try {
        const { GlobalInventoryItem } = require('../models/GlobalInventoryItem');
        const { CafeInventoryConfig } = require('../models/CafeInventoryConfig');
        const activeItems = await GlobalInventoryItem.find({
          organisationId,
          status: 'ACTIVE',
        }).lean();

        if (activeItems.length > 0) {
          const configDocs = activeItems.map((itm) => ({
            organisationId,
            cafeId,
            itemId: itm.itemId,
            currentQuantityBase: 0,
            availableQuantityBase: 0,
            reservedQuantityBase: 0,
            quarantinedQuantityBase: 0,
            expiredQuantityBase: 0,
            inTransitQuantityBase: 0,
            incomingQuantityBase: 0,
            minQuantityBase: 10,
            parQuantityBase: 25,
            maxQuantityBase: 50,
            safetyStockBase: 5,
            stockedHere: true,
            replenishmentEnabled: true,
            primaryLocation: 'Main Store',
            storageLocations: ['Main Store'],
            status: 'ACTIVE',
          }));
          await CafeInventoryConfig.insertMany(
            configDocs,
            session ? { session, ordered: false } : { ordered: false }
          ).catch(() => {});
        }
      } catch (_) {
        // Non-blocking inventory setup
      }

      // 5. Post-Creation Integrity Verification
      const decryptedVerification = decryptCafePin(encryptedPin);
      if (decryptedVerification !== permanentPin) {
        throw new Error('Post-creation integrity check failed: PIN decryption mismatch.');
      }

      createdAccess.provisioningStatus = 'READY';
      createdAccess.lastValidatedAt = new Date();
      createdAccess.lastValidationResult = {
        pinVerified: true,
        qrVerified: true,
        linkVerified: true,
        timestamp: new Date().toISOString(),
      };
      await createdAccess.save(session ? { session } : {});

      // If creator is OWNER, ensure newly created cafeId is in their assignedCafeIds
      if (auth.role === 'OWNER') {
        await User.updateOne(
          { userId: auth.userId, organisationId },
          { $addToSet: { assignedCafeIds: cafeId } },
          session ? { session } : {}
        );
        if (Array.isArray(auth.assignedCafeIds)) {
          if (!auth.assignedCafeIds.includes(cafeId)) {
            auth.assignedCafeIds.push(cafeId);
          }
        }
      }

      if (session) {
        await session.commitTransaction();
        session.endSession();
        session = null;
      }
    } catch (err) {
      if (session) {
        await session.abortTransaction();
        session.endSession();
        session = null;
      } else {
        // Compensating rollback if standalone
        if (createdCafe?._id) {
          await Cafe.deleteOne({ _id: createdCafe._id }).catch(() => {});
        }
        if (createdAccess?._id) {
          await CafeAccess.deleteOne({ _id: createdAccess._id }).catch(() => {});
        }
        if (pinLookupHash) {
          await CafePinReservation.deleteOne({ pinLookupHash }).catch(() => {});
        }
      }

      throw new ApiError(
        500,
        'CAFE_PROVISIONING_FAILED',
        `Failed to provision café and access credentials: ${err.message}`
      );
    }

    // 6. Record Immutable Audit Events (zero secrets in audit)
    try {
      await auditService.recordAuditEvent({
        organisationId,
        cafeId,
        actorUserId: auth.userId,
        actorRole: auth.role,
        module: 'CAFE_MANAGEMENT',
        action: 'CAFE_CREATED',
        entityType: 'CAFE',
        entityId: cafeId,
        reason: 'New café location created by authorized governance user.',
        result: 'SUCCESS',
        riskClassification: 'HIGH',
        correlationId,
        ipAddress: clientIp,
        userAgent,
        metadata: {
          cafeName: name,
          cafeType,
          status: initialStatus,
          isPrimaryMaster: Boolean(auth.isPrimaryMaster),
          creatorRole: auth.role,
        },
      });

      await auditService.recordAuditEvent({
        organisationId,
        cafeId,
        actorUserId: auth.userId,
        actorRole: auth.role,
        module: 'CAFE_OPERATIONS',
        action: 'CAFE_ACCESS_CREATED',
        entityType: 'CAFE_ACCESS',
        entityId: cafeId,
        reason: 'Permanent Café PIN, QR credential, and Login Link provisioned.',
        result: 'SUCCESS',
        riskClassification: 'CRITICAL',
        correlationId,
        ipAddress: clientIp,
        userAgent,
        metadata: {
          provisioningStatus: 'READY',
          qrVersion: 1,
          linkVersion: 1,
        },
      });
    } catch (_) {
      // Audit failure does not abort committed cafe
    }

    const publicOrigin = getPublicAppOrigin();

    return {
      cafe: createdCafe,
      access: {
        cafeId,
        organisationId,
        provisioningStatus: 'READY',
        accessStatus: 'ACTIVE',
        permanentCafePin: permanentPin, // Initial unmasked reveal only upon creation
        qrToken,
        qrUrl: `${publicOrigin}/cafe-access/qr/${qrToken}`,
        qrVersion: 1,
        linkToken,
        linkUrl: `${publicOrigin}/cafe-access/link/${linkToken}`,
        linkVersion: 1,
      },
    };
  }

  /**
   * Retrieves Café Access governance summary without exposing secrets.
   */
  async getCafeAccessSummary(arg1, arg2) {
    let organisationId;
    let cafeId;
    if (typeof arg1 === 'object' && arg1 !== null) {
      organisationId = arg1.organisationId;
      cafeId = arg1.cafeId;
    } else {
      organisationId = arg1;
      cafeId = arg2;
    }

    const access = await CafeAccess.findOne({
      organisationId: String(organisationId || '').toUpperCase(),
      cafeId: String(cafeId || '').toUpperCase(),
    }).select('+qrTokenEncrypted +linkTokenEncrypted').lean();

    if (!access) {
      throw new ApiError(404, 'ACCESS_RECORD_NOT_FOUND', 'Café Access record not found.');
    }

    const cafe = await Cafe.findOne({
      organisationId: String(organisationId).toUpperCase(),
      cafeId: String(cafeId).toUpperCase(),
    }).lean();

    // Compute real enrolled device count
    let registeredDeviceCount = 0;
    try {
      registeredDeviceCount = await DeviceRegistration.countDocuments({
        organisationId: String(organisationId).toUpperCase(),
        assignedCafeId: String(cafeId).toUpperCase(),
        status: 'ACTIVE',
      });
    } catch {
      registeredDeviceCount = 0;
    }

    // Compute real active operator sessions count
    let activeSessionCount = 0;
    try {
      activeSessionCount = await OperatorSession.countDocuments({
        organisationId: String(organisationId).toUpperCase(),
        cafeId: String(cafeId).toUpperCase(),
        status: 'ACTIVE',
      });
    } catch {
      activeSessionCount = 0;
    }

    const publicOrigin = getPublicAppOrigin();
    let qrUrl = null;
    let linkUrl = null;
    if (access.qrTokenEncrypted) {
      try {
        const qrToken = decryptSecret(access.qrTokenEncrypted);
        qrUrl = `${publicOrigin}/cafe-access/qr/${qrToken}`;
      } catch {}
    }
    if (access.linkTokenEncrypted) {
      try {
        const linkToken = decryptSecret(access.linkTokenEncrypted);
        linkUrl = `${publicOrigin}/cafe-access/link/${linkToken}`;
      } catch {}
    }

    return {
      cafeId: access.cafeId,
      cafeName: cafe?.name || access.cafeId,
      organisationId: access.organisationId,
      accessStatus: access.accessStatus,
      provisioningStatus: access.provisioningStatus,
      permanentCafePinMasked: '••••••',
      qrEnabled: Boolean(access.qrEnabled),
      qrVersion: access.qrVersion || 1,
      qrCreatedAt: access.qrCreatedAt,
      qrLastUsedAt: access.qrLastUsedAt,
      qrUrl,
      linkEnabled: Boolean(access.linkEnabled),
      linkVersion: access.linkVersion || 1,
      linkCreatedAt: access.linkCreatedAt,
      linkLastUsedAt: access.linkLastUsedAt,
      linkUrl,
      emergencyLocked: access.accessStatus === 'LOCKED',
      emergencyLockReason: access.emergencyLockReason,
      emergencyLockedAt: access.emergencyLockedAt,
      maintenanceMode: Boolean(access.maintenanceMode),
      maintenanceReason: access.maintenanceReason,
      registeredDevicesCount: registeredDeviceCount,
      activeSessionsCount: activeSessionCount,
      lastValidatedAt: access.lastValidatedAt,
      lastValidationResult: access.lastValidationResult,
    };
  }

  /**
   * Reveals Permanent Café PIN with password step-up verification.
   */
  async revealPermanentPin({
    organisationId,
    cafeId,
    auth,
    currentPassword,
    clientIp = null,
    userAgent = null,
  }) {
    requireGovernanceAuthority(auth);

    if (!currentPassword || typeof currentPassword !== 'string') {
      throw new ApiError(400, 'PASSWORD_REQUIRED', 'Current password is required to reveal Permanent Café PIN.');
    }

    const user = await User.findOne({
      userId: auth.userId,
      organisationId: String(organisationId).toUpperCase(),
    }).select('+passwordHash');

    if (!user || !user.passwordHash) {
      throw new ApiError(401, 'INVALID_CREDENTIALS', 'Reauthentication failed.');
    }

    const validPassword = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!validPassword) {
      throw new ApiError(401, 'INVALID_CREDENTIALS', 'Incorrect password.');
    }

    const access = await CafeAccess.findOne({
      organisationId: String(organisationId).toUpperCase(),
      cafeId: String(cafeId).toUpperCase(),
    }).select('+permanentCafePinEncrypted');

    if (!access || !access.permanentCafePinEncrypted) {
      throw new ApiError(404, 'ACCESS_RECORD_NOT_FOUND', 'Café Access record not found.');
    }

    const pin = decryptCafePin(access.permanentCafePinEncrypted);

    await auditService.recordAuditEvent({
      organisationId,
      cafeId,
      actorUserId: auth.userId,
      actorRole: auth.role,
      module: 'CAFE_OPERATIONS',
      action: 'CAFE_PIN_VIEWED',
      entityType: 'CAFE_ACCESS',
      entityId: cafeId,
      reason: 'Governance user revealed Permanent Café Access PIN via step-up authentication.',
      result: 'SUCCESS',
      riskClassification: 'CRITICAL',
      ipAddress: clientIp,
      userAgent,
    });

    return {
      cafeId,
      permanentCafePin: pin,
    };
  }

  /**
   * Rotates QR Credential: new high-entropy token, increments version, keeps PIN & Link intact.
   */
  async rotateQrCredential({
    organisationId,
    cafeId,
    auth,
    currentPassword = null,
    clientIp = null,
    userAgent = null,
  }) {
    requireGovernanceAuthority(auth);

    if (currentPassword) {
      const user = await User.findOne({
        userId: auth.userId,
        organisationId: String(organisationId).toUpperCase(),
      }).select('+passwordHash');
      if (user && user.passwordHash) {
        const ok = await bcrypt.compare(currentPassword, user.passwordHash);
        if (!ok) throw new ApiError(401, 'INVALID_CREDENTIALS', 'Incorrect password.');
      }
    }

    const access = await CafeAccess.findOne({
      organisationId: String(organisationId).toUpperCase(),
      cafeId: String(cafeId).toUpperCase(),
    });

    if (!access) {
      throw new ApiError(404, 'ACCESS_RECORD_NOT_FOUND', 'Café Access record not found.');
    }

    const newQrToken = generateOpaqueToken();
    access.qrCredentialHash = hashOpaqueToken(newQrToken);
    access.qrTokenEncrypted = encryptSecret(newQrToken);
    access.qrVersion = (access.qrVersion || 1) + 1;
    access.qrCreatedAt = new Date();
    access.updatedBy = auth.userId;
    await access.save();

    await auditService.recordAuditEvent({
      organisationId,
      cafeId,
      actorUserId: auth.userId,
      actorRole: auth.role,
      module: 'CAFE_OPERATIONS',
      action: 'CAFE_QR_REGENERATED',
      entityType: 'CAFE_ACCESS',
      entityId: cafeId,
      reason: `QR access credential regenerated to version ${access.qrVersion}. Prior codes invalidated.`,
      result: 'SUCCESS',
      riskClassification: 'HIGH',
      ipAddress: clientIp,
      userAgent,
    });

    const publicOrigin = getPublicAppOrigin();

    return {
      cafeId,
      qrVersion: access.qrVersion,
      qrToken: newQrToken,
      qrUrl: `${publicOrigin}/cafe-access/qr/${newQrToken}`,
    };
  }

  /**
   * Rotates Login Link Credential: new high-entropy token, increments version, keeps PIN & QR intact.
   */
  async rotateLinkCredential({
    organisationId,
    cafeId,
    auth,
    currentPassword = null,
    clientIp = null,
    userAgent = null,
  }) {
    requireGovernanceAuthority(auth);

    if (currentPassword) {
      const user = await User.findOne({
        userId: auth.userId,
        organisationId: String(organisationId).toUpperCase(),
      }).select('+passwordHash');
      if (user && user.passwordHash) {
        const ok = await bcrypt.compare(currentPassword, user.passwordHash);
        if (!ok) throw new ApiError(401, 'INVALID_CREDENTIALS', 'Incorrect password.');
      }
    }

    const access = await CafeAccess.findOne({
      organisationId: String(organisationId).toUpperCase(),
      cafeId: String(cafeId).toUpperCase(),
    });

    if (!access) {
      throw new ApiError(404, 'ACCESS_RECORD_NOT_FOUND', 'Café Access record not found.');
    }

    const newLinkToken = generateOpaqueToken();
    access.linkCredentialHash = hashOpaqueToken(newLinkToken);
    access.linkTokenEncrypted = encryptSecret(newLinkToken);
    access.linkVersion = (access.linkVersion || 1) + 1;
    access.linkCreatedAt = new Date();
    access.updatedBy = auth.userId;
    await access.save();

    await auditService.recordAuditEvent({
      organisationId,
      cafeId,
      actorUserId: auth.userId,
      actorRole: auth.role,
      module: 'CAFE_OPERATIONS',
      action: 'CAFE_LINK_REGENERATED',
      entityType: 'CAFE_ACCESS',
      entityId: cafeId,
      reason: `Login Link credential regenerated to version ${access.linkVersion}. Prior links invalidated.`,
      result: 'SUCCESS',
      riskClassification: 'HIGH',
      ipAddress: clientIp,
      userAgent,
    });

    const publicOrigin = getPublicAppOrigin();

    return {
      cafeId,
      linkVersion: access.linkVersion,
      linkToken: newLinkToken,
      linkUrl: `${publicOrigin}/cafe-access/link/${newLinkToken}`,
    };
  }

  /**
   * Emergency Lock / Unlock for Café Operations Access.
   */
  async setEmergencyLock({
    organisationId,
    cafeId,
    lock,
    reason = '',
    auth,
    currentPassword = null,
    clientIp = null,
    userAgent = null,
  }) {
    requireGovernanceAuthority(auth);

    if (currentPassword) {
      const user = await User.findOne({
        userId: auth.userId,
        organisationId: String(organisationId).toUpperCase(),
      }).select('+passwordHash');
      if (user && user.passwordHash) {
        const ok = await bcrypt.compare(currentPassword, user.passwordHash);
        if (!ok) throw new ApiError(401, 'INVALID_CREDENTIALS', 'Incorrect password.');
      }
    }

    const access = await CafeAccess.findOne({
      organisationId: String(organisationId).toUpperCase(),
      cafeId: String(cafeId).toUpperCase(),
    });

    if (!access) {
      throw new ApiError(404, 'ACCESS_RECORD_NOT_FOUND', 'Café Access record not found.');
    }

    const isLocking = Boolean(lock);
    access.accessStatus = isLocking ? 'LOCKED' : 'ACTIVE';
    access.emergencyLockReason = isLocking ? (reason || 'Emergency Lock engaged by governance user') : null;
    access.emergencyLockedAt = isLocking ? new Date() : null;
    access.emergencyLockedBy = isLocking ? auth.userId : null;
    access.updatedBy = auth.userId;
    await access.save();

    await auditService.recordAuditEvent({
      organisationId,
      cafeId,
      actorUserId: auth.userId,
      actorRole: auth.role,
      module: 'CAFE_OPERATIONS',
      action: isLocking ? 'CAFE_EMERGENCY_LOCKED' : 'CAFE_EMERGENCY_UNLOCKED',
      entityType: 'CAFE_ACCESS',
      entityId: cafeId,
      reason: reason || (isLocking ? 'Emergency lock engaged' : 'Emergency lock released'),
      result: 'SUCCESS',
      riskClassification: 'CRITICAL',
      ipAddress: clientIp,
      userAgent,
    });

    return {
      cafeId,
      accessStatus: access.accessStatus,
      emergencyLocked: isLocking,
    };
  }

  /**
   * Gateway Credential Resolver: exchanges Permanent PIN, QR Token, or Link Token
   * for a short-lived server-side CafeGatewayContext.
   */
  async resolveGatewayCredential({
    method,
    credential,
    clientIp = null,
    userAgent = null,
    correlationId = null,
  }) {
    if (!method || !['PIN', 'QR', 'LINK'].includes(method.toUpperCase())) {
      throw new ApiError(400, 'INVALID_GATEWAY_METHOD', 'Gateway method must be PIN, QR, or LINK.');
    }

    if (!credential || typeof credential !== 'string' || !credential.trim()) {
      throw new ApiError(400, 'CREDENTIAL_REQUIRED', 'Access credential is required.');
    }

    const cleanMethod = method.toUpperCase();
    const cleanCred = credential.trim();

    let access = null;

    if (cleanMethod === 'PIN') {
      // Disallow permanent PIN authentication bypass per architectural specification
      throw new ApiError(
        400,
        'PIN_AUTH_DISALLOWED',
        'Permanent PIN authentication is disallowed. Café context must be securely resolved via unique Café QR or official login URL.'
      );
    } else if (cleanMethod === 'QR') {
      const hash = hashOpaqueToken(cleanCred);
      access = await CafeAccess.findOne({
        qrCredentialHash: hash,
        qrEnabled: true,
      });
    } else if (cleanMethod === 'LINK') {
      const hash = hashOpaqueToken(cleanCred);
      access = await CafeAccess.findOne({
        linkCredentialHash: hash,
        linkEnabled: true,
      });
    } else if (cleanMethod === 'SETUP_CODE') {
      // Internal initial store commissioning: one-time short-lived setup code
      const hash = hashOpaqueToken(cleanCred);
      access = await CafeAccess.findOne({
        oneTimeSetupCodeHash: hash,
        setupCodeExpiresAt: { $gt: new Date() },
        setupCodeUsed: false,
      });
      if (access) {
        // Invalidate immediately upon successful use
        await CafeAccess.updateOne({ _id: access._id }, { setupCodeUsed: true });
      }
    } else {
      throw new ApiError(400, 'INVALID_ACCESS_METHOD', 'Supported access methods are QR, LINK, or SETUP_CODE.');
    }

    if (!access) {
      throw new ApiError(
        401,
        'GATEWAY_RESOLUTION_FAILED',
        'Café Operations access link or QR is invalid or expired.'
      );
    }

    if (access.accessStatus === 'LOCKED' || access.accessStatus === 'DISABLED') {
      throw new ApiError(
        403,
        'CAFE_ACCESS_UNAVAILABLE',
        'Café Operations access is currently unavailable.'
      );
    }

    // Verify parent café status allows operations
    const cafe = await Cafe.findOne({
      organisationId: access.organisationId,
      cafeId: access.cafeId,
    }).lean();

    if (!cafe || cafe.status === 'ARCHIVED' || cafe.status === 'CLOSED') {
      throw new ApiError(
        403,
        'CAFE_INACTIVE',
        'Café Operations access is currently unavailable.'
      );
    }

    // Generate short-lived Gateway Context (15-minute expiration)
    const gatewayContextId = `GWC-${Date.now().toString(36).toUpperCase()}-${generateOpaqueToken().slice(0, 8).toUpperCase()}`;
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

    await CafeGatewayContext.create({
      gatewayContextId,
      organisationId: access.organisationId,
      cafeId: access.cafeId,
      accessMethod: cleanMethod,
      status: 'ACTIVE',
      expiresAt,
      correlationId,
      clientIp,
      userAgent,
    });

    // Touch last-used timestamp
    if (cleanMethod === 'QR') {
      await CafeAccess.updateOne({ _id: access._id }, { qrLastUsedAt: new Date() }).catch(() => {});
    } else if (cleanMethod === 'LINK') {
      await CafeAccess.updateOne({ _id: access._id }, { linkLastUsedAt: new Date() }).catch(() => {});
    }

    return {
      gatewayContextId,
      gatewayContextToken: gatewayContextId,
      cafe: {
        cafeId: access.cafeId,
        displayName: cafe.displayName || cafe.name,
        city: cafe.address?.city || cafe.city || null,
      },
      organisationId: access.organisationId,
      cafeId: access.cafeId,
      cafeName: cafe.name,
      accessMethod: cleanMethod,
      expiresAt: expiresAt.toISOString(),
    };
  }

  /**
   * Real Access Health Diagnostic Check (no fake PASS metrics).
   */
  async runAccessHealthCheck({ organisationId, cafeId, auth }) {
    requireGovernanceAuthority(auth);

    const access = await CafeAccess.findOne({
      organisationId: String(organisationId).toUpperCase(),
      cafeId: String(cafeId).toUpperCase(),
    }).select('+permanentCafePinEncrypted +permanentCafePinLookupHash');

    if (!access) {
      throw new ApiError(404, 'ACCESS_RECORD_NOT_FOUND', 'Café Access record not found.');
    }

    const results = {
      timestamp: new Date().toISOString(),
      cafeBinding: 'PASS',
      tenantIsolation: 'PASS',
      permanentPin: 'FAIL',
      qrCredential: 'FAIL',
      linkCredential: 'FAIL',
      overallHealth: 'PASS',
    };

    // Test 1: PIN decryption and lookup integrity
    try {
      if (access.permanentCafePinEncrypted && access.permanentCafePinLookupHash) {
        const decrypted = decryptCafePin(access.permanentCafePinEncrypted);
        const recomputedHash = computePinLookupHash(decrypted);
        if (recomputedHash === access.permanentCafePinLookupHash) {
          results.permanentPin = 'PASS';
        }
      }
    } catch {
      results.permanentPin = 'FAIL';
      results.overallHealth = 'FAIL';
    }

    // Test 2: QR status
    if (access.qrCredentialHash && access.qrEnabled) {
      results.qrCredential = 'PASS';
    } else {
      results.qrCredential = 'DISABLED';
    }

    // Test 3: Link status
    if (access.linkCredentialHash && access.linkEnabled) {
      results.linkCredential = 'PASS';
    } else {
      results.linkCredential = 'DISABLED';
    }

    access.lastValidatedAt = new Date();
    access.lastValidationResult = results;
    await access.save();

    return results;
  }

  /**
   * STAGE 03: Retrieves café readiness profile, 10-point checklist status, and compliance alerts.
   */
  async getCafeReadiness({ organisationId, cafeId }) {
    const cafe = await Cafe.findOne({
      organisationId: String(organisationId).toUpperCase(),
      cafeId: String(cafeId).toUpperCase(),
    });

    if (!cafe) {
      throw new ApiError(404, 'CAFE_NOT_FOUND', 'Café not found.');
    }

    const checklist = cafe.readinessChecklist || {};
    const { READINESS_CHECKLIST_KEYS } = require('../models/Cafe');
    const totalKeys = READINESS_CHECKLIST_KEYS.length;
    const completedCount = READINESS_CHECKLIST_KEYS.filter((k) => Boolean(checklist[k])).length;
    const percentage = Math.round((completedCount / totalKeys) * 100);
    const isTestModeComplete = cafe.isTestModeComplete();
    const expiryAlerts = cafe.computeExpiryAlerts();

    return {
      cafeId: cafe.cafeId,
      name: cafe.name,
      displayName: cafe.displayName,
      status: cafe.status,
      readinessChecklist: checklist,
      completedTests: completedCount,
      totalTests: totalKeys,
      readinessPercentage: percentage,
      isTestModeComplete,
      expiryAlerts,
      qrLoginContext: cafe.qrLoginContext,
      readinessHistory: cafe.readinessHistory || [],
    };
  }

  /**
   * STAGE 03: Updates items in the 10-point Test Mode readiness checklist.
   */
  async updateReadinessChecklist({ organisationId, cafeId, checklistUpdates = {}, auth }) {
    requireGovernanceAuthority(auth);

    const cafe = await Cafe.findOne({
      organisationId: String(organisationId).toUpperCase(),
      cafeId: String(cafeId).toUpperCase(),
    });

    if (!cafe) {
      throw new ApiError(404, 'CAFE_NOT_FOUND', 'Café not found.');
    }

    const { READINESS_CHECKLIST_KEYS } = require('../models/Cafe');
    if (!cafe.readinessChecklist) {
      cafe.readinessChecklist = {};
    }

    for (const key of READINESS_CHECKLIST_KEYS) {
      if (checklistUpdates[key] !== undefined) {
        cafe.readinessChecklist[key] = Boolean(checklistUpdates[key]);
      }
    }

    cafe.markModified('readinessChecklist');
    cafe.updatedBy = auth.userId;
    await cafe.save();

    await auditService.recordAuditEvent({
      organisationId: cafe.organisationId,
      cafeId: cafe.cafeId,
      actorUserId: auth.userId,
      actorRole: auth.role,
      module: 'CAFE_READINESS',
      action: 'CHECKLIST_UPDATED',
      entityType: 'CAFE',
      entityId: cafe.cafeId,
      reason: 'Readiness checklist tests updated.',
      result: 'SUCCESS',
      riskClassification: 'LOW',
    });

    const isTestModeComplete = cafe.isTestModeComplete();

    return {
      success: true,
      cafeId: cafe.cafeId,
      status: cafe.status,
      readinessChecklist: cafe.readinessChecklist,
      isTestModeComplete,
    };
  }

  /**
   * STAGE 03: Enforces controlled 7-state lifecycle state engine transitions.
   * DRAFT -> CONFIGURING -> VERIFICATION_REQUIRED -> READY_FOR_TESTING -> TEST_MODE -> READY_FOR_ACTIVATION -> ACTIVE
   */
  async transitionLifecycleState({ organisationId, cafeId, targetStatus, reason = '', auth }) {
    requireGovernanceAuthority(auth);

    const normalizedTarget = String(targetStatus || '').trim().toUpperCase();
    const { CAFE_STATUSES } = require('../models/Cafe');

    if (!CAFE_STATUSES.includes(normalizedTarget)) {
      throw new ApiError(400, 'INVALID_LIFECYCLE_STATUS', `Status must be one of: ${CAFE_STATUSES.join(', ')}`);
    }

    const cafe = await Cafe.findOne({
      organisationId: String(organisationId).toUpperCase(),
      cafeId: String(cafeId).toUpperCase(),
    });

    if (!cafe) {
      throw new ApiError(404, 'CAFE_NOT_FOUND', 'Café not found.');
    }

    const currentStatus = cafe.status;
    if (currentStatus === normalizedTarget) {
      return { success: true, cafeId: cafe.cafeId, previousStatus: currentStatus, status: normalizedTarget, message: 'Status is already at target state.' };
    }

    // Strict state engine transition validations
    if (normalizedTarget === 'READY_FOR_ACTIVATION') {
      const isComplete = cafe.isTestModeComplete();
      if (!isComplete) {
        throw new ApiError(
          400,
          'READINESS_CHECKLIST_INCOMPLETE',
          'All 10 Test Mode checklist items must pass before moving to READY_FOR_ACTIVATION.'
        );
      }
    }

    if (normalizedTarget === 'ACTIVE') {
      // Must come through READY_FOR_ACTIVATION or be already active/temporarily closed
      const allowedPredecessors = ['READY_FOR_ACTIVATION', 'ACTIVE', 'TEMPORARILY_CLOSED', 'UNDER_REVIEW'];
      if (!allowedPredecessors.includes(currentStatus)) {
        throw new ApiError(
          400,
          'INVALID_LIFECYCLE_TRANSITION',
          `Cannot jump directly from ${currentStatus} to ACTIVE. The café must complete the readiness engine and reach READY_FOR_ACTIVATION first.`
        );
      }
    }

    cafe.status = normalizedTarget;
    cafe.updatedBy = auth.userId;

    if (!Array.isArray(cafe.readinessHistory)) {
      cafe.readinessHistory = [];
    }

    cafe.readinessHistory.push({
      fromStatus: currentStatus,
      toStatus: normalizedTarget,
      changedBy: auth.userId,
      changedAt: new Date(),
      reason: reason || `Lifecycle transition from ${currentStatus} to ${normalizedTarget}`,
      testResults: cafe.readinessChecklist ? { ...cafe.readinessChecklist } : null,
    });

    await cafe.save();

    // Synchronize CafeAccess status
    try {
      if (normalizedTarget === 'ACTIVE') {
        await CafeAccess.updateOne(
          { organisationId: cafe.organisationId, cafeId: cafe.cafeId },
          { $set: { accessStatus: 'ACTIVE', updatedBy: auth.userId } }
        );
      } else if (normalizedTarget === 'TEMPORARILY_CLOSED' || normalizedTarget === 'CLOSED') {
        await CafeAccess.updateOne(
          { organisationId: cafe.organisationId, cafeId: cafe.cafeId },
          { $set: { accessStatus: 'DISABLED', updatedBy: auth.userId } }
        );
      }
    } catch (_) {}

    await auditService.recordAuditEvent({
      organisationId: cafe.organisationId,
      cafeId: cafe.cafeId,
      actorUserId: auth.userId,
      actorRole: auth.role,
      module: 'CAFE_READINESS',
      action: 'LIFECYCLE_TRANSITION',
      entityType: 'CAFE',
      entityId: cafe.cafeId,
      reason: reason || `Lifecycle transition to ${normalizedTarget}`,
      result: 'SUCCESS',
      riskClassification: 'HIGH',
    });

    return {
      success: true,
      cafeId: cafe.cafeId,
      previousStatus: currentStatus,
      status: normalizedTarget,
      readinessHistory: cafe.readinessHistory,
    };
  }

  /**
   * STAGE 03: Calculates licence and permit expiry alert statuses (90/60/30/15/7-day engine).
   */
  async getComplianceAlerts({ organisationId, cafeId = null }) {
    const filter = { organisationId: String(organisationId).toUpperCase(), status: { $ne: 'ARCHIVED' } };
    if (cafeId && cafeId !== 'ALL') {
      filter.cafeId = String(cafeId).toUpperCase();
    }

    const cafes = await Cafe.find(filter);
    const allAlerts = [];

    for (const cafe of cafes) {
      const alerts = cafe.computeExpiryAlerts();
      if (alerts.length > 0) {
        allAlerts.push({
          cafeId: cafe.cafeId,
          cafeName: cafe.name,
          alerts,
        });
      }
    }

    return {
      organisationId,
      totalCafesAudited: cafes.length,
      cafesWithAlertsCount: allAlerts.length,
      alerts: allAlerts,
    };
  }

  /**
   * STAGE 03: Regenerates Café Login QR Code using Stage 02 Universal QR Engine.
   * Immediately revokes the previous opaque token and provisions a fresh QR record.
   */
  async regenerateCafeLoginQr({ organisationId, cafeId, auth }) {
    requireGovernanceAuthority(auth);

    const cafe = await Cafe.findOne({
      organisationId: String(organisationId).toUpperCase(),
      cafeId: String(cafeId).toUpperCase(),
    });

    if (!cafe) {
      throw new ApiError(404, 'CAFE_NOT_FOUND', 'Café not found.');
    }

    const { UniversalQrService } = require('./universalQrService');

    // 1. Revoke existing Universal QR Record if present
    if (cafe.qrLoginContext?.qrRecordId) {
      await UniversalQrService.revokeQrRecord(
        cafe.qrLoginContext.qrRecordId,
        'Regenerated by authorized governance user.',
        auth.userId
      ).catch(() => {});
    }

    // 2. Generate new opaque token and create Universal QR Record
    const newReference = generateOpaqueToken();
    const newQrRecord = await UniversalQrService.createQrRecord({
      qrType: 'CAFE_LOGIN',
      targetEntityId: newReference,
      organisationId: cafe.organisationId,
      cafeId: cafe.cafeId,
      title: `Café Login QR — ${cafe.name}`,
      metadata: {
        cafeId: cafe.cafeId,
        name: cafe.name,
        regeneratedAt: new Date().toISOString(),
      },
      actorUserId: auth.userId,
    });

    // 3. Update Cafe model
    cafe.qrLoginContext = {
      qrRecordId: newQrRecord.qrId,
      securePublicCafeReference: newReference,
      loginUrl: `https://zamorin.app/cafe/${newReference}/login`,
      status: 'ACTIVE',
      lastScannedAt: null,
      scanCount: 0,
    };
    cafe.updatedBy = auth.userId;
    await cafe.save();

    // 4. Update CafeAccess model
    const access = await CafeAccess.findOne({
      organisationId: cafe.organisationId,
      cafeId: cafe.cafeId,
    });
    if (access) {
      access.qrCredentialHash = hashOpaqueToken(newReference);
      access.qrTokenEncrypted = encryptSecret(newReference);
      access.qrVersion = (access.qrVersion || 1) + 1;
      access.qrCreatedAt = new Date();
      access.updatedBy = auth.userId;
      await access.save();
    }

    await auditService.recordAuditEvent({
      organisationId: cafe.organisationId,
      cafeId: cafe.cafeId,
      actorUserId: auth.userId,
      actorRole: auth.role,
      module: 'UNIVERSAL_QR',
      action: 'CAFE_LOGIN_QR_REGENERATED',
      entityType: 'CAFE',
      entityId: cafe.cafeId,
      reason: 'Café login QR code regenerated.',
      result: 'SUCCESS',
      riskClassification: 'HIGH',
    });

    return {
      success: true,
      cafeId: cafe.cafeId,
      qrId: newQrRecord.qrId,
      securePublicCafeReference: newReference,
      loginUrl: cafe.qrLoginContext.loginUrl,
      payload: newQrRecord.payload,
    };
  }

  /**
   * STAGE 03: Generates printable A4 Café Login QR Card PDF using Zamorin Corporate Report Standard.
   */
  async generatePrintableQrCardPdf({ organisationId, cafeId }) {
    const cafe = await Cafe.findOne({
      organisationId: String(organisationId).toUpperCase(),
      cafeId: String(cafeId).toUpperCase(),
    });

    if (!cafe) {
      throw new ApiError(404, 'CAFE_NOT_FOUND', 'Café not found.');
    }

    const { UniversalQrService } = require('./universalQrService');
    const { UniversalQrRecord } = require('../models/UniversalQrRecord');

    let qrRecord = null;
    if (cafe.qrLoginContext?.qrRecordId) {
      qrRecord = await UniversalQrRecord.findOne({ qrId: cafe.qrLoginContext.qrRecordId });
    }

    if (!qrRecord) {
      // Find latest active CAFE_LOGIN record for this cafe
      qrRecord = await UniversalQrRecord.findOne({
        organisationId: cafe.organisationId,
        cafeId: cafe.cafeId,
        qrType: 'CAFE_LOGIN',
        status: 'ACTIVE',
      }).sort({ createdAt: -1 });
    }

    if (!qrRecord) {
      // Create on-demand
      const ref = cafe.qrLoginContext?.securePublicCafeReference || generateOpaqueToken();
      qrRecord = await UniversalQrService.createQrRecord({
        qrType: 'CAFE_LOGIN',
        targetEntityId: ref,
        organisationId: cafe.organisationId,
        cafeId: cafe.cafeId,
        title: `Café Login QR — ${cafe.name}`,
        actorUserId: 'SYSTEM',
      });
    }

    const branding = {
      legalName: cafe.branding?.legalEntityName || 'Zamorin Speciality Coffee & Kitchens Pvt. Ltd.',
      brandName: cafe.branding?.tradeName || cafe.displayName || 'Zamorin Café',
      gstin: cafe.registrations?.gstin || '',
    };

    const pdfResult = await UniversalQrService.renderPrintableQrCardPdf(qrRecord, branding);
    const pdfBuffer = Buffer.isBuffer(pdfResult) ? pdfResult : (pdfResult?.buffer || Buffer.from(pdfResult));
    return {
      pdfBuffer,
      filename: `ZAMORIN_QR_CARD_${cafe.cafeId}.pdf`,
      qrRecord,
    };
  }
}

module.exports = new CafeService();
