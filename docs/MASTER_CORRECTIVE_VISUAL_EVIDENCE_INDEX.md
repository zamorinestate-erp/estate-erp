# ZAMORIN CAFÉ ERP — MASTER CORRECTIVE PROGRAMME
## Visual Evidence Index & Screenshot Manifest

**Date**: August 24, 2026  
**Artifact Directory**: `docs/screenshots/`  
**Capture Method**: Chrome DevTools Protocol (CDP) Automated Full-Viewport Screen Captures  

---

## 1. Visual Manifest Index

The automated browser testing suites have captured and validated high-resolution visual evidence for every corrected module, landing overview, dedicated child workspace, and modal workflow.

```
+------------------------------------------+--------------------------------------------------------+---------------------------------------+
| Screenshot File                          | View / Workspace                                       | Key Visual Assertions Verified        |
+------------------------------------------+--------------------------------------------------------+---------------------------------------+
| inventory_landing_overview.png           | #inventory                                             | 14 Hub Tiles, Clean (No Heatmap)      |
| inventory_stock_levels_child.png         | #inventory/stock-by-cafe                               | H1 Dominant, Stock Heatmap Isolated   |
| inventory_global_item_master_child.png   | #inventory/items                                       | H1 Global Item Master, Ingestion Form |
| bills_landing_overview.png               | #bills                                                 | 7 Hub Tiles, Billing KPI Cards        |
| bills_receipts_dedicated_child.png       | #bills/receipts                                        | H2 Receipts, Audit Table, Proof links |
| bills_upload_dedicated_child.png         | #bills/upload                                          | Form + File Dropzone, Clean Grid      |
| expenses_evidence_vault_child.png        | #expenses/evidence                                     | H3 Evidence Vault, Upload Evidence    |
| settings_landing_overview.png            | #settings                                              | 12 Settings Category Tiles            |
| settings_security_child.png              | #settings/security                                     | H2 Security, Isolated Config Forms    |
| upload_dropzone_render.png               | Dropzone Component Render                              | Drag & Drop Box, Accept Filter        |
| document_preview_modal.png               | SHA-256 Vault Modal                                    | SHA-256 Checksum, 8-Yr Retention, DL  |
| universal_document_modal_popup.png       | Universal Document Modal                               | Universal Dropzone, Payee, Category   |
+------------------------------------------+--------------------------------------------------------+---------------------------------------+
```

---

## 2. Screenshot Visual Verification Descriptions

### 1. `inventory_landing_overview.png`
- **Route**: `#inventory` (Primary Master / Cafe Ops)
- **Visual Structure**: Dominant Header `Inventory & Stock Governance`, 4 Top KPI Cards (`Total Stock Items`, `Active Batches`, `Low Stock Items`, `Reorder Alerts`), and a 14-button Control-Centre Grid.
- **Purity**: Zero child tables, zero stock heatmaps, and zero item addition forms underneath the button grid.

### 2. `inventory_stock_levels_child.png`
- **Route**: `#inventory/stock-by-cafe`
- **Visual Structure**: Dominant H1 `Stock Levels (By Café & Global)`, `← Back to Hub` navigation button, café scope filter selector, and the multi-café inventory heatmap.
- **Isolation**: Global item creation forms and procurement actions are strictly excluded.

### 3. `bills_receipts_dedicated_child.png`
- **Route**: `#bills/receipts`
- **Visual Structure**: Dominant H2 `Receipts & Payment Evidence`, `← Back to Hub` button, 4 Receipts KPI cards (`Total Receipts`, `Total Retained Value`, `Digital Proofs: 100%`, `Reconciliation: Matched`), `📤 Upload Receipt` action button, and Authoritative Receipts Register with `.view-doc-attachment-btn` triggers.

### 4. `bills_upload_dedicated_child.png`
- **Route**: `#bills/upload`
- **Visual Structure**: Dominant H2 `Upload & Ingest Invoices`, `← Back to Hub` button, 2-column workspace layout with Universal File Dropzone on the left and live Ingestion Register on the right.

### 5. `document_preview_modal.png`
- **Route**: `#bills/receipts` (Triggered via click)
- **Visual Structure**: Glassmorphic modal titled `Digital Document Preview · [FileName]`, document icon, SHA-256 integrity indicator, Statutory 8-Year Retention proof (FY 2026–2034), and `📥 Download Document File` action.

### 6. `universal_document_modal_popup.png`
- **Route**: Any module (Triggered via `openUniversalDocumentModal()`)
- **Visual Structure**: Universal modal popup with drag-and-drop file dropzone, Category dropdown (`INVOICE`, `RECEIPT`, `PAYSLIP`, `COMPLIANCE`, `EVIDENCE`, `OTHER`), Vendor/Payee text input, and document amount/date fields.
