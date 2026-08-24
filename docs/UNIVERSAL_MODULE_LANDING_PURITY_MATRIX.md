# Universal Module Landing Purity Matrix

This document audits and certifies that all module landing overview pages contain **only** high-level executive summaries, KPIs, alerts, and navigation button grids—with **zero child tables, forms, heatmaps, or charts underneath**.

---

| Module | Landing Route | Overview Content Items | Forbidden Child Content Removed | Child Location for Removed Content | Purity Status |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Inventory** | `#inventory` | Header, Scope Bar, 6 Executive KPIs, Needs Attention Strip, 14 Workspace Navigation Tiles | Multi-Café Stock Availability Heatmap, Add Global Item Form | Moved to `#inventory/stock-by-cafe` and `#inventory/global-items` | **100% PURE** |
| **Bills & Receipts** | `#bills` | Header, Scope Bar, Billing Summary KPIs, Gross-to-Net Revenue Bridge, 8 Workspace Tiles | Full Invoices Register, Refund Approval Forms, GST Detailed Line Tables | Moved to `#bills/bills`, `#bills/receipts`, `#bills/tax`, etc. | **100% PURE** |
| **Expenses** | `#expenses` | Header, Period Spend KPIs, Financial Integrity Ribbon, 6 Workspace Tiles | Detailed Voucher Table, Evidence Viewer, Policy Matrix Simulator | Moved to `#expenses/vouchers`, `#expenses/evidence`, etc. | **100% PURE** |
| **Procurement** | `#procurement` | Header, Scope Context, 4 Headline KPIs, Attention Strip, 11 Workspace Tiles | Full PO List, Indent Request Forms, GRN Receiving Table, 3-Way Match Sheets | Moved to `#procurement/orders`, `#procurement/receiving`, etc. | **100% PURE** |
| **Quality & FSMS** | `#quality` | Header, FSMS Scope, 4 Key KPIs, Critical Attention Banner, 10 Workspace Tiles | Daily Check Execution Forms, Temperature Log Table, NCR Audit Records | Moved to `#quality/my-checks`, `#quality/temperatures`, etc. | **100% PURE** |
| **Workforce / HRIS** | `#employees` | Header, Headcount & Onboarding KPIs, Needs Attention Banner, 5 Workspace Tiles | Complete Employee Directory Table, Onboarding Checklist Forms, Org Hierarchy Tree | Moved to `#employees/directory`, `#employees/onboarding`, etc. | **100% PURE** |
| **Payroll** | `#payroll` | Header, Current Period CTC Summary KPIs, Readiness Banner, 6 Workspace Tiles | Salary Run Execution Table, Structure Editor, Individual Payslip Logs | Moved to `#payroll/runs`, `#payroll/structures`, etc. | **100% PURE** |
| **Finance & GL** | `#finance` | Header, Balance & Payables KPIs, Tax Compliance Ribbon, 7 Workspace Tiles | GL Journal Entry Grid, Chart of Accounts Tree, Trial Balance Table | Moved to `#finance/gl-journals`, `#finance/chart-of-accounts`, etc. | **100% PURE** |
| **Menu Engineering** | `#menu` | Header, Active Items & Margin KPIs, 86'd Alert Strip, 12 Workspace Tiles | Recipe Portion Editor, Modifier Configuration Grid, Dynamic Pricing Table | Moved to `#menu/items`, `#menu/recipes`, `#menu/pricing`, etc. | **100% PURE** |
| **Suppliers / Vendors** | `#vendors` | Header, Active Suppliers & OTIF KPIs, Compliance Banner, 8 Workspace Tiles | Full Vendor Roster Table, Banking Verification Form, 3-Way Match Drawer | Moved to `#vendors/directory`, `#vendors/bank`, etc. | **100% PURE** |
| **Assets & PM** | `#assets` | Header, In-Service & Maintenance KPIs, Urgent Work Order Strip, 5 Workspace Tiles | Full Asset Directory Table, PM Schedule Calendar, Breakdown Logs | Moved to `#assets/assets`, `#assets/pm-schedules`, etc. | **100% PURE** |
| **Attendance** | `#attendance` | Header, Present/Absent/Late KPIs, Shift Coverage Status, 4 Workspace Tiles | Raw Punch Log Table, Roster Grid Editor, Exception Approval Forms | Moved to `#attendance/punches`, `#attendance/roster`, etc. | **100% PURE** |
| **Customers & CRM** | `#customers` | Header, Member Count & Points Issued KPIs, Feedback Alert Strip, 5 Workspace Tiles | Full Customer Directory Table, Tier Rule Editor, Campaign Dispatcher | Moved to `#customers/directory`, `#customers/tiers`, etc. | **100% PURE** |
| **Administration** | `#admin` | Header, Outlets & Active User KPIs, Policy Status Banner, 6 Workspace Tiles | Multi-Outlet Config Forms, User Account Table, Security Log Register | Moved to `#admin/cafes`, `#admin/users`, etc. | **100% PURE** |
| **Fleet Devices** | `#cafe-ops-devices` | Header, Registered Terminal KPIs, Custody Handover Status, 3 Workspace Tiles | Complete Hardware Terminal List, Handover Sign-off Forms, PIN Reset Tool | Moved to `#cafe-ops-devices/hardware`, etc. | **100% PURE** |
| **Reports & Analytics** | `#reports` | Header, Report Category Directory, Scheduled Exports Banner, 8 Workspace Tiles | Full Report Data Renderers, Interactive Query Tables | Moved to `#reports/sales`, `#reports/finance`, etc. | **100% PURE** |
| **Settings** | `#settings` | Settings & Preferences Header, Search Settings Input, 12 Category Tiles | Personal Profile Forms, MFA QR Generator, Theme Switcher Panels | Moved to `#settings/profile`, `#settings/security`, etc. | **100% PURE** |
| **Personal Ledger** | `#ledger` | Single Coherent Workspace (Executive drawings, partner distributions, tax withholdings) | N/A (Classified as Single Coherent Workspace) | Entire Workspace is dedicated | **100% PURE** |
| **Tasks & Approvals** | `#approvals` | Single Coherent Workspace (Multi-domain unified governance queue) | N/A (Classified as Single Coherent Workspace) | Entire Workspace is dedicated | **100% PURE** |
