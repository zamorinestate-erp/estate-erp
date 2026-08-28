'use strict';
const { getRepositories } = require('../repositories');
const { generateEnrollmentCode, sha256Hex } = require('../utils/ids');
const sessionPolicy = require('../config/sessionPolicy');

async function createEnrollmentToken({ organisationId, cafeId, cafeDisplayName, intendedDisplayName, createdByEmployeeId }) {
  const repos = getRepositories();
  const codePlain = generateEnrollmentCode();
  const record = await repos.enrollmentTokens.create({
    tokenHash: sha256Hex(codePlain),
    organisationId, cafeId, cafeDisplayName, intendedDisplayName, createdByEmployeeId,
    status: 'PENDING',
    expiresAt: new Date(Date.now() + sessionPolicy.ENROLLMENT_TOKEN_TTL_MINUTES * 60000),
  });
  return { record, codePlain };
}

module.exports = { createEnrollmentToken };
