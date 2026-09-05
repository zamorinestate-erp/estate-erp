'use strict';
let bcrypt;
try {
  bcrypt = require('bcrypt');
} catch {
  bcrypt = require('bcryptjs');
}
const crypto = require('crypto');
const pinPolicy = require('../config/pinPolicy');
const { getRepositories } = require('../repositories');

const PEPPER = process.env.CAFE_OPS_PIN_PEPPER || 'REPLACE_WITH_A_REAL_SECRET_VIA_CAFE_OPS_PIN_PEPPER_ENV_VAR';

const SALT_ROUNDS = process.env.NODE_ENV === 'production' ? 12 : 4;

// Precomputed once, at runtime, via bcrypt itself — not a hand-typed string —
// so it's guaranteed to be a validly-formatted hash bcrypt will happily run
// a full comparison against. Used to keep "no PIN matched" and "PIN matched
// but was wrong" taking the same amount of time, so response timing can't
// be used to enumerate which PINs are in use.
const DUMMY_HASH = bcrypt.hashSync('__no_candidate_found__', SALT_ROUNDS);

function isWeakPin(pin) {
  if (!/^\d{6}$/.test(pin)) return true;
  if (pinPolicy.BLOCKLIST.has(pin)) return true;
  const digits = pin.split('').map(Number);
  let ascending = true, descending = true;
  for (let i = 1; i < digits.length; i++) {
    if (digits[i] !== digits[i - 1] + 1) ascending = false;
    if (digits[i] !== digits[i - 1] - 1) descending = false;
  }
  if (ascending || descending) return true;
  if (new Set(digits).size === 1) return true;
  return false;
}

// Organisation-wide uniqueness (stronger than the spec's per-cafe minimum —
// see ARCHITECTURE_DECISIONS.md section 5). No cafeId in the lookup key: a
// device only ever supplies a cafeId, never an employee, so the PIN itself
// has to be enough to find the one candidate before bcrypt confirms it.
function computeLookupHash(pin) {
  return crypto.createHmac('sha256', PEPPER).update(String(pin)).digest('hex');
}

async function hashPin(pin) { return bcrypt.hash(pin, SALT_ROUNDS); }

async function verifyPin(pin, hash) {
  if (!hash) { await bcrypt.compare(String(pin), DUMMY_HASH); return false; }
  return bcrypt.compare(String(pin), hash);
}

function generateRandomPin() {
  let pin;
  do { pin = String(crypto.randomInt(0, 1000000)).padStart(6, '0'); } while (isWeakPin(pin));
  return pin;
}

async function issueOrResetPin({ employeeId, organisationId, actingEmployeeId, pin, isReset }) {
  const repos = getRepositories();
  const candidate = pin || generateRandomPin();
  if (isWeakPin(candidate)) { const err = new Error('WEAK_PIN'); err.code = 'WEAK_PIN'; throw err; }

  const lookupHash = computeLookupHash(candidate);
  const taken = await repos.operatorCredentials.isLookupHashTaken(lookupHash, employeeId);
  if (taken) { const err = new Error('PIN_COLLISION'); err.code = 'PIN_COLLISION'; throw err; }

  const pinHash = await hashPin(candidate);
  const record = await repos.operatorCredentials.upsertForEmployee(employeeId, {
    organisationId, pinHash, pinLookupHash: lookupHash, status: 'ACTIVE',
    lastResetAt: isReset ? new Date() : undefined,
    lastChangedByEmployeeId: actingEmployeeId,
  });
  // plainPin is returned exactly once to the caller (an admin UI, over an
  // authenticated governance channel) — it is never stored or logged past
  // this point (see services/auditService.js's key sanitizer).
  return { record, plainPin: candidate };
}

module.exports = { isWeakPin, computeLookupHash, hashPin, verifyPin, generateRandomPin, issueOrResetPin };
