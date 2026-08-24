# ZAMORIN CAFE ERP — STAGE 3 UI/UX BASELINE AUDIT
## Comprehensive Multi-Profile Interface & Navigation Inventory

### 1. Target Profile Scope
- **PRIMARY MASTER**: Full organisation-level root governance, all cafes, all modules.
- **NORMAL MASTER**: Multi-café management operations (excluding root governance / personal ledger / revenue share).
- **OWNER**: Multi-café executive oversight, personal ledger, consolidated finance, approvals.
- **CAFE OPERATIONS**: Single-café operational terminal scope (`ZC-0001`), POS till, shift attendance, local stock.
- **EMPLOYEE / STAFF**: STRICTLY FROZEN (5 self-service personal routes only).

---

### 2. Four-Profile Common Module Availability Matrix

| Module / Area | Primary Master | Normal Master | Owner | Cafe Operations | Staff (Frozen Scope) |
|---|:---:|:---:|:---:|:---:|:---:|
| **Dashboard / Command Centre** | ✅ Yes | ✅ Yes | ✅ Yes | ✅ Yes | N/A (Staff Home) |
| **Attendance & Shifts** | ✅ Yes | ✅ Yes | ✅ Policy | ✅ Yes | N/A (Self Attendance) |
| **Department Orders** | ✅ Yes | ✅ Yes | N/A | ✅ Yes | N/A |
| **Inventory & Stock** | ✅ Yes | ✅ Yes | N/A | ✅ Yes | N/A |
| **Procurement / POs** | ✅ Yes | ✅ Yes | N/A | ✅ Yes | N/A |
| **Assets & Maintenance** | ✅ Yes | ✅ Yes | N/A | ✅ Yes | N/A |
| **Quality & Compliance** | ✅ Yes | ✅ Yes | N/A | ✅ Yes | N/A |
| **Employees / Workforce (Management)** | ✅ Yes | ✅ Yes | ✅ Yes | ✅ Yes | N/A |
| **Universal Payroll Management** | ✅ Yes | Policy Blocked | ✅ Yes | ✅ Yes | N/A (Self Payslips) |
| **Bills & Receipts** | ✅ Yes | ✅ Yes | ✅ Yes | ✅ Yes | N/A |
| **Expenses & Spend** | ✅ Yes | ✅ Yes | N/A | ✅ Yes | N/A |
| **Finance & Accounts** | ✅ Yes | ✅ Yes | ✅ Yes | ✅ Yes | N/A |
| **Personal Ledger / Owner Account** | ✅ Yes | Policy Blocked | ✅ Yes | Policy Blocked | N/A |
| **Customers & Loyalty** | ✅ Yes | ✅ Yes | N/A | ✅ Yes | N/A |
| **Menu & Recipe Management** | ✅ Yes | ✅ Yes | N/A | ✅ Yes | N/A |
| **Vendors & Suppliers** | ✅ Yes | ✅ Yes | N/A | ✅ Yes | N/A |
| **Revenue Share & Leased Outlets** | ✅ Yes | Policy Blocked | ✅ Yes | Policy Blocked | N/A |
| **Reports & Analytics** | ✅ Yes | ✅ Yes | ✅ Yes | ✅ Yes | N/A |
| **Administration & Governance** | ✅ Yes | ✅ Yes (Scoped) | N/A | N/A | N/A |
| **Devices & Sessions** | ✅ Yes | ✅ Yes | N/A | ✅ Yes | N/A |
| **Tasks & Oversight** | 🔄 Adding | 🔄 Adding | ✅ Yes | ✅ Yes | N/A |
| **MailOps Command Centre** | 🛑 Retiring | 🛑 Retiring | N/A | N/A | N/A |
| **Universal Settings Hub** | ✅ Yes | ✅ Yes | ✅ Yes | ✅ Yes | ✅ Yes (Personal Only) |

---

### 3. Baseline Defects & Inconsistencies Identified
1. **Oversized Horizontal Tab Navigation**: Multiple modules (e.g. Quality, Assets, Employees, Reports, Revenue Share, Vendors) featured wide horizontal tab strips with 8+ tabs that overflowed viewports at laptop resolutions (1366x768 / 1536x864).
2. **Page-Replacing vs Route-Based Navigation**: In several modules, switching tabs rendered monolithic HTML chunks inside the same route container rather than generating dedicated subpage routes (`#module/subpage`), breaking browser history (Back/Forward).
3. **Empty Areas & Wide Viewport Spacing**: Wide 1080p and laptop screens exhibited unstyled blank spaces due to static column counts rather than auto-fit responsive grid architecture.
4. **Owner Dashboard / Task Module Theme Takeover**: Historical occurrences where Owner/Cafe Ops suffered theme overrides or blue color takeovers.
5. **MailOps Navigation Clutter**: MailOps Command Centre was exposed in Primary Master & Normal Master sidebar despite being approved for retirement.
6. **Tasks & Oversight Inconsistency**: Operational Task Oversight was accessible in Owner and Cafe Operations but absent from Primary Master and Normal Master.

---

### 4. Stage 3 Corrective Strategy
- Implement Universal Module Hub component (`renderModuleHub` & `.module-tile-grid`) using responsive auto-fit cards.
- Refactor all major modules into dedicated subpage routes with persistent shell headers and contextual KPIs.
- Roll out Tasks & Oversight to Primary Master and Normal Master.
- Retire MailOps from user-facing navigation.
- Rebuild Universal Settings Hub with large Zamorin tiles.
