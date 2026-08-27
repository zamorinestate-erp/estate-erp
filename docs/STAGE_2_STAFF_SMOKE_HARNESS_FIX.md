# STAGE-2 STAFF SMOKE TEST-HARNESS CORRECTION & CANONICAL STABILIZATION REPORT

**Document ID:** ZAMORIN-STAGE2-HARNESS-FIX-V1  
**Target Branch:** `fix/stage2-staff-smoke-stability`  
**Base Commit:** `f6d6f9caad518b5b31ede57d40ac716dd2a9aa12`  
**Date:** 2026-08-28  
**Status:** FULLY CERTIFIED & CANONICALLY FROZEN (100% PASS)

---

## 1. Executive Summary

An independent verification of the Stage-2 Foundation audit (`scripts/audit_stage2_foundation.mjs`) identified a test-harness timing race in the Staff Shared-Infrastructure Smoke Test along with a process exit code omission. 

Both defects were confined exclusively to the test harness (`scripts/audit_stage2_foundation.mjs`); zero production application code was altered. The test harness was stabilized with condition-based readiness polling and explicit exit-code propagation (`process.exit(1)` on assertion failure), achieving **10/10 cold-run passes**, **100% warm-run passes**, and complete alignment across all 15 foundation checks.

---

## 2. Root Cause Analysis

1. **Test-Harness Timing Race (`await wait(600)`):**
   - In `scripts/audit_stage2_foundation.mjs`, Section 4 navigated headless Chrome to `/?role=staff#staff-home` and waited a hardcoded 600ms before evaluating DOM elements.
   - On cold browser spawns over CDP on Windows, dynamic module import (`staffHome.js`) and component rendering required 1,000ms to 3,800ms (observed cold readiness: up to 3,763ms).
   - The fixed 600ms wait evaluated the DOM before modules completed mounting, causing an apparent route count mismatch (0 or partial vs 5 expected).
   - In contrast, the application code was 100% functional, as verified by `scripts/audit_all_five_personas.mjs` (36/36 checks passing) and `scripts/test_all_subroutes_no_errors.mjs` (149/149 routes passing).

2. **Exit Code Propagation Omission:**
   - `scripts/audit_stage2_foundation.mjs` lacked assertion tracking and unconditional `process.exit(0)` was invoked even when an assertion condition evaluated false.

---

## 3. Implemented Corrections

### 3.1 Condition-Based Readiness Polling (`SimpleCDP.waitForCondition`)
- Replaced arbitrary static delay with bounded condition-based polling:
  ```javascript
  async waitForCondition(expression, timeoutMs = 6000, pollIntervalMs = 50) {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      try {
        const val = await this.evaluate(expression);
        if (val && val.isReady) {
          return { ...val, readinessTimeMs: Date.now() - start };
        }
      } catch (e) {}
      await wait(pollIntervalMs);
    }
    const finalVal = await this.evaluate(expression);
    return { ...finalVal, timedOut: true, readinessTimeMs: Date.now() - start };
  }
  ```
- Readiness predicate evaluated:
  1. Exactly 5 self-service navigation links (`.sidebar .nav-link`)
  2. Zero forbidden administrative routes (`dashboard`, `finance`, `payroll`, `revenue-share`, `admin`, `inventory`)
  3. Correct landing page route (`staff-home`)

### 3.2 Rich Diagnostic Telemetry on Timeout
- In the event of a timeout, the harness captures:
  - Current URL and window hash
  - Visible route array and count
  - Forbidden routes presence flag
  - Scope pill label
  - DOM readyState
  - Console errors captured during navigation

### 3.3 Strict Assertion Tracking & Exit-Code Guard
- Implemented `assert(name, condition, details)` tracking `passedChecks` and `failedChecks`.
- If `failedChecks > 0 || errors.length > 0`, the script logs failed assertions and immediately executes `process.exit(1)`.
- If all 15 checks pass with 0 uncaught errors, the script outputs completion summary and executes `process.exit(0)`.

---

## 4. Test Invariant & Security Preservation

- **STAFF_ASSERTIONS_REMOVED:** 0
- **SECURITY_ASSERTIONS_REMOVED:** 0
- **COVERAGE_REDUCED:** 0
- **ALL 15 FOUNDATION CHECKS PRESERVED:**
  1. Profile [Primary Master] API Transport (0 missing session errors)
  2. Profile [Normal Master] API Transport (0 missing session errors)
  3. Profile [Owner] API Transport (0 missing session errors)
  4. Profile [Cafe Operations] API Transport (0 missing session errors)
  5. POS Charge Session Transport (0 missing session errors)
  6. Inventory API Transport (0 missing session errors)
  7. Menu Management API Transport (0 missing session errors)
  8. Download File Transport Utility Contract
  9. Universal Modal System (0 Home Icons & Esc Dismissal)
  10. Shared Select / Dropdown Primitive
  11. Shared DatePicker Primitive
  12. Global Topbar Status & 3-Tab Notifications
  13. Staff Shared-Infrastructure Smoke Test (5 Self-Service Routes, 0 Forbidden)
  14. Four-Theme Stability Matrix (Paper, Pearl, Midnight, Noir)
  15. Uncaught Stage-2 Runtime Errors (0 Console Errors)

---

## 5. Negative Exit-Code Test Verification

A temporary controlled failure was injected into `scripts/audit_stage2_foundation.mjs` (`assert('Download File Transport Utility', false)`):
- **Failed Assertions:** 1
- **Process Exit Code:** `1` (Non-Zero Failure)
- **Verification Result:** PASS (Negative failure propagation proven).
- Diagnostic injection was completely reverted immediately following verification.

---

## 6. Cold-Run & Warm-Run Stability Battery

10 separate cold executions (spawning fresh headless Chrome processes on port 3000/9223) were executed sequentially:

| Run # | Status | Exit Code | Staff Readiness (ms) | Visible Routes | Duration (ms) |
|:-----:|:------:|:---------:|:--------------------:|:--------------:|:-------------:|
| Run 01 | PASS | 0 | 328ms | 5 | 21,112ms |
| Run 02 | PASS | 0 | 219ms | 5 | 23,772ms |
| Run 03 | PASS | 0 | 333ms | 5 | 24,034ms |
| Run 04 | PASS | 0 | 354ms | 5 | 27,410ms |
| Run 05 | PASS | 0 | 540ms | 5 | 23,929ms |
| Run 06 | PASS | 0 | 416ms | 5 | 21,329ms |
| Run 07 | PASS | 0 | 2073ms | 5 | 30,900ms |
| Run 08 | PASS | 0 | 403ms | 5 | 25,020ms |
| Run 09 | PASS | 0 | 335ms | 5 | 24,711ms |
| Run 10 | PASS | 0 | 485ms | 5 | 21,553ms |

**10-Run Cold Summary:** 10 / 10 PASSED (100% GREEN)  
**Warm-Run Summary:** 100% PASS (Zero divergence between cold and warm runs)

---

## 7. Full Regression Suite Results

- **Stage 2 Foundation Audit (`audit_stage2_foundation.mjs`):** 15/15 PASS (Exit Code 0)
- **Five-Persona Audit (`audit_all_five_personas.mjs`):** 36/36 PASS (Exit Code 0)
- **Subroutes No-Error Audit (`test_all_subroutes_no_errors.mjs`):** 149/149 PASS (Exit Code 0)
- **Cache Security & Dedup Audit (`audit_cache_security_and_dedup.mjs`):** 11/11 PASS (Exit Code 0)
- **Application Performance Audit (`audit_application_performance.mjs`):** PASS (Exit Code 0)
- **Zero Dead Controls Audit (`run_all_control_audits.mjs`):** 15/15 SUITES PASS (Exit Code 0)
- **Static Syntax Verification (`verify_all.js`):** 331 files verified, 0 errors
- **Git Diff Check (`git diff --check`):** PASS (0 whitespace / conflict errors)

---

## 8. Conclusion

The Stage-2 Foundation test harness is fully stabilized, hardened with condition-based readiness and strict exit-code enforcement, and validated with zero regressions across the entire ERP platform.
