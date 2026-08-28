'use strict';
const sessionPolicy = require('../config/sessionPolicy');

function checkClientClock(clientTimestampMs, now = Date.now()) {
  if (typeof clientTimestampMs !== 'number') return { ok: true, driftSeconds: null };
  const driftSeconds = Math.abs(now - clientTimestampMs) / 1000;
  return { ok: driftSeconds <= sessionPolicy.MAX_CLOCK_DRIFT_SECONDS, driftSeconds };
}
function serverTime() { return new Date(); }

module.exports = { checkClientClock, serverTime };
