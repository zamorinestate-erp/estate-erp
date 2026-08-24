# Master Corrective Reality Audit

**Audit Date:** 2026-08-24
**System:** Zamorin Café ERP v2.2.2
**Scope:** Universal Control-Centre Button Architecture, Landing Purity, Dedicated Child Workspaces, Receipt/File Workflows, and Reload/Session Restoration.

---

## 1. Reality Audit Findings by Module

| Module | Current Landing Route | Current Overview State | Current Buttons | Child Routes Supported | Child Content on Overview? | Legacy Tabs? | Action Leakage? | Receipt/File Upload | Reload State | Status |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Inventory** | `#inventory` | KPIs + Attention + Tile Grid + Heatmap (Needs Removal) | 14 Tiles | 14 Child Routes | **FAIL (Heatmap on landing)** | Remnants | **FAIL (+Add Global Item on Stock Levels)** | Supported in Movements | Partial (Router hydration race) | **CORRECTING** |
| **Bills & Receipts** | `#bills` | KPIs + Bridge + Tiles + Subpanel switch | 8 Tiles | 8 Child Routes (`bills`, `receipts`, `upload`, `adjustments`, `payments`, `tax`, `reconciliation`, `reports`) | Clean Hub | Subpanel router | Clean | **PASS (Universal Ingestion Form & Dropzone)** | Needs Hydration Polish | **CORRECTING** |
| **Expenses** | `#expenses` | KPIs + Spend breakdown + Tiles | 6 Tiles | 6 Child Routes (`vouchers`, `approvals`, `evidence`, `cards`, `policies`, `integrity`) | Clean Hub | None | Clean | **PASS (Evidence Vault Dropzone)** | Needs Hydration Polish | **CORRECTING** |
| **Procurement** | `#procurement` | KPIs + Attention + Tiles | 10 Tiles | 11 Child Routes (`requisitions`, `catalogue`, `rfqs`, `orders`, `agreements`, `deliveries`, `receiving`, `matching`, `suppliers`, `exceptions`, `reports`) | Clean Hub | None | Clean | **PASS (Challan & Invoice uploader)** | Needs Hydration Polish | **CORRECTING** |
| **Quality & FSMS** | `#quality` | KPIs + Attention + Tiles | 10 Tiles | 10 Child Routes (`my-checks`, `prp-fsms`, `temperatures`, `holds`, `ncrs`, `capas`, `traceability`, `audits`, `compliance`, `history`) | Clean Hub | None | Clean | **PASS (Lab cert & License uploader)** | Needs Hydration Polish | **CORRECTING** |
| **Workforce / HRIS** | `#employees` | KPIs + Attention + Tiles | 5 Tiles | 5 Child Routes (`directory`, `onboarding`, `documents`, `compliance`, `org-chart`) | Clean Hub | None | Clean | **PASS (Document vault uploader)** | Needs Hydration Polish | **CORRECTING** |
| **Payroll** | `#payroll` | Period CTC KPIs + Tiles | 6 Tiles | 6 Child Routes (`runs`, `structures`, `payslips`, `statutory`, `advances`, `disbursements`) | Clean Hub | None | Clean | Supported | Needs Hydration Polish | **CORRECTING** |
| **Finance & GL** | `#finance` | Financial KPIs + Tiles | 7 Tiles | 7 Child Routes (`sales-audit`, `gl-journals`, `chart-of-accounts`, `trial-balance`, `profit-loss`, `balance-sheet`, `gst-tax`) | Clean Hub | None | Clean | Financial evidence supported | Needs Hydration Polish | **CORRECTING** |
| **Menu Engineering** | `#menu` | Items & Margin KPIs + Tiles | 12 Tiles | 12 Child Routes (`items`, `categories`, `recipes`, `modifiers`, `combos`, `packaging`, `pricing`, `availability`, `publishing`, `simulator`, `integrity`, `analytics`) | Clean Hub | None | Clean | Recipe specs supported | Needs Hydration Polish | **CORRECTING** |
| **Suppliers / Vendors** | `#vendors` | Active KPIs + Tiles | 8 Tiles | 8 Child Routes (`directory`, `onboarding`, `orders`, `matching`, `bank`, `performance`, `continuity`, `documents`) | Clean Hub | None | Clean | **PASS (Contract & Rate card uploader)** | Needs Hydration Polish | **CORRECTING** |
| **Assets & PM** | `#assets` | Equipment KPIs + Tiles | 5 Tiles | 5 Child Routes (`assets`, `pm-schedules`, `work-orders`, `depreciation`, `service-logs`) | Clean Hub | None | Clean | Spares invoices supported | Needs Hydration Polish | **CORRECTING** |
| **Attendance** | `#attendance` | Shift KPIs + Tiles | 4 Tiles | 4 Child Routes (`punches`, `roster`, `timesheets`, `exceptions`) | Clean Hub | None | Clean | Supported | Needs Hydration Polish | **CORRECTING** |
| **Customers & CRM** | `#customers` | Loyalty KPIs + Tiles | 5 Tiles | 5 Child Routes (`directory`, `tiers`, `points`, `campaigns`, `feedback`) | Clean Hub | None | Clean | Supported | Needs Hydration Polish | **CORRECTING** |
| **Administration** | `#admin` | System KPIs + Tiles | 6 Tiles | 6 Child Routes (`cafes`, `users`, `policies`, `config`, `audit`, `recovery`) | Clean Hub | None | Clean | Supported | Needs Hydration Polish | **CORRECTING** |
| **Fleet Devices** | `#cafe-ops-devices` | Hardware KPIs + Tiles | 3 Tiles | 3 Child Routes (`hardware`, `handovers`, `security`) | Clean Hub | None | Clean | Supported | Needs Hydration Polish | **CORRECTING** |
| **Reports** | `#reports` | Category Directory | 8 Tiles | 8 Child Routes (`library`, `sales`, `finance`, `inventory`, `procurement`, `quality`, `assets`, `zurf`) | Clean Hub | None | Clean | CSV/PDF supported | Needs Hydration Polish | **CORRECTING** |
| **Settings** | `#settings` | Settings & Preferences Header + Search + Tiles | 12 Tiles | 12 Child Routes (`profile`, `employment`, `access`, `security`, `devices`, `recovery`, `notifications`, `language`, `appearance`, `accessibility`, `navigation`, `privacy`) | **PASS (Personal scope only)** | None | Clean | Document exports supported | **PASS** | **PASS** |
| **Personal Ledger** | `#ledger` | Single Coherent Workspace | N/A | Single Workspace | Single Coherent Workspace | None | Clean | Supported | Needs Hydration Polish | **PASS** |
| **Tasks & Approvals** | `#approvals` | Single Coherent Workspace | N/A | Single Workspace | Single Coherent Workspace | None | Clean | Supported | Needs Hydration Polish | **PASS** |
