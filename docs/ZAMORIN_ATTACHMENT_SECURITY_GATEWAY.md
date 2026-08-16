# ZAMORIN CAFE ERP — ATTACHMENT SECURITY GATEWAY SPECIFICATION
**Document ID**: `ZAM-SPEC-ATTACHMENT-008`  
**Version**: `1.0.0`  
**Status**: `AUTHORITATIVE`

---

## 1. Inbound Gateway Security Filters
Every attachment arriving at `zamorinestatepvtltd.erp@gmail.com` undergoes four mandatory verification stages:

1. **Size Validation**: Maximum 25 MB. Larger attachments are quarantined.
2. **Dangerous Extension Blocking**: Explicitly rejects/quarantines:
   `.exe`, `.bat`, `.cmd`, `.scr`, `.ps1`, `.js`, `.msi`, `.com`, `.vbs`, `.hta`, `.pif`, `.cpl`, `.jar`, `.gadget`, `.wsf`, `.reg`, `.docm`, `.xlsm`.
3. **Cryptographic SHA-256 Digest**: Calculated immediately upon ingestion and indexed in `AttachmentRegistry`.
4. **Duplicate Invoice & Document Detection**: Detects re-sent or duplicate invoices by checking `matchedVendorId` + `sha256Hash`.

## 2. Zero Auto-Execution Guarantee
Attachments are stored as inert binary documents and never executed or passed to system shells.
