# ZAMORIN CAFE ERP — UNAPPROVED OR DORMANT FEATURES REGISTER

> **Status**: VERIFIED & RECONCILED  
> **Release Baseline**: `v1.2.0` (Commit `4765c2c`)  
> **Test Suite**: 332 / 332 PASSING (100%)

---

## 1. Feature Review & Scope Classification Table

| Feature Name | Category | Affected Files | Route Status | Model Status | Permissions | Scope Recommendation | Action Taken |
|---|---|---|---|---|---|---|---|
| **Recruitment / ATS** | Unapproved Feature | `Candidate.js`, `expansionModulesController.js` | **Deactivated** (API routes removed from `expansionModulesRoutes.js`) | Model retained internal-only | Reuses `EMPLOYEE:READ` | Keep deactivated unless explicitly approved by Product Owner | **Deactivated API endpoints from `expansionModulesRoutes.js`** |
| **Kitchen Operations & KDS** | Excluded Feature | None | None | None | None | Exclude completely | **Confirmed No Code Exists** |
| **Compare Locations Module** | Excluded Feature | None | None | None | None | Exclude completely | **Confirmed No Code Exists** |
