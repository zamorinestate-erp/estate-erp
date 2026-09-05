'use strict';

const cafeService = require('../services/cafeService');
const { asyncHandler } = require('../utils/asyncHandler');
const { ApiError } = require('../utils/ApiError');

function requireGovernance(req) {
  if (!req.auth || !req.auth.role) {
    throw new ApiError(401, 'UNAUTHENTICATED', 'Authentication required.');
  }
  const role = req.auth.role.toUpperCase();
  if (role !== 'MASTER' && role !== 'OWNER') {
    throw new ApiError(
      403,
      'GOVERNANCE_ACCESS_REQUIRED',
      'Only Master and Owner roles may manage Café Operations access.'
    );
  }
}

const resolveGateway = asyncHandler(async (req, res) => {
  const { method, credential } = req.body || {};

  const result = await cafeService.resolveGatewayCredential({
    method,
    credential,
    clientIp: req.ip,
    userAgent: req.headers['user-agent'],
    correlationId: req.correlationId || req.headers['x-correlation-id'],
  });

  return res.status(200).json({
    success: true,
    message: 'Café Operations gateway resolved successfully.',
    data: result,
  });
});

const getAccessSummary = asyncHandler(async (req, res) => {
  requireGovernance(req);

  const cafeId = (req.params.cafeId || '').trim().toUpperCase();
  if (!cafeId) {
    throw new ApiError(400, 'CAFE_ID_REQUIRED', 'Café ID is required.');
  }

  const summary = await cafeService.getCafeAccessSummary(
    req.auth.organisationId,
    cafeId
  );

  return res.status(200).json({
    success: true,
    data: summary,
  });
});

const revealPermanentPin = asyncHandler(async (req, res) => {
  requireGovernance(req);

  const cafeId = (req.params.cafeId || '').trim().toUpperCase();
  const { currentPassword } = req.body || {};

  const result = await cafeService.revealPermanentPin({
    organisationId: req.auth.organisationId,
    cafeId,
    auth: req.auth,
    currentPassword,
    clientIp: req.ip,
    userAgent: req.headers['user-agent'],
  });

  return res.status(200).json({
    success: true,
    message: 'Permanent Café PIN revealed successfully.',
    data: result,
  });
});

const rotateQr = asyncHandler(async (req, res) => {
  requireGovernance(req);

  const cafeId = (req.params.cafeId || '').trim().toUpperCase();
  const { currentPassword } = req.body || {};

  const result = await cafeService.rotateQrCredential({
    organisationId: req.auth.organisationId,
    cafeId,
    auth: req.auth,
    currentPassword,
    clientIp: req.ip,
    userAgent: req.headers['user-agent'],
  });

  return res.status(200).json({
    success: true,
    message: 'QR access credential rotated successfully.',
    data: result,
  });
});

const rotateLink = asyncHandler(async (req, res) => {
  requireGovernance(req);

  const cafeId = (req.params.cafeId || '').trim().toUpperCase();
  const { currentPassword } = req.body || {};

  const result = await cafeService.rotateLinkCredential({
    organisationId: req.auth.organisationId,
    cafeId,
    auth: req.auth,
    currentPassword,
    clientIp: req.ip,
    userAgent: req.headers['user-agent'],
  });

  return res.status(200).json({
    success: true,
    message: 'Login link credential rotated successfully.',
    data: result,
  });
});

const emergencyLock = asyncHandler(async (req, res) => {
  requireGovernance(req);

  const cafeId = (req.params.cafeId || '').trim().toUpperCase();
  const { reason, currentPassword } = req.body || {};

  const result = await cafeService.setEmergencyLock({
    organisationId: req.auth.organisationId,
    cafeId,
    lock: true,
    reason,
    auth: req.auth,
    currentPassword,
    clientIp: req.ip,
    userAgent: req.headers['user-agent'],
  });

  return res.status(200).json({
    success: true,
    message: 'Café Operations Emergency Lock engaged.',
    data: result,
  });
});

const emergencyUnlock = asyncHandler(async (req, res) => {
  requireGovernance(req);

  const cafeId = (req.params.cafeId || '').trim().toUpperCase();
  const { reason, currentPassword } = req.body || {};

  const result = await cafeService.setEmergencyLock({
    organisationId: req.auth.organisationId,
    cafeId,
    lock: false,
    reason,
    auth: req.auth,
    currentPassword,
    clientIp: req.ip,
    userAgent: req.headers['user-agent'],
  });

  return res.status(200).json({
    success: true,
    message: 'Café Operations Emergency Lock released.',
    data: result,
  });
});

const runAccessTest = asyncHandler(async (req, res) => {
  requireGovernance(req);

  const cafeId = (req.params.cafeId || '').trim().toUpperCase();

  const results = await cafeService.runAccessHealthCheck({
    organisationId: req.auth.organisationId,
    cafeId,
    auth: req.auth,
  });

  return res.status(200).json({
    success: true,
    data: results,
  });
});

module.exports = {
  resolveGateway,
  getAccessSummary,
  revealPermanentPin,
  rotateQr,
  rotateLink,
  emergencyLock,
  emergencyUnlock,
  runAccessTest,
};
