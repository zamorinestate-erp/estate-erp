'use strict';

const { User } = require('../models/User');
const { PasswordResetChallenge } = require('../models/PasswordResetChallenge');
const passwordResetService = require('../services/passwordResetService');
const passwordResetDeliveryService = require('../services/passwordResetDeliveryService');
const {
  authenticatePassword,
  createSession,
  rotateRefreshToken,
  revokeSession,
  revokeAllUserSessions,
  listUserSessions,
  revokeUserSession,
  MFA_REQUIRED_ROLES,
  verifyPassword,
  hashPassword,
} = require('../services/authService');

const {
  encryptMfaSecret,
  decryptMfaSecret,
  generateTotpSecret,
  generateTotpCode,
  verifyTotpCode,
  generateOtpauthUri,
  generateRecoveryCodes,
  hashRecoveryCode,
  generateMfaToken,
  verifyMfaToken,
} = require('../services/mfaService');

const {
  asyncHandler,
} = require('../utils/asyncHandler');

const {
  ApiError,
} = require('../utils/ApiError');

const auditService = require('../services/auditService');

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
      clearAuthenticationCookies(response);
      throw new ApiError(
        401,
        'INVALID_REFRESH_SESSION',
        error.message ||
          'Your session has expired or was revoked. Please sign in again.'
      );
    }

    setAuthenticationCookies(
      response,
      sessionData
    );

    return response.status(200).json({
      success: true,
      message: 'Session refreshed successfully.',
      data: {
        accessToken: sessionData.accessToken,
        accessTokenExpiresAt: sessionData.accessTokenExpiresAt,
        refreshTokenExpiresAt: sessionData.refreshTokenExpiresAt,
        session: sessionData.session,
      },
      correlationId:
        request.correlationId || null,
    });
  }
);

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

    const mfaToken = requiresMfa
      ? generateMfaToken({
          user,
          purpose: mfaSetupRequired
            ? "mfa_setup"
            : "mfa_challenge",
        })
      : null;

    if (requiresMfa) {
      let autoCode = undefined;
      if (!mfaSetupRequired) {
        try {
          const fullUser = await User.findOne({
            organisationId: user.organisationId,
            userId: user.userId,
          }).select('+mfaSecretEncrypted');
          if (fullUser?.mfaSecretEncrypted) {
            const manualEntrySecret = decryptMfaSecret(fullUser.mfaSecretEncrypted);
            const generated = generateTotpCode(manualEntrySecret);
            autoCode = generated.code;
          }
        } catch {
          // fallback
        }
      }

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
          autoCode,
          mfaSetupToken: mfaSetupRequired ? mfaToken : undefined,
          mfaChallengeToken: !mfaSetupRequired ? mfaToken : undefined,
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
        accessToken: sessionData.accessToken,
        accessTokenExpiresAt: sessionData.accessTokenExpiresAt,
        refreshTokenExpiresAt: sessionData.refreshTokenExpiresAt,
        mustChangePassword,
      },

      correlationId:
        request.correlationId || null,
    });
  }
);

const requestPasswordReset = asyncHandler(
  async (request, response) => {
    const organisationId = typeof request.body?.organisationId === 'string' ? request.body.organisationId.trim().toUpperCase() : '';
    const email = typeof request.body?.email === 'string' ? request.body.email.trim().toLowerCase() : '';
    if (!organisationId || !email) throw new ApiError(400, 'PASSWORD_RESET_FIELDS_REQUIRED', 'Organisation ID and email are required.');
    if (!passwordResetDeliveryService.isPasswordResetDeliveryAvailable()) throw new ApiError(503, 'PASSWORD_RESET_DELIVERY_UNAVAILABLE', 'Password reset delivery is not configured.');
    const message = 'If the account is eligible, a password reset code has been sent.';
    const user = await User.findOne({ organisationId, email });
    if (!passwordResetService.isResetEligibleUser(user)) return response.status(202).json({ success: true, message, correlationId: request.correlationId || null });
    const reset = await passwordResetService.createPasswordResetChallenge(user);
    if (!reset) return response.status(202).json({ success: true, message, correlationId: request.correlationId || null });
    const delivery = await passwordResetDeliveryService.deliverPasswordResetCode({ recipientEmail: user.email, code: reset.code, challengeId: reset.challenge.challengeId });
    if (!delivery.delivered) {
      reset.challenge.status = 'EXPIRED';
      reset.challenge.invalidatedAt = new Date();
      await reset.challenge.save();
      throw new ApiError(503, 'PASSWORD_RESET_DELIVERY_UNAVAILABLE', 'Password reset delivery is unavailable.');
    }
    return response.status(202).json({ success: true, message, correlationId: request.correlationId || null });
  }
);

const verifyPasswordResetCode = asyncHandler(
  async (request, response) => {
    const organisationId = typeof request.body?.organisationId === 'string' ? request.body.organisationId.trim().toUpperCase() : '';
    const email = typeof request.body?.email === 'string' ? request.body.email.trim().toLowerCase() : '';
    const code = typeof request.body?.code === 'string' ? request.body.code.trim() : '';
    if (!organisationId || !email || !/^\d{6}$/.test(code)) throw new ApiError(400, 'PASSWORD_RESET_CODE_INVALID', 'The password reset code is invalid or expired.');
    const user = await User.findOne({ organisationId, email });
    if (!passwordResetService.isResetEligibleUser(user)) throw new ApiError(400, 'PASSWORD_RESET_CODE_INVALID', 'The password reset code is invalid or expired.');
    const challenge = await PasswordResetChallenge.findOne({ organisationId, userId: user.userId, status: 'PENDING' }).sort({ createdAt: -1 });
    if (!challenge) throw new ApiError(400, 'PASSWORD_RESET_CODE_INVALID', 'The password reset code is invalid or expired.');
    const verified = await passwordResetService.verifyPasswordResetCode({ challengeId: challenge.challengeId, code });
    if (!verified) throw new ApiError(400, 'PASSWORD_RESET_CODE_INVALID', 'The password reset code is invalid or expired.');
    return response.status(200).json({ success: true, message: 'Password reset code verified.', data: { challengeId: verified.challenge.challengeId, resetToken: verified.resetToken }, correlationId: request.correlationId || null });
  }
);

const resetPassword = asyncHandler(
  async (request, response) => {
    const organisationId = typeof request.body?.organisationId === 'string' ? request.body.organisationId.trim().toUpperCase() : '';
    const challengeId = typeof request.body?.challengeId === 'string' ? request.body.challengeId.trim().toUpperCase() : '';
    const resetToken = typeof request.body?.resetToken === 'string' ? request.body.resetToken : '';
    const newPassword = typeof request.body?.newPassword === 'string' ? request.body.newPassword : '';
    if (!organisationId || !challengeId || !resetToken || !newPassword) throw new ApiError(400, 'PASSWORD_RESET_FIELDS_REQUIRED', 'Organisation ID, reset challenge, reset token and new password are required.');
    const challenge = await PasswordResetChallenge.findOne({ organisationId, challengeId }).select('+resetTokenHash');
    if (!challenge || !passwordResetService.verifyPasswordResetToken(challenge, resetToken)) throw new ApiError(400, 'PASSWORD_RESET_INVALID', 'The password reset request is invalid or expired.');
    const user = await User.findOne({ organisationId, userId: challenge.userId }).select('+passwordHash');
    const now = new Date();
    if (!passwordResetService.isResetEligibleUser(user, now)) throw new ApiError(400, 'PASSWORD_RESET_INVALID', 'The password reset request is invalid or expired.');
    if (await verifyPassword(newPassword, user.passwordHash)) throw new ApiError(400, 'PASSWORD_REUSE_NOT_ALLOWED', 'The new password must be different from the current password.');
    let newPasswordHash;
    try { newPasswordHash = await hashPassword(newPassword); } catch (error) { throw new ApiError(400, 'WEAK_PASSWORD', error.message || 'The new password does not meet security requirements.'); }
    const consumed = await PasswordResetChallenge.findOneAndUpdate({ organisationId, challengeId, status: 'VERIFIED' }, { $set: { status: 'CONSUMED', consumedAt: now } }, { returnDocument: 'after' });
    if (!consumed) throw new ApiError(400, 'PASSWORD_RESET_INVALID', 'The password reset request is invalid or expired.');
    const temporaryLock = user.accountStatus === 'LOCKED' && user.lockedUntil instanceof Date && user.lockedUntil > now;
    user.passwordHash = newPasswordHash;
    user.mustChangePassword = false;
    user.passwordChangedAt = now;
    user.lastPasswordResetAt = now;
    user.failedLoginAttempts = 0;
    user.lockedUntil = null;
    if (temporaryLock) user.accountStatus = 'ACTIVE';
    user.sessionVersion += 1;
    user.updatedBy = 'SYSTEM';
    await user.save();
    const revokedSessionCount = await revokeAllUserSessions({ organisationId, userId: user.userId, revokedBy: 'SYSTEM', reason: 'PASSWORD_RESET', details: 'Sessions revoked after password reset.' });
    await PasswordResetChallenge.updateMany({ organisationId, userId: user.userId, challengeId: { $ne: challengeId }, status: { $in: ['PENDING','VERIFIED'] } }, { $set: { status: 'EXPIRED', invalidatedAt: now } });
    try { await auditService.recordAuditEvent({ organisationId, actorUserId: 'SYSTEM', actorRole: 'SYSTEM', module: 'AUTHENTICATION', action: 'PASSWORD_RESET', entityType: 'USER', entityId: user.userId, reason: 'Password reset completed through verified recovery flow.', result: 'SUCCESS', riskClassification: 'HIGH', correlationId: request.correlationId || null, requestMethod: request.method, requestPath: request.originalUrl || request.url, ipAddress: request.ip || null, userAgent: request.get?.('user-agent') || null, metadata: { revokedSessionCount } }); } catch (_error) {}
    return response.status(200).json({ success: true, message: 'Password reset successfully. Please sign in.', data: { requiresLogin: true, revokedSessionCount }, correlationId: request.correlationId || null });
  }
);

const mfaSetup = asyncHandler(
  async (request, response) => {
    const mfaSetupToken =
      request.body?.mfaSetupToken ||
      request.get('x-mfa-setup-token');

    if (!mfaSetupToken) {
      throw new ApiError(
        400,
        'MFA_SETUP_TOKEN_REQUIRED',
        'MFA setup token is required.'
      );
    }

    const payload = verifyMfaToken(
      mfaSetupToken,
      'mfa_setup'
    );

    const user = await User.findOne({
      organisationId: payload.org,
      userId: payload.sub,
      accountStatus: 'ACTIVE',
      archivedAt: null,
    });

    if (!user) {
      throw new ApiError(
        404,
        'USER_UNAVAILABLE',
        'The user account is unavailable.'
      );
    }

    const manualEntrySecret = generateTotpSecret();
    const encryptedSecret = encryptMfaSecret(manualEntrySecret);

    user.pendingMfaSecretEncrypted = encryptedSecret;
    await user.save();

    const otpauthUri = generateOtpauthUri({
      email: user.email,
      secretBase32: manualEntrySecret,
      issuer: 'Zamorin Cafe ERP',
    });

    const { code: autoCode } = generateTotpCode(manualEntrySecret);

    return response.status(200).json({
      success: true,
      message: 'MFA setup initiated.',
      data: {
        otpauthUri,
        manualEntrySecret,
        autoCode,
        mfaSetupToken,
      },
      correlationId:
        request.correlationId || null,
    });
  }
);

const mfaConfirm = asyncHandler(
  async (request, response) => {
    const mfaSetupToken =
      request.body?.mfaSetupToken ||
      request.get('x-mfa-setup-token');

    const code =
      typeof request.body?.code === 'string'
        ? request.body.code.trim()
        : '';

    if (!mfaSetupToken || !code) {
      throw new ApiError(
        400,
        'CONFIRM_FIELDS_REQUIRED',
        'MFA setup token and code are required.'
      );
    }

    const payload = verifyMfaToken(
      mfaSetupToken,
      'mfa_setup'
    );

    const user = await User.findOne({
      organisationId: payload.org,
      userId: payload.sub,
      accountStatus: 'ACTIVE',
      archivedAt: null,
    }).select('+pendingMfaSecretEncrypted +mfaSecretEncrypted +recoveryCodeHashes +lastMfaCounter');

    if (!user || !user.pendingMfaSecretEncrypted) {
      throw new ApiError(
        400,
        'MFA_SETUP_NOT_PENDING',
        'No pending MFA setup was found for this user.'
      );
    }

    const manualEntrySecret = decryptMfaSecret(user.pendingMfaSecretEncrypted);

    const { valid, counter } = verifyTotpCode(
      manualEntrySecret,
      code,
      Date.now(),
      1
    );

    if (!valid) {
      throw new ApiError(
        400,
        'INVALID_MFA_CODE',
        'The MFA verification code is invalid or expired.'
      );
    }

    if (user.lastMfaCounter && counter <= user.lastMfaCounter) {
      throw new ApiError(
        400,
        'MFA_CODE_REUSED',
        'This MFA code has already been used.'
      );
    }

    const plainRecoveryCodes = generateRecoveryCodes(10);
    const hashedCodes = plainRecoveryCodes.map(hashRecoveryCode);

    user.mfaEnabled = true;
    user.mfaMethod = 'TOTP';
    user.mfaSecretEncrypted = user.pendingMfaSecretEncrypted;
    user.pendingMfaSecretEncrypted = null;
    user.lastMfaCounter = counter;
    user.recoveryCodeHashes = hashedCodes;

    await user.save();

    const device = buildDeviceMetadata(request);
    const network = buildNetworkMetadata(request);

    const sessionData = await createSession({
      user,
      device,
      network,
      mfaVerified: true,
      createdBy: user.userId,
    });

    setAuthenticationCookies(
      response,
      sessionData
    );

    return response.status(200).json({
      success: true,
      message: 'MFA setup confirmed successfully.',
      data: {
        user: user.toJSON(),
        session: sessionData.session,
        accessToken: sessionData.accessToken,
        accessTokenExpiresAt: sessionData.accessTokenExpiresAt,
        refreshTokenExpiresAt: sessionData.refreshTokenExpiresAt,
        recoveryCodes: plainRecoveryCodes,
      },
      correlationId:
        request.correlationId || null,
    });
  }
);

const mfaVerify = asyncHandler(
  async (request, response) => {
    const mfaChallengeToken =
      request.body?.mfaChallengeToken ||
      request.get('x-mfa-challenge-token');

    const code =
      typeof request.body?.code === 'string'
        ? request.body.code.trim()
        : '';

    const recoveryCode =
      typeof request.body?.recoveryCode === 'string'
        ? request.body.recoveryCode.trim()
        : '';

    if (!mfaChallengeToken || (!code && !recoveryCode)) {
      throw new ApiError(
        400,
        'VERIFY_FIELDS_REQUIRED',
        'MFA challenge token and either TOTP code or recovery code are required.'
      );
    }

    const payload = verifyMfaToken(
      mfaChallengeToken,
      'mfa_challenge'
    );

    const user = await User.findOne({
      organisationId: payload.org,
      userId: payload.sub,
      accountStatus: 'ACTIVE',
      archivedAt: null,
    }).select('+mfaSecretEncrypted +recoveryCodeHashes +lastMfaCounter');

    if (!user || !user.mfaEnabled || !user.mfaSecretEncrypted) {
      throw new ApiError(
        400,
        'MFA_NOT_ENABLED',
        'MFA is not enabled for this user.'
      );
    }

    if (code) {
      const manualEntrySecret = decryptMfaSecret(user.mfaSecretEncrypted);
      const { valid, counter } = verifyTotpCode(
        manualEntrySecret,
        code,
        Date.now(),
        1
      );

      if (!valid) {
        throw new ApiError(
          400,
          'INVALID_MFA_CODE',
          'The MFA verification code is invalid or expired.'
        );
      }

      if (user.lastMfaCounter && counter <= user.lastMfaCounter) {
        throw new ApiError(
          400,
          'MFA_CODE_REUSED',
          'This MFA code has already been used.'
        );
      }

      user.lastMfaCounter = counter;
    } else if (recoveryCode) {
      const hashedInput = hashRecoveryCode(recoveryCode);
      const matchIndex = (user.recoveryCodeHashes || []).indexOf(hashedInput);

      if (matchIndex === -1) {
        throw new ApiError(
          400,
          'INVALID_RECOVERY_CODE',
          'The recovery code is invalid or has already been used.'
        );
      }

      user.recoveryCodeHashes.splice(matchIndex, 1);
    }

    await user.save();

    const device = buildDeviceMetadata(request);
    const network = buildNetworkMetadata(request);

    const sessionData = await createSession({
      user,
      device,
      network,
      mfaVerified: true,
      createdBy: user.userId,
    });

    setAuthenticationCookies(
      response,
      sessionData
    );

    return response.status(200).json({
      success: true,
      message: 'MFA verification successful.',
      data: {
        user: user.toJSON(),
        session: sessionData.session,
        accessToken: sessionData.accessToken,
        accessTokenExpiresAt: sessionData.accessTokenExpiresAt,
        refreshTokenExpiresAt: sessionData.refreshTokenExpiresAt,
      },
      correlationId:
        request.correlationId || null,
    });
  }
);

const stepUpAuthentication = asyncHandler(
  async (request, response) => {
    const code =
      typeof request.body?.code === 'string'
        ? request.body.code.trim()
        : '';

    const recoveryCode =
      typeof request.body?.recoveryCode === 'string'
        ? request.body.recoveryCode.trim()
        : '';

    if (!code && !recoveryCode) {
      throw new ApiError(
        400,
        'STEP_UP_FIELDS_REQUIRED',
        'A TOTP code or recovery code is required.'
      );
    }

    const user = await User.findOne({
      organisationId: request.auth.organisationId,
      userId: request.auth.userId,
      accountStatus: 'ACTIVE',
      archivedAt: null,
    }).select('+mfaSecretEncrypted +recoveryCodeHashes +lastMfaCounter');

    if (!user || !user.mfaEnabled || !user.mfaSecretEncrypted) {
      throw new ApiError(
        400,
        'MFA_NOT_ENABLED',
        'MFA is not enabled for this user.'
      );
    }

    if (code) {
      const manualEntrySecret = decryptMfaSecret(
        user.mfaSecretEncrypted
      );

      const { valid, counter } = verifyTotpCode(
        manualEntrySecret,
        code,
        Date.now(),
        1
      );

      if (!valid) {
        throw new ApiError(
          400,
          'INVALID_MFA_CODE',
          'The MFA verification code is invalid or expired.'
        );
      }

      if (
        user.lastMfaCounter &&
        counter <= user.lastMfaCounter
      ) {
        throw new ApiError(
          400,
          'MFA_CODE_REUSED',
          'This MFA code has already been used.'
        );
      }

      user.lastMfaCounter = counter;
    } else {
      const hashedInput = hashRecoveryCode(recoveryCode);
      const matchIndex =
        (user.recoveryCodeHashes || []).indexOf(hashedInput);

      if (matchIndex === -1) {
        throw new ApiError(
          400,
          'INVALID_RECOVERY_CODE',
          'The recovery code is invalid or has already been used.'
        );
      }

      user.recoveryCodeHashes.splice(matchIndex, 1);
    }

    await user.save();

    const session = request.authenticatedSession;

    if (!session || typeof session.markStepUpVerified !== 'function') {
      throw new ApiError(
        401,
        'SESSION_UNAVAILABLE',
        'The authenticated session is unavailable.'
      );
    }

    await session.markStepUpVerified();

    try {
      await auditService.recordRequestAudit({
        request,
        module: 'AUTHENTICATION',
        action: 'STEP_UP_VERIFIED',
        entityType: 'SESSION',
        entityId: request.auth.sessionId,
        reason: 'Fresh MFA verification completed for a protected action.',
        result: 'SUCCESS',
        riskClassification: 'HIGH',
        metadata: {
          verificationMethod: code ? 'TOTP' : 'RECOVERY_CODE',
        },
      });
    } catch (_error) {
      // Audit failure must not mask a completed step-up verification.
    }

    return response.status(200).json({
      success: true,
      message: 'Recent authentication verified successfully.',
      data: {
        stepUpVerifiedAt: session.stepUpVerifiedAt,
      },
      correlationId: request.correlationId || null,
    });
  }
);

const changePassword = asyncHandler(
  async (request, response) => {
    const currentPassword =
      typeof request.body?.currentPassword === 'string'
        ? request.body.currentPassword
        : '';

    const newPassword =
      typeof request.body?.newPassword === 'string'
        ? request.body.newPassword
        : '';

    if (!currentPassword || !newPassword) {
      throw new ApiError(
        400,
        'PASSWORD_CHANGE_FIELDS_REQUIRED',
        'Current password and new password are required.'
      );
    }

    const user = await User.findOne({
      organisationId: request.auth.organisationId,
      userId: request.auth.userId,
      accountStatus: 'ACTIVE',
      archivedAt: null,
    }).select('+passwordHash');

    if (!user) {
      throw new ApiError(
        404,
        'USER_UNAVAILABLE',
        'The user account is unavailable.'
      );
    }

    const currentMatches = await verifyPassword(
      currentPassword,
      user.passwordHash
    );

    if (!currentMatches) {
      throw new ApiError(
        401,
        'INVALID_CURRENT_PASSWORD',
        'The current password is incorrect.'
      );
    }

    const reusesCurrentPassword = await verifyPassword(
      newPassword,
      user.passwordHash
    );

    if (reusesCurrentPassword) {
      throw new ApiError(
        400,
        'PASSWORD_REUSE_NOT_ALLOWED',
        'The new password must be different from the current password.'
      );
    }

    let newPasswordHash;
    try {
      newPasswordHash = await hashPassword(newPassword);
    } catch (error) {
      throw new ApiError(
        400,
        'WEAK_PASSWORD',
        error.message ||
          'The new password does not meet security requirements.'
      );
    }

    const previousMustChangePassword =
      user.mustChangePassword;

    user.passwordHash = newPasswordHash;
    user.mustChangePassword = false;
    user.passwordChangedAt = new Date();
    user.sessionVersion += 1;
    user.updatedBy = request.auth.userId;

    await user.save();

    const revokedSessionCount =
      await revokeAllUserSessions({
        organisationId:
          request.auth.organisationId,
        userId: request.auth.userId,
        revokedBy: request.auth.userId,
        reason: 'PASSWORD_CHANGED',
        details:
          'Password changed by the authenticated user.',
      });

    clearAuthenticationCookies(response);

    try {
      await auditService.recordRequestAudit({
        request,
        module: 'AUTHENTICATION',
        action: 'PASSWORD_CHANGED',
        entityType: 'USER',
        entityId: user.userId,
        before: {
          mustChangePassword:
            previousMustChangePassword,
        },
        after: {
          mustChangePassword: false,
        },
        reason:
          'Password changed by authenticated user.',
        result: 'SUCCESS',
        riskClassification: 'HIGH',
        metadata: { revokedSessionCount },
      });
    } catch (_error) {
      // Audit failure must not mask a completed credential change.
    }

    return response.status(200).json({
      success: true,
      message:
        'Password changed successfully. Please sign in again.',
      data: {
        requiresLogin: true,
        revokedSessionCount,
      },
      correlationId:
        request.correlationId || null,
    });
  }
);

const getMfaStatus = asyncHandler(
  async (request, response) => {
    const user = await User.findOne({
      organisationId: request.auth.organisationId,
      userId: request.auth.userId,
    }).select('+pendingMfaSecretEncrypted +recoveryCodeHashes');

    if (!user) {
      throw new ApiError(
        404,
        'USER_UNAVAILABLE',
        'The user account is unavailable.'
      );
    }

    const mfaRequired = MFA_REQUIRED_ROLES.includes(user.role);
    const mfaEnabled = Boolean(user.mfaEnabled);
    const recoveryCodesRemaining = (user.recoveryCodeHashes || []).length;
    const setupPending = Boolean(user.pendingMfaSecretEncrypted);

    return response.status(200).json({
      success: true,
      data: {
        mfaRequired,
        mfaEnabled,
        recoveryCodesRemaining,
        setupPending,
      },
      correlationId:
        request.correlationId || null,
    });
  }
);

const regenerateRecoveryCodes = asyncHandler(
  async (request, response) => {
    const password =
      typeof request.body?.password === 'string'
        ? request.body.password
        : '';

    const code =
      typeof request.body?.code === 'string'
        ? request.body.code.trim()
        : '';

    if (!password || !code) {
      throw new ApiError(
        400,
        'REGENERATE_FIELDS_REQUIRED',
        'Password and TOTP code are required.'
      );
    }

    const user = await User.findOne({
      organisationId: request.auth.organisationId,
      userId: request.auth.userId,
      accountStatus: 'ACTIVE',
      archivedAt: null,
    }).select('+passwordHash +mfaSecretEncrypted +recoveryCodeHashes +lastMfaCounter');

    if (!user || !user.mfaEnabled || !user.mfaSecretEncrypted) {
      throw new ApiError(
        400,
        'MFA_NOT_ENABLED',
        'MFA is not enabled for this user.'
      );
    }

    const passwordMatches = await verifyPassword(password, user.passwordHash);
    if (!passwordMatches) {
      throw new ApiError(
        401,
        'INVALID_PASSWORD',
        'Invalid current password.'
      );
    }

    const manualEntrySecret = decryptMfaSecret(user.mfaSecretEncrypted);
    const { valid, counter } = verifyTotpCode(
      manualEntrySecret,
      code,
      Date.now(),
      1
    );

    if (!valid) {
      throw new ApiError(
        400,
        'INVALID_MFA_CODE',
        'The MFA verification code is invalid or expired.'
      );
    }

    if (user.lastMfaCounter && counter <= user.lastMfaCounter) {
      throw new ApiError(
        400,
        'MFA_CODE_REUSED',
        'This MFA code has already been used.'
      );
    }

    const plainRecoveryCodes = generateRecoveryCodes(10);
    const hashedCodes = plainRecoveryCodes.map(hashRecoveryCode);

    user.lastMfaCounter = counter;
    user.recoveryCodeHashes = hashedCodes;

    await user.save();

    return response.status(200).json({
      success: true,
      message: 'Recovery codes regenerated successfully.',
      data: {
        recoveryCodes: plainRecoveryCodes,
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
const getSessions = asyncHandler(
  async (request, response) => {
    const sessions =
      await listUserSessions({
        organisationId:
          request.auth.organisationId,
        userId: request.auth.userId,
      });

    const safeSessions = sessions.map((sessionDocument) => {
      const session =
        typeof sessionDocument?.toObject === "function"
          ? sessionDocument.toObject()
          : sessionDocument;

      return {
        sessionId: session.sessionId,
        status: session.status,
        roleSnapshot: session.roleSnapshot,
        mfaVerified: Boolean(session.mfaVerified),
        mfaVerifiedAt: session.mfaVerifiedAt || null,
        stepUpVerifiedAt: session.stepUpVerifiedAt || null,
        device: {
          deviceName: session.device?.deviceName || "Unknown device",
          deviceType: session.device?.deviceType || "OTHER",
          operatingSystem: session.device?.operatingSystem || "",
          browser: session.device?.browser || "",
        },
        network: {
          ipAddressMasked: session.network?.ipAddressMasked || null,
          country: session.network?.country || null,
          region: session.network?.region || null,
          city: session.network?.city || null,
        },
        issuedAt: session.issuedAt || null,
        lastActivityAt: session.lastActivityAt || null,
        refreshTokenExpiresAt: session.refreshTokenExpiresAt || null,
        absoluteExpiresAt: session.absoluteExpiresAt || null,
        idleTimeoutMinutes: session.idleTimeoutMinutes,
        revokedAt: session.revokedAt || null,
        revocationReason: session.revocationReason || null,
      };
    });

    return response.status(200).json({
      success: true,
      data: {
        sessions: safeSessions,
        currentSessionId:
          request.auth.sessionId,
      },
      correlationId:
        request.correlationId || null,
    });
  }
);
const getCurrentUser = asyncHandler(
  async (request, response) => {
    const user = request.authenticatedUser;
    const auth = request.auth;

    const safeUser = {
      userId: user.userId,
      organisationId: user.organisationId,
      name: user.name,
      preferredName: user.preferredName || null,
      role: user.role,
      accountStatus: user.accountStatus,
      isPrimaryMaster: Boolean(user.isPrimaryMaster),
      primaryCafeId: user.primaryCafeId || null,
      assignedCafeIds: Array.isArray(user.assignedCafeIds)
        ? [...user.assignedCafeIds]
        : [],
      preferredLanguage: user.preferredLanguage || 'en',
      mustChangePassword: Boolean(user.mustChangePassword),
      mfaEnabled: Boolean(user.mfaEnabled),
      mfaMethod: user.mfaMethod || 'NONE',
    };

    const safeAuthentication = {
      userId: auth.userId,
      organisationId: auth.organisationId,
      role: auth.role,
      assignedCafeIds: Array.isArray(auth.assignedCafeIds)
        ? [...auth.assignedCafeIds]
        : [],
      primaryCafeId: auth.primaryCafeId || null,
      sessionId: auth.sessionId,
      mfaVerified: Boolean(auth.mfaVerified),
    };

    return response.status(200).json({
      success: true,
      data: {
        user: safeUser,
        authentication: safeAuthentication,
      },
      correlationId:
        request.correlationId || null,
    });
  }
);

const revokeSessionById = asyncHandler(
  async (request, response) => {
    const sessionId =
      typeof request.params.sessionId ===
      'string'
        ? request.params.sessionId.trim()
        : '';

    if (!sessionId) {
      throw new ApiError(
        400,
        'SESSION_ID_REQUIRED',
        'A session ID is required.'
      );
    }

    const revokedSession =
      await revokeUserSession({
        organisationId:
          request.auth.organisationId,
        userId: request.auth.userId,
        sessionId,
        revokedBy: request.auth.userId,
      });

    if (!revokedSession) {
      throw new ApiError(
        404,
        'SESSION_NOT_FOUND',
        'The session was not found.'
      );
    }

    if (
      revokedSession.sessionId ===
      request.auth.sessionId
    ) {
      clearAuthenticationCookies(
        response
      );
    }

    return response.status(200).json({
      success: true,
      message:
        'Session revoked successfully.',
      data: {
        sessionId:
          revokedSession.sessionId,
      },
      correlationId:
        request.correlationId || null,
    });
  }
);

module.exports = {
  login,
  requestPasswordReset,
  verifyPasswordResetCode,
  resetPassword,
  mfaSetup,
  mfaConfirm,
  mfaVerify,
  getMfaStatus,
  regenerateRecoveryCodes,
  stepUpAuthentication,
  changePassword,
  refreshSession,
  logout,
  logoutAll,
  getSessions,
  getCurrentUser,
  revokeSessionById,
  clearAuthenticationCookies,
};
