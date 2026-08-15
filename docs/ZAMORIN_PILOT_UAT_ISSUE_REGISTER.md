# ZAMORIN CAFE ERP — PILOT / UAT ISSUE REGISTER

**TRACKING STATUS**: ACTIVE REGISTER  
**PILOT LOCATION**: `ZC-0001` (Flagship Cafe)  
**GATE RULE**: P0 = 0, P1 = 0 Required for Full Production Go-Live Sign-Off  

---

## 1. Severity Definitions

- **P0 (Critical Blocker)**: System unavailability, security vulnerability, cross-tenant/cross-user data leakage, financial variance > ₹0.00, or authentication failure.
- **P1 (High)**: Major business workflow impediment without a viable workaround.
- **P2 (Medium)**: Minor functional or usability defect with an established operational workaround.
- **P3 (Low)**: Cosmetic, terminology, or documentation enhancement.

---

## 2. Issue Tracking Log

| Issue ID | Date / Time | Role | Cafe | Workflow Area | Expected Behavior | Actual Behavior | Severity | Correlation ID | Root Cause | Fix Commit | Retest Status | Status |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| *REGISTER OPEN* | — | — | — | — | — | — | — | — | — | — | — | **NO DEFECTS LOGGED** |

---

## 3. Issue Escalation & Resolution Protocol

1. **Detection & Correlation**: When an anomaly occurs during human Pilot/UAT, capture the user ID, café ID, timestamp, and HTTP response `correlationId`.
2. **Reproduction & Regression**: Create an isolated automated regression test reproducing the defect.
3. **Remediation & Build**: Commit code fix, ensure full suite passes (337+ tests), and deploy exact commit to staging and production.
4. **Verification & Retest**: Verify with the reporting pilot user and update this register.
