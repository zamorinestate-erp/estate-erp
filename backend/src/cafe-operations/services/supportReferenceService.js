'use strict';
const { generateSupportReference } = require('../utils/ids');
const { getRepositories } = require('../repositories');

function generate({ deviceId, reason, extra } = {}) {
  const ref = generateSupportReference();
  const repos = getRepositories();
  // Fire-and-forget: the reference maps to diagnostics server-side only —
  // nothing about what it encodes is ever visible to the person holding it
  // (login spec Section 89 / master spec Section 66).
  repos.securityEvents.record({
    eventType: 'SUPPORT_REFERENCE_ISSUED', deviceId, reasonCode: reason, metadata: { supportReference: ref, ...extra },
  }).catch(() => {});
  return ref;
}

module.exports = { generate };
