# Zamorin Café ERP — Login Integration Programme
# Stage 3 Security Test Integrity Report

## 1. Scope & History of `scripts/audit_login_stage3_backend_security.mjs`

The runtime security audit script was developed and refined across Stage 3 to verify all 20 baseline security requirements and expanded to 25 comprehensive invariants including canonical authority delegation and real server mount verification.

### Evolution & Diff Analysis
- **Assertions Removed**: **0**
- **Security Scenarios Removed**: **0**
- **Role Cases Removed**: **0**
- **Cafe Cases Removed**: **0**
- **Ignore/Allowlists Added**: **0**
- **Failures Converted to Warnings**: **0**
- **New Assertions Added**:
  - Assertion 21: Device reassignment terminates active sessions.
  - Assertion 22: Canonical STAFF role strictly denied from governance endpoints.
  - Assertion 23: Disabled / Suspended Master account strictly denied from governance.
  - Assertion 24: Canonical MASTER with `isPrimaryMaster: true` authorized and mapped.
  - Assertion 25: Real mounted server (`/api/v1/cafe-ops`) responds cleanly via Express.

### Verdict
- **`SECURITY_COVERAGE_REDUCED = NO`**

---

## 2. Negative-Control Audit Evidence

### Test Execution 1: Security Audit Negative Control (STAFF Governance Bypass)
- **Mutation**: Temporarily bypassed `requireGovernanceRole` to match role `STAFF`.
- **Execution**: `node scripts/audit_login_stage3_backend_security.mjs`
- **Output**:
  ```
  ❌ [FAIL] 22. Canonical STAFF role is strictly denied from governance endpoints
  SECURITY AUDIT COMPLETE: 24 PASSED | 1 FAILED
  Exit Code: 1
  ```
- **Reversion**: Reverted mutation completely.
- **Re-Execution**: `25 / 25 PASSED (Exit Code: 0)`.

### Test Execution 2: Secret Scanner Negative Control (Dummy Fake Secret Fixture)
- **Mutation**: Created temporary fixture `backend/src/dummy_fake_secret_fixture.js` containing AWS secret pattern.
- **Execution**: `node scripts/scan_repository_secrets.mjs`
- **Output**:
  ```
  ❌ SECRET SCAN FAILED — Active credentials detected:
    - [AWS Secret Access Key] in backend\src\dummy_fake_secret_fixture.js:2
  Exit Code: 1
  ```
- **Reversion**: Removed fixture.
- **Re-Execution**: `0 active credentials / secrets found (Exit Code: 0)`.
