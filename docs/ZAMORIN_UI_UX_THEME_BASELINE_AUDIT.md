# ZAMORIN CAFE ERP — UI/UX, DESIGN & THEME BASELINE AUDIT

> **Document ID**: `ZAMORIN_UI_UX_THEME_BASELINE_AUDIT.md`  
> **Status**: **FORENSIC AUDIT COMPLETED**  
> **Phase**: `UI-01 — GLOBAL UI/UX + DESIGN + THEME FORENSIC AUDIT`  
> **Preservation Strategy**: Preservation-First Corrective Delta (Zero Redesign, Zero Deletions, Zero Functional Regressions)

---

## A. Existing Visual Architecture

The visual architecture is structured on the approved **"Ledger & Roastery"** design system:
1. **Color Palette & Brand Identity**:
   - **Brand Inks**: Deep Navy (`--ink-950: #0b1424`, `--ink-900: #101a30`, `--ink-800: #1a2740`).
   - **Accent**: Warm Bronze / Roastery Gold (`--bronze-500: #b17d38`, `--bronze-400: #c99a5c`, `--bronze-100: #f4e7d2`).
   - **Surfaces & Grounds**: Porcelain Paper (`--paper: #faf9f5`), Clean White (`--surface: #ffffff`), Sunken (`--surface-sunken: #f2f0e9`).
   - **Functional Accents**: Forest Green (`--success: #1e7a4c`), Ochre Amber (`--warning: #a9741a`), Terracotta Red (`--danger: #b23b35`), Steel Blue (`--info: #2c5c9e`).

2. **Themes**:
   - **Paper (Default Light)**: Porcelain ground, deep navy ink, warm hairline borders.
   - **Pearl (Warm Light)**: Parchment ground (`#f7f0e2`), deep coffee ink, rich bronze accents.
   - **Midnight (Brand Dark)**: Deep navy ground (`#0a0f1c`, `#10192c`), crisp high-contrast bronze (`#e2bb87`), elevated light line borders.
   - **Noir (Charcoal Dark)**: Neutral charcoal near-black ground (`#0d0d0d`, `#161616`), pure achromatic background with focused bronze highlights.

3. **Typography**:
   - **Display / Headers / KPI Figures**: `Fraunces` serif (with `tabular-nums` alignment for currencies/counts).
   - **UI / Body / Actions**: `Inter` sans-serif (clean modern grotesque, font-weight 400-700).
   - **Codes / IDs / Timestamps**: `IBM Plex Mono` (monospace alignment for employee codes, amounts, timestamps).

4. **Layout & Shell**:
   - Fixed retractable sidebar (272px expanded, 68px collapsed, mobile slide-out drawer $\le 1024px$).
   - Sticky topbar (76px height) with Cafe context selector, global search (`Ctrl+K`), theme switcher popover, notification bell, and profile menu.
   - Fluid content container (`.page`, max-width 1680px) with responsive card grids and responsive table wrappers.

---

## B. Approved Visual Elements to Preserve

The following signature design elements define the identity of Zamorin Cafe ERP and **must remain untouched**:
- The **two-line tear-rule card headers** (one solid hairline, one dashed hairline evoking ledger pages).
- The **Fraunces tabular numeral KPI typography**.
- The **4-theme appearance selector** (`paper`, `pearl`, `midnight`, `noir`).
- The **single-cafe and multi-cafe context strips** with terminal and operator state indicators.
- The **role-scoped sidebar navigation hierarchy** (Master, Owner, Cafe Admin, Staff).
- The **toast notification bottom-right stack** with animated progress and color-coded status borders.

---

## C. Systemic & Shared Component Defects Identified

| Defect ID | Component | Severity | Root Cause | Corrective Delta |
|---|---|---|---|---|
| **UI-SHARED-001** | Topbar Popovers (Theme, Notifs, Profile) | `UI-P1` | Duplicate `.popover` CSS rule at line 661 had `opacity: 0; pointer-events: none;` without `.open` class toggle. | Harmonize `.popover` in `zamorin.css` and ensure `components.js` manages `.open` class and display transitions. |
| **UI-SHARED-002** | Global Search Dropdown | `UI-P2` | `.search-results-dropdown`, `.search-group-title`, and `.search-item` classes rendered unstyled. | Add styling for search dropdown adhering to the token layer scale (`z-index: 100`) and theme colors. |
| **UI-SHARED-003** | Dark Theme Toast Cards | `UI-P2` | `components.css` targeted only `[data-theme="dark"]` instead of `[data-theme="midnight"]` and `[data-theme="noir"]`. | Extend selectors to include all dark themes using CSS variables `--surface` and `--ink`. |
| **UI-SHARED-004** | Table Horizontal Overflow | `UI-P2` | Certain wide tables lacked `.table-wrap` container on narrower mobile viewports. | Ensure standard `.table-wrap` wrapper with smooth horizontal scroll and sticky headers across all pages. |
| **UI-SHARED-005** | Form Input Dark Contrast | `UI-P2` | Hardcoded background `#ffffff` on `.text-input` in `components.css` line 293 caused bright flash in dark themes. | Use `background: var(--surface); color: var(--ink); border-color: var(--line);` tokens. |

---

## D. Workspace-Specific Baseline Review

### 1. Primary Master Workspace
- **Dashboard**: Command Centre KPI grid, quick action tiles, live refresh button, multi-location breakdown table.
- **Administration**: User governance tables, custom fields, soft-deleted trash bin, audit explorer.
- **Inventory & Menu**: Multi-cafe stock levels, canonical menu item cards with image thumbnails and status pills.
- **Payroll & Ledger**: Master payroll issuance cockpit, executive personal ledger.

### 2. Employee / Staff Workspace
- **Staff Home**: Personal greeting, clock-in status, quick links (Leave, Payslips, Requests).
- **Attendance & Leave**: Punch history card, leave balance chips, leave application modal.
- **Loans & Payslips**: Loan eligibility gauge, repayment schedule table, monthly payslip download card.

### 3. Owner Workspace
- **Overview Dashboard**: Strategic KPIs (Revenue, Labour %, COGS, Gross Margin, Wastage).
- **Cafe Performance**: Outlet comparative metrics, sales vs labour charts.
- **Approvals & Bills**: High-value expense approvals and itemized bill explorer.

### 4. Cafe Admin Workspace
- **Operations Cockpit**: Live connectivity badge, active operator strip, lock terminal & switch operator modals.
- **POS Till**: Categorized menu item grid, active cart with modifier support, split cash/UPI tender keypad.
- **Daily Checklists**: Opening and closing checklist status, shift handover notes.

---

## E. Deferred Login Integration Items

As explicitly mandated:
- **Normal Login** (`login.js` standalone authentication)
- **Cafe Operations PIN Login** (`cafeOperatorSignIn.js`)
*Both authentication flows remain preserved and deferred for UI-10 integration.*

---

## F. Implementation Sequence (UI-02 onward)

```
UI-02: Global / Shared Component Corrections (Popovers, Search Dropdown, Inputs, Modals, Toasts)
UI-03: Application Shell & Responsive Topbar/Sidebar Alignment
UI-04: Primary Master Workspace Polish
UI-05: Employee / Staff Workspace Mobile & Responsive Polish
UI-06: Owner Workspace Executive Card & Chart Polish
UI-07: Cafe Admin Operations Cockpit & Till Layout Polish
UI-08: Shared Modules (Profile Master, Settings Hub, Quality Checklists)
UI-09: Responsive, Accessibility & Cross-Browser Verification
UI-11: Full Visual Regression & Final Audit Report
```
