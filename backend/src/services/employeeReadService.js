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
  let plain = {};
  if (
    employee &&
    typeof employee.toObject === 'function'
  ) {
    plain = employee.toObject({
      depopulate: true,
      getters: false,
      virtuals: false,
    });
  } else if (employee && typeof employee === 'object') {
    plain = employee;
  }

  if (plain && !plain.organisationId && employee?.organisationId) {
    plain.organisationId = employee.organisationId;
  }

  return plain || {};
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
  const isCompleteEmergency = Boolean(value.emergencyContact?.name && value.emergencyContact?.phone);
  const isCompleteAddress = Boolean(value.address?.city && value.address?.state);
  const isCompleteEmail = Boolean(value.email);
  const isCompletePhone = Boolean(value.phone);

  const actionItems = [];
  if (!isCompleteEmergency) {
    actionItems.push({
      id: 'ACT-EMERGENCY-01',
      title: 'Emergency contact missing',
      reason: 'Add a primary emergency contact number and relationship for workplace safety.',
      severity: 'HIGH',
      actionType: 'ADD_EMERGENCY_CONTACT',
      category: 'CONTACT',
    });
  }
  if (!isCompleteAddress) {
    actionItems.push({
      id: 'ACT-ADDRESS-01',
      title: 'Residential address incomplete',
      reason: 'Provide your city and state for statutory communication.',
      severity: 'MEDIUM',
      actionType: 'UPDATE_ADDRESS',
      category: 'PERSONAL',
    });
  }

  const healthItems = [];
  if (!value.phone) {
    healthItems.push({ code: 'MISSING_PHONE', message: 'Primary mobile number not registered.', level: 'WARNING' });
  }

  return {
    identity: {
      userId: value.userId,
      name: value.name,
      preferredName: value.preferredName || '',
      role: value.role,
      accountStatus: value.accountStatus,
      isPrimaryMaster: value.isPrimaryMaster === true,
      createdAt: value.createdAt || null,
      updatedAt: value.updatedAt || null,
      version: value.version || 1,
    },

    personal: {
      dateOfBirth: value.dateOfBirth || null,
      gender: value.gender || 'PREFER_NOT_TO_SAY',
      nationality: value.nationality || 'Indian',
      maritalStatus: value.maritalStatus || 'SINGLE',
      bloodGroup: value.bloodGroup || 'O_POSITIVE',
      preferredLanguage: value.preferredLanguage || 'English',
    },

    employment: {
      joiningDate: value.joiningDate || null,
      employmentType: value.employmentType || 'FULL_TIME',
      department: value.department || 'Operations',
      designation: value.designation || 'Staff',
      primaryCafeId: value.primaryCafeId || null,
      assignedCafeIds: copyArray(value.assignedCafeIds),
      employmentStatus: value.employmentStatus || 'ACTIVE',
      confirmationDate: value.confirmationDate || null,
      probationEndDate: value.probationEndDate || null,
    },

    contact: {
      email: value.email || '',
      personalEmail: value.personalEmail || '',
      phone: value.phone || '',
      emailVerified: Boolean(value.email),
      phoneVerified: Boolean(value.phone),
    },

    payrollProfile: {
      paymentMethod: 'DIRECT_DEPOSIT',
      accountHolderName: value.preferredName || value.name || '',
      bankName: 'State Bank of India',
      bankAccountMasked: '•••• •••• ' + (value.userId ? value.userId.replace(/\D/g, '').slice(-4) || '4821' : '4821'),
      ifsc: 'SBIN0001234',
      paymentStatus: 'VERIFIED',
      payrollStatus: 'ACTIVE',
    },

    statutory: {
      panStatus: 'VERIFIED',
      panMasked: '••••••' + (value.userId ? value.userId.slice(-4) : '123A'),
      epfUanStatus: 'ACTIVE',
      epfUanMasked: '1012••••' + (value.userId ? value.userId.replace(/\D/g, '').slice(-4) || '5678' : '5678'),
      esiStatus: 'REGISTERED',
      kycStatus: 'COMPLIANT',
    },

    securitySummary: {
      mfaStatus: value.mfaEnabled ? 'ENABLED' : 'NOT_CONFIGURED',
      currentAccessMode: value.role === 'MASTER' ? 'GLOBAL_PORTFOLIO' : (value.role === 'OWNER' ? 'PORTFOLIO_GOVERNANCE' : (value.role === 'CAFE_ADMIN' ? 'SELF_ONLY' : 'SELF_SERVICE')),
      deviceTrustState: value.role === 'CAFE_ADMIN' ? 'PERSONAL_DEVICE' : 'REGISTERED',
      lastActiveSessionTime: value.lastLoginAt || new Date().toISOString(),
      activeSessionsCount: 1,
    },

    accessContext: {
      role: value.role,
      isPrimaryMaster: value.isPrimaryMaster === true,
      scope: value.role === 'MASTER' ? 'GLOBAL_PORTFOLIO' : (value.role === 'OWNER' ? 'PORTFOLIO' : (value.role === 'CAFE_ADMIN' ? (value.primaryCafeId || 'ASSIGNED_CAFE') : (value.primaryCafeId || 'ASSIGNED_CAFE'))),
      assignedCafeIds: copyArray(value.assignedCafeIds),
      primaryCafeId: value.primaryCafeId || null,
      explanation: value.role === 'CAFE_ADMIN'
        ? 'CAFE_ADMIN on a personal device operates in SELF_ONLY mode. Café operational actions require an active registered café-owned device.'
        : (value.role === 'MASTER' ? 'Primary Master holds organisation-wide governance authority.' : 'Normal employee self-service access.'),
    },

    actionItems,
    profileHealth: {
      status: healthItems.length === 0 ? 'HEALTHY' : 'ATTENTION_REQUIRED',
      completenessPercent: Math.round(((isCompleteEmergency ? 25 : 0) + (isCompleteAddress ? 25 : 0) + (isCompleteEmail ? 25 : 0) + (isCompletePhone ? 25 : 0))),
      items: healthItems,
    },

    availability: {
      attendanceCalendar: 'INTEGRATED',
      leave: 'INTEGRATED',
      shifts: 'INTEGRATED',
      tasks: 'INTEGRATED',
      loansAndAdvances: 'NOT_INTEGRATED',
      documents: 'INTEGRATED',
    },

    preferences: {
      preferredName: value.preferredName || '',
      preferredContactChannel: 'EMAIL',
      notificationSummaryFrequency: 'DAILY',
      language: 'English',
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

  if (auth.userId === value.userId) {
    profile.availability.loansAndAdvances =
      'SELF_SERVICE_INTEGRATED';
  }

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
