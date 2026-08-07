'use strict';

const { User } = require('../models/User');
const {
  asyncHandler,
} = require('../utils/asyncHandler');
const {
  ApiError,
} = require('../utils/ApiError');
const {
  buildEmployeeSearchQueryTerm,
  buildEmployeeScopeFilter,
  buildEmployeeSearchResult,
  buildEmployeeProfile,
} = require('../services/employeeReadService');
const {
  recordRequestAudit,
} = require('../services/auditService');

const DEFAULT_EMPLOYEE_SEARCH_LIMIT = 25;
const MAX_EMPLOYEE_SEARCH_LIMIT = 100;
const MAX_EMPLOYEE_SEARCH_PAGE = 100000;
const MAX_EMPLOYEE_SEARCH_INPUT_LENGTH = 120;
const MAX_EMPLOYEE_NAME_QUERY_LENGTH = 32;

const EMPLOYEE_SEARCH_PROJECTION = [
  'userId',
  'name',
  'preferredName',
  'role',
  'accountStatus',
  'isPrimaryMaster',
  'primaryCafeId',
  'assignedCafeIds',
  'joiningDate',
  'department',
  'designation',
].join(' ');

const PERMANENT_EMPLOYEE_ID_PATTERN =
  /^[A-Z]{2,10}-\d{4,}$/;

function readSingleQueryValue(value, fieldName) {
  if (Array.isArray(value)) {
    throw new ApiError(
      400,
      'INVALID_SEARCH_QUERY',
      `${fieldName} must be provided only once.`
    );
  }

  return typeof value === 'string'
    ? value.trim()
    : '';
}

function parseStrictPositiveInteger(
  value,
  {
    fieldName,
    fallback,
    maximum,
  }
) {
  if (
    value === undefined ||
    value === null ||
    value === ''
  ) {
    return fallback;
  }

  const text = readSingleQueryValue(
    value,
    fieldName
  );

  if (!/^\d+$/.test(text)) {
    throw new ApiError(
      400,
      'INVALID_PAGINATION',
      `${fieldName} must be a positive integer.`
    );
  }

  const parsedValue =
    Number.parseInt(text, 10);

  if (
    !Number.isSafeInteger(parsedValue) ||
    parsedValue < 1 ||
    parsedValue > maximum
  ) {
    throw new ApiError(
      400,
      'INVALID_PAGINATION',
      `${fieldName} must be between 1 and ${maximum}.`
    );
  }

  return parsedValue;
}

function buildEmployeeSearchRequest(query = {}) {
  const rawQuery = readSingleQueryValue(
    query.q,
    'q'
  );

  if (!rawQuery) {
    throw new ApiError(
      400,
      'EMPLOYEE_SEARCH_QUERY_REQUIRED',
      'An employee search query is required.'
    );
  }

  if (
    rawQuery.length >
    MAX_EMPLOYEE_SEARCH_INPUT_LENGTH
  ) {
    throw new ApiError(
      400,
      'EMPLOYEE_SEARCH_QUERY_TOO_LONG',
      `The employee search query must not exceed ${MAX_EMPLOYEE_SEARCH_INPUT_LENGTH} characters.`
    );
  }

  const normalizedIdentifier =
    rawQuery.toUpperCase();

  let mode;
  let normalizedQuery;

  if (
    PERMANENT_EMPLOYEE_ID_PATTERN.test(
      normalizedIdentifier
    )
  ) {
    mode = 'EXACT_ID';
    normalizedQuery =
      normalizedIdentifier;
  } else {
    mode = 'NAME';
    normalizedQuery =
      buildEmployeeSearchQueryTerm(
        rawQuery
      );

    if (!normalizedQuery) {
      throw new ApiError(
        400,
        'EMPLOYEE_SEARCH_QUERY_TOO_SHORT',
        'Name searches require at least two searchable characters.'
      );
    }

    if (
      normalizedQuery.length >
      MAX_EMPLOYEE_NAME_QUERY_LENGTH
    ) {
      throw new ApiError(
        400,
        'EMPLOYEE_SEARCH_QUERY_TOO_LONG',
        `Name searches must not exceed ${MAX_EMPLOYEE_NAME_QUERY_LENGTH} normalized characters.`
      );
    }
  }

  const page =
    parseStrictPositiveInteger(
      query.page,
      {
        fieldName: 'page',
        fallback: 1,
        maximum:
          MAX_EMPLOYEE_SEARCH_PAGE,
      }
    );

  const limit =
    parseStrictPositiveInteger(
      query.limit,
      {
        fieldName: 'limit',
        fallback:
          DEFAULT_EMPLOYEE_SEARCH_LIMIT,
        maximum:
          MAX_EMPLOYEE_SEARCH_LIMIT,
      }
    );

  return {
    mode,
    normalizedQuery,
    page,
    limit,
  };
}

function buildEmployeeSearchFilter(
  auth,
  searchRequest
) {
  const filter =
    buildEmployeeScopeFilter(auth);

  if (
    searchRequest.mode ===
    'EXACT_ID'
  ) {
    filter.userId =
      searchRequest.normalizedQuery;
  } else {
    filter.employeeSearchTerms =
      searchRequest.normalizedQuery;
  }

  return filter;
}

const searchEmployees = asyncHandler(
  async (request, response) => {
    const searchRequest =
      buildEmployeeSearchRequest(
        request.query
      );

    const filter =
      buildEmployeeSearchFilter(
        request.auth,
        searchRequest
      );

    const skip =
      (searchRequest.page - 1) *
      searchRequest.limit;

    const [
      employeeRows,
      total,
    ] = await Promise.all([
      User.find(filter)
        .select(
          EMPLOYEE_SEARCH_PROJECTION
        )
        .sort({
          name: 1,
          userId: 1,
        })
        .skip(skip)
        .limit(
          searchRequest.limit
        )
        .lean(),

      User.countDocuments(filter),
    ]);

    const employees =
      employeeRows.map(
        buildEmployeeSearchResult
      );

    return response
      .status(200)
      .json({
        success: true,
        data: {
          employees,
          search: {
            mode:
              searchRequest.mode,
            normalizedQuery:
              searchRequest
                .normalizedQuery,
          },
          pagination: {
            page:
              searchRequest.page,
            limit:
              searchRequest.limit,
            total,
            totalPages:
              Math.ceil(
                total /
                searchRequest.limit
              ),
          },
        },
        correlationId:
          request.correlationId ||
          null,
      });
  }
);

/**
 * EMPLOYEE FULL PROFILE — shared fetch logic.
 *
 * buildEmployeeScopeFilter already enforces:
 *   - organisation isolation
 *   - CAFE_ADMIN assigned-café intersection
 *   - STAFF self-only
 * assertEmployeeProfileAccess (inside buildEmployeeProfile) performs
 * a second verification on the found record for defence-in-depth.
 *
 * Returns 404 for not-found AND for out-of-scope records to prevent
 * existence probing.
 */
async function fetchProfileForActor(auth, targetUserId) {
  const filter = buildEmployeeScopeFilter(
    auth,
    { targetUserId }
  );

  const employee = await User.findOne(filter).lean();

  if (!employee) {
    throw new ApiError(
      404,
      'EMPLOYEE_NOT_FOUND',
      'The employee was not found.'
    );
  }

  // buildEmployeeProfile calls assertEmployeeProfileAccess internally,
  // which performs cross-organisation check and role-specific guards.
  return buildEmployeeProfile(employee, auth);
}

/**
 * GET /api/v1/employees/me
 * Returns the authenticated user's own full employee profile.
 * All four roles may call this endpoint.
 */
const getSelfProfile = asyncHandler(
  async (request, response) => {
    const targetUserId =
      request.auth.userId;

    const profile =
      await fetchProfileForActor(
        request.auth,
        targetUserId
      );

    return response
      .status(200)
      .json({
        success: true,
        data: { profile },
        correlationId:
          request.correlationId || null,
      });
  }
);

/**
 * GET /api/v1/employees/:userId
 * Returns an employee's full profile, role-serialized.
 * MASTER  — full authorised profile.
 * OWNER   — read-only; private contact/bank/gov excluded.
 * CAFE_ADMIN — active assigned-café employees only.
 * STAFF   — own profile only (self-access enforced in scope filter).
 *
 * Sensitive reveals (MASTER accessing another employee's full profile)
 * are audit-recorded with riskClassification MEDIUM.
 */
const getEmployeeProfile = asyncHandler(
  async (request, response) => {
    const rawTargetUserId =
      typeof request.params.userId === 'string'
        ? request.params.userId.trim().toUpperCase()
        : '';

    if (!rawTargetUserId) {
      throw new ApiError(
        400,
        'EMPLOYEE_ID_REQUIRED',
        'A valid employee user ID is required.'
      );
    }

    const profile =
      await fetchProfileForActor(
        request.auth,
        rawTargetUserId
      );

    // Record sensitive reveal audit when a privileged actor reads
    // another employee's full profile. Self-reads are lower risk.
    const isSelfRead =
      rawTargetUserId === (
        request.auth.userId || ''
      ).trim().toUpperCase();

    if (!isSelfRead) {
      await recordRequestAudit({
        request,
        module: 'EMPLOYEES',
        action: 'READ_FULL_PROFILE',
        entityType: 'USER',
        entityId: rawTargetUserId,
        after: { viewedBy: request.auth.role },
        result: 'SUCCESS',
        riskClassification:
          request.auth.role === 'MASTER' ? 'MEDIUM' : 'LOW',
      });
    }

    return response
      .status(200)
      .json({
        success: true,
        data: { profile },
        correlationId:
          request.correlationId || null,
      });
  }
);

module.exports = {
  DEFAULT_EMPLOYEE_SEARCH_LIMIT,
  MAX_EMPLOYEE_SEARCH_LIMIT,
  MAX_EMPLOYEE_SEARCH_PAGE,
  MAX_EMPLOYEE_SEARCH_INPUT_LENGTH,
  MAX_EMPLOYEE_NAME_QUERY_LENGTH,
  EMPLOYEE_SEARCH_PROJECTION,
  PERMANENT_EMPLOYEE_ID_PATTERN,
  buildEmployeeSearchRequest,
  buildEmployeeSearchFilter,
  searchEmployees,
  getSelfProfile,
  getEmployeeProfile,
};
