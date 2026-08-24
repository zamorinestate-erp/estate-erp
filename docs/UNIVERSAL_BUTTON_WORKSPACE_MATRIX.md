# Universal Button & Dedicated Workspace Architecture Matrix

| Profile | Module | Overview Route | Button Key | Button Label | Child Route | Child H1 | Dedicated Page? | Specific Registers/Forms? | Overview Clean? | Status |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **All** | Inventory | `#inventory` | `stock-by-cafe` | Stock Levels | `#inventory/stock-by-cafe` | Stock Levels | YES | Multi-Café Heatmap & Availability Register | YES | **PASS** |
| **All** | Inventory | `#inventory` | `global-items` | Global Item Master | `#inventory/global-items` | Global Item Master | YES | SKU Directory & `+ Add Global Item` Form | YES | **PASS** |
| **All** | Inventory | `#inventory` | `replenishment` | Replenishment & PAR | `#inventory/replenishment` | Replenishment & PAR | YES | Auto-indent & PAR level matrix | YES | **PASS** |
| **All** | Inventory | `#inventory` | `movements` | Receipts & Put-Away | `#inventory/movements` | Receipts & Put-Away | YES | Dock put-away register & receipt proof | YES | **PASS** |
| **All** | Inventory | `#inventory` | `stock-ledger` | Stock Ledger | `#inventory/stock-ledger` | Stock Ledger | YES | Chronological valuation transactions | YES | **PASS** |
| **All** | Inventory | `#inventory` | `lots-expiry` | Lots & FEFO Expiry | `#inventory/lots-expiry` | Lots & FEFO Expiry | YES | Expiry calendar & batch recall hold | YES | **PASS** |
| **All** | Inventory | `#inventory` | `transfers` | Inter-Café Transfers | `#inventory/transfers` | Inter-Café Transfers | YES | Transfer manifests & dispatches | YES | **PASS** |
| **All** | Inventory | `#inventory` | `reservations` | Stock Reservations | `#inventory/reservations` | Stock Reservations | YES | Allocated event stock registers | YES | **PASS** |
| **All** | Inventory | `#inventory` | `counts` | Cycle Counts | `#inventory/counts` | Cycle Counts | YES | Blind stocktake & reconciliation sheet | YES | **PASS** |
| **All** | Inventory | `#inventory` | `variance` | Wastage & Adjustments | `#inventory/variance` | Wastage & Adjustments | YES | Spillage logs & adjustment vouchers | YES | **PASS** |
| **All** | Inventory | `#inventory` | `recipes-variance` | Recipe Variance | `#inventory/recipes-variance` | Recipe Variance | YES | POS yield vs theoretical consumption | YES | **PASS** |
| **All** | Inventory | `#inventory` | `valuation` | Valuation & Reporting | `#inventory/valuation` | Valuation & Reporting | YES | FIFO asset valuation ledgers | YES | **PASS** |
| **All** | Inventory | `#inventory` | `recalls` | Recall & Traceability | `#inventory/recalls` | Recall & Traceability | YES | Forward/backward lot trace engine | YES | **PASS** |
| **All** | Inventory | `#inventory` | `integrity` | Inventory Integrity | `#inventory/integrity` | Inventory Integrity | YES | 16-point consistency validator | YES | **PASS** |
| **Master/Owner** | Bills & Receipts | `#bills` | `bills` | Finalised Invoices & Tax Receipts | `#bills/bills` | Finalised Invoices & Tax Receipts | YES | Bill register, itemized tax & 360 preview | YES | **PASS** |
| **Master/Owner** | Bills & Receipts | `#bills` | `receipts` | Receipts & Payment Evidence | `#bills/receipts` | Receipts & Payment Evidence | YES | Receipt register, tender links & vouchers | YES | **PASS** |
| **Master/Owner** | Bills & Receipts | `#bills` | `upload` | Upload Invoices & Receipts | `#bills/upload` | Upload & Ingest Invoices | YES | Vendor ingestion form & document vault | YES | **PASS** |
| **Master/Owner** | Bills & Receipts | `#bills` | `adjustments` | Adjustments, Refunds & Voids | `#bills/adjustments` | Adjustments, Refunds & Voids | YES | Cancellation logs & refund audits | YES | **PASS** |
| **Master/Owner** | Bills & Receipts | `#bills` | `payments` | Payment Tenders & Balancing | `#bills/payments` | Payment Tenders & Drawer Balancing | YES | UPI/Card/Cash split & drawer balancing | YES | **PASS** |
| **Master/Owner** | Bills & Receipts | `#bills` | `tax` | Tax Compliance & GST Register | `#bills/tax` | Tax Compliance & GST Register | YES | 5% Composite GST breakdown & HSNs | YES | **PASS** |
| **Master/Owner** | Bills & Receipts | `#bills` | `reconciliation` | EOD Reconciliation | `#bills/reconciliation` | End of Day (EOD) Reconciliation | YES | Terminal balancing & day sign-off | YES | **PASS** |
| **Master/Owner** | Bills & Receipts | `#bills` | `reports` | Sales Reports & ZURF Export | `#bills/reports` | Sales Reports & ZURF Export | YES | Financial export summaries & ZURF logs | YES | **PASS** |
| **All** | Expenses | `#expenses` | `vouchers` | Expense Vouchers & Register | `#expenses/vouchers` | Expense Vouchers & Register | YES | Outflow register & voucher creation | YES | **PASS** |
| **All** | Expenses | `#expenses` | `approvals` | Approvals Workbench | `#expenses/approvals` | Approvals Workbench | YES | Side-by-side voucher review & policy checks | YES | **PASS** |
| **All** | Expenses | `#expenses` | `evidence` | Receipts & Evidence Vault | `#expenses/evidence` | Receipts & Evidence Vault | YES | SHA-256 verified receipt register | YES | **PASS** |
| **All** | Expenses | `#expenses` | `cards` | Corporate Cards & Advances | `#expenses/cards` | Corporate Cards & Operational Advances | YES | Masked card feeds & advances | YES | **PASS** |
| **All** | Expenses | `#expenses` | `policies` | Expense Policies & Rules | `#expenses/policies` | Expense Policies & Rule Simulator | YES | Threshold policies & simulator | YES | **PASS** |
| **All** | Expenses | `#expenses` | `integrity` | Expense Integrity Centre | `#expenses/integrity` | Expense Integrity Centre | YES | Automated pre-audit check engine | YES | **PASS** |
| **Master/Admin** | Procurement | `#procurement` | `requisitions` | Purchase Requests | `#procurement/requisitions` | Purchase Requests | YES | Indent requests & pre-approvals | YES | **PASS** |
| **Master/Admin** | Procurement | `#procurement` | `catalogue` | Catalogue & Pricing | `#procurement/catalogue` | Catalogue & Pricing | YES | Contract rate cards & approved SKUs | YES | **PASS** |
| **Master/Admin** | Procurement | `#procurement` | `rfqs` | Sourcing & RFQs | `#procurement/rfqs` | Sourcing & RFQs | YES | Bidding sheets & supplier awards | YES | **PASS** |
| **Master/Admin** | Procurement | `#procurement` | `orders` | Purchase Orders | `#procurement/orders` | Purchase Orders | YES | Binding PO releases & dispatch tracking | YES | **PASS** |
| **Master/Admin** | Procurement | `#procurement` | `agreements` | Blanket Agreements | `#procurement/agreements` | Blanket Agreements | YES | Standing contracts & drawdown logs | YES | **PASS** |
| **Master/Admin** | Procurement | `#procurement` | `deliveries` | Inbound Deliveries | `#procurement/deliveries` | Inbound Deliveries | YES | ASNs & logistics tracking | YES | **PASS** |
| **Master/Admin** | Procurement | `#procurement` | `receiving` | Receiving & GRN | `#procurement/receiving` | Receiving & GRN | YES | Dock put-away & challan uploader | YES | **PASS** |
| **Master/Admin** | Procurement | `#procurement` | `matching` | Invoices & 3-Way Match | `#procurement/matching` | Invoices & Matching | YES | 3-Way tolerance check & invoice uploader | YES | **PASS** |
| **Master/Admin** | Procurement | `#procurement` | `suppliers` | Suppliers Directory | `#procurement/suppliers` | Suppliers Directory | YES | Vendor master & performance ratings | YES | **PASS** |
| **Master/Admin** | Procurement | `#procurement` | `exceptions` | Returns & Quality | `#procurement/exceptions` | Returns & Quality | YES | Dock reject logs & debit notes | YES | **PASS** |
| **Master/Admin** | Procurement | `#procurement` | `reports` | Reports & Spend Analytics | `#procurement/reports` | Reports & Analytics | YES | Spend analytics & OTIF scorecards | YES | **PASS** |
| **All** | Quality | `#quality` | `my-checks` | My Checks & Checklists | `#quality/my-checks` | My Checks & Checklists | YES | Shift opening/closing inspections | YES | **PASS** |
| **All** | Quality | `#quality` | `prp-fsms` | PRP & Food Safety Controls | `#quality/prp-fsms` | PRP & Food Safety Controls | YES | Sanitation logs & CCP limits | YES | **PASS** |
| **All** | Quality | `#quality` | `temperatures` | Temperature & Cold Chain | `#quality/temperatures` | Temperature & Cold Chain | YES | Chiller/freezer probe logs | YES | **PASS** |
| **All** | Quality | `#quality` | `holds` | Quality Holds & Quarantine | `#quality/holds` | Quality Holds & Quarantine | YES | Batch quarantine isolation records | YES | **PASS** |
| **All** | Quality | `#quality` | `ncrs` | NCR & Non-Conformance Log | `#quality/ncrs` | NCR & Non-Conformance Log | YES | Deviation logs & ingredient rejects | YES | **PASS** |
| **All** | Quality | `#quality` | `capas` | CAPA Corrective Actions | `#quality/capas` | CAPA Corrective Actions | YES | Root-cause analysis & sign-offs | YES | **PASS** |
| **All** | Quality | `#quality` | `traceability` | Traceability & Batch Recall | `#quality/traceability` | Traceability & Batch Recall | YES | Mock recall execution tool | YES | **PASS** |
| **All** | Quality | `#quality` | `audits` | Audits & Inspections | `#quality/audits` | Audits & Inspections | YES | Hygiene scoring & lab cert uploader | YES | **PASS** |
| **All** | Quality | `#quality` | `compliance` | Compliance & Licenses | `#quality/compliance` | Compliance & Licenses Register | YES | FSSAI licenses & water test docs | YES | **PASS** |
| **All** | Quality | `#quality` | `history` | Quality History & Analytics | `#quality/history` | Quality History & Analytics | YES | Historical compliance trends | YES | **PASS** |
