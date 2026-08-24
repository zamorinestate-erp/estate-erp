# ZAMORIN CAFE ERP — STAGE 2 DATE CONTROL INVENTORY

**Scope**: Date, Date Range, Month & Time Selection Controls  
**Target Workspaces**: Primary Master · Normal Master · Owner · Cafe Operations  
**Date**: 2026-08-23  

---

## 1. Date & Time Control Inventory

| Workspace / Module | Element / Selector | Current Type | Control Category | Standard Shared Component |
|---|---|---|---|---|
| **Master Dashboard** | `#cc-custom-from`, `#cc-custom-to` | `<input type="date">` | Date Range | `ZamorinDatePicker` Range |
| **Owner Dashboard** | `#occ-custom-from`, `#occ-custom-to` | `<input type="date">` | Date Range | `ZamorinDatePicker` Range |
| **Owner Bills** | `#scope-business-date` | `<input type="date">` | Single Date | `ZamorinDatePicker` Single |
| **Inventory** | `input[name="expiryDate"]` | `<input type="date">` | Expiry Date | `ZamorinDatePicker` Single |
| **Personal Ledger** | `#pl-new-date` | `<input type="date">` | Transaction Date | `ZamorinDatePicker` Single |
| **Procurement** | `#modal-rfq-deadline` | `<input type="date">` | Deadline Date | `ZamorinDatePicker` Single |
| **Tasks & Approvals** | `#assign-duedate` | `<input type="date">` | Due Date | `ZamorinDatePicker` Single |
| **Revenue Share** | `#sim-start`, `#sim-end` | `<input type="date">` | Period Range | `ZamorinDatePicker` Range |
| **Cafe Performance** | `#perf-custom-from`, `#perf-custom-to` | `<input type="date">` | Comparison Range | `ZamorinDatePicker` Range |
| **Department Orders**| `#dept-fulfil-date` | `<input type="date">` | Fulfilment Date | `ZamorinDatePicker` Single |

---

## 2. Standard Shared Date Picker Requirements
- **Input Modes**: Supports typed manual date entry (e.g. `YYYY-MM-DD` or `DD/MM/YYYY`) and interactive calendar popup.
- **Calendar Anatomy**: Month/Year navigation headers, Day-of-week row, Grid of day buttons, "Today" quick-select, and "Clear" button.
- **Range Support**: Start and End date synchronization ensuring `start <= end`.
- **Viewport Boundary Awareness**: Automatically positions above the input field if rendered near the bottom edge of the viewport.
- **Theme Support**: Background `var(--surface)`, border `var(--line)`, selected day `var(--bronze-500)` with crisp white text.
