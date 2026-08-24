# Universal Module Architecture — Child Workspace Action Matrix
## Reference Architecture Standard & Systemic Action Catalogue

This document defines the canonical action distribution for all 17 reconstructed complex modules in Zamorin Café ERP.

**Architecture Standard Rules**:
1. **Module Overview Purity**: Module overviews display ONLY module-wide scope, module-wide KPIs, workspace tiles, Needs Attention summary, recent activity, and module-level sync/refresh actions. No child-specific forms, tables, heatmaps, or create/add actions are placed on the overview.
2. **Child Workspace Dominance**: Navigating to a child workspace (`#module/child`) renders a dedicated child page header (`renderChildHeader`) with compact breadcrumbs (`← [Module Name] / [Child Name]`), a dominant Child H1 matching the workspace tile title, a descriptive functional subtitle, and child-specific primary/secondary actions.
3. **Back Navigation**: Standard compact breadcrumb `← [Module Name]` with `data-back-to-hub="true"` and `data-[module]-back-to-hub="true"` replaces all legacy heavy boxed banners.
4. **Resilient Error State**: API failures on child pages render inside the child container using `renderModuleErrorState` with structured recovery flows (`[ Sign In Again ]`, `[ Retry ]`), preserving the breadcrumb and child page shell.

---

| Module | Child Workspace Route | Workspace Title (H1) | Primary Child Action | Secondary / Filter Action | Inherited Module-Wide Action | Unrelated / Residual Action Removed | Result |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Inventory & Stock** | `#inventory/stock-by-cafe` | Stock Levels | Refresh Stock | Search / Filter by Café & Category | Sync Stock | Heatmap removed from Overview; placed here | PASSED |
| **Inventory & Stock** | `#inventory/global-items` | Global Item Master | + Add Global Item | Search SKU / Name Master | Sync Stock | `+ Add Global Item` moved from Overview header | PASSED |
| **Inventory & Stock** | `#inventory/replenishment` | Replenishment & PAR | Recalculate PAR | Filter Low Stock Outlets | Sync Stock | Removed from Overview body | PASSED |
| **Inventory & Stock** | `#inventory/receipts` | Receipts & Put-Away | Confirm Goods Receipt | Scan ASN / PO Number | Sync Stock | Intake form isolated to child workspace | PASSED |
| **Inventory & Stock** | `#inventory/movements` | Stock Ledger | View Transaction Detail | Filter Movement Type | Sync Stock | Full ledger isolated from Overview | PASSED |
| **Inventory & Stock** | `#inventory/lots-expiry` | Lots & FEFO Expiry | Quarantine Expired Batch | Filter Near-Expiry Window | Sync Stock | Batch grid isolated to child workspace | PASSED |
| **Inventory & Stock** | `#inventory/transfers` | Inter-Café Transfers | + Request Transfer | Dispatch / Receive Order | Sync Stock | Modal & list isolated to child workspace | PASSED |
| **Inventory & Stock** | `#inventory/reservations` | Stock Reservations | + Reserve Stock | Release Reservation | Sync Stock | Allocation grid isolated to child workspace | PASSED |
| **Inventory & Stock** | `#inventory/counts` | Cycle Counts | + Record Physical Count | Approve & Post Adjustment | Sync Stock | Physical count form isolated to child | PASSED |
| **Inventory & Stock** | `#inventory/wastage` | Wastage & Adjustments | Log Wastage & Deduct | Select Spoilage Reason Code | Sync Stock | Spoilage form isolated to child | PASSED |
| **Inventory & Stock** | `#inventory/consumption-variance` | Recipe Variance | Review Theoretical COGS | Filter High Variance Items | Sync Stock | Variance table isolated to child | PASSED |
| **Inventory & Stock** | `#inventory/valuation` | Valuation & Reports | Export Valuation (CSV) | Filter Asset Class | Sync Stock | Financial inventory valuation isolated | PASSED |
| **Inventory & Stock** | `#inventory/recalls` | Recall & Traceability | + Initiate Food Recall | Quarantine Affected Lots | Sync Stock | Recall workflow isolated to child | PASSED |
| **Inventory & Stock** | `#inventory/integrity` | Inventory Integrity | Re-run Audit Checks | View Sanity Violations | Sync Stock | Automated audit isolated to child | PASSED |
| **Procurement** | `#procurement/requisitions` | Purchase Requests | + Purchase Request | Filter Approval Stage | Sync Procurement | `+ Purchase Request` moved from Overview | PASSED |
| **Procurement** | `#procurement/catalogue` | Item Master Catalogue | + Add Contract Item | Search Supplier SKU Map | Sync Procurement | Pricing catalogue isolated to child | PASSED |
| **Procurement** | `#procurement/rfqs` | Sourcing & RFQs | + Create RFQ | Evaluate Quotation Sheets | Sync Procurement | `+ Create RFQ` moved from Overview | PASSED |
| **Procurement** | `#procurement/orders` | Purchase Orders | + New PO | Release / Dispatch PO | Sync Procurement | `+ New PO` moved from Overview | PASSED |
| **Procurement** | `#procurement/agreements` | Blanket Agreements | + New Blanket Agreement | Drawdown Order Schedule | Sync Procurement | Long-term contracts isolated to child | PASSED |
| **Procurement** | `#procurement/deliveries` | Inbound Deliveries | Log ASN Delivery | Track Carrier Shipment | Sync Procurement | Shipping tracker isolated to child | PASSED |
| **Procurement** | `#procurement/receiving` | Receiving & GRN | Record GRN Intake | Inspect Batch & Put-Away | Sync Procurement | Dock receiving isolated to child | PASSED |
| **Procurement** | `#procurement/matching` | 3-Way Invoice Matching | Run 3-Way Reconciliation | Resolve Price Variance | Sync Procurement | Reconciliation tool isolated to child | PASSED |
| **Procurement** | `#procurement/suppliers` | Suppliers Directory | + Add Approved Supplier | View Compliance Ratings | Sync Procurement | Vendor records isolated to child | PASSED |
| **Procurement** | `#procurement/exceptions` | Returns & Quality | + File Return / Debit Note | Quarantine Defective Lot | Sync Procurement | Exception log isolated to child | PASSED |
| **Procurement** | `#procurement/reports` | Reports & Analytics | Export Spend Report | Category Spend Analytics | Sync Procurement | Spend breakdown isolated to child | PASSED |
| **Assets & Maintenance** | `#assets/assets` | Asset Register | + Register New Asset | Filter Category & Status | Refresh Assets | `+ Register New Asset` moved from Overview | PASSED |
| **Assets & Maintenance** | `#assets/maintenance` | Preventive Maintenance | + Schedule Maintenance | View Recurring SOPs | Refresh Assets | Schedules isolated to child workspace | PASSED |
| **Assets & Maintenance** | `#assets/work_orders` | Work Orders & Repairs | + Create Work Order | Dispatch Technician | Refresh Assets | Work orders isolated to child workspace | PASSED |
| **Assets & Maintenance** | `#assets/inspections` | Inspections & Warranty | + Log Calibration | Track AMC Expiry | Refresh Assets | Warranty registry isolated to child | PASSED |
| **Assets & Maintenance** | `#assets/analytics` | Reliability Analytics | Export MTBF Report | Downtime Cost Analysis | Refresh Assets | Analytics isolated to child workspace | PASSED |
| **Quality & Compliance** | `#quality/my-checks` | Daily Inspections | + Start Check | Filter Shift & Station | Refresh Quality | `+ Start Check` moved from Overview | PASSED |
| **Quality & Compliance** | `#quality/templates` | Checklist Templates | + New Template | Configure Inspection Points | Refresh Quality | Template editor isolated to child | PASSED |
| **Quality & Compliance** | `#quality/temperatures` | Temperature Logs | + Log Temperature | Review Critical CCP Thresholds | Refresh Quality | Temp register isolated to child | PASSED |
| **Quality & Compliance** | `#quality/holds-ncr` | Quality Holds & NCR | ⚠️ Report Issue / NCR | Release / Dispose Lot | Refresh Quality | `⚠️ Report Issue` moved from Overview | PASSED |
| **Quality & Compliance** | `#quality/capas` | CAPA Action Plans | + Create CAPA Plan | Verify Corrective Action | Refresh Quality | CAPA register isolated to child | PASSED |
| **Quality & Compliance** | `#quality/audits` | FSMS Audits | + Schedule FSMS Audit | Review Compliance Score | Refresh Quality | Internal audit isolated to child | PASSED |
| **Quality & Compliance** | `#quality/compliance` | Statutory Licenses | + Add License Record | Track FSSAI Renewal | Refresh Quality | License matrix isolated to child | PASSED |
| **Quality & Compliance** | `#quality/traceability` | Food Traceability | Trace Batch Origin | Locate Affected Outlets | Refresh Quality | Lot tracing isolated to child | PASSED |
| **Workforce Administration** | `#employees/directory` | Employee Directory | + Add Employee Profile | Search Staff & Roles | Refresh Directory | Directory grid isolated to child | PASSED |
| **Workforce Administration** | `#employees/positions` | Org Structure | + Define Position | Review Sanctioned Capacity | Refresh Directory | Org chart isolated to child | PASSED |
| **Workforce Administration** | `#employees/staffing` | Staffing Requests | + Staffing Request | Review Capacity Requests | Refresh Directory | `+ Staffing Request` moved from Overview | PASSED |
| **Workforce Administration** | `#employees/onboarding` | Onboarding & Probation | + Onboard New Employee | Conduct 90-Day Review | Refresh Directory | `+ Onboard New Employee` moved from Overview | PASSED |
| **Workforce Administration** | `#employees/skills` | Skills Matrix | + Log Training | Verify Station Certification | Refresh Directory | Skills matrix isolated to child | PASSED |
| **Workforce Administration** | `#employees/documents` | Employee Documents | + Upload Contract | Track Statutory Expiry | Refresh Directory | Document store isolated to child | PASSED |
| **Workforce Administration** | `#employees/integrity` | Exit Clearance | Initiate Clearance | Revoke System Access | Refresh Directory | Offboarding isolated to child | PASSED |
| **Payroll Management** | `#payroll/readiness` | Readiness & Prep | Validate Upstream Feeds | Reconcile Shift Punches | Sync Payroll | Pipeline checklist isolated to child | PASSED |
| **Payroll Management** | `#payroll/runs` | Payroll Runs | + Create Payroll Run | Calculate / Approve / Pay | Sync Payroll | `+ Create Payroll Run` moved from Overview | PASSED |
| **Payroll Management** | `#payroll/employees` | Employee Drilldown | Drilldown Earnings Detail | Filter Component Allocations | Sync Payroll | Compensation grid isolated to child | PASSED |
| **Payroll Management** | `#payroll/exceptions` | Exception Centre | Resolve Gate Anomaly | Clear Payroll Blockers | Sync Payroll | Exception review isolated to child | PASSED |
| **Payroll Management** | `#payroll/adjustments` | Wage Adjustments | + Add Wage Adjustment | Approve Overtime Addition | Sync Payroll | Adjustments isolated to child | PASSED |
| **Payroll Management** | `#payroll/reconciliation` | Reconciliation | Balance Gross-to-Net | Verify Paise Invariants | Sync Payroll | Reconciler isolated to child | PASSED |
| **Payroll Management** | `#payroll/payments` | Payments & Banking | Generate Payment Batch | Export Bank NEFT Register | Sync Payroll | Banking batch isolated to child | PASSED |
| **Payroll Management** | `#payroll/payslips` | Payslips Workspace | Bulk Issue Payslips | Download PDF Payslips | Sync Payroll | Payslip issuer isolated to child | PASSED |
| **Payroll Management** | `#payroll/compliance` | Statutory & Tax | Export Statutory Returns | Review EPF / ESI / TDS | Sync Payroll | Tax register isolated to child | PASSED |
| **Payroll Management** | `#payroll/year_end` | Year-End & YTD | Generate Form 16 Prep | Review YTD Accumulators | Sync Payroll | Year-end isolated to child | PASSED |
| **Payroll Management** | `#payroll/reports` | Reports & Exports | Export Finance Journal | Download Variance Analytics | Sync Payroll | Report exporter isolated to child | PASSED |
| **Payroll Management** | `#payroll/audit` | Audit Trail | Verify Immutable Ledger | Filter User Events | Sync Payroll | Event log isolated to child | PASSED |
| **Finance & Accounts** | `#finance/gl-journals` | GL Journal Entries | + New Journal Entry | Post Journal to Ledger | Sync Ledgers | `+ New Journal Entry` moved from Overview | PASSED |
| **Finance & Accounts** | `#finance/sales-audit` | Sales Audit | Reconcile POS Sales | Match Tender Collections | Sync Ledgers | Sales reconciler isolated to child | PASSED |
| **Finance & Accounts** | `#finance/ap-invoices` | Accounts Payable | + Record AP Bill | Authorize Disbursement | Sync Ledgers | AP invoices isolated to child | PASSED |
| **Finance & Accounts** | `#finance/ar-receivables` | Receivables | + Record Collection | Track Overdue Accounts | Sync Ledgers | AR register isolated to child | PASSED |
| **Finance & Accounts** | `#finance/marketplace-settlements` | Channel Settlements | Fetch Aggregator Settlements | Reconcile Commission Deductions | Sync Ledgers | Aggregator ledger isolated to child | PASSED |
| **Finance & Accounts** | `#finance/bank-accounts` | Cash & Bank | + Add Bank Account | Perform Bank Reconciliation | Sync Ledgers | Bank manager isolated to child | PASSED |
| **Finance & Accounts** | `#finance/budgets` | Budget Management | + Allocate Budget | Review Actual vs Budget | Sync Ledgers | Budget matrix isolated to child | PASSED |
| **Finance & Accounts** | `#finance/tax-review` | Tax Review & GST | Generate GSTR-3B Summary | Review Input Tax Credits | Sync Ledgers | Tax review isolated to child | PASSED |
| **Finance & Accounts** | `#finance/period-close` | Period Close | Execute Month-End Close | Verify Trial Balance | Sync Ledgers | Close workflow isolated to child | PASSED |
| **Finance & Accounts** | `#finance/financial-statements` | Certified Statements | Export Balance Sheet / P&L | Generate Cash Flow Statement | Sync Ledgers | Statement viewer isolated to child | PASSED |
| **Finance & Accounts** | `#finance/integrity` | Financial Integrity | Run Invariant Verification | Check Zero-Imbalance Ledger | Sync Ledgers | Integrity auditor isolated to child | PASSED |
| **Menu Management** | `#menu/items` | Global Menu Items | + Add Menu Item | Search by Category & Concept | Refresh Catalog | `+ Add Menu Item` moved from Overview | PASSED |
| **Menu Management** | `#menu/menus` | Menus & Schedules | + Create Daypart Menu | Assign Channels & Outlets | Refresh Catalog | Daypart editor isolated to child | PASSED |
| **Menu Management** | `#menu/recipes` | Recipe Formulation | + Formulate Recipe | Calculate Theoretical COGS | Refresh Catalog | Recipe BOM isolated to child | PASSED |
| **Menu Management** | `#menu/modifiers` | Modifiers & Variants | + Add Modifier Group | Set Upsell Pricing | Refresh Catalog | Modifiers isolated to child | PASSED |
| **Menu Management** | `#menu/combos` | Combos & Sets | + Build Combo Set | Configure Item Selections | Refresh Catalog | Combo builder isolated to child | PASSED |
| **Menu Management** | `#menu/packaging` | Packaging BOM | Assign Packaging | Calculate Eco Surcharges | Refresh Catalog | Packaging isolated to child | PASSED |
| **Menu Management** | `#menu/pricing` | Multi-Tier Pricing | Set Outlet Overrides | Channel Markup Configuration | Refresh Catalog | Pricing engine isolated to child | PASSED |
| **Menu Management** | `#menu/availability` | 86 Stockout Control | Toggle Item Availability | Set Auto-Restore Timers | Refresh Catalog | 86 controls isolated to child | PASSED |
| **Menu Management** | `#menu/publishing` | Menu Publishing | Publish Change Set | Diff Version Verification | Refresh Catalog | Sync engine isolated to child | PASSED |
| **Menu Management** | `#menu/simulator` | POS Cart Simulator | Run Order Dry-Run | Test Modifier Hierarchy | Refresh Catalog | Simulator isolated to child | PASSED |
| **Menu Management** | `#menu/integrity` | Menu Integrity | Run Menu Audit | Flag Uncosted Recipes | Refresh Catalog | Audit engine isolated to child | PASSED |
| **Menu Management** | `#menu/analytics` | Menu Engineering | Export Sales Matrix | Review Stars & Plowhorses | Refresh Catalog | Profitability matrix isolated to child | PASSED |

---
*Generated per Universal Module Architecture Corrective Standard.*
