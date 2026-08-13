# 08 — Zamorin Information Architecture & Route Map

> [!IMPORTANT]
> **UX Architecture Standard**: Uncluttered primary sidebar with alphabetical sorting by display label per role. Deep-linkable module workspaces, dedicated Settings workspace, and restrained global top bar.

---

## 1. Global Information Architecture

```
                                GLOBAL TOP BAR
 [Logo & Cafe Context]  [Ctrl+K Global Search]  [Quick Create +]  [Action Inbox]  [Alerts & Notifications]  [User Profile]
========================================================================================================================
 PRIMARY SIDEBAR         │ MAIN WORKSPACE CONTENT SURFACE
 (Alphabetical Labels)   │
 ──────────────────────  │ ┌──────────────────────────────────────────────────────────────────────────────────┐
 • Command Centre        │ │ 1. Breadcrumb / Context Bar                                                      │
 • Administration        │ │ 2. Workspace Title & Contextual Primary Action Button                            │
 • Assets & Maintenance  │ │ 3. Sub-Navigation Tabs / Section Controls (e.g. Overview | Treasury | Close)    │
 • Attendance & Shifts   │ │ 4. Search & Filter Bar                                                           │
 • Bills & Receipts      │ │ 5. Primary Table / Structured Content Grid                                       │
 • Customers & Loyalty   │ │ 6. Pagination & Audit History Link                                               │
 • Department Orders     │ └──────────────────────────────────────────────────────────────────────────────────┘
 • Employees             │
 • Expenses              │
 • Finance & Accounts    │
 • Inventory             │
 • Menu Management       │
 • My Loans & Advances   │
 • My Payslips           │
 • My Profile            │
 • Payroll & Payslips    │
 • Personal Ledger       │
 • POS & Billing         │
 • Procurement           │
 • Quality & Compliance  │
 • Reports & Analytics   │
 • Settings & Preferences│
 • Trash Bin             │
 • Vendors               │
```

---

## 2. Dedicated Full Settings Workspace Routes (`#settings`)

Clicking **Settings & Preferences** opens a full-screen workspace page (`settingsShared.js` for management roles, `staffSettings.js` for STAFF role). **Never a popup modal.**

| Category | Route Target | Target Settings & Preferences | Role Visibility |
| :--- | :--- | :--- | :--- |
| **GENERAL** | `settings/general` | Business IST Date preference, fiscal year start, default currency format | `MASTER`, `OWNER`, `CAFE_ADMIN` |
| **ORGANISATION** | `settings/organisation` | Legal entity name, GSTIN, registered address, official branding | `MASTER`, `OWNER` |
| **CAFES** | `settings/cafes` | Operating hours, cafe contact numbers, receipt header/footer text | `MASTER`, `OWNER`, `CAFE_ADMIN` |
| **APPEARANCE** | `settings/appearance` | Glassmorphism theme density, font size preference, reduced motion | `ALL` |
| **FINANCE** | `settings/finance` | Petty cash limits, approval thresholds, rounding rules (nearest rupee) | `MASTER`, `OWNER` |
| **POS & BILLING** | `settings/pos` | Default payment methods (Cash/UPI/Card), auto-print receipt preference | `MASTER`, `CAFE_ADMIN` |
| **INVENTORY** | `settings/inventory` | Default reorder alert threshold percentage, stocktake variance tolerance | `MASTER`, `CAFE_ADMIN` |
| **PROCUREMENT** | `settings/procurement` | Minimum quotes required for RFQ award, 3-way match price tolerance % | `MASTER`, `OWNER` |
| **HR & PAYROLL** | `settings/hr` | Standard working hours/shift duration, overtime rate multiplier, loan caps | `MASTER`, `OWNER` |
| **NOTIFICATIONS** | `settings/notifications` | Email/SMS/Push alert preferences, daily summary digest frequency | `ALL` |
| **SECURITY** | `settings/security` | Passkey enrollment, active sessions list, MFA management, session revocation | `ALL` |
| **PRIVACY & DATA** | `settings/privacy` | Personal consent history, sensitive data reveal preferences | `ALL` |
| **ADVANCED** | `settings/advanced` | System diagnostics, feature flags, sequence counter verification | `MASTER` only |

---

## 3. Sub-Module Workspace Navigation Maps

### Finance Workspace (`#finance`)
- `Overview`: Financial summary cards, cash position, revenue vs expense charts.
- `Treasury`: Bank balances, 7/30/60/90-day cash flow projections, pending obligations.
- `Period Close`: Daily/Monthly close checklist, unposted transaction verification, period locking.
- `Reconciliation`: POS <-> Cash, PO <-> Goods Receipt, Payroll <-> Advance matching controls.

### Procurement Workspace (`#procurement`)
- `Orders`: Active Purchase Orders list, receiving status, PO creation.
- `RFQs`: Quotation requests, vendor selection, multi-quote comparisons, award workflow.
- `Matching`: Three-way match exception queue, price/quantity mismatch approvals.
- `Recommendations`: Deterministic reorder quantity recommendations based on lead time and burn rate.

### Assets Workspace (`#assets`)
- `Registry`: Complete fixed assets inventory, location, tag numbers.
- `Accounting`: Acquisition cost, depreciation schedules, accumulated depreciation, book value.
- `CAPEX`: Capital requests, ROI/payback analysis, approval queue.
- `Insurance`: Policy numbers, coverage details, renewal alert schedules.

### Administration Workspace (`#admin`)
- `Users`: User directory, role assignment, account status management.
- `Internal Controls`: Segregation-of-duties conflict detection, break-glass MFA logs.
- `Contracts`: Vendor contracts, cafe leases, AMC agreements, expiry warnings.
- `Compliance`: Statutory deadlines, food safety licenses, fire certifications.
- `Workflows`: Governed workflow approval threshold configurations.
- `Data Quality`: Sequential ID checks, orphaned record cleanup tools.
