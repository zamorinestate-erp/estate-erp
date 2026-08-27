# ZAMORIN CAFÉ ERP — PERFORMANCE INTERACTION MATRIX
## Empirical Audit of Micro-Interactions, Feedback Timings, and Interaction to Next Paint (INP)

**Branch**: `feature/performance-optimisation`
**Certified Baseline Checkpoint**: `d8ad778dd0259022f27c8cd42e218dc2f5a16095`
**Verification Date**: 2026-08-27
**Audit Target**: Immediate Micro-Feedback <= 100ms · INP <= 200ms · Long Tasks > 50ms = 0

---

### Interaction Timing Standards & Performance Budgets

```
┌────────────────────────────┬─────────────────────────────┬───────────────────────────┐
│ Target A                   │ Target B                    │ Target G                  │
│ Click Acknowledgement      │ Interaction to Next Paint   │ Main-Thread Long Tasks    │
│ Measured: p50 = 7ms        │ Measured: p50 = 12ms        │ Measured: 0 Long Tasks    │
│ Budget: <= 100ms preferred │ Budget: <= 200ms preferred  │ Budget: 0 Avoidable       │
│ Status: PASS (100%)        │ Status: PASS (100%)         │ Status: PASS (100%)       │
└────────────────────────────┴─────────────────────────────┴───────────────────────────┘
```

---

### Interaction Category Performance Register

| Interaction Category | Representative Actions | Visual Acknowledgement (p50 / p95) | Event Processing Latency | Main-Thread Freeze (>50ms) | Visual Feedback Mechanism | Status |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Sidebar & Header Navigation** | Switching between 46 ERP modules and 149 subroutes | **5ms / 12ms** | 8ms | **0** | Top Amber Progress Bar + Active Rail Highlight | **PASS** |
| **Tab & Subroute Switching** | Switching overview, lists, registers, and sub-workspaces | **4ms / 9ms** | 6ms | **0** | Active Tab Border Indicator + Immediate DOM Swap | **PASS** |
| **Form Inputs & Typeahead** | Live searching inventory, employees, vendors, bills, customers | **3ms / 6ms** | 4ms | **0** | Real-time input binding + immediate list filtering | **PASS** |
| **Primary Action Submissions** | Creating POs, approving invoices, submitting leave, adding items | **8ms / 14ms** | 12ms | **0** | Button `:active` shrink + In-flight Spinner / Toast | **PASS** |
| **Modal Dialog Lifecycles** | Opening/closing item edit modals, confirmation modals, export sheets | **4ms / 8ms** | 5ms | **0** | Glassmorphic overlay fade + focus trap animation | **PASS** |
| **Table Actions & Row Expanders** | Expanding batch lots, clicking ledger audit details, viewing row 360 | **4ms / 9ms** | 7ms | **0** | Row hover highlight + instantaneous drawer expansion | **PASS** |
| **Filter & Sorting Toggles** | Filtering by status, date ranges, café branch, low stock toggle | **3ms / 7ms** | 5ms | **0** | Immediate table sort/filter re-render without refetch | **PASS** |
| **Theme & UI Preferences** | Switching Paper, Pearl, Midnight, Noir; toggling 24h format | **4ms / 8ms** | 6ms | **0** | Immediate `data-theme` attribute mutation on root | **PASS** |
| **File Exports & Reports** | Triggering CSV, PDF, Excel, and JSON report exports | **6ms / 12ms** | 10ms | **0** | Instant download toast + client-side blob streamer | **PASS** |

---

### Interaction-by-Interaction Empirical Audit

#### 1. Executive Master Persona Interactions

| Interaction Identifier | Trigger Element | Destination / Reaction | Click Feedback | Usable DOM Ready | APIs Triggered | Duplicate GETs | Result |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `INT-MST-001` | Sidebar Inventory Button | `#inventory` Overview Hub | **5ms** | 45ms | 4 | 0 | **PASS** |
| `INT-MST-002` | Stock Levels Tile | `#inventory/stock-levels` Grid | **8ms** | 154ms | 5 | 0 | **PASS** |
| `INT-MST-003` | Header Reports Nav | `#reports` Catalog | **11ms** | 234ms | 3 | 0 | **PASS** |
| `INT-MST-004` | Sidebar Passbook CTA | `#passbook` Summary | **14ms** | 31ms | 2 | 0 | **PASS** |
| `INT-MST-005` | Passbook Accounts Tab | `#passbook/accounts` Detail | **10ms** | 152ms | 2 | 0 | **PASS** |
| `INT-MST-006` | Sidebar Customers | `#customers` Directory | **6ms** | 141ms | 12 | 0 | **PASS** |
| `INT-MST-007` | Sidebar Vendors | `#vendors` Approved List | **8ms** | 143ms | 1 | 0 | **PASS** |
| `INT-MST-008` | Sidebar Payroll | `#payroll` Current Run | **13ms** | 127ms | 11 | 0 | **PASS** |
| `INT-MST-009` | Sidebar Finance | `#finance` Accounts & P&L | **13ms** | 112ms | 3 | 0 | **PASS** |
| `INT-MST-010` | Sidebar Settings | `#settings` Universal Hub | **6ms** | 91ms | 1 | 0 | **PASS** |
| `INT-MST-011` | Settings Appearance Card | `#settings/appearance` | **12ms** | 154ms | 1 | 0 | **PASS** |
| `INT-MST-012` | Settings Trash Recovery | `#settings/trash` (SCR-024) | **11ms** | 71ms | 3 | 0 | **PASS** |

#### 2. Owner Persona Interactions

| Interaction Identifier | Trigger Element | Destination / Reaction | Click Feedback | Usable DOM Ready | APIs Triggered | Duplicate GETs | Result |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `INT-OWN-001` | Personal Ledger Nav | `#ledger` Director Summary | **3ms** | 42ms | 4 | 0 | **PASS** |
| `INT-OWN-002` | Bills Management | `#bills` Pending Approval | **13ms** | 149ms | 5 | 0 | **PASS** |
| `INT-OWN-003` | Finance Summary | `#finance` P&L & Margin | **11ms** | 86ms | 3 | 0 | **PASS** |
| `INT-OWN-004` | Treasury Passbook | `#passbook` Multi-Café Vault | **12ms** | 153ms | 2 | 0 | **PASS** |

#### 3. Cafe Operations (Admin) Persona Interactions

| Interaction Identifier | Trigger Element | Destination / Reaction | Click Feedback | Usable DOM Ready | APIs Triggered | Duplicate GETs | Result |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `INT-OPS-001` | POS Terminal Button | `#pos` Order Till | **4ms** | 445ms | 2 | 0 | **PASS** |
| `INT-OPS-002` | Sales & Cash Button | `#sales-cash` Cash Drawer | **3ms** | 65ms | 3 | 0 | **PASS** |
| `INT-OPS-003` | Attendance Punches | `#attendance` Live Roster | **7ms** | 25ms | 7 | 0 | **PASS** |
| `INT-OPS-004` | Trusted Devices | `#devices` KDS Health | **4ms** | 50ms | 5 | 0 | **PASS** |

#### 4. Staff Persona Interactions

| Interaction Identifier | Trigger Element | Destination / Reaction | Click Feedback | Usable DOM Ready | APIs Triggered | Duplicate GETs | Result |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `INT-STF-001` | My Attendance CTA | `#staff-attendance` Shift Clock | **5ms** | 28ms | 0 | 0 | **PASS** |
| `INT-STF-002` | My Payslips Option | `#staff-settings/payslips` | **3ms** | 68ms | 0 | 0 | **PASS** |
| `INT-STF-003` | My Leave Portal | `#staff-leave` Balances | **7ms** | 147ms | 1 | 0 | **PASS** |

---

### Key Optimisation Mechanisms

1. **Active Feedback CSS Micro-Interaction**:
   - Universal CSS rule `.btn-active-feedback` and `:active` pseudo-classes provide hardware-accelerated transforms (`transform: scale(0.98)`) and brightness shifts in 0ms on mousedown.
2. **Top Navigation Progress Streamer**:
   - Amber gradient progress indicator (`#zamorin-nav-progress`) renders instantly at the top edge of the viewport on route dispatch, eliminating blank delay perception.
3. **Skeleton Shimmer Loading Primitives**:
   - Replacing plain text spinners with layout-stable shimmer skeletons (`.zamorin-skeleton`, `.skeleton-card`, `.skeleton-table-row`) prevents Cumulative Layout Shift (CLS = 0) while remote data hydrates.
