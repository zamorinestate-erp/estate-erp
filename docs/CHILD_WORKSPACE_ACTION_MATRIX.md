# Child Workspace Action Matrix

This matrix specifies the authoritative Primary and Secondary actions for every child workspace and documents the complete elimination of action leakage.

---

| Module | Child Workspace | Correct Primary Action | Secondary Actions | Unrelated Actions Found | Removed? | Status |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Inventory** | Stock Levels (`#inventory/stock-by-cafe`) | `Refresh Stock Data` | Filter by Status / Café | `+ Add Global Item`, `Add Item` | YES | **CLEAN** |
| **Inventory** | Global Item Master (`#inventory/global-items`) | `+ Add Global Item` | Import SKUs (CSV), Search | `Sync Stock` | YES | **CLEAN** |
| **Inventory** | Replenishment & PAR (`#inventory/replenishment`) | `Generate Indents` | Update PAR Limits, Export | `Add Global Item` | YES | **CLEAN** |
| **Inventory** | Receipts & Put-Away (`#inventory/movements`) | `+ Receive Goods` | Scan Barcode, Filter Date | None | YES | **CLEAN** |
| **Inventory** | Inter-Café Transfers (`#inventory/transfers`) | `+ Create Transfer` | Track Dispatch, Confirm Receipt | None | YES | **CLEAN** |
| **Inventory** | Cycle Counts (`#inventory/counts`) | `+ Start Cycle Count` | Download Count Sheet, Reconcile | None | YES | **CLEAN** |
| **Inventory** | Wastage & Adjustments (`#inventory/variance`) | `+ Record Wastage` | `+ Record Adjustment`, Export | None | YES | **CLEAN** |
| **Bills & Receipts** | Bills & Invoices (`#bills/bills`) | `Search & Filter Bills` | View Bill 360, Preview Receipt | `Upload Invoice` | YES | **CLEAN** |
| **Bills & Receipts** | Receipts (`#bills/receipts`) | `+ Record Payment Receipt` | Filter by Tender, Export CSV | None | YES | **CLEAN** |
| **Bills & Receipts** | Upload (`#bills/upload`) | `💾 Save & Ingest Bill` | Drag & Drop Dropzone, Clear | None | YES | **CLEAN** |
| **Expenses** | Vouchers (`#expenses/vouchers`) | `+ Record Expense` | Filter by Category, Export | None | YES | **CLEAN** |
| **Expenses** | Approvals (`#expenses/approvals`) | `Approve Voucher` | Reject / Request Info | None | YES | **CLEAN** |
| **Expenses** | Evidence Vault (`#expenses/evidence`) | `📤 Upload Receipt Evidence` | View SHA-256 Proof, Download | None | YES | **CLEAN** |
| **Procurement** | Purchase Requests (`#procurement/requisitions`) | `+ Purchase Request` | Filter by Dept / Urgency | `New PO` | YES | **CLEAN** |
| **Procurement** | Purchase Orders (`#procurement/orders`) | `+ New PO` | Export PO (PDF), Filter Status | `Add Supplier` | YES | **CLEAN** |
| **Procurement** | Receiving & GRN (`#procurement/receiving`) | `+ Intake GRN` | `📤 Upload Delivery Challan` | None | YES | **CLEAN** |
| **Procurement** | Invoices & Matching (`#procurement/matching`) | `📤 Upload Vendor Invoice` | `Re-run 3-Way Match` | None | YES | **CLEAN** |
| **Quality** | My Checks (`#quality/my-checks`) | `+ Start Check` | Select Template, Submit | None | YES | **CLEAN** |
| **Quality** | Temperatures (`#quality/temperatures`) | `+ Log Temperature` | Filter Chiller / Freezer | None | YES | **CLEAN** |
| **Quality** | Quality Holds (`#quality/holds`) | `+ Place Quality Hold` | Release Batch, Quarantine | None | YES | **CLEAN** |
| **Quality** | Audits (`#quality/audits`) | `+ Record Audit` | `📤 Upload Audit / Lab Cert` | None | YES | **CLEAN** |
| **Quality** | Compliance (`#quality/compliance`) | `+ Add License` | `📤 Upload License Document` | None | YES | **CLEAN** |
| **Workforce** | Directory (`#employees/directory`) | `+ Add Employee` | Filter Role / Outlet | None | YES | **CLEAN** |
| **Payroll** | Runs (`#payroll/runs`) | `+ Run Payroll` | View Summary, Export Bank File | None | YES | **CLEAN** |
| **Finance** | General Ledger (`#finance/gl-journals`) | `+ New Journal Entry` | Filter Account / Date | None | YES | **CLEAN** |
| **Menu** | Item Master (`#menu/items`) | `+ Add Menu Item` | Filter Category / Price | None | YES | **CLEAN** |
| **Suppliers** | Directory (`#vendors/directory`) | `+ Onboard Supplier` | `📤 Upload Vendor Docs`, 360 View | None | YES | **CLEAN** |
| **Assets** | Asset Register (`#assets/assets`) | `+ Register Asset` | Search Barcode, Export | None | YES | **CLEAN** |
| **Settings** | Security (`#settings/security`) | `Update Password` | `Setup MFA`, `Change PIN` | Global Portfolio Scope | YES | **CLEAN** |
