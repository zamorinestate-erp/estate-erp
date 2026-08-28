# Zamorin Café ERP — Login Integration Programme
# Stage 2 Route Arithmetic & Ownership Reconciliation

## 1. Route Categorization & Counts

| Category | Description | Count |
|---|---|---|
| **A. Existing General Application Routes** | Canonical ERP routes across 5 personas (Dashboard, POS, Attendance, Inventory, Procurement, Assets, Quality, HR/Employees, Payroll, Bills, Expenses, Finance, Customers, Menu, Vendors, Revenue Share, Reports, Admin, Dept Orders, Devices, Settings, Staff Self-Service) | **149** |
| **B. New Dedicated Terminal-Auth Routes** | Dedicated pre-session terminal authentication and enrollment screens (`#cafe-master-signin`, `#cafe-device-enroll`, `#cafe-terminal-welcome`) | **3** |
| **C. Total Runtime Routes in Application** | Total distinct route hashes registered in `router.js` and navigable in client runtime | **152** |

---

## 2. Test Suite Ownership Matrix

| Route Category | Total Routes | Owning Test Suite | Suite Result | Untested Routes |
|---|---|---|---|---|
| **General Application Routes (149)** | 149 | `scripts/test_all_subroutes_no_errors.mjs` & `scripts/audit_all_five_personas.mjs` | **149 / 149 PASS (100%)** | 0 |
| **Terminal-Auth Routes (3)** | 3 | `scripts/audit_login_stage2_frontend.mjs` | **3 / 3 PASS (100%)** | 0 |
| **Combined Application Routes** | **152** | **Full Audit Pipeline** | **152 / 152 PASS (100%)** | **0** |

---

## 3. Explicit Ownership Verification
Every single one of the 152 routes has exactly one designated test owner, eliminating both gaps and double-counting:
- General subroutes are validated against zero console errors, DOM loading completeness, and theme contrast.
- Terminal-auth routes are validated against inactivity timer suspension, lack of pre-auth data leakage, form validation, and design system binding.
