# ZAMORIN CAFÉ ERP — EXPORT COVERAGE & CORPORATE IDENTITY MATRIX

## 1. Executive Corporate Standard
All export generation complies strictly with `EXPORT_ENGINE_COMPANY_IDENTITY_MASTER_STANDARD.md`:
- **Corporate Entity**: Zamorin Café Private Limited
- **CIN**: U55101KA2024PTC189201 | **GSTIN**: 29AABCZ9821K1ZX
- **Headquarters**: 108 Koramangala 4th Block, 80 Feet Road, Bengaluru, Karnataka 560034
- **Universal Export Engine**: `backend/src/services/ZurfService.js` (Universal Report Format).
- **Mandatory Elements**: Top corporate brand header, gold accent borders, mandatory background watermark (*"CONFIDENTIAL - ZAMORIN CAFÉ ERP"*), tabular data layout, pagination metadata, generation audit footprint with SHA-256 integrity token.

## 2. Module Export Coverage Matrix
| Module Family | Export Format | Engine / Generator | Watermark & Branding | Role Authorization |
| :--- | :--- | :--- | :--- | :--- |
| **Reports & BI** | ZURF HTML, PDF, CSV, Excel | `ZurfService.renderZurfHtml` | Enforced (Gold Accent + Watermark) | MASTER, OWNER |
| **Finance & GL** | Financial Statement PDF, Trial Balance CSV | `ZurfService.renderZurfHtml` | Enforced (Gold Accent + Watermark) | MASTER, OWNER |
| **POS & Till** | Thermal 80mm ESC/POS, Digital Receipt HTML | `frontend/src/js/pages/posTill.js` | Enforced (Receipt Format) | ALL ROLES |
| **Bills & OCR** | Expense Reconciliation CSV, Tax Summary | `backend/src/services/ZurfService.js` | Enforced | MASTER, OWNER |
| **Payroll & Compensation** | Standard Monthly Payslip PDF | `frontend/src/js/pages/staffPayslips.js` | Enforced (Corporate Payslip) | MASTER, STAFF (Self) |
| **Inventory & Stock** | Stock Valuation CSV, Transfer Notes PDF | `ZurfService.renderZurfHtml` | Enforced | MASTER, CAFE_ADMIN |
| **Vendors & PO** | Purchase Order PDF, Vendor Scorecard CSV | `ZurfService.renderZurfHtml` | Enforced | MASTER |
| **Assets & Maintenance** | Asset Register CSV, Work Order PDF | `ZurfService.renderZurfHtml` | Enforced | MASTER |
| **Revenue Share** | Outlet Settlement Statement PDF | `ZurfService.renderZurfHtml` | Enforced | MASTER, OWNER |
| **Audit Logs** | Security Governance Audit Log JSON/CSV | `backend/src/controllers/adminController.js` | Enforced | PRIMARY MASTER ONLY |

## 3. Verification Score
- **Export Engines Audited**: 10 / 10 Active
- **Status**: 100% Certified Standard Compliant
