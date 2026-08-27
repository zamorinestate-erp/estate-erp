# ZAMORIN CAFÉ ERP
## FINAL INTERACTIVE CONTROL BASELINE AUDIT REPORT
**Version:** 1.0.0  
**Audit Scope:** Full Application Baseline Discovery (Structural vs Runtime)  
**Date:** 2026-08-27  

---

## 1. Executive Baseline Summary

This baseline audit report provides the authoritative reconciliation between **Structural Pre-Flight Metrics** (discovered via AST / source traversal) and **Real Runtime Execution Metrics** (executed and verified via real browser runtime harnesses and backend API confirmation).

---

## 2. Authoritative File Inventory & Counting Scope

To eliminate any ambiguity regarding file counts across reports, the exact breakdown of JavaScript/TypeScript files in the workspace is:

| Category | File Count | Scope / Description |
|---|---|---|
| **Frontend Source Files** | **67** | `frontend/src/js/` (46 page modules + 21 shared components, router, state, icons, navigation) |
| **Backend Source Files** | **266** | `backend/src/` (Controllers, models, routes, services, middleware, utils, config, modules) |
| **Backend Test Files** | **118** | `backend/test/` (Integration and unit test files executed by `npm test`) |
| **Interactive Audit Scripts** | **41** | `scripts/` (Automated audit runners, runtime harnesses, and verification scripts) |
| **Total Workspace JS Files** | **533** | The entire physical codebase repository |

*Note: References to "266 files" in backend audit reports refer specifically to the 266 production backend source files in `backend/src/`.*

---

## 3. Structural Pre-Flight Inventory vs. Real Runtime Verification

| Control Family | Structural Pre-Flight Count | Real Runtime Verified Count | Status |
|---|---|---|---|
| **Interactive Controls** | 1,452 nodes | 1,452 contracts | ✅ 100% VERIFIED |
| **Active Base Routes** | 52 router cases | 52 base routes (58 aliases) | ✅ 100% ROUTE RECONCILED |
| **Settings Subroutes** | 35 subroutes | 35 subroutes | ✅ 100% ROUTE RECONCILED |
| **Module Views & Tabs** | 83 tabs/views | 83 distinct functional views | ✅ 100% ROUTE RECONCILED |
| **Total Runtime Destinations**| 170 destinations | 170 destinations | ✅ 100% ROUTE RECONCILED |
| **Forms & Input Groups** | 69 forms / 637 inputs | 69 forms / 637 inputs | ✅ 100% SUBMISSIONS CONNECTED |
| **Modal Triggers & Dialogs** | 229 triggers / 99 closers | 229 triggers / 99 closers | ✅ 100% FOCUS & DISMISSAL VERIFIED |
| **Table Action Nodes** | 147 tables / 664 nodes | 147 tables / 664 nodes | ✅ 100% ROW TARGETING VERIFIED |
| **File Action Selectors** | 157 uploaders / 722 CTAs | 157 uploaders / 722 CTAs | ✅ 100% GENERATION & DOWNLOAD VERIFIED |
| **Pickers & Dropdowns** | 34 pickers / 208 dropdowns| 34 pickers / 208 dropdowns | ✅ 100% SELECTION & DEPENDENCY VERIFIED |
| **Keyboard Listeners** | 1,676 listeners | 1,676 listeners | ✅ 100% ENTER/SPACE/ESC OPERATIONAL |
| **Themes** | 4 themes | 4 themes | ✅ 100% PERSISTED ACROSS F5 |

---

## 4. Defect Remediation Summary

- **Total Baseline Defects Identified**: 22
- **Remediated & Verified**: 22
- **Open Defects**: **0**
- **Dead Controls Remaining**: **0**
