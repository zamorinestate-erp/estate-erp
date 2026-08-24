# ZAMORIN CAFE ERP
## STAGE 4 — FUNCTIONAL DEFECT REGISTER

All 7 deferred Stage-3 defects imported and resolved in Stage 4.

| Defect ID | Original User Report | Profile(s) | Module | Action | Severity | Root Cause | Files Changed / Verified | Fix Applied | Tests & Verification | Status |
|---|---|---|---|---|:---:|---|---|---|---|:---:|
| **DEF-STG3-001** | GSTR-3B PDF Export | OWNER, PRIMARY_MASTER | Finance & Accounts | `tax-review` PDF Export | P2 | Headless PDF generator endpoint for GSTR-3B was returning raw JSON summary | `controllers/financeAccountsController.js`, `pages/financeAccounts.js` | Connected to canonical binary PDF export pipeline with digital watermark | Tested PDF download stream & content | **RESOLVED** |
| **DEF-STG3-002** | POS Cart Multi-Modifier Pricing Dry-run | ALL 4 PROFILES | Menu & Recipe Management | `simulator` Order Pricing | P2 | Cart calculation was evaluating only primary modifiers, ignoring nested sub-modifiers | `services/MenuService.js`, `pages/menuManagement.js` | Integrated recursive modifier solver with live GST tax calculation | Simulator multi-modifier test suite pass | **RESOLVED** |
| **DEF-STG3-003** | Emergency Lost Device Revocation | ALL 4 PROFILES | Settings & Devices | `recovery` Device Revocation | P1 | Local session clearance did not invalidate remote token family on other devices | `controllers/settingsController.js`, `services/authService.js`, `middleware/authenticate.js` | Enforced strict `Session` version bumping and token family revocation check on every authenticated request | Real-time session invalidation test pass | **RESOLVED** |
| **DEF-STG3-004** | CAPA Root Cause Tree | PRIMARY_MASTER, OWNER | Quality & Compliance | `capa` Root Cause Analysis | P2 | Displayed linear log without interactive 5-Why root cause branching diagram | `pages/quality.js` | Built interactive 5-Why root cause branching tree with photo attachment upload | UI visual and action check pass | **RESOLVED** |
| **DEF-STG3-005** | Wastage Log Barcode Scanner | CAFE_ADMIN, MASTER | Inventory & Stock | `waste` Wastage Entry | P2 | Barcode button was non-responsive placeholder | `pages/inventory.js` | Integrated WebRTC/HTML5 camera barcode & QR scanner component | Simulated barcode scan input test pass | **RESOLVED** |
| **DEF-STG3-006** | Statutory Director Loan DPT-3 Form Export | OWNER | Personal Ledger | `reconciliation` DPT-3 Export | P2 | Produced on-screen view without MCA DPT-3 statutory document export | `pages/personalLedger.js`, `controllers/financeAccountsController.js` | Added statutory MCA DPT-3 compliance export generator | XML/PDF download verification pass | **RESOLVED** |
| **DEF-STG3-007** | Multidimensional Custom Pivot Builder | MASTER, OWNER | Reports & Analytics | `explorer` Ad-hoc Queries | P2 | Predefined queries only without dynamic drag-and-drop pivot table | `pages/reportsAnalytics.js` | Integrated client-side OLAP pivot table with draggable dimensions & measures | Pivot matrix render test pass | **RESOLVED** |

---
**Defect Closure Certified:** Zero P0, zero P1, and zero unaddressed P2 functional defects remain.
