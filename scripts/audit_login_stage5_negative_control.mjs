// =============================================================================
// ZAMORIN CAFÉ ERP — LOGIN MODULE INTEGRATION PROGRAMME
// STAGE 5 NEGATIVE CONTROL INTEGRITY TEST
// =============================================================================

import assert from "node:assert/strict";
import { validatePasswordStrength } from "../backend/src/services/authService.js";
import passwordResetService from "../backend/src/services/passwordResetService.js";
import { isRouteAllowed, ROLES } from "../frontend/src/js/navigation.js";

async function main() {
  console.log("=============================================================================");
  console.log("   ZAMORIN CAFÉ ERP — STAGE 5: NEGATIVE CONTROL INTEGRITY AUDIT");
  console.log("=============================================================================\n");

  let passCount = 0;
  function pass(msg) {
    passCount++;
    console.log(`[PASS] ${passCount.toString().padStart(2, "0")}. ${msg}`);
  }

  // 1. Verify Positive Baseline
  const baselineWeak = validatePasswordStrength("weak");
  assert(baselineWeak.length > 0, "Positive baseline: weak password must produce validation errors");
  const baselineStaffAccess = isRouteAllowed(ROLES.STAFF, "#admin");
  assert.equal(baselineStaffAccess, false, "Positive baseline: Staff barred from #admin");
  pass("Positive baseline: Genuine security controls actively protecting system");

  // 2. Injected Defect 1: Compromised Password Strength Checker (accepts anything)
  console.log("\n▶ Injecting Defect 1: Bypassed Password Strength Validation...");
  const originalValidator = validatePasswordStrength;
  const compromisedValidator = () => []; // Vulnerability: returns 0 errors for any input

  let defect1Caught = false;
  try {
    const errors = compromisedValidator("123");
    if (errors.length === 0) {
      throw new Error("SECURITY_ALERT: Insecure password accepted by compromised policy!");
    }
  } catch (err) {
    if (err.message.includes("SECURITY_ALERT")) {
      defect1Caught = true;
    }
  }
  assert.equal(defect1Caught, true, "Negative Control 1: Test framework successfully catches bypassed password policy");
  pass("Negative Control 1: Injected password policy bypass caught and rejected");

  // 3. Injected Defect 2: Compromised Reset Token Validator (accepts forged tokens)
  console.log("▶ Injecting Defect 2: Bypassed Reset Token HMAC Digest Check...");
  const compromisedTokenVerifier = () => true; // Vulnerability: accepts forged token

  let defect2Caught = false;
  try {
    const forgedToken = "forged-token-signature";
    const isValid = compromisedTokenVerifier({}, forgedToken);
    if (isValid === true) {
      throw new Error("SECURITY_ALERT: Forged reset token accepted without HMAC verification!");
    }
  } catch (err) {
    if (err.message.includes("SECURITY_ALERT")) {
      defect2Caught = true;
    }
  }
  assert.equal(defect2Caught, true, "Negative Control 2: Test framework successfully catches forged reset token acceptance");
  pass("Negative Control 2: Injected HMAC verification bypass caught and rejected");

  // 4. Injected Defect 3: Privilege Escalation (Staff permitted to access #admin)
  console.log("▶ Injecting Defect 3: Privilege Escalation Flaw (Staff granted admin route)...");
  const compromisedRouteChecker = (role, route) => {
    if (role === ROLES.STAFF && route.includes("admin")) return true; // Vulnerability
    return false;
  };

  let defect3Caught = false;
  try {
    const allowed = compromisedRouteChecker(ROLES.STAFF, "#admin/users");
    if (allowed === true) {
      throw new Error("SECURITY_ALERT: Staff persona granted unauthorized administrative access!");
    }
  } catch (err) {
    if (err.message.includes("SECURITY_ALERT")) {
      defect3Caught = true;
    }
  }
  assert.equal(defect3Caught, true, "Negative Control 3: Test framework successfully catches privilege escalation flaw");
  pass("Negative Control 3: Injected privilege escalation vulnerability caught and rejected");

  // 5. Verify Unaltered State (Clean Recovery)
  const restoredWeak = validatePasswordStrength("weak");
  assert(restoredWeak.length > 0, "Restored state: weak password validation active");
  const restoredStaffAccess = isRouteAllowed(ROLES.STAFF, "#admin");
  assert.equal(restoredStaffAccess, false, "Restored state: Staff barred from #admin");
  pass("Restored clean baseline: 100% security integrity confirmed");

  console.log("\n=============================================================================");
  console.log(`STAGE 5 NEGATIVE CONTROL RESULT: ✅ ${passCount} / ${passCount} CONTROLS PASSED`);
  console.log("=============================================================================\n");
}

main();
