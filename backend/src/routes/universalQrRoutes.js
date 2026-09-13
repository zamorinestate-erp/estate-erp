'use strict';

const express = require('express');
const { authenticate } = require('../middleware/authenticate');
const { authorize } = require('../middleware/authorize');
const { UniversalQrService } = require('../services/universalQrService');
const { UniversalQrRecord } = require('../models/UniversalQrRecord');
const { CompanyIdentityService } = require('../services/companyIdentityService');
const { asyncHandler } = require('../utils/asyncHandler');
const { ApiError } = require('../utils/ApiError');

const router = express.Router();

// ── Public Verification Endpoint (Does NOT require authentication to scan/verify) ──
router.post(
  '/verify',
  asyncHandler(async (req, res) => {
    const { token, qrType, cafeId } = req.body || {};
    if (!token) {
      throw new ApiError(400, 'TOKEN_REQUIRED', 'Token parameter is required.');
    }

    const verification = await UniversalQrService.verifyQrToken(token, { qrType, cafeId });
    return res.status(200).json({
      success: true,
      message: 'QR code verified successfully.',
      data: verification,
    });
  })
);

// ── Authenticated Routes Below ──
router.use(authenticate);

// ── GET /api/v1/qr/:qrId (Retrieve QR Record & SVG Data) ──
router.get(
  '/:qrId',
  authorize('QR_GENERATE', { allowedRoles: ['MASTER', 'OWNER', 'CAFE_ADMIN'] }),
  asyncHandler(async (req, res) => {
    const record = await UniversalQrRecord.findOne({
      qrId: req.params.qrId,
      organisationId: req.auth.organisationId,
    }).lean();

    if (!record) {
      throw new ApiError(404, 'QR_NOT_FOUND', 'QR record not found.');
    }

    const svg = UniversalQrService.renderQrSvg(record.payload, { size: 256 });

    return res.status(200).json({
      success: true,
      data: {
        ...record,
        svg,
      },
    });
  })
);

// ── GET /api/v1/qr/:qrId/svg (Raw SVG Image Stream) ──
router.get(
  '/:qrId/svg',
  authorize('QR_GENERATE', { allowedRoles: ['MASTER', 'OWNER', 'CAFE_ADMIN'] }),
  asyncHandler(async (req, res) => {
    const record = await UniversalQrRecord.findOne({
      qrId: req.params.qrId,
      organisationId: req.auth.organisationId,
    }).lean();

    if (!record) {
      throw new ApiError(404, 'QR_NOT_FOUND', 'QR record not found.');
    }

    const svg = UniversalQrService.renderQrSvg(record.payload, { size: 300 });
    res.setHeader('Content-Type', 'image/svg+xml');
    return res.status(200).send(svg);
  })
);

// ── GET /api/v1/qr/:qrId/card-pdf (Printable QR Card PDF) ──
router.get(
  '/:qrId/card-pdf',
  authorize('QR_GENERATE', { allowedRoles: ['MASTER', 'OWNER', 'CAFE_ADMIN'] }),
  asyncHandler(async (req, res) => {
    const record = await UniversalQrRecord.findOne({
      qrId: req.params.qrId,
      organisationId: req.auth.organisationId,
    }).lean();

    if (!record) {
      throw new ApiError(404, 'QR_NOT_FOUND', 'QR record not found.');
    }

    const branding = await CompanyIdentityService.resolveExportBranding({
      cafeId: record.cafeId,
      organisationId: req.auth.organisationId,
    });

    const pdfResult = UniversalQrService.renderPrintableQrCardPdf(record, branding);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${record.qrId}-card.pdf"`);
    return res.status(200).send(pdfResult.buffer);
  })
);

// ── POST /api/v1/qr/generate (Issue new QR) ──
router.post(
  '/generate',
  authorize('QR_GENERATE', { allowedRoles: ['MASTER', 'OWNER', 'CAFE_ADMIN'] }),
  asyncHandler(async (req, res) => {
    const {
      qrType,
      targetEntityId,
      cafeId = null,
      title = null,
      metadata = {},
      ttlMinutes = null,
    } = req.body || {};

    const record = await UniversalQrService.createQrRecord({
      qrType,
      targetEntityId,
      organisationId: req.auth.organisationId,
      cafeId: cafeId || req.auth.primaryCafeId || null,
      title,
      metadata,
      ttlMinutes,
      actorUserId: req.auth.userId,
    });

    return res.status(201).json({
      success: true,
      message: 'Universal QR code generated successfully.',
      data: record,
    });
  })
);

// ── POST /api/v1/qr/:qrId/revoke ──
router.post(
  '/:qrId/revoke',
  authorize('QR_GENERATE', { allowedRoles: ['MASTER', 'OWNER'] }),
  asyncHandler(async (req, res) => {
    const { reason = 'Revoked by administrator' } = req.body || {};
    const revoked = await UniversalQrService.revokeQr(req.params.qrId, {
      reason,
      actorUserId: req.auth.userId,
    });

    return res.status(200).json({
      success: true,
      message: 'QR code revoked successfully.',
      data: revoked,
    });
  })
);

// ── POST /api/v1/qr/:qrId/regenerate ──
router.post(
  '/:qrId/regenerate',
  authorize('QR_GENERATE', { allowedRoles: ['MASTER', 'OWNER'] }),
  asyncHandler(async (req, res) => {
    const { reason = 'Token rotated' } = req.body || {};
    const fresh = await UniversalQrService.regenerateQr(req.params.qrId, {
      reason,
      actorUserId: req.auth.userId,
    });

    return res.status(201).json({
      success: true,
      message: 'QR code regenerated successfully. Old token has been revoked.',
      data: fresh,
    });
  })
);

module.exports = router;
