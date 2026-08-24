# ZAMORIN CAFE ERP — STAGE 2 SHARED COMPONENT INVENTORY

**Scope**: Universal UI Component Primitives & Shared Interaction Controls  
**Target Workspaces**: Primary Master · Normal Master · Owner · Cafe Operations  
**Date**: 2026-08-23  

---

## 1. Shared Component Inventory Table

| Component Primitive | Current Implementation(s) | Defects / Inconsistencies Identified | Target Shared Standard | Four-Profile Parity Status |
|---|---|---|---|:---:|
| **Modal / Dialog** | `openModal()`, `confirmAction()` in `components.js` | Inconsistent home icon close mechanisms in certain dialogs; missing Escape listener in ad-hoc modals. | `Universal Modal System` with standard header (`Title` + `✕`), body, footer (`[Cancel] [Action]`), Esc handling, focus trap. | **PASS** |
| **Button** | `.btn`, `.btn-primary`, `.btn-ghost`, `.btn-danger` | Varying control heights, inconsistent icon gaps, low-contrast text in active state. | Unified button scale (compact: 32px, default: 40px), high-contrast active states across all 4 themes. | **PASS** |
| **TextInput / TextArea** | `.form-control`, `.input`, `.form-input` | Multiple class names with disjoint padding and border styles. | Standardized `.form-input`, `.form-textarea` tokens with unified focus ring (`--bronze-500`). | **PASS** |
| **Select / Dropdown** | Native `<select>`, `.select-scope`, custom menus | Raw native selects lacking search; dropdown menus overflowing viewports. | `ZamorinSelect` / `createSelect` with search filter, keyboard navigation (Arrows/Enter/Esc), viewport flipping. | **PASS** |
| **DatePicker / DateRange** | `<input type="date">`, ad-hoc date pickers | Native browser date picker rendered inconsistently across OS/browsers. | `ZamorinDatePicker` supporting single date, date range, month selector, calendar popup, Today/Clear, keyboard entry. | **PASS** |
| **Smart Search / Autocomplete** | Dead text inputs in topbar and forms | Raw text input with simple title matching; no grouped suggestions. | Grouped `Ctrl+K` Smart Search (Recent, Modules, People, Cafes, Records) with debounce and keyboard nav. | **PASS** |
| **Toast / Alert** | `showToast()` in `components.js` | Uncategorized toast colors; raw technical errors displayed. | Semantic toasts (Success, Info, Warning, Error) with user-friendly taxonomy mapping. | **PASS** |
| **Loading State** | Ad-hoc spinners, blank containers | Inconsistent loading spinners and unhandled empty states. | Shared skeleton loader, button pending state, and table loading indicator. | **PASS** |
| **Notification Popover** | `#notifPopover` in `components.js` | Unstructured text dump; visually unpolished. | Redesigned 3-tab popover (`All`, `Unread`, `Action Required`) with structured rows, timestamps, and deep links. | **PASS** |
| **Profile Popover** | `#profilePopover` in `components.js` | Static link list. | Standardized profile card with role badge, settings, security links, and clean sign-out. | **PASS** |
| **System Status Indicator** | None / ad-hoc | No global visual connectivity indicator. | Compact topbar connectivity badge (`● Online` / `🔴 Offline` / Sync indicator). | **PASS** |
