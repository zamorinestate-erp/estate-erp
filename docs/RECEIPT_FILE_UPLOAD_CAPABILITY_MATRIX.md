# Receipt & File Upload Capability Matrix

| Module | Entity Type | Receipt Upload | File Upload | Allowed File Extensions | Max Size | Linked Record Type | Safe Preview | Authenticated Download | Soft Delete & Audit | Permission Guard | Status |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Bills & Receipts** | `VENDOR_INVOICE` | YES | YES | `.pdf, .png, .jpg, .jpeg, .xlsx` | 15 MB | Bill / Tax Invoice | YES | YES | YES | `MASTER, OWNER` | **ACTIVE** |
| **Bills & Receipts** | `PAYMENT_RECEIPT` | YES | YES | `.pdf, .png, .jpg, .jpeg` | 15 MB | Customer POS Receipt | YES | YES | YES | `MASTER, OWNER, CAFE_ADMIN` | **ACTIVE** |
| **Expenses** | `EXPENSE_PROOF` | YES | YES | `.pdf, .png, .jpg, .jpeg` | 15 MB | Expense Voucher | YES | YES | YES | `MASTER, CAFE_ADMIN` | **ACTIVE** |
| **Procurement** | `DELIVERY_CHALLAN`| NO | YES | `.pdf, .png, .jpg, .jpeg, .xlsx` | 15 MB | GRN / Shipment | YES | YES | YES | `MASTER, CAFE_ADMIN` | **ACTIVE** |
| **Procurement** | `VENDOR_TAX_INVOICE`| YES | YES | `.pdf, .png, .jpg, .jpeg, .xlsx` | 15 MB | PO / 3-Way Match | YES | YES | YES | `MASTER, OWNER` | **ACTIVE** |
| **Quality & FSMS** | `LAB_REPORT` | NO | YES | `.pdf, .png, .jpg, .jpeg, .docx` | 15 MB | Audit / Water Test | YES | YES | YES | `MASTER, CAFE_ADMIN` | **ACTIVE** |
| **Quality & FSMS** | `FSSAI_LICENSE` | NO | YES | `.pdf, .png, .jpg, .jpeg` | 15 MB | Compliance Register | YES | YES | YES | `MASTER, OWNER` | **ACTIVE** |
| **Suppliers** | `VENDOR_CONTRACT` | NO | YES | `.pdf, .docx, .xlsx` | 15 MB | Supplier Master / Rate Card | YES | YES | YES | `MASTER, OWNER` | **ACTIVE** |
| **Workforce** | `EMPLOYEE_DOC` | NO | YES | `.pdf, .png, .jpg, .jpeg` | 15 MB | Employee KYC / Contract | YES | YES | YES | `MASTER` | **ACTIVE** |
| **Assets** | `MAINTENANCE_INVOICE`| YES | YES | `.pdf, .png, .jpg, .jpeg` | 15 MB | Work Order / Spares | YES | YES | YES | `MASTER, CAFE_ADMIN` | **ACTIVE** |
