'use strict';

const { User } = require('../models/User');
const authService = require('../services/authService');

const ACCESS_TOKEN_COOKIE =
  'zamorin_access_token';

function extractAccessToken(request) {
  const authorizationHeader =
    request.get('authorization');

  if (authorizationHeader) {
    const [scheme, token] =
      authorizationHeader.split(' ');

    if (
      scheme?.toLowerCase() === 'bearer' &&
      token
    ) {
      return token.trim();
    }
  }

  if (
    request.cookies &&
    request.cookies[ACCESS_TOKEN_COOKIE]
  ) {
    return request.cookies[
      ACCESS_TOKEN_COOKIE
    ];
  }

  return null;
}

function sendAuthenticationError(
  response,
  code,
  message
) {
  return response.status(401).json({
    error: {
      code,
      message,
    },
  });
}

async function authenticate(
  request,
  response,
  next
) {
  try {
    const accessToken =
      extractAccessToken(request);

    if (!accessToken) {
      return sendAuthenticationError(
        response,
        'AUTHENTICATION_REQUIRED',
        'Authentication is required.'
      );
    }

    const {
      payload,
      session,
    } = await authService.verifyAccessToken(accessToken);

    const user = await User.findOne({
      organisationId: payload.org,
      userId: payload.sub,
      accountStatus: 'ACTIVE',
      archivedAt: null,
    });

    if (!user) {
      return sendAuthenticationError(
        response,
        'USER_UNAVAILABLE',
        'The authenticated user is unavailable.'
      );
    }

    if (
      user.role !== payload.role ||
      session.roleSnapshot !== user.role
    ) {
      return sendAuthenticationError(
        response,
        'ROLE_CHANGED',
        'Your access role has changed. Sign in again.'
      );
    }

    if (
      user.sessionVersion !== payload.usv ||
      user.permissionsVersion !== payload.pv
    ) {
      return sendAuthenticationError(
        response,
        'SECURITY_VERSION_CHANGED',
        'Your security permissions changed. Sign in again.'
      );
    }

    const assignedCafeIds = [
      ...new Set(
        (user.assignedCafeIds || [])
          .filter(Boolean)
          .map((cafeId) =>
            cafeId.trim().toUpperCase()
          )
      ),
    ];

    request.auth = {
      userId: user.userId,
      organisationId: user.organisationId,
      role: user.role,
      assignedCafeIds,
      primaryCafeId:
        user.primaryCafeId || null,
      sessionId: session.sessionId,
      mfaVerified:
        Boolean(session.mfaVerified),
      mfaVerifiedAt:
        session.mfaVerifiedAt || null,
      stepUpVerifiedAt:
        session.stepUpVerifiedAt || null,
      sessionVersion:
        session.sessionVersion,
      permissionsVersion:
        user.permissionsVersion,
    };

    request.authenticatedUser = user;
    request.authenticatedSession = session;

    return next();
  } catch (error) {
    return sendAuthenticationError(
      response,
      'INVALID_OR_EXPIRED_SESSION',
      'Your session is invalid or expired.'
    );
  }
}

function requireMfa(
  request,
  response,
  next
) {
  if (!request.auth) {
    return sendAuthenticationError(
      response,
      'AUTHENTICATION_REQUIRED',
      'Authentication is required.'
    );
  }

  if (!request.auth.mfaVerified) {
    return response.status(403).json({
      error: {
        code: 'MFA_REQUIRED',
        message:
          'Multi-factor authentication is required.',
      },
    });
  }

  return next();
}

function requireStepUpAuthentication(
  request,
  response,
  next
) {
  if (!request.auth) {
    return sendAuthenticationError(
      response,
      'AUTHENTICATION_REQUIRED',
      'Authentication is required.'
    );
  }

  const maximumAgeMinutes =
    Number.parseInt(
      process.env
        .STEP_UP_AUTH_MAX_AGE_MINUTES ||
        '10',
      10
    );

  const verifiedAt =
    request.auth.stepUpVerifiedAt;

  if (!verifiedAt) {
    return response.status(403).json({
      error: {
        code:
          'STEP_UP_AUTHENTICATION_REQUIRED',
        message:
          'Recent authentication is required for this action.',
      },
    });
  }

  const verifiedAtDate =
    new Date(verifiedAt);

  const expiresAt =
    verifiedAtDate.getTime() +
    maximumAgeMinutes * 60 * 1000;

  if (
    Number.isNaN(
      verifiedAtDate.getTime()
    ) ||
    expiresAt <= Date.now()
  ) {
    return response.status(403).json({
      error: {
        code:
          'STEP_UP_AUTHENTICATION_EXPIRED',
        message:
          'Recent authentication has expired.',
      },
    });
  }

  return next();
}

module.exports = {
  ACCESS_TOKEN_COOKIE,
  extractAccessToken,
  authenticate,
  requireMfa,
  requireStepUpAuthentication,
};