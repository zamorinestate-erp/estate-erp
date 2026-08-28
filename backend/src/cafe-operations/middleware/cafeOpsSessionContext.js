'use strict';
const { getRepositories } = require('../repositories');
const { sha256Hex } = require('../utils/ids');
const cafeOpsSessionService = require('../services/cafeOpsSessionService');
const { fail } = require('../utils/responses');

function extractSessionToken(req) { return req.headers['x-cafeops-session-token'] || null; }

// IMPORTANT: this factory is synchronous — it returns an Express middleware
// function directly, not a Promise of one. (An earlier draft had
// `async function cafeOpsSessionContext(...)`, which would have made every
// route wiring line silently pass a Promise where Express expects a
// function. Caught before it shipped; noting it here on purpose so it isn't
// reintroduced.)
function cafeOpsSessionContext({ allowLocked = false } = {}) {
  return async function (req, res, next) {
    try {
      const token = extractSessionToken(req);
      if (!token) return fail(res, 401, 'SESSION_REQUIRED', 'Sign in again to continue Cafe Operations.');

      const repos = getRepositories();
      const session = await repos.sessions.findByTokenHash(sha256Hex(token));
      if (!session || String(session.deviceId) !== String(req.cafeOpsDevice.id)) {
        return fail(res, 401, 'SESSION_INVALID', 'Sign in again to continue Cafe Operations.');
      }

      const liveness = await cafeOpsSessionService.evaluateSessionLiveness(session);
      if (liveness.expired) {
        return fail(res, 401, 'SESSION_EXPIRED', 'Sign in again to continue Cafe Operations.', { reason: liveness.reason });
      }
      if (liveness.shouldLock && session.status === 'ACTIVE') {
        await cafeOpsSessionService.lockSession(session.id);
        session.status = 'LOCKED';
      }
      if (session.status === 'LOCKED' && !allowLocked) {
        return fail(res, 423, 'SESSION_LOCKED', 'Enter your credentials to continue.');
      }

      req.cafeOpsSession = session;
      next();
    } catch (err) { next(err); }
  };
}

module.exports = { cafeOpsSessionContext, extractSessionToken };
