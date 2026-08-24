# ZAMORIN CAFE ERP
## STAGE 3 — DEFERRED FUNCTIONAL DEFECT REGISTER
### Authority: Stage 3 Program Closure & Handover to Stage 4

| Defect ID | Profile(s) | Module | Page / Function | Action / Capability | Current Behavior | Expected Behavior (Stage 4 Target) | Priority | Root Cause / Technical Context |
|---|---|---|---|---|---|---|---|---|
| DEF-STG3-001 | OWNER, PRIMARY_MASTER | Finance & Accounts | `pages/financeAccounts.js` -> `tax-review` | GSTR-3B PDF Export | Returns pre-computed JSON summary; client download does not generate binary PDF | Generates certified GSTR-3B statutory PDF with digital watermark and tax period seal | P2 | Backend headless PDF generation endpoint for GSTR-3B is slated for Stage 4 pipeline |
| DEF-STG3-002 | OWNER, PRIMARY_MASTER | Menu & Recipe Management | `pages/menuManagement.js` -> `simulator` | POS Cart Multi-Modifier Pricing Dry-run | Evaluates single variant modifiers; does not compound nested sub-modifier formulas | Dynamic compounding of nested modifier tiers with live tax breakdown | P2 | Cart calculation engine requires full client-side matrix solver integration in Stage 4 |
| DEF-STG3-003 | ALL 4 PROFILES | Settings & Account | `pages/settingsShared.js` -> `recovery` | Emergency Lost Device Revocation | Simulates local session clearance; does not broadcast immediate WebSocket kill signal to other active devices | Broadcasts real-time invalidation to all remote refresh tokens via Redis pub/sub | P1 | Requires real-time WebSocket connection bridge scheduled for Stage 4 |
| DEF-STG3-004 | OWNER, PRIMARY_MASTER | Quality & Compliance | `pages/quality.js` -> `capa` | CAPA Corrective Action Root Cause Tree | Displays linear CAPA log without interactive 5-Why branching diagram | Interactive 5-Why root cause branching tree with photo attachment upload | P2 | Diagram rendering component scheduled for Stage 4 visual analytics pass |
| DEF-STG3-005 | CAFE_ADMIN, MASTER | Inventory & Stock | `pages/inventory.js` -> `waste` | Wastage Log Batch Barcode Scanner | Manual entry of SKU IDs; camera barcode scanner button is placeholder | WebRTC camera barcode / QR scanning integration for fast wastage logging | P2 | Hardware API permission & scanner wrapper scheduled for Stage 4 |
| DEF-STG3-006 | OWNER | Personal Ledger | `pages/personalLedger.js` -> `reconciliation` | Statutory Director Loan DPT-3 Form Export | Generates on-screen compliance audit; does not produce MCA DPT-3 XML packet | Exports MCA-compliant DPT-3 XML / PDF data packet for corporate filing | P2 | MCA statutory schema exporter scheduled for Stage 4 corporate reporting |
| DEF-STG3-007 | MASTER, OWNER | Reports & Analytics | `pages/reportsAnalytics.js` -> `explorer` | Multidimensional Custom Pivot Builder | Displays predefined query templates; ad-hoc drag-and-drop pivot table is preview | Full client-side OLAP pivot table with draggable dimensions, measures, and filters | P2 | Drag-and-drop pivot matrix engine scheduled for Stage 4 business intelligence sprint |

---
**Register Certified:** Stage 3 UX & Information Architecture baseline complete. No blocking UI regressions. Functional backlog queued for Stage 4.
