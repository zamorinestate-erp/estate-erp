# ZAMORIN CAFE ERP — STAGE 1 BASELINE AUDIT REPORT
## Global App Shell, Routing, Theme & Responsive Foundation
**Date:** 2026-08-23  
**Auditor:** Antigravity Engineering (Stage 1 Corrective Programme)  
**Target Workspaces:** Primary Master, Normal Master, Owner, Cafe Operations  
**Scope Limitation:** Employee / Staff is strictly FROZEN and OUT OF SCOPE.

---

## 0. EXECUTIVE SUMMARY & ENVIRONMENT BASELINE

### 0.1 Repository & Branch State
- **Git Branch:** `main`
- **HEAD Commit:** `4481e5c57625d3021b98a0f1041ed9808f40da67`
- **Repository Architecture:** Monorepo with `/frontend` (Vanilla ES Modules / HTML5 / CSS Design Tokens) and `/backend` (Node.js Express + Mongoose + MongoDB Memory Server)
- **Zero-Transpiler Architecture:** Frontend runs directly on native modern browser standards with native ES module imports (`type="module"`), native CSS custom properties, and service worker PWA shell caching.

### 0.2 Technology Stack
- **Frontend Framework:** Vanilla Modern JavaScript (ES2022+ Modules)
- **Routing Engine:** Custom central router (`frontend/src/js/router.js`) with declarative role-based navigation dictionary (`frontend/src/js/navigation.js`)
- **State Store:** Lightweight reactive event-driven state container (`frontend/src/js/state.js`)
- **UI Design System:** Custom Design System v2 (*Ledger & Roastery* / *Porcelain & Bronze*) using standard CSS design tokens (`tokens.css`, `layout.css`, `components.css`, `zamorin.css`)
- **Backend API:** Node.js v24.13.0, Express 5.2.1, MongoDB Mongoose 9.9.1, bcrypt, jsonwebtoken
- **Testing Engine:** Native Node Test Runner (`node --test`), 831 tests passing across 13 test suites.

---

## 1. APP SHELL ARCHITECTURE AUDIT

### 1.1 Root Shell Component & Mounting
- **Mount Point:** `index.html` mounts `#app` and `#toast-root`.
- **Shell Generator:** `renderShell()` in `frontend/src/js/router.js`.
- **Layout Structure:**
  ```text
  #app
   └── .app-shell (CSS Grid: var(--sidebar) minmax(0, 1fr))
        ├── #sidebar.sidebar (Fixed aside, 260px desktop, drawer on <=720px)
        └── .main-shell
             ├── #topbar.topbar (Sticky header)
             └── #page-content.page (Routed workspace container)
  ```
- **Remounting Analysis:**
  - `renderShell()` checks if `#sidebar` exists and matches `app.dataset.shellRole === state.role`.
  - However, on ordinary route navigation, lines 126-128 executed:
    ```javascript
    sb.innerHTML = renderSidebar();
    wireSidebar(sb);
    ```
    This completely blew away and rebuilt the sidebar DOM on every route change, causing **sidebar scroll position reset** (`scrollTop` jumped back to top) and unnecessary event re-registration.
  - Furthermore, no profile-specific duplicate shells exist; the same `.app-shell` structure is shared across Master, Owner, Cafe Operations, and Staff.

---

## 2. ROUTING ARCHITECTURE AUDIT

### 2.1 Route Map & Authority Tiers

#### A. Primary Master Routes (Full Portfolio Control)
- `dashboard` (Command Centre)
- `pos` (POS & Billing)
- `attendance` (Attendance & Shifts)
- `dept-orders` (Department Orders)
- `inventory` (Inventory & Stock)
- `procurement` (Procurement & POs)
- `assets` (Assets & Maintenance)
- `quality` (Quality & Compliance)
- `employees` (Employees & Workforce)
- `payroll` (Universal Payroll Control Centre — *Primary Master only*)
- `bills` (Bills & Receipts)
- `expenses` (Expenses & Petty Cash)
- `finance` (Finance & Accounts)
- `ledger` (Personal Ledger & Owner Account — *Primary Master only*)
- `customers` (Customers & Loyalty)
- `menu` (Menu Management)
- `vendors` (Vendors & Supplier Lifecycle)
- `revenue-share` (Revenue Share & Leased Outlets — *Primary Master only*)
- `reports` (Reports & Analytics)
- `admin` (Administration & User Governance)
- `mailops` (MailOps Command Centre)
- `cafe-ops-devices` (Devices & Operator Sessions)
- `settings` (Settings Hub)
- `notifications` (Universal Notification Centre)

#### B. Normal Master Routes (Operational Master)
- Identical to Primary Master **EXCEPT** strict exclusion of: `payroll`, `ledger`, `revenue-share`, `staff-loans-advances`.

#### C. Owner Routes (Executive Governance)
- `dashboard` (Zamorin Command Centre / Owner Overview)
- `approvals` (Operational Task Oversight & Approvals)
- `bills` (Sales Bills & Tax Receipts)
- `performance` (Café Performance & Store Benchmarks)
- `employees` (Workforce & Headcount)
- `finance` (Owner Finance Summary)
- `ledger` (Personal Ledger & Owner Account)
- `payroll` (Payroll & Payslips Oversight)
- `revenue-share` (Revenue Share & Outlets)
- `reports` (Reports & Decision Analytics)
- `settings` (Settings Hub)
- `notifications` (Universal Notification Centre)

#### D. Cafe Operations Routes (Cafe Admin / Operator Terminal)
- `dashboard` (Cafe Operations Dashboard)
- `pos` (POS & Billing Terminal)
- `attendance` (Attendance & Shifts)
- `dept-orders` (Department Orders)
- `inventory` (Inventory Management)
- `procurement` (Procurement Orders)
- `assets` (Assets & Equipment Care)
- `quality` (Quality & Compliance Inspections)
- `expenses` (Store Expenses & Petty Cash)
- `sales-cash` (Sales Cash Book)
- `customers` (Customer Lookup)
- `reports` (Store Reports)
- `tasks` (Action Centre)
- `cafe-ops-devices` (Devices & Sessions)
- `settings` (Store Settings)
- `cafe-operator-signin` (Operator PIN Shift Sign-in)
- `cafe-device-state` (Device Security & Lock States)
- `kiosk-attendance` (Kiosk QR Attendance Terminal)

### 2.2 Route State & Browser Synchronization
- Active navigation state in `router.js` is driven by `state.route`.
- URL synchronization currently relies on in-memory state; browser back/forward and hash routing must be seamlessly reconciled without full-page reloads.

---

## 3. SIDEBAR ARCHITECTURE AUDIT

### 3.1 Existing Behaviors & Defects
1. **Desktop Retraction / Collapse Flaw:**
   - Previous styles included `.sidebar.collapsed` (68px / 84px icon-only mode) with toggle buttons (`#sidebar-collapse-btn` and `#sidebar-toggle-btn`).
   - On desktop/laptop viewports, collapse/retract shifts the entire workspace grid (`grid-template-columns: 260px` $\to$ `68px`), causing content reflow instability.
   - Stage 1 requirement: Desktop sidebar must remain permanently open and stable at 260px.
2. **Scroll Jumping on Route Selection:**
   - When a user scrolled down the sidebar to lower items (e.g. `revenue-share`, `settings`, `mailops`) and clicked an item, `sb.innerHTML = renderSidebar()` wiped the DOM, resetting `sidebar.scrollTop` to `0`.
3. **Active State Derivation:**
   - `renderSidebar()` compares `state.route === item.route ? "active" : ""`.
   - When sidebar DOM is preserved on navigation, active classes must be toggled on existing DOM nodes without destroying scroll position.

---

## 4. TOPBAR ARCHITECTURE AUDIT

### 4.1 Structure & Component Layout
- **Left Region:** Scope dropdown (e.g. Global Portfolio / Cafe Selector) or Cafe Context Bar for Cafe Operations.
- **Center Region:** Global search input with `Ctrl+K` shortcut.
- **Right Region:** Theme switcher popover button, Notification bell with badge, User Avatar & Profile menu.
- **Desktop Defect:** `#sidebar-toggle-btn` (hamburger menu) was displayed on desktop. It must be hidden on desktop viewports and visible only on mobile viewports ($\le 720$px).

---

## 5. THEMING ARCHITECTURE AUDIT

### 5.1 Authoritative Theme Storage & Providers
- **Source of Truth:** `state.settings.theme` synchronized with `localStorage.getItem("zamorin-theme") || "paper"`.
- **Mount Mechanism:** `document.documentElement.dataset.theme = theme` and `document.documentElement.setAttribute("data-theme", theme)`.
- **Supported Themes:**
  1. `paper` (Default: warm porcelain light roastery theme)
  2. `pearl` (Warm parchment roastery light theme)
  3. `midnight` (Zamorin Navy brand dark mode)
  4. `noir` (Charcoal high-contrast dark theme)

### 5.2 Root Cause of Unwanted Dark/Navy Route Content in Owner & Cafe Operations (H. Known Defect)
- **Defect Identified:**
  - In `frontend/src/styles/components.css`, classes `.occ-*` (Owner Command Centre) and `.oto-*` (Operational Task Oversight) had hardcoded `#131c2e`, `#1e293b`, `#0d1524`, and `#f8fafc` background/text colors.
  - In `frontend/src/js/pages/tasksApprovals.js`, multiple inline styles specified `background: #131c2e; border: 1px solid rgba(255,255,255,0.08);` and dark inputs.
  - In `frontend/src/js/pages/revenueShare.js`, top metric cards had hardcoded dark gradients (`#1e293b, #0f172a`, etc.).
- **Impact:** When viewing Owner Overview or Tasks & Oversight under the default `paper` (light) theme, these pages rendered dark/navy cards and panels inside a light shell, creating a broken mixed-theme appearance.
- **Resolution:** Re-tokenized all `.occ-*` and `.oto-*` CSS rules and inline styles to consume semantic tokens (`var(--surface)`, `var(--surface-sunken)`, `var(--ink)`, `var(--muted)`, `var(--line)`, `var(--bronze-500)`, `var(--success)`, `var(--danger)`).

---

## 6. RESPONSIVE & ZOOM ARCHITECTURE AUDIT

### 6.1 Layout Grid & Cascade Math
- `#app`: `width: 100%; min-height: 100vh;`
- `.app-shell`: `display: grid; grid-template-columns: 260px minmax(0, 1fr);`
- `.main-shell`: `min-width: 0; width: 100%;`
- `.page`: `width: 100%; max-width: 1680px; min-width: 0; box-sizing: border-box; margin: 0 auto;`
- **Breakpoints:**
  - `> 1240px`: Full Desktop (260px fixed sidebar, 3-column / 4-column adaptive grids)
  - `1024px`: Tablet Landscape (260px fixed sidebar, `.split` stacked to 1 column)
  - `720px`: Mobile / Small Tablet (Sidebar off-canvas drawer with hamburger button, header controls wrap)
  - `430px`: Mobile Portrait (Single column cards, chart min-height 210px)

---

## 7. ROOT CAUSE OF KNOWN OWNER DEFECT (G. Defect)

### 7.1 Defect Description
> *Sidebar shows "Bills & Receipts" highlighted while "Operational Task Oversight" remains rendered.*

### 7.2 Forensic Diagnosis
1. In `dashboardOwner.js`, the "Attention Required Queue" (Layer 4) and shortcuts rendered action buttons with `data-route="approvals"` or internal hash anchors `#attention-section`.
2. When the user was on `approvals` (Tasks & Oversight), clicking a sidebar link to `bills` executed `navigate("bills")`.
3. In previous iterations, `router.js` had `renderShell()` remounting sidebar HTML before `await wireOwnerBills(content)` completed. If an API call or event registration in `wireOwnerBills` encountered an unhandled promise rejection or if routing state was blocked, the sidebar reflected the new active route (`bills`), but `page-content` remained on the previous rendered DOM (`approvals`).
4. **Permanent Fix:**
   - Active sidebar navigation is strictly updated synchronously in lockstep with `#page-content` replacement.
   - Robust fallback and error boundaries wrap all page render/wire lifecycles so that no asynchronous failure can leave the workspace and sidebar out of sync.
   - Navigation updates URL hash (`#<route>`) to maintain 100% deterministic bidirectional agreement between browser URL, active sidebar link, topbar title, and workspace DOM.

---

## 8. PRE-EXECUTION REGRESSION STATUS
- **Router Imports:** 43 / 43 Validated ✅
- **JavaScript Syntax:** 314 / 314 Files Clean (0 errors) ✅
- **Backend Tests:** 831 / 831 Tests Passing (13 suites) ✅
