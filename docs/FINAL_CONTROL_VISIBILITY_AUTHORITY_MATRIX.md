# ZAMORIN CAFÉ ERP
## FINAL CONTROL VISIBILITY AUTHORITY MATRIX
**Version:** 1.0.0  
**Status:** VERIFIED AND CLOSED  
**Date:** 2026-08-27  

---

> This matrix documents which control categories are visible and actionable for each persona.
> Access is enforced at three layers: (1) Sidebar navigation, (2) Router route guard (`isRouteAllowed`), (3) Page-level authority checks.

---

## Persona Definitions

| Persona | Role ID | isPrimaryMaster |
|---------|---------|-----------------|
| Primary Master | `master` | `true` |
| Normal Master | `master` | `false` |
| Owner | `owner` | — |
| Cafe Operations (Admin) | `cafe_admin` | — |
| Staff | `staff` | — |

---

## Control Visibility Matrix

### COMMAND GROUP

| Control | Primary Master | Normal Master | Owner | Cafe Ops | Staff |
|---------|:-:|:-:|:-:|:-:|:-:|
| Command Centre Dashboard | ✅ | ✅ | — | — | — |
| Owner Overview Dashboard | — | — | ✅ | — | — |
| Cafe Operations Dashboard | — | — | — | ✅ | — |
| Staff Home | — | — | — | — | ✅ |
| Announcements | — | — | — | — | ✅ |
| Notification Bell | ✅ | ✅ | ✅ | ✅ | ✅ |
| Notification Centre | ✅ | ✅ | ✅ | ✅ | ✅ |

---

### OPERATIONS GROUP

| Control | Primary Master | Normal Master | Owner | Cafe Ops | Staff |
|---------|:-:|:-:|:-:|:-:|:-:|
| POS & Billing | ✅ | ✅ | — | ✅ | — |
| Tasks & Oversight (Approvals) | ✅ | ✅ | ✅ | — | — |
| Action Centre (Tasks) | — | — | — | ✅ | — |
| Attendance & Shifts | ✅ | ✅ | — | ✅ | — |
| My Attendance (Staff) | — | — | — | — | ✅ |
| My Leave (Staff) | — | — | — | — | ✅ |
| Department Orders | ✅ | ✅ | — | ✅ | — |
| Inventory | ✅ | ✅ | — | ✅ | — |
| Procurement | ✅ | ✅ | — | ✅ | — |
| Assets & Maintenance | ✅ | ✅ | — | ✅ | — |
| Quality & Compliance | ✅ | ✅ | — | ✅ | — |
| Sales & Cash Book | — | — | — | ✅ | — |

---

### PEOPLE GROUP

| Control | Primary Master | Normal Master | Owner | Cafe Ops | Staff |
|---------|:-:|:-:|:-:|:-:|:-:|
| Employees Module | ✅ | ✅ | ✅ (read) | — | — |
| Employee Profile | ✅ | ✅ | — | — | — |
| Payroll & Payslips | ✅ | ❌ (blocked) | ✅ | — | — |
| Staff Payslips (Self) | — | — | — | — | ✅ via Settings |
| Staff Loans & Advances (Self) | — | — | — | — | ✅ via Settings |

---

### FINANCE GROUP

| Control | Primary Master | Normal Master | Owner | Cafe Ops | Staff |
|---------|:-:|:-:|:-:|:-:|:-:|
| Bills & Receipts | ✅ | ✅ | ✅ | — | — |
| Expenses | ✅ | ✅ | — | ✅ | — |
| Finance & Accounts | ✅ | ✅ | ✅ (summary view) | — | — |
| Passbook & Treasury | ✅ | ❌ (blocked) | ✅ | — | — |
| Personal Ledger & Owner Account | ✅ | ❌ (blocked) | ✅ | — | — |
| Café Performance | — | — | ✅ | — | — |

---

### COMMERCIAL GROUP

| Control | Primary Master | Normal Master | Owner | Cafe Ops | Staff |
|---------|:-:|:-:|:-:|:-:|:-:|
| Customers & Loyalty | ✅ | ✅ | — | ✅ | — |
| Menu Management | ✅ | ✅ | — | ✅ | — |
| Vendors | ✅ | ✅ | — | — | — |
| Revenue Share & Outlets | ✅ | ❌ (blocked) | ✅ | — | — |

---

### INSIGHTS GROUP

| Control | Primary Master | Normal Master | Owner | Cafe Ops | Staff |
|---------|:-:|:-:|:-:|:-:|:-:|
| Reports & Analytics | ✅ (all cafés) | ✅ (all cafés) | ✅ (scoped) | ✅ (this café) | — |

---

### ADMINISTRATION GROUP

| Control | Primary Master | Normal Master | Owner | Cafe Ops | Staff |
|---------|:-:|:-:|:-:|:-:|:-:|
| Administration Module | ✅ | ✅ | — | — | — |
| Organisation Identity | ✅ | ❌ (blocked) | ✅ | — | — |
| Trash Bin (Data Recovery) | ✅ (via Settings) | ✅ (via Settings) | — | — | — |

---

### SYSTEM GROUP

| Control | Primary Master | Normal Master | Owner | Cafe Ops | Staff |
|---------|:-:|:-:|:-:|:-:|:-:|
| Devices & Sessions | ✅ | ✅ | — | ✅ | — |
| Settings (Personal) | ✅ | ✅ | ✅ | ✅ | ✅ |
| Settings — Admin sub-section | ✅ | ✅ | ❌ | ❌ | ❌ |
| Cafe Operator Sign-in | — | — | — | ✅ | — |
| Device State Screens | — | — | — | ✅ | — |
| Kiosk Attendance Display | ✅ | ✅ | ✅ | ✅ | ✅ |

---

## Enforcement Layers

All access controls are enforced at **three independent layers**:

1. **Sidebar Navigation** (`navigation.js` → `getGroupedNavItems`) — Only permitted routes appear in sidebar
2. **Router Route Guard** (`router.js` → `isRouteAllowed`) — Every `navigate()` call re-checks permission
3. **Page-Level Guards** (`router.js renderPage()`) — Passbook, Ledger, Payroll, Revenue Share, Org Identity render `renderNotAvailable()` if role fails guard

No single-point-of-failure exists. All three layers must be bypassed simultaneously for unauthorized access.

---

*Zamorin Café ERP · Control Visibility Authority Matrix · Verified 2026-08-27*
