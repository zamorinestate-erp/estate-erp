# Reload, Refresh & Session Restoration Matrix

| Test Route | Route Category | F5 Refresh Result | Hard Reload Result | Session Context Restored? | Device ID Restored? | Exact Child Restored? | Sidebar Active State | Topbar & Theme Preserved | Duplicate API Calls? | Console / Auth Errors | Status |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `#dashboard` | Module Landing | Restored | Restored | YES | YES | YES | `#dashboard` Active | Paper / Preserved | 0 | 0 | **PASS** |
| `#inventory` | Module Landing | Restored | Restored | YES | YES | YES | `#inventory` Active | Paper / Preserved | 0 | 0 | **PASS** |
| `#inventory/stock-by-cafe` | Dedicated Child | Restored | Restored | YES | YES | YES (`Stock Levels`) | `#inventory` Active | Paper / Preserved | 0 | 0 | **PASS** |
| `#inventory/global-items` | Dedicated Child | Restored | Restored | YES | YES | YES (`Global Item Master`) | `#inventory` Active | Paper / Preserved | 0 | 0 | **PASS** |
| `#bills` | Module Landing | Restored | Restored | YES | YES | YES | `#bills` Active | Paper / Preserved | 0 | 0 | **PASS** |
| `#bills/receipts` | Dedicated Child | Restored | Restored | YES | YES | YES (`Receipts`) | `#bills` Active | Paper / Preserved | 0 | 0 | **PASS** |
| `#bills/upload` | Dedicated Child | Restored | Restored | YES | YES | YES (`Upload Invoices`) | `#bills` Active | Paper / Preserved | 0 | 0 | **PASS** |
| `#expenses` | Module Landing | Restored | Restored | YES | YES | YES | `#expenses` Active | Paper / Preserved | 0 | 0 | **PASS** |
| `#expenses/evidence` | Dedicated Child | Restored | Restored | YES | YES | YES (`Evidence Vault`) | `#expenses` Active | Paper / Preserved | 0 | 0 | **PASS** |
| `#procurement/receiving` | Dedicated Child | Restored | Restored | YES | YES | YES (`Receiving & GRN`) | `#procurement` Active | Paper / Preserved | 0 | 0 | **PASS** |
| `#procurement/matching` | Dedicated Child | Restored | Restored | YES | YES | YES (`3-Way Match`) | `#procurement` Active | Paper / Preserved | 0 | 0 | **PASS** |
| `#quality/compliance` | Dedicated Child | Restored | Restored | YES | YES | YES (`Compliance`) | `#quality` Active | Paper / Preserved | 0 | 0 | **PASS** |
| `#payroll/runs` | Dedicated Child | Restored | Restored | YES | YES | YES (`Payroll Runs`) | `#payroll` Active | Paper / Preserved | 0 | 0 | **PASS** |
| `#finance/gl-journals` | Dedicated Child | Restored | Restored | YES | YES | YES (`GL Journals`) | `#finance` Active | Paper / Preserved | 0 | 0 | **PASS** |
| `#settings` | Module Landing | Restored | Restored | YES | YES | YES | `#settings` Active | Paper / Preserved | 0 | 0 | **PASS** |
| `#settings/security` | Dedicated Child | Restored | Restored | YES | YES | YES (`Security & Sign-In`) | `#settings` Active | Paper / Preserved | 0 | 0 | **PASS** |
| `#settings/appearance` | Dedicated Child | Restored | Restored | YES | YES | YES (`Appearance`) | `#settings` Active | Paper / Preserved | 0 | 0 | **PASS** |
| `#ledger` | Single Workspace | Restored | Restored | YES | YES | YES (`Personal Ledger`) | `#ledger` Active | Paper / Preserved | 0 | 0 | **PASS** |
| `#approvals` | Single Workspace | Restored | Restored | YES | YES | YES (`Approvals`) | `#approvals` Active | Paper / Preserved | 0 | 0 | **PASS** |
