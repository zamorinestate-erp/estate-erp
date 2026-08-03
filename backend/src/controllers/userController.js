'use strict';

const {
  User,
  USER_ROLES,
  ACCOUNT_STATUSES,
} = require('../models/User');

const { Cafe } = require('../models/Cafe');

const {
  SequenceCounter,
} = require('../models/SequenceCounter');

const {
  hashPassword,
  revokeAllUserSessions,
} = require('../services/authService');

const {
  asyncHandler,
} = require('../utils/asyncHandler');

const {
  ApiError,
} = require('../utils/ApiError');

const ROLE_PREFIXES = {
  MASTER: 'MU',
  OWNER: 'OW',
  CAFE_ADMIN: 'AD',
  STAFF: 'ST',
};

function normalizeIdentifier(value) {
  return typeof value === 'string'
    ? value.trim().toUpperCase()
    : '';
}

function normalizeEmail(value) {
  return typeof value === 'string'
    ? value.trim().toLowerCase()
    : '';
}

function normalizeCafeIds(value) {
  if (!Array.isArray(value)) {
    return [];
  }

  return [
    ...new Set(
      value
        .filter(
          (cafeId) =>
            typeof cafeId === 'string' &&
            cafeId.trim()
        )
        .map((cafeId) =>
          cafeId.trim().toUpperCase()
        )
    ),
  ];
}

function requireMaster(request) {
  if (request.auth.role !== 'MASTER') {
    throw new ApiError(
      403,
      'MASTER_ACCESS_REQUIRED',
      'Only the MASTER role may perform this action.'
    );
  }
}

async function validateCafeAssignments({
  organisationId,
  assignedCafeIds,
  primaryCafeId,
}) {
  if (
    primaryCafeId &&
    !assignedCafeIds.includes(primaryCafeId)
  ) {
    throw new ApiError(
      400,
      'PRIMARY_CAFE_NOT_ASSIGNED',
      'The primary café must be included in the assigned cafés.'
    );
  }

  if (assignedCafeIds.length === 0) {
    return;
  }

  const existingCafeCount =
    await Cafe.countDocuments({
      organisationId,
      cafeId: {
        $in: assignedCafeIds,
      },
      status: {
        $ne: 'ARCHIVED',
      },
    });

  if (
    existingCafeCount !==
    assignedCafeIds.length
  ) {
    throw new ApiError(
      400,
      'INVALID_CAFE_ASSIGNMENT',
      'One or more assigned cafés are invalid.'
    );
  }
}

function buildUserFilter(request) {
  const filter = {
    organisationId:
      request.auth.organisationId,
  };

  if (request.auth.role === 'CAFE_ADMIN') {
    filter.assignedCafeIds = {
      $in:
        request.auth.assignedCafeIds || [],
    };
  }

  if (request.auth.role === 'STAFF') {
    filter.userId = request.auth.userId;
  }

  const role =
    normalizeIdentifier(request.query.role);

  if (role) {
    if (!USER_ROLES.includes(role)) {
      throw new ApiError(
        400,
        'INVALID_USER_ROLE',
        'The requested user role is invalid.'
      );
    }

    filter.role = role;
  }

  const accountStatus =
    normalizeIdentifier(
      request.query.accountStatus
    );

  if (accountStatus) {
    if (
      !ACCOUNT_STATUSES.includes(
        accountStatus
      )
    ) {
      throw new ApiError(
        400,
        'INVALID_ACCOUNT_STATUS',
        'The requested account status is invalid.'
      );
    }

    filter.accountStatus =
      accountStatus;
  }

  const cafeId =
    normalizeIdentifier(
      request.query.cafeId
    );

  if (cafeId) {
    if (
      request.auth.role !== 'MASTER' &&
      request.auth.role !== 'OWNER' &&
      !request.auth.assignedCafeIds.includes(
        cafeId
      )
    ) {
      throw new ApiError(
        403,
        'CAFE_ACCESS_DENIED',
        'You do not have access to this café.'
      );
    }

    filter.assignedCafeIds = cafeId;
  }

  if (
    typeof request.query.search ===
      'string' &&
    request.query.search.trim()
  ) {
    const search =
      request.query.search.trim();

    filter.$or = [
      {
        name: {
          $regex: search,
          $options: 'i',
        },
      },
      {
        email: {
          $regex: search,
          $options: 'i',
        },
      },
      {
        userId: {
          $regex: search,
          $options: 'i',
        },
      },
      {
        phone: {
          $regex: search,
          $options: 'i',
        },
      },
    ];
  }

  return filter;
}

function ensureUserIsAccessible(
  request,
  user
) {
  if (
    request.auth.role === 'MASTER' ||
    request.auth.role === 'OWNER'
  ) {
    return;
  }

  if (
    user.userId === request.auth.userId
  ) {
    return;
  }

  if (
    request.auth.role === 'CAFE_ADMIN' &&
    user.assignedCafeIds.some(
      (cafeId) =>
        request.auth.assignedCafeIds.includes(
          cafeId
        )
    )
  ) {
    return;
  }

  throw new ApiError(
    403,
    'USER_ACCESS_DENIED',
    'You do not have access to this user.'
  );
}

const listUsers = asyncHandler(
  async (request, response) => {
    const users = await User.find(
      buildUserFilter(request)
    ).sort({
      name: 1,
      userId: 1,
    });

    return response.status(200).json({
      success: true,
      data: {
        users,
        count: users.length,
      },
      correlationId:
        request.correlationId || null,
    });
  }
);

const getUser = asyncHandler(
  async (request, response) => {
    const userId =
      normalizeIdentifier(
        request.params.userId
      );

    const user = await User.findOne({
      organisationId:
        request.auth.organisationId,
      userId,
    });

    if (!user) {
      throw new ApiError(
        404,
        'USER_NOT_FOUND',
        'The user was not found.'
      );
    }

    ensureUserIsAccessible(
      request,
      user
    );

    return response.status(200).json({
      success: true,
      data: {
        user,
      },
      correlationId:
        request.correlationId || null,
    });
  }
);

const createUser = asyncHandler(
  async (request, response) => {
    requireMaster(request);

    const {
      name,
      email,
      password,
      role,
      phone = '',
      preferredName = '',
      preferredLanguage = 'en',
    } = request.body || {};

    const normalizedEmail =
      normalizeEmail(email);

    const normalizedRole =
      normalizeIdentifier(role);

    if (
      typeof name !== 'string' ||
      !name.trim() ||
      !normalizedEmail ||
      typeof password !== 'string' ||
      !password ||
      !USER_ROLES.includes(
        normalizedRole
      )
    ) {
      throw new ApiError(
        400,
        'USER_FIELDS_REQUIRED',
        'Name, email, password and a valid role are required.'
      );
    }

    if (normalizedRole === 'MASTER') {
      throw new ApiError(
        403,
        'MASTER_CREATION_RESTRICTED',
        'Additional MASTER accounts cannot be created through this endpoint.'
      );
    }

    const existingUser =
      await User.findOne({
        organisationId:
          request.auth.organisationId,
        email: normalizedEmail,
      });

    if (existingUser) {
      throw new ApiError(
        409,
        'EMAIL_ALREADY_EXISTS',
        'A user with this email already exists.'
      );
    }

    const assignedCafeIds =
      normalizeCafeIds(
        request.body.assignedCafeIds
      );

    const primaryCafeId =
      normalizeIdentifier(
        request.body.primaryCafeId
      ) || null;

    if (
      ['CAFE_ADMIN', 'STAFF'].includes(
        normalizedRole
      ) &&
      assignedCafeIds.length === 0
    ) {
      throw new ApiError(
        400,
        'CAFE_ASSIGNMENT_REQUIRED',
        'Café Admin and Staff users require at least one café assignment.'
      );
    }

    await validateCafeAssignments({
      organisationId:
        request.auth.organisationId,
      assignedCafeIds,
      primaryCafeId,
    });

    const prefix =
      ROLE_PREFIXES[normalizedRole];

    const userId =
      await SequenceCounter.generateId({
        organisationId:
          request.auth.organisationId,
        sequenceKey:
          `USER_${normalizedRole}`,
        prefix,
        minimumDigits: 4,
      });

    const passwordHash =
      await hashPassword(password);

    const user = await User.create({
      userId,
      organisationId:
        request.auth.organisationId,
      name: name.trim(),
      preferredName:
        typeof preferredName === 'string'
          ? preferredName.trim()
          : '',
      email: normalizedEmail,
      phone:
        typeof phone === 'string'
          ? phone.trim()
          : '',
      role: normalizedRole,
      accountStatus:
        'PENDING_ACTIVATION',
      primaryCafeId,
      assignedCafeIds,
      passwordHash,
      mustChangePassword: true,
      passwordChangedAt: new Date(),
      preferredLanguage:
        typeof preferredLanguage === 'string'
          ? preferredLanguage.trim() ||
            'en'
          : 'en',
      timezone: 'Asia/Kolkata',
      createdBy:
        request.auth.userId,
      updatedBy:
        request.auth.userId,
    });

    return response.status(201).json({
      success: true,
      message:
        'User created successfully.',
      data: {
        user,
      },
      correlationId:
        request.correlationId || null,
    });
  }
);

const updateUser = asyncHandler(
  async (request, response) => {
    requireMaster(request);

    const userId =
      normalizeIdentifier(
        request.params.userId
      );

    const user = await User.findOne({
      organisationId:
        request.auth.organisationId,
      userId,
      accountStatus: {
        $ne: 'ARCHIVED',
      },
    });

    if (!user) {
      throw new ApiError(
        404,
        'USER_NOT_FOUND',
        'The user was not found.'
      );
    }

    const allowedTextFields = [
      'name',
      'preferredName',
      'phone',
      'preferredLanguage',
    ];

    allowedTextFields.forEach(
      (field) => {
        if (
          typeof request.body?.[field] ===
          'string'
        ) {
          user[field] =
            request.body[field].trim();
        }
      }
    );

    if (
      typeof request.body?.email ===
      'string'
    ) {
      const email =
        normalizeEmail(
          request.body.email
        );

      if (!email) {
        throw new ApiError(
          400,
          'EMAIL_REQUIRED',
          'A valid email is required.'
        );
      }

      const duplicate =
        await User.findOne({
          organisationId:
            request.auth.organisationId,
          email,
          userId: {
            $ne: user.userId,
          },
        });

      if (duplicate) {
        throw new ApiError(
          409,
          'EMAIL_ALREADY_EXISTS',
          'A user with this email already exists.'
        );
      }

      user.email = email;
    }

    if (
      request.body?.assignedCafeIds !==
        undefined ||
      request.body?.primaryCafeId !==
        undefined
    ) {
      const assignedCafeIds =
        request.body.assignedCafeIds !==
        undefined
          ? normalizeCafeIds(
              request.body.assignedCafeIds
            )
          : user.assignedCafeIds;

      const primaryCafeId =
        request.body.primaryCafeId !==
        undefined
          ? normalizeIdentifier(
              request.body.primaryCafeId
            ) || null
          : user.primaryCafeId;

      if (
        ['CAFE_ADMIN', 'STAFF'].includes(
          user.role
        ) &&
        assignedCafeIds.length === 0
      ) {
        throw new ApiError(
          400,
          'CAFE_ASSIGNMENT_REQUIRED',
          'Café Admin and Staff users require at least one café assignment.'
        );
      }

      await validateCafeAssignments({
        organisationId:
          request.auth.organisationId,
        assignedCafeIds,
        primaryCafeId,
      });

      user.assignedCafeIds =
        assignedCafeIds;

      user.primaryCafeId =
        primaryCafeId;

      user.sessionVersion += 1;
      user.permissionsVersion += 1;
    }

    user.updatedBy =
      request.auth.userId;

    await user.save();

    return response.status(200).json({
      success: true,
      message:
        'User updated successfully.',
      data: {
        user,
      },
      correlationId:
        request.correlationId || null,
    });
  }
);

const changeUserStatus = asyncHandler(
  async (request, response) => {
    requireMaster(request);

    const userId =
      normalizeIdentifier(
        request.params.userId
      );

    const accountStatus =
      normalizeIdentifier(
        request.body?.accountStatus
      );

    if (
      !ACCOUNT_STATUSES.includes(
        accountStatus
      ) ||
      accountStatus === 'ARCHIVED'
    ) {
      throw new ApiError(
        400,
        'INVALID_ACCOUNT_STATUS',
        'The requested account status is invalid.'
      );
    }

    const user = await User.findOne({
      organisationId:
        request.auth.organisationId,
      userId,
      accountStatus: {
        $ne: 'ARCHIVED',
      },
    });

    if (!user) {
      throw new ApiError(
        404,
        'USER_NOT_FOUND',
        'The user was not found.'
      );
    }

    if (
      user.userId ===
        request.auth.userId &&
      accountStatus !== 'ACTIVE'
    ) {
      throw new ApiError(
        400,
        'SELF_STATUS_CHANGE_BLOCKED',
        'You cannot deactivate your own MASTER account.'
      );
    }

    user.accountStatus =
      accountStatus;

    user.lockedUntil = null;
    user.failedLoginAttempts = 0;
    user.sessionVersion += 1;
    user.updatedBy =
      request.auth.userId;

    await user.save();

    if (accountStatus !== 'ACTIVE') {
      await revokeAllUserSessions({
        organisationId:
          request.auth.organisationId,
        userId: user.userId,
        revokedBy:
          request.auth.userId,
        reason:
          accountStatus === 'LOCKED'
            ? 'ACCOUNT_LOCKED'
            : 'ACCOUNT_SUSPENDED',
        details:
          `User account status changed to ${accountStatus}.`,
      });
    }

    return response.status(200).json({
      success: true,
      message:
        'User status updated successfully.',
      data: {
        user,
      },
      correlationId:
        request.correlationId || null,
    });
  }
);

const archiveUser = asyncHandler(
  async (request, response) => {
    requireMaster(request);

    const userId =
      normalizeIdentifier(
        request.params.userId
      );

    const reason =
      typeof request.body?.reason ===
        'string'
        ? request.body.reason.trim()
        : '';

    if (!reason) {
      throw new ApiError(
        400,
        'ARCHIVE_REASON_REQUIRED',
        'An archive reason is required.'
      );
    }

    if (
      userId === request.auth.userId
    ) {
      throw new ApiError(
        400,
        'SELF_ARCHIVE_BLOCKED',
        'You cannot archive your own MASTER account.'
      );
    }

    const user = await User.findOne({
      organisationId:
        request.auth.organisationId,
      userId,
      accountStatus: {
        $ne: 'ARCHIVED',
      },
    });

    if (!user) {
      throw new ApiError(
        404,
        'USER_NOT_FOUND',
        'The user was not found.'
      );
    }

    user.accountStatus = 'ARCHIVED';
    user.archivedAt = new Date();
    user.archivedBy =
      request.auth.userId;
    user.archiveReason = reason;
    user.sessionVersion += 1;
    user.updatedBy =
      request.auth.userId;

    await user.save();

    await revokeAllUserSessions({
      organisationId:
        request.auth.organisationId,
      userId: user.userId,
      revokedBy:
        request.auth.userId,
      reason: 'ACCOUNT_SUSPENDED',
      details:
        'The user account was archived.',
    });

    return response.status(200).json({
      success: true,
      message:
        'User archived successfully.',
      data: {
        user,
      },
      correlationId:
        request.correlationId || null,
    });
  }
);

module.exports = {
  listUsers,
  getUser,
  createUser,
  updateUser,
  changeUserStatus,
  archiveUser,
};