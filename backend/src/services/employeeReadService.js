'use strict';

const { ApiError } = require('../utils/ApiError');

const EMPLOYEE_ROLES = new Set([
  'MASTER',
  'OWNER',
  'CAFE_ADMIN',
  'STAFF',
]);

const MIN_SEARCH_FRAGMENT_LENGTH = 2;
const MAX_SEARCH_FRAGMENT_LENGTH = 32;
const MAX_EMPLOYEE_SEARCH_TERMS = 512;

function normalizeOptionalText(value) {
  return typeof value === 'string'
    ? value.trim()
    : '';
}

function normalizeSearchText(value) {
  if (typeof value !== 'string') {
    return '';
  }

  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('en')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

function normalizePreviousNames(value) {
  if (!Array.isArray(value)) {
    return [];
  }

  const normalizedNames = [];
  const seen = new Set();

  for (const item of value) {
    const trimmed = normalizeOptionalText(item)
      .replace(/\s+/g, ' ');

    const comparisonValue =
      normalizeSearchText(trimmed);

    if (
      !trimmed ||
      !comparisonValue ||
      seen.has(comparisonValue)
    ) {
      continue;
    }

    seen.add(comparisonValue);
    normalizedNames.push(trimmed);
  }

  return normalizedNames;
}

function addTerm(terms, value) {
  if (
    !value ||
    value.length < MIN_SEARCH_FRAGMENT_LENGTH ||
    terms.size >= MAX_EMPLOYEE_SEARCH_TERMS
  ) {
    return;
  }

  terms.add(value);
}

function addPrefixes(terms, value) {
  const maximumLength = Math.min(
    value.length,
    MAX_SEARCH_FRAGMENT_LENGTH
  );

  for (
    let length = MIN_SEARCH_FRAGMENT_LENGTH;
    length <= maximumLength;
    length += 1
  ) {
    addTerm(terms, value.slice(0, length));

    if (terms.size >= MAX_EMPLOYEE_SEARCH_TERMS) {
      return;
    }
  }
}

function addSubstrings(terms, value) {
  const maximumFragmentLength = Math.min(
    value.length,
    MAX_SEARCH_FRAGMENT_LENGTH
  );

  for (
    let start = 0;
    start <= value.length - MIN_SEARCH_FRAGMENT_LENGTH;
    start += 1
  ) {
    for (
      let length = MIN_SEARCH_FRAGMENT_LENGTH;
      length <= maximumFragmentLength &&
      start + length <= value.length;
      length += 1
    ) {
      addTerm(
        terms,
        value.slice(start, start + length)
      );

      if (terms.size >= MAX_EMPLOYEE_SEARCH_TERMS) {
        return;
      }
    }
  }
}

function buildEmployeeSearchTerms({
  name = '',
  preferredName = '',
  previousNames = [],
} = {}) {
  const normalizedSources = [
    name,
    preferredName,
    ...normalizePreviousNames(previousNames),
  ]
    .map(normalizeSearchText)
    .filter(Boolean);

  const baseTerms = [];
  const seenBaseTerms = new Set();

  for (const source of normalizedSources) {
    const candidates = [
      source,
      ...source.split(' '),
    ];

    for (const candidate of candidates) {
      if (
        candidate &&
        !seenBaseTerms.has(candidate)
      ) {
        seenBaseTerms.add(candidate);
        baseTerms.push(candidate);
      }
    }
  }

  const terms = new Set();

  for (const value of baseTerms) {
    addTerm(terms, value);
  }

  for (const value of baseTerms) {
    addPrefixes(terms, value);

    if (terms.size >= MAX_EMPLOYEE_SEARCH_TERMS) {
      break;
    }
  }

  for (const value of normalizedSources) {
    addSubstrings(terms, value);

    if (terms.size >= MAX_EMPLOYEE_SEARCH_TERMS) {
      break;
    }
  }

  for (const value of baseTerms) {
    addSubstrings(terms, value);

    if (terms.size >= MAX_EMPLOYEE_SEARCH_TERMS) {
      break;
    }
  }

  return [...terms];
}

function buildEmployeeSearchQueryTerm(value) {
  const normalizedValue =
    normalizeSearchText(value);

  return normalizedValue.length >=
    MIN_SEARCH_FRAGMENT_LENGTH
    ? normalizedValue
    : '';
}

function normalizeIdentifier(value) {
  return typeof value === 'string'
    ? value.trim().toUpperCase()
    : '';
}

function normalizeCafeIds(value) {
  if (!Array.isArray(value)) {
    return [];
  }

  return [
    ...new Set(
      value
        .map(normalizeIdentifier)
        .filter(Boolean)
    ),
  ];
}

function getPlainEmployee(employee) {
  if (
    employee &&
    typeof employee.toObject === 'function'
  ) {
    return employee.toObject({
      depopulate: true,
      getters: false,
      virtuals: false,
    });
  }

  return employee && typeof employee === 'object'
    ? employee
    : {};
}

function copyArray(value) {
  return Array.isArray(value)
    ? value.map((item) => {
        if (
          item &&
          typeof item.toObject === 'function'
        ) {
          return item.toObject();
        }

        if (
          item &&
          typeof item === 'object' &&
          !(item instanceof Date)
        ) {
          return { ...item };
        }

        return item;
      })
    : [];
}

function copySubdocument(value) {
  if (!value) {
    return null;
  }

  if (typeof value.toObject === 'function') {
    return value.toObject();
  }

  return typeof value === 'object'
    ? { ...value }
    : null;
}

function assertAuthenticatedEmployeeActor(auth) {
  if (
    !auth ||
    !EMPLOYEE_ROLES.has(auth.role) ||
    !normalizeIdentifier(auth.organisationId) ||
    !normalizeIdentifier(auth.userId)
  ) {
    throw new ApiError(
      401,
      'AUTHENTICATION_REQUIRED',
      'Authenticated employee identity is required.'
    );
  }
}

function buildEmployeeScopeFilter(
  auth,
  { targetUserId = null } = {}
) {
  assertAuthenticatedEmployeeActor(auth);

  const organisationId =
    normalizeIdentifier(auth.organisationId);

  const filter = {
    organisationId,
  };

  const normalizedTargetUserId =
    normalizeIdentifier(targetUserId);

  if (auth.role === 'CAFE_ADMIN') {
    filter.accountStatus = 'ACTIVE';
    filter.assignedCafeIds = {
      $in: normalizeCafeIds(
        auth.assignedCafeIds
      ),
    };

    if (normalizedTargetUserId) {
      filter.userId = normalizedTargetUserId;
    }

    return filter;
  }

  if (auth.role === 'STAFF') {
    const actorUserId =
      normalizeIdentifier(auth.userId);

    if (
      normalizedTargetUserId &&
      normalizedTargetUserId !== actorUserId
    ) {
      throw new ApiError(
        403,
        'SELF_ACCESS_ONLY',
        'Staff may view only their own employee profile.'
      );
    }

    filter.userId = actorUserId;
    return filter;
  }

  if (normalizedTargetUserId) {
    filter.userId = normalizedTargetUserId;
  }

  return filter;
}

function assertEmployeeProfileAccess(
  auth,
  employee
) {
  assertAuthenticatedEmployeeActor(auth);

  const plainEmployee =
    getPlainEmployee(employee);

  if (
    normalizeIdentifier(
      plainEmployee.organisationId
    ) !==
    normalizeIdentifier(auth.organisationId)
  ) {
    throw new ApiError(
      404,
      'EMPLOYEE_NOT_FOUND',
      'The employee was not found.'
    );
  }

  if (auth.role === 'CAFE_ADMIN') {
    const actorCafeIds = new Set(
      normalizeCafeIds(
        auth.assignedCafeIds
      )
    );

    const targetCafeIds =
      normalizeCafeIds(
        plainEmployee.assignedCafeIds
      );

    const intersects =
      targetCafeIds.some((cafeId) =>
        actorCafeIds.has(cafeId)
      );

    if (
      plainEmployee.accountStatus !== 'ACTIVE' ||
      !intersects
    ) {
      throw new ApiError(
        404,
        'EMPLOYEE_NOT_FOUND',
        'The employee was not found.'
      );
    }
  }

  if (
    auth.role === 'STAFF' &&
    normalizeIdentifier(
      plainEmployee.userId
    ) !== normalizeIdentifier(auth.userId)
  ) {
    throw new ApiError(
      403,
      'SELF_ACCESS_ONLY',
      'Staff may view only their own employee profile.'
    );
  }

  return plainEmployee;
}

function buildEmployeeSearchResult(employee) {
  const value = getPlainEmployee(employee);

  return {
    userId: value.userId,
    name: value.name,
    preferredName: value.preferredName || '',
    role: value.role,
    accountStatus: value.accountStatus,
    isPrimaryMaster:
      value.isPrimaryMaster === true,
    primaryCafeId:
      value.primaryCafeId || null,
    assignedCafeIds:
      copyArray(value.assignedCafeIds),
    joiningDate:
      value.joiningDate || null,
    department:
      value.department || '',
    designation:
      value.designation || '',
  };
}

function buildRoleHistory(value) {
  return copyArray(value).map((entry) => ({
    fromRole:
      entry.fromRole || null,
    toRole:
      entry.toRole || null,
    changedAt:
      entry.changedAt || null,
    changedBy:
      entry.changedBy || null,
    reason:
      entry.reason || '',
    correlationId:
      entry.correlationId || null,
  }));
}

function buildCafeAssignmentHistory(value) {
  return copyArray(value).map((entry) => ({
    previousAssignedCafeIds:
      copyArray(
        entry.previousAssignedCafeIds
      ),
    assignedCafeIds:
      copyArray(entry.assignedCafeIds),
    previousPrimaryCafeId:
      entry.previousPrimaryCafeId || null,
    primaryCafeId:
      entry.primaryCafeId || null,
    changedAt:
      entry.changedAt || null,
    changedBy:
      entry.changedBy || null,
    reason:
      entry.reason || '',
    correlationId:
      entry.correlationId || null,
  }));
}

function buildBaseEmployeeProfile(value) {
  return {
    identity: {
      userId: value.userId,
      name: value.name,
      preferredName:
        value.preferredName || '',
      role: value.role,
      accountStatus:
        value.accountStatus,
      isPrimaryMaster:
        value.isPrimaryMaster === true,
      createdAt:
        value.createdAt || null,
      updatedAt:
        value.updatedAt || null,
    },

    employment: {
      joiningDate:
        value.joiningDate || null,
      employmentType:
        value.employmentType || '',
      department:
        value.department || '',
      designation:
        value.designation || '',
      primaryCafeId:
        value.primaryCafeId || null,
      assignedCafeIds:
        copyArray(value.assignedCafeIds),
    },

    contact: {
      email: value.email || '',
      phone: value.phone || '',
    },

    availability: {
      attendanceCalendar:
        'DEFERRED_STAGE_4',
      leave:
        'NOT_INTEGRATED',
      shifts:
        'NOT_INTEGRATED',
      tasks:
        'NOT_INTEGRATED',
      loansAndAdvances:
        'NOT_INTEGRATED',
      documents:
        'NOT_INTEGRATED',
    },
  };
}

function buildEmployeeProfile(
  employee,
  auth
) {
  const value =
    assertEmployeeProfileAccess(
      auth,
      employee
    );

  const profile =
    buildBaseEmployeeProfile(value);

  if (auth.role === 'MASTER') {
    profile.identity.previousNames =
      copyArray(value.previousNames);

    profile.contact.address =
      copySubdocument(value.address);

    profile.contact.emergencyContact =
      copySubdocument(
        value.emergencyContact
      );

    profile.history = {
      roleHistory:
        buildRoleHistory(
          value.roleHistory
        ),
      cafeAssignmentHistory:
        buildCafeAssignmentHistory(
          value.cafeAssignmentHistory
        ),
    };

    profile.lifecycle = {
      archivedAt:
        value.archivedAt || null,
      archivedBy:
        value.archivedBy || null,
      archiveReason:
        value.archiveReason || null,
    };
  }

  if (auth.role === 'STAFF') {
    profile.identity.previousNames =
      copyArray(value.previousNames);

    profile.contact.address =
      copySubdocument(value.address);

    profile.contact.emergencyContact =
      copySubdocument(
        value.emergencyContact
      );
  }

  return profile;
}

module.exports = {
  MAX_EMPLOYEE_SEARCH_TERMS,
  normalizeOptionalText,
  normalizeSearchText,
  normalizePreviousNames,
  buildEmployeeSearchTerms,
  buildEmployeeSearchQueryTerm,
  buildEmployeeScopeFilter,
  buildEmployeeSearchResult,
  buildEmployeeProfile,
};
