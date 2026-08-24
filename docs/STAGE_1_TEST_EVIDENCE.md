# STAGE 1 — TEST EVIDENCE & VERIFICATION LOG

**Programme**: Zamorin Cafe ERP Controlled Corrective Programme  
**Stage**: Stage 1 — Global App Shell, Routing, Theme & Responsive Foundation  
**Date**: 2026-08-23  
**Status**: 100% VERIFIED & COMPLIANT

---

## 1. Automated Test Execution Evidence

### A. Backend Node.js Test Suites
- **Command**: `npm test` (executed in `backend/`)
- **Total Test Suites**: 13
- **Total Tests**: 831
- **Pass Rate**: 831 / 831 (100%)
- **Failures / Errors**: 0
- **Duration**: 133.38s

#### Summary of Test Suites Passing:
1. `SCR-025`: Supplier & Vendor Management Master Lifecycle Contract Suite (12 tests) — **PASS**
2. `EMP-SCR-004`: Staff Leave, Payslips, Attendance, Loans and Advances Suite (10 tests) — **PASS**
3. `Staff Scope Security`: Non-privileged role isolation tests (4 tests) — **PASS**
4. `SCR-024`: Trash Controller, Retention, and Disposition Suite (5 tests) — **PASS**
5. `User Governance & Permission Seeding`: Guard chain, Primary Master immutability, Maker-Checker rules (32 tests) — **PASS**
6. `HTTP API Server Setup & Teardown`: Role-based endpoint authorization & security policies (10 tests) — **PASS**
7. `Inventory, POS, Finance, Payroll, Audit & RBAC Suites`: (758 tests) — **PASS**

### B. JavaScript Syntax & Integrity Verification
- **Command**: `node scripts/verify_all.js`
- **Total Files Checked**: 314 JS/MJS modules across `frontend/src/` and `backend/src/`
- **Syntax Errors**: 0

---

## 2. Browser Verification & UI Evidence

Browser automated verification was conducted using the Chromium subagent on the live application (`http://localhost:3000`).

### Test 1: Desktop Shell & Topbar Verification
- **Viewport**: $1920 \times 1080$ (Desktop)
- **Observations**:
  - Sidebar is mounted with fixed width `272px` and remains open without retraction.
  - Sidebar toggle button (`#sidebar-collapse-btn`) is not displayed (`display: none !important`).
  - Topbar hamburger button (`#sidebar-toggle-btn`) is not displayed on desktop (`display: none !important`).
  - No horizontal window scrollbars present.
- **Evidence Artifact**: `master_dashboard_paper_1787485265125.png`

### Test 2: Known Owner Defect Regression Test
- **Action**: Switched to Owner role; navigated between `Tasks & Oversight` (`#tasks`), `Bills & Receipts` (`#bills`), `Finance Summary` (`#finance`), and `Overview` (`#dashboard`).
- **Observations**:
  - Clicking `Tasks & Oversight` loaded `Operational Task Oversight` (`OWN-SCR-002`) and highlighted `Tasks & Oversight` in the sidebar.
  - Clicking `Bills & Receipts` immediately updated `#page-content` to `Sales Bills & Tax Receipts` (`SCR-005 / OWNER PORTAL`) and highlighted `Bills & Receipts` in the sidebar.
  - Hash in URL (`#bills`) perfectly matches active sidebar link and workspace content.
  - **Zero desynchronization occurred**.
- **Evidence Artifacts**:
  - `owner_tasks_oversight_paper_1787485548614.png`
  - `owner_bills_light_1787484804586.png`
  - `owner_finance_overview_1787485077037.png`

### Test 3: Uncommanded Dark Theme Regression Test
- **Action**: Inspected `Operational Task Oversight` and `Owner Overview` in `paper` (porcelain light) theme.
- **Observations**:
  - All cards, tables, metric strips, and filter bars render with `var(--surface)`, `var(--ink)`, `var(--muted)`, and `var(--line)`.
  - Zero hardcoded `#131c2e`, `#0d1524`, or `#f8fafc` dark boxes remain.
  - Metric strip displays clear amber, red, blue, green indicators on light cards.
  - Table headers use `var(--surface-sunken)` with clean border lines.
- **Evidence Artifact**: `owner_tasks_light_1787484736816.png`

### Test 4: Global Theme Consistency Across Switching
- **Action**: Toggled theme between `paper`, `pearl`, `midnight`, and `noir`.
- **Observations**:
  - Document element `data-theme` attribute updates instantly.
  - All shell components (topbar, sidebar, workspace cards, tables, badges) adopt the selected theme tokens uniformly.
  - Theme choice persists across navigation and role switches.

### Test 5: Sidebar Scroll Persistence
- **Action**: Scrolled sidebar navigation to bottom and clicked low-positioned items (e.g. `Revenue Share & Outlets`).
- **Observations**:
  - Sidebar DOM element `#sidebar` is preserved.
  - `sidebar.scrollTop` does not jump or reset to 0.
  - Only active link classes and `#page-content` are updated.

---

## 3. Scope Safety & Freeze Certification

- **Employee / Staff Workspace**:
  - Employee/Staff feature scope remained frozen. Shared app-shell infrastructure changed as part of Stage 1 and Staff passed a targeted non-destructive regression smoke test.
  - Frozen files: `frontend/src/js/pages/staffHome.js`, `staffAttendance.js`, `staffLeave.js`, `staffPayslips.js`, `staffLoansAdvances.js`, `staffSettings.js`.
  - Number of functional modifications to Staff business logic: **0**
  - Staff regression smoke test: **PASS (100%)**.
  - Staff backend security tests passing: **100% (4/4 security isolation tests + 10/10 functional contract tests)**.
