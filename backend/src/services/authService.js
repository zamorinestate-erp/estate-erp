'use strict';

const crypto = require('crypto');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

const { User } = require('../models/User');
const { Session } = require('../models/Session');
const {
  SequenceCounter,
} = require('../models/SequenceCounter');

const PASSWORD_HASH_ROUNDS = 12;
const MAX_FAILED_LOGIN_ATTEMPTS = 5;
const TEMPORARY_LOCK_MINUTES = 15;

const MFA_REQUIRED_ROLES = [
  'MASTER',
  'OWNER',
  'CAFE_ADMIN',
];

function requireAccessTokenSecret() {
  const secret = process.env.JWT_ACCESS_SECRET;

  if (!secret || secret.length < 32) {
    throw new Error(
      'JWT_ACCESS_SECRET must contain at least 32 characters.'
    );
  }

  return secret;
}

function getPositiveIntegerEnvironmentValue(
  name,
  fallback
) {
  const parsedValue = Number.parseInt(
    process.env[name] || '',
    10
  );

  if (
    Number.isInteger(parsedValue) &&
    parsedValue > 0
  ) {
    return parsedValue;
  }

  return fallback;
}

function normalizeEmail(email) {
  if (typeof email !== 'string') {
    return '';
  }

  return email.trim().toLowerCase();
}

function normalizeIdentifier(value) {
  if (typeof value !== 'string') {
    return '';
  }

  return value.trim().toUpperCase();
}

function hashToken(token) {
  if (!token) {
    throw new Error('A token is required.');
  }

  return crypto
    .createHash('sha256')
    .update(token)
    .digest('hex');
}

function generateOpaqueToken() {
  return crypto.randomBytes(64).toString('base64url');
}

const COMMON_PASSWORD_BLOCKLIST = new Set([
  'password123456',
  'password1234567',
  'password12345678',
  '123456789012345',
  '1234567890123456',
  'qwertyuiop12345',
  'administrator123',
  'administrator1234',
  'zamorincafe1234',
  'zamorincafe12345',
  'changeme1234567',
  'welcome12345678',
  'letmein12345678',
  'supersecret1234',
  'iloveyou1234567',
]);

/**
 * Modern NIST SP 800-63B-4 aligned password strength validator.
 *
 * Requirements:
 * - Length-first security: 15+ chars for password-only, 8+ chars when MFA is enforced.
 * - Max length: 128 characters without truncation.
 * - Full support for spaces, punctuation, printable ASCII, and Unicode passphrases.
 * - Zero mandatory composition rules (no forced uppercase, lowercase, digit, or symbol).
 * - Offline blocklist of common, compromised, and repetitive passwords.
 */
function validatePasswordStrength(password, { requiresMfa = false, minLength = null } = {}) {
  const errors = [];

  if (typeof password !== 'string') {
    return ['Password must be text.'];
  }

  const effectiveMinLength = typeof minLength === 'number'
    ? minLength
    : (requiresMfa ? 8 : 15);

  if (password.length < effectiveMinLength) {
    errors.push(
      `Password must contain at least ${effectiveMinLength} characters.`
    );
  }

  if (password.length > 128) {
    errors.push(
      'Password must not exceed 128 characters.'
    );
  }

  const normalized = password.toLowerCase().trim();

  if (COMMON_PASSWORD_BLOCKLIST.has(normalized)) {
    errors.push(
      'This password is too common or easily guessed. Please choose a unique passphrase.'
    );
  }

  if (/^(.)\1+$/.test(password) && password.length >= 8) {
    errors.push(
      'Password must not consist of a single repeated character.'
    );
  }

  return errors;
}

const PASSWORD_HASH_PREFIX_V2 = '$v2$';

/**
 * Pre-hashes password with SHA-256 to produce a fixed 44-character Base64 digest.
 * This completely eliminates bcrypt's 72-byte truncation limitation and ensures
 * all 128 characters and multibyte UTF-8 characters are fully evaluated.
 */
function preparePasswordForBcrypt(password) {
  return crypto
    .createHash('sha256')
    .update(Buffer.from(password, 'utf8'))
    .digest('base64');
}

async function hashPassword(password, options = { requiresMfa: true }) {
  const validationErrors =
    validatePasswordStrength(password, options);

  if (validationErrors.length > 0) {
    throw new Error(validationErrors.join(' '));
  }

  const prehashed = preparePasswordForBcrypt(password);
  const rawBcryptHash = await bcrypt.hash(
    prehashed,
    PASSWORD_HASH_ROUNDS
  );

  return `${PASSWORD_HASH_PREFIX_V2}${rawBcryptHash}`;
}

async function verifyPassword(
  password,
  passwordHash
) {
  if (
    !password ||
    !passwordHash ||
    typeof password !== 'string' ||
    typeof passwordHash !== 'string'
  ) {
    return false;
  }

  // Version 2 (Current): SHA-256 pre-hashed before bcrypt (72-byte safe)
  if (passwordHash.startsWith(PASSWORD_HASH_PREFIX_V2)) {
    const rawBcryptHash = passwordHash.slice(PASSWORD_HASH_PREFIX_V2.length);
    const prehashed = preparePasswordForBcrypt(password);
    return bcrypt.compare(prehashed, rawBcryptHash);
  }

  // Version 1 (Legacy): Direct raw bcrypt ($2a$, $2b$, $2y$)
  if (
    passwordHash.startsWith('$2a$') ||
    passwordHash.startsWith('$2b$') ||
    passwordHash.startsWith('$2y$')
  ) {
    return bcrypt.compare(password, passwordHash);
  }

  return false;
}

function calculateTokenDates() {
  const now = new Date();

  const accessTokenTtlMinutes =
    getPositiveIntegerEnvironmentValue(
      'JWT_ACCESS_TTL_MINUTES',
      15
    );

  const refreshTokenTtlDays =
    getPositiveIntegerEnvironmentValue(
      'REFRESH_TOKEN_TTL_DAYS',
      7
    );

  const absoluteSessionTtlDays =
    getPositiveIntegerEnvironmentValue(
      'SESSION_ABSOLUTE_TTL_DAYS',
      7
    );

  const accessTokenExpiresAt = new Date(
    now.getTime() +
      accessTokenTtlMinutes * 60 * 1000
  );

  const requestedRefreshExpiry = new Date(
    now.getTime() +
      refreshTokenTtlDays *
        24 *
        60 *
        60 *
        1000
  );

  const absoluteExpiresAt = new Date(
    now.getTime() +
      absoluteSessionTtlDays *
        24 *
        60 *
        60 *
        1000
  );

  const refreshTokenExpiresAt =
    requestedRefreshExpiry < absoluteExpiresAt
      ? requestedRefreshExpiry
      : absoluteExpiresAt;

  return {
    now,
    accessTokenTtlMinutes,
    accessTokenExpiresAt,
    refreshTokenExpiresAt,
    absoluteExpiresAt,
  };
}

function createAccessToken({
  user,
  sessionId,
  sessionVersion,
  expiresInMinutes,
}) {
  const secret = requireAccessTokenSecret();

  return jwt.sign(
    {
      sub: user.userId,
      sid: sessionId,
      org: user.organisationId,
      role: user.role,
      cafes: user.assignedCafeIds || [],
      sv: sessionVersion,
      usv: user.sessionVersion,
      pv: user.permissionsVersion,
      type: 'access',
    },
    secret,
    {
      algorithm: 'HS256',
      issuer: 'zamorin-cafe-erp-api',
      audience: 'zamorin-cafe-erp',
      expiresIn: `${expiresInMinutes}m`,
      jwtid: crypto.randomUUID(),
    }
  );
}

async function recordFailedLogin(user) {
  user.failedLoginAttempts += 1;

  if (
    user.failedLoginAttempts >=
    MAX_FAILED_LOGIN_ATTEMPTS
  ) {
    user.accountStatus = 'LOCKED';

    user.lockedUntil = new Date(
      Date.now() +
        TEMPORARY_LOCK_MINUTES *
          60 *
          1000
    );
  }

  await user.save();
}

async function clearExpiredTemporaryLock(user) {
  if (
    user.accountStatus !== 'LOCKED' ||
    !user.lockedUntil ||
    user.lockedUntil > new Date()
  ) {
    return;
  }

  user.accountStatus = 'ACTIVE';
  user.failedLoginAttempts = 0;
  user.lockedUntil = null;

  await user.save();
}

async function authenticatePassword({
  organisationId,
  email,
  password,
}) {
  const normalizedOrganisationId =
    normalizeIdentifier(organisationId);

  const normalizedEmail = normalizeEmail(email);

  if (
    !normalizedOrganisationId ||
    !normalizedEmail ||
    !password
  ) {
    throw new Error(
      'Invalid email or password.'
    );
  }

  const user = await User.findOne({
    organisationId: normalizedOrganisationId,
    email: normalizedEmail,
  }).select(
    '+passwordHash +passwordHistoryHashes'
  );

  if (!user) {
    throw new Error(
      'Invalid email or password.'
    );
  }

  await clearExpiredTemporaryLock(user);

  if (user.accountStatus !== 'ACTIVE') {
    throw new Error(
      'This account is not available for sign-in.'
    );
  }

  if (
    user.lockedUntil &&
    user.lockedUntil > new Date()
  ) {
    throw new Error(
      'This account is temporarily locked.'
    );
  }

  const passwordMatches = await verifyPassword(
    password,
    user.passwordHash
  );

  if (!passwordMatches) {
    await recordFailedLogin(user);

    throw new Error(
      'Invalid email or password.'
    );
  }

  user.failedLoginAttempts = 0;
  user.lockedUntil = null;
  user.lastLoginAt = new Date();

  try {
    await user.save();
  } catch (_saveErr) {
    if (user._id) {
      await User.updateOne(
        { _id: user._id },
        {
          $set: {
            failedLoginAttempts: 0,
            lockedUntil: null,
            lastLoginAt: user.lastLoginAt,
          },
        }
      );
    }
  }

  const roleRequiresMfa =
    MFA_REQUIRED_ROLES.includes(user.role);

  return {
    user,
    requiresMfa:
      roleRequiresMfa || user.mfaEnabled,
    mfaSetupRequired:
      roleRequiresMfa && !user.mfaEnabled,
    mustChangePassword:
      user.mustChangePassword,
  };
}

async function createSession({
  user,
  device,
  network = {},
  mfaVerified = false,
  createdBy,
}) {
  if (!user?.userId || !user?.organisationId) {
    throw new Error(
      'A valid authenticated user is required.'
    );
  }

  if (!device?.deviceId) {
    throw new Error(
      'A device ID is required.'
    );
  }

  if (
    MFA_REQUIRED_ROLES.includes(user.role) &&
    !mfaVerified
  ) {
    throw new Error(
      'MFA verification is required for this role.'
    );
  }

  const datePart = new Date()
    .toISOString()
    .slice(0, 10)
    .replaceAll('-', '');

  const sessionId =
    await SequenceCounter.generateId({
      organisationId: user.organisationId,
      sequenceKey: `SESSION_${datePart}`,
      prefix: `SS-${datePart}`,
      minimumDigits: 4,
    });

  const tokenFamilyId = crypto.randomUUID();
  const refreshToken = generateOpaqueToken();

  const tokenDates = calculateTokenDates();

  const idleTimeoutMinutes =
    getPositiveIntegerEnvironmentValue(
      'SESSION_IDLE_TIMEOUT_MINUTES',
      30
    );

  const accessToken = createAccessToken({
    user,
    sessionId,
    sessionVersion: 0,
    expiresInMinutes:
      tokenDates.accessTokenTtlMinutes,
  });

  const session = await Session.create({
    sessionId,
    organisationId: user.organisationId,
    userId: user.userId,
    roleSnapshot: user.role,
    assignedCafeIdsSnapshot:
      user.assignedCafeIds || [],
    tokenFamilyId,
    accessTokenHash: hashToken(accessToken),
    refreshTokenHash: hashToken(refreshToken),
    previousRefreshTokenHashes: [],
    sessionVersion: 0,
    userSessionVersionSnapshot:
      user.sessionVersion,
    permissionsVersionSnapshot:
      user.permissionsVersion,
    status: 'ACTIVE',
    mfaVerified,
    mfaVerifiedAt: mfaVerified
      ? tokenDates.now
      : null,
    device,
    network,
    issuedAt: tokenDates.now,
    lastActivityAt: tokenDates.now,
    accessTokenExpiresAt:
      tokenDates.accessTokenExpiresAt,
    refreshTokenExpiresAt:
      tokenDates.refreshTokenExpiresAt,
    absoluteExpiresAt:
      tokenDates.absoluteExpiresAt,
    idleTimeoutMinutes,
    createdBy:
      normalizeIdentifier(createdBy) ||
      user.userId,
  });

  return {
    accessToken,
    refreshToken,
    accessTokenExpiresAt:
      session.accessTokenExpiresAt,
    refreshTokenExpiresAt:
      session.refreshTokenExpiresAt,
    session: session.toJSON(),
  };
}

async function rotateRefreshToken({
  sessionId,
  refreshToken,
  deviceId,
}) {
  const normalizedSessionId =
    normalizeIdentifier(sessionId);

  if (
    !normalizedSessionId ||
    !refreshToken ||
    !deviceId
  ) {
    throw new Error(
      'A session ID, refresh token and device ID are required.'
    );
  }

  const session = await Session.findOne({
    sessionId: normalizedSessionId,
  }).select(
    '+accessTokenHash +refreshTokenHash +previousRefreshTokenHashes'
  );

  if (!session) {
    throw new Error(
      'The session is invalid.'
    );
  }

  const submittedTokenHash =
    hashToken(refreshToken);

  if (
    session.previousRefreshTokenHashes.includes(
      submittedTokenHash
    )
  ) {
    await session.markCompromised({
      revokedBy: 'SYSTEM',
      details:
        'A previously rotated refresh token was reused.',
    });

    throw new Error(
      'Refresh token reuse was detected.'
    );
  }

  if (
    session.refreshTokenHash !==
    submittedTokenHash
  ) {
    throw new Error(
      'The refresh token is invalid.'
    );
  }

  if (!session.isActive()) {
    throw new Error(
      'The session has expired or was revoked.'
    );
  }

  if (
    session.device.deviceId !== deviceId
  ) {
    await session.markCompromised({
      revokedBy: 'SYSTEM',
      details:
        'Refresh token was presented from a different device.',
    });

    throw new Error(
      'The session device does not match.'
    );
  }

  const user = await User.findOne({
    organisationId: session.organisationId,
    userId: session.userId,
    accountStatus: 'ACTIVE',
  });

  if (!user) {
    throw new Error(
      'The user account is unavailable.'
    );
  }

  if (
    session.userSessionVersionSnapshot !==
      user.sessionVersion ||
    session.permissionsVersionSnapshot !==
      user.permissionsVersion
  ) {
    await session.revoke({
      revokedBy: 'SYSTEM',
      reason: 'PERMISSION_CHANGED',
      details:
        'The user security or permission version changed.',
    });

    throw new Error(
      'The session must be renewed.'
    );
  }

  const tokenDates = calculateTokenDates();
  const nextRefreshToken =
    generateOpaqueToken();

  session.previousRefreshTokenHashes.push(
    session.refreshTokenHash
  );

  session.previousRefreshTokenHashes =
    session.previousRefreshTokenHashes.slice(-10);

  session.sessionVersion += 1;

  const nextAccessToken = createAccessToken({
    user,
    sessionId: session.sessionId,
    sessionVersion:
      session.sessionVersion,
    expiresInMinutes:
      tokenDates.accessTokenTtlMinutes,
  });

  session.accessTokenHash =
    hashToken(nextAccessToken);

  session.refreshTokenHash =
    hashToken(nextRefreshToken);

  session.accessTokenExpiresAt =
    tokenDates.accessTokenExpiresAt;

  session.refreshTokenExpiresAt =
    tokenDates.refreshTokenExpiresAt <
    session.absoluteExpiresAt
      ? tokenDates.refreshTokenExpiresAt
      : session.absoluteExpiresAt;

  session.lastActivityAt =
    tokenDates.now;

  await session.save();

  return {
    accessToken: nextAccessToken,
    refreshToken: nextRefreshToken,
    accessTokenExpiresAt:
      session.accessTokenExpiresAt,
    refreshTokenExpiresAt:
      session.refreshTokenExpiresAt,
    session: session.toJSON(),
  };
}

async function verifyAccessToken(accessToken) {
  if (!accessToken) {
    throw new Error(
      'An access token is required.'
    );
  }

  const secret = requireAccessTokenSecret();

  const payload = jwt.verify(
    accessToken,
    secret,
    {
      algorithms: ['HS256'],
      issuer: 'zamorin-cafe-erp-api',
      audience: 'zamorin-cafe-erp',
    }
  );

  if (
    payload.type !== 'access' ||
    typeof payload.sid !== 'string' ||
    !payload.sid.trim() ||
    typeof payload.sub !== 'string' ||
    !payload.sub.trim() ||
    typeof payload.org !== 'string' ||
    !payload.org.trim()
  ) {
    throw new Error(
      'The access token is invalid.'
    );
  }

  const session = await Session.findOne({
    sessionId: payload.sid,
    organisationId: payload.org,
    userId: payload.sub,
    status: 'ACTIVE',
  });

  if (!session || !session.isActive()) {
    throw new Error(
      'The session is invalid or expired.'
    );
  }

  if (
    session.sessionVersion !== payload.sv ||
    session.userSessionVersionSnapshot !==
      payload.usv ||
    session.permissionsVersionSnapshot !==
      payload.pv
  ) {
    throw new Error(
      'The access token is no longer valid.'
    );
  }

  return {
    payload,
    session,
  };
}

async function revokeSession({
  sessionId,
  revokedBy,
  reason = 'USER_LOGOUT',
  details = '',
}) {
  const session = await Session.findOne({
    sessionId:
      normalizeIdentifier(sessionId),
  }).select(
    '+accessTokenHash +refreshTokenHash +previousRefreshTokenHashes'
  );

  if (!session) {
    return null;
  }

  return session.revoke({
    revokedBy,
    reason,
    details,
  });
}
async function revokeAllUserSessions({
  organisationId,
  userId,
  revokedBy,
  reason = 'LOGOUT_ALL',
  details = 'User signed out from all devices.',
}) {
  const sessions = await Session.find({
    organisationId:
      normalizeIdentifier(organisationId),
    userId: normalizeIdentifier(userId),
    status: 'ACTIVE',
  }).select(
    '+accessTokenHash +refreshTokenHash +previousRefreshTokenHashes'
  );

  await Promise.all(
    sessions.map((session) =>
      session.revoke({
        revokedBy,
        reason,
        details,
      })
    )
  );

  return sessions.length;
}
async function listUserSessions({
  organisationId,
  userId,
}) {
  return Session.find({
    organisationId:
      normalizeIdentifier(organisationId),
    userId: normalizeIdentifier(userId),
  }).sort({
    lastActivityAt: -1,
    issuedAt: -1,
  });
}
async function revokeUserSession({
  organisationId,
  userId,
  sessionId,
  revokedBy,
}) {
  const session = await Session.findOne({
    organisationId:
      normalizeIdentifier(organisationId),
    userId: normalizeIdentifier(userId),
    sessionId: normalizeIdentifier(sessionId),
  }).select(
    '+accessTokenHash +refreshTokenHash +previousRefreshTokenHashes'
  );

  if (!session) {
    return null;
  }

  return session.revoke({
    revokedBy:
      normalizeIdentifier(revokedBy),
    reason: 'USER_LOGOUT',
    details:
      'User revoked an active session.',
  });
}

module.exports = {
  MFA_REQUIRED_ROLES,
  validatePasswordStrength,
  hashPassword,
  verifyPassword,
  authenticatePassword,
  createSession,
  rotateRefreshToken,
  verifyAccessToken,
  revokeSession,
  revokeAllUserSessions,
  listUserSessions,
  revokeUserSession,
};