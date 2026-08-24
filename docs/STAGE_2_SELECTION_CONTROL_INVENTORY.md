# ZAMORIN CAFE ERP — STAGE 2 SELECTION CONTROL INVENTORY

**Scope**: Dropdown, Select, Combobox & Entity Selector Primitives  
**Target Workspaces**: Primary Master · Normal Master · Owner · Cafe Operations  
**Date**: 2026-08-23  

---

## 1. Selection Control Inventory Across Workspaces

| Workspace | Screen / Context | Current Implementation | Control Type | Target Shared Component | Migration Status |
|---|---|---|---|---|:---:|
| **Shared Topbar** | Cafe Scope Selector | `<select id="global-cafe-selector">` | Scope Dropdown | `ZamorinSelect` styled | **Standardized** |
| **Primary Master** | Dashboard Period Filter | `<select id="cc-period-select">` | Period Selector | `ZamorinSelect` styled | **Standardized** |
| **Owner** | Dashboard Period Filter | `<select id="occ-period-select">` | Period Selector | `ZamorinSelect` styled | **Standardized** |
| **Cafe Operations** | POS Till Selection | `<select id="pos-till-select">` | Till Selector | `ZamorinSelect` styled | **Standardized** |
| **Inventory** | Item Category Filter | `<select id="inv-cat-select">` | Category Dropdown | `ZamorinSelect` styled | **Standardized** |
| **Procurement** | Supplier Selector | `<select id="proc-supplier-select">` | Entity Selector | `ZamorinSelect` searchable | **Standardized** |
| **Vendors** | Order Status Filter | `<select id="vendor-status-select">` | Filter Dropdown | `ZamorinSelect` styled | **Standardized** |
| **Revenue Share** | Outlet Selector | `<select id="rs-outlet-select">` | Entity Selector | `ZamorinSelect` styled | **Standardized** |
| **Settings** | Theme Chooser | `.theme-options button` | Custom Popover | Popover Options | **Standardized** |

---

## 2. Selection Control Standard Rules
- **Keyboard Navigation**: ArrowUp / ArrowDown moves highlight; Enter selects; Escape closes without selection.
- **Viewport Safety**: Popup menu recalculates bounds on open. If screen bottom is reached, the menu opens upward.
- **High Contrast Active State**: Active/selected options use `--bronze-100` in light themes and `--bronze-700` in dark themes with high-contrast text.
- **Theme Awareness**: Dynamic inheritance from document root `data-theme` (*Paper*, *Pearl*, *Midnight*, *Noir*).
