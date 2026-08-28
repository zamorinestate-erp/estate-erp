# ZAMORIN CAFÉ ERP — RECEIPT & PAYSLIP COVERAGE MATRIX

## 1. Receipt Standards
- **Customer Receipts**: 80mm thermal receipt structure, tax breakdown (CGST/SGST), itemized lines, FSSAI number (`11224333000541`), QR verification link.
- **Corporate Payslips**: Form 16 / Code on Wages structure, basic + DA + HRA + allowances, EPF / ESI / PT statutory deductions, net payable amount in words.

## 2. Receipt & Payslip Coverage Table
| Template Category | Target Route | Generation Engine | Format Options | Branding / Watermark |
| :--- | :--- | :--- | :--- | :--- |
| **POS Customer Receipt** | `#pos`, `#pos-till` | `frontend/src/js/pages/posTill.js` | HTML, ESC/POS Print, PDF | Zamorin Header + FSSAI |
| **Petty Cash Voucher** | `#expenses` | `frontend/src/js/pages/expenses.js` | HTML Print, PDF | Gold Header + Signatures |
| **Staff Salary Payslip** | `#payroll`, `#staff-payslips` | `frontend/src/js/pages/staffPayslips.js` | PDF, Printable HTML | Statutory Corporate Format |
| **GRN Arrival Slip** | `#procurement` | `frontend/src/js/pages/procurement.js` | HTML Print | Receiving Stamp + Batch |
| **Revenue Share Invoice** | `#revenue-share` | `frontend/src/js/pages/revenueShare.js` | Corporate ZURF PDF | Mandatory Watermark |

## 3. Status
- **Receipt Engines Audited**: 5 / 5 Active
- **Status**: 100% Compliant
