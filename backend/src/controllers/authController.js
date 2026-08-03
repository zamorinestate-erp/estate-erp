'use strict';

const {
  authenticatePassword,
  createSession,
  rotateRefreshToken,
  revokeSession,
  revokeAllUserSessions,
} = require('../services/authService');

const {
  asyncHandler,
} = require('../utils/asyncHandler');

const {
  ApiError,
} = require('../utils/ApiError');

const {
  ACCESS_TOKEN_COOKIE,
} = require('../middleware/authenticate');

const REFRESH_TOKEN_COOKIE =
  'zamorin_refresh_token';

const SESSION_ID_COOKIE =
  'zamorin_session_id';

const DEVICE_TYPES = new Set([
  'DESKTOP',
  'LAPTOP',
  'TABLET',
  'MOBILE',
  'PWA',
  'OTHER',
]);

function normalizeDeviceType(value) {
  const normalizedValue =
    typeof value === 'string'
      ? value.trim().toUpperCase()
      : 'OTHER';

  return DEVICE_TYPES.has(normalizedValue)
    ? normalizedValue
    : 'OTHER';
}

function buildDeviceMetadata(request) {
  const device = request.body?.device || {};

  return {
    deviceId:
      typeof device.deviceId === 'string'
        ? device.deviceId.trim()
        : '',

    deviceName:
      typeof device.deviceName === 'string'
        ? device.deviceName.trim()
        : 'Unknown device',

    deviceType: normalizeDeviceType(
      device.deviceType
    ),

    operatingSystem:
      typeof device.operatingSystem === 'string'
        ? device.operatingSystem.trim()
        : '',

    browser:
      typeof device.browser === 'string'
        ? device.browser.trim()
        : '',

    userAgent:
      request.get('user-agent') || '',
  };
}

function maskIpAddress(value) {
  if (
    typeof value !== 'string' ||
    !value.trim()
  ) {
    return null;
  }

  const ipAddress = value
    .split(',')[0]
    .trim();

  if (ipAddress.includes(':')) {
    const segments = ipAddress
      .split(':')
      .filter(Boolean);

    return segments.length > 0
      ? `${segments.slice(0, 4).join(':')}::`
      : null;
  }

  const octets = ipAddress.split('.');

  if (octets.length === 4) {
    return `${octets[0]}.${octets[1]}.x.x`;
  }

  return null;
}

function buildNetworkMetadata(request) {
  const forwardedFor =
    request.get('x-forwarded-for');

  const ipAddress =
    forwardedFor ||
    request.ip ||
    request.socket?.remoteAddress ||
    '';

  return {
    ipAddressMasked:
      maskIpAddress(ipAddress),

    country: null,
    region: null,
    city: null,
  };
}

function getCookieOptions() {
  const isProduction =
    process.env.NODE_ENV === 'production';

  return {
    httpOnly: true,
    secure: isProduction,
    sameSite:
      isProduction ? 'none' : 'lax',
    path: '/',
  };
}

function setAuthenticationCookies(
  response,
  sessionData
) {
  const cookieOptions =
    getCookieOptions();

  response.cookie(
    ACCESS_TOKEN_COOKIE,
    sessionData.accessToken,
    {
      ...cookieOptions,
      expires: new Date(
        sessionData.accessTokenExpiresAt
      ),
    }
  );

  response.cookie(
    REFRESH_TOKEN_COOKIE,
    sessionData.refreshToken,
    {
      ...cookieOptions,
      expires: new Date(
        sessionData.refreshTokenExpiresAt
      ),
    }
  );

  response.cookie(
    SESSION_ID_COOKIE,
    sessionData.session.sessionId,
    {
      ...cookieOptions,
      expires: new Date(
        sessionData.refreshTokenExpiresAt
      ),
    }
  );
}

function clearAuthenticationCookies(
  response
) {
  const cookieOptions =
    getCookieOptions();

  response.clearCookie(
    ACCESS_TOKEN_COOKIE,
    cookieOptions
  );

  response.clearCookie(
    REFRESH_TOKEN_COOKIE,
    cookieOptions
  );

  response.clearCookie(
    SESSION_ID_COOKIE,
    cookieOptions
  );
}

function getLoginInput(request) {
  const {
    organisationId,
    email,
    password,
  } = request.body || {};
  function getRefreshInput(request) {
  const sessionId =
    request.cookies?.[SESSION_ID_COOKIE] ||
    request.body?.sessionId;

  const refreshToken =
    request.cookies?.[REFRESH_TOKEN_COOKIE] ||
    request.body?.refreshToken;

  const deviceId =
    request.get('x-device-id') ||
    request.body?.deviceId;

  if (
    typeof sessionId !== 'string' ||
    !sessionId.trim() ||
    typeof refreshToken !== 'string' ||
    !refreshToken ||
    typeof deviceId !== 'string' ||
    !deviceId.trim()
  ) {
    throw new ApiError(
      401,
      'REFRESH_SESSION_REQUIRED',
      'Session ID, refresh token and device ID are required.'
    );
  }

  return {
    sessionId: sessionId.trim(),
    refreshToken,
    deviceId: deviceId.trim(),
  };
}

  if (
    typeof organisationId !== 'string' ||
    !organisationId.trim() ||
    typeof email !== 'string' ||
    !email.trim() ||
    typeof password !== 'string' ||
    !password
  ) {
    throw new ApiError(
      400,
      'LOGIN_FIELDS_REQUIRED',
      'Organisation ID, email and password are required.'
    );
  }

  const device =
    buildDeviceMetadata(request);

  if (!device.deviceId) {
    throw new ApiError(
      400,
      'DEVICE_ID_REQUIRED',
      'A device ID is required.'
    );
  }

  return {
    organisationId:
      organisationId.trim(),

    email: email.trim(),

    password,

    device,

    network:
      buildNetworkMetadata(request),
  };
}

const login = asyncHandler(
  async (request, response) => {
    const loginInput =
      getLoginInput(request);

    let authenticationResult;

    try {
      authenticationResult =
        await authenticatePassword({
          organisationId:
            loginInput.organisationId,

          email:
            loginInput.email,

          password:
            loginInput.password,
        });
    } catch (error) {
      throw new ApiError(
        401,
        'INVALID_LOGIN',
        error.message ||
          'Invalid login credentials.'
      );
    }

    const {
      user,
      requiresMfa,
      mfaSetupRequired,
      mustChangePassword,
    } = authenticationResult;

    if (requiresMfa) {
      return response.status(403).json({
        success: false,

        error: {
          code: mfaSetupRequired
            ? 'MFA_SETUP_REQUIRED'
            : 'MFA_REQUIRED',

          message: mfaSetupRequired
            ? 'Multi-factor authentication setup is required.'
            : 'Multi-factor authentication is required.',
        },

        data: {
          userId: user.userId,
          role: user.role,
          mfaSetupRequired,
        },

        correlationId:
          request.correlationId || null,
      });
    }

    const sessionData =
      await createSession({
        user,
        device: loginInput.device,
        network: loginInput.network,
        mfaVerified: false,
        createdBy: user.userId,
      });

    setAuthenticationCookies(
      response,
      sessionData
    );

    return response.status(200).json({
      success: true,
      message: 'Login successful.',

      data: {
        user: user.toJSON(),
        session: sessionData.session,
        mustChangePassword,
      },

      correlationId:
        request.correlationId || null,
    });
  }
);
const refreshSession = asyncHandler(
  async (request, response) => {
    const refreshInput =
      getRefreshInput(request);

    let sessionData;

    try {
      sessionData =
        await rotateRefreshToken(
          refreshInput
        );
    } catch (error) {
      clearAuthenticationCookies(
        response
      );

      throw new ApiError(
        401,
        'INVALID_REFRESH_SESSION',
        error.message ||
          'The refresh session is invalid or expired.'
      );
    }

    setAuthenticationCookies(
      response,
      sessionData
    );

    return response.status(200).json({
      success: true,
      message:
        'Session refreshed successfully.',
      data: {
        session: sessionData.session,
      },
      correlationId:
        request.correlationId || null,
    });
  }
);
const logout = asyncHandler(
  async (request, response) => {
    await revokeSession({
      sessionId: request.auth.sessionId,
      revokedBy: request.auth.userId,
      reason: 'USER_LOGOUT',
      details: 'User signed out.',
    });

    clearAuthenticationCookies(response);

    return response.status(200).json({
      success: true,
      message: 'Logout successful.',
      correlationId:
        request.correlationId || null,
    });
  }
);
const logoutAll = asyncHandler(
  async (request, response) => {
    const revokedSessionCount =
      await revokeAllUserSessions({
        organisationId:
          request.auth.organisationId,
        userId: request.auth.userId,
        revokedBy: request.auth.userId,
        reason: 'LOGOUT_ALL',
        details:
          'User signed out from all devices.',
      });

    clearAuthenticationCookies(response);

    return response.status(200).json({
      success: true,
      message:
        'All active sessions were logged out successfully.',
      data: {
        revokedSessionCount,
      },
      correlationId:
        request.correlationId || null,
    });
  }
);

module.exports = {
  login,
  refreshSession,
  logout,
  logoutAll,
  clearAuthenticationCookies,
};