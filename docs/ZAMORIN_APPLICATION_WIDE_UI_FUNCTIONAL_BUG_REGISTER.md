# ZAMORIN CAFE ERP
## APPLICATION-WIDE DEFECT & REMEDIATION REGISTER

---

### Defect Register Overview

This authoritative register documents all discovered functional, routing, navigation, RBAC, theme consistency, and responsive defects identified and resolved during the Application-Wide Defect Audit Programme.

---

### Defect Inventory

#### BUG-001: POS Terminal Rendering Failure (`[object Promise]`)
- **Profile**: PRIMARY MASTER / NORMAL MASTER / CAFE_ADMIN
- **Module**: Operations / POS & Billing
- **Screen**: `SCR-019` POS & Billing Terminal (`route: 'pos'`)
- **Control**: Terminal workspace container (`#page-content`)
- **Category**: `BROKEN_FORM` / `WRONG_ROUTE`
- **Expected Behavior**: Point of Sale terminal renders interactive menu catalogue, category tabs, customer covers, active cart, and tender calculations.
- **Actual Behavior**: The entire terminal rendered as the text string `"[object Promise]"`.
- **Root Cause**: `renderPOS()` in `posTill.js` was declared with `async`, causing it to return a `Promise` instead of an HTML template string to `router.js`.
- **Files Changed**: `frontend/src/js/pages/posTill.js`
- **Fix**: Changed `renderPOS` from `export async function renderPOS()` to synchronous `export function renderPOS()`.
- **Verification**: Verified in browser that POS renders complete menu catalog, category filters, and active cart.
- **Status**: **`FIXED / VERIFIED PASS`**

---

#### BUG-002: Unstyled & Rough Message Popup / Toast Notification
- **Profile**: ALL PROFILES (Primary Master, Normal Master, Owner, Cafe Admin, Staff)
- **Module**: System / Notification Feedback
- **Screen**: Global Shell (`#toast-root`)
- **Control**: Floating Toast Popup (Bottom Right)
- **Category**: `VISUAL_INCONSISTENCY` / `THEME_INCONSISTENCY`
- **Expected Behavior**: Elegant, polished toast notification with status icon (mint/coral/amber/cobalt), header title, timestamp, close button, smooth slide animation, and glassmorphism styling matching Zamorin UI design.
- **Actual Behavior**: Unfinished, unstyled raw text block floating at the bottom right without borders, proper padding, or status colors.
- **Root Cause**: `components.js` assigned `toast.className = 'toast-pill ${type}'`, but `.toast-pill` was never defined in `components.css` or `zamorin.css`.
- **Files Changed**: `frontend/src/js/components.js`, `frontend/src/styles/components.css`
- **Fix**: Upgraded `showToast()` to create `.toast-card` with SVG status icons, header rows, close handlers, and added comprehensive responsive glassmorphism CSS in `components.css`.
- **Verification**: Verified in browser that action feedback displays refined, theme-consistent toast cards.
- **Status**: **`FIXED / VERIFIED PASS`**

---

#### BUG-003: Normal Master Direct Block on Finance & Accounts Route
- **Profile**: NORMAL MASTER
- **Module**: Finance / Finance & Accounts
- **Screen**: `SCR-010` Finance & Accounts GL (`route: 'finance'`)
- **Control**: Sidebar item "Finance & Accounts"
- **Category**: `WRONG_ROUTE` / `AUTHORIZATION`
- **Expected Behavior**: Normal Master can access operational financial overviews (Sales Audit, AP, AR, Budgets) while sensitive Primary Master controls remain guarded.
- **Actual Behavior**: Clicking "Finance & Accounts" triggered `isRouteAllowed` rejection and rendered the `__blocked__` access restricted screen.
- **Root Cause**: `PRIMARY_MASTER_ONLY_ROUTES` in `navigation.js` improperly included `'finance'`, contradicting `NORMAL_MASTER_ITEMS`.
- **Files Changed**: `frontend/src/js/navigation.js`
- **Fix**: Removed `'finance'` from `PRIMARY_MASTER_ONLY_ROUTES`, keeping only `ledger`, `payroll`, `staff-loans-advances`, and `revenue-share`.
- **Verification**: Verified Normal Master opens Finance & Accounts with GL posting restricted.
- **Status**: **`FIXED / VERIFIED PASS`**

---

#### BUG-004: Misleading "OPERATIONAL MASTER" Badge for Owner Bills Screen
- **Profile**: OWNER
- **Module**: Finance / Bills & Receipts
- **Screen**: `SCR-005` Sales Bills & Tax Receipts (`route: 'bills'`)
- **Control**: Top header badge and action bar
- **Category**: `VISUAL_INCONSISTENCY` / `CROSS_ROLE_LEAK`
- **Expected Behavior**: Screen displays `OWNER PORTAL` badge and hides operational EOD Billing Close action.
- **Actual Behavior**: Screen displayed `OPERATIONAL MASTER` badge and exposed the operational `EOD Billing Close` button.
- **Root Cause**: `ownerBills.js` had a hardcoded ternary `isPrimary ? "PRIMARY MASTER" : "OPERATIONAL MASTER"`.
- **Files Changed**: `frontend/src/js/pages/ownerBills.js`
- **Fix**: Implemented role-aware badge resolver (`PRIMARY MASTER` / `OWNER PORTAL` / `OPERATIONAL MASTER` / `CAFE ADMIN`) and guarded EOD Close button to Master only.
- **Verification**: Verified in browser that Owner sees `OWNER PORTAL` badge and read-focused controls.
- **Status**: **`FIXED / VERIFIED PASS`**

---

#### BUG-005: Finance & Accounts Header Role Context & Journal Button
- **Profile**: OWNER / NORMAL MASTER
- **Module**: Finance / Finance & Accounts
- **Screen**: `SCR-010` Finance & Accounts (`route: 'finance'`)
- **Control**: Header badge and `New Journal Entry` button
- **Category**: `VISUAL_INCONSISTENCY` / `AUTHORIZATION`
- **Expected Behavior**: Owner sees `OWNER GOVERNANCE` badge and cannot see the Primary Master journal entry button.
- **Actual Behavior**: Non-primary users saw generic badges and button state was not cleanly scoped.
- **Root Cause**: `financeAccounts.js` checked `isMaster` broadly instead of `isPrimaryMaster` for journal mutations.
- **Files Changed**: `frontend/src/js/pages/financeAccounts.js`
- **Fix**: Scoped `New Journal Entry` button strictly to `isPrimaryMaster` and added role-appropriate badge labels.
- **Verification**: Verified in browser across Primary Master, Normal Master, and Owner profiles.
- **Status**: **`FIXED / VERIFIED PASS`**

---

#### BUG-006: Personal Ledger Authoritative Access Rule Enforcement
- **Profile**: NORMAL MASTER / CAFE_ADMIN / STAFF
- **Module**: Finance / Personal Ledger & Owner Account
- **Screen**: `SCR-018` Personal Ledger (`route: 'ledger'`)
- **Control**: Sidebar item, router route guard, and backend API routes
- **Category**: `PERSONAL_LEDGER` / `AUTHORIZATION`
- **Expected Behavior**: Personal Ledger accessible ONLY by Primary Master (`role === 'MASTER' && isPrimaryMaster === true`) and Owner (`role === 'OWNER'`). Strictly denied to Normal Master, Cafe Admin, and Staff.
- **Actual Behavior**: Enforced across frontend navigation, router guard, and backend middleware/controllers.
- **Root Cause**: Policy alignment to guarantee zero cross-role leakage.
- **Files Changed**: `frontend/src/js/navigation.js`, `frontend/src/js/router.js`, `backend/src/middleware/authorize.js`, `backend/src/controllers/personalLedgerController.js`, `backend/src/routes/personalLedgerRoutes.js`
- **Fix**: Canonical predicates `canAccessPersonalLedger = (role === 'MASTER' && isPrimaryMaster === true) || role === 'OWNER'` applied at all tiers.
- **Verification**: Verified that Normal Master, Cafe Admin, and Staff receive 403 Forbidden / Route Denied.
- **Status**: **`FIXED / VERIFIED PASS`**

---

#### BUG-007: Missing Named Exports in Router Imported Modules
- **Profile**: ALL PROFILES
- **Module**: Core Routing / Module Contracts
- **Screen**: Global Router (`router.js`)
- **Control**: Router dynamic import registry
- **Category**: `WRONG_ROUTE` / `API_FAILURE`
- **Expected Behavior**: Every named export imported by `router.js` (`render*`, `wire*`, `hydrate*`) is defined and exported.
- **Actual Behavior**: `renderPayrollManagement`, `wirePayrollManagement`, `wireExpenses` were missing in respective module exports.
- **Root Cause**: Incomplete module refactoring in historical commits.
- **Files Changed**: `frontend/src/js/pages/payrollManagement.js`, `frontend/src/js/pages/expenses.js`
- **Fix**: Added canonical named exports in `payrollManagement.js` and `expenses.js`.
- **Verification**: Verified with `verifyRouterImports.mjs` (100% pass).
- **Status**: **`FIXED / VERIFIED PASS`**
