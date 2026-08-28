'use strict';
const { getRepositories } = require('../repositories');

// Actively enforced, not just a naming convention: any metadata key that
// looks like it could be a secret is stripped before persistence, even if a
// caller passes one by mistake (login spec Section 118: "Do not log PINs or
// tokens").
const SENSITIVE_KEY_PATTERN = /pin|password|token|secret|mfa.?code|hash/i;

function sanitize(metadata) {
  if (!metadata || typeof metadata !== 'object') return metadata;
  const clean = {};
  for (const [k, v] of Object.entries(metadata)) {
    if (SENSITIVE_KEY_PATTERN.test(k)) continue;
    clean[k] = v;
  }
  return clean;
}

async function record(event) {
  const repos = getRepositories();
  return repos.securityEvents.record({ ...event, metadata: sanitize(event.metadata) });
}

module.exports = { record, sanitize };
