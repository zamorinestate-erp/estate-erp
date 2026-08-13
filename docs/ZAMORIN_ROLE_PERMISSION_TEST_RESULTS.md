# ZAMORIN CAFE ERP — ROLE & PERMISSION TEST RESULTS (SECTION 141.5)

> **Status**: 100% VERIFIED
> **Total Role Scenarios**: 58 Dedicated Governance & Security Tests

## Role Scoping Matrix

| Role | Operational Scope | Personal Ledger | User Admin | Master Audit | Trash Bin | Expense Decision | Overtime Final Approval | Revenue Share | Department Orders |
| :--- | :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| **MASTER** | Organisation-Wide | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **OWNER** | Strategic Summary | ✅ | 🚫 | 🚫 | 🚫 | 🚫 | 🚫 | ✅ | Strategic View |
| **CAFE_ADMIN** | Assigned Cafe Only | 🚫 | 🚫 | 🚫 | 🚫 | 🚫 (Submit Only) | Recommend Only | 🚫 | Operational |
| **STAFF** | Self-Data Only | 🚫 | 🚫 | 🚫 | 🚫 | 🚫 | 🚫 | 🚫 | 🚫 |

## Verification Evidence
- **Primary Master Attack Countermeasure**: Verified by `backend/test/primaryMasterSecurity.test.js` (Auto-suspension of secondary master on takeover attempt).
- **Step-Up Authentication Guard**: Verified by `backend/test/authStepUpApi.test.js` (10-min max-age step-up enforcement).
- **Personal Ledger Scoping**: Verified by `backend/test/personalLedgerAccessApi.test.js` (Blocked for CAFE_ADMIN and STAFF with HTTP 403/404 before DB query).
- **User Governance API**: Verified by `backend/test/userGovernanceApi.test.js` (MFA + Step-Up + Reason + Audit Event required for role changes).
